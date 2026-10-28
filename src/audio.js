// Motor de efectos de sonido sintetizados mediante Web Audio API
// Funciona 100% offline sin archivos de audio externos ni retardos de red

class SoundEffectsEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;

    // Estado de la música de fondo sintetizada (BGM)
    this.bgmPlaying = false;
    this.bgmHurry = false;
    this.bgmTimer = null;
    this.bgmNextTime = 0;
    this.bgmStep = 0;
    this.bgmGainNode = null;
    this.bgmBaseVolume = 0.14;

    // Patrón melódico de 32 pasos (semicorcheas) en tono tropical / marítimo
    this.bgmMelody = [
      // Compás 1: Motivo marítimo juguetón
      523.25, 0,      659.25, 0,      // C5, E5
      783.99, 0,      659.25, 0,      // G5, E5
      523.25, 0,      587.33, 659.25, // C5, D5, E5
      587.33, 0,      523.25, 0,      // D5, C5
      // Compás 2: Subida y respuesta alegre
      440.00, 0,      523.25, 0,      // A4, C5
      698.46, 0,      659.25, 0,      // F5, E5
      587.33, 0,      392.00, 493.88, // D5, G4, B4
      523.25, 0,      0,      0       // C5
    ];

    // Patrón de bajo elástico de 32 pasos
    this.bgmBass = [
      130.81, 0, 130.81, 0, // C3
      98.00,  0, 98.00,  0, // G2
      110.00, 0, 110.00, 0, // A2
      98.00,  0, 98.00,  0, // G2
      87.31,  0, 87.31,  0, // F2
      110.00, 0, 110.00, 0, // A2
      98.00,  0, 98.00,  0, // G2
      130.81, 0, 98.00,  0  // C3, G2
    ];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && !this.bgmGainNode) {
      this.bgmGainNode = this.ctx.createGain();
      this.bgmGainNode.gain.setValueAtTime(this.muted ? 0 : this.bgmBaseVolume, this.ctx.currentTime);
      this.bgmGainNode.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.bgmGainNode && this.ctx) {
      this.bgmGainNode.gain.setValueAtTime(this.muted ? 0 : this.bgmBaseVolume, this.ctx.currentTime);
    }
    return this.muted;
  }

  // Iniciar música de fondo sintetizada (100% offline, cero latencia)
  startBGM(isHurry = false) {
    this.init();
    if (!this.ctx) return;
    this.bgmHurry = isHurry;

    if (this.bgmPlaying) return;

    this.bgmPlaying = true;
    this.bgmStep = 0;
    this.bgmNextTime = this.ctx.currentTime + 0.05;

    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
    }
    this.bgmTimer = setInterval(() => {
      this.schedulerBGM();
    }, 25);
  }

  // Activar o desactivar modo apresurado (cuando el tiempo se va a acabar)
  setBGMHurry(isHurry) {
    if (this.bgmHurry === isHurry) return;
    this.bgmHurry = isHurry;
    if (!this.bgmPlaying || !this.ctx) return;

    // Al entrar en modo apuro, recalibramos para que la aceleración se sienta en el acto
    if (isHurry && this.bgmNextTime > this.ctx.currentTime + 0.07) {
      this.bgmNextTime = this.ctx.currentTime + 0.02;
    }
  }

  // Detener música de fondo
  stopBGM() {
    this.bgmPlaying = false;
    this.bgmHurry = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmStep = 0;
  }

  // Planificador anticipado Web Audio (Lookahead Scheduler) para precisión rítmica sin jitter
  schedulerBGM() {
    if (!this.bgmPlaying || !this.ctx) return;

    const scheduleAheadTime = 0.12; // ventana de adelanto de 120ms
    while (this.bgmNextTime < this.ctx.currentTime + scheduleAheadTime) {
      this.playBGMStep(this.bgmStep, this.bgmNextTime, this.bgmHurry);

      // Tempo dinámico:
      // Normal: 115 BPM (semicorchea ≈ 0.1304s)
      // Apuro / Hurry: 180 BPM (semicorchea ≈ 0.0833s) -> ¡Suena mucho más rápido y emocionante!
      const bpm = this.bgmHurry ? 180 : 115;
      const stepDuration = 60 / bpm / 4;

      this.bgmNextTime += stepDuration;
      this.bgmStep = (this.bgmStep + 1) % 32;
    }
  }

  // Generación y síntesis de notas para cada paso rítmico
  playBGMStep(step, time, isHurry) {
    if (this.muted || !this.ctx || !this.bgmGainNode) return;

    // 1. Melodía de marimba (onda triangular con filtro cálido)
    const melodyFreq = this.bgmMelody[step];
    if (melodyFreq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(melodyFreq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isHurry ? 2600 : 1900, time);

      const noteDuration = isHurry ? 0.10 : 0.16;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.24, time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGainNode);

      osc.start(time);
      osc.stop(time + noteDuration + 0.02);
    }

    // 2. Bajo elástico (onda senoidal pura y redonda)
    const bassFreq = this.bgmBass[step];
    if (bassFreq > 0) {
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bassFreq, time);

      const bassDuration = isHurry ? 0.12 : 0.20;
      bGain.gain.setValueAtTime(0.001, time);
      bGain.gain.linearRampToValueAtTime(0.30, time + 0.008);
      bGain.gain.exponentialRampToValueAtTime(0.001, time + bassDuration);

      bOsc.connect(bGain);
      bGain.connect(this.bgmGainNode);

      bOsc.start(time);
      bOsc.stop(time + bassDuration + 0.02);
    }

    // 3. Percusión acústica (Woodblock y Shaker rítmico)
    const isDownbeat = (step % 8 === 4); // tiempos 2 y 4 de cada compás
    const isOffbeat = (step % 2 === 0);

    if (isDownbeat) {
      const percOsc = this.ctx.createOscillator();
      const percGain = this.ctx.createGain();
      percOsc.type = 'square';
      percOsc.frequency.setValueAtTime(isHurry ? 1200 : 950, time);
      percOsc.frequency.exponentialRampToValueAtTime(250, time + 0.04);

      percGain.gain.setValueAtTime(0.08, time);
      percGain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      percOsc.connect(percGain);
      percGain.connect(this.bgmGainNode);

      percOsc.start(time);
      percOsc.stop(time + 0.05);
    } else if (isOffbeat || isHurry) {
      const tickOsc = this.ctx.createOscillator();
      const tickGain = this.ctx.createGain();
      tickOsc.type = 'triangle';
      tickOsc.frequency.setValueAtTime(isHurry ? 2600 : 1800, time);

      const tickVol = isHurry ? 0.045 : 0.025;
      tickGain.gain.setValueAtTime(tickVol, time);
      tickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.028);

      tickOsc.connect(tickGain);
      tickGain.connect(this.bgmGainNode);

      tickOsc.start(time);
      tickOsc.stop(time + 0.03);
    }
  }

  // Sonido de salto ("Boing / Woosh" elástico hacia arriba)
  playJump() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.28);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.32);
  }

  // Sonido de entrada al agua ("Splash!" con burbujas)
  playSplash() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Generador de ruido blanco filtrado para el splash
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.38);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);

    // Burbujas agudas líquidas ("plop - plop")
    [0.05, 0.12, 0.2].forEach((delay, idx) => {
      const bubble = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bubble.type = 'sine';
      const baseFreq = 500 + idx * 250;
      bubble.frequency.setValueAtTime(baseFreq, t + delay);
      bubble.frequency.exponentialRampToValueAtTime(baseFreq + 350, t + delay + 0.08);

      bGain.gain.setValueAtTime(0.15, t + delay);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);

      bubble.connect(bGain);
      bGain.connect(this.ctx.destination);

      bubble.start(t + delay);
      bubble.stop(t + delay + 0.09);
    });
  }

  // Sonido de caída en tierra seca ("Thud / Plop sordo")
  playDirtThud() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.26);
  }

  // Sonido de respuesta correcta (Campanilla alegre y brillante)
  playCorrect() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const t = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      gain.gain.setValueAtTime(0.2, t + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.3);
    });
  }

  // Sonido de error (Buzzer descendente)
  playWrong() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  // Sonido de tic de reloj (últimos segundos)
  playTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // Fanfarria de victoria
  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [
      { f: 523.25, d: 0.12 }, // C5
      { f: 659.25, d: 0.12 }, // E5
      { f: 783.99, d: 0.12 }, // G5
      { f: 1046.5, d: 0.38 }  // C6
    ];

    let start = this.ctx.currentTime;
    notes.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + note.d + 0.05);

      start += note.d * 0.85;
    });
  }

  // Melodía de fin de partida (Game Over)
  playGameOver() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [440, 415.3, 392, 349.2]; // A4, G#4, G4, F4
    let start = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      const duration = idx === 3 ? 0.6 : 0.25;
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.05);

      start += duration * 0.9;
    });
  }
}

export const sounds = new SoundEffectsEngine();
