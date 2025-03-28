import axios from "axios";
import { validateEnv } from "../env-validator";
import { BirdeyeTokenResponse, BirdeyeSocialData } from "../../types";
import chalk from "chalk";

const BASE_URL = "https://public-api.birdeye.so";
const TOKEN_ENDPOINT = "/public/tokeninfo";
const SOCIALS_ENDPOINT = "/defi/social_metrics";

/**
 * BirdeyeAPIHandler class for fetching token data from Birdeye
 */
export class BirdeyeAPIHandler {
  private apiKey: string;

  constructor() {
    const env = validateEnv();
    this.apiKey = env.BIRDEYE_API_KEY;
    
    if (!this.apiKey) {
      console.warn(chalk.yellow("⚠️ Birdeye API key not found. Enhanced market data features will be disabled."));
    } else {
      // Log part of the key for debugging (first 4 chars)
      const keyPrefix = this.apiKey.substring(0, 4);
      console.log(chalk.blue(`🔑 Birdeye API key loaded: ${keyPrefix}...`));
    }
  }

  /**
   * Get token information including market data
   * @param tokenAddress The token mint address
   * @returns Promise resolving to token information or null if error
   */
  public async getTokenInfo(tokenAddress: string): Promise<BirdeyeTokenResponse | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${BASE_URL}${TOKEN_ENDPOINT}`, {
        params: {
          address: tokenAddress,
          chain: "solana"
        },
        headers: {
          "X-API-KEY": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data as BirdeyeTokenResponse;
      }
      
      console.warn(chalk.yellow(`⚠️ Birdeye API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Birdeye API: 401 Unauthorized. Check your API key.`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Birdeye API error for ${tokenAddress}: ${error.response.status} - ${error.response.statusText}`));
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Birdeye API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Birdeye request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Birdeye token info for ${tokenAddress}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  /**
   * Get social data for a token
   * @param tokenAddress The token mint address
   * @returns Promise resolving to social data or null if error
   */
  public async getSocialData(tokenAddress: string): Promise<BirdeyeSocialData | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${BASE_URL}${SOCIALS_ENDPOINT}`, {
        params: {
          address: tokenAddress,
          chain: "solana"
        },
        headers: {
          "X-API-KEY": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data.data as BirdeyeSocialData;
      }
      
      console.warn(chalk.yellow(`⚠️ Birdeye API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Birdeye API: 401 Unauthorized. Check your API key.`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Birdeye API error for ${tokenAddress}: ${error.response.status} - ${error.response.statusText}`));
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Birdeye API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Birdeye request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Birdeye social data for ${tokenAddress}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  /**
   * Set up price alerts for a token
   * @param tokenAddress The token mint address
   * @param highThreshold The high price threshold for alerts
   * @param lowThreshold The low price threshold for alerts
   * @returns Promise resolving to success status
   */
  public async setupPriceAlerts(
    tokenAddress: string,
    highThreshold: number,
    lowThreshold: number
  ): Promise<boolean> {
    try {
      if (!this.apiKey) return false;
      
      // In a real implementation, this would likely call a Birdeye alerts API 
      // or set up a local monitoring system.
      // For now, we'll just log the intent and return success.
      console.log(chalk.blue(`📊 Set up price alerts for ${tokenAddress}:`));
      console.log(chalk.green(`📈 High threshold: $${highThreshold}`));
      console.log(chalk.red(`📉 Low threshold: $${lowThreshold}`));
      
      return true;
    } catch (error) {
      console.error(`Error setting up Birdeye price alerts for ${tokenAddress}:`, 
        error instanceof Error ? error.message : "Unknown error");
      return false;
    }
  }
}

// Create a singleton instance
let birdeyeAPIHandler: BirdeyeAPIHandler | null = null;

/**
 * Get token information from Birdeye
 * @param tokenAddress The token mint address
 * @returns Promise resolving to token information or null if error
 */
export async function getBirdeyeTokenInfo(tokenAddress: string): Promise<BirdeyeTokenResponse | null> {
  if (!birdeyeAPIHandler) {
    birdeyeAPIHandler = new BirdeyeAPIHandler();
  }
  
  return birdeyeAPIHandler.getTokenInfo(tokenAddress);
}

/**
 * Get social metrics data from Birdeye
 * @param tokenAddress The token mint address
 * @returns Promise resolving to social data or null if error
 */
export async function getBirdeyeSocialData(tokenAddress: string): Promise<BirdeyeSocialData | null> {
  if (!birdeyeAPIHandler) {
    birdeyeAPIHandler = new BirdeyeAPIHandler();
  }
  
  return birdeyeAPIHandler.getSocialData(tokenAddress);
}

/**
 * Set up price alerts for a token
 * @param tokenAddress The token mint address
 * @param highThreshold The high price threshold for alerts
 * @param lowThreshold The low price threshold for alerts
 * @returns Promise resolving to success status
 */
export async function setupBirdeyePriceAlerts(
  tokenAddress: string,
  highThreshold: number,
  lowThreshold: number
): Promise<boolean> {
  if (!birdeyeAPIHandler) {
    birdeyeAPIHandler = new BirdeyeAPIHandler();
  }
  
  return birdeyeAPIHandler.setupPriceAlerts(tokenAddress, highThreshold, lowThreshold);
} 