import { io } from 'socket.io-client';

export class Network {
  constructor() {
    this.socket = null;
    this.id = null;
    this.connected = false;
    this.handlers = {};
  }

  connect(name) {
    const serverUrl = import.meta.env?.VITE_SERVER_URL || window.location.origin;
    this.socket = io(serverUrl, {
      timeout: 10000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.id = this.socket.id;
      this.socket.emit('join', { name });
    });

    this.socket.on('joined', (data) => this.emit('joined', data));
    this.socket.on('snapshot', (data) => this.emit('snapshot', data));
    this.socket.on('shoot', (data) => this.emit('shoot', data));
    this.socket.on('explosion', (data) => this.emit('explosion', data));
    this.socket.on('kill', (data) => this.emit('kill', data));
    this.socket.on('died', (data) => this.emit('died', data));
    this.socket.on('respawned', (data) => this.emit('respawned', data));
    this.socket.on('damaged', (data) => this.emit('damaged', data));
    this.socket.on('playerList', (data) => this.emit('playerList', data));

    this.socket.on('connect_error', (err) => this.emit('error', { type: 'connect', message: err.message }));
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('disconnected', { reason });
    });
  }

  on(event, cb) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(cb);
  }

  emit(event, data) {
    const list = this.handlers[event] || [];
    for (const cb of list) cb(data);
  }

  sendMove(data) {
    if (!this.socket) return;
    this.socket.emit('move', data);
  }

  sendWeapon(key) {
    if (!this.socket) return;
    this.socket.emit('weapon', { weapon: key });
  }

  sendShoot(data) {
    if (!this.socket) return;
    this.socket.emit('shoot', data);
  }

  sendHit(data) {
    if (!this.socket) return;
    this.socket.emit('hit', data);
  }

  sendEnergy(value) {
    if (!this.socket) return;
    this.socket.emit('energy', { energy: value });
  }

  sendRespawn() {
    if (!this.socket) return;
    this.socket.emit('respawn');
  }
}
