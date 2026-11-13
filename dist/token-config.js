export const TOKEN_CONFIG = {
  name: 'VICE HEIST',
  ticker: '$HEIST',
  network: 'Solana (SPL Token)',
  totalSupply: '1,000,000,000',
  status: 'pre-launch',
  mintAddress: '', // Strictly blank in pre-launch mode until live contract deployment
  links: {
    pumpFun: '', // Locked pre-launch
    raydium: '', // Locked pre-launch
    dexscreener: '', // Locked pre-launch
    solscan: '', // Locked pre-launch
    x: 'https://x.com/ViceHeistSol',
    telegram: 'https://t.me/ViceHeistSol',
  },
  security: {
    mintAuthorityRevoked: true,
    freezeAuthorityRevoked: true,
    buyTax: '0%',
    sellTax: '0%',
    liquidityStatus: '100% LP Burned / Locked',
  },
  utility: 'Empowering the Vice Heist ecosystem: Weekly Top-Scorer Tournament Prize Pools, 1.5x-2.5x Clip Bounty reward weight multipliers for viral stream edits, exclusive 3D Coupe & Blaster skins, and VIP Kingpin Lounge access.',
};
