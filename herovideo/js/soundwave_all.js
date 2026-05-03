/* ==========================================================================
   🌊 Soundwave Library (Combined)
   1. Audio: 오디오 데이터 분석 (FFT)
   2. Render: 캔버스 드로잉 (Visualizer)
   3. Main: 통합 제어 및 애니메이션 루프
   ========================================================================== */

/* [Part 1] soundwave-audio.js */
(function (global) {
    'use strict';
    let audioContext = null;
    const ANALYSER_FFT = 512;
    const SMOOTHING = 0.75;
    const elementAttachmentCache = new WeakMap();

    function getOrCreateContext() {
        if (audioContext) return audioContext;
        const Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return null;
        audioContext = new Ctx();
        return audioContext;
    }

    function attachAnalyser(element) {
        const ctx = getOrCreateContext();
        if (!ctx || !element) return null;
        var cached = elementAttachmentCache.get(element);
        if (cached) {
            if (!cached.connected) {
                try {
                    cached.source.connect(cached.analyser);
                    cached.analyser.connect(ctx.destination);
                    cached.connected = true;
                } catch (_) {}
            }
            if (!cached.getFrequencySnapshot && cached.analyser) {
                var fc = cached.analyser.frequencyBinCount;
                var fb = new Uint8Array(fc);
                cached.getFrequencySnapshot = function () {
                    cached.analyser.getByteFrequencyData(fb);
                    return fb;
                };
            }
            return cached;
        }
        const source = ctx.createMediaElementSource(element);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = ANALYSER_FFT;
        analyser.smoothingTimeConstant = SMOOTHING;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        const timeBuffer = new Uint8Array(analyser.fftSize);
        const freqBinCount = analyser.frequencyBinCount;
        const freqBuffer = new Uint8Array(freqBinCount);
        function getSnapshot() {
            analyser.getByteTimeDomainData(timeBuffer);
            return timeBuffer;
        }
        function getFrequencySnapshot() {
            analyser.getByteFrequencyData(freqBuffer);
            return freqBuffer;
        }
        function disconnect() {
            try {
                source.disconnect();
                analyser.disconnect();
            } catch (_) {}
            var entry = elementAttachmentCache.get(element);
            if (entry) entry.connected = false;
        }
        var entry = {
            source: source,
            analyser: analyser,
            getSnapshot: getSnapshot,
            getFrequencySnapshot: getFrequencySnapshot,
            disconnect: disconnect,
            connected: true
        };
        elementAttachmentCache.set(element, entry);
        return entry;
    }

    function decodeFullSoundwave(url, targetSamples, method) {
        targetSamples = targetSamples || 600;
        method = (method === 'rms') ? 'rms' : 'peak';
        if (!url || typeof url !== 'string') return Promise.resolve(null);
        var fetchUrl = (url.indexOf('http:') === 0 || url.indexOf('https:') === 0 || url.indexOf('data:') === 0)
            ? url : (global.location ? new URL(url, global.location.href).href : url);
        return global.fetch(fetchUrl)
            .then(function (res) { return res.arrayBuffer(); })
            .then(function (buffer) {
                var ctx = getOrCreateContext();
                if (!ctx) return Promise.reject(new Error('AudioContext not available'));
                return new Promise(function (resolve, reject) {
                    ctx.decodeAudioData(buffer.slice(0), resolve, reject);
                });
            })
            .then(function (decoded) {
                var duration = decoded.duration;
                var numCh = decoded.numberOfChannels;
                var length = decoded.length;
                var out = new Float32Array(targetSamples);
                var samplesPerBar = length / targetSamples;
                for (var i = 0; i < targetSamples; i++) {
                    var start = Math.floor(i * samplesPerBar);
                    var end = Math.min(Math.floor((i + 1) * samplesPerBar), length);
                    if (start >= end) { out[i] = 0; continue; }
                    if (method === 'rms') {
                        var sumSq = 0; var n = 0;
                        for (var c = 0; c < numCh; c++) {
                            var ch = decoded.getChannelData(c);
                            for (var k = start; k < end; k++) { sumSq += ch[k] * ch[k]; n++; }
                        }
                        out[i] = n > 0 ? Math.sqrt(sumSq / n) : 0;
                    } else {
                        var peak = 0;
                        for (var c = 0; c < numCh; c++) {
                            var ch = decoded.getChannelData(c);
                            for (var k = start; k < end; k++) { var a = Math.abs(ch[k]); if (a > peak) peak = a; }
                        }
                        out[i] = peak;
                    }
                }
                return { samples: out, duration: duration };
            });
    }

    function resumeContext() {
        var ctx = getOrCreateContext();
        if (ctx && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
            return ctx.resume();
        }
        return Promise.resolve();
    }

    global.SoundwaveAudio = {
        getContext: getOrCreateContext,
        attachAnalyser: attachAnalyser,
        decodeFullSoundwave: decodeFullSoundwave,
        resumeContext: resumeContext
    };
})(typeof window !== 'undefined' ? window : this);


/* [Part 2] soundwave-render.js */
(function (global) {
    'use strict';
    var defaultOptions = {
        layout: 'linear', mode: 'realtime', progress: 0, lineWidth: 1.5, glowBlur: 18, fillUnder: true,
        colors: {
            gradientStart: 'rgba(70, 100, 140, 0.9)', gradientEnd: 'rgba(180, 160, 120, 0.85)',
            playedStart: 'rgba(90, 120, 150, 0.95)', playedEnd: 'rgba(200, 180, 140, 0.9)',
            glow: 'rgba(100, 130, 160, 0.35)', fillGradientTop: 'rgba(220, 215, 200, 0.2)',
            fillGradientBottom: 'rgba(180, 170, 150, 0.05)',
            spectrumFillBlue: 'rgba(100, 200, 255, 0.22)', spectrumFillGold: 'rgba(255, 180, 80, 0.22)',
            spectrumGlow: 'rgba(255, 160, 0, 0.18)'
        },
        smoothing: 0.2, swellPasses: 0, mirror: true, ringBaseRadius: 0.42, ringAmplitude: 0.04,
        ringCenter: null, ringStyle: 'bars', amplitudeExponent: 0.72, ripple: false,
        rippleInterval: 1.4, rippleSpeed: 45, rippleMaxRadius: 0.55, rippleFadePower: 1.8,
        rippleCount: 4, rippleStroke: 'rgba(90, 120, 150, 0.35)', amplitudeEnrich: false,
        enrichCrescendo: 0.25, enrichAttack: 0.2, enrichQuietFloor: 0.018, spectrumLayers: 5,
        spectrumBassBins: 12, spectrumBassGain: 0.28, spectrumWaveAmp: 0.06, spectrumNumPoints: 64,
        spectrumHighWeight: 0.7, ringMaxRadius: 0.48, spectrumInnerRadius: 90,
        spectrumDonutWidth: 85, spectrumBandThickness: 8
    };

    function lerp(a, b, t) { return a + (b - a) * t; }
    function smooth(data, factor) {
        if (!data || data.length < 3 || factor <= 0) return data;
        var out = new Float32Array(data.length);
        out[0] = data[0]; out[data.length - 1] = data[data.length - 1];
        for (var i = 1; i < data.length - 1; i++) out[i] = lerp(data[i], (data[i - 1] + data[i + 1]) * 0.5, factor);
        return out;
    }
    function smoothSwell(data, passes, factor) {
        if (!data || passes <= 0) return data;
        factor = factor != null ? factor : 0.45;
        var out = data;
        for (var p = 0; p < passes; p++) out = smooth(out, factor);
        return out;
    }
    function toNormalized(data, isByte) {
        var out = new Float32Array(data.length);
        var i;
        if (isByte) { for (i = 0; i < data.length; i++) out[i] = (data[i] - 128) / 128; }
        else {
            var max = 0; for (i = 0; i < data.length; i++) if (Math.abs(data[i]) > max) max = Math.abs(data[i]);
            var scale = max > 0 ? 1 / max : 1;
            for (i = 0; i < data.length; i++) out[i] = data[i] * scale;
        }
        return out;
    }
    function drawPath(ctx, pts, zeroY, height, flip) {
        if (!pts || pts.length < 2) return;
        var w = ctx.canvas.width; var step = w / (pts.length - 1); var amp = height * 0.45;
        ctx.beginPath(); ctx.moveTo(0, zeroY + pts[0] * (flip ? -amp : amp));
        for (var i = 1; i < pts.length; i++) ctx.lineTo(i * step, zeroY + pts[i] * (flip ? -amp : amp));
        ctx.lineTo(w, zeroY); ctx.lineTo(0, zeroY); ctx.closePath();
    }
    function drawLinePath(ctx, pts, zeroY, height, flip) {
        if (!pts || pts.length < 2) return;
        var w = ctx.canvas.width; var step = w / (pts.length - 1); var amp = height * 0.45;
        ctx.beginPath(); ctx.moveTo(0, zeroY + pts[0] * (flip ? -amp : amp));
        for (var i = 1; i < pts.length; i++) ctx.lineTo(i * step, zeroY + pts[i] * (flip ? -amp : amp));
        ctx.stroke();
    }
    function drawRingPlaceholder(ctx, cx, cy, R0, colors) {
        ctx.strokeStyle = (colors && colors.gradientEnd) ? colors.gradientEnd : 'rgba(180,160,120,0.35)';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R0, 0, Math.PI * 2); ctx.stroke();
    }
    var FIXED_INNER_RADIUS = 150;

    function drawCircularSpectrumWaves(ctx, freqData, opts) {
        if (!freqData || freqData.length < 4) return;
        var cx = opts.cx; var cy = opts.cy; var size = opts.size;
        var time = ((opts.rippleTime != null && Number.isFinite(opts.rippleTime)) ? opts.rippleTime : 0) * 2.5;
        var colors = opts.colors || {};
        var numPoints = (opts.spectrumNumPoints != null) ? Math.min(100, Math.max(80, opts.spectrumNumPoints)) : 100;
        var glowBlur = opts.glowBlur != null ? opts.glowBlur : 18;
        var rotationOffsetRad = (opts.spectrumRotationOffset != null) ? opts.spectrumRotationOffset : (22.5 * Math.PI / 180);
        var fixedInner = (opts.spectrumInnerRadius != null && opts.spectrumInnerRadius > 0)
            ? (opts.spectrumInnerRadius <= 1 ? size * opts.spectrumInnerRadius : opts.spectrumInnerRadius)
            : FIXED_INNER_RADIUS;
        var phase = time * 0.2;
        var skyBlue = colors.spectrumFillBlue || 'rgba(100, 200, 255, 0.22)';
        var amber = colors.spectrumFillGold || 'rgba(255, 180, 80, 0.22)';
        var glowSky = 'rgba(0, 220, 255, 0.2)';
        var glowAmber = (colors && colors.spectrumGlow) ? colors.spectrumGlow : 'rgba(255, 160, 0, 0.18)';

        var DC_MASK_END = 5; var effectiveFraction = 0.55;
        var effectiveLen = Math.max(DC_MASK_END + 5, Math.floor(freqData.length * effectiveFraction));
        var lowBin = DC_MASK_END; var highBin = effectiveLen - 1; var totalSpan = highBin - lowBin;
        var bassStart = lowBin; var bassEnd = lowBin + Math.floor(totalSpan * 0.2);
        var highStart = lowBin + Math.floor(totalSpan * 0.7); var highEnd = highBin;
        
        var volSum = 0, volCount = 0;
        for (var i = lowBin; i <= highBin; i++) { if (i >= DC_MASK_END) { volSum += (freqData[i] || 0); volCount++; } }
        var rawVol = volCount > 0 ? (volSum / volCount) / 255 : 0;
        
        var bassSum = 0, bassCount = 0;
        for (var i = bassStart; i <= bassEnd; i++) { if (i >= DC_MASK_END) { bassSum += (freqData[i] || 0); bassCount++; } }
        var rawBass = bassCount > 0 ? (bassSum / bassCount) / 255 : 0;
        
        var highSum = 0, highCount = 0;
        for (var i = highStart; i <= highEnd; i++) { if (i >= DC_MASK_END) { highSum += (freqData[i] || 0); highCount++; } }
        var rawHigh = highCount > 0 ? (highSum / highCount) / 255 : 0;

        if (!drawCircularSpectrumWaves._maxPeak) drawCircularSpectrumWaves._maxPeak = 0.01;
        var maxPeak = drawCircularSpectrumWaves._maxPeak;
        if (rawVol > maxPeak) maxPeak = rawVol;
        maxPeak *= 0.999; 
        if (maxPeak < 0.01) maxPeak = 0.01;
        drawCircularSpectrumWaves._maxPeak = maxPeak;

        var normVol = Math.max(0, Math.min(1, rawVol / maxPeak));
        var normBass = Math.max(0, Math.min(1, rawBass / maxPeak));
        var normHigh = Math.max(0, Math.min(1, rawHigh / maxPeak));

        var vol = Math.pow(normVol, 2.5);
        var bass = Math.pow(normBass, 2.5);
        var high = Math.pow(normHigh, 2.5);
        if (vol < 0.01) vol = 0; 

        if (!drawCircularSpectrumWaves._prevParams) drawCircularSpectrumWaves._prevParams = { vol: 0, bass: 0, high: 0 };
        var prevParams = drawCircularSpectrumWaves._prevParams;
        var attackSpeed = 0.95; var decaySpeed = 0.35;
        
        var smoothVol = prevParams.vol + (vol - prevParams.vol) * (vol > prevParams.vol ? attackSpeed : decaySpeed);
        var smoothBass = prevParams.bass + (bass - prevParams.bass) * (bass > prevParams.bass ? attackSpeed : decaySpeed);
        var smoothHigh = prevParams.high + (high - prevParams.high) * (high > prevParams.high ? attackSpeed : decaySpeed);
        
        prevParams.vol = smoothVol; prevParams.bass = smoothBass; prevParams.high = smoothHigh;
        var canvasMaxRadius = Math.min(size * 0.5, Math.min(cx, cy)) - 5;
        
        function drawLiquidDonutLayer(ox, oy, fillColor, glowColor, phaseOff, angleOffsetRad) {
            angleOffsetRad = angleOffsetRad || 0;
            var outer = []; var inner = []; var n = numPoints;
            for (var i = 0; i < n; i++) {
                var angleIdx = i; var t = angleIdx / n;
                var angle = t * Math.PI * 2 - Math.PI / 2 + angleOffsetRad;
                var r = fixedInner;
                var wave1 = Math.sin(angle * 3 + time * 1.5);
                var wave2 = Math.sin(angle * 2 - time * 1.0);
                var waveHeight = (wave1 + wave2) * 0.5;
                var gentleWave = (waveHeight + 1) * 0.5;
                var boost = 1.0 + (smoothVol * 1.5);
                var dynamicVol = smoothVol * boost;
                r += gentleWave * (dynamicVol * 65);
                r += smoothVol * 10;
                var maxR = canvasMaxRadius;
                r = Math.max(fixedInner, Math.min(maxR, r));
                var th = angle;
                outer.push({ x: ox + r * Math.cos(th), y: oy + r * Math.sin(th) });
                inner.push({ x: ox + fixedInner * Math.cos(th), y: oy + fixedInner * Math.sin(th) });
            }
            var tension = 2.0;
            var ox0 = outer[0].x; var oy0 = outer[0].y; var ix0 = inner[0].x; var iy0 = inner[0].y;
            ctx.beginPath(); ctx.moveTo(ox0, oy0);
            for (var i = 0; i < n; i++) {
                var p0 = outer[(i - 1 + n) % n]; var p1 = outer[i];
                var p2 = outer[(i + 1) % n]; var p3 = outer[(i + 2) % n];
                var cp1x = p1.x + (p2.x - p0.x) / tension; var cp1y = p1.y + (p2.y - p0.y) / tension;
                var cp2x = p2.x - ((p3.x - p1.x) / tension); var cp2y = p2.y - ((p3.y - p1.y) / tension);
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
            ctx.lineTo(ix0, iy0);
            for (var i = n - 1; i >= 1; i--) ctx.lineTo(inner[i].x, inner[i].y);
            ctx.lineTo(ix0, iy0); ctx.closePath();
            var maxOuter = canvasMaxRadius;
            
            // 블랙 그라데이션 제거 및 투명/흰색 그라데이션 적용
            var grad = ctx.createRadialGradient(ox, oy, fixedInner, ox, oy, maxOuter);
            grad.addColorStop(0, 'rgba(255,255,255,0.1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            
            ctx.fillStyle = grad; 
            ctx.shadowColor = glowColor; 
            ctx.shadowBlur = glowBlur;
            ctx.fill(); 
            ctx.shadowBlur = 0;
        }
        ctx.save();
        drawLiquidDonutLayer(cx, cy, skyBlue, glowSky, 0, 0);
        drawLiquidDonutLayer(cx, cy, amber, glowAmber, Math.PI * 0.3, rotationOffsetRad);
        ctx.restore();
    }

    function drawRipples(ctx, cx, cy, time, size, opts) {
        opts = opts || {};
        time = (time != null && Number.isFinite(time)) ? time : 0;
        var interval = opts.rippleInterval != null ? opts.rippleInterval : 1.4;
        var speed = opts.rippleSpeed != null ? opts.rippleSpeed : 45;
        var maxR = size * (opts.rippleMaxRadius != null ? opts.rippleMaxRadius : 0.55);
        var fadePower = opts.rippleFadePower != null ? opts.rippleFadePower : 1.8;
        var count = opts.rippleCount != null ? opts.rippleCount : 4;
        var base = opts.rippleStroke != null ? opts.rippleStroke : 'rgba(90, 120, 150, 0.35)';
        var parts = (typeof base === 'string' && base.match) ? base.match(/[\d.]+/g) : null;
        ctx.save(); ctx.lineWidth = 1.2;
        for (var i = 0; i < count; i++) {
            var age = (time % interval) + i * interval;
            if (!Number.isFinite(age) || age < 0) continue;
            var r = Math.min(speed * age, maxR * 1.1);
            var t = r / maxR;
            var alpha = Math.max(0, 1 - Math.pow(t, fadePower));
            if (alpha <= 0.002) continue;
            var rgba = (parts && parts.length >= 3)
                ? 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',' + alpha + ')'
                : 'rgba(90,120,150,' + alpha + ')';
            ctx.strokeStyle = rgba; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    function enrichAmplitude(data, opts) {
        if (!data || data.length < 2) return data;
        opts = opts || {};
        var out = new Float32Array(data.length);
        var crescendo = opts.enrichCrescendo != null ? opts.enrichCrescendo : 0.25;
        var attack = opts.enrichAttack != null ? opts.enrichAttack : 0.2;
        var floor = opts.enrichQuietFloor != null ? opts.enrichQuietFloor : 0.018;
        var time = (opts.rippleTime != null && Number.isFinite(opts.rippleTime)) ? opts.rippleTime : 0;
        for (var i = 0; i < data.length; i++) {
            var v = Math.max(0, Math.min(1, Number(data[i]) || 0));
            var prev = i > 0 ? (Number(data[i - 1]) || 0) : v;
            var diff = v - prev; var boost = 1;
            if (diff > 0) {
                var attackBoost = 1 + attack * Math.min(1, diff * 4);
                var crescendoBoost = 1 + crescendo * Math.min(1, diff * 3);
                boost = (attackBoost + crescendoBoost) * 0.5;
            }
            var breath = 0.008 * Math.sin(time * 2.5 + i / 28);
            var x = Math.max(floor + breath, Math.min(1, v * boost));
            out[i] = Number.isFinite(x) ? x : 0.02;
        }
        return out;
    }

    function drawRingBarsPlaceholder(ctx, cx, cy, R0, barLen, colors) {
        var n = 48;
        var stroke = (colors && colors.gradientEnd) ? colors.gradientEnd : 'rgba(180,160,120,0.35)';
        ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
        for (var i = 0; i < n; i++) {
            var th = (i / n) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath(); ctx.moveTo(cx + R0 * Math.cos(th), cy + R0 * Math.sin(th));
            ctx.lineTo(cx + (R0 + barLen) * Math.cos(th), cy + (R0 + barLen) * Math.sin(th));
            ctx.stroke();
        }
    }

    function drawRingBars(ctx, normalized, opts) {
        var cx = opts.cx; var cy = opts.cy; var R0 = opts.R0; var A = opts.A;
        var progress = opts.progress; var mode = opts.mode; var colors = opts.colors;
        var lineWidth = opts.lineWidth; var glowBlur = opts.glowBlur;
        var ampExp = opts.amplitudeExponent != null ? opts.amplitudeExponent : 0.72;
        var n = normalized.length; var playedLen = Math.floor(n * progress);
        var minBar = opts.minBar != null ? opts.minBar : 0.008;
        var grad = ctx.createLinearGradient(cx - R0, cy, cx + R0, cy);
        grad.addColorStop(0, colors.gradientStart); grad.addColorStop(1, colors.gradientEnd);
        ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = lineWidth;
        ctx.shadowColor = colors.glow || 'rgba(100,130,160,0.35)';
        function drawBarRange(startIdx, endIdx, strokeStyle, useGlow) {
            ctx.strokeStyle = strokeStyle; ctx.shadowBlur = useGlow ? glowBlur : 0;
            for (var i = startIdx; i < endIdx; i++) {
                var idx = Math.min(i, n - 1);
                var th = (idx / n) * Math.PI * 2 - Math.PI / 2;
                var raw = Math.max(0, Math.min(1, normalized[idx]));
                var val = Math.max(minBar, Math.pow(raw, ampExp));
                var r1 = R0; var r2 = R0 + A * val;
                ctx.beginPath(); ctx.moveTo(cx + r1 * Math.cos(th), cy + r1 * Math.sin(th));
                ctx.lineTo(cx + r2 * Math.cos(th), cy + r2 * Math.sin(th));
                ctx.stroke();
            }
        }
        if (mode === 'full' && progress > 0 && playedLen > 0 && playedLen < n) {
            drawBarRange(0, playedLen, grad, true);
            ctx.globalAlpha = 0.5; drawBarRange(playedLen, n, colors.gradientEnd || 'rgba(180,160,120,0.65)', false);
        } else { drawBarRange(0, n, grad, true); }
        ctx.restore();
    }

    function drawRing(ctx, normalized, opts) {
        var w = opts.w; var h = opts.h; var cx = opts.cx; var cy = opts.cy;
        var R0 = opts.R0; var A = opts.A; var progress = opts.progress;
        var mode = opts.mode; var colors = opts.colors; var lineWidth = opts.lineWidth;
        var glowBlur = opts.glowBlur; var n = normalized.length;
        var playedLen = Math.floor(n * progress);
        var grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, colors.gradientStart); grad.addColorStop(1, colors.gradientEnd);
        function point(i) {
            var idx = Math.min(Math.max(0, Math.floor(i)), n - 1);
            var th = (idx / n) * Math.PI * 2 - Math.PI / 2;
            var r = R0 + A * normalized[idx];
            return { x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) };
        }
        function strokeArc(startIdx, endIdx, strokeStyle, useGlow) {
            ctx.beginPath(); var p0 = point(startIdx); ctx.moveTo(p0.x, p0.y);
            for (var i = startIdx + 1; i <= endIdx; i++) { var p1 = point(i % n); ctx.lineTo(p1.x, p1.y); }
            ctx.strokeStyle = strokeStyle; ctx.shadowBlur = useGlow ? glowBlur : 0; ctx.stroke();
        }
        ctx.save(); ctx.lineWidth = lineWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = colors.glow || 'rgba(100,130,160,0.35)';
        if (mode === 'full' && progress > 0 && playedLen > 0 && playedLen < n) {
            strokeArc(0, playedLen, grad, true);
            ctx.globalAlpha = 0.5; strokeArc(playedLen, n - 1, colors.gradientEnd || 'rgba(180,160,120,0.65)', false);
        } else { strokeArc(0, n - 1, grad, true); }
        ctx.restore();
    }

    function render(canvas, data, opts) {
        if (!canvas) return;
        var options = {}; for (var k in defaultOptions) options[k] = defaultOptions[k];
        if (opts) { for (var key in opts) {
            if (opts[key] != null && typeof opts[key] === 'object' && !ArrayBuffer.isView(opts[key]) && opts[key].constructor === Object)
                options[key] = Object.assign({}, options[key], opts[key]);
            else options[key] = opts[key];
        }}
        var colors = options.colors; var layout = options.layout || 'linear';
        var dpr = Math.min(2, (global.devicePixelRatio || 1));
        var w = canvas.clientWidth || 340; var h = canvas.clientHeight || 300;
        if (canvas.width !== w * dpr) canvas.width = w * dpr;
        if (canvas.height !== h * dpr) canvas.height = h * dpr;
        var ctx = canvas.getContext('2d'); if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr);
        w = Math.max(1, canvas.clientWidth || w); h = Math.max(1, canvas.clientHeight || h);
        ctx.clearRect(0, 0, w, h);

        if (layout === 'ring') {
            var size = Math.max(100, Math.min(w, h));
            var cx = options.ringCenter && options.ringCenter.length >= 2 ? w * options.ringCenter[0] : w / 2;
            var cy = options.ringCenter && options.ringCenter.length >= 2 ? h * options.ringCenter[1] : h / 2;
            var R0 = size * (options.ringBaseRadius != null ? options.ringBaseRadius : 0.42);
            var A = size * (options.ringAmplitude != null ? options.ringAmplitude : 0.04);
            var isSpectrumData = data && data.length > 4 && (typeof Uint8Array !== 'undefined' && data instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' && ArrayBuffer.isView(data)));
            
            if (options.ringStyle === 'spectrum' && options.layout === 'ring' && isSpectrumData) {
                drawCircularSpectrumWaves(ctx, data, {
                    cx: cx, cy: cy, size: size, colors: colors,
                    rippleTime: options.rippleTime, spectrumWaveAmp: options.spectrumWaveAmp,
                    spectrumNumPoints: options.spectrumNumPoints, spectrumInnerRadius: options.spectrumInnerRadius,
                    spectrumRotationOffset: options.spectrumRotationOffset, glowBlur: options.glowBlur
                });
                return;
            }
            if (!data || data.length === 0) {
                if (options.ringStyle === 'spectrum') {
                    var baseR = options.spectrumBaseRadius != null
                        ? (options.spectrumBaseRadius > 0 && options.spectrumBaseRadius <= 1 ? size * options.spectrumBaseRadius : options.spectrumBaseRadius) : (size * 0.45);
                    var lineW = (options.spectrumLineWidth != null) ? options.spectrumLineWidth : 2.5;
                    var blend = colors.spectrumFillBlue && colors.spectrumFillGold ? 'rgba(192, 190, 173, 0.55)' : (colors.spectrumFillGold || 'rgba(212, 165, 116, 0.5)');
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 0; ctx.lineWidth = lineW; ctx.strokeStyle = blend;
                    ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI * 2); ctx.stroke();
                } else if (options.ripple && options.rippleTime != null) {
                    drawRipples(ctx, cx, cy, options.rippleTime, size, options);
                }
                if (options.ringStyle === 'bars') drawRingBarsPlaceholder(ctx, cx, cy, R0, size * 0.06, colors);
                else if (options.ringStyle !== 'spectrum') drawRingPlaceholder(ctx, cx, cy, R0, colors);
                return;
            }
            var isByte = data instanceof Uint8Array; var normalized = toNormalized(data, isByte);
            if (options.swellPasses > 0) normalized = smoothSwell(normalized, options.swellPasses, 0.45);
            else if (options.smoothing > 0) normalized = smooth(normalized, options.smoothing);
            if (options.amplitudeEnrich) { try { normalized = enrichAmplitude(normalized, { rippleTime: options.rippleTime, enrichCrescendo: options.enrichCrescendo, enrichAttack: options.enrichAttack, enrichQuietFloor: options.enrichQuietFloor }); } catch (_) {} }
            if (options.ripple && options.rippleTime != null) { try { drawRipples(ctx, cx, cy, options.rippleTime, size, options); } catch (_) {} }
            var mode = options.mode; var progress = Math.max(0, Math.min(1, options.progress));
            var ringOpts = { w: w, h: h, cx: cx, cy: cy, R0: R0, A: A, progress: progress, mode: mode, colors: colors, lineWidth: options.lineWidth != null ? options.lineWidth : 1.5, glowBlur: options.glowBlur != null ? options.glowBlur : 10, amplitudeExponent: options.amplitudeExponent, minBar: options.minBar };
            if (options.ringStyle === 'bars') drawRingBars(ctx, normalized, ringOpts);
            else drawRing(ctx, normalized, ringOpts);
            return;
        }

        if (!data || data.length === 0) {
            ctx.strokeStyle = (colors && colors.gradientEnd) ? colors.gradientEnd : 'rgba(180,160,120,0.35)';
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
            return;
        }
        var mode = options.mode; var progress = Math.max(0, Math.min(1, options.progress));
        var isByte = data instanceof Uint8Array; var normalized = toNormalized(data, isByte);
        if (options.smoothing > 0) normalized = smooth(normalized, options.smoothing);
        var zeroY = h / 2; var playedLen = Math.floor(normalized.length * progress);
        if (mode === 'full' && playedLen > 0 && options.fillUnder) {
            var gPlayed = ctx.createLinearGradient(0, 0, 0, h);
            gPlayed.addColorStop(0, colors.fillGradientTop || 'rgba(220,215,200,0.25)');
            gPlayed.addColorStop(1, colors.fillGradientBottom || 'rgba(180,170,150,0.05)');
            ctx.fillStyle = gPlayed; drawPath(ctx, normalized.subarray(0, playedLen), zeroY, h, true); ctx.fill();
        }
        if (mode === 'full' && playedLen > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w * progress, h); ctx.clip(); }
        ctx.save(); ctx.shadowColor = colors.glow || 'rgba(100,130,160,0.4)'; ctx.shadowBlur = options.glowBlur != null ? options.glowBlur : 12;
        ctx.lineWidth = options.lineWidth != null ? options.lineWidth : 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        if (mode === 'full' && playedLen > 0) {
            grad.addColorStop(0, colors.playedStart || colors.gradientStart);
            grad.addColorStop(Math.max(0.01, progress - 0.01), colors.playedEnd || colors.gradientEnd);
            grad.addColorStop(progress, colors.gradientStart); grad.addColorStop(1, colors.gradientEnd);
        } else { grad.addColorStop(0, colors.gradientStart); grad.addColorStop(1, colors.gradientEnd); }
        ctx.strokeStyle = grad; drawLinePath(ctx, normalized, zeroY, h, true); ctx.restore();
        if (mode === 'full' && playedLen > 0) ctx.restore();
        if (mode === 'full' && progress > 0 && playedLen < normalized.length) {
            ctx.save(); ctx.beginPath(); ctx.rect(w * progress, 0, w * (1 - progress), h); ctx.clip();
            ctx.globalAlpha = 0.5; ctx.strokeStyle = colors.gradientEnd || 'rgba(180,160,120,0.6)';
            ctx.lineWidth = options.lineWidth != null ? options.lineWidth : 1.5; ctx.shadowBlur = 0;
            drawLinePath(ctx, normalized, zeroY, h, true); ctx.restore();
        }
    }
    function resize(canvas) {
        if (!canvas) return;
        var dpr = Math.min(2, (global.devicePixelRatio || 1));
        var w = canvas.clientWidth; var h = canvas.clientHeight;
        if (canvas.width !== w * dpr) canvas.width = w * dpr;
        if (canvas.height !== h * dpr) canvas.height = h * dpr;
    }

    global.SoundwaveRender = { render: render, resize: resize, defaultOptions: defaultOptions };
})(typeof window !== 'undefined' ? window : this);


/* [Part 3] soundwave.js (Main API) */
(function (global) {
    'use strict';
    var Audio = global.SoundwaveAudio; var Render = global.SoundwaveRender;
    if (!Audio || !Render) return;
    var raf = global.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    var cancelRaf = global.cancelAnimationFrame || clearTimeout;

    function createSoundwave(container, audioEl, options) {
        options = options || {};
        var mode = options.mode || 'full';
        var fullSamples = options.fullSamples != null ? options.fullSamples : 600;
        var style = options.style || {};
        var canvas = document.createElement('canvas');
        canvas.className = 'soundwave-canvas';
        if (container) { container.innerHTML = ''; container.appendChild(canvas); }

        var attached = null; var fullData = null; var currentUrl = null; var rafId = null;

        function fitCanvas() { Render.resize(canvas); }
        function stopRealtime() {
            if (rafId != null) { cancelRaf(rafId); rafId = null; }
            if (attached && attached.disconnect) { attached.disconnect(); attached = null; }
        }
        function drawRealtime() {
            if (!attached) return;
            if (audioEl && audioEl.paused) { rafId = null; return; }
            var data;
            var opts = { mode: 'realtime', progress: undefined, rippleTime: (typeof Date.now === 'function' ? Date.now() : 0) / 1000, layout: style.layout || 'linear', ringStyle: style.ringStyle || null };
            if (style.ringStyle === 'spectrum' && attached.getFrequencySnapshot) {
                data = attached.getFrequencySnapshot(); opts.ringStyle = 'spectrum'; opts.layout = 'ring';
            } else {
                var snap = attached.getSnapshot(); var targetBars = (style.realtimeBars != null) ? style.realtimeBars : 600;
                data = snap;
                if (snap && snap.length > targetBars) {
                    var step = snap.length / targetBars; var out = new Float32Array(targetBars);
                    for (var i = 0; i < targetBars; i++) {
                        var start = Math.floor(i * step); var end = Math.min(Math.floor((i + 1) * step), snap.length);
                        var sum = 0, n = 0; for (var k = start; k < end; k++) { sum += Math.abs((snap[k] - 128) / 128); n++; }
                        out[i] = n > 0 ? sum / n : 0;
                    }
                    data = out;
                }
            }
            var merged = Object.assign({}, opts, style); merged.progress = undefined; merged.mode = 'realtime';
            Render.render(canvas, data, merged);
            rafId = raf(drawRealtime);
        }
        function drawFull() {
            var progress = 0;
            if (audioEl && audioEl.duration && isFinite(audioEl.duration)) progress = audioEl.currentTime / audioEl.duration;
            var data = (fullData && fullData.samples) ? fullData.samples : null;
            Render.render(canvas, data, Object.assign({ mode: 'full', progress: progress, rippleTime: typeof Date.now === 'function' ? Date.now() / 1000 : 0 }, style));
            rafId = raf(drawFull);
        }
        function setMode(m) {
            mode = m || mode; stopRealtime();
            if (mode === 'realtime' && audioEl) { attached = Audio.attachAnalyser(audioEl); if (attached) drawRealtime(); }
            else if (mode === 'full') { if (fullData) drawFull(); }
        }
        function setSource(url) {
            if (mode === 'realtime') {
                currentUrl = url || null; fitCanvas();
                if (audioEl && !audioEl.paused && attached && !rafId) raf(drawRealtime);
                return Promise.resolve(null);
            }
            if (url === currentUrl && fullData) return Promise.resolve(fullData);
            currentUrl = url; fullData = null;
            if (!url) { fitCanvas(); if (mode === 'full') rafId = raf(drawFull); return Promise.resolve(null); }
            return Audio.decodeFullSoundwave(url, fullSamples).then(function (data) {
                fullData = data; currentUrl = url; fitCanvas();
                if (mode === 'full') drawFull(); return data;
            }).catch(function () { fullData = null; return null; });
        }
        function setTrackUrl(url) { return setSource(url || ''); }
        
        fitCanvas();
        if (global.ResizeObserver && container) { var ro = new ResizeObserver(fitCanvas); ro.observe(container); }
        if (mode === 'full') { drawFull(); if (audioEl && audioEl.src && audioEl.src.indexOf('blob:') !== 0) setSource(audioEl.src); }
        if (mode === 'realtime' && audioEl) {
            setMode('realtime');
            audioEl.addEventListener('play', function onPlay() { fitCanvas(); if (mode === 'realtime' && !rafId && attached) raf(drawRealtime); });
        }
        return { canvas: canvas, setMode: setMode, setSource: setSource, setTrackUrl: setTrackUrl, resize: fitCanvas, destroy: function () { stopRealtime(); if (container && canvas.parentNode === container) container.removeChild(canvas); } };
    }
    global.Soundwave = { create: createSoundwave, audio: Audio, render: Render };
})(typeof window !== 'undefined' ? window : this);


/* =========================================
   LP 포인트 컬러 · 바이닐 색상
   - 앨범 커버에서 눈에 띄는 색 추출
   - 바이닐용 살짝 어둡게 + 따뜻한 톤으로 --lp-base, --lp-dark 적용
   ========================================= */

   (function() {
    'use strict';

    const colorCache = {};
    const ACHROMATIC_CHROMA_THRESHOLD = 22;
    const MIN_ACCENT_COUNT = 2;
    const DEFAULT_VINYL = { r: 58, g: 40, b: 24 };

    function getChroma(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max - min;
    }
    function isAchromatic(r, g, b) {
        return getChroma(r, g, b) < ACHROMATIC_CHROMA_THRESHOLD;
    }
    function rgbDistance(a, b) {
        return Math.sqrt(
            (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
        );
    }

    /** 배경과 가장 대비되는 "눈에 띄는" 색을 포인트 컬러로 반환 */
    function extractPointColor(imageUrl, callback) {
        if (colorCache[imageUrl]) {
            callback(colorCache[imageUrl]);
            return;
        }
        const img = new Image();
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            if (!imageUrl.startsWith(window.location.origin)) {
                // img.crossOrigin = 'anonymous';
            }
        }
        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 60;
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);

                const imageData = ctx.getImageData(0, 0, size, size);
                const data = imageData.data;
                const colorMap = {};
                const sampleStep = 8;

                for (let i = 0; i < data.length; i += sampleStep * 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
                    if (a < 128) continue;
                    const rG = Math.floor(r / 15) * 15;
                    const gG = Math.floor(g / 15) * 15;
                    const bG = Math.floor(b / 15) * 15;
                    const key = `${rG},${gG},${bG}`;
                    if (!colorMap[key]) colorMap[key] = { r, g, b, count: 0 };
                    colorMap[key].count++;
                }

                let bg = { r: 128, g: 128, b: 128 };
                let bgCount = 0;
                let globalMaxCount = 0;
                let globalDominant = { ...DEFAULT_VINYL };

                for (const key in colorMap) {
                    const c = colorMap[key];
                    if (c.count > globalMaxCount) {
                        globalMaxCount = c.count;
                        globalDominant = c;
                    }
                    if (isAchromatic(c.r, c.g, c.b) && c.count > bgCount) {
                        bgCount = c.count;
                        bg = c;
                    }
                }
                if (bgCount === 0) bg = globalDominant;

                let best = null;
                let bestScore = 0;
                for (const key in colorMap) {
                    const c = colorMap[key];
                    if (isAchromatic(c.r, c.g, c.b) || c.count < MIN_ACCENT_COUNT) continue;
                    const score = getChroma(c.r, c.g, c.b) * rgbDistance(c, bg) * Math.log2(c.count + 1);
                    if (score > bestScore) {
                        bestScore = score;
                        best = c;
                    }
                }

                const pointColor = best || { ...DEFAULT_VINYL };
                colorCache[imageUrl] = pointColor;
                callback(pointColor);
            } catch (e) {
                colorCache[imageUrl] = { ...DEFAULT_VINYL };
                callback(colorCache[imageUrl]);
            }
        };
        img.onerror = function() {
            colorCache[imageUrl] = { ...DEFAULT_VINYL };
            callback(colorCache[imageUrl]);
        };
        img.src = imageUrl;
    }

    /** 포인트 컬러를 바이닐 톤으로 조정 — 과하게 어둡지 않게, 톤은 살짝 따뜻하게 */
    function darkenForVinyl(rgb) {
        const factor = 0.78;      /* 어둡게 비율 완화 (0.55 → 0.78): 원색이 더 보이게 */
        const minBrightness = 45; /* 최소 밝기 상향: 너무 침침하지 않게 */
        let r = Math.max(minBrightness, Math.min(255, Math.floor(rgb.r * factor)));
        let g = Math.max(minBrightness, Math.min(255, Math.floor(rgb.g * factor)));
        let b = Math.max(minBrightness, Math.min(255, Math.floor(rgb.b * factor)));
        /* 바이닐 느낌을 위한 아주 살짝의 따뜻한 믹스 (기존보다 많이 완화) */
        r = Math.min(255, Math.floor(r * 0.98 + 6));
        g = Math.min(255, Math.floor(g * 0.97 + 4));
        b = Math.min(255, Math.floor(b * 0.95 + 2));
        return { r, g, b };
    }

    function updateVinylColor(rgb) {
        const baseColor = darkenForVinyl(rgb);
        const lpDisc = document.querySelector('.lp-disc');
        if (!lpDisc) return;
        const base = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
        /* 엣지 어두움 완화 (0.65 → 0.88): 포인트 컬러가 더 잘 드러나도록 */
        const darkR = Math.floor(baseColor.r * 0.88);
        const darkG = Math.floor(baseColor.g * 0.88);
        const darkB = Math.floor(baseColor.b * 0.88);
        const dark = `rgb(${darkR}, ${darkG}, ${darkB})`;
        lpDisc.style.setProperty('--lp-base', base);
        lpDisc.style.setProperty('--lp-dark', dark);
    }

    window.extractPointColor = extractPointColor;
    window.updateVinylColor = updateVinylColor;
})();
