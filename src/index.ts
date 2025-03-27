import WebSocket from "ws"; // Node.js websocket library
import { config } from "./config"; // Configuration parameters for our bot
import { validateEnv } from "./utils/env-validator";
import { WebSocketManagerOptions, ConnectionState } from "./utils/managers/websocketManager";
import { initWebSocketManagerFactory, getWebSocketManagerFactory } from "./utils/managers/websocketManagerFactory";
import { initConnectionManager, getConnection } from "./utils/managers/connectionManager";
import { getMintFromSignature } from "./utils/handlers/signatureHandler";
import { getTokenAuthorities, TokenAuthorityStatus } from "./utils/handlers/tokenHandler";
import { buyToken } from "./utils/handlers/sniperooHandler";
import { getRugCheckConfirmed } from "./utils/handlers/rugCheckHandler";
import { playSound } from "./utils/notification";
import { DateTime } from "luxon";
import axios from "axios";
import { RugResponseExtended } from "./types"; // Import the RugResponseExtended type

// Regional Variables
let activeTransactions = 0;
const MAX_CONCURRENT = config.concurrent_transactions;
const CHECK_MODE = config.checks.mode || "full";
const BUY_PROVIDER = config.token_buy.provider;
const BUY_AMOUNT = config.token_buy.sol_amount;
const SUBSCRIBE_LP = config.liquidity_pool;
const SIM_MODE = config.checks.simulation_mode || false;
const PLAY_SOUND = config.token_buy.play_sound || false;

// Sell Options
const SELL_ENABLED = config.token_sell.enabled || false;
const SELL_STOP_LOSS = config.token_sell.stop_loss_percent || 15;
const SELL_TAKE_PROFIT = config.token_sell.take_profit_percent || 50;

// current handled mint
let CURRENT_MINT: string = "";

// Token statistics counters
let TOKENS_FOUND_COUNT = 0;
let TOKENS_PASSED_CHECK_COUNT = 0;
let TOKENS_PURCHASED_COUNT = 0;

// Helper function to get current timestamp
function getTimestamp(): string {
  // Use Romania timezone (Eastern European Time - EET/EEST)
  return DateTime.now().setZone('Europe/Bucharest').toFormat('yyyy-MM-dd HH:mm:ss.SSS');
}

// Function used to handle the transaction once a new pool creation is found
async function processTransaction(signature: string): Promise<void> {
  TOKENS_FOUND_COUNT++;
  const timestamp = getTimestamp();
  
  console.log("================================================================");
  console.log(`🕒 [${timestamp}] Transaction #${TOKENS_FOUND_COUNT}`);
  console.log("💦 [Process Transaction] New Liquidity Pool signature found");
  console.log("⌛ [Process Transaction] Extracting token CA from signature...");
  console.log("https://solscan.io/tx/" + signature);

  /**
   * Extract the token CA from the transaction signature
   */
  const returnedMint = await getMintFromSignature(signature);
  if (!returnedMint) {
    console.log("❌ [Process Transaction] No valid token CA could be extracted");
    console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
    return;
  }
  console.log(`✅ [${getTimestamp()}] Token CA extracted successfully: ${returnedMint}`);

  /**
   * Check if the mint address is the same as the current one to prevent failed logs from spam buying
   */
  if (CURRENT_MINT === returnedMint) {
    console.log("⏭️ [Process Transaction] Skipping duplicate mint to prevent mint spamming");
    console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
    return;
  }
  CURRENT_MINT = returnedMint;

  /**
   * Perform checks based on selected level of rug check
   */
  if (CHECK_MODE === "snipe") {
    console.log(`🔍 [Process Transaction] Performing ${CHECK_MODE} check`);
    const tokenAuthorityStatus: TokenAuthorityStatus = await getTokenAuthorities(returnedMint);
    if (!tokenAuthorityStatus.isSecure) {
      /**
       * Token is not secure, check if we should skip based on preferences
       */
      const allowMintAuthority = config.checks.settings.allow_mint_authority || false;
      const allowFreezeAuthority = config.checks.settings.allow_freeze_authority || false;
      if (!allowMintAuthority && tokenAuthorityStatus.hasMintAuthority) {
        console.log("❌ [Process Transaction] Token has mint authority, skipping...");
        console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
      if (!allowFreezeAuthority && tokenAuthorityStatus.hasFreezeAuthority) {
        console.log("❌ [Process Transaction] Token has freeze authority, skipping...");
        console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
    }
    console.log("✅ [Process Transaction] Snipe check passed successfully");
    TOKENS_PASSED_CHECK_COUNT++;
    if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
  } else if (CHECK_MODE === "middle") {
    /**
     *  Perform middle check - focused on critical security factors
     */
    console.log(`🔍 [Process Transaction] Performing ${CHECK_MODE} check`);
    
    // First check token authorities - these are the most critical
    const tokenAuthorityStatus: TokenAuthorityStatus = await getTokenAuthorities(returnedMint);
    if (!tokenAuthorityStatus.isSecure) {
      // Always reject tokens with mint or freeze authority in middle mode
      if (tokenAuthorityStatus.hasMintAuthority) {
        console.log("❌ [Process Transaction] Token has mint authority, skipping...");
        console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
      if (tokenAuthorityStatus.hasFreezeAuthority) {
        console.log("❌ [Process Transaction] Token has freeze authority, skipping...");
        console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
    }
    
    // Now perform additional selected checks from RugCheck API
    try {
      const rugResponse = await axios.get<RugResponseExtended>(`https://api.rugcheck.xyz/v1/tokens/${returnedMint}/report`, {
        timeout: config.axios.get_timeout,
      });

      if (!rugResponse.data) {
        console.log("❌ [Process Transaction] Could not retrieve rug check data");
        console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }

      // Extract only the specific checks we need for middle mode
      const report = rugResponse.data;
      const isInitialized = report.token.isInitialized;
      const isRugged = report.rugged;
      const rugScore = report.score;
      let topHolders = report.topHolders || [];
      const marketsLength = report.markets ? report.markets.length : 0;
      const totalLPProviders = report.totalLPProviders || 0;
      const totalMarketLiquidity = report.totalMarketLiquidity || 0;
      
      // Apply LP exclusion if configured
      if (config.checks.settings.exclude_lp_from_topholders && report.markets) {
        const liquidityAddresses = report.markets
          .flatMap((market: any) => [market.liquidityA, market.liquidityB])
          .filter((address: any) => !!address);
          
        topHolders = topHolders.filter((holder: any) => !liquidityAddresses.includes(holder.address));
      }
      
      // Check the critical factors as specified
      const middleChecks = [
        { 
          check: !isInitialized, 
          message: "❌ [Process Transaction] Token is not initialized" 
        },
        { 
          check: isRugged, 
          message: "❌ [Process Transaction] Token has been rugged" 
        },
        { 
          check: topHolders.some((holder: any) => holder.pct > config.checks.settings.max_allowed_pct_topholders), 
          message: `❌ [Process Transaction] Token has a holder with more than ${config.checks.settings.max_allowed_pct_topholders}% of supply` 
        },
        { 
          check: totalLPProviders < config.checks.settings.min_total_lp_providers, 
          message: "❌ [Process Transaction] Not enough LP providers" 
        },
        { 
          check: marketsLength < config.checks.settings.min_total_markets, 
          message: "❌ [Process Transaction] Not enough markets" 
        },
        { 
          check: totalMarketLiquidity < config.checks.settings.min_total_market_liquidity, 
          message: "❌ [Process Transaction] Insufficient market liquidity" 
        },
        { 
          check: rugScore > config.checks.settings.max_score && config.checks.settings.max_score !== 0, 
          message: "❌ [Process Transaction] Rug score too high" 
        }
      ];
      
      // Check each condition
      for (const check of middleChecks) {
        if (check.check) {
          console.log(check.message);
          console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
          if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
          return;
        }
      }
      
      console.log("✅ [Process Transaction] Middle mode checks passed successfully");
      TOKENS_PASSED_CHECK_COUNT++;
      if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
    } catch (error) {
      console.error("❌ [Process Transaction] Error in middle mode checks:", error);
      console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
  } else if (CHECK_MODE === "full") {
    /**
     *  Perform full check
     */
    if (returnedMint.trim().toLowerCase().endsWith("pump") && config.checks.settings.ignore_ends_with_pump) {
      console.log("❌ [Process Transaction] Token ends with pump, skipping...");
      console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
    // Check rug check
    const isRugCheckPassed = await getRugCheckConfirmed(returnedMint);
    if (!isRugCheckPassed) {
      console.log("❌ [Process Transaction] Full rug check not passed, skipping...");
      console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
    console.log("✅ [Process Transaction] Rug check passed successfully");
    TOKENS_PASSED_CHECK_COUNT++;
    if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
  }

  /**
   * Perform Swap Transaction
   */
  if (BUY_PROVIDER === "sniperoo" && !SIM_MODE) {
    console.log("🔫 [Process Transaction] Sniping token using Sniperoo...");
    const result = await buyToken(returnedMint, BUY_AMOUNT, SELL_ENABLED, SELL_TAKE_PROFIT, SELL_STOP_LOSS);
    if (!result) {
      CURRENT_MINT = ""; // Reset the current mint
      console.log("❌ [Process Transaction] Token not swapped. Sniperoo failed.");
      console.log("🔎 [Process Transaction] Looking for new Liquidity Pools again\n");
      return;
    }
    TOKENS_PURCHASED_COUNT++;
    if (PLAY_SOUND) playSound(config.token_buy.play_sound_text);
    console.log("✅ [Process Transaction] Token swapped successfully using Sniperoo");
  }

  /**
   * Check if Simulation Mode is enabled in order to output the warning
   */
  if (SIM_MODE) {
    console.log("🧻 [Process Transaction] Token not swapped! Simulation Mode turned on.");
    if (PLAY_SOUND) playSound("Token found in simulation mode");
  }

  /**
   * Output token mint address and statistics
   */
  console.log("👽 GMGN: https://gmgn.ai/sol/token/" + returnedMint);
  console.log("😈 BullX: https://neo.bullx.io/terminal?chainId=1399811149&address=" + returnedMint);
  console.log(`📊 Statistics: Found: ${TOKENS_FOUND_COUNT} | Passed Check: ${TOKENS_PASSED_CHECK_COUNT} | Purchased: ${TOKENS_PURCHASED_COUNT}`);
}

// Main function to start the application
async function main(): Promise<void> {
  console.clear();
  const now = DateTime.now().setZone('Europe/Bucharest');
  console.log(`🚀 Starting Solana Token Sniper at ${getTimestamp()}...`);
  console.log(`⏰ Using timezone: Europe/Bucharest (${now.offsetNameShort})`);
  
  // Reset counters on startup
  TOKENS_FOUND_COUNT = 0;
  TOKENS_PASSED_CHECK_COUNT = 0;
  TOKENS_PURCHASED_COUNT = 0;

  // Load environment variables from the .env file
  const env = validateEnv();

  // Initialize the Connection Manager with multiple RPC endpoints
  console.log("⚙️ Setting up RPC connection manager with multiple endpoints...");
  initConnectionManager({
    httpsEndpoints: env.rpc_https_endpoints,
    defaultCommitment: "confirmed",
    debug: true,
  });
  
  // Initialize the WebSocket Manager Factory
  console.log("⚙️ Setting up WebSocket manager with multiple endpoints...");
  const wsManagerFactory = initWebSocketManagerFactory(
    env.rpc_wss_endpoints,
    {
      initialBackoff: 1000,
      maxBackoff: 30000,
      maxRetries: Infinity,
      debug: true,
    } as WebSocketManagerOptions
  );

  // Set up event handlers
  wsManagerFactory.on("open", () => {
    console.log(`✅ Connected to WebSocket endpoint: ${wsManagerFactory.getCurrentEndpoint()}`);
    
    /**
     * Create a new subscription request for each program ID
     */
    SUBSCRIBE_LP.filter((pool) => pool.enabled).forEach((pool) => {
      const subscriptionMessage = {
        jsonrpc: "2.0",
        id: pool.id,
        method: "logsSubscribe",
        params: [
          {
            mentions: [pool.program],
          },
          {
            commitment: "processed", // Can use finalized to be more accurate.
          },
        ],
      };
      wsManagerFactory.send(JSON.stringify(subscriptionMessage));
    });
  });

  wsManagerFactory.on("message", async (data: WebSocket.Data) => {
    try {
      // Guard against null or undefined data
      if (!data) {
        console.warn("Received empty data from WebSocket");
        return;
      }

      let jsonString: string;
      let parsedData: any;

      try {
        jsonString = data.toString(); // Convert data to a string
        parsedData = JSON.parse(jsonString); // Parse the JSON string
      } catch (parseError) {
        console.error("Failed to parse WebSocket message:", parseError instanceof Error ? parseError.message : "Unknown error");
        return;
      }

      // Handle subscription response
      if (parsedData.result !== undefined && !parsedData.error) {
        console.log("✅ Subscription confirmed");
        return;
      }

      // Only log RPC errors for debugging
      if (parsedData.error) {
        console.error("🚫 RPC Error:", parsedData.error);
        return;
      }

      // Validate the response structure
      if (!parsedData.params?.result?.value) {
        // Not an error, just not the message format we're looking for
        return;
      }

      // Safely access the nested structure with explicit type checks
      const { logs, signature } = parsedData.params.result.value;

      // Validate `logs` is an array and if we have a signature
      if (!Array.isArray(logs) || typeof signature !== 'string' || !signature) {
        return;
      }

      // Verify if this is a new pool creation
      const liquidityPoolInstructions = SUBSCRIBE_LP.filter((pool) => pool.enabled).map((pool) => pool.instruction);
      const containsCreate = logs.some((log: string) => typeof log === "string" && liquidityPoolInstructions.some((instruction) => log.includes(instruction)));

      if (!containsCreate || typeof signature !== "string") return;

      // Verify if we have reached the max concurrent transactions
      if (activeTransactions >= MAX_CONCURRENT) {
        console.log("⏳ Max concurrent transactions reached, skipping...");
        return;
      }

      // Add additional concurrent transaction
      activeTransactions++;

      // Process transaction asynchronously with enhanced error handling
      try {
        await processTransaction(signature);
      } catch (processError) {
        console.error("Error processing transaction:", {
          error: processError instanceof Error ? processError.message : "Unknown processing error",
          signature,
          timestamp: DateTime.now().setZone('Europe/Bucharest').toISO()
        });
      } finally {
        activeTransactions--;
      }
    } catch (error) {
      // Global error handler for the message processing
      console.error("💥 Critical error processing WebSocket message:", {
        error: error instanceof Error ? error.message : "Unknown error",
        errorObject: error,
        timestamp: DateTime.now().setZone('Europe/Bucharest').toISO(),
      });
      
      // Continue processing other messages - don't let one bad message crash the app
    }
  });

  wsManagerFactory.on("error", (error: Error) => {
    console.error("WebSocket error:", error.message);
  });

  wsManagerFactory.on("state_change", (state: ConnectionState) => {
    if (state === ConnectionState.RECONNECTING) {
      console.log("📴 WebSocket connection lost, attempting to reconnect...");
    } else if (state === ConnectionState.CONNECTED) {
      console.log("🔄 WebSocket reconnected successfully.");
    }
  });

  // Start the connection
  wsManagerFactory.connect();

  // Handle application shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    wsManagerFactory.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down...");
    wsManagerFactory.disconnect();
    process.exit(0);
  });
}

// Start the application
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
