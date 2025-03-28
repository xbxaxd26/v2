import { EnhancedTokenData, SolscanCreatorInfo, BirdeyeTokenResponse } from "../../types";
import { getRugCheckConfirmed } from "./rugCheckHandler";
import { getBirdeyeTokenInfo, getBirdeyeSocialData, setupBirdeyePriceAlerts } from "./birdeyeHandler";
import { 
  getSolscanTokenInfo, 
  getSolscanTokenHolders, 
  getSolscanCreatorInfo,
  getSolscanTransactionDetails
} from "./solscanHandler";
import { DateTime } from "luxon";
import chalk from "chalk";
import axios from "axios";
import { validateEnv } from "../env-validator";

/**
 * EnhancedTokenHandler class for managing combined token data
 */
export class EnhancedTokenHandler {
  private activeTokens: Map<string, EnhancedTokenData> = new Map();
  private alertIntervalId: NodeJS.Timeout | null = null;
  
  constructor() {
    // Initialize alert monitoring if needed
    this.startAlertMonitoring();
  }
  
  /**
   * Get enhanced token data from multiple sources
   * @param tokenAddress The token mint address
   * @returns Promise resolving to enhanced token data
   */
  public async getEnhancedTokenData(tokenAddress: string): Promise<EnhancedTokenData> {
    // Check if we already have data for this token
    const existingData = this.activeTokens.get(tokenAddress);
    if (existingData) {
      return existingData;
    }
    
    // Create new enhanced token data
    const enhancedData: EnhancedTokenData = {
      mintAddress: tokenAddress,
    };
    
    // Get Birdeye data
    const birdeyeData = await getBirdeyeTokenInfo(tokenAddress);
    if (birdeyeData) {
      enhancedData.birdeyeData = birdeyeData;
      
      // Try to get social data if token info was found
      const socialData = await getBirdeyeSocialData(tokenAddress);
      if (socialData) {
        enhancedData.birdeyeData.data.social = socialData;
      }
    }
    
    // Get Solscan data
    const solscanTokenInfo = await getSolscanTokenInfo(tokenAddress);
    if (solscanTokenInfo) {
      enhancedData.solscanData = {
        tokenInfo: solscanTokenInfo.data
      };
      
      // Get token holders
      const holdersData = await getSolscanTokenHolders(tokenAddress);
      if (holdersData) {
        enhancedData.solscanData.holders = holdersData.data.holders;
      }
      
      // If we have a token creator from Solscan, get their info
      if (solscanTokenInfo.data && 'creator' in solscanTokenInfo.data) {
        const creatorAddress = (solscanTokenInfo.data as any).creator;
        if (creatorAddress) {
          const creatorInfo = await getSolscanCreatorInfo(creatorAddress);
          if (creatorInfo) {
            enhancedData.solscanData.creator = creatorInfo.data;
          }
        }
      }
    }
    
    // Store in our active tokens map
    this.activeTokens.set(tokenAddress, enhancedData);
    
    return enhancedData;
  }
  
  /**
   * Enable price alerts for a token
   * @param tokenAddress The token mint address
   * @param highThreshold The high price threshold for alerts (% above current price)
   * @param lowThreshold The low price threshold for alerts (% below current price)
   * @returns Promise resolving to boolean success
   */
  public async enablePriceAlerts(
    tokenAddress: string, 
    highThresholdPct: number = 50, 
    lowThresholdPct: number = 20
  ): Promise<boolean> {
    try {
      // Get the enhanced data for this token
      const tokenData = await this.getEnhancedTokenData(tokenAddress);
      
      // Can't set alerts without price data
      if (!tokenData.birdeyeData?.data?.market?.price) {
        console.warn(chalk.yellow(`⚠️ Cannot set price alerts for ${tokenAddress}: No price data available`));
        return false;
      }
      
      const currentPrice = tokenData.birdeyeData.data.market.price;
      const highThreshold = currentPrice * (1 + (highThresholdPct / 100));
      const lowThreshold = currentPrice * (1 - (lowThresholdPct / 100));
      
      // Enable alerts in the token data
      tokenData.alertsEnabled = true;
      tokenData.priceAlerts = {
        highThreshold,
        lowThreshold
      };
      
      // Update the token data in our map
      this.activeTokens.set(tokenAddress, tokenData);
      
      // Set up the actual alerts via Birdeye API
      await setupBirdeyePriceAlerts(tokenAddress, highThreshold, lowThreshold);
      
      return true;
    } catch (error) {
      console.error(`Error enabling price alerts for ${tokenAddress}:`, 
        error instanceof Error ? error.message : "Unknown error");
      return false;
    }
  }
  
  /**
   * Get transaction details with enhanced metadata
   * @param signature The transaction signature
   * @returns Promise resolving to transaction details or null if error
   */
  public async getEnhancedTransactionDetails(signature: string): Promise<any | null> {
    try {
      // Get basic transaction details first
      const transactionDetails = await getSolscanTransactionDetails(signature);
      if (!transactionDetails) {
        return null;
      }
      
      // Extract token addresses from transaction if available
      const tokenAddresses: string[] = [];
      
      // Logic to extract token addresses from transaction details
      // This would depend on the exact structure of Solscan's transaction response
      
      // Get enhanced data for each token
      const enhancedTokens = await Promise.all(
        tokenAddresses.map(address => this.getEnhancedTokenData(address))
      );
      
      // Combine transaction details with enhanced token data
      return {
        ...transactionDetails,
        enhanced: {
          tokens: enhancedTokens
        }
      };
    } catch (error) {
      console.error(`Error getting enhanced transaction details for ${signature}:`, 
        error instanceof Error ? error.message : "Unknown error");
      return null;
    }
  }
  
  /**
   * Start monitoring for price alerts
   * This function sets up an interval to check prices of tracked tokens
   */
  private startAlertMonitoring(): void {
    // Check every 5 minutes for price changes
    this.alertIntervalId = setInterval(async () => {
      // Skip if no tokens with alerts
      if (this.activeTokens.size === 0) {
        return;
      }
      
      // Timestamp for logging
      const timestamp = DateTime.now().toFormat('HH:mm:ss');
      
      // Check each token with enabled alerts
      for (const [address, data] of this.activeTokens.entries()) {
        if (!data.alertsEnabled || !data.priceAlerts) {
          continue;
        }
        
        try {
          // Refresh token data
          const refreshedData = await getBirdeyeTokenInfo(address);
          if (!refreshedData?.data?.market?.price) {
            continue;
          }
          
          const currentPrice = refreshedData.data.market.price;
          const { highThreshold, lowThreshold } = data.priceAlerts;
          
          // Check if price crossed thresholds
          if (currentPrice >= highThreshold) {
            console.log(chalk.green(`🚀 [${timestamp}] PRICE ALERT: ${address} price $${currentPrice.toFixed(6)} has crossed HIGH threshold $${highThreshold.toFixed(6)}`));
          } else if (currentPrice <= lowThreshold) {
            console.log(chalk.red(`📉 [${timestamp}] PRICE ALERT: ${address} price $${currentPrice.toFixed(6)} has crossed LOW threshold $${lowThreshold.toFixed(6)}`));
          }
          
          // Update stored data with latest price
          data.birdeyeData = refreshedData;
          this.activeTokens.set(address, data);
        } catch (error) {
          console.error(`Error monitoring price for ${address}:`, 
            error instanceof Error ? error.message : "Unknown error");
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
  
  /**
   * Stop monitoring for price alerts
   */
  public stopAlertMonitoring(): void {
    if (this.alertIntervalId) {
      clearInterval(this.alertIntervalId);
      this.alertIntervalId = null;
    }
  }
}

// Create a singleton instance
let enhancedTokenHandler: EnhancedTokenHandler | null = null;

/**
 * Get enhanced token data from multiple sources
 * @param tokenAddress The token mint address
 * @returns Promise resolving to enhanced token data
 */
export async function getEnhancedTokenData(tokenAddress: string): Promise<EnhancedTokenData> {
  if (!enhancedTokenHandler) {
    enhancedTokenHandler = new EnhancedTokenHandler();
  }
  
  return enhancedTokenHandler.getEnhancedTokenData(tokenAddress);
}

/**
 * Enable price alerts for a token
 * @param tokenAddress The token mint address
 * @param highThresholdPct The high price threshold percentage for alerts
 * @param lowThresholdPct The low price threshold percentage for alerts
 * @returns Promise resolving to boolean success
 */
export async function enablePriceAlerts(
  tokenAddress: string,
  highThresholdPct: number = 50,
  lowThresholdPct: number = 20
): Promise<boolean> {
  if (!enhancedTokenHandler) {
    enhancedTokenHandler = new EnhancedTokenHandler();
  }
  
  return enhancedTokenHandler.enablePriceAlerts(tokenAddress, highThresholdPct, lowThresholdPct);
}

/**
 * Get transaction details with enhanced metadata
 * @param signature The transaction signature
 * @returns Promise resolving to transaction details or null if error
 */
export async function getEnhancedTransactionDetails(signature: string): Promise<any | null> {
  if (!enhancedTokenHandler) {
    enhancedTokenHandler = new EnhancedTokenHandler();
  }
  
  return enhancedTokenHandler.getEnhancedTransactionDetails(signature);
}

/**
 * Test API connectivity to make sure keys are valid
 * @returns Promise with test results
 */
export async function testApiKeys(): Promise<{birdeye: boolean, solscan: boolean}> {
  console.log(chalk.blue("🔍 Testing API key connectivity..."));
  const env = validateEnv();
  
  // Result object
  const results = {
    birdeye: false,
    solscan: false
  };
  
  // Test Birdeye API
  if (env.BIRDEYE_API_KEY) {
    try {
      console.log(chalk.dim("Testing Birdeye API connection..."));
      const response = await axios.get("https://public-api.birdeye.so/public/tokenlist", {
        params: {
          offset: "0",
          limit: "1",
          chain: "solana"
        },
        headers: {
          "X-API-KEY": env.BIRDEYE_API_KEY,
          "Accept": "application/json"
        },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log(chalk.green("✅ Birdeye API connection successful!"));
        results.birdeye = true;
      } else {
        console.error(chalk.red(`❌ Birdeye API returned status ${response.status}`));
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red("❌ Birdeye API key is invalid (401 Unauthorized)"));
        } else if (error.response) {
          console.error(chalk.red(`❌ Birdeye API error: ${error.response.status} - ${error.response.statusText}`));
        } else {
          console.error(chalk.red(`❌ Birdeye API connection error: ${error.message}`));
        }
      } else {
        console.error(chalk.red(`❌ Birdeye API error: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }
  } else {
    console.warn(chalk.yellow("⚠️ No Birdeye API key found in environment"));
  }
  
  // Test Solscan API
  if (env.SOLSCAN_API_KEY) {
    try {
      console.log(chalk.dim("Testing Solscan API connection..."));
      // Use a known token for testing, like BONK
      const testToken = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
      
      const response = await axios.get("https://pro-api.solscan.io/v2/token/meta", {
        params: {
          token: testToken
        },
        headers: {
          "x-api-key": env.SOLSCAN_API_KEY,
          "Accept": "application/json"
        },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log(chalk.green("✅ Solscan API connection successful!"));
        results.solscan = true;
      } else {
        console.error(chalk.red(`❌ Solscan API returned status ${response.status}`));
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red("❌ Solscan API key is invalid (401 Unauthorized)"));
          console.error(chalk.yellow("ℹ️ Solscan API key should be a JWT token (eyJ... format)"));
        } else if (error.response) {
          console.error(chalk.red(`❌ Solscan API error: ${error.response.status} - ${error.response.statusText}`));
          if (error.response.data) {
            console.error(chalk.dim(`Response data: ${JSON.stringify(error.response.data)}`));
          }
        } else {
          console.error(chalk.red(`❌ Solscan API connection error: ${error.message}`));
        }
      } else {
        console.error(chalk.red(`❌ Solscan API error: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    }
  } else {
    console.warn(chalk.yellow("⚠️ No Solscan API key found in environment"));
  }
  
  return results;
} 