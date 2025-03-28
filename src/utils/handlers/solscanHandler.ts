import axios from "axios";
import { validateEnv } from "../env-validator";
import { 
  SolscanTokenResponse, 
  SolscanHoldersResponse, 
  SolscanCreatorResponse 
} from "../../types";
import chalk from "chalk";

// Updated endpoints for Solscan v2 API
const BASE_URL = "https://pro-api.solscan.io/v2/token";
const TOKEN_ENDPOINT = "/meta";
const HOLDERS_ENDPOINT = "/holders";
const CREATOR_ENDPOINT = "/creator";
const TX_BASE_URL = "https://pro-api.solscan.io/v2/transaction";

/**
 * SolscanAPIHandler class for fetching token and account data from Solscan
 */
export class SolscanAPIHandler {
  private apiKey: string;

  constructor() {
    const env = validateEnv();
    this.apiKey = env.SOLSCAN_API_KEY;
    
    if (!this.apiKey) {
      console.warn(chalk.yellow("⚠️ Solscan API key not found. Enhanced token metadata features will be disabled."));
    } else {
      // Log part of the key for debugging (first 10 chars)
      const keyPrefix = this.apiKey.substring(0, 10);
      console.log(chalk.blue(`🔑 Solscan API key loaded: ${keyPrefix}...`));
    }
  }

  /**
   * Get detailed token information
   * @param tokenAddress The token mint address
   * @returns Promise resolving to token information or null if error
   */
  public async getTokenInfo(tokenAddress: string): Promise<SolscanTokenResponse | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${BASE_URL}${TOKEN_ENDPOINT}`, {
        params: {
          token: tokenAddress,
        },
        headers: {
          // Changed from "apikey" to "x-api-key" based on current Solscan API docs
          "x-api-key": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data as SolscanTokenResponse;
      }
      
      console.warn(chalk.yellow(`⚠️ Solscan API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Solscan API: 401 Unauthorized. Check your API key.`));
          // Log more details about the API key format
          console.error(chalk.yellow(`ℹ️ Solscan API key should be a JWT token (eyJ... format)`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Solscan API error for ${tokenAddress}: ${error.response.status} - ${error.response.statusText}`));
          if (error.response.data) {
            console.error(chalk.dim(`Response data: ${JSON.stringify(error.response.data)}`));
          }
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Solscan API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Solscan request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Solscan token info for ${tokenAddress}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  /**
   * Get token holders information
   * @param tokenAddress The token mint address
   * @param limit The maximum number of holders to return (default: 10)
   * @returns Promise resolving to holders information or null if error
   */
  public async getTokenHolders(tokenAddress: string, limit: number = 10): Promise<SolscanHoldersResponse | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${BASE_URL}${HOLDERS_ENDPOINT}`, {
        params: {
          token: tokenAddress,
          limit: limit.toString()
        },
        headers: {
          // Changed from "apikey" to "x-api-key" based on current Solscan API docs
          "x-api-key": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data as SolscanHoldersResponse;
      }
      
      console.warn(chalk.yellow(`⚠️ Solscan API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Solscan API: 401 Unauthorized. Check your API key.`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Solscan API error for ${tokenAddress}: ${error.response.status} - ${error.response.statusText}`));
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Solscan API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Solscan request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Solscan token holders for ${tokenAddress}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  /**
   * Get token creator information
   * @param creatorAddress The creator's address
   * @returns Promise resolving to creator information or null if error
   */
  public async getCreatorInfo(creatorAddress: string): Promise<SolscanCreatorResponse | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${BASE_URL}${CREATOR_ENDPOINT}`, {
        params: {
          address: creatorAddress,
        },
        headers: {
          // Changed from "apikey" to "x-api-key" based on current Solscan API docs
          "x-api-key": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data as SolscanCreatorResponse;
      }
      
      console.warn(chalk.yellow(`⚠️ Solscan API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Solscan API: 401 Unauthorized. Check your API key.`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Solscan API error for ${creatorAddress}: ${error.response.status} - ${error.response.statusText}`));
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Solscan API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Solscan request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Solscan creator info for ${creatorAddress}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }

  /**
   * Get detailed transaction information
   * @param signature The transaction signature
   * @returns Promise resolving to transaction details or null if error
   */
  public async getTransactionDetails(signature: string): Promise<any | null> {
    try {
      if (!this.apiKey) return null;
      
      const response = await axios.get(`${TX_BASE_URL}`, {
        params: {
          tx: signature,
        },
        headers: {
          // Changed from "apikey" to "x-api-key" based on current Solscan API docs
          "x-api-key": this.apiKey,
          "Accept": "application/json"
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.status === 200 && response.data.success) {
        return response.data.data;
      }
      
      console.warn(chalk.yellow(`⚠️ Solscan API returned status ${response.status} but success was not true`));
      return null;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          console.error(chalk.red(`🚫 Authentication failed with Solscan API: 401 Unauthorized. Check your API key.`));
        } else if (error.response) {
          console.error(chalk.red(`🚫 Solscan API error for tx ${signature}: ${error.response.status} - ${error.response.statusText}`));
        } else if (error.request) {
          console.error(chalk.red(`🚫 No response received from Solscan API: ${error.message}`));
        } else {
          console.error(chalk.red(`🚫 Error setting up Solscan request: ${error.message}`));
        }
      } else {
        console.error(`Error fetching Solscan transaction details for ${signature}:`, 
          error instanceof Error ? error.message : "Unknown error");
      }
      return null;
    }
  }
}

// Create a singleton instance
let solscanAPIHandler: SolscanAPIHandler | null = null;

/**
 * Get token information from Solscan
 * @param tokenAddress The token mint address
 * @returns Promise resolving to token information or null if error
 */
export async function getSolscanTokenInfo(tokenAddress: string): Promise<SolscanTokenResponse | null> {
  if (!solscanAPIHandler) {
    solscanAPIHandler = new SolscanAPIHandler();
  }
  
  return solscanAPIHandler.getTokenInfo(tokenAddress);
}

/**
 * Get token holders from Solscan
 * @param tokenAddress The token mint address
 * @param limit The maximum number of holders to return
 * @returns Promise resolving to holders information or null if error
 */
export async function getSolscanTokenHolders(tokenAddress: string, limit: number = 10): Promise<SolscanHoldersResponse | null> {
  if (!solscanAPIHandler) {
    solscanAPIHandler = new SolscanAPIHandler();
  }
  
  return solscanAPIHandler.getTokenHolders(tokenAddress, limit);
}

/**
 * Get creator information from Solscan
 * @param creatorAddress The creator's address
 * @returns Promise resolving to creator information or null if error
 */
export async function getSolscanCreatorInfo(creatorAddress: string): Promise<SolscanCreatorResponse | null> {
  if (!solscanAPIHandler) {
    solscanAPIHandler = new SolscanAPIHandler();
  }
  
  return solscanAPIHandler.getCreatorInfo(creatorAddress);
}

/**
 * Get transaction details from Solscan
 * @param signature The transaction signature
 * @returns Promise resolving to transaction details or null if error
 */
export async function getSolscanTransactionDetails(signature: string): Promise<any | null> {
  if (!solscanAPIHandler) {
    solscanAPIHandler = new SolscanAPIHandler();
  }
  
  return solscanAPIHandler.getTransactionDetails(signature);
} 