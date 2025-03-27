# Solana Token Sniper v2 with RPC Redundancy

This repository contains a Solana token sniper trading bot with advanced RPC redundancy that supports multiple RPC endpoints, including Helius and Shyft. The bot automatically switches between endpoints when one fails, ensuring maximum uptime and trading opportunities.

## Features

- **RPC Redundancy**: Automatically switches between multiple RPC endpoints for increased reliability
- **Multiple Rug Check Modes**: Choose between 'snipe', 'middle', and 'full' modes depending on your risk tolerance
- **Advanced Token Analysis**: Checks for mint/freeze authorities, holder distribution, and more
- **RugCheck.xyz Integration**: Advanced token analysis using RugCheck API
- **Auto-Buying**: Automatically purchase tokens that pass your safety checks
- **Customizable Settings**: Configure filters, API endpoints, and purchase settings
- **Sound Notifications**: Audio alerts for important events
- **Provider Performance Comparison**: Test which RPC provider is faster

## Setup

1. Clone the repository:
```bash
git clone https://github.com/xbxaxd26/v2.git
cd v2
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment template and add your API keys:
```bash
cp .env.template .env
```

4. Edit the `.env` file with your API keys:
```
# Sniperoo Config
SNIPEROO_API_KEY="YOUR_SNIPEROO_API_KEY"
SNIPEROO_PUBKEY="YOUR_WALLET_ADDRESS"

# Primary RPC (Helius)
HELIUS_HTTPS_URI="https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY"
HELIUS_WSS_URI="wss://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY"

# Add your Shyft API key
SHYFT_HTTPS_URI="https://rpc.shyft.to?api_key=YOUR_SHYFT_API_KEY"
SHYFT_WSS_URI="wss://rpc.shyft.to?api_key=YOUR_SHYFT_API_KEY"
```

## Usage

### Running the bot

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run with Helius as primary provider
npm run dev:helius

# Run with Shyft as primary provider
npm run dev:shyft

# Compare both providers side by side
npm run compare
```

### Configuration

Edit `src/config.ts` to customize your bot:

- Rug check settings
- Token purchase amount
- Liquidity pools to monitor
- Sound notifications
- Auto-sell settings

## RPC Provider Testing

The bot includes a script to compare Helius and Shyft performance:

```bash
npm run compare
```

This will open two separate terminals, each running with a different provider, allowing you to see which one detects tokens faster.

## Acknowledgements

This repository builds upon the "Solana PumpSwap Sniper Trading Bot in TypeScript" on YouTube provided by [DigitalBenjamins](https://x.com/digbenjamins) with significant enhancements for RPC redundancy and reliability.

## Disclaimer

This bot is provided for educational purposes only. Trading cryptocurrency carries significant risk, and you should never invest more than you can afford to lose. Always do your own research before making investment decisions.
