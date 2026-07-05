/**
 * Shared Audio Kit — procedural Web Audio helpers
 *
 * Extracts the audio plumbing repeated across every scene: noise sources,
 * filtered-noise chains, master gain wiring, tracked timers, and cleanup.
 * Sound *design* (which layers, which frequencies, which critters) stays
 * in each scene — this kit only removes the boilerplate.
 *
 * Usage (with shared/scene-ui.js):
 *   let engine = null;
 *   initSceneAudio({
 *     onStart(vol) {
 *       engine = createAudioEngine(vol);
 *       const wind = engine.filteredNoise({ type: 'bandpass', freq: 520, Q: 0.7, gain: 0.05 });
 *       engine.schedule(function gust() {
 *         engine.ramp(wind.gain, 0.03 + Math.random() * 0.07, 3);
 *       }, 3000, 5000);
 *     },
 *     onStop() { engine.stop(); engine = null; },
 *     onVolumeChange(v) { engine.setVolume(v); },
 *   });
 */

/**
 * @param {number} vol — initial volume, 0-100 (slider value)
 * @param {Object} [opts]
 * @param {number} [opts.scale=0.5] — master gain at vol=100
 */
function createAudioEngine(vol, opts) {
  opts = opts || {};
  const scale = opts.scale === undefined ? 0.5 : opts.scale;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.setValueAtTime((vol / 100) * scale, ctx.currentTime);
  master.connect(ctx.destination);

  const timers = [];
  let running = true;

  /* ---- noise buffers ---- */

  /** Looping white-noise source (not started, not connected). */
  function whiteNoiseSrc(seconds) {
    const sz = ctx.sampleRate * (seconds || 2);
    const abuf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const d = abuf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = abuf;
    src.loop = true;
    return src;
  }

  /** Looping brown-noise source (deep rumble base; not started). */
  function brownNoiseSrc(seconds) {
    const sz = ctx.sampleRate * (seconds || 4);
    const abuf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const d = abuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < sz; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = abuf;
    src.loop = true;
    return src;
  }

  /**
   * Noise → biquad filter → gain → master, started immediately.
   * @param {Object} p — { type:'bandpass'|'highpass'|'lowpass', freq, Q, gain, brown }
   * @returns {{ src, filter, gain }} — mutate gain.gain / filter.frequency to animate
   */
  function filteredNoise(p) {
    const src = p.brown ? brownNoiseSrc() : whiteNoiseSrc();
    const filter = ctx.createBiquadFilter();
    filter.type = p.type || 'bandpass';
    filter.frequency.value = p.freq || 500;
    if (p.Q !== undefined) filter.Q.value = p.Q;
    const gain = ctx.createGain();
    gain.gain.value = p.gain === undefined ? 0.05 : p.gain;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start();
    return { src, filter, gain };
  }

  /* ---- envelopes & scheduling ---- */

  /** Linear-ramp a GainNode to `target` over `sec` seconds. */
  function ramp(gainNode, target, sec) {
    const t = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.setValueAtTime(gainNode.gain.value, t);
    gainNode.gain.linearRampToValueAtTime(target, t + sec);
  }

  /** setTimeout that is cancelled by stop(). */
  function later(fn, ms) {
    timers.push(setTimeout(() => { if (running) fn(); }, ms));
  }

  /**
   * Run fn now-ish and keep rescheduling it at a random interval in
   * [minMs, maxMs]. fn may return a number to override the next delay.
   */
  function schedule(fn, minMs, maxMs, initialMs) {
    function loop() {
      if (!running) return;
      const next = fn();
      later(loop, typeof next === 'number' ? next : minMs + Math.random() * (maxMs - minMs));
    }
    later(loop, initialMs === undefined ? minMs + Math.random() * (maxMs - minMs) : initialMs);
  }

  /** Master volume from a 0-100 slider value. */
  function setVolume(v) {
    master.gain.setValueAtTime((v / 100) * scale, ctx.currentTime);
  }

  /** Cancel all timers and close the AudioContext. */
  function stop() {
    running = false;
    timers.forEach(clearTimeout);
    timers.length = 0;
    ctx.close();
  }

  return {
    ctx, master,
    whiteNoiseSrc, brownNoiseSrc, filteredNoise,
    ramp, later, schedule, setVolume, stop,
    get running() { return running; },
  };
}
