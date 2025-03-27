import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Load environment variables from a custom path if specified
 */
function loadEnvFromPath() {
  // Check if we have a custom dotenv path
  const customPath = process.env.DOTENV_CONFIG_PATH;
  const provider = process.env.PROVIDER || "";
  
  if (customPath && fs.existsSync(customPath)) {
    // Load from custom path
    dotenv.config({ path: customPath });
    console.log(`📄 Loaded environment from custom path: ${customPath}`);
    return;
  }

  // Fallback to default .env file
  dotenv.config();
}

// Execute loading immediately
loadEnvFromPath();

// Export for explicit import if needed
export { loadEnvFromPath }; 