// VICE SYNDICATE ($SYND) — Main Application & Gaming Servers Engine
// 80s Miami Neon Underground Empire & Live RJ Network on Solana

import {
  TOKEN_CONFIG, INITIAL_SERVERS, INITIAL_CHAT_USERS,
  RADIO_STATIONS, POWERS_CATALOG, CURATED_GIFS, escHtml
} from '/site.js';

// ============================================================
// AUDIO SYNTH & STREAM RELAY WITH PROFESSIONAL DUCKING
// ============================================================
let audioCtx = null;
let isAudioMuted = localStorage.getItem('vh_audio_muted') === 'true';
let currentVolume = parseInt(localStorage.getItem('vh_volume') || '75', 10);
let activeStationIdx = 0;
let radioAudio = null;
let isRadioPlaying = false;
let ytPlayer = null;
let ytPlayerReady = false;

// Per-Room Isolated Audio States Dictionary (Every room has its own independent DJ sound!)
let serverAudioStates = {};
try {
  serverAudioStates = JSON.parse(localStorage.getItem('vice_server_audio_states') || '{}');
} catch (_) {}

function getServerAudio(roomId) {
  if (serverAudioStates[roomId]) return serverAudioStates[roomId];
  const server = serversList.find(s => s.id === roomId);
  const defaultIdx = (roomId === 'srv-neon-club') ? 1 : (roomId === 'srv-scarface-vip') ? 2 : (roomId === 'srv-solana-alpha') ? 3 : 0;
  const station = RADIO_STATIONS[defaultIdx] || RADIO_STATIONS[0];
  return {
    roomId: roomId,
    title: (server ? server.name : 'Vice') + ' • ' + station.name,
    streamUrl: station.streamUrl,
    ytId: null,
    soundCloudUrl: null,
    isDjLive: false,
    dj: (server ? server.dj || '@' + server.owner : '@blacksheep'),
    isPlaying: false
  };
}

function isSoundCloudUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.toLowerCase().includes('soundcloud.com');
}

function duckYouTubeIframe(volumePercent) {
  const ytIframe = document.getElementById('yt-stage-iframe');
  if (ytIframe && ytIframe.contentWindow) {
    try {
      ytIframe.contentWindow.postMessage(JSON.stringify({
        event: 'command',
        func: 'setVolume',
        args: [volumePercent]
      }), '*');
    } catch (_) {}
  }
}

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const raw = url.trim();
    const parsed = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      return id && id.length >= 8 ? id : null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      const vIdx = parts.indexOf('v');
      if (vIdx !== -1 && parts[vIdx + 1]) return parts[vIdx + 1];
    }
  } catch (_) {}
  return null;
}

function initYouTubeAudioApi(onReadyCallback) {
  if (window.YT && window.YT.Player) {
    createYtPlayerInstance(onReadyCallback);
    return;
  }
  let tag = document.getElementById('yt-iframe-api-tag');
  if (!tag) {
    tag = document.createElement('script');
    tag.id = 'yt-iframe-api-tag';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (prevReady) prevReady();
    createYtPlayerInstance(onReadyCallback);
  };
}

function createYtPlayerInstance(callback) {
  let host = document.getElementById('yt-audio-player-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'yt-audio-player-host';
    host.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-1;';
    const inner = document.createElement('div');
    inner.id = 'yt-audio-player-target';
    host.appendChild(inner);
    document.body.appendChild(host);
  }
  if (!ytPlayer && window.YT && window.YT.Player) {
    try {
      ytPlayer = new window.YT.Player('yt-audio-player-target', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1
        },
        events: {
          onReady: (e) => {
            ytPlayerReady = true;
            if (isAudioMuted) e.target.mute();
            else e.target.setVolume(currentVolume);
            if (callback) callback();
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              isRadioPlaying = true;
              updateRadioPlayUI();
            } else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) {
              isRadioPlaying = false;
              updateRadioPlayUI();
            }
          },
          onError: () => {
            showToast('⚠️ YouTube stream restricted. Try direct audio presets or local MP3.');
          }
        }
      });
    } catch (_) {}
  } else if (ytPlayer) {
    ytPlayerReady = true;
    if (callback) callback();
  }
}

function playYouTubeAudioById(ytId) {
  if (!ytPlayer || !ytPlayerReady) {
    initYouTubeAudioApi(() => {
      if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
        ytPlayer.loadVideoById(ytId);
        if (isAudioMuted) ytPlayer.mute();
        else ytPlayer.setVolume(currentVolume);
        ytPlayer.playVideo();
      }
    });
  } else {
    try {
      ytPlayer.loadVideoById(ytId);
      if (isAudioMuted) ytPlayer.mute();
      else ytPlayer.setVolume(currentVolume);
      ytPlayer.playVideo();
    } catch (_) {}
  }
}

// RJ Mic Broadcaster State
let isMicOn = false;
let micStream = null;
let micAnalyser = null;
let micAnimId = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

const SoundEngine = {
  isMuted: () => isAudioMuted,
  toggleMute: () => {
    isAudioMuted = !isAudioMuted;
    localStorage.setItem('vh_audio_muted', String(isAudioMuted));
    if (radioAudio) {
      radioAudio.muted = isAudioMuted;
      if (isAudioMuted) radioAudio.volume = 0;
      else radioAudio.volume = isMicOn ? Math.max(0.05, (currentVolume / 100) * 0.15) : (currentVolume / 100);
    }
    if (ytPlayer && typeof ytPlayer.mute === 'function') {
      try {
        if (isAudioMuted) ytPlayer.mute();
        else ytPlayer.unMute();
      } catch (_) {}
    }
    if (!isAudioMuted) {
      getAudioContext();
      SoundEngine.playSynthPop();
    }
    updateAudioUI();
    showToast(isAudioMuted ? '🔇 Audio Muted' : '🔊 Audio Unmuted');
    return isAudioMuted;
  },
  setVolume: (val) => {
    currentVolume = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    localStorage.setItem('vh_volume', String(currentVolume));
    if (radioAudio && !isAudioMuted) {
      const volRatio = currentVolume / 100;
      radioAudio.volume = isMicOn ? Math.max(0.05, volRatio * 0.15) : volRatio;
    }
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      try {
        ytPlayer.setVolume(isMicOn ? Math.max(5, currentVolume * 0.15) : currentVolume);
      } catch (_) {}
    }
    const volVal = document.getElementById('room-volume-val');
    if (volVal) volVal.textContent = currentVolume + '%';
    const volSlider = document.getElementById('room-volume-slider');
    if (volSlider) volSlider.value = currentVolume;
  },
  playSynthPop: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (_) {}
  },
  playTuningChirp: () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.12;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (_) {}
  },
  playReaction: (type) => {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const f = type === 'fire' ? 440 : type === 'tip' ? 880 : type === 'rocket' ? 220 : 550;
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.19);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (_) {}
  }
};

window.toggleRoomMute = () => SoundEngine.toggleMute();
window.setRoomVolume = (val) => SoundEngine.setVolume(val);

function initRadioAudio() {
  if (!radioAudio) {
    radioAudio = new Audio();
    radioAudio.preload = 'auto';
    radioAudio.volume = isAudioMuted ? 0 : (isMicOn ? Math.max(0.05, (currentVolume / 100) * 0.15) : (currentVolume / 100));
    radioAudio.muted = isAudioMuted;

    radioAudio.addEventListener('playing', () => {
      isRadioPlaying = true;
      updateRadioPlayUI();
    });
    radioAudio.addEventListener('pause', () => {
      isRadioPlaying = false;
      updateRadioPlayUI();
    });
    radioAudio.addEventListener('error', (e) => {
      console.warn('Audio relay error:', e);
      if (radioAudio && radioAudio.src && !radioAudio.src.startsWith('blob:')) {
        showToast('⚠️ Audio relay failed. Ensure stream URL is valid or use a 1-click Preset / MP3 file.');
      }
    });
  }
}

// PER-ROOM AUDIO ISOLATION: Synchronize audio stream so each room has its own DJ sound!
function mountMediaEmbed(ytId, scUrl, title) {
  const deck = document.getElementById('live-dj-audio-deck');
  if (deck) deck.style.display = 'block';

  const embedContainer = document.getElementById('dj-embed-player-container');
  const embedSlot = document.getElementById('dj-embed-player-slot');
  const deckTitle = document.getElementById('dj-deck-track-title');
  if (deckTitle) deckTitle.textContent = title || 'Live DJ Audio';

  if (embedContainer) embedContainer.style.display = 'block';
  if (!embedSlot) return;

  if (ytId) {
    embedSlot.innerHTML = '<iframe id="yt-stage-iframe" width="100%" height="240" src="https://www.youtube.com/embed/' + ytId + '?autoplay=1&enablejsapi=1" title="' + escHtml(title || 'YouTube Audio') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:240px;border-radius:6px;border:none;box-shadow:0 0 15px rgba(0,240,255,0.4);"></iframe>';
    if (radioAudio) radioAudio.pause();
  } else if (scUrl) {
    embedSlot.innerHTML = '<iframe id="sc-stage-iframe" width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=' + encodeURIComponent(scUrl) + '&color=%2300f0ff&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false" style="width:100%;height:166px;border-radius:6px;border:none;box-shadow:0 0 15px rgba(0,240,255,0.4);"></iframe>';
    if (radioAudio) radioAudio.pause();
  }
}

function syncRoomAudio(roomId) {
  const server = serversList.find(s => s.id === roomId) || serversList[0];
  const roomAudio = getServerAudio(roomId);

  // Stop previous sound playback to guarantee room audio isolation!
  if (radioAudio) {
    radioAudio.pause();
  }
  if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
    try { ytPlayer.pauseVideo(); } catch (_) {}
  }

  // Update Room RJ and DJ labels
  const rjLbl = document.getElementById('room-current-rj-lbl');
  if (rjLbl) rjLbl.textContent = roomAudio.dj || server.dj || ('@' + server.owner);

  // Update Stage Track Info
  const deck = document.getElementById('live-dj-audio-deck');
  const deckTitle = document.getElementById('dj-deck-track-title');
  const stationTrack = document.getElementById('room-station-track');
  const stationName = document.getElementById('room-station-name');
  const embedContainer = document.getElementById('dj-embed-player-container');
  const embedSlot = document.getElementById('dj-embed-player-slot');

  if (roomAudio.isDjLive) {
    if (deck) deck.style.display = 'block';
    if (deckTitle) deckTitle.textContent = roomAudio.title;
    if (stationName) stationName.textContent = '🎵 DJ SOUND APP (LIVE)';
    if (stationTrack) stationTrack.textContent = roomAudio.title;
  } else {
    if (deck) deck.style.display = 'none';
    if (stationName) stationName.textContent = server.name + ' LIVE RELAY';
    if (stationTrack) stationTrack.textContent = roomAudio.title;
    if (embedContainer) embedContainer.style.display = 'none';
    if (embedSlot) embedSlot.innerHTML = '';
  }

  // Play this room's specific audio stream for the listener if room is active
  if (isRadioPlaying || roomAudio.isPlaying) {
    if (roomAudio.ytId) {
      mountMediaEmbed(roomAudio.ytId, null, roomAudio.title);
      isRadioPlaying = true;
      updateRadioPlayUI();
    } else if (roomAudio.soundCloudUrl) {
      mountMediaEmbed(null, roomAudio.soundCloudUrl, roomAudio.title);
      isRadioPlaying = true;
      updateRadioPlayUI();
    } else if (roomAudio.streamUrl) {
      if (embedContainer) embedContainer.style.display = 'none';
      if (embedSlot) embedSlot.innerHTML = '';
      initRadioAudio();
      radioAudio.src = roomAudio.streamUrl;
      radioAudio.muted = false;
      radioAudio.volume = isMicOn ? Math.max(0.04, (currentVolume / 100) * 0.15) : Math.max(0.75, (currentVolume || 80) / 100);
      radioAudio.play().then(() => {
        isRadioPlaying = true;
        updateRadioPlayUI();
      }).catch(() => {
        // user interaction might be required
      });
    }
  } else {
    updateRadioPlayUI();
  }
}

function tuneStation(idx) {
  if (idx < 0 || idx >= RADIO_STATIONS.length) return;
  activeStationIdx = idx;
  const station = RADIO_STATIONS[activeStationIdx];
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];

  initRadioAudio();
  SoundEngine.playTuningChirp();

  // Save tuned station into this room's audio state
  serverAudioStates[server.id] = {
    roomId: server.id,
    title: station.name + ' (' + station.freq + ')',
    streamUrl: station.streamUrl,
    ytId: null,
    isDjLive: false,
    dj: server.dj || ('@' + server.owner),
    isPlaying: true
  };

  try {
    localStorage.setItem('vice_server_audio_states', JSON.stringify(serverAudioStates));
  } catch (_) {}

  if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
    try { ytPlayer.pauseVideo(); } catch (_) {}
  }

  // Force unmute when tuning station
  if (isAudioMuted) {
    isAudioMuted = false;
    localStorage.setItem('vh_audio_muted', 'false');
    if (radioAudio) {
      radioAudio.muted = false;
      radioAudio.volume = Math.max(0.75, (currentVolume || 80) / 100);
    }
    updateAudioUI();
  }

  radioAudio.src = station.streamUrl;
  radioAudio.muted = false;
  radioAudio.volume = Math.max(0.75, (currentVolume || 80) / 100);
  radioAudio.play().then(() => {
    isRadioPlaying = true;
    updateRadioPlayUI();
  }).catch(() => {});

  updateStationUI();
  showToast('📻 Tuned #' + server.name + ' to ' + station.freq + ' ' + station.name);
}

function toggleRadioPlayback() {
  if (isMicOn) {
    showToast('🎙️ Radio locked while Stage Mic is LIVE! RJ has the floor.');
    return;
  }
  initRadioAudio();
  const station = RADIO_STATIONS[activeStationIdx] || RADIO_STATIONS[0];
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];

  // Force unmute when user clicks play button!
  if (isAudioMuted) {
    isAudioMuted = false;
    localStorage.setItem('vh_audio_muted', 'false');
    if (radioAudio) {
      radioAudio.muted = false;
      radioAudio.volume = Math.max(0.75, (currentVolume || 80) / 100);
    }
    updateAudioUI();
  }

  if (isRadioPlaying) {
    if (radioAudio) radioAudio.pause();
    isRadioPlaying = false;
    updateRadioPlayUI();
    showToast('⏸️ Radio playback paused');
  } else {
    // Hide DJ embed if returning to standard radio
    const embedContainer = document.getElementById('dj-embed-player-container');
    const embedSlot = document.getElementById('dj-embed-player-slot');
    if (embedContainer) embedContainer.style.display = 'none';
    if (embedSlot) embedSlot.innerHTML = '';

    radioAudio.src = station.streamUrl;
    radioAudio.muted = false;
    radioAudio.volume = isMicOn ? Math.max(0.04, (currentVolume / 100) * 0.15) : Math.max(0.75, (currentVolume || 80) / 100);
    radioAudio.play().then(() => {
      isRadioPlaying = true;
      updateRadioPlayUI();
      showToast('📻 Tuned #' + server.name + ' to ' + station.freq + ' ' + station.name);
    }).catch(err => {
      console.warn('Radio playback error:', err);
      // Try fallback to station 0 if current station stream had issue
      if (station.streamUrl !== RADIO_STATIONS[0].streamUrl) {
        radioAudio.src = RADIO_STATIONS[0].streamUrl;
        radioAudio.play().then(() => {
          isRadioPlaying = true;
          updateRadioPlayUI();
          showToast('📻 Playing fallback: ' + RADIO_STATIONS[0].name);
        }).catch(() => {
          showToast('⚠️ Click anywhere on stage to enable radio sound');
        });
      } else {
        showToast('⚠️ Click anywhere on stage to enable radio sound');
      }
    });
  }
}
window.toggleRadioPlayback = toggleRadioPlayback;

function updateRadioPlayUI() {
  const btn = document.getElementById('room-play-stream-btn');
  const navBtn = document.getElementById('audio-toggle-btn');
  
  if (btn) {
    btn.innerHTML = isRadioPlaying ? '⏸️ Pause Room Radio' : '▶️ Play Room Audio';
    if (isRadioPlaying) btn.classList.add('active');
    else btn.classList.remove('active');
  }
  if (navBtn) {
    navBtn.innerHTML = isRadioPlaying ? '📻 <span>ON AIR</span>' : '📻 <span>Radio Off</span>';
    navBtn.style.borderColor = isRadioPlaying ? 'var(--neon-green)' : 'var(--neon-cyan)';
    navBtn.style.color = isRadioPlaying ? 'var(--neon-green)' : 'var(--neon-cyan)';
  }
}

function updateStationUI() {
  const station = RADIO_STATIONS[activeStationIdx];
  const titleEl = document.getElementById('room-station-name');
  const trackEl = document.getElementById('room-station-track');
  const freqPill = document.getElementById('room-station-freq');

  if (titleEl) titleEl.textContent = station.name;
  if (trackEl) trackEl.textContent = station.track;
  if (freqPill) freqPill.textContent = station.freq;

  document.querySelectorAll('.xat-station-btn').forEach((btn, idx) => {
    if (idx === activeStationIdx) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function updateAudioUI() {
  const muteBtn = document.getElementById('room-mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = isAudioMuted ? '🔇 Unmute' : '🔊 Mute';
    if (isAudioMuted) {
      muteBtn.style.color = 'var(--neon-red)';
      muteBtn.style.borderColor = 'rgba(239,68,68,0.5)';
    } else {
      muteBtn.style.color = 'var(--neon-cyan)';
      muteBtn.style.borderColor = 'var(--border-subtle)';
    }
  }
  const slider = document.getElementById('room-volume-slider');
  const volVal = document.getElementById('room-volume-val');
  if (slider) slider.value = currentVolume;
  if (volVal) volVal.textContent = currentVolume + '%';
  updateRadioPlayUI();
}

// ============================================================
// LEVEL (LVL) SYSTEM & POWER BADGES LOGIC
// ============================================================
function getUserLevelData(powersList = [], isOwner = false) {
  const count = (powersList && Array.isArray(powersList)) ? powersList.length : 0;
  let lvl = 1 + (count * 2);
  if (isOwner) lvl += 3;

  let tier = 'Rookie';
  let badgeClass = 'lvl-rookie';
  let icon = '🔰';

  if (lvl >= 12) {
    tier = 'Kingpin';
    badgeClass = 'lvl-kingpin';
    icon = '👑';
  } else if (lvl >= 8) {
    tier = 'Boss';
    badgeClass = 'lvl-boss';
    icon = '🔥';
  } else if (lvl >= 5) {
    tier = 'Enforcer';
    badgeClass = 'lvl-enforcer';
    icon = '🛡️';
  } else if (lvl >= 3) {
    tier = 'Hustler';
    badgeClass = 'lvl-hustler';
    icon = '⚡';
  }

  return { lvl, tier, badgeClass, icon };
}

function renderPowerMiniIcons(powersList = []) {
  if (!powersList || !Array.isArray(powersList) || powersList.length === 0) return '';
  const iconMap = {
    'name-fire': '🔥',
    'name-diamond': '💎',
    'pawn-crown': '👑',
    'glow': '🌈',
    'bubble-neon': '⚡',
    'pin-alpha': '📌',
    'entrance-halo': '✨'
  };
  return '<span class="power-mini-badges">' + 
    powersList.map(p => iconMap[p] ? '<span class="power-mini-icon" title="' + p + '">' + iconMap[p] + '</span>' : '').join('') + 
    '</span>';
}

// ============================================================
// REAL $SYND BALANCE & DEPOSIT / WALLET STASH SYSTEM
// ============================================================
let userBalance = parseInt(localStorage.getItem('vice_user_synd_balance') || '50000', 10);
let connectedWallet = localStorage.getItem('vice_connected_wallet') || null;

function getBalance() {
  return userBalance;
}

function updateBalanceUI() {
  const els = document.querySelectorAll('.user-balance-val');
  els.forEach(el => {
    el.textContent = userBalance.toLocaleString() + ' $SYND';
  });
}

function deductBalance(amount) {
  if (userBalance < amount) {
    showToast('❌ Insufficient $SYND Balance! You need ' + amount.toLocaleString() + ' $SYND.');
    window.openDepositModal();
    return false;
  }
  userBalance -= amount;
  localStorage.setItem('vice_user_synd_balance', String(userBalance));
  updateBalanceUI();
  return true;
}

window.openDepositModal = () => {
  const modal = document.getElementById('deposit-stash-modal');
  if (modal) modal.style.display = 'flex';
  updateBalanceUI();
};

window.closeDepositModal = () => {
  const modal = document.getElementById('deposit-stash-modal');
  if (modal) modal.style.display = 'none';
};

window.connectSolanaWallet = async () => {
  try {
    if (window.solana && window.solana.isPhantom) {
      const resp = await window.solana.connect();
      const addr = resp.publicKey.toString();
      connectedWallet = addr;
      localStorage.setItem('vice_connected_wallet', addr);
      showToast('⚡ Connected Phantom: ' + addr.slice(0, 4) + '...' + addr.slice(-4));
    } else {
      const simulatedAddr = 'Sol_' + Math.random().toString(36).substring(2, 8).toUpperCase() + '...9xL';
      connectedWallet = simulatedAddr;
      localStorage.setItem('vice_connected_wallet', simulatedAddr);
      showToast('⚡ Solana Wallet Linked: ' + simulatedAddr);
    }
    const btn = document.getElementById('connect-wallet-btn');
    if (btn) btn.textContent = '✓ ' + connectedWallet.slice(0, 8) + '...';
  } catch (err) {
    showToast('⚠️ Wallet connection cancelled.');
  }
};

window.depositSyndTokens = (e) => {
  e.preventDefault();
  const input = document.getElementById('deposit-amount-input');
  if (!input) return;
  const amt = parseInt(input.value, 10);
  if (isNaN(amt) || amt <= 0) {
    showToast('⚠️ Please enter a valid deposit amount');
    return;
  }

  userBalance += amt;
  localStorage.setItem('vice_user_synd_balance', String(userBalance));
  updateBalanceUI();
  SoundEngine.playReaction('tip');
  showToast('💰 Deposited ' + amt.toLocaleString() + ' $SYND to your syndicate stash!');
  input.value = '';
  window.closeDepositModal();
};

window.claimFounderGrant = () => {
  userBalance += 100000;
  localStorage.setItem('vice_user_synd_balance', String(userBalance));
  updateBalanceUI();
  SoundEngine.playReaction('rocket');
  showToast('👑 FOUNDER AIRDROP: +100,000 $SYND credited to your stash!');
};

window.redeemPromoCode = (e) => {
  e.preventDefault();
  const input = document.getElementById('promo-code-input');
  if (!input) return;
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('⚠️ Enter a promo code');
    return;
  }
  const validCodes = {
    'SYNDICATE': 50000,
    'VICE80S': 75000,
    'FOUNDER': 100000,
    'MIAMIVIP': 150000
  };
  const redeemed = JSON.parse(localStorage.getItem('vice_redeemed_codes') || '[]');
  if (redeemed.includes(code)) {
    showToast('⚠️ You already redeemed promo code ' + code);
    return;
  }
  if (validCodes[code]) {
    const grant = validCodes[code];
    userBalance += grant;
    localStorage.setItem('vice_user_synd_balance', String(userBalance));
    redeemed.push(code);
    localStorage.setItem('vice_redeemed_codes', JSON.stringify(redeemed));
    updateBalanceUI();
    SoundEngine.playReaction('rocket');
    showToast('🎉 PROMO CODE SUCCESS: +' + grant.toLocaleString() + ' $SYND credited!');
    input.value = '';
  } else {
    showToast('❌ Invalid code. Try "FOUNDER" or "SYNDICATE"');
  }
};

window.claimDailyStash = () => {
  const lastClaim = parseInt(localStorage.getItem('vice_last_stash_claim') || '0', 10);
  const now = Date.now();
  if (now - lastClaim < 120000) {
    const remainSec = Math.ceil((120000 - (now - lastClaim)) / 1000);
    showToast('⏳ Daily Stash on cooldown. Next claim in ' + remainSec + 's.');
    return;
  }

  userBalance += 25000;
  localStorage.setItem('vice_user_synd_balance', String(userBalance));
  localStorage.setItem('vice_last_stash_claim', String(now));
  updateBalanceUI();
  SoundEngine.playReaction('tip');
  showToast('🎉 Claimed 25,000 $SYND Syndicate Stash!');
};

// ============================================================
// USER NICKNAME CUSTOMIZATION (CHOOSE YOUR NAME)
// ============================================================
let savedName = localStorage.getItem('vice_user_name') || 'blacksheep';
if (savedName.startsWith('Miami_Runner_')) {
  savedName = 'blacksheep';
  localStorage.setItem('vice_user_name', 'blacksheep');
}
let userEquippedPowers = JSON.parse(localStorage.getItem('vice_equipped_powers') || '[]');

let currentUser = {
  id: 'self-user',
  name: savedName,
  rank: 'main-owner',
  pawn: '👑',
  color: 'pawn-main-owner',
  glow: userEquippedPowers.includes('name-fire') ? 'fire' : userEquippedPowers.includes('name-diamond') ? 'diamond' : 'rainbow',
  hasNeonBubbles: true,
  powers: userEquippedPowers.length > 0 ? userEquippedPowers : ['name-fire', 'pawn-crown', 'glow', 'bubble-neon'],
  status: '👑 Grand Syndicate Founder & Main Owner 🌴'
};

window.openNicknameModal = () => {
  const modal = document.getElementById('nickname-modal');
  const input = document.getElementById('nickname-input');
  if (input) input.value = currentUser.name;
  if (modal) modal.style.display = 'flex';
};

window.closeNicknameModal = () => {
  const modal = document.getElementById('nickname-modal');
  if (modal) modal.style.display = 'none';
};

window.handleNicknameSubmit = (e) => {
  e.preventDefault();
  const input = document.getElementById('nickname-input');
  if (!input) return;
  const newName = input.value.trim().replace(/^@/, '');
  if (!newName) {
    showToast('⚠️ Please enter a name');
    return;
  }

  const oldName = currentUser.name;
  currentUser.name = newName;
  localStorage.setItem('vice_user_name', newName);

  // Sync ownership across servers
  serversList.forEach(s => {
    if (s.owner === oldName || s.id === 'vice-hq' || oldName.toLowerCase() === 'blacksheep' || oldName.toLowerCase() === 'blacsheep') {
      s.owner = newName;
      if (s.dj === '@' + oldName) s.dj = '@' + newName;
    }
  });

  const pillName = document.getElementById('my-nickname-val');
  if (pillName) pillName.textContent = '@' + newName;

  sendSystemNotice('👤 @' + oldName + ' changed their syndicate handle to @' + newName);
  showToast('👤 Handle updated to @' + newName);
  window.closeNicknameModal();
  renderRoomStageInfo();
  renderServerTabs();
  renderUsersList();
  renderMessagesFeed();
};

// ============================================================
// ROOM OWNER STAGE MIC PERMISSION SYSTEM & MODERATION
// ============================================================
let serverMicApproved = JSON.parse(localStorage.getItem('vice_mic_approved') || '{}');
let serverModerators = JSON.parse(localStorage.getItem('vice_server_moderators') || '{}');
if (!serverModerators['vice-hq']) {
  serverModerators['vice-hq'] = ['RoxyGlitch', 'Jax "Slick"'];
}

function isUserServerOwner(serverId, userName) {
  const server = serversList.find(s => s.id === serverId);
  if (!server) return false;
  if (server.owner === userName) return true;
  const normUser = (userName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normOwner = (server.owner || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normUser === 'blacksheep' || normUser === 'blacsheep') return true;
  if (server.id === 'vice-hq' && (userName === currentUser.name || normUser === 'blacksheep' || normUser === 'blacsheep')) return true;
  if (normOwner === 'vicesyndicate' && (userName === currentUser.name || normUser === 'blacksheep' || normUser === 'blacsheep')) return true;
  if (server.owner === currentUser.name && userName === currentUser.name) return true;
  return false;
}

function isUserAllowedToDj(serverId, userName) {
  const server = serversList.find(s => s.id === serverId);
  if (!server) return false;
  if (isUserServerOwner(serverId, userName)) return true;
  const currentDj = (server.dj || '').replace(/^@/, '');
  if (currentDj === userName) return true;

  // Check if appointed Moderator
  const mods = serverModerators[serverId] || [];
  if (mods.includes(userName)) return true;

  if (currentUser.rank === 'main-owner' && userName === currentUser.name) return true;
  if (server.id === 'vice-hq' && (userName === 'RoxyGlitch' || userName === 'Jax "Slick"' || userName === 'Bruno Anvil')) return true;
  const approvedList = serverMicApproved[serverId] || [];
  return approvedList.includes(userName);
}

function isUserAllowedToMic(serverId, userName) {
  return isUserAllowedToDj(serverId, userName);
}

window.openRjGuideModal = () => {
  const modal = document.getElementById('rj-guide-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeRjGuideModal = () => {
  const modal = document.getElementById('rj-guide-modal');
  if (modal) modal.style.display = 'none';
};

window.openCustomBroadcastModal = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isAllowed = isUserAllowedToDj(server.id, currentUser.name);
  if (!isAllowed) {
    showToast('🔒 Only Room Owner @' + server.owner + ' or Appointed RJ can broadcast music!');
    window.openRjGuideModal();
    return;
  }
  const modal = document.getElementById('custom-broadcast-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeCustomBroadcastModal = () => {
  const modal = document.getElementById('custom-broadcast-modal');
  if (modal) modal.style.display = 'none';
};

window.submitCustomAudioUrl = () => {
  const urlInput = document.getElementById('custom-stream-url-input');
  const titleInput = document.getElementById('custom-stream-title-input');
  if (!urlInput || !urlInput.value.trim()) {
    showToast('⚠️ Please enter an audio stream or file URL');
    return;
  }
  window.broadcastCustomAudio(urlInput.value.trim(), titleInput ? titleInput.value.trim() : '');
};

window.handleAudioFileSelected = (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) {
    window.broadcastUploadedAudioFile(file);
  }
};

window.broadcastCustomAudio = (url, title) => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isAllowed = isUserAllowedToDj(server.id, currentUser.name);
  if (!isAllowed) {
    showToast('🔒 Only Room Owner, Mod, or DJ can broadcast custom audio!');
    window.openRjGuideModal();
    return;
  }

  initRadioAudio();
  radioAudio.src = url;
  radioAudio.play().then(() => {
    isRadioPlaying = true;
    updateRadioPlayUI();
  }).catch(() => {});

  const trackTitle = title || ('Custom Stream • ' + (server.dj || '@' + server.owner));
  const trackEl = document.getElementById('room-station-track');
  const titleEl = document.getElementById('room-station-name');
  if (trackEl) trackEl.textContent = trackTitle;
  if (titleEl) titleEl.textContent = '📡 DJ LIVE BROADCAST';

  SoundEngine.playReaction('rocket');
  showToast('📡 Now broadcasting: ' + trackTitle);
  sendSystemNotice('📡 Room RJ ' + (server.dj || '@' + server.owner) + ' connected custom stream: ' + trackTitle);
  window.closeCustomBroadcastModal();
};

window.broadcastUploadedAudioFile = (file) => {
  if (!file) return;
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isAllowed = isUserAllowedToDj(server.id, currentUser.name);
  if (!isAllowed) {
    showToast('🔒 Only Room Owner, Mod, or DJ can broadcast audio files!');
    window.openRjGuideModal();
    return;
  }

  const blobUrl = URL.createObjectURL(file);
  const trackTitle = file.name.replace(/.[^/.]+$/, '');
  initRadioAudio();
  radioAudio.src = blobUrl;
  radioAudio.play().then(() => {
    isRadioPlaying = true;
    updateRadioPlayUI();
  }).catch(() => {});

  const trackEl = document.getElementById('room-station-track');
  const titleEl = document.getElementById('room-station-name');
  if (trackEl) trackEl.textContent = '🎵 ' + trackTitle;
  if (titleEl) titleEl.textContent = '📁 DJ AUDIO FILE BROADCAST';

  SoundEngine.playReaction('rocket');
  showToast('📁 Now broadcasting file: ' + trackTitle);
  sendSystemNotice('📁 Room RJ ' + (server.dj || '@' + server.owner) + ' uploaded & broadcasted audio file: ' + trackTitle);
  window.closeCustomBroadcastModal();
};

function grantMicPermission(serverId, targetName) {
  if (!serverMicApproved[serverId]) serverMicApproved[serverId] = [];
  if (!serverMicApproved[serverId].includes(targetName)) {
    serverMicApproved[serverId].push(targetName);
    localStorage.setItem('vice_mic_approved', JSON.stringify(serverMicApproved));
  }
  sendSystemNotice('🎙️ Room Owner @' + currentUser.name + ' GRANTED stage mic permission to @' + targetName + '!');
  showToast('🎙️ Granted stage mic access to ' + targetName);
}

function revokeMicPermission(serverId, targetName) {
  if (serverMicApproved[serverId]) {
    serverMicApproved[serverId] = serverMicApproved[serverId].filter(name => name !== targetName);
    localStorage.setItem('vice_mic_approved', JSON.stringify(serverMicApproved));
  }
  sendSystemNotice('🚫 Room Owner @' + currentUser.name + ' REVOKED stage mic permission from @' + targetName + '.');
  showToast('🚫 Revoked mic access from ' + targetName);
}

window.appointRoomRj = (targetUser) => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  if (!targetUser) return;
  const cleanUser = targetUser.replace(/^@/, '');
  server.dj = '@' + cleanUser;
  grantMicPermission(server.id, cleanUser);

  try {
    localStorage.setItem('vice_server_dj_' + server.id, '@' + cleanUser);
    const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
    const target = custom.find(cs => cs.id === server.id);
    if (target) {
      target.dj = '@' + cleanUser;
      localStorage.setItem('vice_custom_servers', JSON.stringify(custom));
    }
  } catch (_) {}

  SoundEngine.playReaction('rocket');
  showToast('🎙️ Appointed @' + cleanUser + ' as Room RJ!');
  sendSystemNotice('🎙️ Room Owner @' + currentUser.name + ' appointed @' + cleanUser + ' as the OFFICIAL ROOM RJ! @' + cleanUser + ' now controls the station tuner and stage mic.');

  renderRoomStageInfo();
  renderUsersList();
  renderRoomSettingsRj();
};

window.appointSelectedRj = () => {
  const sel = document.getElementById('appoint-rj-select');
  if (!sel || !sel.value) return;
  window.appointRoomRj(sel.value);
};

// ============================================================
// ============================================================
// HIGH-SPEED DJ SOUND ENGINE & AUDIO SERVER (FAST STREAMS & APP)
// ============================================================
const DJ_SOUND_PRESETS = [
  {
    id: 'kavinsky',
    title: 'Kavinsky - Nightcall (Drive Synthwave)',
    scUrl: 'https://soundcloud.com/deadcruiser/nightcall',
    streamUrl: 'https://stream.nightride.fm/chillsynth.mp3',
    icon: '🚗'
  },
  {
    id: 'miami-nights',
    title: 'Miami Nights 1984 - Ocean Drive',
    scUrl: 'https://soundcloud.com/miami-nights-1984/ocean-drive',
    streamUrl: 'https://stream.nightride.fm/datawave.mp3',
    icon: '🌴'
  },
  {
    id: 'scarface',
    title: 'Scarface - Push It To The Limit (Vice 80s Club)',
    scUrl: 'https://soundcloud.com/user-537443831/paul-engemann-push-it-to-the',
    streamUrl: 'https://stream.nightride.fm/synthwave.mp3',
    icon: '🔥'
  },
  {
    id: 'vice-city',
    title: 'GTA Vice City Official Theme & Radio Mix',
    scUrl: 'https://soundcloud.com/gta-soundtracks/gta-vice-city-theme',
    streamUrl: 'https://stream.nightride.fm/nightride.mp3',
    icon: '🔫'
  },
  {
    id: 'mj-groove',
    title: 'Michael Jackson - Billie Jean (Club Edit)',
    scUrl: 'https://soundcloud.com/michael-jackson-official/billie-jean',
    streamUrl: 'https://stream.nightride.fm/horrorsynth.mp3',
    icon: '🕺'
  },
  {
    id: 'weeknd',
    title: 'The Weeknd - Blinding Lights (Synthwave Remix)',
    scUrl: 'https://soundcloud.com/theweeknd/blinding-lights',
    streamUrl: 'https://stream.nightride.fm/ebm.mp3',
    icon: '⚡'
  }
];

let isDjAudioPlaying = false;
let currentDjTrackTitle = '';

window.playDirectAudioStream = (streamUrl, title) => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isAllowed = isUserAllowedToDj(server.id, currentUser.name);
  if (!isAllowed) {
    showToast('🔒 Only Room Owner @' + server.owner + ' or Appointed RJ can control music!');
    window.openRjGuideModal();
    return;
  }

  // Force unmute so audio is heard immediately
  isAudioMuted = false;
  localStorage.setItem('vh_audio_muted', 'false');
  if (radioAudio) {
    radioAudio.muted = false;
    radioAudio.volume = Math.max(0.75, (currentVolume || 80) / 100);
  }
  updateAudioUI();

  const ytId = extractYouTubeId(streamUrl);
  const isSc = isSoundCloudUrl(streamUrl);
  const trackTitle = title || (ytId ? 'YouTube Live Audio Mix' : (isSc ? 'SoundCloud Live Mix' : 'Custom DJ Audio Stream'));

  // Save isolated audio state for THIS specific room
  serverAudioStates[server.id] = {
    roomId: server.id,
    title: trackTitle,
    streamUrl: (ytId || isSc) ? '' : streamUrl,
    ytId: ytId,
    soundCloudUrl: isSc ? streamUrl : null,
    isDjLive: true,
    dj: server.dj || ('@' + server.owner),
    isPlaying: true
  };

  try {
    localStorage.setItem('vice_server_audio_states', JSON.stringify(serverAudioStates));
  } catch (_) {}

  // Apply playback immediately in this room
  syncRoomAudio(server.id);

  sendSystemNotice('🎵 Room RJ ' + (server.dj || '@' + server.owner) + ' broadcasting in #' + server.name + ': ' + trackTitle);
  SoundEngine.playSynthPop();
  showToast('▶️ Broadcast started in #' + server.name + ': ' + trackTitle);
  window.closeSoundAppModal();
};

window.playPresetAudio = (presetId) => {
  const preset = DJ_SOUND_PRESETS.find(p => p.id === presetId);
  if (preset) {
    if (preset.scUrl) {
      window.playDirectAudioStream(preset.scUrl, preset.title);
    } else {
      window.playDirectAudioStream(preset.streamUrl, preset.title);
    }
  }
};

window.openSoundAppModal = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isAllowed = isUserAllowedToDj(server.id, currentUser.name);
  if (!isAllowed) {
    showToast('🔒 Only Room Owner @' + server.owner + ' or Appointed RJ can control music!');
    window.openRjGuideModal();
    return;
  }
  const modal = document.getElementById('sound-app-modal') || document.getElementById('youtube-dj-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeSoundAppModal = () => {
  const modal = document.getElementById('sound-app-modal') || document.getElementById('youtube-dj-modal');
  if (modal) modal.style.display = 'none';
};

// Aliases for compatibility
window.openYouTubeModal = window.openSoundAppModal;
window.closeYouTubeModal = window.closeSoundAppModal;
window.playYouTubeTrack = (input, customTitle) => {
  window.playDirectAudioStream(input, customTitle || 'Custom DJ Stream');
};

window.stopDjPlayback = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  if (serverAudioStates[server.id]) {
    serverAudioStates[server.id].isDjLive = false;
    serverAudioStates[server.id].title = server.name + ' FM Tuner';
    serverAudioStates[server.id].streamUrl = RADIO_STATIONS[0].streamUrl;
    serverAudioStates[server.id].ytId = null;
    serverAudioStates[server.id].soundCloudUrl = null;
    serverAudioStates[server.id].isPlaying = false;
  }
  try {
    localStorage.setItem('vice_server_audio_states', JSON.stringify(serverAudioStates));
  } catch (_) {}

  const deck = document.getElementById('live-dj-audio-deck');
  if (deck) deck.style.display = 'none';

  const embedContainer = document.getElementById('dj-embed-player-container');
  const embedSlot = document.getElementById('dj-embed-player-slot');
  if (embedContainer) embedContainer.style.display = 'none';
  if (embedSlot) embedSlot.innerHTML = '';

  if (radioAudio) {
    radioAudio.pause();
    isRadioPlaying = false;
    updateRadioPlayUI();
  }
  tuneStation(0);
  showToast('📻 Returned to FM Radio Relay in #' + server.name);
};

window.closeYouTubePlayback = window.stopDjPlayback;

window.submitCustomSoundUrl = () => {
  const input = document.getElementById('sound-app-url-input') || document.getElementById('youtube-link-input');
  const titleInput = document.getElementById('sound-app-title-input') || document.getElementById('youtube-title-input');
  if (!input || !input.value.trim()) {
    showToast('⚠️ Please enter an audio stream or YouTube link');
    return;
  }
  const url = input.value.trim();
  const customTitle = (titleInput && titleInput.value.trim()) || '';
  window.playDirectAudioStream(url, customTitle);
};

window.submitYouTubeUrl = window.submitCustomSoundUrl;

window.handleSoundAppLocalFile = (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  const trackName = file.name.replace(/\.[^/.]+$/, '');
  window.playDirectAudioStream(objectUrl, '📁 ' + trackName);
};

let micGainNode = null;

async function toggleRoomMicrophone() {
  const micBtn = document.getElementById('room-mic-toggle-btn');
  const onAirPill = document.getElementById('room-air-status-pill');
  const meterFill = document.getElementById('room-meter-fill');
  const currentServer = serversList.find(s => s.id === activeServerId) || serversList[0];

  const isAllowed = isUserAllowedToMic(currentServer.id, currentUser.name);

  if (!isAllowed) {
    showToast('🔒 MIC LOCKED: You need permission from Room Owner @' + currentServer.owner + ' to speak!');
    sendSystemNotice('🙋‍♂️ @' + currentUser.name + ' requested stage mic permission from Room Owner @' + currentServer.owner);
    window.openRjGuideModal();
    return;
  }

  if (isMicOn) {
    isMicOn = false;
    if (micGainNode) {
      try { micGainNode.disconnect(); } catch (_) {}
      micGainNode = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      micStream = null;
    }
    if (micAnimId) {
      cancelAnimationFrame(micAnimId);
      micAnimId = null;
    }
    if (meterFill) meterFill.style.width = '0%';
    if (micBtn) {
      micBtn.innerHTML = '🎙️ Take Stage Mic';
      micBtn.classList.remove('btn-magenta');
      micBtn.classList.add('btn-cyan');
    }
    if (onAirPill) {
      onAirPill.classList.remove('active');
      onAirPill.innerHTML = '<span class="status-dot"></span> OFF AIR';
    }

    // RESTORE RADIO WHEN RJ STEPS DOWN (MUTUAL EXCLUSION RELEASE)
    if (radioAudio && isRadioPlaying && !isAudioMuted) {
      radioAudio.volume = (currentVolume || 80) / 100;
      radioAudio.play().catch(() => {});
    }
    duckYouTubeIframe(currentVolume || 80);

    showToast('🎙️ Stepped down from stage mic. Radio stream resumed.');
    sendSystemNotice('🎙️ RJ @' + currentUser.name + ' finished their stage broadcast.');
    return;
  }

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getAudioContext() || new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(micStream);
      
      // VU Meter Analyser
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 64;
      source.connect(micAnalyser);

      // LIVE AUDIO OUTPUT ROUTE: Send microphone directly to speakers so listeners hear RJ!
      micGainNode = ctx.createGain();
      micGainNode.gain.setValueAtTime(1.15, ctx.currentTime);
      source.connect(micGainNode);
      micGainNode.connect(ctx.destination);

      isMicOn = true;
      if (micBtn) {
        micBtn.innerHTML = '🔴 Mic LIVE (Click to Release)';
        micBtn.classList.remove('btn-cyan');
        micBtn.classList.add('btn-magenta');
      }
      if (onAirPill) {
        onAirPill.classList.add('active');
        onAirPill.innerHTML = '<span class="status-dot"></span> 🎙️ ON AIR (LIVE RJ)';
      }

      // STRICT MUTUAL EXCLUSION: When mic is active, RADIO IS 100% MUTED & PAUSED!
      // No background music overlap so the RJ's voice is crystal clear!
      if (radioAudio) {
        radioAudio.pause();
        radioAudio.volume = 0;
      }
      duckYouTubeIframe(0);

      showToast('🎙️ LIVE ON AIR! Radio stream paused automatically for RJ broadcast.');
      const currentRjDisplay = document.getElementById('room-current-rj-lbl');
      if (currentRjDisplay) currentRjDisplay.textContent = '@' + currentUser.name + ' (LIVE RJ)';

      const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
      function updateMeter() {
        if (!isMicOn) return;
        micAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        if (meterFill) meterFill.style.width = Math.max(12, pct) + '%';
        micAnimId = requestAnimationFrame(updateMeter);
      }
      updateMeter();
      sendSystemNotice('🎙️ RJ @' + currentUser.name + ' took the LIVE STAGE MIC in ' + currentServer.name + '!');
    } else {
      throw new Error('MediaDevices unsupported');
    }
  } catch (err) {
    console.warn('Microphone permission fallback:', err);
    isMicOn = true;
    if (micBtn) {
      micBtn.innerHTML = '🔴 Mic Active (Virtual RJ)';
      micBtn.classList.remove('btn-cyan');
      micBtn.classList.add('btn-magenta');
    }
    if (onAirPill) {
      onAirPill.classList.add('active');
      onAirPill.innerHTML = '<span class="status-dot"></span> 🎙️ ON AIR (VIRTUAL)';
    }

    if (radioAudio) {
      radioAudio.volume = Math.max(0.04, (currentVolume / 100) * 0.15);
    }
    duckYouTubeIframe(Math.round(Math.max(5, currentVolume * 0.15)));

    showToast('🎙️ Stage Mic active! Music ducked.');
    function simulateMeter() {
      if (!isMicOn) return;
      const pct = 30 + Math.sin(Date.now() / 140) * 20 + Math.random() * 30;
      if (meterFill) meterFill.style.width = Math.min(100, pct) + '%';
      micAnimId = requestAnimationFrame(simulateMeter);
    }
    simulateMeter();
    sendSystemNotice('🎙️ RJ @' + currentUser.name + ' took the LIVE STAGE MIC in ' + currentServer.name + '!');
  }
}
window.toggleRoomMicrophone = () => toggleRoomMicrophone();

// ============================================================
let activeServerId = 'vice-hq';
let serversList = [...INITIAL_SERVERS];
let serverFilter = 'all';

// Ensure #Vice-Central-HQ owner is synchronized with currentUser
const vhqInit = serversList.find(s => s.id === 'vice-hq');
if (vhqInit) {
  vhqInit.owner = currentUser.name;
  if (!vhqInit.dj || vhqInit.dj === '@ViceSyndicate') vhqInit.dj = '@' + currentUser.name;
}

let currentPinnedAlpha = '🔥 Grand Syndicate HQ: 1 Billion $SYND on Solana SPL • Mint Revoked & 100% LP Burned!';

try {
  const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
  if (Array.isArray(custom)) {
    custom.forEach(cs => {
      if (!serversList.find(s => s.id === cs.id)) {
        serversList.push(cs);
      }
    });
  }
} catch (_) {}

let serverMessages = {
  'vice-hq': [
    {
      id: 'm1',
      user: 'Jax "Slick"',
      rank: 'main-owner',
      pawn: '👑',
      color: 'pawn-main-owner',
      glow: 'rainbow',
      powers: ['name-fire', 'pawn-crown', 'glow', 'bubble-neon'],
      text: 'Welcome to the GRAND SYNDICATE HQ! Click "👤 Set Name" above to choose your handle. Check out the level badges and power icons on every member!',
      mediaUrl: null,
      time: '02:30'
    },
    {
      id: 'm2',
      user: 'Roxy Glitch',
      rank: 'owner',
      pawn: '🟠',
      color: 'pawn-owner',
      glow: 'fire',
      powers: ['name-fire', 'glow', 'bubble-neon'],
      text: '80s Miami Neon vibes on full blast tonight! Check out the synthwave stream on 84.5 FM 🌴🏎️',
      mediaUrl: CURATED_GIFS[0].url,
      time: '02:31'
    },
    {
      id: 'm3',
      user: 'Mia Sunset',
      rank: 'member',
      pawn: '💎',
      color: 'pawn-diamond',
      glow: 'diamond',
      powers: ['name-diamond', 'glow'],
      text: 'Just activated my 💎 Diamond VIP Pawn and Ice Shimmer name with 50,000 $SYND! Syndicate level boosted to Enforcer.',
      mediaUrl: null,
      time: '02:32'
    }
  ],
  'neon-concert': [
    {
      id: 'nc1',
      user: 'Jax "Slick"',
      rank: 'main-owner',
      pawn: '👑',
      color: 'pawn-main-owner',
      glow: 'rainbow',
      powers: ['name-fire', 'pawn-crown', 'glow'],
      text: 'Neon Club Stage is LIVE! Room Owner controls who gets the stage mic. Drop your requests in chat.',
      mediaUrl: CURATED_GIFS[2].url,
      time: '02:20'
    },
    {
      id: 'nc2',
      user: 'SynthLord',
      rank: 'mod',
      pawn: '⚪',
      color: 'pawn-mod',
      glow: 'none',
      powers: ['glow'],
      text: 'Bassline is hitting clean. Tip the RJ 500 $SYND if you feel the rhythm!',
      mediaUrl: null,
      time: '02:22'
    }
  ],
  'vip-penthouse': [
    {
      id: 'vp1',
      user: 'Bruno Anvil',
      rank: 'mod',
      pawn: '⚪',
      color: 'pawn-mod',
      glow: 'none',
      powers: ['pawn-crown'],
      text: 'Protected syndicate penthouse. 1,000,000,000 $SYND supply, 0% tax on Solana SPL.',
      mediaUrl: null,
      time: '02:10'
    },
    {
      id: 'vp2',
      user: 'Roxy Glitch',
      rank: 'owner',
      pawn: '🟠',
      color: 'pawn-owner',
      glow: 'fire',
      powers: ['name-fire', 'glow'],
      text: 'Mint and freeze authority revoked. LP locked and burned. Private server access verified.',
      mediaUrl: CURATED_GIFS[4].url,
      time: '02:12'
    }
  ],
  'pump-trading': [
    {
      id: 'pt1',
      user: 'DegenWhale99',
      rank: 'guest',
      pawn: '🟢',
      color: 'pawn-guest',
      glow: 'none',
      powers: [],
      text: 'Bonding curve heating up! $SYND syndicate community is growing fast.',
      mediaUrl: CURATED_GIFS[3].url,
      time: '02:25'
    }
  ]
};

// ============================================================
// ROOM WALLPAPER CUSTOMIZATION (FREE FOR ROOM CREATORS)
// ============================================================
const WALLPAPERS = [
  { id: 'skyline', name: 'Miami Skyline', url: '/assets/vice_skyline_hero.jpg' },
  { id: 'club', name: 'Neon Cyber Club', url: '/assets/gta6_neon_club.jpg' },
  { id: 'mansion', name: 'Villa Penthouse', url: '/assets/gta6_villa_mansion.jpg' },
  { id: 'glamour', name: 'Glamour Noir', url: '/assets/vice_glamour_hero.jpg' }
];

window.openRoomSettingsModal = () => {
  const modal = document.getElementById('room-settings-modal');
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner @' + server.owner + ' can manage room settings!');
    return;
  }

  const nameInput = document.getElementById('room-edit-name-input');
  const topicInput = document.getElementById('room-edit-topic-input');
  const costBadge = document.getElementById('room-rename-cost-badge');

  if (nameInput) nameInput.value = server.name;
  if (topicInput) topicInput.value = server.topic;
  if (costBadge) {
    const renames = server.renameCount || 0;
    if (renames === 0) {
      costBadge.textContent = '✨ FREE 1ST RENAME';
      costBadge.className = 'badge badge-cyan';
    } else {
      costBadge.textContent = '💎 Cost: 1,000 $SYND';
      costBadge.className = 'badge badge-magenta';
    }
  }

  const accessSelect = document.getElementById('room-edit-access-select');
  const passInput = document.getElementById('room-edit-password-input');
  const passRow = document.getElementById('room-edit-password-row');

  const currentSec = server.securityType || (server.passcode ? 'password' : server.access === 'private' ? 'private' : 'public');
  if (accessSelect) accessSelect.value = currentSec;
  if (passInput) passInput.value = server.passcode || '';
  if (passRow) passRow.style.display = currentSec === 'public' ? 'none' : 'block';

  renderRoomSettingsKnocks();
  renderRoomSettingsRj();
  renderRoomSettingsModerators();
  renderRoomSettingsReports();
  renderRoomDeleteDangerZone();
  if (modal) modal.style.display = 'flex';
};

window.handleRoomAccessModeChange = (val) => {
  const passRow = document.getElementById('room-edit-password-row');
  if (passRow) {
    passRow.style.display = val === 'public' ? 'none' : 'block';
  }
};

window.saveRoomSecuritySettings = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner can update security settings!');
    return;
  }

  const accessSelect = document.getElementById('room-edit-access-select');
  const passInput = document.getElementById('room-edit-password-input');

  const newAccess = accessSelect ? accessSelect.value : 'public';
  const newPasscode = passInput ? passInput.value.trim() : '';

  if (newAccess === 'password' && !newPasscode) {
    showToast('⚠️ Please enter a security password for Password Protected mode!');
    return;
  }

  server.access = newAccess === 'public' ? 'public' : 'private';
  server.securityType = newAccess;
  server.passcode = newPasscode;

  try {
    const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
    const target = custom.find(cs => cs.id === server.id);
    if (target) {
      target.access = server.access;
      target.securityType = server.securityType;
      target.passcode = server.passcode;
      localStorage.setItem('vice_custom_servers', JSON.stringify(custom));
    }
    localStorage.setItem('vice_server_security_' + server.id, JSON.stringify({
      access: server.access,
      securityType: server.securityType,
      passcode: server.passcode
    }));
  } catch (_) {}

  renderRoomStageInfo();
  renderServerTabs();
  renderServerDirectory();

  SoundEngine.playSynthPop();
  showToast('🔒 Room security updated: ' + (newAccess === 'password' ? 'Password Protected' : newAccess === 'private' ? 'Knock Only' : 'Open Public'));
  sendSystemNotice('🔒 Room Owner @' + currentUser.name + ' updated room security to: ' + (newAccess === 'password' ? '🔑 Password Protected' : newAccess === 'private' ? '🚪 Knock Only' : '🔓 Open Public'));
  window.closeRoomSettingsModal();
};

window.appointRoomModerator = (targetName) => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner can appoint moderators!');
    return;
  }
  const cleanTarget = (targetName || '').replace(/^@/, '').trim();
  if (!cleanTarget) return;

  serverModerators[server.id] = serverModerators[server.id] || [];
  if (!serverModerators[server.id].includes(cleanTarget)) {
    serverModerators[server.id].push(cleanTarget);
    localStorage.setItem('vice_server_moderators', JSON.stringify(serverModerators));
  }

  // Grant mic permissions automatically to appointed mod
  serverMicApproved[server.id] = serverMicApproved[server.id] || [];
  if (!serverMicApproved[server.id].includes(cleanTarget)) {
    serverMicApproved[server.id].push(cleanTarget);
    localStorage.setItem('vice_mic_approved', JSON.stringify(serverMicApproved));
  }

  sendSystemNotice('🛡️ Room Owner @' + currentUser.name + ' appointed @' + cleanTarget + ' as official ROOM MODERATOR!');
  showToast('🛡️ Appointed @' + cleanTarget + ' as Moderator!');
  SoundEngine.playSynthPop();
  renderRoomSettingsModerators();
  renderUsersList();
};

window.removeRoomModerator = (targetName) => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner can remove moderators!');
    return;
  }
  const cleanTarget = (targetName || '').replace(/^@/, '').trim();
  serverModerators[server.id] = (serverModerators[server.id] || []).filter(u => u !== cleanTarget);
  localStorage.setItem('vice_server_moderators', JSON.stringify(serverModerators));

  sendSystemNotice('🚫 Room Owner @' + currentUser.name + ' removed Moderator status from @' + cleanTarget + '.');
  showToast('Removed Moderator @' + cleanTarget);
  renderRoomSettingsModerators();
  renderUsersList();
};

window.appointSelectedModerator = () => {
  const sel = document.getElementById('appoint-mod-select');
  if (!sel || !sel.value) return;
  window.appointRoomModerator(sel.value);
};

function renderRoomSettingsModerators() {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const listEl = document.getElementById('room-current-mods-list');
  const sel = document.getElementById('appoint-mod-select');
  const mods = serverModerators[server.id] || [];

  if (listEl) {
    if (mods.length === 0) {
      listEl.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim);font-style:italic;">No moderators appointed yet.</span>';
    } else {
      listEl.innerHTML = mods.map(m => `
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);padding:3px 8px;border-radius:4px;font-size:0.75rem;color:var(--neon-cyan);font-weight:800;">
          <span>🛡️ @${m}</span>
          <button onclick="window.removeRoomModerator('${m}')" style="background:none;border:none;color:var(--neon-red);cursor:pointer;font-weight:900;padding:0 2px;" title="Remove Moderator">✕</button>
        </div>
      `).join(' ');
    }
  }

  if (sel) {
    const onlineUsers = INITIAL_CHAT_USERS.filter(u => u.name !== currentUser.name && !mods.includes(u.name));
    sel.innerHTML = onlineUsers.map(u => `
      <option value="${u.name}">@${u.name} (${u.status || 'Member'})</option>
    `).join('');
  }
}

function renderRoomSettingsRj() {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const rjBadge = document.getElementById('current-rj-badge');
  const sel = document.getElementById('appoint-rj-select');
  if (rjBadge) rjBadge.textContent = 'ACTIVE: ' + (server.dj || '@' + server.owner);
  if (sel) {
    const onlineUsers = [currentUser, ...INITIAL_CHAT_USERS];
    sel.innerHTML = onlineUsers.map(u => `
      <option value="${u.name}" ${server.dj === '@' + u.name ? 'selected' : ''}>
        @${u.name} (${u.status || u.rank || 'Member'})
      </option>
    `).join('');
  }
}

window.closeRoomSettingsModal = () => {
  const modal = document.getElementById('room-settings-modal');
  if (modal) modal.style.display = 'none';
};

window.saveRoomBrandingSettings = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner can update room branding!');
    return;
  }
  const nameInput = document.getElementById('room-edit-name-input');
  const topicInput = document.getElementById('room-edit-topic-input');
  if (!nameInput) return;

  let newName = nameInput.value.trim();
  if (!newName) {
    showToast('⚠️ Please enter a room name');
    return;
  }
  if (!newName.startsWith('#')) newName = '#' + newName;
  const newTopic = (topicInput && topicInput.value.trim()) || server.topic;

  const renames = server.renameCount || 0;
  const isNameChanged = newName !== server.name;

  if (isNameChanged && renames > 0) {
    const cost = 1000;
    if (userBalance < cost) {
      showToast('⚠️ Insufficient $SYND! You need 1,000 $SYND to rename the room again.');
      window.openDepositModal();
      return;
    }
    deductBalance(cost);
    showToast('💎 Paid 1,000 $SYND for room rename');
  }

  server.name = newName;
  server.topic = newTopic;
  if (isNameChanged) {
    server.renameCount = renames + 1;
  }

  try {
    const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
    const target = custom.find(cs => cs.id === server.id);
    if (target) {
      target.name = newName;
      target.topic = newTopic;
      target.renameCount = server.renameCount;
      localStorage.setItem('vice_custom_servers', JSON.stringify(custom));
    }
    localStorage.setItem('vice_server_meta_' + server.id, JSON.stringify({
      name: newName,
      topic: newTopic,
      renameCount: server.renameCount
    }));
  } catch (_) {}

  renderRoomStageInfo();
  renderServerTabs();
  renderServerDirectory();

  sendSystemNotice('🏷️ Room details updated by @' + currentUser.name + ': ' + newName + ' • ' + newTopic);
  SoundEngine.playSynthPop();
  showToast('🎉 Room branding updated!');
  window.closeRoomSettingsModal();
};

let roomSlowModeSeconds = 0;
window.setRoomSlowMode = (sec) => {
  roomSlowModeSeconds = sec;
  const badge = document.getElementById('room-slowmode-lbl');
  if (badge) {
    badge.textContent = sec === 0 ? 'OFF' : (sec + 's');
  }
  showToast(sec === 0 ? '🐢 Slow mode disabled' : ('🐢 Slow mode set to ' + sec + 's'));
};

let roomSfxEnabled = true;
window.toggleRoomSfx = () => {
  roomSfxEnabled = !roomSfxEnabled;
  const btn = document.getElementById('room-sfx-toggle-btn');
  if (btn) {
    btn.innerHTML = roomSfxEnabled ? '🔊 Active' : '🔇 Muted';
    btn.style.color = roomSfxEnabled ? 'var(--neon-cyan)' : 'var(--text-muted)';
  }
  showToast(roomSfxEnabled ? '🔊 Chat chimes unmuted' : '🔇 Chat chimes muted');
};

window.setRoomWallpaper = (url) => {
  const stage = document.getElementById('xat-main-stage');
  const server = serversList.find(s => s.id === activeServerId);
  if (stage) {
    stage.style.backgroundImage = 'url(' + url + ')';
    stage.classList.add('room-stage-bg');
  }
  if (server) {
    server.banner = url;
    try {
      localStorage.setItem('vice_wallpaper_' + server.id, url);
      const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
      const target = custom.find(cs => cs.id === server.id);
      if (target) {
        target.banner = url;
        localStorage.setItem('vice_custom_servers', JSON.stringify(custom));
      }
    } catch (_) {}
  }
  showToast('🎨 Room background wallpaper updated!');
  window.closeRoomSettingsModal();
  renderServerDirectory();
};

// ============================================================
// ROOM DELETION & CORE MAIN CHAT PROTECTION
// ============================================================
function renderRoomDeleteDangerZone() {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const container = document.getElementById('room-delete-danger-zone');
  if (!container) return;

  if (server.id === 'vice-hq' || server.isProtectedMain) {
    container.innerHTML = `
      <div style="background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.3);padding:10px 14px;border-radius:8px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--neon-cyan);font-weight:900;">
          🛡️ PROTECTED MAIN CHATROOM (#Vice-Central-HQ is the permanent platform core and cannot be deleted)
        </span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);padding:12px 14px;border-radius:8px;">
        <div style="font-size:0.78rem;font-weight:900;color:var(--neon-red);margin-bottom:6px;">
          ⚠️ DANGER ZONE: DELETE ROOM
        </div>
        <p style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">
          As Room Owner @${server.owner}, you can permanently close and delete this room from the syndicate directory.
        </p>
        <button class="btn btn-ghost btn-sm" onclick="window.confirmDeleteCurrentRoom()" style="color:var(--neon-red);border-color:var(--neon-red);width:100%;font-weight:900;">
          🗑️ Permanently Delete This Room
        </button>
      </div>
    `;
  }
}

window.confirmDeleteCurrentRoom = () => {
  const server = serversList.find(s => s.id === activeServerId);
  if (!server) return;
  if (server.id === 'vice-hq' || server.isProtectedMain) {
    showToast('🔒 Protected Core: #Vice-Central-HQ is the permanent syndicate core and cannot be deleted!');
    return;
  }
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  if (!isOwner) {
    showToast('🔒 Only Room Owner @' + server.owner + ' can delete this room!');
    return;
  }
  if (!confirm('⚠️ Are you sure you want to permanently delete room ' + server.name + '? This action cannot be undone.')) {
    return;
  }

  const deletedName = server.name;
  const deletedId = server.id;

  serversList = serversList.filter(s => s.id !== deletedId);

  try {
    const custom = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
    const updated = custom.filter(cs => cs.id !== deletedId);
    localStorage.setItem('vice_custom_servers', JSON.stringify(updated));
    localStorage.removeItem('vice_server_meta_' + deletedId);
    localStorage.removeItem('vice_server_security_' + deletedId);
    localStorage.removeItem('vice_server_dj_' + deletedId);
  } catch (_) {}

  showToast('🗑️ Room ' + deletedName + ' permanently deleted.');
  sendSystemNotice('🗑️ Room ' + deletedName + ' was closed and deleted by Owner @' + currentUser.name);

  window.closeRoomSettingsModal();
  enterServer('vice-hq');
  renderServerTabs();
  renderServerDirectory();
};

// ============================================================
// USER & MESSAGE REPORT SYSTEM (DELIVERED TO OWNER & MODS)
// ============================================================
let moderationReports = JSON.parse(localStorage.getItem('vice_moderation_reports') || '[]');
let activeReportTarget = null;
let activeReportContext = '';

window.openReportModal = (targetUser, messageContext = '') => {
  activeReportTarget = targetUser;
  activeReportContext = messageContext;
  const modal = document.getElementById('report-user-modal');
  const targetEl = document.getElementById('report-target-username');
  const contextEl = document.getElementById('report-context-preview');
  const notesInput = document.getElementById('report-notes-input');

  if (targetEl) targetEl.textContent = '@' + targetUser;
  if (contextEl) {
    if (messageContext) {
      contextEl.style.display = 'block';
      contextEl.textContent = 'Message: "' + messageContext + '"';
    } else {
      contextEl.style.display = 'none';
    }
  }
  if (notesInput) notesInput.value = '';
  if (modal) modal.style.display = 'flex';
};

window.closeReportModal = () => {
  const modal = document.getElementById('report-user-modal');
  if (modal) modal.style.display = 'none';
  activeReportTarget = null;
  activeReportContext = '';
};

window.submitUserReport = (e) => {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeReportTarget) return;

  const reasonSelect = document.getElementById('report-reason-select');
  const notesInput = document.getElementById('report-notes-input');
  const reason = reasonSelect ? reasonSelect.value : 'Spam / Abuse';
  const notes = notesInput ? notesInput.value.trim() : '';

  const newReport = {
    id: 'rep_' + Date.now(),
    targetUser: activeReportTarget,
    reportedBy: currentUser.name,
    reason: reason,
    notes: notes,
    context: activeReportContext,
    roomId: activeServerId,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  moderationReports.unshift(newReport);
  localStorage.setItem('vice_moderation_reports', JSON.stringify(moderationReports));

  window.closeReportModal();
  SoundEngine.playReaction('rocket');
  showToast('🚨 Report submitted. Room Owner @blacksheep and moderators have been notified.');

  sendSystemNotice('🚨 Report filed against @' + newReport.targetUser + ' (' + newReport.reason + ') • Forwarded to Owner @blacksheep');

  renderRoomStageInfo();
  renderRoomSettingsReports();
};

window.dismissReport = (reportId) => {
  moderationReports = moderationReports.filter(r => r.id !== reportId);
  localStorage.setItem('vice_moderation_reports', JSON.stringify(moderationReports));
  showToast('✓ Report dismissed');
  renderRoomSettingsReports();
  renderRoomStageInfo();
};

window.muteReportedUser = (targetUser, reportId) => {
  sendSystemNotice('🔇 User @' + targetUser + ' was MUTED for 10 minutes by Room Owner @' + currentUser.name + ' due to reports.');
  showToast('🔇 Muted @' + targetUser);
  if (reportId) window.dismissReport(reportId);
};

window.kickReportedUser = (targetUser, reportId) => {
  sendSystemNotice('👢 User @' + targetUser + ' was KICKED from the room by Room Owner @' + currentUser.name + ' due to community reports.');
  showToast('👢 Kicked @' + targetUser);
  if (reportId) window.dismissReport(reportId);
};

function renderRoomSettingsReports() {
  const container = document.getElementById('room-settings-reports-list');
  const countBadge = document.getElementById('room-reports-count-badge');
  if (!container) return;

  const roomReports = moderationReports.filter(r => r.roomId === activeServerId || !r.roomId);

  if (countBadge) {
    if (roomReports.length > 0) {
      countBadge.style.display = 'inline-flex';
      countBadge.textContent = '🚨 ' + roomReports.length + ' PENDING';
    } else {
      countBadge.style.display = 'none';
    }
  }

  if (roomReports.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem;color:var(--text-dim);font-style:italic;">✨ All clear! No pending user reports for this room.</div>';
    return;
  }

  container.innerHTML = roomReports.map(r => `
    <div style="background:#050610;padding:10px 12px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:0.78rem;font-weight:900;color:var(--neon-red);">🚨 Suspect: @${escHtml(r.targetUser)}</span>
        <span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);">${r.timestamp}</span>
      </div>
      <div style="font-size:0.73rem;color:#fff;margin-bottom:4px;">Reason: <strong>${escHtml(r.reason)}</strong></div>
      ${r.context ? `<div style="font-size:0.7rem;color:var(--text-dim);font-style:italic;margin-bottom:6px;">"${escHtml(r.context)}"</div>` : ''}
      <div style="font-size:0.68rem;color:var(--text-muted);margin-bottom:6px;">Reported by: @${escHtml(r.reportedBy)}</div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="window.dismissReport('${r.id}')" style="padding:2px 8px;font-size:0.68rem;">✓ Dismiss</button>
        <button class="btn btn-cyan btn-sm" onclick="window.muteReportedUser('${r.targetUser}', '${r.id}')" style="padding:2px 8px;font-size:0.68rem;">🔇 Mute</button>
        <button class="btn btn-magenta btn-sm" onclick="window.kickReportedUser('${r.targetUser}', '${r.id}')" style="padding:2px 8px;font-size:0.68rem;">👢 Kick</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// OWNER AUTHENTICATION & SOLANA WEB3 WALLET LOGIN
// ============================================================
window.openOwnerAuthModal = () => {
  const modal = document.getElementById('owner-auth-modal');
  const userEl = document.getElementById('owner-modal-current-user');
  if (userEl) {
    const isOwner = currentUser.name.toLowerCase() === 'blacksheep' || currentUser.name.toLowerCase() === 'blacsheep';
    userEl.textContent = '@' + currentUser.name + (isOwner ? ' (👑 Grand Founder)' : ' (Member)');
  }
  if (modal) modal.style.display = 'flex';
};

window.openWalletModal = () => window.openOwnerAuthModal();
window.closeWalletModal = () => window.closeOwnerAuthModal();

window.closeOwnerAuthModal = () => {
  const modal = document.getElementById('owner-auth-modal');
  if (modal) modal.style.display = 'none';
};

window.handleOwnerPasskeyLogin = (e) => {
  if (e && e.preventDefault) e.preventDefault();
  const passInput = document.getElementById('owner-master-passkey-input');
  const enteredKey = passInput ? passInput.value.trim() : '';

  if (!enteredKey) {
    showToast('⚠️ Please enter the Owner Master Passkey');
    return;
  }

  const savedOwnerKey = localStorage.getItem('vice_owner_passkey') || 'blacksheep80s';
  if (enteredKey === savedOwnerKey || enteredKey.toLowerCase() === 'blacksheep' || enteredKey.toLowerCase() === 'blacsheep') {
    localStorage.setItem('vice_user_name', 'blacksheep');
    localStorage.setItem('vice_owner_auth', 'true');
    currentUser.name = 'blacksheep';
    currentUser.rank = 'main-owner';
    currentUser.pawn = '👑';
    currentUser.color = 'pawn-main-owner';

    if (userBalance < 100000) {
      userBalance = 150000;
      localStorage.setItem('synd_user_balance', '150000');
      updateBalanceUI();
    }

    const vhq = serversList.find(s => s.id === 'vice-hq');
    if (vhq) {
      vhq.owner = 'blacksheep';
      vhq.dj = '@blacksheep';
    }

    const pillName = document.getElementById('my-nickname-val');
    if (pillName) pillName.textContent = '@blacksheep';

    window.closeOwnerAuthModal();
    SoundEngine.playReaction('rocket');
    showToast('👑 Grand Owner Authenticated! Welcome back @blacksheep');
    sendSystemNotice('👑 Grand Founder & Platform Owner @blacksheep securely signed into the Syndicate console.');

    renderRoomStageInfo();
    renderServerTabs();
    renderUsersList();
  } else {
    showToast('❌ Invalid Owner Passkey! Please check your secret key.');
  }
};

window.handleSolanaWalletConnect = async () => {
  if (window.solana && window.solana.isPhantom) {
    try {
      const resp = await window.solana.connect();
      const pubkey = resp.publicKey.toString();
      const shortAddr = pubkey.slice(0, 4) + '...' + pubkey.slice(-4);
      showToast('🟣 Phantom Wallet Connected: ' + shortAddr);
      sendSystemNotice('🚀 User verified Solana Wallet (' + shortAddr + ') on SPL network.');
      window.closeOwnerAuthModal();
    } catch (err) {
      showToast('⚠️ Wallet connection cancelled: ' + (err.message || 'Error'));
    }
  } else {
    showToast('🟣 Phantom wallet extension not detected. Opening phantom.app...');
    window.open('https://phantom.app/', '_blank');
  }
};

// ============================================================
// SERVER NAVIGATION & ACCESS
// ============================================================
function attemptEnterServer(serverId) {
  const target = serversList.find(s => s.id === serverId);
  if (!target) return;

  if (isUserServerOwner(serverId, currentUser.name)) {
    enterServer(serverId);
    return;
  }

  if (target.access === 'private' || target.securityType === 'password') {
    const unlocked = JSON.parse(localStorage.getItem('unlocked_servers') || '[]');
    if (unlocked.includes(serverId)) {
      enterServer(serverId);
    } else {
      window.promptServerAccessRequest(serverId);
    }
  } else {
    enterServer(serverId);
  }
}

function enterServer(serverId) {
  const target = serversList.find(s => s.id === serverId);
  if (!target) return;
  activeServerId = serverId;

  if (isUserServerOwner(target.id, currentUser.name)) {
    target.owner = currentUser.name;
    currentUser.rank = 'main-owner';
    currentUser.pawn = '👑';
    currentUser.color = 'pawn-main-owner';
  } else if ((serverModerators[target.id] || []).includes(currentUser.name)) {
    currentUser.rank = 'moderator';
    currentUser.pawn = '🛡️';
    currentUser.color = 'pawn-mod';
  } else {
    currentUser.rank = 'member';
    currentUser.pawn = userEquippedPowers.includes('name-diamond') ? '💎' : '🔵';
    currentUser.color = userEquippedPowers.includes('name-diamond') ? 'pawn-diamond' : 'pawn-member';
  }

  // PER-ROOM AUDIO ISOLATION: Tune listener into THIS room's specific soundtrack!
  syncRoomAudio(target.id);

  try {
    const metaStr = localStorage.getItem('vice_server_meta_' + target.id);
    if (metaStr) {
      const meta = JSON.parse(metaStr);
      if (meta.name) target.name = meta.name;
      if (meta.topic) target.topic = meta.topic;
      if (typeof meta.renameCount === 'number') target.renameCount = meta.renameCount;
    }
    const savedDj = localStorage.getItem('vice_server_dj_' + target.id);
    if (savedDj) target.dj = savedDj;
  } catch (_) {}

  const savedWallpaper = localStorage.getItem('vice_wallpaper_' + target.id) || target.banner;
  if (savedWallpaper) {
    target.banner = savedWallpaper;
  }
  const stage = document.getElementById('xat-main-stage');
  if (stage && target.banner) {
    stage.style.backgroundImage = 'url(' + target.banner + ')';
    stage.classList.add('room-stage-bg');
  }

  target.listeners = (target.listeners || 35) + 1;

  if (userEquippedPowers.includes('entrance-halo')) {
    SoundEngine.playReaction('rocket');
    sendSystemNotice('👑 HIGH ROLLER @' + currentUser.name + ' entered the server with Golden Fanfare!');
  }

  renderServerTabs();
  renderRoomStageInfo();
  renderMessagesFeed();
  renderUsersList();
  renderServerDirectory();

  const chatSec = document.getElementById('vice-chat-section');
  if (chatSec) chatSec.scrollIntoView({ behavior: 'smooth' });

  SoundEngine.playSynthPop();
  showToast('Entered ' + target.name);
}

function getTopTrendingServer() {
  return [...serversList].sort((a,b) => (b.listeners || 0) - (a.listeners || 0))[0] || serversList[0];
}

function renderServerTabs() {
  const container = document.getElementById('xat-room-tabs-list');
  if (!container) return;

  const topServer = getTopTrendingServer();

  container.innerHTML = serversList.map(s => {
    const isTop = s.id === topServer.id;
    return `
      <button class="xat-tab-btn ${s.id === activeServerId ? 'active' : ''} ${isTop ? 'trending-tab' : ''}" data-server="${s.id}">
        ${isTop ? '🔥 ' : (s.access === 'private' ? '🔒 ' : '')}${escHtml(s.name)} 
        <span style="opacity:0.85;font-size:0.68rem;${isTop ? 'color:var(--neon-gold);font-weight:900;' : ''}">
          (${s.listeners || 35} online${isTop ? ' • #1 TRENDING' : ''})
        </span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.xat-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => attemptEnterServer(btn.getAttribute('data-server')));
  });
}

function renderRoomStageInfo() {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const nameEl = document.getElementById('room-server-title');
  const topicEl = document.getElementById('room-server-topic');
  const rjEl = document.getElementById('room-current-rj-lbl');
  const catEl = document.getElementById('room-server-cat');
  const lockEl = document.getElementById('room-server-lock-status');
  const micBtn = document.getElementById('room-mic-toggle-btn');
  const pinText = document.getElementById('pinned-alpha-text');
  const settingsBtn = document.getElementById('room-settings-btn');
  const trendingBadge = document.getElementById('room-server-trending-badge');

  if (nameEl) nameEl.textContent = server.name;
  if (topicEl) topicEl.textContent = server.topic;
  if (rjEl) rjEl.textContent = server.dj || ('@' + server.owner);
  if (catEl) catEl.textContent = server.category;
  if (pinText) pinText.textContent = currentPinnedAlpha;

  const roomAudio = getServerAudio(server.id);
  const trackEl = document.getElementById('room-station-track');
  const stationName = document.getElementById('room-station-name');
  if (trackEl && roomAudio) trackEl.textContent = roomAudio.title;
  if (stationName && roomAudio) {
    stationName.textContent = roomAudio.isDjLive ? '🎵 DJ SOUND APP (LIVE)' : (server.name + ' LIVE RELAY');
  }

  const topServer = getTopTrendingServer();
  const isTop = server.id === topServer.id;
  if (trendingBadge) {
    if (isTop) {
      trendingBadge.style.display = 'inline-flex';
      trendingBadge.innerHTML = '🔥 #1 TRENDING SPOTLIGHT (' + (server.listeners || 35) + ' Online)';
    } else {
      trendingBadge.style.display = 'none';
    }
  }

  if (settingsBtn) {
    settingsBtn.style.display = 'inline-flex';
  }

  const knocksBar = document.getElementById('room-owner-knocks-bar');
  const knockUserEl = document.getElementById('knock-request-username');
  const isOwner = isUserServerOwner(server.id, currentUser.name);
  const isMod = (serverModerators[server.id] || []).includes(currentUser.name);
  const pendingKnocks = (serverKnockRequests[server.id] || []);

  if (knocksBar && knockUserEl) {
    if ((isOwner || isMod) && pendingKnocks.length > 0) {
      knocksBar.style.display = 'flex';
      knockUserEl.textContent = '@' + pendingKnocks[0].user;
    } else {
      knocksBar.style.display = 'none';
    }
  }

  if (lockEl) {
    const isPass = server.securityType === 'password' || (server.access === 'private' && server.passcode);
    const isPriv = server.access === 'private' && !server.passcode;
    lockEl.className = 'server-access-badge ' + (isPass ? 'password' : isPriv ? 'private' : 'public');
    lockEl.textContent = isPass ? '🔑 PASSWORD PROTECTED' : isPriv ? '🔒 PRIVATE KNOCK' : '🔓 OPEN PUBLIC';
  }

  if (micBtn && !isMicOn) {
    const isAllowed = isUserAllowedToMic(server.id, currentUser.name);
    if (isAllowed) {
      micBtn.innerHTML = '🎙️ Take Stage Mic';
      micBtn.title = 'You have Stage Mic permission!';
    } else {
      micBtn.innerHTML = '🔒 Request Mic from Owner';
      micBtn.title = 'Room Owner @' + server.owner + ' controls mic access';
    }
  }
}

// ============================================================
// SERVER DIRECTORY (GAMING LOBBY BROWSER)
// ============================================================
function renderServerDirectory() {
  const grid = document.getElementById('servers-directory-grid');
  if (!grid) return;

  const filtered = serversList.filter(s => {
    if (serverFilter === 'concerts') return s.category.toLowerCase().includes('concert') || s.name.toLowerCase().includes('stage');
    if (serverFilter === 'public') return s.access === 'public';
    if (serverFilter === 'private') return s.access === 'private';
    return true;
  });

  grid.innerHTML = filtered.map(s => {
    const isCurrent = s.id === activeServerId;
    return `
      <div class="server-card card-3d-tilt" style="${isCurrent ? 'border-color:var(--neon-cyan);box-shadow:0 0 20px var(--cyan-glow);' : ''}">
        <div class="server-card-banner">
          <img src="${s.banner || '/assets/vice_skyline_hero.jpg'}" alt="${escHtml(s.name)}">
          <div style="position:absolute;top:10px;left:10px;display:flex;gap:6px;">
            <span class="server-access-badge ${s.access}">
              ${s.access === 'private' ? '🔒 PRIVATE' : '🔓 PUBLIC'}
            </span>
            <span class="status-pill" style="font-size:0.65rem;">${escHtml(s.category)}</span>
          </div>
          <div style="position:absolute;bottom:8px;right:10px;background:rgba(6,7,16,0.85);padding:3px 8px;border-radius:12px;font-family:var(--font-mono);font-size:0.7rem;color:#fff;">
            ● ${s.listeners || 40} ONLINE
          </div>
        </div>

        <div class="server-card-body">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <h3 style="font-size:1.15rem;font-weight:950;color:#fff;">${escHtml(s.name)}</h3>
              <span style="font-size:1.3rem;">${s.icon || '🌐'}</span>
            </div>
            <p style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:12px;">
              ${escHtml(s.desc || s.topic)}
            </p>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;background:#050610;padding:8px 12px;border-radius:6px;border:1px solid var(--border-subtle);margin-bottom:12px;font-family:var(--font-mono);font-size:0.72rem;">
              <span style="color:var(--text-muted);">OWNER / RJ:</span>
              <span style="color:var(--neon-magenta);font-weight:800;">${escHtml(s.dj || '@' + s.owner)}</span>
            </div>

            <button class="btn ${isCurrent ? 'btn-ghost' : 'btn-cyan'} btn-sm btn-full" onclick="window.handleServerClick('${s.id}')">
              ${isCurrent ? '● CURRENTLY IN SERVER' : (s.access === 'private' ? '🔒 REQUEST ENTRY (KNOCK)' : '🚀 ENTER SERVER')}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.handleServerClick = (id) => attemptEnterServer(id);

window.setServerFilter = (filter) => {
  serverFilter = filter;
  document.querySelectorAll('.server-filter-btn').forEach(b => {
    if (b.getAttribute('data-filter') === filter) b.classList.add('active');
    else b.classList.remove('active');
  });
  renderServerDirectory();
};

// ============================================================
// CHAT MESSAGES & RICH MEDIA FEED (WITH LEVEL & POWER BADGES)
// ============================================================
function renderMessagesFeed() {
  const feed = document.getElementById('xat-messages-feed');
  if (!feed) return;
  const msgs = serverMessages[activeServerId] || [];

  feed.innerHTML = msgs.map(m => {
    let nameClass = '';
    if (m.glow === 'fire') nameClass = 'glow-fire';
    else if (m.glow === 'diamond') nameClass = 'glow-diamond';
    else if (m.glow === 'rainbow') nameClass = 'glow-rainbow';

    const bubbleClass = m.hasNeonBubbles ? 'bubble-neon' : '';
    const userPowers = m.powers || [];
    const lvlData = getUserLevelData(userPowers, m.rank === 'main-owner');

    return `
      <div class="xat-msg-row ${bubbleClass}">
        <div class="xat-pawn ${m.color}">${m.pawn}</div>
        <div class="xat-msg-content">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span class="lvl-badge ${lvlData.badgeClass}" title="Syndicate ${lvlData.tier}">${lvlData.icon} LVL ${lvlData.lvl}</span>
              <span class="xat-msg-user ${nameClass}" onclick="window.openUserDossier('${escHtml(m.user)}')">
                ${escHtml(m.user)}
              </span>
              ${renderPowerMiniIcons(userPowers)}
              <span class="xat-msg-time">${m.time}</span>
            </div>
            <button class="xat-msg-report-btn" onclick="window.openReportModal('${escHtml(m.user)}', '${escHtml(m.text || '')}')" title="Report message to Owner &amp; Mods" style="background:none;border:none;cursor:pointer;opacity:0.4;font-size:0.72rem;padding:0 4px;transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">🚩</button>
          </div>
          ${m.text ? `<div class="xat-msg-text">${escHtml(m.text)}</div>` : ''}
          ${m.mediaUrl ? `
            <img src="${escHtml(m.mediaUrl)}" alt="Chat attachment" class="xat-media-img" loading="lazy" onclick="window.open('${escHtml(m.mediaUrl)}', '_blank')">
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  feed.scrollTop = feed.scrollHeight;
}

// ============================================================
// ONLINE USERS SIDEBAR ROSTER (WITH LEVEL BADGES & POWERS)
// ============================================================
function renderUsersList() {
  const container = document.getElementById('xat-users-list');
  if (!container) return;

  const users = [...INITIAL_CHAT_USERS];
  if (!users.find(u => u.name === currentUser.name)) {
    currentUser.powers = userEquippedPowers;
    users.unshift(currentUser);
  } else {
    // update self powers in array
    const self = users.find(u => u.name === currentUser.name);
    if (self) self.powers = userEquippedPowers;
  }

  container.innerHTML = users.map(u => {
    let nameClass = '';
    if (u.glow === 'fire') nameClass = 'glow-fire';
    else if (u.glow === 'diamond') nameClass = 'glow-diamond';
    else if (u.glow === 'rainbow') nameClass = 'glow-rainbow';

    const isOwner = isUserServerOwner(activeServerId, u.name);
    const isMod = (serverModerators[activeServerId] || []).includes(u.name);
    const isMicApproved = isUserAllowedToMic(activeServerId, u.name);
    const userPowers = u.powers || [];
    const lvlData = getUserLevelData(userPowers, isOwner || u.rank === 'main-owner');
    const roleTitle = isOwner ? '👑 Room Owner' : isMod ? '🛡️ Moderator' : lvlData.tier;
    const pawnIcon = isOwner ? '👑' : isMod ? '🛡️' : u.pawn;
    const pawnColor = isOwner ? 'pawn-main-owner' : isMod ? 'pawn-owner' : u.color;

    return `
      <div class="xat-user-row" onclick="window.openUserDossier('${escHtml(u.name)}')">
        <div class="xat-pawn ${pawnColor}">${pawnIcon}</div>
        <div style="flex:1;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:4px;overflow:hidden;">
            <span class="lvl-badge ${lvlData.badgeClass}" style="font-size:0.58rem;padding:0 4px;" title="${roleTitle}">${lvlData.lvl}</span>
            <span class="xat-user-name ${nameClass}" style="white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">
              ${escHtml(u.name)}
            </span>
            ${isOwner ? '<span title="Room Owner">👑</span>' : isMod ? '<span title="Room Moderator">🛡️</span>' : (isMicApproved ? '<span title="On Stage">🎙️</span>' : '')}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;">
            <span class="xat-user-rank-lbl" style="${isOwner ? 'color:var(--vault-gold);font-weight:900;' : isMod ? 'color:var(--neon-cyan);font-weight:800;' : ''}">${roleTitle}</span>
            ${renderPowerMiniIcons(userPowers)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const countEl = document.getElementById('xat-online-count');
  if (countEl) countEl.textContent = users.length;
}

function sendChatMessage(text, mediaUrl = null) {
  if ((!text || !text.trim()) && !mediaUrl) return;
  const trimmed = text ? text.trim() : '';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!serverMessages[activeServerId]) serverMessages[activeServerId] = [];
  serverMessages[activeServerId].push({
    id: 'm_' + Date.now(),
    user: currentUser.name,
    rank: currentUser.rank,
    pawn: currentUser.pawn,
    color: currentUser.color,
    glow: currentUser.glow,
    hasNeonBubbles: currentUser.hasNeonBubbles,
    powers: userEquippedPowers,
    text: trimmed,
    mediaUrl: mediaUrl,
    time: time
  });

  SoundEngine.playSynthPop();
  renderMessagesFeed();

  // Periodic bot reply for syndicate atmosphere
  if (Math.random() > 0.6) {
    setTimeout(() => {
      const bots = ['Roxy Glitch', 'Jax "Slick"', 'Mia Sunset', 'Bruno Anvil'];
      const botName = bots[Math.floor(Math.random() * bots.length)];
      const botUser = INITIAL_CHAT_USERS.find(u => u.name === botName) || {};
      const replies = [
        'LFG! The Vice Syndicate empire is growing!',
        'The auto-ducking on the stage mic sounds super clean 🔊',
        'Who wants to send a Rocket blast or Cash Rain to hype up the room? 🚀',
        'Drop more fire GIFs in the chat! 🔥',
        'Loving the live station music right now 📻'
      ];
      const botReply = replies[Math.floor(Math.random() * replies.length)];
      
      if (!serverMessages[activeServerId]) serverMessages[activeServerId] = [];
      serverMessages[activeServerId].push({
        id: 'bot_' + Date.now(),
        user: botName,
        rank: botUser.rank || 'member',
        pawn: botUser.pawn || '🔵',
        color: botUser.color || 'pawn-member',
        glow: botUser.glow || 'none',
        hasNeonBubbles: false,
        powers: botUser.powers || [],
        text: botReply,
        mediaUrl: null,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      SoundEngine.playSynthPop();
      renderMessagesFeed();
    }, 1200 + Math.random() * 2000);
  }
}

function sendSystemNotice(notice) {
  if (!serverMessages[activeServerId]) serverMessages[activeServerId] = [];
  serverMessages[activeServerId].push({
    id: 'sys_' + Date.now(),
    user: '⚡ SYNDICATE BROADCAST',
    rank: 'main-owner',
    pawn: '👑',
    color: 'pawn-main-owner',
    glow: 'rainbow',
    powers: ['pawn-crown', 'name-fire'],
    text: notice,
    mediaUrl: null,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  renderMessagesFeed();
}

// ============================================================
// TIKTOK-STYLE LIVE GIFTS & FULL-SCREEN ANIMATIONS
// ============================================================
function triggerLiveGiftAnimation(giftId, senderName) {
  const overlay = document.getElementById('gift-screen-overlay');
  if (!overlay) return;

  if (giftId === 'gift-rocket') {
    SoundEngine.playReaction('rocket');
    const rocket = document.createElement('div');
    rocket.className = 'rocket-fly';
    rocket.textContent = '🚀';
    overlay.appendChild(rocket);
    setTimeout(() => rocket.remove(), 3100);
    sendSystemNotice('🚀 ' + senderName + ' LAUNCHED A SOLANA ROCKET BLAST ACROSS THE SERVER! (30,000 $SYND)');
  } else if (giftId === 'gift-cashrain') {
    SoundEngine.playReaction('tip');
    for (let i = 0; i < 24; i++) {
      setTimeout(() => {
        const cash = document.createElement('div');
        cash.className = 'cash-particle';
        cash.textContent = Math.random() > 0.5 ? '💵' : '🪙';
        cash.style.left = (5 + Math.random() * 90) + '%';
        overlay.appendChild(cash);
        setTimeout(() => cash.remove(), 4000);
      }, i * 140);
    }
    sendSystemNotice('🌧️ ' + senderName + ' MADE IT RAIN MIAMI CASH & GOLD IN THE SERVER! (25,000 $SYND)');
  } else if (giftId === 'gift-supercar') {
    SoundEngine.playReaction('rocket');
    const car = document.createElement('div');
    car.className = 'supercar-drive';
    car.textContent = '🏎️💨';
    overlay.appendChild(car);
    setTimeout(() => car.remove(), 2600);
    sendSystemNotice('🏎️ ' + senderName + ' SPED THROUGH THE SERVER IN A NEON SUPERCAR! (35,000 $SYND)');
  }
}

// ============================================================
// GIF PICKER & IMAGE UPLOAD
// ============================================================
window.toggleGifPicker = () => {
  const pop = document.getElementById('gif-picker-pop');
  if (!pop) return;
  pop.style.display = pop.style.display === 'block' ? 'none' : 'block';
};

window.sendCuratedGif = (gifUrl) => {
  sendChatMessage('', gifUrl);
  const pop = document.getElementById('gif-picker-pop');
  if (pop) pop.style.display = 'none';
  showToast('🎬 GIF shared to chat!');
};

window.handleImageUpload = (input) => {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (!file.type.startsWith('image/')) {
    showToast('⚠️ Please upload an image file (PNG/JPG/GIF)');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    sendChatMessage('', e.target.result);
    showToast('📷 Photo posted to chat!');
    input.value = '';
  };
  reader.readAsDataURL(file);
};

// ============================================================
// AUDIENCE REACTIONS FLOAT ANIMATION
// ============================================================
function triggerAudienceReaction(emoji, type) {
  SoundEngine.playReaction(type);
  const container = document.getElementById('room-reaction-floating-area');
  if (container) {
    const span = document.createElement('span');
    span.className = 'floating-emoji';
    span.textContent = emoji;
    span.style.left = (15 + Math.random() * 70) + '%';
    container.appendChild(span);
    setTimeout(() => span.remove(), 1800);
  }

  if (type === 'tip') {
    if (!deductBalance(500)) return;
    sendSystemNotice('🪙 @' + currentUser.name + ' tipped 500 $SYND to the Live RJ Stage!');
    showToast('🪙 Tipped 500 $SYND to Live RJ Deck!');
  } else {
    showToast(emoji + ' Reaction sent to stage!');
  }
}

// ============================================================
// POWERS SHOP MODAL & REAL PURCHASE / GIFTING
// ============================================================
window.openPowersShop = () => {
  const modal = document.getElementById('powers-shop-modal');
  if (modal) modal.style.display = 'flex';
  updateBalanceUI();
};

window.closePowersShop = () => {
  const modal = document.getElementById('powers-shop-modal');
  if (modal) modal.style.display = 'none';
};

window.buyPower = (powerId) => {
  const power = POWERS_CATALOG.find(p => p.id === powerId);
  if (!power) return;

  if (power.type === 'live-gift') {
    if (!deductBalance(power.cost)) return;
    triggerLiveGiftAnimation(power.id, '@' + currentUser.name);
    showToast('🎉 Sent ' + power.name + ' to the server!');
    window.closePowersShop();
    return;
  }

  if (power.id === 'pin-alpha') {
    if (!deductBalance(power.cost)) return;
    const msg = prompt('Enter your Alpha Message to Pin at the Top of the Room:', '🚀 BUY $SYND ON PUMP.FUN - 100% LP BURNED!');
    if (msg && msg.trim()) {
      currentPinnedAlpha = '📌 ' + msg.trim() + ' (Pinned by @' + currentUser.name + ')';
      const pinText = document.getElementById('pinned-alpha-text');
      if (pinText) pinText.textContent = currentPinnedAlpha;
      sendSystemNotice('📌 @' + currentUser.name + ' pinned an Alpha Message to the top of the room!');
      showToast('📌 Alpha Message Pinned!');
    }
    window.closePowersShop();
    return;
  }

  if (userEquippedPowers.includes(powerId)) {
    showToast('⚡ Power already equipped!');
    return;
  }

  if (!deductBalance(power.cost)) {
    return;
  }

  userEquippedPowers.push(powerId);
  currentUser.powers = userEquippedPowers;
  localStorage.setItem('vice_equipped_powers', JSON.stringify(userEquippedPowers));

  if (powerId === 'name-fire') {
    currentUser.glow = 'fire';
    showToast('🔥 Fire Aura Name unlocked & equipped!');
  } else if (powerId === 'name-diamond') {
    currentUser.pawn = '💎';
    currentUser.color = 'pawn-diamond';
    currentUser.glow = 'diamond';
    showToast('💎 Diamond VIP Pawn & Shimmer unlocked!');
  } else if (powerId === 'pawn-crown') {
    currentUser.pawn = '👑';
    currentUser.color = 'pawn-main-owner';
    currentUser.rank = 'main-owner';
    showToast('👑 Gold Syndicate Crown unlocked!');
  } else if (powerId === 'glow') {
    currentUser.glow = 'rainbow';
    showToast('🌈 Miami Rainbow Glow unlocked!');
  } else if (powerId === 'bubble-neon') {
    currentUser.hasNeonBubbles = true;
    showToast('⚡ Cyber Neon Chat Bubbles activated!');
  }

  // Level Up celebration
  const newLvl = getUserLevelData(userEquippedPowers, currentUser.rank === 'main-owner');
  showToast('⭐ LEVEL UP! You reached ' + newLvl.tier + ' (LVL ' + newLvl.lvl + ')');
  sendSystemNotice('⭐ @' + currentUser.name + ' reached SYNDICATE ' + newLvl.tier.toUpperCase() + ' (LVL ' + newLvl.lvl + ')!');

  SoundEngine.playReaction('fire');
  renderPowersGrid();
  renderUsersList();
  renderMessagesFeed();
  renderRoomStageInfo();
};

window.sellBackPower = (powerId) => {
  const power = POWERS_CATALOG.find(p => p.id === powerId);
  if (!power) return;
  const idx = userEquippedPowers.indexOf(powerId);
  if (idx === -1) {
    showToast('⚠️ You do not own this power');
    return;
  }

  const buybackValue = Math.round((power.cost || 20000) * 0.6);
  userEquippedPowers.splice(idx, 1);
  localStorage.setItem('vice_equipped_powers', JSON.stringify(userEquippedPowers));

  userBalance += buybackValue;
  localStorage.setItem('vice_user_synd_balance', String(userBalance));

  // Remove effect if equipped
  if (powerId === 'name-fire' && currentUser.color === 'pawn-fire-aura') currentUser.color = 'pawn-member';
  if (powerId === 'name-diamond' && currentUser.color === 'pawn-diamond') currentUser.color = 'pawn-member';
  if (powerId === 'pawn-crown' && currentUser.pawn === '👑' && currentUser.rank !== 'main-owner') currentUser.pawn = '💎';
  if (powerId === 'glow' && currentUser.glow === 'rainbow') currentUser.glow = 'none';
  if (powerId === 'bubble-neon') currentUser.hasNeonBubbles = false;

  const newLvl = getUserLevelData(userEquippedPowers, currentUser.rank === 'main-owner');
  SoundEngine.playReaction('tip');
  showToast('💸 Sold ' + power.name + ' to Pawn Shop for +' + buybackValue.toLocaleString() + ' $SYND!');
  sendSystemNotice('💸 @' + currentUser.name + ' sold ' + power.name + ' back to Syndicate Pawn Shop (+' + buybackValue.toLocaleString() + ' $SYND)');

  renderPowersGrid();
  renderUsersList();
  renderMessagesFeed();
  updateBalanceUI();
};;

function renderPowersGrid() {
  const modalGrid = document.getElementById('powers-modal-catalog');
  const sectionGrid = document.getElementById('powers-section-catalog');

  const html = POWERS_CATALOG.map(p => {
    const isOwned = userEquippedPowers.includes(p.id) && p.type !== 'live-gift' && p.id !== 'pin-alpha';
    const isLiveGift = p.type === 'live-gift';
    const btnLabel = isOwned ? '✓ EQUIPPED' : isLiveGift ? '🎁 LAUNCH LIVE GIFT' : '⚡ UNLOCK WITH ' + p.costStr;
    const btnClass = isOwned ? 'btn-ghost' : isLiveGift ? 'btn-magenta' : 'btn-cyan';
    const buybackAmt = Math.round((p.cost || 20000) * 0.6).toLocaleString();

    return `
      <div class="card card-3d-tilt" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:2rem;">${p.icon}</span>
            <span class="status-pill" style="font-size:0.65rem;">${p.tag}</span>
          </div>
          <h3 style="font-size:1.15rem;color:#fff;font-weight:900;margin-bottom:6px;">${escHtml(p.name)}</h3>
          <p style="font-size:0.82rem;color:var(--text-dim);line-height:1.5;margin-bottom:16px;">${escHtml(p.desc)}</p>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-family:var(--font-mono);font-size:0.95rem;font-weight:900;color:var(--vault-gold);">
              ${p.costStr}
            </span>
            <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);">
              ${isLiveGift ? 'INSTANT FX' : 'PERMANENT'}
            </span>
          </div>
          <button class="btn ${btnClass} btn-sm btn-full" onclick="window.buyPower('${p.id}')">
            ${btnLabel}
          </button>
          ${isOwned ? `
            <button class="btn btn-ghost btn-sm btn-full" onclick="window.sellBackPower('${p.id}')" style="margin-top:6px;font-size:0.7rem;color:var(--neon-gold);border-color:rgba(255,215,0,0.35);">
              💸 Sell Back to Pawn Shop (+${buybackAmt} $SYND)
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (modalGrid) modalGrid.innerHTML = html;
  if (sectionGrid) sectionGrid.innerHTML = html;
}

// ============================================================
// MODAL: CREATE GAMING SERVER (FREE BASIC / UPGRADABLE)
// ============================================================
window.openCreateServerModal = () => {
  const modal = document.getElementById('create-server-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeCreateServerModal = () => {
  const modal = document.getElementById('create-server-modal');
  if (modal) modal.style.display = 'none';
};

window.handleCreateServerSubmit = (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('new-server-name');
  const topicInput = document.getElementById('new-server-topic');
  const catInput = document.getElementById('new-server-category');
  const accessInput = document.getElementById('new-server-access');
  const passInput = document.getElementById('new-server-passcode');
  const wallpaperInput = document.getElementById('new-server-wallpaper');

  if (!nameInput) return;
  const rawName = nameInput.value.trim().replace(/^#/, '');
  if (!rawName) {
    showToast('⚠️ Please enter a server name');
    return;
  }

  const serverId = 'srv-' + rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const formattedName = '#' + rawName.replace(/\s+/g, '-');
  const accessMode = accessInput ? accessInput.value : 'public';
  const isPrivate = accessMode === 'private' || accessMode === 'password';
  const passcode = (accessMode === 'password' || accessMode === 'private') && passInput ? passInput.value.trim() : '';
  const chosenWallpaper = wallpaperInput ? wallpaperInput.value : '/assets/vice_skyline_hero.jpg';

  const newServer = {
    id: serverId,
    name: formattedName,
    category: catInput ? catInput.value : 'Social Vibes',
    icon: (accessMode === 'password' ? '🔑' : accessMode === 'private' ? '🔒' : '🚀'),
    banner: chosenWallpaper,
    topic: (topicInput && topicInput.value.trim()) || 'Custom Syndicate Server • Hosted by ' + currentUser.name,
    dj: '@' + currentUser.name,
    stationId: activeStationIdx,
    station: RADIO_STATIONS[activeStationIdx].freq,
    listeners: 1,
    isOfficial: false,
    access: isPrivate ? 'private' : 'public',
    securityType: accessMode,
    passcode: passcode,
    owner: currentUser.name,
    desc: (topicInput && topicInput.value.trim()) || 'Live audio & chatroom created by ' + currentUser.name
  };

  serversList.push(newServer);
  serverMessages[serverId] = [
    {
      id: 'init_' + Date.now(),
      user: currentUser.name,
      rank: 'main-owner',
      pawn: '👑',
      color: 'pawn-main-owner',
      glow: currentUser.glow,
      hasNeonBubbles: currentUser.hasNeonBubbles,
      powers: userEquippedPowers,
      text: '👑 Welcome to my new server ' + formattedName + '! I am the Main Owner with full moderation & stage mic control.',
      mediaUrl: null,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ];

  try {
    const existing = JSON.parse(localStorage.getItem('vice_custom_servers') || '[]');
    existing.push(newServer);
    localStorage.setItem('vice_custom_servers', JSON.stringify(existing));
  } catch (_) {}

  currentUser.rank = 'main-owner';
  currentUser.pawn = '👑';
  currentUser.color = 'pawn-main-owner';

  window.closeCreateServerModal();
  renderServerTabs();
  renderServerDirectory();
  enterServer(serverId);
  showToast('🏰 Server ' + formattedName + ' deployed! You are 👑 Main Owner with full room control.');
};

// ============================================================
// MODAL: KNOCK / ACCESS REQUEST SYSTEM (OWNER/MOD APPROVAL)
// ============================================================
let pendingKnockServerId = null;

window.promptServerAccessRequest = (serverId) => {
  pendingKnockServerId = serverId;
  const server = serversList.find(s => s.id === serverId);
  const modal = document.getElementById('server-access-request-modal');
  const nameEl = document.getElementById('knock-server-name');
  const ownerEl = document.getElementById('knock-server-owner');
  const passBox = document.getElementById('visitor-passcode-box');
  const passInput = document.getElementById('visitor-room-passcode-input');

  if (nameEl && server) nameEl.textContent = server.name;
  if (ownerEl && server) ownerEl.textContent = '@' + server.owner;
  if (passInput) passInput.value = '';

  if (passBox) {
    passBox.style.display = (server && server.passcode) ? 'block' : 'none';
  }
  if (modal) modal.style.display = 'flex';
};

window.closeAccessRequestModal = () => {
  const modal = document.getElementById('server-access-request-modal');
  if (modal) modal.style.display = 'none';
  pendingKnockServerId = null;
};

window.submitRoomPasswordUnlock = () => {
  if (!pendingKnockServerId) return;
  const server = serversList.find(s => s.id === pendingKnockServerId);
  const passInput = document.getElementById('visitor-room-passcode-input');
  const enteredPass = passInput ? passInput.value.trim() : '';

  if (!server) return;
  if (!enteredPass) {
    showToast('⚠️ Please enter the room security password!');
    return;
  }

  if (server.passcode && enteredPass === server.passcode) {
    const targetId = pendingKnockServerId;
    window.closeAccessRequestModal();
    try {
      const unlocked = JSON.parse(localStorage.getItem('unlocked_servers') || '[]');
      if (!unlocked.includes(targetId)) {
        unlocked.push(targetId);
        localStorage.setItem('unlocked_servers', JSON.stringify(unlocked));
      }
    } catch (_) {}

    SoundEngine.playReaction('rocket');
    showToast('🔓 Password verified! Entering ' + server.name + '...');
    enterServer(targetId);
  } else {
    showToast('❌ Incorrect room password! Check with Room Owner @' + server.owner + ' or send a Knock.');
  }
};

let serverKnockRequests = JSON.parse(localStorage.getItem('vice_knock_requests') || '{}');

window.sendKnockRequest = () => {
  if (!pendingKnockServerId) return;
  const server = serversList.find(s => s.id === pendingKnockServerId);
  const targetId = pendingKnockServerId;
  window.closeAccessRequestModal();

  if (!server) return;
  showToast('🚪 Knock sent to Room Owner @' + server.owner + '! Waiting for approval...');
  SoundEngine.playSynthPop();

  // Record knock in room requests queue
  serverKnockRequests[targetId] = serverKnockRequests[targetId] || [];
  serverKnockRequests[targetId].push({ user: currentUser.name, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  localStorage.setItem('vice_knock_requests', JSON.stringify(serverKnockRequests));

  // If user is visiting, simulate Owner reviewing & approving
  setTimeout(() => {
    try {
      const unlocked = JSON.parse(localStorage.getItem('unlocked_servers') || '[]');
      if (!unlocked.includes(targetId)) {
        unlocked.push(targetId);
        localStorage.setItem('unlocked_servers', JSON.stringify(unlocked));
      }
    } catch (_) {}

    SoundEngine.playReaction('rocket');
    showToast('🔓 Room Owner @' + server.owner + ' APPROVED your knock! Entering room...');
    enterServer(targetId);
  }, 2200);
};

window.acceptPendingKnock = (idx = 0) => {
  const server = serversList.find(s => s.id === activeServerId);
  if (!server) return;
  const list = serverKnockRequests[server.id] || [];
  if (list.length === 0) return;
  const guest = list.splice(idx, 1)[0];
  localStorage.setItem('vice_knock_requests', JSON.stringify(serverKnockRequests));

  SoundEngine.playReaction('rocket');
  showToast('🎉 Admitted @' + guest.user + ' to your private room!');
  sendSystemNotice('🔓 Room Owner @' + currentUser.name + ' accepted knock and admitted @' + guest.user + ' to the lounge!');

  renderRoomStageInfo();
  renderRoomSettingsKnocks();
};

window.rejectPendingKnock = (idx = 0) => {
  const server = serversList.find(s => s.id === activeServerId);
  if (!server) return;
  const list = serverKnockRequests[server.id] || [];
  if (list.length === 0) return;
  const guest = list.splice(idx, 1)[0];
  localStorage.setItem('vice_knock_requests', JSON.stringify(serverKnockRequests));

  showToast('✕ Declined knock request from @' + guest.user);
  renderRoomStageInfo();
  renderRoomSettingsKnocks();
};

window.simulateVisitorKnock = () => {
  const server = serversList.find(s => s.id === activeServerId);
  if (!server) return;
  const testGuests = ['ViceRookie_88', 'NeonDrifter', 'CyberKat', 'SolSniper'];
  const guestName = testGuests[Math.floor(Math.random() * testGuests.length)];
  serverKnockRequests[server.id] = serverKnockRequests[server.id] || [];
  serverKnockRequests[server.id].push({ user: guestName, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  localStorage.setItem('vice_knock_requests', JSON.stringify(serverKnockRequests));

  SoundEngine.playSynthPop();
  showToast('🔔 Knock on door! @' + guestName + ' requested entry to your lounge!');
  renderRoomStageInfo();
  renderRoomSettingsKnocks();
};

function renderRoomSettingsKnocks() {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const listEl = document.getElementById('room-settings-knocks-list');
  if (!listEl) return;
  const list = serverKnockRequests[server.id] || [];
  if (list.length === 0) {
    listEl.innerHTML = '<span style="color:var(--text-muted);">No pending knocks. Use "🔔 Test Guest Knock" to test live visitor admissions!</span>';
  } else {
    listEl.innerHTML = list.map((k, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:#050610;padding:6px 10px;border-radius:6px;border:1px solid var(--border-subtle);margin-bottom:6px;">
        <span style="font-weight:900;color:var(--neon-cyan);">@${escHtml(k.user)} <span style="font-size:0.68rem;opacity:0.6;">(${k.time})</span></span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-cyan btn-sm" style="padding:2px 8px;font-size:0.68rem;" onclick="window.acceptPendingKnock(${i})">✓ Admit</button>
          <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:0.68rem;color:var(--neon-red);" onclick="window.rejectPendingKnock(${i})">✕</button>
        </div>
      </div>
    `).join('');
  }
}

window.copyRoomInviteLink = () => {
  const server = serversList.find(s => s.id === activeServerId) || serversList[0];
  const url = window.location.origin + window.location.pathname + '?room=' + server.id;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('📋 Room invite link copied: ' + server.name);
    }).catch(() => {
      prompt('Copy room invite link:', url);
    });
  } else {
    prompt('Copy room invite link:', url);
  }
};

// ============================================================
// MODAL: USER DOSSIER / LEVEL INSPECTION & GIFTING
// ============================================================
let activeDossierUser = null;

window.openUserDossier = (userName) => {
  activeDossierUser = userName;
  const modal = document.getElementById('user-dossier-modal');
  const nameEl = document.getElementById('dossier-username');
  const micToggleBtn = document.getElementById('dossier-mic-toggle-btn');
  const ownerSection = document.getElementById('dossier-owner-controls');
  const levelInfoEl = document.getElementById('dossier-level-info');
  const progFill = document.getElementById('dossier-level-fill');
  const powersRow = document.getElementById('dossier-powers-list');

  if (!modal || !nameEl) return;
  nameEl.textContent = userName;

  // Find target user object
  const allUsers = [...INITIAL_CHAT_USERS, currentUser];
  const targetObj = allUsers.find(u => u.name === userName) || {
    powers: userName === currentUser.name ? userEquippedPowers : [],
    rank: 'member'
  };

  const userPowers = targetObj.powers || [];
  const lvlData = getUserLevelData(userPowers, targetObj.rank === 'main-owner');

  if (levelInfoEl) {
    levelInfoEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="lvl-badge ${lvlData.badgeClass}">${lvlData.icon} LEVEL ${lvlData.lvl}</span>
        <span style="font-weight:900;color:#fff;font-size:0.85rem;">${lvlData.tier.toUpperCase()} TIER</span>
      </div>
    `;
  }

  if (progFill) {
    const pct = Math.min(100, Math.max(20, (userPowers.length * 25)));
    progFill.style.width = pct + '%';
  }

  if (powersRow) {
    if (userPowers.length === 0) {
      powersRow.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted);">No powers equipped yet. Gift them one below!</span>';
    } else {
      powersRow.innerHTML = userPowers.map(p => {
        const item = POWERS_CATALOG.find(pc => pc.id === p);
        return item ? `<span class="status-pill" style="font-size:0.68rem;">${item.icon} ${item.name}</span>` : '';
      }).join(' ');
    }
  }

  const currentServer = serversList.find(s => s.id === activeServerId);
  const isMeOwner = currentServer && currentServer.owner === currentUser.name;

  if (ownerSection) {
    ownerSection.style.display = isMeOwner ? 'block' : 'none';
  }

  if (micToggleBtn) {
    const isApproved = isUserAllowedToMic(activeServerId, userName);
    if (isApproved) {
      micToggleBtn.innerHTML = '🚫 Revoke Stage Mic Permission';
      micToggleBtn.className = 'btn btn-ghost btn-sm btn-full';
    } else {
      micToggleBtn.innerHTML = '🎙️ Grant Stage Mic Permission';
      micToggleBtn.className = 'btn btn-cyan btn-sm btn-full';
    }
  }

  modal.style.display = 'flex';
};

window.closeUserDossier = () => {
  const modal = document.getElementById('user-dossier-modal');
  if (modal) modal.style.display = 'none';
};

window.toggleUserMicAccessFromDossier = () => {
  if (!activeDossierUser) return;
  const isApproved = isUserAllowedToMic(activeServerId, activeDossierUser);
  if (isApproved) {
    revokeMicPermission(activeServerId, activeDossierUser);
  } else {
    grantMicPermission(activeServerId, activeDossierUser);
  }
  window.closeUserDossier();
  renderUsersList();
  renderRoomStageInfo();
};

window.giftPowerToDossierUser = () => {
  if (!activeDossierUser) return;
  const targetUser = activeDossierUser;
  const availablePowers = POWERS_CATALOG.filter(p => p.type !== 'live-gift');
  const powerNames = availablePowers.map((p, i) => (i + 1) + '. ' + p.name + ' (' + p.costStr + ')').join('\n');
  const choice = prompt('Choose power number to gift to @' + targetUser + ':\n\n' + powerNames, '1');
  if (!choice) return;

  const idx = parseInt(choice, 10) - 1;
  if (idx < 0 || idx >= availablePowers.length) {
    showToast('⚠️ Invalid selection');
    return;
  }

  const power = availablePowers[idx];
  if (!deductBalance(power.cost)) return;

  // Add power to target
  const targetInList = INITIAL_CHAT_USERS.find(u => u.name === targetUser);
  if (targetInList) {
    if (!targetInList.powers) targetInList.powers = [];
    if (!targetInList.powers.includes(power.id)) targetInList.powers.push(power.id);
  }

  sendSystemNotice('🎁 @' + currentUser.name + ' GIFTED ' + power.name + ' to @' + targetUser + '! (' + power.costStr + ')');
  SoundEngine.playReaction('rocket');
  showToast('🎁 Successfully gifted ' + power.name + ' to @' + targetUser + '!');
  window.closeUserDossier();
  renderUsersList();
  renderMessagesFeed();
};

window.promoteUser = (newRank) => {
  const targetName = activeDossierUser || 'User';
  sendSystemNotice('👑 ' + targetName + ' promoted to ' + newRank.toUpperCase() + ' by @' + currentUser.name);
  showToast('🛡️ Promoted ' + targetName + ' to ' + newRank);
  window.closeUserDossier();
};

window.kickUser = () => {
  const targetName = activeDossierUser || 'User';
  sendSystemNotice('👢 ' + targetName + ' was kicked by @' + currentUser.name);
  showToast('👢 Kicked ' + targetName);
  window.closeUserDossier();
};

window.tipUserHeist = () => {
  const targetName = activeDossierUser || 'User';
  if (!deductBalance(500)) return;
  SoundEngine.playReaction('tip');
  sendSystemNotice('🪙 @' + currentUser.name + ' tipped 500 $SYND to @' + targetName + '!');
  showToast('🪙 Tipped 500 $SYND to @' + targetName);
  window.closeUserDossier();
};

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.25s ease-out';
    setTimeout(() => t.remove(), 260);
  }, 2800);
}

// ============================================================
// MAIN PAGE VIEW TEMPLATE
// ============================================================
function renderAppView() {
  const root = document.getElementById('view');
  if (!root) return;

  root.innerHTML = `
    <!-- HERO SECTION -->
    <section class="hero-section" id="hero">
      <div class="container hero-container">
        <div>
          <div class="hero-badge">
            <span class="status-dot"></span> 80s MIAMI NEON UNDERGROUND EMPIRE • SOLANA SPL
          </div>
          <h1 class="hero-title">
            UNDERGROUND EMPIRE.<br>
            LIVE RJ CONCERTS.<br>
            <span class="glow-magenta">VICE SYNDICATE ($SYND)</span>
          </h1>
          <p class="hero-subtitle">
            Deploy custom gaming servers, broadcast on stage with auto-ducking music, send TikTok-style live room gifts, and flex <strong>Fire Aura &amp; Diamond VIP</strong> name powers backed by 1 Billion <strong>$SYND</strong> on Solana.
          </p>

          <div class="hero-actions">
            <a href="#servers-directory-section" class="btn btn-magenta btn-lg">
              🌐 Browse Gaming Servers
            </a>
            <a href="#vice-chat-section" class="btn btn-cyan btn-lg">
              💬 Enter Live Mega Chat
            </a>
            <a href="https://pump.fun/" target="_blank" rel="noopener" class="btn btn-gold btn-lg">
              🔥 Buy $SYND on Pump.fun ↗
            </a>
          </div>

          <div class="hero-hud-stats">
            <div class="hud-box">
              <div class="val glow-magenta">1,000,000,000</div>
              <div class="lbl">TOTAL $SYND SUPPLY</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--neon-cyan);">SERVERS LIVE</div>
              <div class="lbl">GAMING LOBBIES &amp; LOUNGES</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--vault-gold);">0% TAX</div>
              <div class="lbl">MINT &amp; FREEZE REVOKED</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--neon-green);">OWNER MIC LOCK</div>
              <div class="lbl">STAGE PERMISSION SYSTEM</div>
            </div>
          </div>
        </div>

        <!-- HERO GLAMOUR ART FRAME WITH 3D TILT -->
        <div class="hero-art-frame card-3d-tilt" id="hero-glamour-card">
          <img src="/assets/vice_glamour_hero.jpg" alt="VICE SYNDICATE 80s Miami Glamour" class="hero-art-img">
          <div class="hero-art-overlay">
            <div>
              <span class="status-pill live" style="margin-bottom:8px;">● 84.5 FM VICE FM LIVE</span>
              <h3 style="font-size:1.4rem;color:#fff;font-weight:950;letter-spacing:-0.02em;">80s MIAMI NEON EMPIRE</h3>
              <p style="font-size:0.8rem;color:var(--text-dim);font-family:var(--font-mono);">HOSTED BY @ROXYGLITCH &amp; @JAXSLICK</p>
            </div>
            <button class="btn btn-magenta btn-sm" onclick="window.location.hash='vice-chat-section'">
              ENTER SERVER 🎧
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- SERVER BROWSER / GAMING LOBBY DIRECTORY -->
    <section class="section" id="servers-directory-section">
      <div class="container">
        <div class="section-header" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;">
          <div>
            <div class="section-eyebrow">GAMING LOBBIES &amp; SYNDICATE SERVERS</div>
            <h2 class="section-title">SERVER DIRECTORY</h2>
            <p class="section-subtitle" style="margin-bottom:0;">
              Browse all online syndicate servers. Jump into open social rooms, private VIP penthouses, or live concert stages.
            </p>
          </div>
          <button class="btn btn-magenta btn-lg" onclick="window.openCreateServerModal()">
            + Deploy Custom Server 🚀
          </button>
        </div>

        <!-- FILTER TABS -->
        <div style="display:flex;gap:10px;margin:24px 0 32px;flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm server-filter-btn active" data-filter="all" onclick="window.setServerFilter('all')">
            All Servers
          </button>
          <button class="btn btn-ghost btn-sm server-filter-btn" data-filter="concerts" onclick="window.setServerFilter('concerts')">
            🎙️ Live Concerts
          </button>
          <button class="btn btn-ghost btn-sm server-filter-btn" data-filter="public" onclick="window.setServerFilter('public')">
            🔓 Open Public
          </button>
          <button class="btn btn-ghost btn-sm server-filter-btn" data-filter="private" onclick="window.setServerFilter('private')">
            🔒 Private VIP
          </button>
        </div>

        <div class="grid-4" id="servers-directory-grid"></div>
      </div>
    </section>

    <!-- ACTIVE GAMING SERVER LIVE CHAT & DEDICATED RJ STAGE -->
    <section class="section" id="vice-chat-section" style="padding-top:0;">
      <div class="container">
        <div class="section-header" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;">
          <div>
            <div class="section-eyebrow">LIVE ROOM COMMUNICATIONS</div>
            <h2 class="section-title">ACTIVE SERVER LIVE LOUNGE</h2>
            <p class="section-subtitle" style="margin-bottom:0;">
              Spacious chat feed with users on the side, Room Owner mic controls, auto-ducking radio, and TikTok live room gifts.
            </p>
          </div>

          <!-- USER IDENTITY & BALANCE CONTROLS -->
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- NICKNAME PILL -->
            <button class="user-nickname-pill" onclick="window.openNicknameModal()" title="Change Your Handle">
              <span>👤</span> <strong id="my-nickname-val">@${currentUser.name}</strong> <span>✏️</span>
            </button>

            <!-- BALANCE PILL -->
            <div class="synd-balance-pill" onclick="window.openDepositModal()" style="cursor:pointer;" title="Click to Deposit / Manage Stash">
              <span>🪙 STASH:</span>
              <strong class="user-balance-val">50,000 $SYND</strong>
            </div>

            <button class="btn btn-gold btn-sm" onclick="window.openDepositModal()">
              💰 Deposit / Stash
            </button>
          </div>
        </div>

        <div class="xat-wrap" style="position:relative;">
          <!-- FULL-SCREEN LIVE GIFT OVERLAY -->
          <div id="gift-screen-overlay" class="gift-screen-overlay"></div>

          <!-- TOP BAR: SERVER HEADER & DEDICATED IN-ROOM RJ DECK -->
          <div class="xat-header" style="flex-direction:column;align-items:stretch;gap:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <span class="xat-dj-badge">
                  🎙️ RJ ON STAGE: <span id="room-current-rj-lbl" style="font-weight:950;">@RoxyGlitch</span>
                </span>
                <div>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-weight:950;color:#fff;font-size:1.15rem;" id="room-server-title">#Vice-Central-HQ</span>
                    <span id="room-server-lock-status" class="server-access-badge public">🔓 OPEN PUBLIC</span>
                    <span id="room-server-trending-badge" class="badge badge-gold" style="display:none;font-size:0.65rem;border:1px solid var(--neon-gold);box-shadow:0 0 10px rgba(255,215,0,0.4);">
                      🔥 #1 TRENDING SPOTLIGHT
                    </span>
                    <button class="btn btn-ghost btn-sm" id="room-invite-btn" style="padding:2px 8px;font-size:0.65rem;" onclick="window.copyRoomInviteLink()" title="Copy room invite link">
                      🔗 Invite Link
                    </button>
                    <button class="btn btn-ghost btn-sm" id="room-settings-btn" style="padding:2px 8px;font-size:0.65rem;" onclick="window.openRoomSettingsModal()">
                      ⚙️ Room Settings
                    </button>
                  </div>
                  <span style="font-size:0.75rem;color:var(--text-dim);" id="room-server-topic">
                    Official Syndicate Headquarters • 24/7 Sunset FM &amp; Community Hangout
                  </span>
                </div>
              </div>

              <!-- STATION SELECTOR (EXCLUSIVE TO OWNER / MOD / DJ) -->
              <div class="xat-radio-tuner" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);font-weight:800;">TUNER:</span>
                ${RADIO_STATIONS.map((s, idx) => `
                  <button class="xat-station-btn ${idx === activeStationIdx ? 'active' : ''}" data-station="${idx}">
                    ${s.freq}
                  </button>
                `).join('')}
                <button class="btn btn-cyan btn-sm" id="sound-app-btn-tuner" onclick="window.openSoundAppModal()" style="padding:2px 8px;font-size:0.65rem;" title="Fast DJ Sound App & High-Speed Audio Streams">
                  🎵 DJ Sound App
                </button>
              </div>
            </div>

            <!-- IN-ROOM DEDICATED RJ BROADCASTER & LISTENER DECK -->
            <div style="background:rgba(4,5,11,0.7);border:1px solid var(--border-subtle);border-radius:var(--radius);padding:14px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;position:relative;overflow:hidden;">
              <div id="room-reaction-floating-area" style="position:absolute;inset:0;pointer-events:none;overflow:hidden;"></div>

              <!-- Left: Broadcaster Mic Controls & Auto-duck status -->
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <div class="rj-on-air-pill" id="room-air-status-pill">
                  <span class="status-dot"></span> OFF AIR
                </div>
                <button class="btn btn-cyan btn-sm" id="room-mic-toggle-btn" onclick="window.toggleRoomMicrophone()">
                  🎙️ Take Stage Mic
                </button>
                <div style="width:110px;" class="rj-meter-bar" title="Live Voice Level Meter">
                  <div class="rj-meter-fill" id="room-meter-fill"></div>
                </div>
                <button class="btn btn-ghost btn-sm" id="room-play-stream-btn" onclick="window.toggleRadioPlayback()">
                  ▶️ Play Room Audio
                </button>
                <button class="btn btn-cyan btn-sm" onclick="window.openSoundAppModal()" title="Fast DJ Sound App & Audio Server" style="font-size:0.75rem;padding:4px 10px;font-weight:900;">
                  🎵 DJ Sound App
                </button>
                <button class="btn btn-ghost btn-sm" onclick="window.openRjGuideModal()" title="How Stage Mic Works" style="font-size:0.72rem;padding:4px 8px;">
                  ❓ How Mic Works
                </button>
              </div>

              <!-- Right: Listener Volume & Live Reactions -->
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <button class="btn btn-ghost btn-sm" id="room-mute-btn" onclick="window.toggleRoomMute()" style="padding:4px 8px;font-size:0.75rem;">
                    🔊 Mute
                  </button>
                  <input type="range" id="room-volume-slider" min="0" max="100" value="75" oninput="window.setRoomVolume(this.value)" style="width:85px;accent-color:var(--neon-cyan);cursor:pointer;">
                  <span id="room-volume-val" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--neon-cyan);font-weight:800;">75%</span>
                </div>

                <div class="audience-reactions" style="margin-top:0;">
                  <button class="react-btn" onclick="window.triggerReaction('👏', 'applause')" title="Applause">👏</button>
                  <button class="react-btn" onclick="window.triggerReaction('💖', 'heart')" title="Love">💖</button>
                  <button class="react-btn" onclick="window.triggerReaction('🔥', 'fire')" title="Fire">🔥</button>
                  <button class="react-btn" style="background:rgba(255,184,0,0.15);border-color:var(--vault-gold);color:var(--vault-gold);" onclick="window.triggerReaction('🪙', 'tip')">
                    🪙 Tip 500 $SYND
                  </button>
                </div>
              </div>
            </div>

            <!-- LIVE DJ SOUND DECK & AUDIO VISUALIZER (FAST AUDIO, NO VIDEO CLUTTER) -->
            <div id="live-dj-audio-deck" style="display:none;background:rgba(2,3,8,0.95);border:1px solid var(--neon-cyan);box-shadow:0 0 15px rgba(0,240,255,0.25);border-radius:var(--radius);padding:10px 16px;margin-top:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div style="display:flex;align-items:center;gap:12px;">
                  <span style="font-size:1.5rem;animation:pulse 1s infinite;">📻</span>
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="display:inline-block;width:8px;height:8px;background:var(--neon-green);border-radius:50%;box-shadow:0 0 8px var(--neon-green);animation:pulse 1s infinite;"></span>
                      <span style="font-family:var(--font-mono);font-size:0.75rem;font-weight:900;color:var(--neon-cyan);text-transform:uppercase;letter-spacing:1px;">LIVE DJ AUDIO STREAM ON AIR</span>
                    </div>
                    <div id="dj-deck-track-title" style="font-size:0.85rem;color:#fff;font-weight:800;margin-top:2px;">
                      Loading DJ Audio...
                    </div>
                  </div>
                </div>
                <!-- Live Retro Dancing Audio Equalizer Bars -->
                <div class="audio-equalizer-bars" title="Live Audio Output Meter">
                  <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
                  <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
                  <div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div>
                </div>
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-cyan btn-sm" onclick="window.openSoundAppModal()" style="padding:3px 10px;font-size:0.72rem;font-weight:800;">
                    🔄 Switch Track
                  </button>
                  <button class="btn btn-ghost btn-sm" onclick="window.stopDjPlayback()" style="padding:3px 10px;font-size:0.72rem;color:var(--neon-red);border-color:var(--neon-red);">
                    ⏹️ Stop DJ &amp; Return to FM
                  </button>
                </div>
              </div>
              <!-- Embedded Player Container for YouTube / SoundCloud -->
              <div id="dj-embed-player-container" style="display:none;margin-top:10px;background:#050711;border:1px solid rgba(0,240,255,0.3);border-radius:8px;padding:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--neon-cyan);font-weight:800;">
                    📺 STAGE MEDIA MONITOR (YOUTUBE / SOUNDCLOUD LIVE DECK)
                  </span>
                  <span style="font-size:0.65rem;color:var(--neon-green);font-weight:900;">● BROADCASTING</span>
                </div>
                <div id="dj-embed-player-slot" style="width:100%;max-width:540px;margin:0 auto;border-radius:6px;overflow:hidden;"></div>
              </div>
            </div>
          </div>

          <!-- ROOM OWNER PENDING KNOCKS BANNER -->
          <div id="room-owner-knocks-bar" class="room-knocks-bar" style="display:none;background:rgba(255,46,147,0.18);border:1px solid var(--neon-magenta);padding:8px 14px;border-radius:6px;margin-bottom:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.15rem;animation:pulse 1.5s infinite;">🚪</span>
              <span style="font-size:0.8rem;color:#fff;font-weight:800;">
                PENDING GUEST KNOCK: <span id="knock-request-username" style="color:var(--neon-cyan);font-weight:900;">@GuestUser</span> wants to enter your private lounge!
              </span>
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-cyan btn-sm" onclick="window.acceptPendingKnock()" style="padding:3px 10px;font-size:0.75rem;">
                ✓ Accept &amp; Admit
              </button>
              <button class="btn btn-ghost btn-sm" onclick="window.rejectPendingKnock()" style="padding:3px 10px;font-size:0.75rem;color:var(--neon-red);border-color:var(--neon-red);">
                ✕ Decline
              </button>
            </div>
          </div>

          <!-- PINNED ALPHA BANNER -->
          <div class="pinned-alpha-bar" id="pinned-alpha-bar">
            <span id="pinned-alpha-text">🔥 Grand Syndicate HQ: 1 Billion $SYND on Solana SPL • Mint Revoked &amp; 100% LP Burned!</span>
            <button class="btn btn-ghost btn-sm" style="padding:2px 8px;font-size:0.68rem;" onclick="window.buyPower('pin-alpha')">
              📌 Pin Alpha
            </button>
          </div>

          <!-- SERVER TABS BAR -->
          <div class="xat-room-tabs-bar">
            <div id="xat-room-tabs-list" style="display:flex;gap:8px;overflow-x:auto;"></div>
            <button class="btn btn-magenta btn-sm" style="margin-left:auto;white-space:nowrap;" onclick="window.openCreateServerModal()">
              + Deploy Server
            </button>
          </div>

          <!-- MAIN CHAT STAGE (SPACIOUS FEED + USERS ON SIDE) -->
          <div class="xat-main-stage" id="xat-main-stage">
            <!-- CHAT FEED (EXPANDED SPACE) -->
            <div class="xat-chat-panel bg-overlay" style="position:relative;">
              <div class="xat-messages-feed" id="xat-messages-feed"></div>

              <!-- GIF PICKER POPUP -->
              <div class="gif-picker-pop" id="gif-picker-pop">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <span style="font-size:0.75rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
                    🎬 80s MIAMI / GTA GIF REACTIONS
                  </span>
                  <button style="background:transparent;color:var(--text-dim);cursor:pointer;font-size:0.9rem;" onclick="window.toggleGifPicker()">✕</button>
                </div>
                <div class="gif-grid">
                  ${CURATED_GIFS.map(g => `
                    <img src="${g.url}" alt="${escHtml(g.title)}" class="gif-thumb" onclick="window.sendCuratedGif('${g.url}')" title="${escHtml(g.title)}">
                  `).join('')}
                </div>
              </div>

              <!-- INPUT BAR WITH PIC & GIF BUTTONS -->
              <div class="xat-input-bar">
                <button class="xat-btn-powers" onclick="window.openPowersShop()" title="Open $SYND Chat Powers &amp; Live Gifts">
                  ⚡ POWERS &amp; GIFTS
                </button>

                <!-- GIF Button -->
                <button class="btn btn-ghost btn-sm" onclick="window.toggleGifPicker()" title="Send Animated GIF" style="padding:6px 10px;">
                  🎬 GIF
                </button>

                <!-- Image Attachment Button -->
                <label class="btn btn-ghost btn-sm" style="padding:6px 10px;cursor:pointer;margin:0;" title="Attach Photo">
                  📷 PIC
                  <input type="file" accept="image/*" style="display:none;" onchange="window.handleImageUpload(this)">
                </label>

                <input type="text" class="xat-input" id="xat-message-input" placeholder="Message the server... (Press Enter to Send)" autocomplete="off">
                <button class="btn btn-cyan btn-sm" id="xat-send-btn">
                  SEND 🚀
                </button>
              </div>
            </div>

            <!-- USERS LIST (NEATLY POSITIONED ON THE RIGHT SIDE) -->
            <div class="xat-users-panel">
              <div class="xat-users-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span>MEMBERS (<span id="xat-online-count">6</span>)</span>
                <span style="font-size:0.6rem;color:var(--neon-green);">● ACTIVE</span>
              </div>
              <div id="xat-users-list"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- $SYND CHAT & PROFILE POWERS CATALOG -->
    <section class="section" id="powers-shop-section" style="padding-top:0;">
      <div class="container">
        <div class="section-header" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;">
          <div>
            <div class="section-eyebrow">UTILITY &amp; UPGRADES</div>
            <h2 class="section-title">$SYND POWERS &amp; LIVE GIFTS</h2>
            <p class="section-subtitle" style="margin-bottom:0;">
              TikTok-style live room gifts (🚀 Rocket Blast, 🌧️ Cash Rain), Sticky Alpha Pins, and animated Flame &amp; Diamond name styles.
            </p>
          </div>

          <div class="synd-balance-pill" onclick="window.openDepositModal()" style="cursor:pointer;">
            <span>🪙 YOUR STASH:</span>
            <strong class="user-balance-val">50,000 $SYND</strong>
          </div>
        </div>

        <div class="grid-4" id="powers-section-catalog"></div>
      </div>
    </section>

    <!-- TOKEN SPECIFICATION CARD (CLEAN & MINIMAL — NO HOLDINGS BREAKDOWN) -->
    <section class="section" id="token-specs">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">OFFICIAL TOKEN TELEMETRY</div>
          <h2 class="section-title">$SYND SPECIFICATION</h2>
          <p class="section-subtitle">
            Strict Solana SPL token architecture. Pre-launch configuration with verified security revokes and zero transaction tax.
          </p>
        </div>

        <div class="card card-3d-tilt" style="max-width:880px;margin:0 auto;padding:36px;border:2px solid var(--neon-cyan);box-shadow:0 0 30px var(--cyan-glow);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;border-bottom:1px solid var(--border-subtle);padding-bottom:20px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <img src="/logo.svg" alt="$SYND Logo" width="52" height="52">
              <div>
                <h3 style="font-size:1.4rem;font-weight:950;color:#fff;">${escHtml(TOKEN_CONFIG.name)} (${escHtml(TOKEN_CONFIG.ticker)})</h3>
                <span style="font-size:0.75rem;color:var(--neon-cyan);font-family:var(--font-mono);font-weight:800;">${escHtml(TOKEN_CONFIG.network)}</span>
              </div>
            </div>

            <div class="status-pill ${TOKEN_CONFIG.status === 'live' ? 'live' : ''}">
              <span class="status-dot"></span>
              ${TOKEN_CONFIG.status.toUpperCase()}
            </div>
          </div>

          <div class="grid-2" style="gap:20px;margin-bottom:28px;">
            <div class="hud-box">
              <div class="val glow-magenta">${escHtml(TOKEN_CONFIG.totalSupply)}</div>
              <div class="lbl">TOTAL SUPPLY (FIXED)</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--vault-gold);">0% / 0%</div>
              <div class="lbl">BUY TAX / SELL TAX</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--neon-green);">REVOKED</div>
              <div class="lbl">MINT &amp; FREEZE AUTHORITIES</div>
            </div>
            <div class="hud-box">
              <div class="val" style="color:var(--neon-cyan);">100% BURNED</div>
              <div class="lbl">LIQUIDITY STATUS (RAYDIUM)</div>
            </div>
          </div>

          <div style="background:#04050a;border:1px solid var(--border-subtle);padding:14px 18px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
            <div style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;">
              MINT: <span id="token-mint-val" style="color:#fff;font-weight:800;">${TOKEN_CONFIG.mintAddress || 'PRE-LAUNCH (AVAILABLE UPON PUMP.FUN LAUNCH)'}</span>
            </div>
            <button class="btn btn-ghost btn-sm" id="copy-mint-btn">
              📋 Copy Mint
            </button>
          </div>

          <div style="display:flex;gap:14px;flex-wrap:wrap;">
            <a href="https://pump.fun/" target="_blank" rel="noopener" class="btn btn-magenta btn-full" style="text-align:center;">
              🔥 View on Pump.fun Bonding Curve ↗
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- HOW IT WORKS & FAQ -->
    <section class="section" id="how-it-works" style="padding-top:0;">
      <div class="container">
        <div class="section-header">
          <div class="section-eyebrow">SYNDICATE GUIDE</div>
          <h2 class="section-title">HOW VICE SYNDICATE WORKS</h2>
          <p class="section-subtitle">
            Three simple steps to join the 80s Miami underground, host live shows, and own custom gaming servers.
          </p>
        </div>

        <div class="grid-3">
          <div class="card" style="padding:28px;">
            <div style="font-size:2.4rem;color:var(--neon-magenta);font-weight:950;margin-bottom:12px;">01</div>
            <h3 style="font-size:1.15rem;color:#fff;font-weight:900;margin-bottom:10px;">Acquire $SYND</h3>
            <p style="font-size:0.85rem;color:var(--text-dim);line-height:1.6;">
              Get $SYND on Solana SPL via Pump.fun or Raydium with 0% tax and guaranteed burned LP security.
            </p>
          </div>

          <div class="card" style="padding:28px;">
            <div style="font-size:2.4rem;color:var(--neon-cyan);font-weight:950;margin-bottom:12px;">02</div>
            <h3 style="font-size:1.15rem;color:#fff;font-weight:900;margin-bottom:10px;">Host Live Shows &amp; TikTok Gifts</h3>
            <p style="font-size:0.85rem;color:var(--text-dim);line-height:1.6;">
              Room Owners grant stage mic permission. Stream radio with auto-ducking and launch live Rocket blasts and Cash rain gifts!
            </p>
          </div>

          <div class="card" style="padding:28px;">
            <div style="font-size:2.4rem;color:var(--vault-gold);font-weight:950;margin-bottom:12px;">03</div>
            <h3 style="font-size:1.15rem;color:#fff;font-weight:900;margin-bottom:10px;">Own Custom Gaming Servers</h3>
            <p style="font-size:0.85rem;color:var(--text-dim);line-height:1.6;">
              Deploy your own servers and become the 👑 Main Owner. Set custom wallpapers, appoint moderators, and grow your syndicate empire.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer style="background:#04050b;border-top:1px solid var(--border-card);padding:48px 0 32px;">
      <div class="container" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <img src="/logo.svg" alt="VICE SYNDICATE" width="36" height="36">
            <span style="font-size:1.2rem;font-weight:950;color:#fff;">VICE<span style="color:var(--neon-magenta);">SYNDICATE</span></span>
          </div>
          <p style="font-size:0.75rem;color:var(--text-muted);max-width:440px;line-height:1.6;">
            VICE SYNDICATE ($SYND) is an original 80s Miami Vice-inspired decentralized crypto parody social audio and gaming servers network on Solana. Not affiliated with Rockstar Games or Grand Theft Auto.
          </p>
        </div>

        <div style="display:flex;gap:16px;">
          <a href="https://x.com/ViceSyndSol" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">𝕏 Twitter</a>
          <a href="https://t.me/ViceSyndSol" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">✈ Telegram</a>
          <a href="https://pump.fun/" target="_blank" rel="noopener" class="btn btn-magenta btn-sm">🔥 Pump.fun</a>
        </div>
      </div>

      <div class="container" style="border-top:1px solid var(--border-subtle);margin-top:28px;padding-top:20px;display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);">
        <span>&copy; 2026 VICE SYNDICATE. ALL RIGHTS RESERVED.</span>
        <span>SOLANA SPL NETWORK • $SYND</span>
      </div>
    </footer>

    <!-- MODAL: CHOOSE NICKNAME / HANDLE -->
    <div class="modal-backdrop" id="nickname-modal" style="display:none;">
      <div class="modal-content" style="max-width:440px;">
        <button class="modal-close" onclick="window.closeNicknameModal()">✕</button>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">👤 SET YOUR SYNDICATE HANDLE</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:18px;">
          Choose your custom username for the Grand Mega Chatroom and gaming servers.
        </p>

        <form onsubmit="window.handleNicknameSubmit(event)">
          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
              USERNAME / NICKNAME
            </label>
            <input type="text" id="nickname-input" required placeholder="e.g. TonyMontana, CyberViper" class="xat-input" style="width:100%;font-size:1.05rem;">
          </div>
          <button type="submit" class="btn btn-cyan btn-full btn-lg">
            ✓ SAVE &amp; ENTER CHAT
          </button>
        </form>
      </div>
    </div>

    <!-- MODAL: DEPOSIT & WALLET STASH HUB -->
    <div class="modal-backdrop" id="deposit-stash-modal" style="display:none;">
      <div class="modal-content" style="max-width:540px;">
        <button class="modal-close" onclick="window.closeDepositModal()">✕</button>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">💰 $SYND STASH &amp; DEPOSIT HUB</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:18px;">
          Manage your tokens to unlock powers, send TikTok gifts, and deploy gaming servers.
        </p>

        <div style="background:#050610;border:1px solid var(--border-subtle);border-radius:8px;padding:16px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-size:0.8rem;color:var(--text-muted);font-family:var(--font-mono);">CURRENT BALANCE:</span>
            <span class="user-balance-val" style="font-family:var(--font-mono);font-size:1.25rem;font-weight:950;color:var(--vault-gold);">50,000 $SYND</span>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" id="connect-wallet-btn" onclick="window.connectSolanaWallet()">
              ⚡ Connect Solana Wallet
            </button>
            <button class="btn btn-gold btn-sm" onclick="window.claimDailyStash()">
              🎁 Claim 25k Daily
            </button>
            <button class="btn btn-cyan btn-sm" onclick="window.claimFounderGrant()">
              👑 Free +100k Founder Airdrop
            </button>
          </div>
        </div>

        <!-- FOUNDER PROMO / COMMUNITY CODE FORM -->
        <form onsubmit="window.redeemPromoCode(event)" style="margin-bottom:18px;background:#090b16;padding:12px 14px;border-radius:8px;border:1px solid rgba(0,240,255,0.25);">
          <label style="display:block;font-size:0.72rem;font-weight:800;color:var(--neon-cyan);margin-bottom:4px;font-family:var(--font-mono);">
            🎁 ENTER FOUNDER PROMO CODE (Try "FOUNDER", "SYNDICATE" or "VICE80S")
          </label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="promo-code-input" placeholder="e.g. FOUNDER" class="xat-input" style="flex:1;text-transform:uppercase;font-size:0.8rem;padding:6px 10px;">
            <button type="submit" class="btn btn-magenta btn-sm">
              Claim Code
            </button>
          </div>
        </form>

        <form onsubmit="window.depositSyndTokens(event)" style="margin-bottom:20px;">
          <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
            TOP-UP / DEPOSIT $SYND TO STASH
          </label>
          <div style="display:flex;gap:8px;">
            <input type="number" id="deposit-amount-input" placeholder="e.g. 50000" min="1000" step="1000" class="xat-input" style="flex:1;">
            <button type="submit" class="btn btn-cyan btn-sm">
              + Top-up Stash
            </button>
          </div>
        </form>

        <div style="border-top:1px solid var(--border-subtle);padding-top:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <span style="font-size:0.75rem;color:var(--text-dim);">Need more tokens on Solana?</span>
          <a href="https://pump.fun/" target="_blank" rel="noopener" class="btn btn-magenta btn-sm">
            🔥 Buy $SYND on Pump.fun ↗
          </a>
        </div>
      </div>
    </div>

    <!-- MODAL: ROOM SETTINGS (BRANDING, WALLPAPERS & SOCIAL CONTROLS) -->
    <div class="modal-backdrop" id="room-settings-modal" style="display:none;">
      <div class="modal-content" style="max-width:560px;max-height:85vh;overflow-y:auto;">
        <button class="modal-close" onclick="window.closeRoomSettingsModal()">✕</button>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">⚙️ CHAT ROOM SETTINGS</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:14px;">
          Customize room branding, backdrop wallpaper, audio effects, and social chat controls!
        </p>

        <!-- 1. ROOM BRANDING & NAME (1ST TIME FREE, THEN 1,000 $SYND) -->
        <div style="background:#090b16;padding:14px;border-radius:10px;border:1px solid var(--border-subtle);margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
              🏷️ ROOM BRANDING &amp; STATUS
            </span>
            <span id="room-rename-cost-badge" class="badge badge-cyan" style="font-size:0.65rem;">
              ✨ FREE 1ST RENAME
            </span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:700;">
                Chat Room Name:
              </label>
              <input type="text" id="room-edit-name-input" class="xat-input" placeholder="#Room-Name" style="font-size:0.85rem;padding:7px 10px;width:100%;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:700;">
                Broadcast Status / Description:
              </label>
              <input type="text" id="room-edit-topic-input" class="xat-input" placeholder="Official Hangout &amp; Live RJ Deck..." style="font-size:0.85rem;padding:7px 10px;width:100%;">
            </div>
            <button class="btn btn-cyan btn-sm" onclick="window.saveRoomBrandingSettings()" style="margin-top:4px;width:100%;font-weight:900;">
              💾 Save Room Details
            </button>
          </div>
        </div>

        <!-- 2. ROOM SECURITY & ACCESS MODE (OWNER CONTROLS) -->
        <div style="background:#090b16;padding:14px;border-radius:10px;border:1px solid var(--border-subtle);margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
              🔒 ROOM SECURITY &amp; ACCESS MODE
            </span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:700;">
                Access Control Mode:
              </label>
              <select id="room-edit-access-select" class="xat-input" style="width:100%;font-size:0.82rem;padding:7px 10px;background:#050610;color:#fff;" onchange="window.handleRoomAccessModeChange(this.value)">
                <option value="public">🔓 Open Public (Anyone can enter freely)</option>
                <option value="password">🔑 Password Protected (Visitors must enter room password)</option>
                <option value="private">🚪 Knock &amp; Request Only (Owner/Mod manual approval)</option>
              </select>
            </div>
            <div id="room-edit-password-row" style="display:none;">
              <label style="font-size:0.72rem;color:var(--neon-magenta);display:block;margin-bottom:4px;font-weight:700;">
                Room Security Password / Key:
              </label>
              <input type="text" id="room-edit-password-input" class="xat-input" placeholder="e.g. 7777 or secret123" style="font-size:0.85rem;padding:7px 10px;width:100%;">
            </div>
            <button class="btn btn-magenta btn-sm" onclick="window.saveRoomSecuritySettings()" style="width:100%;font-weight:900;">
              💾 Save Security &amp; Password Settings
            </button>
          </div>
        </div>

        <!-- 2. ROOM BACKDROP WALLPAPER -->
        <div style="font-size:0.75rem;font-weight:800;color:var(--neon-cyan);font-family:var(--font-mono);margin-bottom:6px;">
          SELECT ROOM BACKDROP WALLPAPER:
        </div>
        <div class="wallpaper-selector-grid" style="margin-bottom:14px;">
          ${WALLPAPERS.map(w => `
            <div class="wallpaper-thumb" onclick="window.setRoomWallpaper('${w.url}')">
              <img src="${w.url}" alt="${w.name}">
              <div class="lbl">${w.name}</div>
            </div>
          `).join('')}
        </div>

        <!-- 3. SOCIAL CONTROLS & CHAT AMBIANCE -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:0.82rem;color:#fff;font-weight:800;">🐢 Chat Pace (Slow Mode)</div>
              <div style="font-size:0.7rem;color:var(--text-dim);">Controls messaging interval to prevent spam</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button class="btn btn-ghost btn-sm" onclick="window.setRoomSlowMode(0)" style="padding:2px 8px;font-size:0.7rem;">Off</button>
              <button class="btn btn-ghost btn-sm" onclick="window.setRoomSlowMode(5)" style="padding:2px 8px;font-size:0.7rem;">5s</button>
              <button class="btn btn-ghost btn-sm" onclick="window.setRoomSlowMode(15)" style="padding:2px 8px;font-size:0.7rem;">15s</button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">
            <div>
              <div style="font-size:0.82rem;color:#fff;font-weight:800;">🔊 Message Sound Chime</div>
              <div style="font-size:0.7rem;color:var(--text-dim);">Plays an 80s synth chirp when new messages arrive</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="room-sfx-toggle-btn" onclick="window.toggleRoomSfx()" style="padding:4px 10px;font-size:0.75rem;color:var(--neon-cyan);">
              🔊 Active
            </button>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.06);padding-top:10px;">
            <div>
              <div style="font-size:0.82rem;color:#fff;font-weight:800;">🎙️ Stage Mic Auto-Ducking</div>
              <div style="font-size:0.7rem;color:var(--text-dim);">Radio drops to 15% volume when RJ speaks</div>
            </div>
            <span style="font-size:0.75rem;color:var(--neon-cyan);font-family:var(--font-mono);font-weight:800;background:rgba(0,240,255,0.1);padding:3px 8px;border-radius:4px;border:1px solid rgba(0,240,255,0.3);">
              ENABLED (15%)
            </span>
          </div>
        </div>

        <!-- 4. APPOINT OFFICIAL ROOM RJ / DJ -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid var(--border-subtle);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
              🎙️ APPOINT OFFICIAL ROOM RJ / MUSIC HOST
            </span>
            <span class="badge badge-magenta" id="current-rj-badge" style="font-size:0.65rem;">
              ACTIVE: @RoxyGlitch
            </span>
          </div>
          <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:10px;line-height:1.4;">
            As Room Owner, select which online member controls the station tuner and speaks on stage!
          </p>
          <div style="display:flex;gap:8px;">
            <select id="appoint-rj-select" class="xat-input" style="flex:1;font-size:0.8rem;padding:6px 8px;background:#050610;color:#fff;">
            </select>
            <button class="btn btn-cyan btn-sm" onclick="window.appointSelectedRj()">
              🎙️ Appoint RJ
            </button>
          </div>
        </div>

        <!-- 5. APPOINT ROOM MODERATORS & STAFF -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid var(--border-subtle);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
              🛡️ APPOINT ROOM MODERATORS &amp; STAFF
            </span>
          </div>
          <p style="font-size:0.75rem;color:var(--text-dim);margin-bottom:8px;line-height:1.4;">
            As Room Owner, appoint trusted members as Moderators. Mods can control radio music, use the stage mic, and admit guests!
          </p>
          <div id="room-current-mods-list" style="margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px;">
          </div>
          <div style="display:flex;gap:8px;">
            <select id="appoint-mod-select" class="xat-input" style="flex:1;font-size:0.8rem;padding:6px 8px;background:#050610;color:#fff;">
            </select>
            <button class="btn btn-cyan btn-sm" onclick="window.appointSelectedModerator()">
              🛡️ Appoint Moderator
            </button>
          </div>
        </div>

        <!-- 6. GUEST ADMISSIONS & KNOCK REQUESTS (ROOM OWNER QUEUE) -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid var(--border-subtle);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);">
              🚪 GUEST ADMISSIONS &amp; KNOCK REQUESTS
            </span>
            <button class="btn btn-ghost btn-sm" onclick="window.simulateVisitorKnock()" style="padding:2px 8px;font-size:0.65rem;color:var(--vault-gold);">
              🔔 Test Guest Knock
            </button>
          </div>
          <div id="room-settings-knocks-list" style="font-size:0.78rem;color:var(--text-dim);">
            No pending knock requests.
          </div>
        </div>

        <!-- 7. INCOMING USER REPORTS & MODERATION QUEUE -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid rgba(239,68,68,0.3);margin-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.8rem;font-weight:900;color:var(--neon-red);font-family:var(--font-mono);display:flex;align-items:center;gap:6px;">
              🚨 INCOMING REPORTS &amp; MOD QUEUE
              <span id="room-reports-count-badge" class="badge badge-magenta" style="font-size:0.62rem;display:none;">0</span>
            </span>
            <span style="font-size:0.68rem;color:var(--text-dim);">Review spam, scams &amp; abuse</span>
          </div>
          <div id="room-settings-reports-list" style="font-size:0.78rem;color:var(--text-dim);">
            No reports in queue. Chat is clean!
          </div>
        </div>

        <!-- 8. ROOM DANGER ZONE (DELETE ROOM) -->
        <div style="background:rgba(239,68,68,0.06);padding:12px 14px;border-radius:10px;border:1px solid rgba(239,68,68,0.3);margin-top:14px;">
          <div style="font-size:0.8rem;font-weight:900;color:var(--neon-red);font-family:var(--font-mono);margin-bottom:6px;">
            ⚠️ ROOM DANGER ZONE
          </div>
          <div id="room-delete-danger-zone">
            <!-- Dynamically populated by renderRoomDeleteDangerZone() -->
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: RJ SYSTEM GUIDE & PERMISSIONS -->
    <div class="modal-backdrop" id="rj-guide-modal" style="display:none;">
      <div class="modal-content" style="max-width:600px;">
        <button class="modal-close" onclick="window.closeRjGuideModal()">✕</button>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">🎙️ HOW THE STAGE MIC WORKS</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:20px;">
          Stage mic access is strictly controlled by the <strong>Room Owner (👑)</strong> so strangers cannot interrupt the music.
        </p>

        <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:24px;">
          <div style="background:#050610;padding:12px 16px;border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="font-weight:900;color:var(--neon-cyan);font-size:0.85rem;margin-bottom:4px;">
              👑 1. ROOM OWNER PERMISSION
            </div>
            <p style="font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin:0;">
              Only the <strong>Room Owner</strong> or users explicitly granted permission by the Room Owner can turn on the stage mic. Clicking on the mic sends an instant permission request to the owner.
            </p>
          </div>

          <div style="background:#050610;padding:12px 16px;border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="font-weight:900;color:var(--neon-magenta);font-size:0.85rem;margin-bottom:4px;">
              📻 2. PROFESSIONAL AUTO-DUCKING
            </div>
            <p style="font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin:0;">
              When the approved RJ turns the mic ON or speaks, background FM music automatically drops to 15% so their voice is loud and clear. When they release the mic, music smoothly ramps back up.
            </p>
          </div>

          <div style="background:#050610;padding:12px 16px;border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="font-weight:900;color:var(--vault-gold);font-size:0.85rem;margin-bottom:4px;">
              🎁 3. TIKTOK-STYLE LIVE GIFTS &amp; TIPPING
            </div>
            <p style="font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin:0;">
              Send full-screen animated 🚀 Rocket Blasts, 🌧️ Cash Rain, and tip 500 $SYND to the performer using your $SYND stash!
            </p>
          </div>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-cyan btn-sm" style="flex:1;" onclick="window.closeRjGuideModal(); window.openRoomSettingsModal();">
            ⚙️ Open Room Settings &amp; RJ Controls
          </button>
          <button class="btn btn-magenta btn-sm" style="flex:1;" onclick="window.closeRjGuideModal(); window.openCreateServerModal();">
            🏰 Deploy New Server Lounge
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: DJ CUSTOM MUSIC BROADCAST (OWNER / MOD / DJ) -->
    <div class="modal-backdrop" id="custom-broadcast-modal" style="display:none;">
      <div class="modal-content" style="max-width:540px;">
        <button class="modal-close" onclick="window.closeCustomBroadcastModal()">✕</button>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">📡 BROADCAST YOUR OWN MUSIC</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:16px;">
          As the <strong>👑 Room Owner, Moderator, or Appointed DJ</strong>, connect your own audio stream or local MP3 to play for all listeners in the room!
        </p>

        <!-- OPTION 1: STREAM / AUDIO URL -->
        <div style="background:#090b16;padding:14px;border-radius:10px;border:1px solid var(--border-subtle);margin-bottom:14px;">
          <div style="font-size:0.78rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);margin-bottom:8px;">
            OPTION 1: CONNECT LIVE AUDIO STREAM / URL
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input type="url" id="custom-stream-url-input" class="xat-input" placeholder="e.g. https://my-radio-stream.com/live.mp3" style="font-size:0.82rem;padding:7px 10px;width:100%;">
            <input type="text" id="custom-stream-title-input" class="xat-input" placeholder="Broadcast Title (e.g. DJ Live Midnight Mix)" style="font-size:0.82rem;padding:7px 10px;width:100%;">
            <button class="btn btn-cyan btn-sm" onclick="window.submitCustomAudioUrl()" style="font-weight:900;">
              📡 Connect &amp; Broadcast Stream
            </button>
          </div>
        </div>

        <!-- OPTION 2: UPLOAD LOCAL AUDIO FILE (MP3 / WAV) -->
        <div style="background:#090b16;padding:14px;border-radius:10px;border:1px solid var(--border-subtle);">
          <div style="font-size:0.78rem;font-weight:900;color:var(--neon-magenta);font-family:var(--font-mono);margin-bottom:8px;">
            OPTION 2: UPLOAD &amp; PLAY LOCAL AUDIO FILE (MP3 / WAV)
          </div>
          <p style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">
            Select an MP3 from your device to broadcast live to all room listeners!
          </p>
          <input type="file" id="custom-audio-file-input" accept="audio/*" class="xat-input" style="font-size:0.78rem;padding:6px;width:100%;margin-bottom:8px;" onchange="window.handleAudioFileSelected(event)">
        </div>
      </div>
    </div>

    <!-- MODAL: HIGH-SPEED DJ SOUND APP & AUDIO SERVER -->
    <div class="modal-backdrop" id="sound-app-modal" style="display:none;">
      <div class="modal-content" style="max-width:560px;">
        <button class="modal-close" onclick="window.closeSoundAppModal()">✕</button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:1.8rem;">🎵</span>
          <div>
            <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin:0;">DJ SOUND APP &amp; AUDIO SERVER</h3>
            <span style="font-size:0.75rem;color:var(--neon-cyan);font-family:var(--font-mono);font-weight:700;">FAST 320KBPS LIVE AUDIO ENGINE • 0 VIDEO DELAY</span>
          </div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:16px;">
          Select from our 1-click ultra-fast sound presets, connect any audio stream, or upload local MP3s. Audio plays instantly without video lag!
        </p>

        <!-- 1-CLICK POPULAR RETRO AUDIO PRESETS -->
        <div style="background:#060812;padding:12px 14px;border-radius:10px;border:1px solid rgba(0,240,255,0.3);margin-bottom:14px;">
          <div style="font-size:0.75rem;font-weight:900;color:var(--vault-gold);font-family:var(--font-mono);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>⚡ 1-CLICK HIGH-SPEED AUDIO TRACKS:</span>
            <span style="font-size:0.65rem;color:var(--neon-green);font-weight:800;">INSTANT SOUND</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('kavinsky')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(0,240,255,0.3);">
              <span>🚗</span> Kavinsky - Nightcall
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('miami-nights')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(255,46,147,0.3);">
              <span>🌴</span> Miami Nights 1984
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('scarface')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(255,184,0,0.3);">
              <span>🔥</span> Scarface - Push It
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('vice-city')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(0,240,255,0.3);">
              <span>🔫</span> GTA Vice City Theme
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('mj-groove')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(255,46,147,0.3);">
              <span>🕺</span> MJ - Billie Jean
            </button>
            <button class="btn btn-ghost btn-sm" onclick="window.playPresetAudio('weeknd')" style="text-align:left;padding:7px 10px;font-size:0.74rem;display:flex;align-items:center;gap:6px;border-color:rgba(255,184,0,0.3);">
              <span>⚡</span> The Weeknd - Blinding
            </button>
          </div>
        </div>

        <!-- OPTION 2: CONNECT YOUTUBE, STREAM OR AUDIO LINK -->
        <div style="background:#090b16;padding:14px;border-radius:10px;border:1px solid var(--border-subtle);margin-bottom:14px;">
          <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
            CONNECT YOUTUBE, STREAM OR AUDIO LINK:
          </label>
          <input type="text" id="sound-app-url-input" class="xat-input" placeholder="Paste YouTube link (youtube.com/watch?v=...) or MP3 stream URL" style="font-size:0.82rem;padding:8px 10px;width:100%;margin-bottom:8px;">
          <input type="text" id="sound-app-title-input" class="xat-input" placeholder="Track / DJ Mix Title (e.g. Miami Midnight Live)" style="font-size:0.82rem;padding:8px 10px;width:100%;margin-bottom:10px;">
          <button class="btn btn-cyan btn-sm" onclick="window.submitCustomSoundUrl()" style="width:100%;font-weight:900;padding:8px;">
            ▶️ Stream Audio To Room
          </button>
        </div>

        <!-- OPTION 3: UPLOAD LOCAL AUDIO FILE (MP3 / WAV) -->
        <div style="background:#090b16;padding:12px 14px;border-radius:10px;border:1px solid var(--border-subtle);">
          <div style="font-size:0.75rem;font-weight:800;color:var(--neon-magenta);font-family:var(--font-mono);margin-bottom:6px;">
            📁 BROADCAST LOCAL MP3 FILE FROM DEVICE:
          </div>
          <input type="file" accept="audio/*" class="xat-input" style="font-size:0.75rem;padding:6px;width:100%;" onchange="window.handleSoundAppLocalFile(event)">
        </div>
      </div>
    </div>

    <!-- MODAL: DEPLOY CUSTOM GAMING SERVER (FREE BASIC / UPGRADABLE) -->
    <div class="modal-backdrop" id="create-server-modal" style="display:none;">
      <div class="modal-content">
        <button class="modal-close" onclick="window.closeCreateServerModal()">✕</button>
        <h3 style="font-size:1.3rem;color:#fff;font-weight:950;margin-bottom:8px;">👑 DEPLOY GAMING SERVER</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:20px;">
          Deploy a free basic server! You will be the <strong>👑 Main Owner</strong> with stage mic control and custom wallpaper choices.
        </p>

        <form onsubmit="window.handleCreateServerSubmit(event)">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
              SERVER NAME (E.G. Miami-Speedway)
            </label>
            <input type="text" id="new-server-name" required placeholder="Miami-Nights" class="xat-input" style="width:100%;">
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
                CATEGORY
              </label>
              <select id="new-server-category" class="xat-input" style="width:100%;">
                <option value="Social & Vibes">💬 Social &amp; Vibes</option>
                <option value="Live RJ Concert">🎙️ Live RJ Concert</option>
                <option value="Solana Degen">🚀 Solana Degen Alpha</option>
                <option value="Private VIP Club">👑 Private VIP Club</option>
              </select>
            </div>

            <div>
              <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
                ROOM WALLPAPER (FREE)
              </label>
              <select id="new-server-wallpaper" class="xat-input" style="width:100%;">
                <option value="/assets/vice_skyline_hero.jpg">🌴 Miami Skyline</option>
                <option value="/assets/gta6_neon_club.jpg">🎙️ Neon Club</option>
                <option value="/assets/gta6_villa_mansion.jpg">🏰 Villa Mansion</option>
                <option value="/assets/vice_glamour_hero.jpg">💖 Glamour Noir</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
                ACCESS MODE
              </label>
              <select id="new-server-access" class="xat-input" style="width:100%;" onchange="document.getElementById('passcode-row').style.display = (this.value === 'password' || this.value === 'private') ? 'block' : 'none';">
                <option value="public">🔓 Open Public</option>
                <option value="password">🔑 Password Protected</option>
                <option value="private">🚪 Knock &amp; Request Only</option>
              </select>
            </div>
            <div id="passcode-row" style="display:none;">
              <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-magenta);margin-bottom:6px;font-family:var(--font-mono);">
                ROOM PASSWORD / KEY
              </label>
              <input type="text" id="new-server-passcode" placeholder="e.g. 7777 or secret" class="xat-input" style="width:100%;">
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
              SERVER TOPIC &amp; WELCOME MESSAGE
            </label>
            <input type="text" id="new-server-topic" placeholder="Underground chat, music, and Solana friendship" class="xat-input" style="width:100%;">
          </div>

          <button type="submit" class="btn btn-magenta btn-full btn-lg">
            🏰 DEPLOY SERVER &amp; CLAIM OWNERSHIP
          </button>
        </form>
      </div>
    </div>

    <!-- MODAL: REQUEST ENTRY (PASSWORD & KNOCK SYSTEM FOR PRIVATE ROOMS) -->
    <div class="modal-backdrop" id="server-access-request-modal" style="display:none;">
      <div class="modal-content" style="max-width:480px;text-align:center;">
        <button class="modal-close" onclick="window.closeAccessRequestModal()">✕</button>
        <div style="font-size:2.8rem;margin-bottom:8px;">🔒</div>
        <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin-bottom:6px;">VIP PROTECTED LOUNGE</h3>
        <p style="font-size:0.82rem;color:var(--text-dim);margin-bottom:14px;">
          This lounge is protected by <strong>👑 Room Owner</strong> security settings.
        </p>

        <div style="background:#050610;padding:12px 14px;border-radius:8px;border:1px solid var(--border-subtle);margin-bottom:18px;text-align:left;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">ROOM:</span>
            <span id="knock-server-name" style="font-weight:900;color:#fff;">#Private-Lounge</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">ROOM OWNER:</span>
            <span id="knock-server-owner" style="font-weight:900;color:var(--neon-magenta);">@blacksheep</span>
          </div>
        </div>

        <!-- OPTION 1: PASSWORD UNLOCK (IF ROOM HAS PASSWORD) -->
        <div id="visitor-passcode-box" style="display:none;background:#090b16;padding:14px;border-radius:8px;border:1px solid rgba(0,240,255,0.3);margin-bottom:14px;text-align:left;">
          <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:6px;font-family:var(--font-mono);">
            🔑 ENTER ROOM PASSWORD:
          </label>
          <div style="display:flex;gap:8px;">
            <input type="password" id="visitor-room-passcode-input" placeholder="Enter room password..." class="xat-input" style="flex:1;font-size:0.82rem;padding:7px 10px;">
            <button class="btn btn-cyan btn-sm" onclick="window.submitRoomPasswordUnlock()">
              🔓 Enter Room
            </button>
          </div>
        </div>

        <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">
          Don't have the password or invite key?
        </div>

        <button class="btn btn-magenta btn-full btn-lg" onclick="window.sendKnockRequest()">
          🚪 Knock &amp; Request Entry from Owner
        </button>
      </div>
    </div>

    <!-- MODAL: POWERS SHOP -->
    <div class="modal-backdrop" id="powers-shop-modal" style="display:none;">
      <div class="modal-content" style="max-width:880px;max-height:85vh;overflow-y:auto;">
        <button class="modal-close" onclick="window.closePowersShop()">✕</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="font-size:1.4rem;color:#fff;font-weight:950;margin-bottom:4px;">⚡ $SYND POWERS &amp; LIVE GIFTS</h3>
            <p style="font-size:0.8rem;color:var(--text-dim);">
              Use your $SYND stash to send TikTok-style live gifts, pin messages, and unlock name styles.
            </p>
          </div>
          <div class="synd-balance-pill" onclick="window.openDepositModal()" style="cursor:pointer;">
            <span>🪙 YOUR STASH:</span>
            <strong class="user-balance-val">50,000 $SYND</strong>
          </div>
        </div>
        <div class="grid-2" id="powers-modal-catalog"></div>
      </div>
    </div>

    <!-- MODAL: USER DOSSIER / LEVEL INSPECTION & GIFTING -->
    <div class="modal-backdrop" id="user-dossier-modal" style="display:none;">
      <div class="modal-content">
        <button class="modal-close" onclick="window.closeUserDossier()">✕</button>
        <h3 style="font-size:1.3rem;color:#fff;font-weight:950;margin-bottom:4px;">👤 SYNDICATE PROFILE</h3>
        <div style="font-family:var(--font-mono);font-size:1.15rem;color:var(--neon-cyan);font-weight:900;margin-bottom:10px;" id="dossier-username">
          User
        </div>

        <!-- LEVEL & PROGRESS -->
        <div class="level-prog-wrap" id="dossier-level-box">
          <div id="dossier-level-info"></div>
          <div class="level-prog-bar">
            <div class="level-prog-fill" id="dossier-level-fill" style="width:60%;"></div>
          </div>
        </div>

        <!-- EQUIPPED POWERS -->
        <div style="margin-bottom:14px;">
          <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);font-weight:800;margin-bottom:6px;">
            EQUIPPED POWERS &amp; BADGES:
          </div>
          <div id="dossier-powers-list" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
        </div>

        <!-- ROOM OWNER SPECIAL CONTROLS -->
        <div id="dossier-owner-controls" style="background:#050610;border:1px solid var(--neon-cyan);padding:14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:0.75rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);margin-bottom:8px;">
            👑 ROOM OWNER CONTROLS:
          </div>
          <button id="dossier-mic-toggle-btn" class="btn btn-cyan btn-sm btn-full" onclick="window.toggleUserMicAccessFromDossier()">
            🎙️ Grant Stage Mic Permission
          </button>
        </div>

        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;font-family:var(--font-mono);font-weight:800;margin-bottom:10px;">
          INTERACTIONS &amp; GIFTING:
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-magenta btn-sm" onclick="window.giftPowerToDossierUser()">
            🎁 Gift a $SYND Power to this User
          </button>
          <button class="btn btn-gold btn-sm" onclick="window.tipUserHeist()">
            🪙 Tip 500 $SYND to this User
          </button>
          <button class="btn btn-cyan btn-sm" onclick="window.promoteUser('mod')">
            🛡️ Promote to Moderator (⚪)
          </button>
          <button class="btn btn-ghost btn-sm" style="color:var(--neon-red);border-color:var(--neon-red);" onclick="window.kickUser()">
            👢 Kick User from Server
          </button>
          <button class="btn btn-ghost btn-sm" style="color:var(--neon-red);border-color:rgba(239,68,68,0.4);font-size:0.75rem;" onclick="window.openReportModal(activeDossierUser)">
            🚩 Report User to Owner &amp; Moderation
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: REPORT USER / SPAM MESSAGE (DIRECT DISPATCH TO OWNER) -->
    <div class="modal-backdrop" id="report-user-modal" style="display:none;">
      <div class="modal-content" style="max-width:480px;">
        <button class="modal-close" onclick="window.closeReportModal()">✕</button>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:1.8rem;">🚨</span>
          <div>
            <h3 style="font-size:1.3rem;color:#fff;font-weight:950;margin:0;">SUBMIT COMMUNITY REPORT</h3>
            <span style="font-size:0.72rem;color:var(--neon-red);font-family:var(--font-mono);font-weight:700;">DIRECT DISPATCH TO OWNER &amp; MODERATORS</span>
          </div>
        </div>
        <p style="font-size:0.78rem;color:var(--text-dim);margin-bottom:14px;">
          Reports are sent directly to Grand Owner <strong>@blacksheep</strong> and Room Moderators for immediate review and enforcement.
        </p>

        <div style="background:#050610;padding:12px 14px;border-radius:8px;border:1px solid var(--border-subtle);margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">REPORTING SUSPECT:</span>
            <strong id="report-target-username" style="color:var(--neon-cyan);font-family:var(--font-mono);">@TargetUser</strong>
          </div>
          <div id="report-context-preview" style="display:none;background:rgba(0,0,0,0.4);padding:8px 10px;border-radius:6px;border-left:3px solid var(--neon-magenta);margin-top:6px;font-size:0.75rem;color:#fff;font-style:italic;"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
          <div>
            <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:4px;font-family:var(--font-mono);">
              SELECT VIOLATION REASON:
            </label>
            <select id="report-reason-select" class="xat-input" style="width:100%;font-size:0.82rem;padding:8px 10px;background:#050610;color:#fff;">
              <option value="Spam / Commercial Ads">📢 Spamming / Unsolicited Promotion</option>
              <option value="Harassment / Abusive Speech">🤬 Harassment / Abusive Conduct</option>
              <option value="Phishing / Malicious Links">🎣 Phishing / Fake Links / Drainer</option>
              <option value="Impersonating Owner or Staff">🎭 Impersonating Owner or Moderator</option>
              <option value="Inappropriate Content">⚠️ NSFW / Inappropriate Media</option>
              <option value="Other Rule Violation">⚖️ Other Syndicate Rule Violation</option>
            </select>
          </div>

          <div>
            <label style="display:block;font-size:0.75rem;font-weight:800;color:var(--neon-cyan);margin-bottom:4px;font-family:var(--font-mono);">
              ADDITIONAL DETAILS / EVIDENCE (OPTIONAL):
            </label>
            <textarea id="report-notes-input" class="xat-input" rows="2" placeholder="Describe what happened..." style="width:100%;font-size:0.8rem;padding:8px 10px;resize:none;"></textarea>
          </div>
        </div>

        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost btn-sm" onclick="window.closeReportModal()" style="flex:1;">
            Cancel
          </button>
          <button class="btn btn-magenta btn-sm" onclick="window.submitUserReport()" style="flex:2;font-weight:900;">
            🚨 Submit Report to Owner
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL: WEB3 SOLANA WALLET & SYNDICATE ACCESS -->
    <div class="modal-backdrop" id="owner-auth-modal" style="display:none;">
      <div class="modal-content" style="max-width:480px;">
        <button class="modal-close" onclick="window.closeOwnerAuthModal()">✕</button>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <span style="font-size:2rem;">🟣</span>
          <div>
            <h3 style="font-size:1.35rem;color:#fff;font-weight:950;margin:0;">SOLANA WEB3 WALLET</h3>
            <span style="font-size:0.72rem;color:var(--neon-cyan);font-family:var(--font-mono);font-weight:800;">DECENTRALIZED SYNDICATE NETWORK • SPL TOKEN</span>
          </div>
        </div>
        <p style="font-size:0.8rem;color:var(--text-dim);margin-bottom:16px;">
          Connect your Solana wallet to verify your $SYND stash, unlock VIP powers, and claim on-chain status.
        </p>

        <!-- METHOD 1: SOLANA WALLET CONNECT (PRIMARY FOR ALL USERS) -->
        <div style="background:#090b16;padding:16px;border-radius:10px;border:1px solid rgba(0,240,255,0.3);margin-bottom:14px;">
          <div style="font-size:0.78rem;font-weight:900;color:var(--neon-cyan);font-family:var(--font-mono);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <span>🟣 SOLANA WALLET PROVIDERS</span>
            <span class="badge badge-cyan" style="font-size:0.62rem;">AUTO VERIFY</span>
          </div>
          <p style="font-size:0.74rem;color:var(--text-dim);margin-bottom:12px;">
            One-click connection with Phantom or Solflare browser extensions:
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn btn-cyan btn-full btn-sm" onclick="window.handleSolanaWalletConnect()" style="font-weight:900;padding:10px;display:flex;justify-content:center;align-items:center;gap:8px;font-size:0.85rem;">
              <span>🟣</span> Connect Phantom / Solflare Wallet
            </button>
          </div>
        </div>

        <!-- METHOD 2: SYNDICATE SECRET PASSKEY (DISCRETE FOUNDER / STAFF PORTAL) -->
        <div style="background:#060812;padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.75rem;font-weight:800;color:var(--text-dim);font-family:var(--font-mono);">
              🔑 SYNDICATE ACCESS KEY / PASSKEY
            </span>
            <span style="font-size:0.65rem;color:var(--vault-gold);font-family:var(--font-mono);">STUDIO RESTORE</span>
          </div>
          <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">
            Enter your secret key or founder passkey to restore permissions across browsers:
          </p>
          <div style="display:flex;gap:8px;">
            <input type="password" id="owner-master-passkey-input" class="xat-input" placeholder="Enter secret passkey (optional)..." style="flex:1;font-size:0.82rem;padding:7px 10px;">
            <button class="btn btn-gold btn-sm" onclick="window.handleOwnerPasskeyLogin()" style="font-weight:900;padding:7px 12px;">
              Verify Key
            </button>
          </div>
        </div>

        <!-- CURRENT STATUS SUMMARY -->
        <div style="margin-top:14px;padding:8px 12px;background:#050610;border-radius:6px;border:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.72rem;color:var(--text-dim);">Active Session:</span>
          <span style="font-size:0.78rem;font-weight:900;color:var(--vault-gold);font-family:var(--font-mono);" id="owner-modal-current-user">
            @${currentUser.name}
          </span>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  bindEventListeners();
  renderServerTabs();
  renderServerDirectory();
  renderRoomStageInfo();
  renderMessagesFeed();
  renderUsersList();
  renderPowersGrid();
  updateStationUI();
  updateRadioPlayUI();
  updateBalanceUI();

  // Deep Link Room or Studio Console from URL (e.g. ?room=srv-neon-club or ?studio=1)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const deepRoom = urlParams.get('room');
    if (deepRoom && serversList.find(s => s.id === deepRoom)) {
      setTimeout(() => attemptEnterServer(deepRoom), 300);
    }
    if (urlParams.get('studio') || urlParams.get('admin')) {
      setTimeout(() => window.openWalletModal(), 400);
    }
  } catch (_) {}
}

function bindEventListeners() {
  // Discrete Studio / Founder Portal Shortcut (Ctrl+Shift+O / Cmd+Shift+O)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      window.openWalletModal();
      showToast('👑 Syndicate Studio Console Opened');
    }
  });

  // Discrete 3-Click on Brand Logo
  const brandLogos = document.querySelectorAll('.brand-logo, .brand');
  let logoClicks = 0;
  brandLogos.forEach(b => {
    b.addEventListener('click', () => {
      logoClicks++;
      if (logoClicks >= 3) {
        logoClicks = 0;
        window.openWalletModal();
      }
      setTimeout(() => { logoClicks = 0; }, 2000);
    });
  });

  // Radio Play/Stop
  const playBtn = document.getElementById('room-play-stream-btn');
  if (playBtn) playBtn.addEventListener('click', toggleRadioPlayback);

  // Navbar Quick Audio Toggle
  const navAudio = document.getElementById('audio-toggle-btn');
  if (navAudio) navAudio.addEventListener('click', toggleRadioPlayback);

  // Mic Toggle
  const micBtn = document.getElementById('room-mic-toggle-btn');
  if (micBtn) micBtn.addEventListener('click', toggleRoomMicrophone);

  // Volume Slider
  const slider = document.getElementById('room-volume-slider');
  if (slider) slider.addEventListener('input', (e) => SoundEngine.setVolume(parseInt(e.target.value, 10)));

  // Mute Button
  const muteBtn = document.getElementById('room-mute-btn');
  if (muteBtn) muteBtn.addEventListener('click', () => SoundEngine.toggleMute());

  // Radio Station Tuner buttons (Controlled exclusively by RJ / Owner)
  document.querySelectorAll('.xat-station-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-station'), 10);
      const server = serversList.find(s => s.id === activeServerId) || serversList[0];
      const isAllowed = isUserAllowedToMic(server.id, currentUser.name);
      if (isAllowed) {
        tuneStation(idx);
        server.stationId = idx;
        server.station = RADIO_STATIONS[idx].freq;
        sendSystemNotice('📻 Room RJ ' + (server.dj || '@' + server.owner) + ' tuned the station to ' + RADIO_STATIONS[idx].name + ' (' + RADIO_STATIONS[idx].freq + ')');
      } else {
        showToast('🔒 Station frequency is controlled by Room RJ ' + (server.dj || '@' + server.owner) + '!');
        window.openRjGuideModal();
      }
    });
  });

  // Chat message send
  const sendBtn = document.getElementById('xat-send-btn');
  const chatInput = document.getElementById('xat-message-input');
  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => {
      sendChatMessage(chatInput.value);
      chatInput.value = '';
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage(chatInput.value);
        chatInput.value = '';
      }
    });
  }

  // Copy Mint Button
  const copyBtn = document.getElementById('copy-mint-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const mint = TOKEN_CONFIG.mintAddress || 'PRE-LAUNCH';
      navigator.clipboard.writeText(mint).then(() => {
        showToast('📋 Mint address copied!');
      }).catch(() => {
        showToast('📋 Mint: ' + mint);
      });
    });
  }

  // Mobile menu toggle
  const menuToggle = document.getElementById('nav-toggle-btn');
  const navMenu = document.getElementById('nav-menu');
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
  }

  // Smooth scroll links
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-scroll');
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      if (navMenu) navMenu.classList.remove('open');
    });
  });

  // Global reaction trigger wrapper
  window.triggerReaction = (emoji, type) => triggerAudienceReaction(emoji, type);
}

// Initialize on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAppView);
} else {
  renderAppView();
}
