import { Connection } from "@solana/web3.js";
import { validateEnv } from "../env-validator";
import { getConnection } from "../managers/connectionManager";
import { config } from "../../config";

// Constants
const WSOL_MINT = config.wsol_pc_mint;

/**
 * SignatureHandler class optimized for speed
 */
export class SignatureHandler {
  private connection: Connection;

  constructor(connection?: Connection) {
    this.connection = connection || getConnection();
  }

  /**
   * Get the mint address from a transaction signature - optimized for speed
   * @param signature Transaction signature
   * @returns Promise resolving to mint address or null
   */
  public async getMintFromSignature(signature: string): Promise<string | null> {
    if (!signature || typeof signature !== "string" || signature.trim() === "") {
      return null; // Invalid signature, return null immediately
    }

    try {
      // Fetch transaction with minimal options
      let tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      // Quick validation with retry
      if (!tx?.meta) {
        // Wait 200ms and try one more time
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Try with a different connection on retry for better reliability
        try {
          this.connection = getConnection();
        } catch (e) {
          // Ignore connection switching errors
        }
        
        tx = await this.connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        // If still no meta data, return null
        if (!tx?.meta) return null;
      }

      // Get token balances - prefer postTokenBalances as they're more likely to contain the new token
      const tokenBalances = tx.meta.postTokenBalances || tx.meta.preTokenBalances;
      if (!tokenBalances?.length) return null;

      // Fast path: If we have exactly 2 token balances, one is likely WSOL and the other is the token
      if (tokenBalances.length === 2) {
        const mint1 = tokenBalances[0].mint;
        const mint2 = tokenBalances[1].mint;

        // If mint1 is WSOL, return mint2 (unless it's also WSOL)
        if (mint1 === WSOL_MINT) {
          return mint2 === WSOL_MINT ? null : mint2;
        }

        // If mint2 is WSOL, return mint1
        if (mint2 === WSOL_MINT) {
          return mint1;
        }

        // If neither is WSOL, return the first one
        return mint1;
      }

      // For more than 2 balances, find the first non-WSOL mint
      for (const balance of tokenBalances) {
        if (balance.mint !== WSOL_MINT) {
          return balance.mint;
        }
      }

      // If we only found WSOL mints, return null
      return null;
    } catch (error) {
      // Minimal error logging for speed
      return null;
    }
  }
}

// Use lazy initialization for the singleton
let signatureHandlerInstance: SignatureHandler | null = null;

/**
 * Get the mint address from a transaction signature (optimized for speed)
 * @param signature Transaction signature
 * @returns Mint address or null
 */
export async function getMintFromSignature(signature: string): Promise<string | null> {
  // Lazy initialization - only create the handler when needed
  if (!signatureHandlerInstance) {
    try {
      signatureHandlerInstance = new SignatureHandler();
    } catch (error) {
      console.error("Error initializing SignatureHandler:", error);
      // Create a fallback handler with a direct connection if needed
      // This will only be used if the app is still initializing
      return null;
    }
  }
  return signatureHandlerInstance.getMintFromSignature(signature);
}
