// VICE SYNDICATE ($SYND) — Centralized Token Configuration
// Solana SPL Gaming & Underground Social Currency

export interface TokenConfig {
  name: string;
  ticker: string;
  network: string;
  totalSupply: string;
  status: 'pre-launch' | 'live';
  mintAddress: string;
  links: {
    pumpFun: string;
    raydium: string;
    dexscreener: string;
    solscan: string;
    x: string;
    telegram: string;
  };
  security: {
    mintAuthorityRevoked: boolean;
    freezeAuthorityRevoked: boolean;
    buyTax: string;
    sellTax: string;
    liquidityStatus: string;
  };
  utility: string;
}

export const TOKEN_CONFIG: TokenConfig = {
  name: 'VICE SYNDICATE',
  ticker: '$SYND',
  network: 'Solana (SPL Token)',
  totalSupply: '1,000,000,000',
  status: 'pre-launch',
  mintAddress: '', // Blank during pre-launch; populated when live on Pump.fun/Raydium
  links: {
    pumpFun: 'https://pump.fun/',
    raydium: '',
    dexscreener: '',
    solscan: '',
    x: 'https://x.com/ViceSyndSol',
    telegram: 'https://t.me/ViceSyndSol',
  },
  security: {
    mintAuthorityRevoked: true,
    freezeAuthorityRevoked: true,
    buyTax: '0%',
    sellTax: '0%',
    liquidityStatus: '100% LP Burned / Locked at Raydium migration',
  },
  utility: 'Fueling the 80s Miami Neon Underground Empire: Unlock Fire Aura & Diamond VIP names, deploy custom gaming servers, acquire live RJ broadcast passes, and tip performers on stage.',
};
