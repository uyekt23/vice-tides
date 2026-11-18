// Vice Tides — all sound is synthesised with WebAudio: a sawtooth engine whose pitch
// follows speed, a two-tone siren, noise-burst collisions and gunshots, pickup chimes,
// UI clicks and a lazy generated radio loop (a four-chord pad with a soft bass) that
// only plays while driving. Nothing is loaded; the context wakes on the first click.

export function createAudio() {
  let ctx = null, master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0;
  let radioNodes = null, radioStep = 0, radioTimer = null;

  function wake() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  window.addEventListener('pointerdown', wake, { passive: true });
  window.addEventListener('keydown', wake);

  function noiseBurst(dur, freq, gain, type = 'lowpass') {
    if (!ctx) return;
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }
  function tone(freq, dur, gain, type = 'sine', slideTo = null, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // ---- engine: one saw through a lowpass, pitch = f(speed) ----
  function engine(on, speedRatio, dt) {
    if (!ctx) return;
    if (on && !engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 400;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    if (!engineOsc) return;
    const target = on ? 0.05 + Math.abs(speedRatio) * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + Math.abs(speedRatio) * 165, ctx.currentTime, 0.06);
    engineFilter.frequency.setTargetAtTime(300 + Math.abs(speedRatio) * 900, ctx.currentTime, 0.1);
    if (!on && engineGain.gain.value < 0.002) { try { engineOsc.stop(); } catch { /* already */ } engineOsc = null; }
  }

  // ---- siren: square wave alternating 660/880 while police are close ----
  function siren(on, dt) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
      sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    }
    if (!sirenOsc) return;
    if (!on) { try { sirenOsc.stop(); } catch { /* already */ } sirenOsc = null; sirenGain = null; return; }
    sirenTimer += dt;
    sirenOsc.frequency.value = (sirenTimer % 0.72) < 0.36 ? 660 : 880;
  }

  // ---- radio: I–V–vi–IV pad in A major, one chord every 2.4 s, while driving ----
  const CHORDS = [[220, 277, 330], [165, 208, 247], [185, 220, 277], [196, 247, 294]];
  function radio(on) {
    if (!ctx) return;
    if (on && !radioNodes) {
      radioNodes = { gain: ctx.createGain() };
      radioNodes.gain.gain.value = 0.05; radioNodes.gain.connect(master);
      const playChord = () => {
        if (!radioNodes) return;
        const chord = CHORDS[radioStep % CHORDS.length]; radioStep++;
        for (const f of chord) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.3);
          g.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 2.3);
          o.connect(g); g.connect(radioNodes.gain); o.start(); o.stop(ctx.currentTime + 2.4);
        }
        tone(chord[0] / 2, 1.8, 0.12, 'sine');
      };
      playChord();
      radioTimer = window.setInterval(playChord, 2400);
    }
    if (!on && radioNodes) {
      window.clearInterval(radioTimer); radioTimer = null;
      try { radioNodes.gain.disconnect(); } catch { /* gone */ }
      radioNodes = null;
    }
  }

  return {
    wake,
    engine, siren, radio,
    click() { tone(880, 0.07, 0.12, 'square'); },
    pickup() { tone(660, 0.1, 0.16, 'sine'); tone(990, 0.14, 0.16, 'sine', null, 0.07); },
    cash() { tone(1180, 0.09, 0.15, 'square'); tone(1560, 0.16, 0.15, 'square', null, 0.06); },
    phone() { tone(1046, 0.12, 0.12, 'sine'); tone(1046, 0.12, 0.12, 'sine', null, 0.18); },
    crash(strength = 1) { noiseBurst(0.22, 300, Math.min(0.5, 0.18 * strength)); tone(70, 0.2, 0.2 * strength, 'sine', 40); },
    thud() { noiseBurst(0.08, 500, 0.2); },
    shot() { noiseBurst(0.13, 2600, 0.4, 'highpass'); tone(150, 0.1, 0.25, 'square', 60); },
    empty() { tone(1400, 0.04, 0.08, 'square'); },
    hurt() { tone(220, 0.15, 0.2, 'sawtooth', 110); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 0.14, 'triangle', null, i * 0.09)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 0.14, 'triangle', null, i * 0.14)); },
  };
}
