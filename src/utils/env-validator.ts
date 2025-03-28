import dotenv from "dotenv";
import { loadEnvFromPath } from "./dotenv-config";

// Environment variable may already be loaded from dotenv-config
// but we keep this to ensure backward compatibility
dotenv.config();

export interface EnvConfig {
  HELIUS_HTTPS_URI: string;
  HELIUS_WSS_URI: string;
  SNIPEROO_API_KEY: string;
  SNIPEROO_PUBKEY: string;
  BIRDEYE_API_KEY: string;
  SOLSCAN_API_KEY: string;
  // Arrays for multiple RPC endpoints
  rpc_https_endpoints: string[];
  rpc_wss_endpoints: string[];
}

export function validateEnv(): EnvConfig {
  const requiredEnvVars = ["HELIUS_HTTPS_URI", "HELIUS_WSS_URI"] as const;
  const recommendedEnvVars = ["BIRDEYE_API_KEY", "SOLSCAN_API_KEY"] as const;

  const missingVars = requiredEnvVars.filter((envVar) => {
    return !process.env[envVar];
  });

  if (missingVars.length > 0) {
    throw new Error(`🚫 Missing required environment variables: ${missingVars.join(", ")}`);
  }

  // Check for recommended variables but don't throw an error if missing
  const missingRecommended = recommendedEnvVars.filter((envVar) => !process.env[envVar]);
  if (missingRecommended.length > 0) {
    console.warn(`⚠️ Missing recommended environment variables for enhanced features: ${missingRecommended.join(", ")}`);
  }

  const validateUrl = (envVar: string, protocol: string, checkApiKey: boolean = false): boolean => {
    const value = process.env[envVar];
    if (!value) return false;

    try {
      const url = new URL(value);
      if (url.protocol !== protocol) {
        console.warn(`⚠️ ${envVar} should start with ${protocol}`);
        return false;
      }
      if (checkApiKey) {
        const apiKeyParam = protocol === "wss:" ? "api-key" : "api_key";
        const apiKey = url.searchParams.get("api-key") || url.searchParams.get("api_key");
        if (!apiKey || apiKey.trim() === "") {
          console.warn(`⚠️ The 'api-key' parameter is missing or empty in the URL: ${value}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.warn(`⚠️ Invalid URL in ${envVar}: ${value}`);
      return false;
    }
  };

  // Collect all valid HTTPS endpoints
  const httpsEndpoints: string[] = [];
  const wssEndpoints: string[] = [];
  
  // Check if we are running with a specific provider
  const targetProvider = process.env.PROVIDER?.toLowerCase();
  
  if (targetProvider === 'shyft') {
    // Prioritize Shyft endpoints
    if (process.env.SHYFT_HTTPS_URI && validateUrl("SHYFT_HTTPS_URI", "https:", true)) {
      httpsEndpoints.push(process.env.SHYFT_HTTPS_URI);
      console.log("✅ Using Shyft as the primary RPC provider");
    }
    
    if (process.env.SHYFT_WSS_URI && validateUrl("SHYFT_WSS_URI", "wss:", true)) {
      wssEndpoints.push(process.env.SHYFT_WSS_URI);
    }

    // Add Helius endpoints as backup
    if (process.env.HELIUS_HTTPS_URI && validateUrl("HELIUS_HTTPS_URI", "https:", true)) {
      httpsEndpoints.push(process.env.HELIUS_HTTPS_URI);
    }
    
    if (process.env.HELIUS_WSS_URI && validateUrl("HELIUS_WSS_URI", "wss:", true)) {
      wssEndpoints.push(process.env.HELIUS_WSS_URI);
    }
  } else {
    // Default or explicit Helius priority
    if (targetProvider === 'helius') {
      console.log("✅ Using Helius as the primary RPC provider");
    }
    
    // Add primary Helius endpoints first
    if (process.env.HELIUS_HTTPS_URI && validateUrl("HELIUS_HTTPS_URI", "https:", true)) {
      httpsEndpoints.push(process.env.HELIUS_HTTPS_URI);
    }
    
    if (process.env.HELIUS_WSS_URI && validateUrl("HELIUS_WSS_URI", "wss:", true)) {
      wssEndpoints.push(process.env.HELIUS_WSS_URI);
    }
    
    // Add Shyft endpoints as backup
    if (process.env.SHYFT_HTTPS_URI && validateUrl("SHYFT_HTTPS_URI", "https:", true)) {
      httpsEndpoints.push(process.env.SHYFT_HTTPS_URI);
    }
    
    if (process.env.SHYFT_WSS_URI && validateUrl("SHYFT_WSS_URI", "wss:", true)) {
      wssEndpoints.push(process.env.SHYFT_WSS_URI);
    }
  }

  // Add remaining backup endpoints
  const backupHttpsVars = ["HELIUS_BACKUP_HTTPS_URI", "PUBLIC_HTTPS_URI"];
  const backupWssVars = ["HELIUS_BACKUP_WSS_URI", "PUBLIC_WSS_URI"];

  backupHttpsVars.forEach(varName => {
    if (process.env[varName] && validateUrl(varName, "https:", varName.includes("PUBLIC") ? false : true)) {
      httpsEndpoints.push(process.env[varName]!);
    }
  });

  backupWssVars.forEach(varName => {
    if (process.env[varName] && validateUrl(varName, "wss:", varName.includes("PUBLIC") ? false : true)) {
      wssEndpoints.push(process.env[varName]!);
    }
  });

  // Ensure we have at least one valid endpoint
  if (httpsEndpoints.length === 0) {
    throw new Error("🚫 No valid HTTPS RPC endpoints found!");
  }
  
  if (wssEndpoints.length === 0) {
    throw new Error("🚫 No valid WSS RPC endpoints found!");
  }

  console.log(`✅ Found ${httpsEndpoints.length} HTTPS and ${wssEndpoints.length} WSS endpoints`);
  console.log(`📊 HTTP endpoints order: ${httpsEndpoints.map(url => new URL(url).hostname).join(' -> ')}`);
  console.log(`📊 WS endpoints order: ${wssEndpoints.map(url => new URL(url).hostname).join(' -> ')}`);

  return {
    HELIUS_HTTPS_URI: process.env.HELIUS_HTTPS_URI!,
    HELIUS_WSS_URI: process.env.HELIUS_WSS_URI!,
    SNIPEROO_API_KEY: process.env.SNIPEROO_API_KEY!,
    SNIPEROO_PUBKEY: process.env.SNIPEROO_PUBKEY!,
    BIRDEYE_API_KEY: process.env.BIRDEYE_API_KEY || '',
    SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY || '',
    rpc_https_endpoints: httpsEndpoints,
    rpc_wss_endpoints: wssEndpoints,
  };
}
