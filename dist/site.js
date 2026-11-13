// VICE SYNDICATE ($SYND) — Core Data & Configuration
// 80s Miami Neon Underground Empire & Live RJ Network on Solana

export const TOKEN_CONFIG = {
  name: 'VICE SYNDICATE',
  ticker: '$SYND',
  network: 'Solana (SPL Token)',
  totalSupply: '1,000,000,000',
  status: 'pre-launch', // 'pre-launch' | 'live'
  mintAddress: '',      // Blank during pre-launch; set upon live deployment
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
  utility: 'Fueling the 80s Miami Neon Underground Empire: Unlock Fire Aura & Diamond VIP names, deploy custom gaming servers, send TikTok-style live gifts, and tip performers on stage.',
};

// Gaming Servers Directory
export const INITIAL_SERVERS = [
  {
    id: 'vice-hq',
    name: '#Vice-Central-HQ',
    category: 'Official Syndicate',
    icon: '🌐',
    banner: '/assets/vice_skyline_hero.jpg',
    topic: 'Official Syndicate Headquarters • 24/7 Sunset FM & Community Hangout',
    dj: '@blacksheep',
    stationId: 0,
    station: '84.5 FM',
    listeners: 68,
    totalMembers: 1842,
    isOfficial: true,
    access: 'public', // 'public' | 'private'
    passcode: '',
    owner: 'blacksheep',
    desc: 'The central hub for all underground crew members. High energy social banter and 24/7 synth tunes.'
  },
  {
    id: 'neon-concert',
    name: '#Neon-Club-Stage',
    category: 'Live RJ Concert',
    icon: '🎙️',
    banner: '/assets/gta6_neon_club.jpg',
    topic: 'Live RJ Concerts & DJ Sets • Open Mic Sessions & Music Showcases',
    dj: '@JaxSlick',
    stationId: 1,
    station: '99.1 FM',
    listeners: 94,
    totalMembers: 1290,
    isOfficial: true,
    access: 'public',
    passcode: '',
    owner: 'JaxSlick',
    desc: 'Main musical stage. Room Owner can grant stage mic permission to verified performers.'
  },
  {
    id: 'vip-penthouse',
    name: '#VIP-Penthouse-Lounge',
    category: 'Private VIP',
    icon: '👑',
    banner: '/assets/gta6_villa_mansion.jpg',
    topic: 'Private High Rollers Lounge • Passcode Protected Alpha Discussion',
    dj: '@BrunoAnvil',
    stationId: 3,
    station: '107.8 FM',
    listeners: 36,
    totalMembers: 640,
    isOfficial: true,
    access: 'private',
    passcode: '7777',
    owner: 'BrunoAnvil',
    desc: 'Exclusive private penthouse for verified syndicate elites. Protected by passcode (Default: 7777).'
  },
  {
    id: 'pump-trading',
    name: '#Pump-Trading-Floor',
    category: 'Solana Degen',
    icon: '🚀',
    banner: '/assets/vice_glamour_hero.jpg',
    topic: 'Raydium Bonding Curves, Meme Coin Calls & Real-time Alpha',
    dj: '@SynthLord',
    stationId: 2,
    station: '102.4 FM',
    listeners: 52,
    isOfficial: true,
    access: 'public',
    passcode: '',
    owner: 'SynthLord',
    desc: 'Fast-paced degen alpha channel tracking Solana meme breakouts and bonding curves.'
  },
];

// Online Syndicate Users with authentic Xat-style pawns, levels, and powers
export const INITIAL_CHAT_USERS = [
  { id: 'user-1', name: 'Jax "Slick"', rank: 'main-owner', pawn: '👑', color: 'pawn-main-owner', glow: 'rainbow', powers: ['name-fire', 'pawn-crown', 'glow', 'bubble-neon'], status: 'Live RJ On Deck 🎙️', avatar: '/assets/crew_jax.jpg' },
  { id: 'user-2', name: 'Roxy Glitch', rank: 'owner', pawn: '🟠', color: 'pawn-owner', glow: 'fire', powers: ['name-fire', 'glow', 'bubble-neon'], status: 'Concert Host 🎧', avatar: '/assets/crew_roxy.jpg' },
  { id: 'user-3', name: 'Bruno Anvil', rank: 'mod', pawn: '⚪', color: 'pawn-mod', glow: 'none', powers: ['pawn-crown'], status: 'Syndicate Enforcer', avatar: '/assets/crew_bruno.jpg' },
  { id: 'user-4', name: 'Mia Sunset', rank: 'member', pawn: '💎', color: 'pawn-diamond', glow: 'diamond', powers: ['name-diamond', 'glow'], status: 'VIP Diamond Pass 💖', avatar: '/assets/vice_glamour_hero.jpg' },
  { id: 'user-5', name: 'NeonSniperX', rank: 'member', pawn: '🔵', color: 'pawn-member', glow: 'none', powers: ['glow'], status: 'Listening to 84.5 FM', avatar: null },
  { id: 'user-6', name: 'DegenWhale99', rank: 'guest', pawn: '🟢', color: 'pawn-guest', glow: 'none', powers: [], status: 'New Visitor', avatar: null },
];

// Real Live Audio Radio Stations
export const RADIO_STATIONS = [
  {
    id: 'vice-84',
    freq: '84.5 FM',
    name: 'VICE FM',
    genre: 'Miami Sunset Synthwave',
    streamUrl: 'https://stream.nightride.fm/chillsynth.mp3',
    bpm: 115,
    track: 'Kavinsky & College - Sunset Drive (Vice 84 Remaster)'
  },
  {
    id: 'nightride-99',
    freq: '99.1 FM',
    name: 'NIGHTRIDE FM',
    genre: 'Fast Cyber Electro & Retrowave',
    streamUrl: 'https://stream.nightride.fm/nightride.mp3',
    bpm: 128,
    track: 'Carpenter Brut - Turbo Overdrive'
  },
  {
    id: 'sunset-102',
    freq: '102.4 FM',
    name: 'SUNSET LO-FI',
    genre: 'Chillwave & Ocean Breezes',
    streamUrl: 'https://stream.nightride.fm/datawave.mp3',
    bpm: 85,
    track: 'Miami Nights 1984 - Ocean Drive Boulevard'
  },
  {
    id: 'flash-105',
    freq: '105.5 FM',
    name: 'FLASH FM',
    genre: '80s Miami Pop & Club Freestyle',
    streamUrl: 'https://stream.nightride.fm/synthwave.mp3',
    bpm: 120,
    track: 'Hall & Oates - Out of Touch (Miami Night Drive Edit)'
  },
  {
    id: 'vrock-97',
    freq: '97.2 FM',
    name: 'V-ROCK',
    genre: '80s Hard Rock & Heavy Metal',
    streamUrl: 'https://stream.nightride.fm/darksynth.mp3',
    bpm: 135,
    track: 'Judas Priest - Turbo Lover (Vice Remaster)'
  },
  {
    id: 'fever-103',
    freq: '103.8 FM',
    name: 'FEVER 105',
    genre: '80s Soul, Disco & Groovy Funk',
    streamUrl: 'https://stream.nightride.fm/horrorsynth.mp3',
    bpm: 112,
    track: 'The Whispers - And the Beat Goes On (Fever Special)'
  },
  {
    id: 'heist-107',
    freq: '107.8 FM',
    name: 'CYBER HEIST FM',
    genre: 'Heavy Industrial Darksynth',
    streamUrl: 'https://stream.nightride.fm/ebm.mp3',
    bpm: 130,
    track: 'Perturbator & Master Boot Record - Syndicate Grid'
  },
];

// Comprehensive $SYND Powers Catalog (Profile Upgrades + TikTok-Style Live Room Gifts)
export const POWERS_CATALOG = [
  // --- TIKTOK-STYLE LIVE ROOM GIFTS & FX ---
  {
    id: 'gift-rocket',
    name: '🚀 Solana Rocket Blast',
    icon: '🚀',
    cost: 30000,
    costStr: '30,000 $SYND',
    desc: 'TikTok-style live room gift! Launches an animated roaring rocket across every listener screen with sonic boom FX.',
    tag: 'LIVE ROOM GIFT',
    type: 'live-gift'
  },
  {
    id: 'gift-cashrain',
    name: '🌧️ Miami Cash Rain',
    icon: '🌧️',
    cost: 25000,
    costStr: '25,000 $SYND',
    desc: 'Rains golden $SYND coins and 80s Miami dollar bills across the entire server screen for 10 seconds.',
    tag: 'LIVE ROOM GIFT',
    type: 'live-gift'
  },
  {
    id: 'gift-supercar',
    name: '🏎️ Neon Supercar Drive-By',
    icon: '🏎️',
    cost: 35000,
    costStr: '35,000 $SYND',
    desc: 'A glowing cyber sports car speeds across the room screen with screeching tire burn audio and neon trails.',
    tag: 'LIVE ROOM GIFT',
    type: 'live-gift'
  },
  {
    id: 'pin-alpha',
    name: '📌 Sticky Alpha Message Pin',
    icon: '📌',
    cost: 20000,
    costStr: '20,000 $SYND',
    desc: 'Pins your chosen alpha message to the very top header of the chatroom for everyone to see for 5 minutes.',
    tag: 'ROOM CONTROL',
    type: 'room-power'
  },
  {
    id: 'entrance-halo',
    name: '✨ Golden VIP Entrance Fanfare',
    icon: '✨',
    cost: 40000,
    costStr: '40,000 $SYND',
    desc: 'Triggers a golden fanfare chime and animated VIP banner across the room whenever you enter any server.',
    tag: 'PRESTIGE',
    type: 'passive'
  },

  // --- NAME & PROFILE FX POWERS ---
  {
    id: 'name-fire',
    name: '🔥 Fire Aura Flame Name',
    icon: '🔥',
    cost: 15000,
    costStr: '15,000 $SYND',
    desc: 'Ignites your username with animated blazing fiery neon flames in chat feeds, user lists, and on stage.',
    tag: 'FLAME FX',
    type: 'name-style'
  },
  {
    id: 'name-diamond',
    name: '💎 Diamond VIP & Cyan Shimmer',
    icon: '💎',
    cost: 50000,
    costStr: '50,000 $SYND',
    desc: 'Unlocks the 3D rotating glowing diamond pawn and ice-blue shimmer text style for your profile.',
    tag: 'STATUS',
    type: 'pawn-style'
  },
  {
    id: 'pawn-crown',
    name: '👑 Syndicate Gold Crown',
    icon: '👑',
    cost: 75000,
    costStr: '75,000 $SYND',
    desc: 'Legendary gold crown pawn + verified checkmark badge, showing you hold top syndicate rank.',
    tag: 'PRESTIGE',
    type: 'pawn-style'
  },
  {
    id: 'glow',
    name: '🌈 Miami Rainbow Glow',
    icon: '🌈',
    cost: 10000,
    costStr: '10,000 $SYND',
    desc: 'Smooth animated shifting rainbow gradient on your name in all chat feeds and player lists.',
    tag: 'NAME GLOW',
    type: 'name-style'
  },
  {
    id: 'bubble-neon',
    name: '⚡ Cyber Neon Chat Bubbles',
    icon: '⚡',
    cost: 20000,
    costStr: '20,000 $SYND',
    desc: 'Wraps every message you send in glowing cyan/magenta cyber borders that stand out in the feed.',
    tag: 'CHAT FX',
    type: 'chat-bubble'
  },
  {
    id: 'broadcast',
    name: '📢 Syndicate Megaphone Alert',
    icon: '📢',
    cost: 100000,
    costStr: '100,000 $SYND',
    desc: 'Broadcast full-width golden alerts with chime sounds across all online syndicate servers simultaneously.',
    tag: 'ALERT',
    type: 'server-alert'
  },
  {
    id: 'server-license',
    name: '🏰 Permanent Server License',
    icon: '🏰',
    cost: 150000,
    costStr: '150,000 $SYND',
    desc: 'Permanently list your custom gaming server on the server directory with private passcode locks.',
    tag: 'OWNERSHIP',
    type: 'ownership'
  },
];

// Curated Retro Miami / GTA / Synthwave GIFs for Chat
export const CURATED_GIFS = [
  { id: 'g1', title: 'Miami Sunset Drive', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnlyajg4b3JpNGl4NWFpMDZmbjR5MHlqZ2l5YWp6bnlyajg4b3JpNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26BkNrGhy4DKnbD9u/giphy.gif' },
  { id: 'g2', title: 'Neon Palm Trees', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZpcWZmd29rbTJpcTVjMXl4eGZ3YmlhMGhxN3JvZmxvdWN4Y2ZsayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'g3', title: 'DJ Party Vibing', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzhhN2ZndmN4OG14N3V6Y21wMnNxMWs1MnR1MXI3ZHR5anU5ZWVqNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/blSTtZehjAZ8I/giphy.gif' },
  { id: 'g4', title: 'Solana To The Moon', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3V4YWNqaHR5MDdqbWlybGJqMWp4OWZ4ZXlhMWh0YnpldmU3aGZkMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/7FfN5l8u8z0I0/giphy.gif' },
  { id: 'g5', title: 'Money Rain Syndicate', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNnd4NnB1dGJxc2lqaDN6bnkzdjUzdXR0azN2MjhyNHNqa2d2Z3JmZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MFsqcBSoOKPbjtmvWz/giphy.gif' },
  { id: 'g6', title: 'Neon Cyber Car', url: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcm5nMXVmbWdtZ3MwcWhpNXl6czg5MXE1dXBka3JiaXpxdmt1OTc1diZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7btQ8jDTPGDpgIxgu/giphy.gif' }
];

export function escHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
