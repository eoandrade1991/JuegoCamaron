import { sounds } from './audio.js';
import confetti from 'canvas-confetti';

export class ShrimpJumpGame {
  constructor(canvas, uiCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = uiCallbacks; // onStateChange, onScoreUpdate, onLivesUpdate, onTimerUpdate, onQuestionUpdate, onGameOver, onVictory

    this.quiz = null;
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.lives = 3;
    this.maxLives = 3;
    this.timeRemaining = 20;
    this.timerInterval = null;
    this.isInputBlocked = false;

    // Estado de la animación
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTime = performance.now();

    // Entidades del mundo
    this.shrimp = {
      x: 0,
      y: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      jumpProgress: 0,
      isJumping: false,
      jumpSuccess: false,
      targetOptionIndex: -1,
      rotation: 0,
      scale: 1,
      state: 'idle', // 'idle', 'jumping', 'landed_success', 'landed_fail'
      bobTimer: 0,
      wobble: 0
    };

    this.pools = []; // Piscinas visibles (origen + opciones A, B, C, D)
    this.particles = [];
    this.ripples = [];
    this.aerators = [];

    // Dimensiones lógicas virtuales (ancho y alto del mundo)
    this.vWidth = 1000;
    this.vHeight = 650;
    this.scaleFactor = 1;

    this.setupResize();
    this.setupInteractions();
  }

  setupResize() {
    this.resize = () => {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.scaleFactor = (rect.width * dpr) / this.vWidth;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.scaleFactor, this.scaleFactor);
      this.actualHeight = (rect.height * dpr) / this.scaleFactor;

      // Reubicar dinámicamente si ya hay piscinas inicializadas
      if (this.pools && this.pools.length > 0 && !this.shrimp.isJumping) {
        this.repositionPoolsForMobile();
      }
    };

    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => {
      setTimeout(this.resize, 150);
    });
    this.resize();
  }

  setupInteractions() {
    const handleTapOrClick = (clientX, clientY) => {
      if (this.isInputBlocked || this.shrimp.isJumping) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const virtualX = x / (rect.width / this.vWidth);
      const virtualY = y / (rect.height / this.actualHeight);

      // Comprobar clic/toque en alguna de las piscinas de opciones
      this.pools.forEach((pool) => {
        if (pool.isOption && this.isPointInPool(virtualX, virtualY, pool)) {
          this.handleAnswerSelected(pool.optionIndex);
        }
      });
    };

    this.canvas.addEventListener('click', (e) => {
      handleTapOrClick(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        handleTapOrClick(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    // Soporte para cursor pointer al pasar por una piscina (escritorio)
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isInputBlocked || this.shrimp.isJumping) {
        this.canvas.style.cursor = 'default';
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      const virtualX = clientX / (rect.width / this.vWidth);
      const virtualY = clientY / (rect.height / this.actualHeight);

      let isHovering = false;
      this.pools.forEach((pool) => {
        if (pool.isOption && this.isPointInPool(virtualX, virtualY, pool)) {
          isHovering = true;
          pool.hovered = true;
        } else {
          pool.hovered = false;
        }
      });
      this.canvas.style.cursor = isHovering ? 'pointer' : 'default';
    });
  }

  repositionPoolsForMobile() {
    const targetHeight = this.actualHeight || this.vHeight;
    const originY = Math.max(380, targetHeight - 95);
    const destY = Math.max(160, Math.min(270, targetHeight * 0.42));

    this.pools.forEach((pool) => {
      if (!pool.isOption) {
        pool.y = originY;
        if (!this.shrimp.isJumping) {
          this.shrimp.y = originY;
          this.shrimp.startY = originY;
        }
      } else {
        const count = this.pools.filter(p => p.isOption).length;
        pool.y = destY + Math.abs(pool.optionIndex - (count - 1) / 2) * 14;
      }
    });
  }

  isPointInPool(px, py, pool) {
    return (
      px >= pool.x - pool.w / 2 &&
      px <= pool.x + pool.w / 2 &&
      py >= pool.y - pool.h / 2 &&
      py <= pool.y + pool.h / 2
    );
  }

  // Algoritmo de barajado Fisher-Yates estadísticamente insesgado
  shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  start(quiz) {
    this.quiz = JSON.parse(JSON.stringify(quiz));
    if (this.quiz.randomizeQuestions && Array.isArray(this.quiz.questions)) {
      this.quiz.questions = this.shuffleArray(this.quiz.questions);
    }

    this.currentQuestionIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.lives = this.quiz.lives || 3;
    this.maxLives = this.lives;
    this.isInputBlocked = false;

    this.ui.onScoreUpdate(this.score, this.streak);
    this.ui.onLivesUpdate(this.lives, this.maxLives);

    this.initPondsForQuestion();
    sounds.startBGM(false);
    this.startTimer();

    this.isRunning = true;
    this.lastTime = performance.now();
    cancelAnimationFrame(this.animationFrameId);
    this.loop = (now) => {
      if (!this.isRunning) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.animationFrameId = requestAnimationFrame(this.loop);
    };
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
    this.stopTimer();
    sounds.stopBGM();
  }

  initPondsForQuestion() {
    const qData = this.quiz.questions[this.currentQuestionIndex];
    if (!qData) return;

    // Preparar y mezclar opciones si está habilitado
    let optionsWithMeta = qData.options.map((optText, origIdx) => ({
      text: optText,
      originalIndex: origIdx,
      isCorrect: origIdx === qData.correctAnswer
    }));

    if (this.quiz.randomizeAnswers) {
      optionsWithMeta = this.shuffleArray(optionsWithMeta);
    }
    this.currentOptions = optionsWithMeta;

    // Configurar piscinas
    this.pools = [];
    const count = optionsWithMeta.length;

    // Piscina de origen (donde está el camarón actualmente, abajo al centro)
    const originPool = {
      id: 'origin',
      x: this.vWidth * 0.5,
      y: 520,
      w: 190,
      h: 110,
      isOption: false,
      color: '#0284c7'
    };
    this.pools.push(originPool);

    // Camarón ubicado en la piscina de origen
    this.shrimp.x = originPool.x;
    this.shrimp.y = originPool.y;
    this.shrimp.startX = originPool.x;
    this.shrimp.startY = originPool.y;
    this.shrimp.state = 'idle';
    this.shrimp.isJumping = false;

    // Distribuir piscinas de destino arriba con vista 2.5D
    const letters = ['A', 'B', 'C', 'D'];
    const colors = ['#0ea5e9', '#38bdf8', '#0284c7', '#0369a1'];
    const badgeColors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899'];

    const totalWidthAvailable = this.vWidth * 0.9;
    const spacing = totalWidthAvailable / count;
    const startX = (this.vWidth - totalWidthAvailable) / 2 + spacing / 2;

    optionsWithMeta.forEach((opt, idx) => {
      const poolW = Math.min(170, spacing * 0.85);
      const poolH = 100;
      const posX = startX + idx * spacing;
      // Ligero arco vertical para perspectiva 2.5D
      const posY = 260 + Math.abs(idx - (count - 1) / 2) * 20;

      this.pools.push({
        id: `opt-${idx}`,
        optionIndex: idx,
        originalIndex: opt.originalIndex,
        isOption: true,
        letter: letters[idx],
        text: opt.text,
        isCorrect: opt.isCorrect,
        x: posX,
        y: posY,
        w: poolW,
        h: poolH,
        color: colors[idx % colors.length],
        badgeColor: badgeColors[idx % badgeColors.length],
        hovered: false,
        status: 'normal' // 'normal', 'correct', 'wrong'
      });
    });

    // Aireadores decorativos en los bordes de la camaronera
    this.aerators = [
      { x: 70, y: 390, angle: 0, speed: 4 },
      { x: this.vWidth - 70, y: 390, angle: 1.5, speed: 4.2 }
    ];

    // Ajustar piscinas a la altura real de pantalla del móvil
    this.repositionPoolsForMobile();

    // Notificar UI externa para actualizar textos de pregunta y botones
    this.ui.onQuestionUpdate({
      questionNumber: this.currentQuestionIndex + 1,
      totalQuestions: this.quiz.questions.length,
      questionText: qData.question,
      options: optionsWithMeta
    });

    // Restablecer tempo normal de la música para la nueva pregunta
    sounds.setBGMHurry(false);
  }

  startTimer() {
    this.stopTimer();
    const timeLimit = this.quiz.timePerQuestion || 0;
    if (timeLimit <= 0) {
      this.ui.onTimerUpdate(null);
      sounds.setBGMHurry(false);
      return;
    }

    this.timeRemaining = timeLimit;
    this.ui.onTimerUpdate(this.timeRemaining, timeLimit);
    sounds.setBGMHurry(this.timeRemaining <= 5 && this.timeRemaining > 0);

    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.ui.onTimerUpdate(this.timeRemaining, timeLimit);

      // Si quedan 5 segundos o menos, acelerar la música y reproducir tics de urgencia
      if (this.timeRemaining <= 5 && this.timeRemaining > 0) {
        sounds.setBGMHurry(true);
        sounds.playTick();
      } else if (this.timeRemaining > 5) {
        sounds.setBGMHurry(false);
      }

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        sounds.setBGMHurry(false);
        this.handleTimeout();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleAnswerSelected(optionIndex) {
    if (this.isInputBlocked || this.shrimp.isJumping) return;
    this.stopTimer();
    sounds.setBGMHurry(false);
    this.isInputBlocked = true;

    const chosenPool = this.pools.find((p) => p.isOption && p.optionIndex === optionIndex);
    if (!chosenPool) return;

    const isCorrect = chosenPool.isCorrect;

    // Iniciar salto del camarón
    this.shrimp.isJumping = true;
    this.shrimp.jumpSuccess = isCorrect;
    this.shrimp.targetOptionIndex = optionIndex;
    this.shrimp.startX = this.shrimp.x;
    this.shrimp.startY = this.shrimp.y;

    if (isCorrect) {
      this.shrimp.targetX = chosenPool.x;
      this.shrimp.targetY = chosenPool.y;
    } else {
      // Si es incorrecto, cae en la tierra seca cerca de la piscina elegida
      const offsetSign = chosenPool.x > this.shrimp.startX ? 1 : -1;
      this.shrimp.targetX = chosenPool.x - offsetSign * 65;
      this.shrimp.targetY = chosenPool.y + 70;
    }

    this.shrimp.jumpProgress = 0;
    this.shrimp.state = 'jumping';
    sounds.playJump();
  }

  handleTimeout() {
    if (this.isInputBlocked || this.shrimp.isJumping) return;
    this.isInputBlocked = true;
    sounds.setBGMHurry(false);

    // Resaltar la respuesta correcta
    this.pools.forEach((p) => {
      if (p.isOption) {
        if (p.isCorrect) p.status = 'correct';
      }
    });

    sounds.playWrong();
    this.lives--;
    this.streak = 0;
    this.ui.onLivesUpdate(this.lives, this.maxLives);
    this.ui.onScoreUpdate(this.score, this.streak);

    // Animación de sorpresa/humo en tierra
    this.createDustParticles(this.shrimp.x, this.shrimp.y, 15);

    setTimeout(() => {
      this.checkGameProgression(false);
    }, 2200);
  }

  onJumpLanded() {
    this.shrimp.isJumping = false;
    const isCorrect = this.shrimp.jumpSuccess;
    const chosenPool = this.pools.find((p) => p.isOption && p.optionIndex === this.shrimp.targetOptionIndex);

    if (isCorrect) {
      this.shrimp.state = 'landed_success';
      sounds.playSplash();
      sounds.playCorrect();

      if (chosenPool) chosenPool.status = 'correct';

      // Efectos de partículas de agua y ondas
      this.createSplashParticles(this.shrimp.targetX, this.shrimp.targetY);
      this.createRipple(this.shrimp.targetX, this.shrimp.targetY, '#38bdf8');

      // Puntos y racha
      this.streak++;
      const timeBonus = Math.max(0, this.timeRemaining * 2);
      const pointsGained = (this.quiz.pointsPerCorrect || 100) + this.streak * 15 + timeBonus;
      this.score += pointsGained;

      this.createScorePopup(this.shrimp.targetX, this.shrimp.targetY - 50, `+${pointsGained}`);
      this.ui.onScoreUpdate(this.score, this.streak);

      setTimeout(() => {
        this.checkGameProgression(true);
      }, 1600);
    } else {
      this.shrimp.state = 'landed_fail';
      sounds.playDirtThud();
      sounds.playWrong();

      if (chosenPool) chosenPool.status = 'wrong';

      // Revelar también la correcta
      this.pools.forEach((p) => {
        if (p.isOption && p.isCorrect) p.status = 'correct';
      });

      // Partículas de tierra seca
      this.createDustParticles(this.shrimp.targetX, this.shrimp.targetY, 25);
      this.createScorePopup(this.shrimp.targetX, this.shrimp.targetY - 45, '¡Tierra seca! 💥', '#ef4444');

      this.lives--;
      this.streak = 0;
      this.ui.onLivesUpdate(this.lives, this.maxLives);
      this.ui.onScoreUpdate(this.score, this.streak);

      // El camarón regresa coleando al agua tras el fallo
      setTimeout(() => {
        this.crawlBackToSafety();
      }, 1200);

      setTimeout(() => {
        this.checkGameProgression(false);
      }, 2500);
    }
  }

  crawlBackToSafety() {
    const origin = this.pools.find((p) => p.id === 'origin');
    if (!origin) return;
    this.shrimp.x = origin.x;
    this.shrimp.y = origin.y;
    this.shrimp.state = 'idle';
    this.createRipple(origin.x, origin.y, '#38bdf8');
  }

  checkGameProgression(wasCorrect) {
    if (this.lives <= 0) {
      this.stop();
      sounds.playGameOver();
      this.ui.onGameOver({
        score: this.score,
        questionsAnswered: this.currentQuestionIndex,
        totalQuestions: this.quiz.questions.length
      });
      return;
    }

    this.currentQuestionIndex++;
    if (this.currentQuestionIndex >= this.quiz.questions.length) {
      this.stop();
      sounds.playVictory();
      this.triggerVictoryConfetti();
      this.ui.onVictory({
        score: this.score,
        livesRemaining: this.lives,
        maxLives: this.maxLives,
        totalQuestions: this.quiz.questions.length
      });
      return;
    }

    // Avanzar a la siguiente pregunta
    this.isInputBlocked = false;
    this.initPondsForQuestion();
    this.startTimer();
  }

  triggerVictoryConfetti() {
    const end = Date.now() + 3.5 * 1000;
    const colors = ['#f97316', '#38bdf8', '#10b981', '#facc15', '#ec4899'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  // Creación de efectos visuales y partículas
  createSplashParticles(x, y) {
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 50;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        gravity: 400,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.4 ? '#67e8f9' : '#ffffff',
        alpha: 1,
        life: Math.random() * 0.6 + 0.4
      });
    }
  }

  createDustParticles(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 90 + 30;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        gravity: 120,
        size: Math.random() * 6 + 3,
        color: Math.random() > 0.5 ? '#a16207' : '#78350f',
        alpha: 0.9,
        life: Math.random() * 0.5 + 0.5
      });
    }
  }

  createRipple(x, y, color = '#60a5fa') {
    this.ripples.push({
      x: x,
      y: y,
      radius: 8,
      maxRadius: 55,
      alpha: 1,
      color: color,
      speed: 60
    });
  }

  createScorePopup(x, y, text, color = '#10b981') {
    this.particles.push({
      isText: true,
      text: text,
      x: x,
      y: y,
      vy: -55,
      alpha: 1,
      life: 1.2,
      color: color
    });
  }

  update(dt) {
    // Actualizar camarón
    if (this.shrimp.isJumping) {
      this.shrimp.jumpProgress += dt * 1.5; // duración del salto ~0.67s
      const t = Math.min(this.shrimp.jumpProgress, 1);

      // Arco parabólico suave
      this.shrimp.x = this.shrimp.startX + (this.shrimp.targetX - this.shrimp.startX) * t;
      const linearY = this.shrimp.startY + (this.shrimp.targetY - this.shrimp.startY) * t;
      const arcHeight = 160;
      this.shrimp.y = linearY - Math.sin(Math.PI * t) * arcHeight;

      // Rotación y giro en el aire
      this.shrimp.rotation = (t - 0.5) * 0.8;

      if (this.shrimp.jumpProgress >= 1) {
        this.shrimp.x = this.shrimp.targetX;
        this.shrimp.y = this.shrimp.targetY;
        this.shrimp.rotation = 0;
        this.onJumpLanded();
      }
    } else {
      this.shrimp.bobTimer += dt * 3;
      // Ondas periódicas mientras nada en la piscina
      if (Math.random() < 0.04 && this.shrimp.state === 'idle') {
        this.createRipple(this.shrimp.x, this.shrimp.y + 10, '#38bdf8');
      }
    }

    // Actualizar aireadores
    this.aerators.forEach((a) => {
      a.angle += a.speed * dt;
    });

    // Actualizar partículas
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.alpha = Math.max(0, p.life);
      if (p.isText) {
        p.y += p.vy * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
      }
    }

    // Actualizar ondas (ripples)
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed * dt;
      r.alpha = Math.max(0, 1 - r.radius / r.maxRadius);
      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.vWidth, this.actualHeight || this.vHeight);

    // 1. Dibujar suelo de tierra de la camaronera (Earthen aquaculture terrain)
    this.renderTerrain(ctx);

    // 2. Dibujar piscinas / estanques de cultivo
    this.pools.forEach((pool) => {
      this.renderPool(ctx, pool);
    });

    // 3. Dibujar ondas en el agua
    this.ripples.forEach((r) => {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.alpha * 0.7;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. Dibujar sombra del camarón (permanece en el suelo para efecto 3D)
    this.renderShrimpShadow(ctx);

    // 5. Dibujar camarón
    this.renderShrimp(ctx);

    // 6. Dibujar partículas (salpicaduras, polvo, textos flotantes)
    this.renderParticles(ctx);

    // 7. Dibujar aireadores de agua en los costados
    this.renderAerators(ctx);
  }

  renderTerrain(ctx) {
    // Fondo de tierra rica / arcilla camaronera
    const grad = ctx.createLinearGradient(0, 0, 0, this.actualHeight || this.vHeight);
    grad.addColorStop(0, '#5c3317');
    grad.addColorStop(0.5, '#784421');
    grad.addColorStop(1, '#663819');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.vWidth, this.actualHeight || this.vHeight);

    // Textura de montículos de tierra / camellones
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(0, i * 95, this.vWidth, 12);
    }

    // Motas de piedras y vegetación sutil
    ctx.fillStyle = 'rgba(74, 120, 42, 0.45)';
    const grassSpots = [
      [40, 160], [120, 520], [880, 500], [930, 200], [480, 150], [50, 480], [920, 360]
    ];
    grassSpots.forEach(([gx, gy]) => {
      ctx.beginPath();
      ctx.arc(gx, gy, 14, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderPool(ctx, pool) {
    ctx.save();

    // Sombra del foso de la piscina en la tierra
    ctx.fillStyle = 'rgba(25, 12, 5, 0.5)';
    ctx.beginPath();
    ctx.roundRect(pool.x - pool.w / 2 - 4, pool.y - pool.h / 2 + 6, pool.w + 8, pool.h + 8, 26);
    ctx.fill();

    // Borde de contención / dique de hormigón/arcilla
    let strokeColor = '#3b82f6';
    let borderWidth = 5;

    if (pool.status === 'correct') {
      strokeColor = '#10b981';
      borderWidth = 8;
    } else if (pool.status === 'wrong') {
      strokeColor = '#ef4444';
      borderWidth = 8;
    } else if (pool.hovered) {
      strokeColor = '#38bdf8';
      borderWidth = 7;
    }

    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = strokeColor;

    // Cuerpo de la piscina
    const poolGrad = ctx.createLinearGradient(pool.x, pool.y - pool.h / 2, pool.x, pool.y + pool.h / 2);
    poolGrad.addColorStop(0, '#0284c7');
    poolGrad.addColorStop(0.5, '#0369a1');
    poolGrad.addColorStop(1, '#0c4a6e');

    ctx.fillStyle = poolGrad;
    ctx.beginPath();
    ctx.roundRect(pool.x - pool.w / 2, pool.y - pool.h / 2, pool.w, pool.h, 24);
    ctx.fill();
    ctx.stroke();

    // Reflejo cáustico de agua dentro de la piscina
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y - 12, pool.w * 0.38, pool.h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Si es una piscina de opción (A, B, C, D)
    if (pool.isOption) {
      // Placa con la letra de la opción (A, B, C, D)
      const badgeY = pool.y - pool.h / 2 - 12;
      ctx.fillStyle = pool.badgeColor || '#f59e0b';
      ctx.beginPath();
      ctx.arc(pool.x, badgeY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Outfit, Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pool.letter, pool.x, badgeY);

      // Texto de la opción resumido dentro de la piscina para vista rápida
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxChars = 22;
      const displayTxt = pool.text.length > maxChars ? pool.text.substring(0, maxChars) + '...' : pool.text;
      ctx.fillText(displayTxt, pool.x, pool.y + 6);
    } else {
      // Piscina de origen: etiqueta "Base"
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌊 PISCINA DE ORIGEN', pool.x, pool.y + 36);
    }

    ctx.restore();
  }

  renderShrimpShadow(ctx) {
    ctx.save();
    let shadowY = this.shrimp.y;
    let scale = 1;

    if (this.shrimp.isJumping) {
      // La sombra permanece en la trayectoria del suelo
      const t = this.shrimp.jumpProgress;
      shadowY = this.shrimp.startY + (this.shrimp.targetY - this.shrimp.startY) * t;
      const currentHeight = shadowY - this.shrimp.y;
      scale = Math.max(0.4, 1 - currentHeight / 250);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    // Sombra más ancha para incluir las grandes pinzas de la langosta
    ctx.ellipse(this.shrimp.x, shadowY + 28, 38 * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderShrimp(ctx) {
    ctx.save();
    let x = this.shrimp.x;
    let y = this.shrimp.y;

    if (!this.shrimp.isJumping) {
      // Bobbing suave al flotar en el agua
      y += Math.sin(this.shrimp.bobTimer) * 4;
    }

    ctx.translate(x, y);
    ctx.rotate(this.shrimp.rotation);

    // Si falló y está en tierra seca, aplicar ligero temblor
    if (this.shrimp.state === 'landed_fail') {
      ctx.rotate(Math.sin(this.shrimp.bobTimer * 4) * 0.15);
    }

    // --- DIBUJADO VECTORIAL DE LA LANGOSTA (LOBSTER) ---
    const clawPinch = Math.sin(this.shrimp.bobTimer * 3) * 0.15; // Suave movimiento de pinzas

    // 1. Patitas caminadoras (4 pares a los lados)
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let leg = 0; leg < 4; leg++) {
      const legY = 4 + leg * 6;
      // Pata izquierda
      ctx.beginPath();
      ctx.moveTo(-14, legY);
      ctx.quadraticCurveTo(-26, legY + 2, -32, legY + 12);
      ctx.stroke();

      // Pata derecha
      ctx.beginPath();
      ctx.moveTo(14, legY);
      ctx.quadraticCurveTo(26, legY + 2, 32, legY + 12);
      ctx.stroke();
    }

    // 2. Abanico Caudal / Cola (Telson central + Urópodos laterales con forma de abanico)
    const tailColors = ['#991b1b', '#b91c1c', '#dc2626'];
    ctx.fillStyle = tailColors[1];
    ctx.beginPath();
    // Telson central
    ctx.moveTo(0, 26);
    ctx.lineTo(-9, 44);
    ctx.lineTo(0, 48);
    ctx.lineTo(9, 44);
    ctx.closePath();
    ctx.fill();

    // Urópodo izquierdo
    ctx.fillStyle = tailColors[0];
    ctx.beginPath();
    ctx.moveTo(-6, 28);
    ctx.quadraticCurveTo(-24, 38, -26, 48);
    ctx.quadraticCurveTo(-14, 46, -4, 34);
    ctx.closePath();
    ctx.fill();

    // Urópodo derecho
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.quadraticCurveTo(24, 38, 26, 48);
    ctx.quadraticCurveTo(14, 46, 4, 34);
    ctx.closePath();
    ctx.fill();

    // 3. Segmentos del Abdomen (Placas de caparazón articuladas de la langosta)
    const shellColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'];
    for (let s = 4; s >= 0; s--) {
      ctx.fillStyle = shellColors[s % shellColors.length];
      ctx.beginPath();
      const segY = 8 + s * 5;
      ctx.ellipse(0, segY, 18 - s * 1.8, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 4. Grandes Brazos y Pinzas Frontales Poderosas (Quelas de la Langosta)
    // Brazo izquierdo articulado
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-28, -12);
    ctx.lineTo(-24, -18);
    ctx.lineTo(-12, -8);
    ctx.closePath();
    ctx.fill();

    // Brazo derecho articulado
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(28, -12);
    ctx.lineTo(24, -18);
    ctx.lineTo(12, -8);
    ctx.closePath();
    ctx.fill();

    // Pinza Izquierda (Grande, con dedo fijo y dedo móvil)
    ctx.save();
    ctx.translate(-30, -22);
    ctx.rotate(-0.25 + clawPinch);
    // Palma principal
    const clawGradL = ctx.createRadialGradient(-3, -3, 3, 0, 0, 16);
    clawGradL.addColorStop(0, '#f87171');
    clawGradL.addColorStop(0.6, '#dc2626');
    clawGradL.addColorStop(1, '#991b1b');
    ctx.fillStyle = clawGradL;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Dedo fijo con dientes
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.quadraticCurveTo(-14, -18, -8, -22);
    ctx.quadraticCurveTo(-4, -14, 0, -8);
    ctx.closePath();
    ctx.fill();
    // Dedo móvil
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.quadraticCurveTo(8, -18, 0, -23);
    ctx.quadraticCurveTo(-1, -15, -2, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pinza Derecha (Gran pinza trituradora)
    ctx.save();
    ctx.translate(30, -22);
    ctx.rotate(0.25 - clawPinch);
    // Palma principal
    const clawGradR = ctx.createRadialGradient(3, -3, 3, 0, 0, 16);
    clawGradR.addColorStop(0, '#f87171');
    clawGradR.addColorStop(0.6, '#dc2626');
    clawGradR.addColorStop(1, '#991b1b');
    ctx.fillStyle = clawGradR;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Dedo fijo
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.quadraticCurveTo(14, -18, 8, -22);
    ctx.quadraticCurveTo(4, -14, 0, -8);
    ctx.closePath();
    ctx.fill();
    // Dedo móvil
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.quadraticCurveTo(-8, -18, 0, -23);
    ctx.quadraticCurveTo(1, -15, 2, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Cefalotórax (Cuerpo central y caparazón robusto)
    const headGrad = ctx.createRadialGradient(-4, -8, 4, 0, -2, 28);
    headGrad.addColorStop(0, '#f87171');
    headGrad.addColorStop(0.5, '#ef4444');
    headGrad.addColorStop(0.85, '#dc2626');
    headGrad.addColorStop(1, '#991b1b');

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, -6, 23, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Rostrum puntiagudo central con espinas laterales
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-5, -24);
    ctx.lineTo(0, -38);
    ctx.lineTo(5, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.stroke();

    // 6. Antenas sensoriales largas y vibrantes de la langosta
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Antena izquierda
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.bezierCurveTo(-38, -50, -65, -30, -82, -55);
    ctx.stroke();

    // Antena derecha
    ctx.beginPath();
    ctx.moveTo(10, -20);
    ctx.bezierCurveTo(38, -50, 65, -30, 82, -55);
    ctx.stroke();

    // Anténulas interiores más cortas
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -26);
    ctx.quadraticCurveTo(-14, -42, -22, -45);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4, -26);
    ctx.quadraticCurveTo(14, -42, 22, -45);
    ctx.stroke();

    // 7. Pedúnculos Oculares y Ojos Caricatura Expresivos
    // Pedúnculos (tallos)
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.ellipse(-10, -14, 5, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(10, -14, 5, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Ojo Izquierdo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-10, -16, 8, 10, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pupila izquierda
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(-9, -16, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brillos especulares
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-11, -18, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-7, -13, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Ojo Derecho
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(10, -16, 8, 10, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pupila derecha
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(9, -16, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Brillos especulares
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(7, -18, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(11, -13, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 8. Sonrisa tierna y expresiva
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (this.shrimp.state === 'landed_fail') {
      // Boca mareada
      ctx.arc(0, -3, 6, Math.PI, 0, false);
    } else {
      // Sonrisa simpática
      ctx.arc(0, -6, 7, 0.1 * Math.PI, 0.9 * Math.PI, false);
    }
    ctx.stroke();

    // Mejillas sonrosadas
    ctx.fillStyle = 'rgba(254, 202, 202, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-16, -6, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(16, -6, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Efecto de mareo si cayó fuera del agua
    if (this.shrimp.state === 'landed_fail') {
      ctx.fillStyle = '#facc15';
      ctx.font = '16px sans-serif';
      ctx.fillText('💫', -16, -42);
      ctx.fillText('⭐', 12, -45);
    }

    ctx.restore();
  }

  renderParticles(ctx) {
    this.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.isText) {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 22px Fredoka, Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  renderAerators(ctx) {
    this.aerators.forEach((a) => {
      ctx.save();
      ctx.translate(a.x, a.y);

      // Base del motor flotante
      ctx.fillStyle = '#334155';
      ctx.fillRect(-20, -8, 40, 16);

      // Aspas giratorias de paleta (Paddlewheel)
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const ang = a.angle + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang) * 26, Math.sin(ang) * 26);
        ctx.stroke();
      }

      // Espuma de agua generada por el aireador
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 18, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }
}
