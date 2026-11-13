# Clip Bounty — Creator Broadcast Hub

A cinematic creator broadcast hub where streamers post video footage and challenges, fans submit precision highlight timestamps (`HH:MM:SS`), and creators award USD bounties to winning clippers.

The platform runs on native Node.js 24 and SQLite with zero external npm dependencies.

---

## 1. Quick Start Locally

From the `clip-bounty` directory:

```bash
# Start server (defaults to port 3000, or specify PORT)
npm start

# Or with custom port/host:
PORT=3001 HOST=127.0.0.1 node server.mjs
```

Open `http://127.0.0.1:3001` in your browser. (Note: opening the static HTML directly will not initialize the backend API or SQLite database).

### Run Acceptance & Pilot Test Suite

Run the isolated end-to-end pilot test suite (runs on an in-memory test database without modifying your live data):

```bash
node test-pilot.mjs
```

---

## 2. Creative Direction & Brand Identity

* **Theme:** Neon editing studio after dark. Stacked preview monitors, illuminated video timeline, glowing playhead marker, audio waveform visualizations, and precision trim brackets `[ ]`.
* **Colors:** Signature Neon Lime (`#caff43`), Deep Midnight Charcoal (`#0a0d0f` to `#111619`), Restrained Cyan (`#5cf6e8`), and Studio Violet (`#a78bfa`).
* **Slogan:** "Find the moment. Earn the reward."
* **Supporting Copy:** "Creators set the challenge. Fans find the highlight."
* **3D Showcase:** Lightweight WebGL dimensional studio monitor and timeline track with slow idle breathing and pointer tilt interaction. Falls back to illustrated first-party artwork on mobile or when `prefers-reduced-motion` is enabled.

---

## 3. Production Deployment Notes

Deploy on a Node.js 24 web service (Render, Railway, Fly.io, DigitalOcean) or a Docker container with persistent disk storage:

### Environment Variables
* `PORT`: Listening port (e.g., `3000` or `8080`).
* `HOST`: Bind address (set to `0.0.0.0` in container environments).
* `NODE_ENV`: Set to `production` to enforce `Secure` flags on HTTP-only session cookies.
* `DB_PATH`: Absolute path to the SQLite database on persistent storage (e.g. `/app/data/clip-bounty.sqlite`).

### Persistent Storage & Video Uploads
* Uploaded recordings are stored in the `uploads/` directory adjacent to the SQLite database.
* Always back up the SQLite database and the `uploads/` directory together.
* Configure reverse proxies (Nginx, Cloudflare, Caddy) to permit client request bodies up to 52 MiB to allow 50 MB video uploads.

---

## 4. Token Page & Pre-Launch State

* **Status:** PRE-LAUNCH (Proposal status).
* **Network:** Solana (Proposed).
* **Payout Model:** Creator bounties currently settle via direct USD manual payouts. All account registration, submissions, and reward eligibility are 100% free and independent of token ownership.
* **Contract Mint:** The contract mint address is left unannounced until official deployment. Active buy and swap controls remain disabled during pre-launch.

---

## 5. Remaining Launch Checklist

Before opening public open registration to external traffic:
1. **Email Ownership Verification:** Integrate transactional email (Resend, Postmark, or SendGrid) to verify email addresses upon registration.
2. **Password Recovery:** Implement secure one-time password reset tokens.
3. **Automated Payout Rails:** Integrate Stripe Connect or crypto escrow smart contracts to automate instant bounty payouts.
4. **Content Moderation:** Add automated file scanning and user flagging tools for video uploads.
5. **Solana Token Deployment:** Finalize tokenomics, deploy audited smart contracts, fund liquidity on Raydium, and update `dist/token-config.js` with the verified mint address.
