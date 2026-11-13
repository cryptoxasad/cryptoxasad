// VICE HEIST ($HEIST) — "Bayfront Takedown 3D" Combat Shooter & Turf Upgrades
// Overhead Three.js Tactical Shooter with Desktop WASD/Mouse & Mobile Touch D-pad + Auto-Fire

export const DISTRICTS = [
  { id: 'd1', name: 'Ocean Drive Boulevard', cost: 0, mult: 1.0, dmgBonus: 0, unlocked: true },
  { id: 'd2', name: 'South Beach Strip', cost: 1500, mult: 1.25, dmgBonus: 20, unlocked: false },
  { id: 'd3', name: 'Downtown Neon Grid', cost: 4000, mult: 1.5, dmgBonus: 40, unlocked: false },
  { id: 'd4', name: 'Vice Harbor Docks', cost: 8500, mult: 2.0, dmgBonus: 65, unlocked: false },
  { id: 'd5', name: 'Port Royale Smugglers', cost: 15000, mult: 2.5, dmgBonus: 90, unlocked: false },
  { id: 'd6', name: 'Star Island Citadel', cost: 25000, mult: 3.5, dmgBonus: 130, unlocked: false }
];

let gameScene, gameCamera, gameRenderer;
let playerMesh, playerGroup, bullets = [], enemies = [], lootDrops = [], particles = [];
let isPlaying = false, isGameOver = false, wave = 1, score = 0, cashEarned = 0;
let playerHealth = 100, maxHealth = 100, combo = 1, comboTimer = 0;
let overdriveTimer = 0, shieldActive = false, shieldTimer = 0;
let currentDistrictIdx = 0, animId = null;
let keys = {}, mouseX = 0, mouseZ = 0, isAutoFiring = false;
let sfxEnabled = false, audioCtx = null;

// Game State Persisted in LocalStorage
try {
  const savedDistricts = JSON.parse(localStorage.getItem('heist_unlocked_districts') || 'null');
  if (Array.isArray(savedDistricts)) {
    DISTRICTS.forEach((d, i) => {
      if (savedDistricts.includes(d.id)) d.unlocked = true;
    });
  }
} catch (_) {}

function playSfx(type) {
  if (!sfxEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'hit') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'loot') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.08);
      osc.frequency.setValueAtTime(1040, now + 0.16);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  } catch (_) {}
}

export function initGame3D(canvasEl) {
  if (!canvasEl || typeof window === 'undefined' || !window.THREE) return;
  const THREE = window.THREE;

  const w = canvasEl.parentElement ? canvasEl.parentElement.clientWidth : 800;
  const h = Math.min(520, Math.max(380, window.innerHeight * 0.55));

  gameScene = new THREE.Scene();
  gameScene.fog = new THREE.FogExp2(0x060714, 0.02);

  gameCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  gameCamera.position.set(0, 24, 14);
  gameCamera.lookAt(0, 0, 0);

  gameRenderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  gameRenderer.setSize(w, h);
  gameRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  // Lighting
  const amb = new THREE.AmbientLight(0x181a33, 2.0);
  gameScene.add(amb);

  const keyLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
  keyLight.position.set(10, 25, 10);
  gameScene.add(keyLight);

  const magentaRim = new THREE.DirectionalLight(0xff007f, 2.0);
  magentaRim.position.set(-10, 20, -10);
  gameScene.add(magentaRim);

  // Arena Floor (Neon Grid Combat Turf)
  const floorGeo = new THREE.PlaneGeometry(38, 38, 19, 19);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x090b1c, wireframe: false });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.05;
  gameScene.add(floorMesh);

  // Arena Boundary Neon Walls
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 });
  const wallGeoH = new THREE.BoxGeometry(38, 1.2, 0.4);
  const wallGeoV = new THREE.BoxGeometry(0.4, 1.2, 38);

  const wTop = new THREE.Mesh(wallGeoH, wallMat); wTop.position.set(0, 0.6, -19);
  const wBot = new THREE.Mesh(wallGeoH, wallMat); wBot.position.set(0, 0.6, 19);
  const wLeft = new THREE.Mesh(wallGeoV, wallMat); wLeft.position.set(-19, 0.6, 0);
  const wRight = new THREE.Mesh(wallGeoV, wallMat); wRight.position.set(19, 0.6, 0);
  gameScene.add(wTop, wBot, wLeft, wRight);

  // Build Player Rig
  buildPlayer(THREE);

  // Event Listeners
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvasEl.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouseX = nx * 18;
    mouseZ = -ny * 18;
  });

  canvasEl.addEventListener('click', () => {
    if (isPlaying && !isGameOver) shootBullet(THREE);
  });

  // Mobile Touch Controls
  bindMobileTouchControls(THREE);

  // Responsive Resize
  window.addEventListener('resize', () => {
    if (!canvasEl || !gameRenderer || !gameCamera) return;
    const parent = canvasEl.parentElement;
    const nw = parent ? parent.clientWidth : 800;
    const nh = Math.min(520, Math.max(380, window.innerHeight * 0.55));
    gameCamera.aspect = nw / nh;
    gameCamera.updateProjectionMatrix();
    gameRenderer.setSize(nw, nh);
  });

  // Main Loop
  let lastTime = performance.now();
  let shootCooldown = 0;

  const loop = (time) => {
    animId = requestAnimationFrame(loop);
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isPlaying && !isGameOver) {
      updateGame(THREE, dt);

      // Auto-fire handler for mobile
      if (isAutoFiring) {
        shootCooldown -= dt;
        if (shootCooldown <= 0) {
          shootBullet(THREE);
          shootCooldown = 0.18;
        }
      }
    }

    gameRenderer.render(gameScene, gameCamera);
  };
  loop(performance.now());
}

function buildPlayer(THREE) {
  playerGroup = new THREE.Group();
  playerGroup.position.set(0, 0.5, 0);

  // Player Armored Chassis
  const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 2.2);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.8, roughness: 0.2 });
  playerMesh = new THREE.Mesh(bodyGeo, bodyMat);
  playerGroup.add(playerMesh);

  // Blaster Cannon
  const barrelGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const barrelMat = new THREE.MeshBasicMaterial({ color: 0xff00ea });
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.set(0, 0.25, 1.0);
  playerGroup.add(barrel);

  // Shield Halo
  const shieldGeo = new THREE.RingGeometry(1.5, 1.8, 16);
  shieldGeo.rotateX(-Math.PI / 2);
  const shieldMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.name = 'shieldMesh';
  playerGroup.add(shieldMesh);

  gameScene.add(playerGroup);
}

function shootBullet(THREE) {
  if (!playerGroup) return;
  const dmgBonus = DISTRICTS[currentDistrictIdx].dmgBonus || 0;
  const baseDmg = 25 * (1 + dmgBonus / 100);

  const forward = new THREE.Vector3(0, 0, 1).applyEuler(playerGroup.rotation);
  const bulletGeo = new THREE.SphereGeometry(0.18, 6, 6);
  const bulletMat = new THREE.MeshBasicMaterial({ color: overdriveTimer > 0 ? 0xffb800 : 0x00f0ff });

  const bullet = new THREE.Mesh(bulletGeo, bulletMat);
  bullet.position.copy(playerGroup.position).add(forward.clone().multiplyScalar(1.2));
  bullet.velocity = forward.clone().multiplyScalar(28);
  bullet.damage = baseDmg;
  bullet.life = 1.6;

  bullets.push(bullet);
  gameScene.add(bullet);

  // Overdrive 3-way spread fire
  if (overdriveTimer > 0) {
    const leftAngle = playerGroup.rotation.y + 0.25;
    const rightAngle = playerGroup.rotation.y - 0.25;

    const bLeft = new THREE.Mesh(bulletGeo, bulletMat);
    bLeft.position.copy(playerGroup.position);
    bLeft.velocity = new THREE.Vector3(Math.sin(leftAngle), 0, Math.cos(leftAngle)).multiplyScalar(28);
    bLeft.damage = baseDmg;
    bLeft.life = 1.6;
    bullets.push(bLeft);
    gameScene.add(bLeft);

    const bRight = new THREE.Mesh(bulletGeo, bulletMat);
    bRight.position.copy(playerGroup.position);
    bRight.velocity = new THREE.Vector3(Math.sin(rightAngle), 0, Math.cos(rightAngle)).multiplyScalar(28);
    bRight.damage = baseDmg;
    bRight.life = 1.6;
    bullets.push(bRight);
    gameScene.add(bRight);
  }

  playSfx('laser');
}

function spawnWave(THREE) {
  const isBossWave = (wave % 3 === 0);
  const count = isBossWave ? 1 : 4 + Math.min(wave * 2, 16);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 14 + Math.random() * 4;
    const x = Math.sin(angle) * dist;
    const z = Math.cos(angle) * dist;

    if (isBossWave) {
      // BOSS MECH
      const bossGeo = new THREE.BoxGeometry(3.6, 2.2, 3.6);
      const bossMat = new THREE.MeshStandardMaterial({ color: 0xff0044, metalness: 0.9, roughness: 0.2 });
      const boss = new THREE.Mesh(bossGeo, bossMat);
      boss.position.set(x, 1.1, z);
      boss.hp = 350 + (wave * 120);
      boss.maxHp = boss.hp;
      boss.speed = 3.5;
      boss.isBoss = true;
      boss.scoreVal = 1500;
      boss.cashVal = 450;
      enemies.push(boss);
      gameScene.add(boss);
    } else {
      // Drone or Bruiser
      const isBruiser = Math.random() > 0.65;
      const enemyGeo = isBruiser ? new THREE.BoxGeometry(1.8, 1.2, 1.8) : new THREE.ConeGeometry(0.8, 1.4, 6);
      const enemyMat = new THREE.MeshBasicMaterial({ color: isBruiser ? 0xff007f : 0xff3b30 });
      const enemy = new THREE.Mesh(enemyGeo, enemyMat);
      enemy.position.set(x, 0.6, z);
      enemy.hp = isBruiser ? 65 : 30;
      enemy.speed = isBruiser ? 4.2 : 6.8;
      enemy.isBoss = false;
      enemy.scoreVal = isBruiser ? 220 : 100;
      enemy.cashVal = isBruiser ? 50 : 25;
      enemies.push(enemy);
      gameScene.add(enemy);
    }
  }
}

function updateGame(THREE, dt) {
  // Player Movement
  const speed = 12.0;
  const move = new THREE.Vector3();
  if (keys['w'] || keys['arrowup']) move.z -= 1;
  if (keys['s'] || keys['arrowdown']) move.z += 1;
  if (keys['a'] || keys['arrowleft']) move.x -= 1;
  if (keys['d'] || keys['arrowright']) move.x += 1;

  if (move.lengthSq() > 0) {
    move.normalize();
    playerGroup.position.addScaledVector(move, speed * dt);
    playerGroup.position.x = Math.max(-17.5, Math.min(17.5, playerGroup.position.x));
    playerGroup.position.z = Math.max(-17.5, Math.min(17.5, playerGroup.position.z));
  }

  // Player Aim Direction
  if (!isAutoFiring && (mouseX !== 0 || mouseZ !== 0)) {
    const angle = Math.atan2(mouseX - playerGroup.position.x, mouseZ - playerGroup.position.z);
    playerGroup.rotation.y = angle;
  } else if (enemies.length > 0) {
    // Auto aim to nearest enemy
    let nearest = enemies[0];
    let minDist = playerGroup.position.distanceTo(nearest.position);
    for (let i = 1; i < enemies.length; i++) {
      const d = playerGroup.position.distanceTo(enemies[i].position);
      if (d < minDist) { minDist = d; nearest = enemies[i]; }
    }
    const angle = Math.atan2(nearest.position.x - playerGroup.position.x, nearest.position.z - playerGroup.position.z);
    playerGroup.rotation.y = angle;
  }

  // Update Timers
  if (overdriveTimer > 0) overdriveTimer -= dt;
  if (shieldTimer > 0) {
    shieldTimer -= dt;
    shieldActive = shieldTimer > 0;
  }
  const sMesh = playerGroup.getObjectByName('shieldMesh');
  if (sMesh) sMesh.material.opacity = shieldActive ? 0.75 : 0;

  // Bullets Update
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.position.addScaledVector(b.velocity, dt);
    b.life -= dt;

    if (b.life <= 0 || Math.abs(b.position.x) > 19 || Math.abs(b.position.z) > 19) {
      gameScene.remove(b);
      bullets.splice(i, 1);
      continue;
    }

    // Check hit against enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dist = b.position.distanceTo(e.position);
      if (dist < (e.isBoss ? 2.2 : 1.1)) {
        e.hp -= b.damage;
        createImpactSparks(THREE, b.position);
        playSfx('hit');

        gameScene.remove(b);
        bullets.splice(i, 1);

        if (e.hp <= 0) {
          // Kill enemy
          const mult = DISTRICTS[currentDistrictIdx].mult || 1.0;
          score += Math.round(e.scoreVal * mult * combo);
          cashEarned += e.cashVal;
          combo = Math.min(combo + 1, 4);
          comboTimer = 3.5;

          // Loot Drop Chance
          if (Math.random() < (e.isBoss ? 1.0 : 0.35)) {
            spawnLoot(THREE, e.position);
          }

          gameScene.remove(e);
          enemies.splice(j, 1);
          updateGameHud();
        }
        break;
      }
    }
  }

  // Enemies Update
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const dir = new THREE.Vector3().subVectors(playerGroup.position, e.position).normalize();
    e.position.addScaledVector(dir, e.speed * dt);
    e.lookAt(playerGroup.position.x, e.position.y, playerGroup.position.z);

    // Collision with Player
    const pDist = e.position.distanceTo(playerGroup.position);
    if (pDist < (e.isBoss ? 2.4 : 1.2)) {
      if (!shieldActive) {
        playerHealth -= (e.isBoss ? 35 : 12);
        createImpactSparks(THREE, playerGroup.position);
        playSfx('hit');
        updateGameHud();

        if (playerHealth <= 0) {
          gameOver();
          return;
        }
      }
      // Knockback enemy
      e.position.addScaledVector(dir, -2.5);
    }
  }

  // Loot Drops Update
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const l = lootDrops[i];
    l.rotation.y += 2.5 * dt;
    l.position.y = 0.5 + Math.sin(timeSec() * 4) * 0.15;

    if (playerGroup.position.distanceTo(l.position) < 1.6) {
      if (l.type === 'cash') cashEarned += 120;
      else if (l.type === 'shield') { shieldActive = true; shieldTimer = 8.0; }
      else if (l.type === 'overdrive') { overdriveTimer = 9.0; }
      else if (l.type === 'medkit') playerHealth = Math.min(maxHealth, playerHealth + 40);

      playSfx('loot');
      gameScene.remove(l);
      lootDrops.splice(i, 1);
      updateGameHud();
    }
  }

  // Wave progression
  if (enemies.length === 0) {
    wave++;
    updateGameHud();
    spawnWave(THREE);
  }
}

function timeSec() {
  return performance.now() / 1000;
}

function spawnLoot(THREE, pos) {
  const types = ['cash', 'shield', 'overdrive', 'medkit'];
  const type = types[Math.floor(Math.random() * types.length)];

  const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const colorMap = { cash: 0x00f0ff, shield: 0x00ff88, overdrive: 0xffb800, medkit: 0xff007f };
  const mat = new THREE.MeshBasicMaterial({ color: colorMap[type] || 0xffffff });

  const loot = new THREE.Mesh(geo, mat);
  loot.position.set(pos.x, 0.5, pos.z);
  loot.type = type;
  lootDrops.push(loot);
  gameScene.add(loot);
}

function createImpactSparks(THREE, pos) {
  for (let i = 0; i < 4; i++) {
    const pGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const p = new THREE.Mesh(pGeo, pMat);
    p.position.copy(pos);
    p.vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
    particles.push(p);
    gameScene.add(p);
    setTimeout(() => {
      gameScene.remove(p);
      const idx = particles.indexOf(p);
      if (idx !== -1) particles.splice(idx, 1);
    }, 280);
  }
}

function bindMobileTouchControls(THREE) {
  const dpad = document.getElementById('game-mobile-dpad');
  const fireToggle = document.getElementById('game-auto-fire-btn');

  if (fireToggle) {
    fireToggle.addEventListener('click', () => {
      isAutoFiring = !isAutoFiring;
      fireToggle.classList.toggle('active', isAutoFiring);
      fireToggle.innerHTML = isAutoFiring ? '🔥 AUTO-FIRE ON' : '🎯 AUTO-FIRE OFF';
    });
  }

  if (dpad) {
    let touchId = null;
    let startX = 0, startY = 0;

    dpad.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      startX = t.clientX;
      startY = t.clientY;
    }, { passive: true });

    dpad.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;

          keys['arrowleft'] = dx < -18;
          keys['arrowright'] = dx > 18;
          keys['arrowup'] = dy < -18;
          keys['arrowdown'] = dy > 18;
        }
      }
    }, { passive: true });

    const endTouch = () => {
      keys['arrowleft'] = false;
      keys['arrowright'] = false;
      keys['arrowup'] = false;
      keys['arrowdown'] = false;
      touchId = null;
    };
    dpad.addEventListener('touchend', endTouch);
    dpad.addEventListener('touchcancel', endTouch);
  }
}

export function startGame() {
  if (!gameScene || !window.THREE) return;
  const THREE = window.THREE;

  // Reset State
  isPlaying = true;
  isGameOver = false;
  score = 0;
  cashEarned = 0;
  wave = 1;
  playerHealth = 100;
  combo = 1;
  overdriveTimer = 0;
  shieldActive = false;

  // Clear Entities
  bullets.forEach(b => gameScene.remove(b)); bullets = [];
  enemies.forEach(e => gameScene.remove(e)); enemies = [];
  lootDrops.forEach(l => gameScene.remove(l)); lootDrops = [];

  if (playerGroup) playerGroup.position.set(0, 0.5, 0);

  updateGameHud();
  spawnWave(THREE);

  const startOverlay = document.getElementById('game-start-overlay');
  const overOverlay = document.getElementById('game-over-overlay');
  if (startOverlay) startOverlay.style.display = 'none';
  if (overOverlay) overOverlay.style.display = 'none';
}

function gameOver() {
  isGameOver = true;
  isPlaying = false;

  // Persist highscore
  const bestScore = parseInt(localStorage.getItem('heist_best_score') || '0', 10);
  if (score > bestScore) {
    localStorage.setItem('heist_best_score', String(score));
  }

  // Update over screen
  const overOverlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('game-final-score');
  const finalCashEl = document.getElementById('game-final-cash');
  const finalWaveEl = document.getElementById('game-final-wave');

  if (finalScoreEl) finalScoreEl.textContent = score.toLocaleString();
  if (finalCashEl) finalCashEl.textContent = '$' + cashEarned.toLocaleString();
  if (finalWaveEl) finalWaveEl.textContent = 'WAVE ' + wave;
  if (overOverlay) overOverlay.style.display = 'flex';
}

function updateGameHud() {
  const hpEl = document.getElementById('game-hp-fill');
  const scoreEl = document.getElementById('game-score-val');
  const cashEl = document.getElementById('game-cash-val');
  const waveEl = document.getElementById('game-wave-val');
  const districtEl = document.getElementById('game-district-name');

  if (hpEl) hpEl.style.width = Math.max(0, playerHealth) + '%';
  if (scoreEl) scoreEl.textContent = score.toLocaleString();
  if (cashEl) cashEl.textContent = '$' + cashEarned.toLocaleString();
  if (waveEl) waveEl.textContent = 'WAVE ' + wave;
  if (districtEl) districtEl.textContent = DISTRICTS[currentDistrictIdx].name;
}

export function unlockDistrict(idx) {
  const d = DISTRICTS[idx];
  if (!d) return false;
  if (d.unlocked) {
    currentDistrictIdx = idx;
    updateGameHud();
    return true;
  }
  if (cashEarned >= d.cost) {
    cashEarned -= d.cost;
    d.unlocked = true;
    currentDistrictIdx = idx;

    const unlocked = DISTRICTS.filter(x => x.unlocked).map(x => x.id);
    localStorage.setItem('heist_unlocked_districts', JSON.stringify(unlocked));

    updateGameHud();
    return true;
  }
  return false;
}

export function toggleGameSfx() {
  sfxEnabled = !sfxEnabled;
  return sfxEnabled;
}

// Downloadable PNG Boss Card Generator (For X and TikTok Sharing)
export function generateBossCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  // Background Cyber Gradient
  const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, '#060714');
  grad.addColorStop(0.5, '#0d0d2b');
  grad.addColorStop(1, '#050610');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1080, 1080);

  // Neon Grid Lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 1080; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke();
  }
  for (let y = 0; y < 1080; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080, y); ctx.stroke();
  }

  // Neon Border Frame
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 8;
  ctx.strokeRect(40, 40, 1000, 1000);

  ctx.strokeStyle = '#ff007f';
  ctx.lineWidth = 3;
  ctx.strokeRect(52, 52, 976, 976);

  // Title Header
  ctx.fillStyle = '#ff007f';
  ctx.font = 'bold 38px "Impact", sans-serif';
  ctx.fillText('VICE HEIST ($HEIST) • SOLANA', 80, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px "Impact", sans-serif';
  ctx.fillText('BAYFRONT TAKEDOWN 3D', 80, 195);

  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('OFFICIAL TOURNAMENT BOSS CARD', 80, 240);

  // Stats Box
  ctx.fillStyle = 'rgba(10, 14, 38, 0.85)';
  ctx.fillRect(80, 300, 920, 420);
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, 300, 920, 420);

  ctx.fillStyle = '#8f9cae';
  ctx.font = '26px monospace';
  ctx.fillText('FINAL SCORE:', 120, 370);
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 68px "Impact", sans-serif';
  ctx.fillText(score.toLocaleString() + ' PTS', 120, 445);

  ctx.fillStyle = '#8f9cae';
  ctx.font = '26px monospace';
  ctx.fillText('WAVE REACHED:', 120, 530);
  ctx.fillStyle = '#ff007f';
  ctx.font = 'bold 52px "Impact", sans-serif';
  ctx.fillText('WAVE ' + wave, 120, 595);

  ctx.fillStyle = '#8f9cae';
  ctx.font = '26px monospace';
  ctx.fillText('TURF DISTRICT:', 540, 370);
  ctx.fillStyle = '#ffb800';
  ctx.font = 'bold 36px monospace';
  ctx.fillText(DISTRICTS[currentDistrictIdx].name, 540, 430);

  ctx.fillStyle = '#8f9cae';
  ctx.font = '26px monospace';
  ctx.fillText('CASH HEIST:', 540, 530);
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 52px "Impact", sans-serif';
  ctx.fillText('$' + cashEarned.toLocaleString(), 540, 595);

  // Bottom Watermark & Social Flex
  ctx.fillStyle = '#ff007f';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('flex your score on X & TikTok: #ViceHeist #Solana', 80, 800);

  ctx.fillStyle = '#8f9cae';
  ctx.font = '22px monospace';
  ctx.fillText('1,000,000,000 $HEIST • Verified Top-Scorer Prize Pool Eligible', 80, 850);

  // Download Trigger
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'vice-heist-boss-card-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
