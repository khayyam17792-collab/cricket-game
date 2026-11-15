import type { BallOutcomeCode } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    this.ensureContext();
  }

  /** Soft leather bounce sound on clay pitch */
  public playPitchBounce(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.085);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  /** Air whoosh when bat swings without clean contact */
  public playBatSwing(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(1150, now + 0.07);
    filter.frequency.exponentialRampToValueAtTime(280, now + 0.14);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /** Crisp leather-on-willow crack scaled by shot quality */
  public playBatHit(outcome: BallOutcomeCode): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isBig = outcome === '6' || outcome === '4';
    const baseFreq = outcome === '6' ? 255 : outcome === '4' ? 220 : 175;
    const peakGain = outcome === '6' ? 0.48 : outcome === '4' ? 0.38 : 0.24;

    // Resonant willow body thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * 1.9, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.42, now + 0.12);

    oscGain.gain.setValueAtTime(peakGain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);

    // Sweet-spot wood crack transient
    const snapLen = Math.floor(ctx.sampleRate * 0.055);
    const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapLen; i++) {
      snapData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snapLen, 2.0);
    }
    const snap = ctx.createBufferSource();
    snap.buffer = snapBuf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = isBig ? 1650 : 1100;
    bp.Q.value = 1.1;

    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(isBig ? 0.42 : 0.24, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    snap.connect(bp);
    bp.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(now);

    if (isBig) {
      this.playCrowdCheer(outcome === '6' ? 1.2 : 0.85);
    }
  }

  /** Wooden stump rattle + bail clatter + crowd gasp when bowled */
  public playBowledWicket(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Staggered hollow hardwood hits for 3 stumps + 2 bails bouncing
    const hits = [
      { delay: 0, freq: 540, dur: 0.13, vol: 0.34 },
      { delay: 0.04, freq: 720, dur: 0.11, vol: 0.3 },
      { delay: 0.095, freq: 440, dur: 0.12, vol: 0.28 },
      { delay: 0.16, freq: 860, dur: 0.08, vol: 0.2 },
      { delay: 0.23, freq: 620, dur: 0.08, vol: 0.15 },
    ];

    hits.forEach(({ delay, freq, dur, vol }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(145, now + delay + dur);

      gain.gain.setValueAtTime(vol, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur + 0.01);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    });

    // Crisp timber crack noise burst
    const crackLen = Math.floor(ctx.sampleRate * 0.07);
    const crackBuf = ctx.createBuffer(1, crackLen, ctx.sampleRate);
    const crackCh = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) {
      crackCh[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackLen, 2.5);
    }
    const crackSrc = ctx.createBufferSource();
    crackSrc.buffer = crackBuf;
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = 'bandpass';
    crackFilter.frequency.value = 1900;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.32, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    crackSrc.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackSrc.start(now);

    // Crowd gasp / groan swell
    const len = Math.floor(ctx.sampleRate * 1.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      ch[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(580, now);
    bp.frequency.linearRampToValueAtTime(260, now + 0.95);
    bp.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /** Crisp catch impact in hands + immediate crowd gasp swelling into stadium roar */
  public playCaughtWicket(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Leather-in-hands catch thump
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(195, now);
    thud.frequency.exponentialRampToValueAtTime(58, now + 0.085);
    thudGain.gain.setValueAtTime(0.36, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.1);

    // 2. Sharp crowd gasp followed immediately by roar
    const gaspLen = Math.floor(ctx.sampleRate * 0.42);
    const gaspBuf = ctx.createBuffer(1, gaspLen, ctx.sampleRate);
    const gaspCh = gaspBuf.getChannelData(0);
    for (let i = 0; i < gaspLen; i++) {
      const env = Math.sin((i / gaspLen) * Math.PI);
      gaspCh[i] = (Math.random() * 2 - 1) * env;
    }
    const gaspSrc = ctx.createBufferSource();
    gaspSrc.buffer = gaspBuf;
    const gaspBp = ctx.createBiquadFilter();
    gaspBp.type = 'bandpass';
    gaspBp.frequency.setValueAtTime(720, now);
    gaspBp.frequency.linearRampToValueAtTime(1250, now + 0.35);
    gaspBp.Q.value = 1.2;
    const gaspGain = ctx.createGain();
    gaspGain.gain.setValueAtTime(0.24, now);
    gaspGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    gaspSrc.connect(gaspBp);
    gaspBp.connect(gaspGain);
    gaspGain.connect(ctx.destination);
    gaspSrc.start(now);

    // 3. Stadium roar celebration
    this.playCrowdCheer(1.15);
  }

  /** Multi-layered roaring stadium crowd cheer for boundaries & victory */
  public playCrowdCheer(intensity = 0.9): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 1.65;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = t < 0.14 ? t / 0.14 : Math.pow(1 - (t - 0.14) / 0.86, 1.25);
      ch[i] = (Math.random() * 2 - 1) * env;
    }

    // Low stadium rumble layer
    const srcLow = ctx.createBufferSource();
    srcLow.buffer = buf;
    const bpLow = ctx.createBiquadFilter();
    bpLow.type = 'bandpass';
    bpLow.frequency.setValueAtTime(420, now);
    bpLow.frequency.linearRampToValueAtTime(640, now + 0.4);
    bpLow.frequency.linearRampToValueAtTime(360, now + duration);
    bpLow.Q.value = 0.7;
    const gLow = ctx.createGain();
    gLow.gain.setValueAtTime(0.22 * intensity, now);
    gLow.gain.exponentialRampToValueAtTime(0.001, now + duration);
    srcLow.connect(bpLow);
    bpLow.connect(gLow);
    gLow.connect(ctx.destination);
    srcLow.start(now);

    // High vocal roar shimmer layer
    const srcHigh = ctx.createBufferSource();
    srcHigh.buffer = buf;
    const bpHigh = ctx.createBiquadFilter();
    bpHigh.type = 'bandpass';
    bpHigh.frequency.setValueAtTime(1050, now);
    bpHigh.frequency.linearRampToValueAtTime(1450, now + 0.35);
    bpHigh.frequency.linearRampToValueAtTime(850, now + duration);
    bpHigh.Q.value = 0.9;
    const gHigh = ctx.createGain();
    gHigh.gain.setValueAtTime(0.14 * intensity, now);
    gHigh.gain.exponentialRampToValueAtTime(0.001, now + duration);
    srcHigh.connect(bpHigh);
    bpHigh.connect(gHigh);
    gHigh.connect(ctx.destination);
    srcHigh.start(now);
  }

  /** Synthesized aerial firework boom & crackle for Super Over victory */
  public playFireworkBurst(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep sky shell boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.24);
    oscGain.gain.setValueAtTime(0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);

    // Sparkling crackle burst
    const len = Math.floor(ctx.sampleRate * 0.42);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const crackle = Math.random() > 0.72 ? 1.0 : 0.2;
      ch[i] = (Math.random() * 2 - 1) * crackle * Math.pow(1 - t, 1.7);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);
    src.start(now + 0.02);
  }
}

export const soundEngine = new SoundEngine();
