// Tiny synthesised sound effects with WebAudio: no audio files, no network.
// Everything is a short oscillator envelope. The context is created lazily
// on the first user gesture; if audio is unavailable the calls are no-ops.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let stepAt = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    const c = ensure();
    if (!c || muted) return;
    try {
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound must never break the game.
    }
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    pickup() {
      tone(740, 0.12, 'sine', 0.16);
      tone(1108, 0.18, 'sine', 0.14, 0.07);
    },
    alarm() {
      tone(196, 0.22, 'sawtooth', 0.12, 0, 392);
      tone(196, 0.22, 'sawtooth', 0.12, 0.2, 392);
    },
    caught() {
      tone(320, 0.5, 'sawtooth', 0.14, 0, 70);
    },
    clear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.09));
    },
    step(now) {
      // Soft footstep tick, throttled so it stays subtle.
      if (now - stepAt < 0.28) return;
      stepAt = now;
      tone(140, 0.05, 'sine', 0.035);
    },
  };
}
