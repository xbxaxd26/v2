This repository contains all the code "as is", following the "Solana PumpSwap Sniper Trading Bot in TypeScript" on YouTube provided by [DigitalBenjamins](https://x.com/digbenjamins).

Solana PumpSwap Sniper Trading Bot in TypeScript | Buy fast with JITO and Sell | pump.fun migration

[![Solana Sniper Trading Bot in TypeScript](https://img.youtube.com/vi/eQ8osFo5Df4/0.jpg)](https://www.youtube.com/watch?v=eQ8osFo5Df4)

## Project Description

The Solana PumpSwap trading sniper 2025 is a TypeScript (node.js) bot designed to automate the buying of (meme) tokens on the Solana blockchain.
It is configured to execute trades based on predefined checks and parameters like amount, slipage, rug check and priority. It checks for migration from pumpfun to pumpswap

With customizable parameters, you can tailor the strategy to suit your needs. The primary goal of this project is to educate users about the essential components required to develop a simple token sniper, offering insights into its functionality and implementation!

### Features

- Token Sniper for PumpSwap and Raydium for the Solana blockchain
- Rug check using a third party service rugcheck.xyz
- Possibility to skip pump.fun tokens
- Auto-buy with parameters for amount, slippage and priority using JITO
- Sell automatically using stop loss and Take profit
- **Enhanced RPC Redundancy** with multiple providers (Helius, Shyft) for improved reliability
- **Automatic Failover** to backup endpoints during outages or slowdowns
- Customizable timezone settings (defaults to Europe/Bucharest)
- Snipe using JITO sniper Sniperoo

### Prerequisites, Installation and Usage Instructions

1. Ensure [Node.js](https://nodejs.org/en) is installed on your computer.
2. Clone the repository to your local machine.
3. Navigate to the project folder and run the following command to install all dependencies: `npm i`
4. Copy `.env.example` to `.env` and add your API keys and wallet addresses
5. To start the sniper, run: `npm run dev`
6. To start the tracker, run: `npm run tracker`
7. Optional: To start the sniper and tracker after being compiled, run: `npm run start` and `npm run start:tracker`

### RPC Redundancy Configuration

This sniper bot features an advanced RPC redundancy system that allows you to use multiple RPC providers for improved reliability:

1. Configure multiple RPC endpoints in your `.env` file:
   ```
   # Primary RPC (Helius)
   HELIUS_HTTPS_URI="https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY"
   HELIUS_WSS_URI="wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY"
   
   # Backup RPC (Shyft)
   SHYFT_HTTPS_URI="https://rpc.shyft.to?api_key=YOUR_SHYFT_API_KEY"
   SHYFT_WSS_URI="wss://rpc.shyft.to?api_key=YOUR_SHYFT_API_KEY"
   
   # Set provider priority (HELIUS or SHYFT)
   PROVIDER="SHYFT"
   ```

2. Run with a specific provider:
   - `npm run dev:helius` - Run with Helius as primary provider
   - `npm run dev:shyft` - Run with Shyft as primary provider
   
3. Compare RPC providers (runs both simultaneously in separate terminals):
   - `npm run compare`

The system automatically detects RPC failures and switches to backup endpoints, ensuring your sniper bot keeps running even during RPC outages.

### Third Party documentation

- [Helius RPC nodes](https://docs.helius.dev)
- [Shyft RPC nodes](https://docs.shyft.to)
- [Sniperoo](https://www.sniperoo.app/signup?ref=IZ7ZYZEV)
- [Rugcheck API](https://api.rugcheck.xyz/swagger/index.html)
- [Solana](https://solana.com/docs)
- [Solscan](https://solscan.io)

### Disclaimer

The course videos accompanying this project are provided free of charge and are intended solely for educational purposes. This software does not guarantee profitability or financial success and is not designed to generate profitable trades.

You are solely responsible for your own financial decisions. Before making any trades or investments, it is strongly recommended that you consult with a qualified financial professional.

By using this software, you acknowledge that the creators and contributors of this project shall not be held liable for any financial losses, damages, or other consequences resulting from its use. Use the software at your own risk.

The software (code in this repository) must not be used to engage in any form of market manipulation, fraud, illegal activities, or unethical behavior. The creators of this project do not endorse or support malicious use cases, such as front-running, exploiting contracts, or harming other users. Users are expected to adhere to ethical trading practices and comply with applicable laws and regulations.

The software (code in this repository) is intended solely to facilitate learning and enhance the educational experience provided by the accompanying videos. Any other use is strictly prohibited.

All trading involves risk and may not be suitable for all individuals. You should carefully consider your investment objectives, level of experience, and risk appetite before engaging in any trading activities. Past performance is not indicative of future results, and there is no guarantee that any trading strategy, algorithm or tool discussed will result in profits or avoid losses.

I am not a licensed financial advisor or a registered broker-dealer. The content shared is based solely on personal experience and knowledge and should not be relied upon as financial advice or a guarantee of success. Always conduct your own research and consult with a professional financial advisor before making any investment decisions.
