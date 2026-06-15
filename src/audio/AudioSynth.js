export class AudioSynth {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  ensure() {
    if (this.ctx) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseBuffer(duration = 0.5) {
    const len = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playTone({ freq = 440, duration = 0.2, type = 'sawtooth', startGain = 0.15, endGain = 0.001, slideTo = null } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(startGain, t);
    gain.gain.exponentialRampToValueAtTime(endGain, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  playNoise({ duration = 0.2, startGain = 0.2, endGain = 0.001, filterFreq = 2000 } = {}) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(duration);
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    gain.gain.setValueAtTime(startGain, t);
    gain.gain.exponentialRampToValueAtTime(endGain, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  pistol() {
    this.playNoise({ duration: 0.12, startGain: 0.22, endGain: 0.001, filterFreq: 4500 });
    this.playTone({ freq: 900, duration: 0.08, type: 'square', startGain: 0.04, slideTo: 220 });
  }

  shotgun() {
    this.playNoise({ duration: 0.28, startGain: 0.35, endGain: 0.001, filterFreq: 1800 });
    this.playTone({ freq: 160, duration: 0.18, type: 'sawtooth', startGain: 0.12, slideTo: 55 });
  }

  rocket() {
    this.playNoise({ duration: 0.55, startGain: 0.25, endGain: 0.001, filterFreq: 900 });
    this.playTone({ freq: 120, duration: 0.5, type: 'sawtooth', startGain: 0.08, slideTo: 60 });
  }

  explosion() {
    this.playNoise({ duration: 0.55, startGain: 0.35, endGain: 0.001, filterFreq: 600 });
    this.playTone({ freq: 90, duration: 0.45, type: 'sawtooth', startGain: 0.1, slideTo: 30 });
  }

  hit() {
    this.playNoise({ duration: 0.1, startGain: 0.15, endGain: 0.001, filterFreq: 6000 });
    this.playTone({ freq: 600, duration: 0.06, type: 'sine', startGain: 0.06, slideTo: 1200 });
  }

  kill() {
    this.playTone({ freq: 880, duration: 0.12, type: 'sawtooth', startGain: 0.1, slideTo: 1760 });
    setTimeout(() => this.playTone({ freq: 1760, duration: 0.25, type: 'square', startGain: 0.08, slideTo: 880 }), 80);
  }

  jump() {
    this.playTone({ freq: 160, duration: 0.25, type: 'sine', startGain: 0.07, slideTo: 320 });
  }

  dash() {
    this.playNoise({ duration: 0.22, startGain: 0.12, endGain: 0.001, filterFreq: 3000 });
    this.playTone({ freq: 400, duration: 0.18, type: 'sawtooth', startGain: 0.04, slideTo: 1200 });
  }

  focus() {
    this.playTone({ freq: 220, duration: 0.5, type: 'sine', startGain: 0.06, slideTo: 440 });
  }

  footstep() {
    this.playNoise({ duration: 0.08, startGain: 0.03, endGain: 0.001, filterFreq: 800 });
  }

  denied() {
    this.playTone({ freq: 160, duration: 0.15, type: 'sawtooth', startGain: 0.06, slideTo: 80 });
  }
}
