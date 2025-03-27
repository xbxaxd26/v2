import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Runs the token sniper with a specific RPC provider
 * This script allows running the application with different environment files
 */

// Get provider from command line arguments
const provider = process.argv[2]?.toLowerCase();

if (!provider || (provider !== 'helius' && provider !== 'shyft')) {
  console.error(`Please specify a valid provider: 'helius' or 'shyft'`);
  process.exit(1);
}

// Define env file path based on provider
const envFile = `.env.${provider}`;
const envPath = path.resolve(process.cwd(), envFile);

// Check if the env file exists
if (!fs.existsSync(envPath)) {
  console.error(`Environment file not found: ${envFile}`);
  process.exit(1);
}

// Create a modified version of the env file for the specific provider
let envContent = fs.readFileSync(envPath, 'utf8');

if (provider === 'helius') {
  // For Helius, we need to ensure Helius comes first in the endpoints list
  // No modification needed to the original .env.helius file
  console.log(`🔄 Running with Helius as the primary RPC provider (using ${envFile})`);
} else if (provider === 'shyft') {
  // For Shyft, we've already configured the env-validator.ts to prioritize Shyft
  console.log(`🔄 Running with Shyft as the primary RPC provider (using ${envFile})`);
}

// Set custom process title for easier identification in task manager/process list
process.title = `token-sniper-${provider}`;

// Spawn the token sniper process with the specific env file
const child = spawn('ts-node', ['src/index.ts'], {
  env: { 
    ...process.env,
    DOTENV_CONFIG_PATH: envPath,
    PROVIDER: provider.toUpperCase(),
  },
  stdio: 'inherit'
});

// Handle process events
child.on('error', (error) => {
  console.error(`Error starting token sniper with ${provider}:`, error);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`Token sniper with ${provider} exited with code ${code}`);
  process.exit(code || 0);
}); 