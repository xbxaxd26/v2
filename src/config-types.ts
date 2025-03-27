/**
 * Type definitions for the config object
 */

/**
 * Sound notification configuration
 */
export interface SoundNotificationsConfig {
  passed_check: boolean;
  failed_check: boolean;
  passed_message: string;
  failed_message: string;
  sound_method?: "auto" | "speech" | "beep" | "notify" | "none";
}

/**
 * Export the Config interface to be used by the config object
 */
export interface Config {
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
  sound_notifications: SoundNotificationsConfig;
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