import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync, createReadStream, existsSync } from 'node:fs';
import { dirname, resolve, extname, normalize } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, 'dist');

const digest = token => createHash('sha256').update(token).digest('hex');
const token = () => randomBytes(32).toString('hex');
const week = 604800000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

export function app({ file = 'data/clip-bounty.sqlite', secure = false } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const uploads = resolve(file === ':memory:' ? 'data' : dirname(file), 'uploads');
  mkdirSync(uploads, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, salt TEXT, hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER);
    CREATE TABLE IF NOT EXISTS bounties(id TEXT PRIMARY KEY, owner INTEGER REFERENCES users(id), title TEXT, brief TEXT, vod TEXT, reward INTEGER, deadline INTEGER, winner INTEGER REFERENCES submissions(id), receipt TEXT);
    CREATE TABLE IF NOT EXISTS submissions(id INTEGER PRIMARY KEY, bounty TEXT REFERENCES bounties(id), user INTEGER REFERENCES users(id), timestamp TEXT, reason TEXT, clip TEXT, UNIQUE(bounty,user,timestamp));
  `);
  const attempts = new Map();

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: data: https:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://player.twitch.tv; font-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    
    const path = new URL(req.url, 'http://localhost').pathname;
    const send = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const fail = (status, message) => {
      throw Object.assign(new Error(message), { status });
    };
    const text = (value, min, max) => {
      if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
        fail(400, 'Check the required fields and length limits.');
      }
      return value.trim();
    };
    const link = (value, hosts) => {
      let url;
      try { url = new URL(text(value, 8, 500)); } catch { fail(400, 'Enter a valid HTTPS link.'); }
      if (url.protocol !== 'https:' || url.username || url.password || (hosts && !hosts.includes(url.hostname))) {
        fail(400, 'Use a supported HTTPS link.');
      }
      return url.href;
    };
    const body = async () => {
      if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '') || req.headers['sec-fetch-site'] === 'cross-site') {
        fail(403, 'Use the Clip Bounty form.');
      }
      let data = '';
      for await (const chunk of req) {
        data += chunk;
        if (Buffer.byteLength(data) > 8192) fail(413, 'Request too large.');
      }
      let parsed;
      try { parsed = JSON.parse(data); } catch { fail(400, 'Invalid request.'); }
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') fail(400, 'Invalid request.');
      return parsed;
    };
    async function bountyBody() {
      const type = req.headers['content-type'] || '';
      if (!type.startsWith('multipart/form-data;')) return body();
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Use the Clip Bounty form.');
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 51 * 1024 * 1024) fail(413, 'Video must be 50 MB or less.');
        chunks.push(chunk);
      }
      try {
        return Object.fromEntries(await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': type } }).formData());
      } catch { fail(400, 'Invalid upload form.'); }
    }

    try {
      // 1. Media streaming endpoint
      const media = /^\/media\/([a-f0-9]{20})\.(mp4|webm)$/.exec(path);
      if (media && ['GET', 'HEAD'].includes(req.method)) {
        if (!db.prepare('SELECT 1 FROM bounties WHERE vod=?').get(path)) return send(404, { error: 'Video not found.' });
        const source = resolve(uploads, media[1] + '.' + media[2]);
        let size;
        try { size = statSync(source).size; } catch { return send(404, { error: 'Video not found.' }); }
        const headers = { 'Content-Type': 'video/' + media[2], 'Accept-Ranges': 'bytes' };
        let start = 0, end = size - 1, status = 200;
        if (req.headers.range) {
          const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
          if (range && range[1]) {
            start = Number(range[1]);
            if (range[2]) end = Math.min(end, Number(range[2]));
          } else if (range && Number(range[2]) > 0) {
            start = Math.max(0, size - Number(range[2]));
          } else start = size;
          if (start >= size || start > end) {
            res.writeHead(416, { 'Content-Range': 'bytes */' + size }); res.end(); return;
          }
          status = 206;
          headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
        }
        headers['Content-Length'] = end - start + 1;
        res.writeHead(status, headers);
        if (req.method === 'HEAD') { res.end(); return; }
        const stream = createReadStream(source, { start, end });
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res); return;
      }

      // 2. Static file serving from ./dist/
      if (['GET', 'HEAD'].includes(req.method) && !path.startsWith('/api/')) {
        const relPath = path === '/' ? 'index.html' : normalize(path).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]/, '');
        const filePath = resolve(distDir, relPath);
        if (filePath.startsWith(distDir) && existsSync(filePath)) {
          const stat = statSync(filePath);
          if (stat.isFile()) {
            const ext = extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            
            // Support byte range requests for teaser video in dist/assets
            if (ext === '.mov' || ext === '.mp4' || ext === '.webm') {
              const headers = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes' };
              let start = 0, end = stat.size - 1, status = 200;
              if (req.headers.range) {
                const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
                if (range && range[1]) {
                  start = Number(range[1]);
                  if (range[2]) end = Math.min(end, Number(range[2]));
                } else if (range && Number(range[2]) > 0) {
                  start = Math.max(0, stat.size - Number(range[2]));
                }
                if (start >= stat.size || start > end) {
                  res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return;
                }
                status = 206;
                headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
              }
              headers['Content-Length'] = end - start + 1;
              res.writeHead(status, headers);
              if (req.method === 'HEAD') { res.end(); return; }
              const stream = createReadStream(filePath, { start, end });
              stream.on('error', () => res.destroy());
              res.on('close', () => stream.destroy());
              stream.pipe(res);
              return;
            }

            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': stat.size
            });
            if (req.method === 'HEAD') { res.end(); return; }
            createReadStream(filePath).pipe(res);
            return;
          }
        }
      }

      // 3. Auth and API session management
      const cookie = /(?:^|;\s*)cb_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const user = cookie && db.prepare('SELECT users.id,users.name FROM users JOIN sessions ON users.id=sessions.user_id WHERE sessions.id=? AND expires>?').get(digest(cookie), Date.now());
      const setSession = value => res.setHeader('Set-Cookie', 'cb_session=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (value ? week / 1000 : 0) + (secure ? '; Secure' : ''));

      if (req.method === 'GET' && path === '/api/me') return send(200, { user: user || null });

      if (req.method === 'GET' && path === '/api/bounties') {
        return send(200, db.prepare(`SELECT b.id,b.owner,b.title,b.brief,b.vod,b.reward,b.deadline,b.winner,(b.receipt IS NOT NULL) receipt,u.name creator,s.timestamp winning_time,w.name winning_name
          FROM bounties b JOIN users u ON u.id=b.owner LEFT JOIN submissions s ON s.id=b.winner LEFT JOIN users w ON w.id=s.user ORDER BY b.rowid DESC LIMIT 200`).all());
      }

      if (req.method === 'POST' && ['/api/register', '/api/login'].includes(path)) {
        const now = Date.now();
        for (const [key, item] of attempts) if (item.until <= now) attempts.delete(key);
        const data = await body();
        const email = text(data.email, 3, 254).toLowerCase();
        const password = text(data.password, 12, 128);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
        const key = req.socket.remoteAddress || 'unknown';
        const limit = attempts.get(key) || { count: 0, until: now + 600000 };
        if (limit.count >= 30) fail(429, 'Too many attempts. Try again later.');
        limit.count++; attempts.set(key, limit);
        let account = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        if (path === '/api/register') {
          if (account) fail(409, 'An account with this email already exists.');
          const name = text(data.name, 2, 40);
          const salt = randomBytes(16).toString('hex');
          const hash = scryptSync(password, salt, 64).toString('hex');
          const id = db.prepare('INSERT INTO users(email,name,salt,hash) VALUES(?,?,?,?)').run(email, name, salt, hash).lastInsertRowid;
          account = { id, name };
        } else {
          const hash = scryptSync(password, account?.salt || 'missing-account', 64);
          if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) fail(401, 'Email or password is incorrect.');
        }
        const session = token();
        db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
        if (cookie) db.prepare('DELETE FROM sessions WHERE id=?').run(digest(cookie));
        db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(session), account.id, now + week);
        setSession(session);
        return send(200, { user: { id: Number(account.id), name: account.name } });
      }

      if (req.method === 'POST' && path === '/api/logout') {
        await body();
        if (cookie) db.prepare('DELETE FROM sessions WHERE id=?').run(digest(cookie));
        setSession(''); return send(200, { ok: true });
      }

      if (!path.startsWith('/api/')) return send(404, { error: 'Page not found.' });
      if (!user) fail(401, 'Sign in to continue.');

      if (req.method === 'POST' && path === '/api/bounties') {
        const data = await bountyBody();
        const title = text(data.title, 5, 100), brief = text(data.brief, 10, 2000);
        const reward = Math.round(Number(data.reward) * 100), deadline = Date.parse(data.deadline);
        if (!Number.isSafeInteger(reward) || reward < 100 || reward > 1000000 || !Number.isFinite(deadline) || deadline <= Date.now()) {
          fail(400, 'Set a future deadline and a USD reward between 1 and 10,000.');
        }
        const id = randomBytes(10).toString('hex');
        let vod, storedFile;
        if (data.video instanceof File && data.video.size) {
          if (data.vod) fail(400, 'Choose one recording source.');
          if (data.video.size > 50 * 1024 * 1024) fail(413, 'Video must be 50 MB or less.');
          const bytes = Buffer.from(await data.video.arrayBuffer());
          const ext = /\.(mp4|webm)$/i.exec(data.video.name)?.[1].toLowerCase();
          const mp4 = bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp' && bytes.toString('ascii', 8, 12) !== 'qt  ';
          const webm = bytes.length >= 16 && bytes.readUInt32BE(0) === 0x1a45dfa3 && bytes.subarray(4, 256).includes(Buffer.from('webm'));
          if ((ext === 'mp4' && mp4) || (ext === 'webm' && webm)) {
            storedFile = resolve(uploads, id + '.' + ext);
            vod = '/media/' + id + '.' + ext;
          } else fail(400, 'Upload an MP4 or WebM video.');
          writeFileSync(storedFile, bytes, { flag: 'wx', mode: 0o600 });
        } else {
          vod = link(data.vod, ['twitch.tv', 'www.twitch.tv', 'youtube.com', 'www.youtube.com', 'youtu.be']);
        }
        try {
          db.prepare('INSERT INTO bounties(id,owner,title,brief,vod,reward,deadline) VALUES(?,?,?,?,?,?,?)').run(id, user.id, title, brief, vod, reward, deadline);
        } catch (error) {
          if (storedFile) unlinkSync(storedFile);
          throw error;
        }
        return send(201, { id });
      }

      const match = /^\/api\/bounties\/([a-f0-9]{20})\/(entries|winner|paid)$/.exec(path);
      if (!match) return send(404, { error: 'Endpoint not found.' });
      const [, id, action] = match;
      const bounty = db.prepare('SELECT * FROM bounties WHERE id=?').get(id);
      if (!bounty) fail(404, 'Bounty not found.');

      if (action === 'entries' && req.method === 'GET') {
        const entries = db.prepare(`SELECT s.id,s.timestamp,s.reason,s.clip,u.name FROM submissions s JOIN users u ON u.id=s.user WHERE s.bounty=? AND (? OR s.user=?) ORDER BY s.id`).all(id, Number(bounty.owner === user.id), user.id);
        return send(200, entries);
      }

      if (req.method !== 'POST') return send(405, { error: 'Method not allowed.' });
      const data = await body();

      if (action === 'entries') {
        if (bounty.owner === user.id) fail(403, 'Creators cannot enter their own bounty.');
        const stamp = text(data.timestamp, 8, 8), reason = text(data.reason, 3, 500);
        if (!/^\d{2}:[0-5]\d:[0-5]\d$/.test(stamp)) fail(400, 'Use HH:MM:SS for the timestamp.');
        const clip = data.clip ? link(data.clip, ['clips.twitch.tv', 'twitch.tv', 'www.twitch.tv', 'youtube.com', 'www.youtube.com', 'youtu.be']) : null;
        const result = db.prepare(`INSERT INTO submissions(bounty,user,timestamp,reason,clip) SELECT id,?,?,?,? FROM bounties WHERE id=? AND deadline>? AND winner IS NULL ON CONFLICT DO NOTHING`).run(user.id, stamp, reason, clip, id, Date.now());
        if (!result.changes) fail(409, 'This timestamp was already submitted or the bounty is closed.');
        return send(201, { ok: true });
      }

      if (bounty.owner !== user.id) fail(403, 'Only the bounty creator can do that.');

      if (action === 'winner') {
        if (!Number.isSafeInteger(data.entry)) fail(400, 'Select a valid entry.');
        const result = db.prepare('UPDATE bounties SET winner=? WHERE id=? AND winner IS NULL AND deadline<=? AND EXISTS(SELECT 1 FROM submissions WHERE id=? AND bounty=?)').run(data.entry, id, Date.now(), data.entry, id);
        if (!result.changes) fail(409, 'Select an entry from this bounty after its deadline. A winner can only be set once.');
      } else {
        const receipt = text(data.receipt, 3, 120);
        const result = db.prepare('UPDATE bounties SET receipt=? WHERE id=? AND winner IS NOT NULL AND receipt IS NULL').run(receipt, id);
        if (!result.changes) fail(409, 'A winner must be selected and payment can only be recorded once.');
      }
      return send(200, { ok: true });
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent) send(error.status || 500, { error: error.status ? error.message : 'Something went wrong. Try again.' });
    }
  });

  server.on('close', () => db.close());
  return server;
}

if (globalThis.process?.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3000);
  app({ file: process.env.DB_PATH || 'data/clip-bounty.sqlite', secure: process.env.NODE_ENV === 'production' }).listen(port, process.env.HOST || '127.0.0.1', () => console.log('Clip Bounty listening on port ' + port));
}
