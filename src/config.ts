// Config interface definition
interface Config {
  liquidity_pool: {
    enabled: boolean;
    id: string;
    name: string;
    program: string;
    instruction: string;
  }[];
  concurrent_transactions: number;
  wsol_pc_mint: string;
  db: {
    pathname: string;
  };
  token_buy: {
    provider: string;
    sol_amount: number;
    play_sound: boolean;
    play_sound_text: string;
  };
  token_sell: {
    enabled: boolean;
    stop_loss_percent: number;
    take_profit_percent: number;
  };
  sound_notifications: {
    passed_check: boolean;
    failed_check: boolean;
    passed_message: string;
    failed_message: string;
    sound_method?: "auto" | "speech" | "beep" | "notify" | "none";
  };
  checks: {
    simulation_mode: boolean;
    mode: string;
    verbose_logs: boolean;
    settings: {
      allow_mint_authority: boolean;
      allow_freeze_authority: boolean;
      max_allowed_pct_topholders: number;
      exclude_lp_from_topholders: boolean;
      block_returning_token_names: boolean;
      block_returning_token_creators: boolean;
      allow_insider_topholders: boolean;
      allow_not_initialized: boolean;
      allow_rugged: boolean;
      allow_mutable: boolean;
      block_symbols: string[];
      block_names: string[];
      min_total_lp_providers: number;
      min_total_markets: number;
      min_total_market_liquidity: number;
      ignore_ends_with_pump: boolean;
      max_score: number;
    };
  };
  axios: {
    get_timeout: number;
  };
}

export const config: Config = {
  liquidity_pool: [
    {
      enabled: true,
      id: "pump1",
      name: "pumpswap",
      program: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
      instruction: "Program log: Instruction: CreatePool",
    },
    {
      enabled: true,
      id: "rad1",
      name: "Raydium",
      program: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
      instruction: "Program log: initialize2: InitializeInstruction2",
    },
  ],
  concurrent_transactions: 1, // Number of simultaneous transactions
  wsol_pc_mint: "So11111111111111111111111111111111111111112",
  db: {
    pathname: "src/tracker/tokens.db", // Sqlite Database location
  },
  token_buy: {
    provider: "sniperoo",
    sol_amount: 0.05, // Amount of SOL to spend
    play_sound: true, // Works on Windows and Linux/WSL2
    play_sound_text: "Order Filled!",
  },
  token_sell: {
    enabled: true, // If set to true, the bot will sell the token via Sniperoo API
    stop_loss_percent: 15,
    take_profit_percent: 50,
  },
  sound_notifications: {
    passed_check: true, // Play sound when token passes checks
    failed_check: true, // Play sound when token fails checks
    passed_message: "Passed",
    failed_message: "Failed",
    sound_method: "none", // Options: "auto", "speech", "beep", "notify", "none" - Use "beep" for most reliable notifications
  },
  checks: {
    simulation_mode: true,
    mode: "middle", // snipe=Minimal Checks, full=Full Checks based on Rug Check, middle=Balanced Security Checks, none=No Checks
    verbose_logs: false,
    settings: {
      // Dangerous (Checked in snipe mode)
      allow_mint_authority: false, // The mint authority is the address that has permission to mint (create) new tokens. Strongly Advised to set to false.
      allow_freeze_authority: false, // The freeze authority is the address that can freeze token transfers, effectively locking up funds. Strongly Advised to set to false
      // Critical
      max_allowed_pct_topholders: 50, // Max allowed percentage an individual topholder might hold
      exclude_lp_from_topholders: true, // If true, Liquidity Pools will not be seen as top holders
      block_returning_token_names: true,
      block_returning_token_creators: true,
      allow_insider_topholders: false, // Allow inseder accounts to be part of the topholders
      allow_not_initialized: false, // This indicates whether the token account is properly set up on the blockchain. Strongly Advised to set to false
      allow_rugged: false,
      allow_mutable: false,
      block_symbols: ["XXX"],
      block_names: ["XXX"],
      // Warning
      min_total_lp_providers: 1,
      min_total_markets: 1,
      min_total_market_liquidity: 10000,
      // Misc
      ignore_ends_with_pump: false,
      max_score: 11400, // Set to 0 to ignore
    },
  },
  axios: {
    get_timeout: 10000, // Timeout for API requests
  },
};
