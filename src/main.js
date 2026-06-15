import { Renderer } from './engine/Renderer.js';
import { Physics } from './engine/Physics.js';
import { Input } from './engine/Input.js';
import { AudioSynth } from './audio/AudioSynth.js';
import { Network } from './net/Network.js';
import { ArenaMap } from './game/Map.js';
import { LocalPlayer, RemotePlayer } from './game/Player.js';
import { WeaponView } from './game/Weapon.js';
import { ProjectileManager } from './game/Projectile.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const death = document.getElementById('death');
const playBtn = document.getElementById('playBtn');
const respawnBtn = document.getElementById('respawnBtn');
const nameInput = document.getElementById('nameInput');
const hpFill = document.getElementById('hpFill');
const enFill = document.getElementById('enFill');
const ammoEl = document.getElementById('ammo');
const weaponNameEl = document.getElementById('weaponName');
const scoreboardEl = document.getElementById('scoreboard');
const messageEl = document.getElementById('message');
const focusOverlay = document.getElementById('focusOverlay');
const killerText = document.getElementById('killerText');
const menuError = document.getElementById('menuError');

const renderer = new Renderer(canvas);
const physics = new Physics();
const input = new Input();
const audio = new AudioSynth();
const network = new Network();

const map = new ArenaMap(renderer.scene);
physics.addMap(map);

const projectiles = new ProjectileManager(renderer.scene, null);
let localPlayer = null;
let weaponView = null;
const remotePlayers = new Map();

let lastTime = performance.now();
let gameRunning = false;
let messageTimer = 0;
let connectingTimer = null;
const SERVER_URL = import.meta.env?.VITE_SERVER_URL || window.location.origin;

// Show configured backend so users can verify VITE_SERVER_URL was baked in
menuError.innerHTML = `Backend: <code>${SERVER_URL}</code>`;

function showScreen(el) {
  menu.classList.remove('active');
  hud.classList.remove('active');
  death.classList.remove('active');
  el.classList.add('active');
}

function showMessage(text, duration = 2) {
  messageEl.textContent = text;
  messageEl.classList.add('show');
  messageTimer = duration;
}

function updateHUD(dt) {
  if (!localPlayer) return;
  hpFill.style.width = `${(localPlayer.health / localPlayer.maxHealth) * 100}%`;
  enFill.style.width = `${Math.max(0, localPlayer.energy)}%`;
  const w = localPlayer.currentWeapon;
  ammoEl.textContent = '∞';
  weaponNameEl.textContent = w ? w.toUpperCase() : '';

  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) messageEl.classList.remove('show');
  }

  if (localPlayer.focusActive) {
    focusOverlay.classList.add('active');
  } else {
    focusOverlay.classList.remove('active');
  }
}

function updateScoreboard(snapshot) {
  const rows = snapshot.players
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((p) => {
      const me = p.id === network.id ? ' me' : '';
      return `<div class="row${me}"><span>${p.name}</span><span>${p.score}/${p.deaths}</span></div>`;
    })
    .join('');
  scoreboardEl.innerHTML = `<h3>SCOREBOARD</h3>${rows}`;
}

function createRemotePlayer(data) {
  const rp = new RemotePlayer(renderer.scene, physics, data.id, data.name);
  remotePlayers.set(data.id, rp);
  if (localPlayer) localPlayer.remotePlayers = remotePlayers;
  return rp;
}

network.on('joined', (data) => {
  localPlayer = new LocalPlayer(renderer, physics, input, audio, projectiles, network);
  localPlayer.setName(nameInput.value.trim() || 'Player');
  localPlayer.spawn(data.x, data.y, data.z);
  localPlayer.remotePlayers = remotePlayers;
  projectiles.localPlayerId = network.id;

  weaponView = new WeaponView(renderer.camera, renderer.scene);
  weaponView.setWeapon('pistol');

  showScreen(hud);
  input.requestPointerLock(canvas);
  audio.ensure();
  gameRunning = true;
});

network.on('snapshot', (data) => {
  for (const p of data.players) {
    if (p.id === network.id) {
      // Server authority: apply health/score/deaths, but keep local position authoritative for now
      if (localPlayer) {
        localPlayer.health = p.health;
        localPlayer.score = p.score;
        localPlayer.deaths = p.deaths;
        localPlayer.energy = p.energy;
        if (!p.alive && localPlayer.alive) {
          localPlayer.alive = false;
          localPlayer.deaths = p.deaths;
          showScreen(death);
          input.exitPointerLock();
        }
        if (localPlayer.currentWeapon !== p.weapon) {
          localPlayer.currentWeapon = p.weapon;
          weaponView?.setWeapon(p.weapon);
        }
      }
      continue;
    }

    let rp = remotePlayers.get(p.id);
    if (!rp && p.alive) rp = createRemotePlayer(p);
    if (rp) rp.setState(p);
  }

  // Remove remote players that left
  const ids = new Set(data.players.map((p) => p.id));
  for (const [id, rp] of remotePlayers) {
    if (!ids.has(id)) {
      rp.dispose();
      remotePlayers.delete(id);
    }
  }

  updateScoreboard(data);
});

network.on('shoot', (data) => {
  if (data.weapon === 'rocket') {
    projectiles.spawnRocket(data.origin, data.dir, data.shooter);
  } else {
    const origin = new THREE.Vector3(data.origin.x, data.origin.y, data.origin.z);
    const dir = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z);
    projectiles.spawnMuzzleFlash(origin.clone().add(dir.multiplyScalar(0.4)), 0xffffff);
  }
});

network.on('explosion', (data) => {
  projectiles.spawnExplosion(new THREE.Vector3(data.x, data.y, data.z), 6);
  audio.explosion();
});

network.on('damaged', (data) => {
  if (!localPlayer) return;
  localPlayer.takeDamage(data.damage);
  showMessage(`HIT BY ${data.from || '?'} -${data.damage}`, 1);
});

network.on('died', (data) => {
  if (!localPlayer) return;
  localPlayer.alive = false;
  showScreen(death);
  input.exitPointerLock();
  killerText.textContent = data.killer ? `Killed by ${data.killer}` : 'Self-destructed';
});

network.on('respawned', (data) => {
  if (!localPlayer) return;
  localPlayer.spawn(data.x, data.y, data.z);
  showScreen(hud);
  input.requestPointerLock(canvas);
});

network.on('kill', (data) => {
  if (data.killer === localPlayer?.name) audio.kill();
  showMessage(`${data.killer || 'Self'} eliminated ${data.victim}`, 2.5);
});

function resetMenuButton() {
  playBtn.disabled = false;
  playBtn.textContent = 'DEPLOY';
  if (connectingTimer) {
    clearTimeout(connectingTimer);
    connectingTimer = null;
  }
}

console.log('[Neon Strike] Server URL:', SERVER_URL);

playBtn.addEventListener('click', () => {
  const name = nameInput.value.trim() || 'Player';
  menuError.textContent = 'Connecting...';
  playBtn.disabled = true;
  playBtn.textContent = 'CONNECTING...';

  connectingTimer = setTimeout(() => {
    menuError.textContent = `Waking up backend at ${SERVER_URL}... (Render free tier can take 30-60s)`;
  }, 2500);

  network.connect(name);
});

network.on('joined', () => {
  resetMenuButton();
  menuError.textContent = '';
});

network.on('error', (err) => {
  resetMenuButton();
  menuError.innerHTML = `Connection failed to <code>${SERVER_URL}</code>: ${err.message}<br>Make sure VITE_SERVER_URL is set and the Render service is awake, then redeploy Vercel.`;
});

network.on('disconnected', (data) => {
  resetMenuButton();
  if (!gameRunning) {
    menuError.textContent = `Lost connection before joining (${data.reason}). Retry?`;
    return;
  }
  showMessage(`Disconnected: ${data.reason}`, 5);
  input.exitPointerLock();
});

respawnBtn.addEventListener('click', () => {
  input.requestPointerLock(canvas);
  network.sendRespawn();
});

function gameLoop() {
  requestAnimationFrame(gameLoop);

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  audio.resume();

  if (gameRunning && localPlayer) {
    physics.step(dt);
    localPlayer.update(dt);
    weaponView?.update(dt);
    projectiles.update(dt);
    for (const rp of remotePlayers.values()) rp.update(dt);

    // Send energy updates occasionally
    if (Math.random() < 0.1) {
      network.sendEnergy(localPlayer.energy);
    }
  }

  updateHUD(dt);
  renderer.render();
}

gameLoop();
