export interface NewTokenRecord {
  id?: number; // Optional because it's added by the database
  time: number;
  name: string;
  mint: string;
  creator: string;
}
export interface MintsDataReponse {
  tokenMint?: string;
  solMint?: string;
}
export interface RugResponseExtended {
  mint: string;
  tokenProgram: string;
  creator: string;
  token: {
    mintAuthority: string | null;
    supply: number;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: string | null;
  };
  token_extensions: unknown | null;
  tokenMeta: {
    name: string;
    symbol: string;
    uri: string;
    mutable: boolean;
    updateAuthority: string;
  };
  topHolders: {
    address: string;
    amount: number;
    decimals: number;
    pct: number;
    uiAmount: number;
    uiAmountString: string;
    owner: string;
    insider: boolean;
  }[];
  freezeAuthority: string | null;
  mintAuthority: string | null;
  risks: {
    name: string;
    value: string;
    description: string;
    score: number;
    level: string;
  }[];
  score: number;
  fileMeta: {
    description: string;
    name: string;
    symbol: string;
    image: string;
  };
  lockerOwners: Record<string, unknown>;
  lockers: Record<string, unknown>;
  lpLockers: unknown | null;
  markets: {
    pubkey: string;
    marketType: string;
    mintA: string;
    mintB: string;
    mintLP: string;
    liquidityA: string;
    liquidityB: string;
  }[];
  totalMarketLiquidity: number;
  totalLPProviders: number;
  rugged: boolean;
}

// Birdeye API Types
export interface BirdeyeTokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  twitter?: string;
  discord?: string;
  telegram?: string;
  website?: string;
  coingeckoId?: string;
}

export interface BirdeyeMarketData {
  marketCap: number;
  volume24h: number;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  fdv: number; // Fully Diluted Valuation
  holders: number;
  transactions: number;
}

export interface BirdeyeSocialData {
  twitter?: {
    followers: number;
    engagement: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  };
  discord?: {
    members: number;
    active: number;
  };
  telegram?: {
    members: number;
  };
}

export interface BirdeyeTokenResponse {
  success: boolean;
  data: {
    token: BirdeyeTokenInfo;
    market: BirdeyeMarketData;
    social?: BirdeyeSocialData;
  };
}

// Solscan API Types
export interface SolscanTokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  iconURL: string;
  isVerified: boolean;
  coingeckoId?: string;
  tags?: string[];
  extensions?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    medium?: string;
  };
}

export interface SolscanTokenHolder {
  address: string;
  owner: string;
  amount: string;
  percentage: number;
  rank: number;
  isProgram: boolean;
}

export interface SolscanCreatorInfo {
  address: string;
  name?: string;
  isVerified: boolean;
  twitter?: string;
  tokensCreated: number;
  ruggedTokens?: number;
}

export interface SolscanTokenResponse {
  success: boolean;
  data: SolscanTokenInfo;
}

export interface SolscanHoldersResponse {
  success: boolean;
  data: {
    totalSupply: string;
    holders: SolscanTokenHolder[];
    holderCount: number;
  };
}

export interface SolscanCreatorResponse {
  success: boolean;
  data: SolscanCreatorInfo;
}

// Combined Enhanced Token Data
export interface EnhancedTokenData {
  mintAddress: string;
  rugCheckData?: RugResponseExtended;
  birdeyeData?: BirdeyeTokenResponse;
  solscanData?: {
    tokenInfo?: SolscanTokenInfo;
    holders?: SolscanTokenHolder[];
    creator?: SolscanCreatorInfo;
  };
  alertsEnabled?: boolean;
  priceAlerts?: {
    highThreshold: number;
    lowThreshold: number;
  };
}
