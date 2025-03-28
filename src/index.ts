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
import { RugResponseExtended, EnhancedTokenData } from "./types"; // Import the RugResponseExtended type
import chalk from "chalk"; // Adding chalk for colorized console output
import Table from "cli-table3"; // For creating tables in console
import { getEnhancedTokenData, enablePriceAlerts, getEnhancedTransactionDetails, testApiKeys } from "./utils/handlers/enhancedTokenHandler";

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

// Enhanced token data for the current mint
let CURRENT_ENHANCED_DATA: EnhancedTokenData | null = null;

// Token statistics counters
let TOKENS_FOUND_COUNT = 0;
let TOKENS_PASSED_CHECK_COUNT = 0;
let TOKENS_PURCHASED_COUNT = 0;

// Helper function to get current timestamp
function getTimestamp(): string {
  // Use Romania timezone (Eastern European Time - EET/EEST)
  return DateTime.now().setZone('Europe/Bucharest').toFormat('yyyy-MM-dd HH:mm:ss.SSS');
}

/**
 * Create a formatted separator line for console output
 */
function logSeparator() {
  console.log(chalk.gray("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
}

/**
 * Print the statistics table
 */
function printStatistics() {
  const statsTable = new Table({
    head: [
      chalk.cyan('Tokens Found'),
      chalk.green('Passed Checks'),
      chalk.yellow('Purchased'),
      chalk.magenta('Success Rate')
    ],
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });

  const successRate = TOKENS_FOUND_COUNT > 0 
    ? Math.round((TOKENS_PASSED_CHECK_COUNT / TOKENS_FOUND_COUNT) * 100) 
    : 0;

  statsTable.push([
    chalk.cyan(TOKENS_FOUND_COUNT.toString()),
    chalk.green(TOKENS_PASSED_CHECK_COUNT.toString()),
    chalk.yellow(TOKENS_PURCHASED_COUNT.toString()),
    chalk.magenta(`${successRate}%`)
  ]);

  console.log(statsTable.toString());
}

// Function to display details of a token check in a table
async function displayTokenCheckDetails(report: RugResponseExtended, rugScore: number, maxScore: number, tokenAddress: string) {
  // Get enhanced token data
  const enhancedData = await getEnhancedTokenData(tokenAddress);
  
  // Store in global variable for later use
  CURRENT_ENHANCED_DATA = enhancedData;
  
  const checkTable = new Table({
    head: [
      chalk.cyan('Check Type'),
      chalk.cyan('Value'),
      chalk.cyan('Threshold'),
      chalk.cyan('Status')
    ],
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });

  // Token basic info
  console.log(chalk.magenta('\n🔎 Token Details:'));
  if (report.tokenMeta) {
    console.log(chalk.white(`Name: ${chalk.yellow(report.tokenMeta.name || 'Unknown')}`));
    console.log(chalk.white(`Symbol: ${chalk.yellow(report.tokenMeta.symbol || 'Unknown')}`));
  }
  
  console.log(chalk.white(`Supply: ${chalk.yellow(report.token?.supply?.toString() || 'Unknown')}`));
  console.log(chalk.white(`Decimals: ${chalk.yellow(report.token?.decimals?.toString() || 'Unknown')}`));

  // Display enhanced token details if available
  if (enhancedData.solscanData?.tokenInfo) {
    const tokenInfo = enhancedData.solscanData.tokenInfo;
    
    if (tokenInfo.isVerified) {
      console.log(chalk.green(`✓ Token is verified on Solscan`));
    }
    
    if (tokenInfo.tags && tokenInfo.tags.length > 0) {
      console.log(chalk.white(`Tags: ${tokenInfo.tags.map(tag => chalk.yellow(tag)).join(', ')}`));
    }
    
    if (tokenInfo.extensions) {
      const links = [];
      if (tokenInfo.extensions.website) links.push(chalk.blue(`🌐 ${chalk.underline(tokenInfo.extensions.website)}`));
      if (tokenInfo.extensions.twitter) links.push(chalk.cyan(`🐦 ${chalk.underline(`https://twitter.com/${tokenInfo.extensions.twitter.replace('@', '').trim()}`)}`));
      if (tokenInfo.extensions.telegram) links.push(chalk.blue(`📱 ${chalk.underline(`https://t.me/${tokenInfo.extensions.telegram.replace('https://t.me/', '').trim()}`)}`));
      if (tokenInfo.extensions.discord) links.push(chalk.magenta(`💬 ${chalk.underline(tokenInfo.extensions.discord)}`));
      
      if (links.length > 0) {
        console.log(chalk.white(`Links: ${links.join(' ')}`));
      }
    }
  }
  
  // Display market data if available from Birdeye
  if (enhancedData.birdeyeData?.data?.market) {
    const market = enhancedData.birdeyeData.data.market;
    
    console.log(chalk.magenta('\n💹 Market Data:'));
    
    const marketTable = new Table({
      style: {
        head: [], // Empty style for cleaner look
        border: [] // Empty border style
      }
    });
    
    marketTable.push(
      { 'Price': chalk.yellow(`$${market.price.toFixed(6)}`) },
      { '24h Change': market.priceChange24h >= 0 
          ? chalk.green(`+${market.priceChange24h.toFixed(2)}%`) 
          : chalk.red(`${market.priceChange24h.toFixed(2)}%`) },
      { 'Market Cap': chalk.yellow(`$${market.marketCap.toLocaleString()}`) },
      { 'Volume (24h)': chalk.yellow(`$${market.volume24h.toLocaleString()}`) },
      { 'Holders': chalk.yellow(market.holders.toLocaleString()) },
      { 'Transactions': chalk.yellow(market.transactions.toLocaleString()) }
    );
    
    console.log(marketTable.toString());
    
    // Enable price alerts option
    console.log(chalk.blue(`\n💲 To enable price alerts for this token, use:`));
    console.log(chalk.dim(`enablePriceAlerts("${tokenAddress}", 50, 20)`));
  }
  
  // Display creator information if available
  if (enhancedData.solscanData?.creator) {
    const creator = enhancedData.solscanData.creator;
    
    console.log(chalk.magenta('\n👤 Creator Information:'));
    
    const creatorTable = new Table({
      style: {
        head: [], // Empty style for cleaner look
        border: [] // Empty border style
      }
    });
    
    creatorTable.push(
      { 'Address': chalk.yellow(creator.address) },
      { 'Name': creator.name ? chalk.yellow(creator.name) : chalk.dim('Unknown') },
      { 'Verified': creator.isVerified ? chalk.green('Yes ✓') : chalk.red('No ✗') },
      { 'Tokens Created': chalk.yellow(creator.tokensCreated.toString()) }
    );
    
    if (creator.ruggedTokens && creator.ruggedTokens > 0) {
      creatorTable.push(
        { 'Rugged Tokens': chalk.red(`${creator.ruggedTokens} ⚠️`) }
      );
    }
    
    console.log(creatorTable.toString());
  }
  
  // Display social metrics if available
  if (enhancedData.birdeyeData?.data?.social) {
    const social = enhancedData.birdeyeData.data.social;
    
    console.log(chalk.magenta('\n📣 Social Metrics:'));
    
    const socialTable = new Table({
      style: {
        head: [], // Empty style for cleaner look
        border: [] // Empty border style
      }
    });
    
    if (social.twitter) {
      socialTable.push(
        { 'Twitter Followers': chalk.cyan(social.twitter.followers.toLocaleString()) },
        { 'Twitter Engagement': chalk.cyan(`${social.twitter.engagement.toFixed(2)}%`) },
        { 'Twitter Sentiment': getSentimentColor(social.twitter.sentiment) }
      );
    }
    
    if (social.discord) {
      socialTable.push(
        { 'Discord Members': chalk.magenta(social.discord.members.toLocaleString()) },
        { 'Discord Active': chalk.magenta(social.discord.active.toLocaleString()) }
      );
    }
    
    if (social.telegram) {
      socialTable.push(
        { 'Telegram Members': chalk.blue(social.telegram.members.toLocaleString()) }
      );
    }
    
    console.log(socialTable.toString());
  }
  
  // Top Holders info (excluding LPs if configured)
  let topHolders = report.topHolders || [];
  if (config.checks.settings.exclude_lp_from_topholders && report.markets) {
    const liquidityAddresses = report.markets
      .flatMap((market: any) => [market.liquidityA, market.liquidityB])
      .filter((address: any) => !!address);
      
    topHolders = topHolders.filter((holder: any) => !liquidityAddresses.includes(holder.address));
  }
  
  // Sort holders by percentage
  const sortedHolders = [...topHolders].sort((a, b) => b.pct - a.pct);
  
  // Use enhanced holders data if available
  const displayHolders = enhancedData.solscanData?.holders || sortedHolders;
  
  // Display top 3 holders
  if (displayHolders.length > 0) {
    console.log(chalk.magenta('\n👥 Top Holders:'));
    
    const holdersTable = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('Address'),
        chalk.cyan('Amount'),
        chalk.cyan('Percentage'),
        chalk.cyan('Type')
      ],
      style: {
        head: [], // Empty style for cleaner look
        border: [] // Empty border style
      }
    });
    
    // Display data differently based on which source we're using
    if ('percentage' in displayHolders[0]) {
      // Solscan data
      for (let i = 0; i < Math.min(5, displayHolders.length); i++) {
        const holder = displayHolders[i] as any;
        holdersTable.push([
          chalk.white((i + 1).toString()),
          chalk.yellow(holder.owner?.substring(0, 8) + '...'),
          chalk.white(Number(holder.amount).toLocaleString()),
          chalk.yellow(`${holder.percentage.toFixed(2)}%`),
          holder.isProgram ? chalk.blue('Program') : chalk.green('Wallet')
        ]);
      }
    } else {
      // RugCheck data
      for (let i = 0; i < Math.min(5, displayHolders.length); i++) {
        const holder = displayHolders[i] as any;
        holdersTable.push([
          chalk.white((i + 1).toString()),
          chalk.yellow(holder.address?.substring(0, 8) + '...'),
          chalk.white(holder.amount?.toString() || 'N/A'),
          chalk.yellow(`${holder.pct.toFixed(2)}%`),
          holder.insider ? chalk.red('Insider') : chalk.green('Regular')
        ]);
      }
    }
    
    console.log(holdersTable.toString());
  }
  
  // Create the security check results table
  checkTable.push(
    [
      'Mint Authority', 
      report.token.mintAuthority ? chalk.red('Enabled') : chalk.green('Disabled'), 
      chalk.white('Should be Disabled'), 
      !report.token.mintAuthority ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Freeze Authority', 
      report.token.freezeAuthority ? chalk.red('Enabled') : chalk.green('Disabled'), 
      chalk.white('Should be Disabled'), 
      !report.token.freezeAuthority ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Initialized', 
      report.token.isInitialized ? chalk.green('Yes') : chalk.red('No'), 
      chalk.white('Should be Yes'), 
      report.token.isInitialized ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Mutable', 
      report.tokenMeta?.mutable ? chalk.red('Yes') : chalk.green('No'), 
      chalk.white('Should be No'), 
      !report.tokenMeta?.mutable ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Max Holder %', 
      sortedHolders.length > 0 ? chalk.yellow(`${sortedHolders[0].pct.toFixed(2)}%`) : chalk.gray('N/A'), 
      chalk.white(`< ${config.checks.settings.max_allowed_pct_topholders}%`), 
      sortedHolders.length > 0 && sortedHolders[0].pct <= config.checks.settings.max_allowed_pct_topholders ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'LP Providers', 
      chalk.yellow(report.totalLPProviders || 0), 
      chalk.white(`>= ${config.checks.settings.min_total_lp_providers}`), 
      (report.totalLPProviders || 0) >= config.checks.settings.min_total_lp_providers ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Markets', 
      chalk.yellow(report.markets ? report.markets.length : 0), 
      chalk.white(`>= ${config.checks.settings.min_total_markets}`), 
      (report.markets ? report.markets.length : 0) >= config.checks.settings.min_total_markets ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Market Liquidity', 
      chalk.yellow(`$${(report.totalMarketLiquidity || 0).toLocaleString()}`), 
      chalk.white(`>= $${config.checks.settings.min_total_market_liquidity.toLocaleString()}`), 
      (report.totalMarketLiquidity || 0) >= config.checks.settings.min_total_market_liquidity ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Rug Score', 
      rugScore > maxScore && maxScore !== 0 ? chalk.red(rugScore) : chalk.yellow(rugScore), 
      maxScore !== 0 ? chalk.white(`< ${maxScore}`) : chalk.gray('Ignored'),
      rugScore <= maxScore || maxScore === 0 ? chalk.green('✓') : chalk.red('✗')
    ],
    [
      'Already Rugged', 
      report.rugged ? chalk.red('Yes') : chalk.green('No'), 
      chalk.white('Should be No'), 
      !report.rugged ? chalk.green('✓') : chalk.red('✗')
    ]
  );
  
  console.log(chalk.magenta('\n🛡️ Security Checks:'));
  console.log(checkTable.toString());
}

// Helper function to get colored sentiment text
function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive':
      return chalk.green('Positive 😃');
    case 'neutral':
      return chalk.yellow('Neutral 😐');
    case 'negative':
      return chalk.red('Negative 😠');
    default:
      return chalk.dim('Unknown');
  }
}

// Function used to handle the transaction once a new pool creation is found
async function processTransaction(signature: string): Promise<void> {
  TOKENS_FOUND_COUNT++;
  const timestamp = getTimestamp();
  
  logSeparator();
  console.log(chalk.blue(`🕒 [${timestamp}] `) + chalk.white(`Transaction #${TOKENS_FOUND_COUNT}`));
  console.log(chalk.cyan("💦 New Liquidity Pool signature found"));
  console.log(chalk.dim("⌛ Extracting token CA from signature..."));
  
  // Get enhanced transaction details if Solscan API key is available
  console.log(chalk.dim("📋 Retrieving detailed transaction information..."));
  const enhancedTx = await getEnhancedTransactionDetails(signature);
  if (enhancedTx) {
    console.log(chalk.green("✅ Retrieved enhanced transaction details"));
    
    // Create a transaction details table for better visualization
    const txDetailsTable = new Table({
      style: {
        head: [], // Empty style for cleaner look
        border: [] // Empty border style
      }
    });
    
    // Display transaction details if available
    if (enhancedTx.blockTime) {
      const txTime = DateTime.fromSeconds(enhancedTx.blockTime).setZone('Europe/Bucharest').toFormat('yyyy-MM-dd HH:mm:ss');
      txDetailsTable.push({ 'Transaction Time': chalk.yellow(txTime) });
    }
    
    if (enhancedTx.fee) {
      txDetailsTable.push({ 'Transaction Fee': chalk.yellow(`${enhancedTx.fee} SOL`) });
    }
    
    if (enhancedTx.status) {
      const statusColor = enhancedTx.status === 'success' ? chalk.green : chalk.red;
      txDetailsTable.push({ 'Status': statusColor(enhancedTx.status) });
    }
    
    if (enhancedTx.slot) {
      txDetailsTable.push({ 'Block Slot': chalk.yellow(enhancedTx.slot.toString()) });
    }
    
    console.log(txDetailsTable.toString());
  }
  
  console.log(chalk.blue(`🔗 ${chalk.underline("https://solscan.io/tx/" + signature)}`));

  /**
   * Extract the token CA from the transaction signature
   */
  const returnedMint = await getMintFromSignature(signature);
  if (!returnedMint) {
    console.log(chalk.red("❌ No valid token CA could be extracted"));
    console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
    return;
  }
  console.log(chalk.green(`✅ [${getTimestamp()}] Token CA extracted: `) + chalk.yellow(returnedMint));

  /**
   * Check if the mint address is the same as the current one to prevent failed logs from spam buying
   */
  if (CURRENT_MINT === returnedMint) {
    console.log(chalk.yellow("⏭️ Skipping duplicate mint to prevent mint spamming"));
    console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
    return;
  }
  CURRENT_MINT = returnedMint;

  /**
   * Perform checks based on selected level of rug check
   */
  if (CHECK_MODE === "snipe") {
    console.log(chalk.cyan(`🔍 Performing ${chalk.bold(CHECK_MODE)} check`));
    const tokenAuthorityStatus: TokenAuthorityStatus = await getTokenAuthorities(returnedMint);
    if (!tokenAuthorityStatus.isSecure) {
      /**
       * Token is not secure, check if we should skip based on preferences
       */
      const allowMintAuthority = config.checks.settings.allow_mint_authority || false;
      const allowFreezeAuthority = config.checks.settings.allow_freeze_authority || false;
      if (!allowMintAuthority && tokenAuthorityStatus.hasMintAuthority) {
        console.log(chalk.red("❌ Token has mint authority, skipping..."));
        console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
      if (!allowFreezeAuthority && tokenAuthorityStatus.hasFreezeAuthority) {
        console.log(chalk.red("❌ Token has freeze authority, skipping..."));
        console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
    }
    console.log(chalk.green("✅ Snipe check passed successfully"));
    TOKENS_PASSED_CHECK_COUNT++;
    if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
  } else if (CHECK_MODE === "middle") {
    /**
     *  Perform middle check - focused on critical security factors
     */
    console.log(chalk.cyan(`🔍 Performing ${chalk.bold(CHECK_MODE)} check`));
    
    // First check token authorities - these are the most critical
    const tokenAuthorityStatus: TokenAuthorityStatus = await getTokenAuthorities(returnedMint);
    if (!tokenAuthorityStatus.isSecure) {
      // Always reject tokens with mint or freeze authority in middle mode
      if (tokenAuthorityStatus.hasMintAuthority) {
        console.log(chalk.red("❌ Token has mint authority, skipping..."));
        console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
        if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
        return;
      }
      if (tokenAuthorityStatus.hasFreezeAuthority) {
        console.log(chalk.red("❌ Token has freeze authority, skipping..."));
        console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
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
        console.log(chalk.red("❌ Could not retrieve rug check data"));
        console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
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
          message: chalk.red("❌ Token is not initialized")
        },
        { 
          check: isRugged, 
          message: chalk.red("❌ Token has been rugged")
        },
        { 
          check: topHolders.some((holder: any) => holder.pct > config.checks.settings.max_allowed_pct_topholders), 
          message: chalk.red(`❌ Token has a holder with more than ${config.checks.settings.max_allowed_pct_topholders}% of supply`)
        },
        { 
          check: totalLPProviders < config.checks.settings.min_total_lp_providers, 
          message: chalk.red("❌ Not enough LP providers")
        },
        { 
          check: marketsLength < config.checks.settings.min_total_markets, 
          message: chalk.red("❌ Not enough markets")
        },
        { 
          check: totalMarketLiquidity < config.checks.settings.min_total_market_liquidity, 
          message: chalk.red("❌ Insufficient market liquidity")
        },
        { 
          check: rugScore > config.checks.settings.max_score && config.checks.settings.max_score !== 0, 
          message: chalk.red("❌ Rug score too high")
        }
      ];
      
      // Always display detailed token check information
      displayTokenCheckDetails(report, rugScore, config.checks.settings.max_score, returnedMint);
      
      // Check each condition
      for (const check of middleChecks) {
        if (check.check) {
          console.log(check.message);
          console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
          if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
          return;
        }
      }
      
      console.log(chalk.green("✅ Middle mode checks passed successfully"));
      TOKENS_PASSED_CHECK_COUNT++;
      if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
    } catch (error) {
      console.error(chalk.red("❌ Error in middle mode checks:"), error);
      console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
  } else if (CHECK_MODE === "full") {
    /**
     *  Perform full check
     */
    if (returnedMint.trim().toLowerCase().endsWith("pump") && config.checks.settings.ignore_ends_with_pump) {
      console.log(chalk.red("❌ Token ends with pump, skipping..."));
      console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
    // Check rug check
    const isRugCheckPassed = await getRugCheckConfirmed(returnedMint);
    if (!isRugCheckPassed) {
      console.log(chalk.red("❌ Full rug check not passed, skipping..."));
      console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
      if (PLAY_SOUND && config.sound_notifications.failed_check) playSound(config.sound_notifications.failed_message);
      return;
    }
    console.log(chalk.green("✅ Rug check passed successfully"));
    TOKENS_PASSED_CHECK_COUNT++;
    if (PLAY_SOUND && config.sound_notifications.passed_check) playSound(config.sound_notifications.passed_message);
  }

  /**
   * Perform Swap Transaction
   */
  if (BUY_PROVIDER === "sniperoo" && !SIM_MODE) {
    console.log(chalk.cyan("🔫 Sniping token using Sniperoo..."));
    const result = await buyToken(returnedMint, BUY_AMOUNT, SELL_ENABLED, SELL_TAKE_PROFIT, SELL_STOP_LOSS);
    if (!result) {
      CURRENT_MINT = ""; // Reset the current mint
      console.log(chalk.red("❌ Token not swapped. Sniperoo failed."));
      console.log(chalk.dim("🔎 Looking for new Liquidity Pools again\n"));
      return;
    }
    TOKENS_PURCHASED_COUNT++;
    if (PLAY_SOUND) playSound(config.token_buy.play_sound_text);
    console.log(chalk.green("✅ Token swapped successfully using Sniperoo"));
    
    // Set up price alerts automatically for purchased tokens
    try {
      console.log(chalk.blue("📊 Setting up price alerts..."));
      const alertResult = await enablePriceAlerts(
        returnedMint,
        SELL_TAKE_PROFIT, // Use the same percentage as take profit for high threshold
        SELL_STOP_LOSS    // Use the same percentage as stop loss for low threshold
      );
      
      if (alertResult) {
        console.log(chalk.green("✅ Price alerts set up successfully"));
        console.log(chalk.dim(`High alert: +${SELL_TAKE_PROFIT}%, Low alert: -${SELL_STOP_LOSS}%`));
      } else {
        console.warn(chalk.yellow("⚠️ Could not set up price alerts"));
      }
    } catch (error) {
      console.warn(chalk.yellow("⚠️ Failed to set up price alerts automatically"));
      if (error instanceof Error) {
        console.warn(chalk.dim(`Reason: ${error.message}`));
      }
    }
  }

  /**
   * Check if Simulation Mode is enabled in order to output the warning
   */
  if (SIM_MODE) {
    console.log(chalk.yellow("🧻 Token not swapped! Simulation Mode turned on."));
    if (PLAY_SOUND) playSound("Token found in simulation mode");
  }

  /**
   * Output token mint address and statistics
   */
  console.log(chalk.magenta(`\nToken Links:`));
  console.log(chalk.blue(`👽 GMGN: ${chalk.underline("https://gmgn.ai/sol/token/" + returnedMint)}`));
  console.log(chalk.blue(`😈 BullX: ${chalk.underline("https://neo.bullx.io/terminal?chainId=1399811149&address=" + returnedMint)}`));
  console.log(chalk.blue(`🦅 Birdeye: ${chalk.underline("https://birdeye.so/token/" + returnedMint + "?chain=solana")}`));
  console.log(chalk.blue(`✅ Solscan: ${chalk.underline("https://solscan.io/token/" + returnedMint)}`));

  // Additional enhanced data actions
  if (CURRENT_ENHANCED_DATA && (CURRENT_ENHANCED_DATA.birdeyeData || CURRENT_ENHANCED_DATA.solscanData)) {
    console.log(chalk.magenta(`\n🛠️ Enhanced Actions Available:`));
    if (CURRENT_ENHANCED_DATA.birdeyeData) {
      console.log(chalk.blue(`📊 Set price alerts: ${chalk.dim(`enablePriceAlerts("${returnedMint}", 50, 20)`)}`));
    }
  }

  // Print statistics table
  printStatistics();
}

// Main function to start the application
async function main(): Promise<void> {
  console.clear();
  const now = DateTime.now().setZone('Europe/Bucharest');
  
  // ASCII Art Banner
  console.log(chalk.cyan(`
   _____       _                     _____      _                 
  / ____|     | |                   / ____|    (_)                
 | (___   ___ | | __ _ _ __   __ _ | (___  _ __  _ _ __   ___ _ __ 
  \\___ \\ / _ \\| |/ _\` | '_ \\ / _\` | \\___ \\| '_ \\| | '_ \\ / _ \\ '__|
  ____) | (_) | | (_| | | | | (_| | ____) | | | | | |_) |  __/ |   
 |_____/ \\___/|_|\\__,_|_| |_|\\__,_| |_____/|_| |_|_| .__/ \\___|_|   
                                                   | |            
                                                   |_|   v2.0.0         
`));
  
  console.log(chalk.green(`🚀 Starting Solana Token Sniper at ${getTimestamp()}...`));
  console.log(chalk.blue(`⏰ Using timezone: Europe/Bucharest (${now.offsetNameShort})`));
  
  // Reset counters on startup
  TOKENS_FOUND_COUNT = 0;
  TOKENS_PASSED_CHECK_COUNT = 0;
  TOKENS_PURCHASED_COUNT = 0;

  // Load environment variables from the .env file
  const env = validateEnv();
  
  // Test Birdeye and Solscan API keys
  console.log(chalk.magenta("\n🔑 API Key Verification:"));
  const apiKeyStatus = await testApiKeys();
  
  // Update the enhanced features table based on API key status
  const enhancedFeaturesStatus = {
    'Auto Price Alerts': apiKeyStatus.birdeye ? chalk.green('ENABLED') : chalk.red('DISABLED - Missing Birdeye API key'),
    'Enhanced Tx Details': apiKeyStatus.solscan ? chalk.green('ENABLED') : chalk.red('DISABLED - Missing Solscan API key'),
    'Token Market Data': apiKeyStatus.birdeye ? chalk.green('ENABLED') : chalk.red('DISABLED - Missing Birdeye API key'),
    'Creator Verification': apiKeyStatus.solscan ? chalk.green('ENABLED') : chalk.red('DISABLED - Missing Solscan API key')
  };

  // Print configuration summary in a table
  console.log(chalk.magenta("\n📋 Configuration:"));
  
  const configTable = new Table({
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });
  
  configTable.push(
    { 'Check Mode': chalk.cyan(CHECK_MODE) },
    { 'Buy Amount': chalk.yellow(`${BUY_AMOUNT} SOL`) },
    { 'Simulation Mode': SIM_MODE ? chalk.green('ENABLED') : chalk.red('DISABLED') },
    { 'Auto-Sell': SELL_ENABLED ? chalk.green(`ENABLED (TP: ${SELL_TAKE_PROFIT}%, SL: ${SELL_STOP_LOSS}%)`) : chalk.red('DISABLED') },
    { 'Concurrent Transactions': chalk.yellow(MAX_CONCURRENT.toString()) }
  );
  
  console.log(configTable.toString());
  
  // Display check settings
  console.log(chalk.magenta("\n⚙️ Check Settings:"));
  
  const checkSettingsTable = new Table({
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });
  
  checkSettingsTable.push(
    { 'Allow Mint Authority': config.checks.settings.allow_mint_authority ? chalk.yellow('Yes') : chalk.green('No') },
    { 'Allow Freeze Authority': config.checks.settings.allow_freeze_authority ? chalk.yellow('Yes') : chalk.green('No') },
    { 'Max Holder Percentage': chalk.yellow(`${config.checks.settings.max_allowed_pct_topholders}%`) },
    { 'Exclude LP from Holders': config.checks.settings.exclude_lp_from_topholders ? chalk.green('Yes') : chalk.red('No') },
    { 'Block Returning Names': config.checks.settings.block_returning_token_names ? chalk.green('Yes') : chalk.red('No') },
    { 'Min LP Providers': chalk.yellow(config.checks.settings.min_total_lp_providers.toString()) },
    { 'Min Markets': chalk.yellow(config.checks.settings.min_total_markets.toString()) },
    { 'Min Market Liquidity': chalk.yellow(`$${config.checks.settings.min_total_market_liquidity.toLocaleString()}`) },
    { 'Max Rug Score': config.checks.settings.max_score > 0 ? chalk.yellow(config.checks.settings.max_score.toString()) : chalk.gray('Ignored') }
  );
  
  console.log(checkSettingsTable.toString());

  // Display enhanced features with updated status
  console.log(chalk.magenta("\n🛠️ Enhanced Features:"));
  
  const enhancedTable = new Table({
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });
  
  enhancedTable.push(
    { 'Auto Price Alerts': enhancedFeaturesStatus['Auto Price Alerts'] },
    { 'Enhanced Tx Details': enhancedFeaturesStatus['Enhanced Tx Details'] },
    { 'Token Market Data': enhancedFeaturesStatus['Token Market Data'] },
    { 'Creator Verification': enhancedFeaturesStatus['Creator Verification'] }
  );
  
  console.log(enhancedTable.toString());
  
  // Display available commands
  console.log(chalk.magenta("\n🧰 Available REPL Commands:"));
  console.log(chalk.dim("These commands are available in the console after startup:"));
  
  const commandsTable = new Table({
    head: [chalk.cyan('Command'), chalk.cyan('Description'), chalk.cyan('Example')],
    style: {
      head: [], // Empty style for cleaner look
      border: [] // Empty border style
    }
  });
  
  commandsTable.push(
    [
      chalk.green('enablePriceAlerts(token, high, low)'), 
      'Set price alerts for a token', 
      chalk.dim('enablePriceAlerts("So11...", 50, 20)')
    ],
    [
      chalk.green('getEnhancedTokenData(token)'), 
      'Get detailed token information', 
      chalk.dim('getEnhancedTokenData("So11...")')
    ],
    [
      chalk.green('processTransaction(signature)'), 
      'Analyze a transaction', 
      chalk.dim('processTransaction("5x9n...")')
    ],
    [
      chalk.green('testApiKeys()'), 
      'Verify API key connectivity', 
      chalk.dim('testApiKeys()')
    ]
  );
  
  console.log(commandsTable.toString());

  // Initialize the Connection Manager with multiple RPC endpoints
  console.log(chalk.magenta("\n🔗 Connecting to Blockchain:"));
  console.log(chalk.dim("⚙️ Setting up RPC connection manager with multiple endpoints..."));
  initConnectionManager({
    httpsEndpoints: env.rpc_https_endpoints,
    defaultCommitment: "confirmed",
    debug: true,
  });
  
  // Initialize the WebSocket Manager Factory
  console.log(chalk.dim("⚙️ Setting up WebSocket manager with multiple endpoints..."));
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
    console.log(chalk.green(`✅ Connected to WebSocket endpoint: ${wsManagerFactory.getCurrentEndpoint()}`));
    
    // Count enabled pools for subscription confirmation message
    const enabledPools = SUBSCRIBE_LP.filter((pool) => pool.enabled);
    
    console.log(chalk.cyan(`📡 Subscribing to ${enabledPools.length} liquidity pools...`));
    
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

      // Handle subscription response without logging
      if (parsedData.result !== undefined && !parsedData.error) {
        // Just increment a global subscription counter silently
        return;
      }

      // Only log RPC errors for debugging
      if (parsedData.error) {
        console.error(chalk.red("🚫 RPC Error:"), parsedData.error);
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

      // Find which pool instruction matched
      const matchedPool = SUBSCRIBE_LP.find((pool) => 
        pool.enabled && 
        logs.some((log: string) => typeof log === "string" && log.includes(pool.instruction))
      );
      
      // Verify if we have reached the max concurrent transactions
      if (activeTransactions >= MAX_CONCURRENT) {
        console.log(chalk.yellow("⏳ Max concurrent transactions reached, skipping..."));
        return;
      }

      // Add additional concurrent transaction
      activeTransactions++;

      // Process transaction asynchronously with enhanced error handling
      try {
        // Add pool name information before processing
        if (matchedPool) {
          logSeparator();
          console.log(chalk.blue(`📊 Pool: ${chalk.white(matchedPool.name)} | 🔍 Instruction: ${chalk.white(matchedPool.instruction)}`));
        }
        
        await processTransaction(signature);
      } catch (processError) {
        console.error(chalk.red("❌ Error processing transaction:"), {
          error: processError instanceof Error ? processError.message : "Unknown processing error",
          signature,
          timestamp: DateTime.now().setZone('Europe/Bucharest').toISO()
        });
      } finally {
        activeTransactions--;
      }
    } catch (error) {
      // Global error handler for the message processing
      console.error(chalk.red("💥 Critical error processing WebSocket message:"), {
        error: error instanceof Error ? error.message : "Unknown error",
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
      console.log(chalk.yellow("📴 WebSocket connection lost, attempting to reconnect..."));
    } else if (state === ConnectionState.CONNECTED) {
      console.log(chalk.green("🔄 WebSocket reconnected successfully."));
    }
  });

  // Start the connection
  wsManagerFactory.connect();

  // Handle application shutdown
  process.on("SIGINT", () => {
    logSeparator();
    console.log(chalk.red("\n🛑 Shutting down..."));
    
    // Display final statistics before shutdown
    console.log(chalk.magenta("\n📊 Final Statistics:"));
    printStatistics();
    
    wsManagerFactory.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logSeparator();
    console.log(chalk.red("\n🛑 Shutting down..."));
    
    // Display final statistics before shutdown
    console.log(chalk.magenta("\n📊 Final Statistics:"));
    printStatistics();
    
    wsManagerFactory.disconnect();
    process.exit(0);
  });
}

// Start the application
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

// Declare global functions for REPL access
declare global {
  namespace NodeJS {
    interface Global {
      enablePriceAlerts: (tokenAddress: string, highThresholdPct?: number, lowThresholdPct?: number) => Promise<boolean>;
      getEnhancedTokenData: (tokenAddress: string) => Promise<EnhancedTokenData>;
      processTransaction: (signature: string) => Promise<void>;
      testApiKeys: () => Promise<{birdeye: boolean, solscan: boolean}>;
    }
  }
}

// Add global commands for enhanced token features
(global as any).enablePriceAlerts = enablePriceAlerts;
(global as any).getEnhancedTokenData = getEnhancedTokenData;
(global as any).processTransaction = processTransaction;
(global as any).testApiKeys = testApiKeys;
