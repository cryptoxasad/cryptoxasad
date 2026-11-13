# Clip Bounty — Creative Direction, Architecture & Reference Analysis

## 1. Reference Inspection & Adaptations

We inspected both reference websites (`https://www.thecatcity.site/` and `https://dacitycoin.org/`) and adapted their best architectural and visual patterns to Clip Bounty's world:

### Adapted from TheCatCity (`thecatcity.site`)
- **Cinematic Story Bands & High-Contrast Cards:** TheCatCity uses wide atmospheric sections (`#crew`, `#heist`, `#city`) with distinct character badges. We adapted this for Clip Bounty's editorial cards (Gaming, Podcast, Crypto Breakdown) with first-party cover artwork, status badges, and clear reward values.
- **Copyable Token Contract Card:** TheCatCity features a dedicated `.ca-box` with a single configurable token address (`window.CATCITY_CA`) and instant clipboard feedback. We adapted this into Clip Bounty's `token-config.js` and Token page, while cleanly enforcing the honest `pre-launch` state (active buy buttons disabled until official mint deployment).
- **Accessible Full-Resolution Lightbox:** TheCatCity uses an accessible native `<dialog id="viewer">` for artwork inspection. We built a lightweight `<dialog id="global-lightbox">` in Clip Bounty for inspecting high-resolution studio assets with keyboard and Esc support.

### Adapted from Dacity (`dacitycoin.org`)
- **Broadcast Presentation & Channel Tuner:** Dacity frames content around retro-futuristic broadcast channels (`CH 03`, `CH 06`, `CH 07`, `CH 99`) with on-screen display (OSD) tickers and scanlines. We created the Clip Studio Broadcast Desk with channels for:
  - `CH 01`: First-Party Teaser
  - `CH 02`: Creator / Influencer Commentary
  - `CH 03`: Solana & Ecosystem Explainers
  - `CH 04`: Livestreams & Interviews
  - `CH 05`: Production Gallery Lightbox
- **Click-to-Load Video Players:** Rather than loading heavy third-party iframes immediately, Dacity shows clean posters and overlays. We implemented click-to-load embeds that load YouTube NOCookie players on demand, preserving user privacy and page speed.
- **Transparent Economics & Honest Roadmap:** Dacity provides clear step-by-step tokenomics and roadmap milestones. We mirrored this discipline on the Token and Roadmap pages, clearly separating active USD manual payouts from the proposed Solana token utility.

---

## 2. Technical Stack & Implementation

- **Runtime & Storage:** Node.js 24 with native `node:sqlite` (`DatabaseSync`), WAL mode, and zero external npm dependencies.
- **Security & Headers:**
  - Strict Content-Security-Policy with frame whitelist (`youtube-nocookie.com`, `youtube.com`, `player.twitch.tv`), `same-origin` referrer policy, `nosniff`, and secure session cookies.
  - Rate limiting (scrypt password hashing with brute-force attempt limits).
  - Private submission review: only bounty creators can inspect all submissions; non-creators only see their own.
- **3D Hero Showcase:** Pure WebGL canvas (`dist/hero-3d.js`) rendering an interactive 3D monitor, timeline track, and pulsing audio waveform with mouse tilt. Falls back cleanly to high-detail illustrated artwork on mobile or when `prefers-reduced-motion` is active.
- **Data Preservation:** The existing database (`data/clip-bounty.sqlite`) with account `asadsabir33@gmail.com` is preserved untouched. Automated tests run against separate `:memory:` or test databases.
