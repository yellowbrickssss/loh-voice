class VisualizerController {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.gain = null;
    this.source = null;
    this.bufferCache = new Map();
    this.playingId = null;
    this.onEnded = null;
    this.canvas = null;
    this.ctx = null;
    this.dataArray = null;
    this.smoothArray = null;
    this.accent = "#89c4f4";
    this.frameReq = null;
  }
  _ensureCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.85;
      this.gain = this.audioCtx.createGain();
      this.gain.gain.value = 1;
      this.analyser.connect(this.audioCtx.destination);
      this.gain.connect(this.analyser);
      const len = this.analyser.fftSize;
      this.dataArray = new Uint8Array(len);
      this.smoothArray = new Float32Array(len);
    }
  }
  setAccent(color) {
    this.accent = color || this.accent;
  }
  attachCanvas(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this._resize();
    if (this.frameReq) cancelAnimationFrame(this.frameReq);
    this._renderLoop();
  }
  _resize() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }
  async preloadVoices(voices) {
    this._ensureCtx();
    const tasks = voices.map(v => this._loadBuffer(v.audio));
    await Promise.allSettled(tasks);
  }
  async _loadBuffer(url) {
    if (this.bufferCache.has(url)) return this.bufferCache.get(url);
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.audioCtx.decodeAudioData(arr);
    this.bufferCache.set(url, buf);
    return buf;
  }
  async playVoice(voice) {
    this._ensureCtx();
    await this.audioCtx.resume();
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    const buf = this.bufferCache.has(voice.audio)
      ? this.bufferCache.get(voice.audio)
      : await this._loadBuffer(voice.audio);
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    src.onended = () => {
      this.playingId = null;
      if (typeof this.onEnded === "function") this.onEnded();
    };
    this.playingId = voice.id;
    this.source = src;
    src.start(0);
  }
  stop() {
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
      this.playingId = null;
    }
  }
  _renderLoop() {
    if (!this.ctx || !this.analyser) {
      this.frameReq = requestAnimationFrame(() => this._renderLoop());
      return;
    }
    this.analyser.getByteTimeDomainData(this.dataArray);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mid = h / 2;
    const ema = 0.82;
    const len = this.dataArray.length;
    for (let i = 0; i < len; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      const clamped = Math.max(-1, Math.min(1, v));
      const prev = i === 0 ? 0 : this.smoothArray[i - 1];
      this.smoothArray[i] = prev * ema + clamped * (1 - ema);
    }
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.lineWidth = Math.max(1, Math.floor(w / 600));
    this.ctx.strokeStyle = this.accent;
    this.ctx.shadowColor = this.accent;
    this.ctx.shadowBlur = 14;
    this.ctx.globalAlpha = 0.9;
    this.ctx.beginPath();
    const step = w / (len - 1);
    for (let i = 0; i < len; i++) {
      const x = i * step;
      const y = mid + this.smoothArray[i] * (h * 0.38);
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
    this.ctx.globalAlpha = 0.15;
    this.ctx.fillStyle = this.accent;
    this.ctx.shadowBlur = 24;
    this.ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const x = i * step;
      const y = mid + this.smoothArray[i] * (h * 0.38);
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(w, mid);
    this.ctx.lineTo(0, mid);
    this.ctx.closePath();
    this.ctx.fill();
    this.frameReq = requestAnimationFrame(() => this._renderLoop());
  }
}
window.VisualizerController = VisualizerController;
