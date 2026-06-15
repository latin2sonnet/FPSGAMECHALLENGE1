import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(express.static(path.join(__dirname, '../dist')));
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
const TICK_RATE = 30;
const WORLD_BOUNDS = 60;

const players = new Map();
const projectiles = []; // server-side rockets only
let nextProjectileId = 1;

const SPAWN_POINTS = [
  { x: -22, y: 4, z: -22 },
  { x: 22, y: 4, z: -22 },
  { x: -22, y: 4, z: 22 },
  { x: 22, y: 4, z: 22 },
  { x: 0, y: 14, z: 0 },
];

function randomSpawn() {
  return SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
}

function sanitizeName(name) {
  return String(name || 'Player').trim().slice(0, 16) || 'Player';
}

function createPlayer(socket, name) {
  const spawn = randomSpawn();
  return {
    id: socket.id,
    name: sanitizeName(name),
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    qx: 0,
    qy: 0,
    qz: 0,
    qw: 1,
    health: 100,
    maxHealth: 100,
    weapon: 'pistol',
    score: 0,
    deaths: 0,
    alive: true,
    respawnAt: 0,
    energy: 0,
    lastShot: 0,
  };
}

function broadcastSnapshot() {
  const now = Date.now();
  const list = [];
  for (const p of players.values()) {
    list.push({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      qx: p.qx,
      qy: p.qy,
      qz: p.qz,
      qw: p.qw,
      health: p.health,
      weapon: p.weapon,
      score: p.score,
      deaths: p.deaths,
      alive: p.alive,
      energy: p.energy,
    });
  }

  io.emit('snapshot', {
    t: now,
    players: list,
    projectiles: projectiles.map((pr) => ({
      id: pr.id,
      x: pr.x,
      y: pr.y,
      z: pr.z,
      vx: pr.vx,
      vy: pr.vy,
      vz: pr.vz,
      owner: pr.owner,
    })),
  });
}

function respawnPlayer(p) {
  const spawn = randomSpawn();
  p.x = spawn.x;
  p.y = spawn.y;
  p.z = spawn.z;
  p.health = p.maxHealth;
  p.alive = true;
  p.energy = 0;
  io.to(p.id).emit('respawned', { x: p.x, y: p.y, z: p.z });
}

function handleDeath(victim, attackerId) {
  victim.alive = false;
  victim.deaths += 1;
  victim.respawnAt = Date.now() + 2500;

  const attacker = players.get(attackerId);
  if (attacker && attacker.id !== victim.id) {
    attacker.score += 1;
    attacker.energy = Math.min(100, attacker.energy + 25);
    io.emit('kill', {
      killer: attacker.name,
      victim: victim.name,
      weapon: attacker.weapon,
    });
  } else {
    io.emit('kill', { killer: null, victim: victim.name, weapon: 'self' });
  }

  io.to(victim.id).emit('died', {
    killer: attacker ? attacker.name : null,
  });
}

io.on('connection', (socket) => {
  socket.on('join', (data) => {
    const player = createPlayer(socket, data?.name);
    players.set(socket.id, player);
    socket.emit('joined', {
      id: player.id,
      x: player.x,
      y: player.y,
      z: player.z,
    });
    io.emit('playerList', Array.from(players.values()).map((p) => ({ id: p.id, name: p.name })));
    console.log(`[+] ${player.name} joined (${socket.id})`);
  });

  socket.on('move', (data) => {
    const p = players.get(socket.id);
    if (!p || !p.alive) return;
    if (typeof data.x === 'number') p.x = Math.max(-WORLD_BOUNDS, Math.min(WORLD_BOUNDS, data.x));
    if (typeof data.y === 'number') p.y = Math.max(-10, Math.min(60, data.y));
    if (typeof data.z === 'number') p.z = Math.max(-WORLD_BOUNDS, Math.min(WORLD_BOUNDS, data.z));
    if (data.qx !== undefined) {
      p.qx = data.qx;
      p.qy = data.qy;
      p.qz = data.qz;
      p.qw = data.qw;
    }
  });

  socket.on('weapon', (data) => {
    const p = players.get(socket.id);
    if (!p || !p.alive) return;
    if (['pistol', 'shotgun', 'rocket'].includes(data.weapon)) {
      p.weapon = data.weapon;
    }
  });

  socket.on('shoot', (data) => {
    const p = players.get(socket.id);
    if (!p || !p.alive) return;
    p.lastShot = Date.now();

    if (data.weapon === 'rocket') {
      // Spawn server-authoritative rocket
      const speed = 55;
      projectiles.push({
        id: nextProjectileId++,
        owner: p.id,
        x: data.origin.x,
        y: data.origin.y,
        z: data.origin.z,
        vx: data.dir.x * speed,
        vy: data.dir.y * speed,
        vz: data.dir.z * speed,
        born: Date.now(),
      });
      io.emit('shoot', {
        shooter: p.id,
        weapon: 'rocket',
        origin: data.origin,
        dir: data.dir,
      });
    } else {
      io.emit('shoot', {
        shooter: p.id,
        weapon: data.weapon,
        origin: data.origin,
        dir: data.dir,
      });
    }
  });

  socket.on('hit', (data) => {
    const victim = players.get(data.victimId);
    const attacker = players.get(socket.id);
    if (!victim || !attacker || !victim.alive || !attacker.alive) return;
    if (victim.id === attacker.id) return;

    const dmg = typeof data.damage === 'number' ? Math.max(0, Math.min(200, data.damage)) : 10;
    victim.health -= dmg;
    if (victim.health <= 0) {
      handleDeath(victim, attacker.id);
    } else {
      io.to(victim.id).emit('damaged', { damage: dmg, from: attacker.name });
    }
  });

  socket.on('energy', (data) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.energy = Math.max(0, Math.min(100, data.energy));
  });

  socket.on('respawn', () => {
    const p = players.get(socket.id);
    if (p && !p.alive) respawnPlayer(p);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('playerList', Array.from(players.values()).map((p) => ({ id: p.id, name: p.name })));
    console.log(`[-] disconnected (${socket.id})`);
  });
});

function tickProjectiles(dt) {
  const now = Date.now();
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.z += pr.vz * dt;

    // Simple floor/wall collision
    if (pr.y < 0 || Math.abs(pr.x) > WORLD_BOUNDS || Math.abs(pr.z) > WORLD_BOUNDS || now - pr.born > 4000) {
      io.emit('explosion', { x: pr.x, y: pr.y, z: pr.z, owner: pr.owner });
      applyRocketDamage(pr);
      projectiles.splice(i, 1);
      continue;
    }

    // Player collision
    for (const p of players.values()) {
      if (!p.alive || p.id === pr.owner) continue;
      const dx = p.x - pr.x;
      const dy = p.y - pr.y;
      const dz = p.z - pr.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < 3.5 * 3.5) {
        io.emit('explosion', { x: pr.x, y: pr.y, z: pr.z, owner: pr.owner });
        applyRocketDamage(pr);
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function applyRocketDamage(pr) {
  const owner = players.get(pr.owner);
  const radius = 8;
  const maxDamage = 90;
  for (const p of players.values()) {
    if (!p.alive || p.id === pr.owner) continue;
    const dx = p.x - pr.x;
    const dy = p.y - pr.y;
    const dz = p.z - pr.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < radius) {
      const dmg = Math.floor(maxDamage * (1 - dist / radius));
      p.health -= dmg;
      if (p.health <= 0) {
        handleDeath(p, pr.owner);
      } else {
        io.to(p.id).emit('damaged', { damage: dmg, from: owner ? owner.name : null });
      }
    }
  }
}

setInterval(() => {
  tickProjectiles(1 / TICK_RATE);
  broadcastSnapshot();
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => {
  console.log(`Neon Strike server listening on http://localhost:${PORT}`);
});
