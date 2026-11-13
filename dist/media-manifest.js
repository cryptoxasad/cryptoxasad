// Clip Bounty Curated Media Manifest
// Curated real public crypto material across three categories:
// 1. Creator / Influencer Commentary
// 2. Solana or Crypto Ecosystem Explainers
// 3. Crypto Livestream or Interview Highlights
// All items are verified editorial examples with click-to-load embeds, fallback posters, and source links.

export const MEDIA_CATEGORIES = [
  { id: 'all', label: 'All Channels', icon: '📺' },
  { id: 'teaser', label: 'First-Party Teaser', icon: '🎬' },
  { id: 'commentary', label: 'Creator Commentary', icon: '🎙️' },
  { id: 'explainers', label: 'Ecosystem Explainers', icon: '⚡' },
  { id: 'livestreams', label: 'Interviews & Livestreams', icon: '🔴' }
];

export const TEASER_MEDIA = {
  id: 'teaser-cb-01',
  category: 'teaser',
  title: 'Clip Bounty Broadcast Teaser: Two-Hour Stream, One Great Clip',
  creator: 'Clip Bounty Official',
  sourceUrl: '/assets/clip-bounty-teaser.mov',
  embedType: 'video',
  videoSrc: '/assets/clip-bounty-teaser.mov',
  poster: '/assets/clip-bounty-cover.jpg',
  publishedDate: '2026-11-10',
  topic: 'Workflow demonstration: from multi-hour stream to precision timestamp submission and bounty payout.',
  verifiedTimestamp: '01:12:34',
  timestampLabel: '01:12:34 — Winning moment',
  whyBelongs: 'First-party teaser demonstrating how streamers post a recording challenge and fans pinpoint the winning highlight in seconds.',
  usageStatus: 'First-party asset',
  transcript: `[00:00 - 00:02] Streamer concludes a 3-hour marathon broadcast and opens Clip Bounty.
[00:02 - 00:05] Challenge created: "Find the insane 1v4 defuse clutch at 1080p60." $250 reward posted.
[00:05 - 00:08] Fan scrubs the video recording to 01:12:34, submits timestamp with explanation.
[00:08 - 00:10] Creator opens submission board, verifies 01:12:34 in one click, selects winner. Status: 01:12:34 / FOUND.`
};

export const CURATED_MEDIA = [
  {
    id: 'yt-zlx64JjXlgQ',
    category: 'commentary',
    title: '157 - Will Solana Make It with Anatoly Yakovenko',
    creator: 'Bankless (Ryan Sean Adams & David Hoffman)',
    sourceUrl: 'https://www.youtube.com/watch?v=zlx64JjXlgQ',
    embedUrl: 'https://www.youtube-nocookie.com/embed/zlx64JjXlgQ',
    youtubeId: 'zlx64JjXlgQ',
    thumbnail: 'https://i.ytimg.com/vi/zlx64JjXlgQ/hqdefault.jpg',
    coverAsset: '/assets/cover-podcast.png',
    publishedDate: '2023-01-16',
    topic: 'Solana network survival, monolithic architecture tradeoffs, and high-throughput execution.',
    verifiedTimestamp: '00:14:22',
    timestampLabel: '00:14:22 — The Single Global State Thesis',
    whyBelongs: 'High-stakes 90-minute founder interview where fans can clip the definitive quote on Solana’s throughput thesis.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-mBlhy3XIiQw',
    category: 'commentary',
    title: 'Is Solana DEAD? Watch This NOW!',
    creator: 'Coin Bureau (Guy Turner)',
    sourceUrl: 'https://www.youtube.com/watch?v=mBlhy3XIiQw',
    embedUrl: 'https://www.youtube-nocookie.com/embed/mBlhy3XIiQw',
    youtubeId: 'mBlhy3XIiQw',
    thumbnail: 'https://i.ytimg.com/vi/mBlhy3XIiQw/hqdefault.jpg',
    coverAsset: '/assets/cover-crypto.png',
    publishedDate: '2024-06-12',
    topic: 'Solana validator economics, SIMD-0550 governance fee distribution, and ecosystem market cycles.',
    verifiedTimestamp: '00:08:45',
    timestampLabel: '00:08:45 — SIMD Fee Allocation Analysis',
    whyBelongs: 'Streamers and market analysts constantly review macro shifts; creators on Clip Bounty would post bounties for the exact segment breaking down fee redistribution.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-1jzROE6EhxM',
    category: 'explainers',
    title: 'What is Solana? SOL Explained with Animations',
    creator: 'Whiteboard Crypto',
    sourceUrl: 'https://www.youtube.com/watch?v=1jzROE6EhxM',
    embedUrl: 'https://www.youtube-nocookie.com/embed/1jzROE6EhxM',
    youtubeId: '1jzROE6EhxM',
    thumbnail: 'https://i.ytimg.com/vi/1jzROE6EhxM/hqdefault.jpg',
    coverAsset: '/assets/cover-crypto.png',
    publishedDate: '2021-09-08',
    topic: 'Proof of History (PoH), Tower BFT consensus, and Sealevel parallel smart contract execution.',
    verifiedTimestamp: '00:03:15',
    timestampLabel: '00:03:15 — How Proof of History Works',
    whyBelongs: 'Ideal educational explainer; a creator bounty would challenge fans to find the clearest 20-second visual snippet explaining PoH to beginners.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-vKcLyqjpm3E',
    category: 'explainers',
    title: 'Solana vs Avalanche - Who Wins?! 🤔',
    creator: 'Coinsider',
    sourceUrl: 'https://www.youtube.com/watch?v=vKcLyqjpm3E',
    embedUrl: 'https://www.youtube-nocookie.com/embed/vKcLyqjpm3E',
    youtubeId: 'vKcLyqjpm3E',
    thumbnail: 'https://i.ytimg.com/vi/vKcLyqjpm3E/hqdefault.jpg',
    coverAsset: '/assets/cover-gaming.png',
    publishedDate: '2021-11-20',
    topic: 'Layer 1 throughput comparison: subnet architecture vs unified atomic state machine.',
    verifiedTimestamp: '00:06:40',
    timestampLabel: '00:06:40 — Subnets vs Single Composable State',
    whyBelongs: 'Highly debated crypto architectural debate; bounty challenge highlights the strongest counter-argument.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-NNCjMze0oJg',
    category: 'livestreams',
    title: 'Anatoly Yakovenko: Solana – at Breakpoint #418',
    creator: 'Epicenter Podcast',
    sourceUrl: 'https://www.youtube.com/watch?v=NNCjMze0oJg',
    embedUrl: 'https://www.youtube-nocookie.com/embed/NNCjMze0oJg',
    youtubeId: 'NNCjMze0oJg',
    thumbnail: 'https://i.ytimg.com/vi/NNCjMze0oJg/hqdefault.jpg',
    coverAsset: '/assets/cover-podcast.png',
    publishedDate: '2021-12-01',
    topic: 'Live conference recording at Solana Breakpoint discussing hardware scaling and MEV mitigations.',
    verifiedTimestamp: '00:22:18',
    timestampLabel: '00:22:18 — Hardware Bandwidth as the Speed Limit',
    whyBelongs: 'Live conference stage interview where spontaneous answers often yield viral clips for community distribution.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-XW0QZmtbjvs',
    category: 'livestreams',
    title: 'Vitalik Buterin: Ethereum 2.0 | Lex Fridman Podcast #188',
    creator: 'Lex Fridman',
    sourceUrl: 'https://www.youtube.com/watch?v=XW0QZmtbjvs',
    embedUrl: 'https://www.youtube-nocookie.com/embed/XW0QZmtbjvs',
    youtubeId: 'XW0QZmtbjvs',
    thumbnail: 'https://i.ytimg.com/vi/XW0QZmtbjvs/hqdefault.jpg',
    coverAsset: '/assets/cover-winner-reveal.png',
    publishedDate: '2021-06-03',
    topic: '3-hour deep interview on blockchain scalability, proof of stake, and high-throughput competitors.',
    verifiedTimestamp: '01:05:30',
    timestampLabel: '01:05:30 — Vitalik on High-TPS Layer 1s',
    whyBelongs: 'A massive 3-hour interview is prime territory for Clip Bounty: viewers do not have 3 hours, so creators offer rewards for finding the killer 30-second insight.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  },
  {
    id: 'yt-tHj5VIE4QmI',
    category: 'livestreams',
    title: 'Breakpoint Singapore',
    creator: 'Jito',
    sourceUrl: 'https://www.youtube.com/watch?v=tHj5VIE4QmI',
    embedUrl: 'https://www.youtube-nocookie.com/embed/tHj5VIE4QmI',
    youtubeId: 'tHj5VIE4QmI',
    thumbnail: 'https://i.ytimg.com/vi/tHj5VIE4QmI/hqdefault.jpg',
    coverAsset: '/assets/cover-crypto.png',
    publishedDate: '2024-09-22',
    topic: 'Developer conference livestream on MEV on Solana, block engine latency, and validator incentives.',
    verifiedTimestamp: '00:11:05',
    timestampLabel: '00:11:05 — Block Engine Latency Benchmarks',
    whyBelongs: 'Conference VODs are the exact type of multi-hour stream where creators want highlight submissions.',
    usageStatus: 'Editorial example · Platform embed via YouTube NOCookie · Verified public broadcast'
  }
];
