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
    this.t = 0;
    this.damping = 0.08;
    this.amplitudeBoost = 3;
    this.attack = 0.25;
    this.decay = 0.09;
    this.baseWaveFrac = 0.12;
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
    const baseY = h;
    const len = this.dataArray.length;
    let sumSq = 0;
    for (let i = 0; i < len; i++) {
      const v = (this.dataArray[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / len);
    const floor = 0.02;
    const target = Math.min(1, Math.max(0, rms - floor) * this.amplitudeBoost);
    const prevAmp = this._amp || 0;
    const rate = target > prevAmp ? this.attack : this.decay;
    const amp = prevAmp + (target - prevAmp) * rate;
    this._amp = amp;
    this.t += 0.016;
    const lfo = 0.5 + 0.5 * Math.sin(this.t * 0.4);
    const cycles = 1.4 + 0.6 * lfo;
    const k = (Math.PI * 2 * cycles) / w;
    const baseH = h * (this.baseWaveFrac + 0.85 * amp);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.shadowColor = this.accent;
    const layers = [
      { alpha: 0.65, blur: 22, ampMul: 1.0, phase: this.t * 0.9 },
      { alpha: 0.35, blur: 30, ampMul: 0.78, phase: this.t * 0.6 + 0.6 },
      { alpha: 0.22, blur: 38, ampMul: 0.55, phase: this.t * 0.4 + 1.2 }
    ];
    for (let n = 0; n < layers.length; n++) {
      const lay = layers[n];
      const grad = this.ctx.createLinearGradient(0, baseY - baseH * 1.2, 0, baseY);
      grad.addColorStop(0, this.accent);
      grad.addColorStop(1, 'rgba(255,255,255,0.05)');
      this.ctx.globalAlpha = lay.alpha;
      this.ctx.fillStyle = grad;
      this.ctx.shadowBlur = lay.blur;
      this.ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const s1 = Math.sin(x * k + lay.phase);
        const s2 = Math.sin(x * k * 0.6 - lay.phase * 0.8);
        const wave = 0.5 + 0.5 * (0.65 * s1 + 0.35 * s2);
        const y = baseY - wave * (baseH * lay.ampMul);
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.lineTo(w, baseY);
      this.ctx.lineTo(0, baseY);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.frameReq = requestAnimationFrame(() => this._renderLoop());
  }
}
window.VisualizerController = VisualizerController;
