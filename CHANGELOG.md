# Changelog

## 2.1.0 - March 2025

### Added
- **Enhanced RPC Redundancy System**
  - Support for multiple RPC providers (Helius, Shyft) with automatic failover
  - Connection Manager for managing HTTP endpoints with health checks
  - WebSocket Manager Factory for handling WebSocket connections
  - Customizable provider priority via environment variables
  - Robust error handling and automatic reconnection
- **Provider Comparison Tools**
  - Added `npm run dev:helius` and `npm run dev:shyft` commands for testing specific providers
  - New `compare-providers.sh` script to run providers in parallel for performance testing
- **Localization Improvements**
  - Added timezone support (Romania/Europe/Bucharest) for accurate timestamps
  - Improved log formatting with consistent timezone information
- **Documentation**
  - Updated README with instructions for RPC redundancy configuration
  - Added example environment file (.env.example) with placeholders

### Changed
- Modified environment validator to support multiple RPC endpoints
- Improved error handling throughout the application
- Enhanced WebSocket connection management
- Updated token handlers to use lazy initialization pattern

### Fixed
- Timing issues with connection initialization
- Resolved race conditions with handlers accessing uninitialized connections
- Fixed timezone display issues showing incorrect timestamps

## 2.0.0 - Initial Release

- 23-mar-2025:19: Add sound notification when the order has been filled
- 22-mar-2025:18: Fix liquidity Pool when subscribing to Raydium with two instructions, make it an array
- 22-mar-2025:15: Fix Raydium program ID.
- 22-mar-2025:04: Add Raydium support with correct program ID.
- 22-mar-2025:01: Add proper error handling.
- 21-mar-2025:08: Add BullX check support.
- 21-mar-2025:03: Fix Sniperoo buy.
- 21-mar-2025:00: Add auto-sell support when buying with Sniperoo.
- 20-mar-2025:17: Improve token extraction logic.
- 20-mar-2025:16: Add more granular rug check scenarios.
- 19-mar-2025:08: Sniperoo integration.
- 19-mar-2025:06: Fix rug check handler issues with error handling.
- 19-mar-2025:02: Add timeout support & error handling.
- 19-mar-2025:01: Fix timestamp display for logs (use luxon).
- 19-mar-2025:00: Initial version with rug check from RugCheck.XYZ.

## Legacy Sniper updates (branch: legacy-sniper-jupiter-swap-api)

- 19-mar-2025:21: Replace Helius "Enhanced Transactions API" with getParsedTransaction Solana RPC method (@solana/web3.js)
- 27-feb-2025:13: Updated the Jupiter API endpoints in .envbackup to reflect new endpoints.
- 27-feb-2025:13: Updated multiple project dependencies
- 10-jan-2025:21: Added Dexscreener Tokens API as price source for tracker with option in config.
- 09-jan-2025:21: Added token wallet balance, an amount mismatch check before trying to sell TP or SL to prevent quoting fees.
- 09-jan-2025:15: Added .env validator to check if all .env variables are properly set
- 06-jan-2025:11: Add rugcheck option: Exclude LP from topholders
- 02-jan-2025:16: Change Metadata RCP request to local database lookup
- 02-jan-2025:16: Expanded Rug check
- 02-jan-2025:16: Added new token tracker for rug check duplicates functionality and meta data
- 02-jan-2025:16: Added Simulation Mode to skip the actual swap
- 02-jan-2025:16: Added logsUnsubscribe before subscribing to RPC logsSubscribe method
- 02-jan-2025:16: Improved fetchTransactionDetails() error handling
- 02-jan-2025:16: Updated fetchTransactionDetails() to use retry based on count instead of time
- 02-jan-2025:16: Process transaction asynchronously and add max concurrent transactions
- 02-jan-2025:16: Revert back to native punycode as libraries are identical.
- 30-dec-2024:21: Added patch-package dev dependency to apply patches/tr46+0.0.3.patch
- 30-dec-2024:21: Added punycode.js package to resolve [issue](https://github.com/mathiasbynens/punycode.js/issues/137).
- 21-dec-2024:19: Added createSellTransaction() in transactions.ts to sell SL and TP tokens.
- 21-dec-2024:19: Added Retry logic for Swap Quote requests
- 21-dec-2024:19: Added Verbose loging option
- 18-dec-2024-22: Added tracker functionality in "src\tracker\index.ts".
- 18-dec-2024-22: Updated fetchAndSaveSwapDetails() in transactions.ts to use sqlite3.
- 18-dec-2024-22: Updated config.ts: Addded sell parameters
- 18-dec-2024-22: Added packages: luxon, sqlite, sqlite3
- 17-dec-2024-13: Added fetchAndSaveSwapDetails() in transactions.ts to track confirmed swaps.
- 17-dec-2024-13: Updated test.ts
- 17-dec-2024-13: Added JUP_HTTPS_PRICE_URI to .env.backup
- 17-dec-2024-13: Web3.js updated from 1.95.8 to 1.98.0
- 06-dec-2024-00: Initial Commit: Solana Sniper Bot
