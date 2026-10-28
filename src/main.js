import './style.css';
import { QuizStorage, ResultsStorage } from './storage.js';
import { ShrimpJumpGame } from './game.js';
import { QuizEditor } from './editor.js';
import { AuthManager } from './auth.js';
import { sounds } from './audio.js';

class AppController {
  constructor() {
    this.quiz = QuizStorage.loadQuiz();
    this.currentView = 'lobby'; // 'lobby', 'game', 'editor', 'profile'
    this.authActiveTab = 'login'; // 'login', 'register'

    // Elementos de vistas
    this.viewLobby = document.getElementById('view-lobby');
    this.viewGame = document.getElementById('view-game');
    this.viewEditor = document.getElementById('view-editor');
    this.viewProfile = document.getElementById('view-profile');

    // Navegación
    this.tabPlay = document.getElementById('tab-play');
    this.tabProfile = document.getElementById('tab-profile');
    this.tabEditor = document.getElementById('tab-editor');
    this.brandHome = document.getElementById('brand-home');

    // Modales de Autenticación
    this.modalAuth = document.getElementById('modal-player-register');
    this.modalAdminLogin = document.getElementById('modal-admin-login');
    this.formLogin = document.getElementById('form-user-login');
    this.formRegister = document.getElementById('form-player-register');
    this.loginErrorMsg = document.getElementById('login-error-msg');
    this.regErrorMsg = document.getElementById('register-error-msg');
    this.adminLoginError = document.getElementById('admin-login-error');

    // Pestañas del Modal de Autenticación
    this.authTabBtnLogin = document.getElementById('auth-tab-btn-login');
    this.authTabBtnRegister = document.getElementById('auth-tab-btn-register');

    // Indicadores de Usuario en Cabecera
    this.userBadgeContainer = document.getElementById('user-badge-container');
    this.userBadgeIcon = document.getElementById('user-badge-icon');
    this.userBadgeText = document.getElementById('user-badge-text');
    this.btnUserAction = document.getElementById('btn-user-action');
    this.btnAdminAccess = document.getElementById('btn-admin-access');

    // Modales de Fin de Partida
    this.modalVictory = document.getElementById('modal-victory');
    this.modalGameOver = document.getElementById('modal-gameover');

    // HUD Elements
    this.hudQuestionNumber = document.getElementById('hud-question-number');
    this.hudTimer = document.getElementById('hud-timer');
    this.hudTimerText = document.getElementById('hud-timer-text');
    this.hudLivesContainer = document.getElementById('hud-lives-container');
    this.hudScore = document.getElementById('hud-score');
    this.hudStreak = document.getElementById('hud-streak');

    // Banner & Options
    this.bannerQPill = document.getElementById('banner-q-pill');
    this.bannerQText = document.getElementById('banner-q-text');
    this.optionsBar = document.getElementById('options-bar');

    // Administrador de Autenticación
    this.auth = new AuthManager((role, player) => {
      this.handleRoleChange(role, player);
    });

    // Inicializar componentes del juego y editor
    this.initGame();
    this.initEditor();
    this.bindGlobalEvents();

    // Sincronizar estado inicial de sesión
    this.handleRoleChange(this.auth.getRole(), this.auth.getPlayer());
    this.updateLobbyInfo();
  }

  initGame() {
    const canvas = document.getElementById('game-canvas');
    this.game = new ShrimpJumpGame(canvas, {
      onScoreUpdate: (score, streak) => {
        this.hudScore.textContent = score;
        this.hudStreak.textContent = `x${Math.max(1, streak)}`;
      },
      onLivesUpdate: (lives, maxLives) => {
        this.renderLives(lives, maxLives);
      },
      onTimerUpdate: (remaining, total) => {
        if (remaining === null) {
          this.hudTimer.style.display = 'none';
        } else {
          this.hudTimer.style.display = 'flex';
          this.hudTimerText.textContent = `${remaining}s`;
          if (remaining <= 5) {
            this.hudTimer.classList.add('urgent');
          } else {
            this.hudTimer.classList.remove('urgent');
          }
        }
      },
      onQuestionUpdate: (qData) => {
        this.hudQuestionNumber.textContent = `${qData.questionNumber} / ${qData.totalQuestions}`;
        this.bannerQPill.textContent = `Pregunta ${qData.questionNumber}`;
        this.bannerQText.textContent = qData.questionText;
        this.renderOptionCards(qData.options);
      },
      onGameOver: (stats) => {
        this.recordAndShowGameOver(stats);
      },
      onVictory: (stats) => {
        this.recordAndShowVictory(stats);
      }
    });
  }

  initEditor() {
    this.editor = new QuizEditor('editor-container', {
      initialQuiz: this.quiz,
      onSave: (updatedQuiz) => {
        this.quiz = updatedQuiz;
        this.updateLobbyInfo();
      },
      onPlay: (updatedQuiz) => {
        this.quiz = updatedQuiz;
        this.updateLobbyInfo();
        this.startNewGame();
      },
      onExitAdmin: () => {
        this.auth.exitAdminMode();
        this.switchView('lobby');
      }
    });
  }

  handleRoleChange(role, player) {
    const btnLobbyHistory = document.getElementById('btn-lobby-view-history');

    if (role === 'admin') {
      // Configuración visual para Administrador / Docente
      this.userBadgeContainer.className = 'user-badge-pill is-admin';
      this.userBadgeIcon.textContent = '🛡️';
      this.userBadgeText.textContent = 'Administrador';
      this.btnUserAction.textContent = 'Salir';
      this.btnUserAction.title = 'Cerrar sesión de administrador';
      this.btnAdminAccess.classList.add('view-hidden');

      // Pestañas
      this.tabEditor.classList.remove('view-hidden');
      this.tabProfile.classList.add('view-hidden');
      this.tabPlay.querySelector('.tab-title').textContent = 'Vista Previa';

      if (btnLobbyHistory) btnLobbyHistory.classList.add('view-hidden');
    } else if (role === 'player' && player) {
      // Configuración visual para Jugador Registrado
      this.userBadgeContainer.className = 'user-badge-pill is-player';
      this.userBadgeIcon.textContent = '🦞';
      const shortName = player.fullName ? player.fullName.split(' ')[0] : (player.username || 'Jugador');
      this.userBadgeText.textContent = shortName;
      this.btnUserAction.textContent = 'Mi Cuenta';
      this.btnUserAction.title = 'Ver mi perfil y reportes';
      this.btnAdminAccess.classList.remove('view-hidden');

      // Mostrar pestaña de Historial/Perfil
      this.tabProfile.classList.remove('view-hidden');
      this.tabEditor.classList.add('view-hidden');
      this.tabPlay.querySelector('.tab-title').textContent = 'Jugar';

      if (btnLobbyHistory) btnLobbyHistory.classList.remove('view-hidden');

      if (this.currentView === 'editor') {
        this.switchView('lobby');
      }
    } else {
      // Invitado / No registrado
      this.userBadgeContainer.className = 'user-badge-pill';
      this.userBadgeIcon.textContent = '👤';
      this.userBadgeText.textContent = 'Ingresar';
      this.btnUserAction.textContent = 'Entrar';
      this.btnUserAction.title = 'Iniciar sesión o registrarse';
      this.btnAdminAccess.classList.remove('view-hidden');

      // Ocultar perfil y editor
      this.tabProfile.classList.add('view-hidden');
      this.tabEditor.classList.add('view-hidden');
      this.tabPlay.querySelector('.tab-title').textContent = 'Jugar';

      if (btnLobbyHistory) btnLobbyHistory.classList.add('view-hidden');

      if (this.currentView === 'editor' || this.currentView === 'profile') {
        this.switchView('lobby');
      }
    }

    this.updateLobbyInfo();
  }

  renderLives(lives, maxLives) {
    this.hudLivesContainer.innerHTML = '';
    for (let i = 0; i < maxLives; i++) {
      const heart = document.createElement('span');
      heart.className = 'hud-heart' + (i >= lives ? ' broken' : '');
      heart.textContent = '❤️';
      this.hudLivesContainer.appendChild(heart);
    }
  }

  renderOptionCards(options) {
    this.optionsBar.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-card-btn';
      btn.setAttribute('data-index', idx);
      btn.innerHTML = `
        <span class="btn-badge">${letters[idx]}</span>
        <span class="btn-text">${this.escapeHtml(opt.text)}</span>
        <span class="key-hint">${idx + 1}</span>
      `;

      btn.addEventListener('click', () => {
        this.game.handleAnswerSelected(idx);
      });

      this.optionsBar.appendChild(btn);
    });
  }

  updateLobbyInfo() {
    const qCount = this.quiz.questions.length;
    const timeText = this.quiz.timePerQuestion > 0 ? `${this.quiz.timePerQuestion}s por pregunta` : 'Sin límite de tiempo';

    const titleEl = document.getElementById('lobby-quiz-title');
    if (titleEl) titleEl.textContent = this.quiz.title || 'El Gran Salto de la Langosta';

    const descEl = document.getElementById('lobby-quiz-desc');
    if (descEl) descEl.textContent = this.quiz.description || 'Aventura acuática de preguntas y respuestas.';

    const bQuestions = document.getElementById('lobby-badge-questions');
    if (bQuestions) bQuestions.textContent = `📝 ${qCount} Preguntas`;

    const bLives = document.getElementById('lobby-badge-lives');
    if (bLives) bLives.textContent = `❤️ ${this.quiz.lives} Vidas`;

    const bTime = document.getElementById('lobby-badge-time');
    if (bTime) bTime.textContent = `⏱️ ${timeText}`;

    // Actualizar tarjeta del jugador en el lobby
    const player = this.auth.getPlayer();
    const lobbyName = document.getElementById('lobby-player-name');
    const lobbySub = document.getElementById('lobby-player-sub');
    const btnLobbyChange = document.getElementById('btn-lobby-change-player');

    if (this.auth.getRole() === 'admin') {
      lobbyName.textContent = '🛡️ Modo Administrador';
      lobbySub.textContent = 'Puedes probar la actividad o ingresar al panel para editarla.';
      if (btnLobbyChange) btnLobbyChange.textContent = 'Cambiar Rol';
    } else if (player) {
      lobbyName.textContent = player.fullName;
      lobbySub.textContent = `Usuario: @${player.username} | ${player.email}`;
      if (btnLobbyChange) btnLobbyChange.textContent = 'Cambiar Cuenta';
    } else {
      lobbyName.textContent = 'Sin registrar';
      lobbySub.textContent = 'Inicia sesión con tu usuario y contraseña para guardar tus puntajes.';
      if (btnLobbyChange) btnLobbyChange.textContent = 'Iniciar Sesión';
    }
  }

  setAuthTab(tab) {
    this.authActiveTab = tab;
    if (tab === 'login') {
      this.authTabBtnLogin.classList.add('active');
      this.authTabBtnRegister.classList.remove('active');
      this.formLogin.classList.remove('view-hidden');
      this.formRegister.classList.add('view-hidden');
    } else {
      this.authTabBtnLogin.classList.remove('active');
      this.authTabBtnRegister.classList.add('active');
      this.formLogin.classList.add('view-hidden');
      this.formRegister.classList.remove('view-hidden');
    }
    this.loginErrorMsg.classList.add('view-hidden');
    this.regErrorMsg.classList.add('view-hidden');
  }

  showAuthModal(initialTab = 'login') {
    this.setAuthTab(initialTab);
    this.modalAuth.classList.remove('view-hidden');
  }

  hideAuthModal() {
    this.modalAuth.classList.add('view-hidden');
  }

  showAdminLoginModal() {
    document.getElementById('input-admin-password').value = '';
    this.adminLoginError.classList.add('view-hidden');
    this.modalAdminLogin.classList.remove('view-hidden');
  }

  hideAdminLoginModal() {
    this.modalAdminLogin.classList.add('view-hidden');
  }

  bindGlobalEvents() {
    // Botón iniciar partida en el lobby
    document.getElementById('btn-start-game').addEventListener('click', () => {
      if (this.auth.getRole() === 'guest') {
        this.showAuthModal('login');
      } else {
        this.startNewGame();
      }
    });

    // Botones del lobby
    document.getElementById('btn-lobby-change-player').addEventListener('click', () => {
      this.showAuthModal('login');
    });

    const btnLobbyHistory = document.getElementById('btn-lobby-view-history');
    if (btnLobbyHistory) {
      btnLobbyHistory.addEventListener('click', () => {
        this.switchView('profile');
      });
    }

    // Botón / Píldora de acción en la cabecera (Iniciar Sesión / Mi Cuenta / Salir de Admin)
    const handleUserBadgeClick = () => {
      if (this.auth.getRole() === 'admin') {
        this.auth.exitAdminMode();
        this.switchView('lobby');
      } else if (this.auth.getRole() === 'player') {
        this.switchView('profile');
      } else {
        this.showAuthModal('login');
      }
    };

    this.btnUserAction.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUserBadgeClick();
    });

    this.userBadgeContainer.addEventListener('click', () => {
      handleUserBadgeClick();
    });

    // Botón de acceso exclusivo para administradores
    this.btnAdminAccess.addEventListener('click', () => {
      this.showAdminLoginModal();
    });

    // Pestañas de navegación de la barra principal
    this.tabPlay.addEventListener('click', () => {
      this.switchView('lobby');
    });

    this.tabProfile.addEventListener('click', () => {
      if (this.auth.getRole() === 'player') {
        this.switchView('profile');
      }
    });

    this.tabEditor.addEventListener('click', () => {
      if (this.auth.getRole() === 'admin') {
        this.switchView('editor');
      }
    });

    this.brandHome.addEventListener('click', () => {
      this.game.stop();
      this.hideModals();
      this.switchView('lobby');
    });

    // Pestañas dentro del Modal de Autenticación
    this.authTabBtnLogin.addEventListener('click', () => this.setAuthTab('login'));
    this.authTabBtnRegister.addEventListener('click', () => this.setAuthTab('register'));

    const linkSwitchReg = document.getElementById('btn-switch-to-reg-link');
    if (linkSwitchReg) {
      linkSwitchReg.addEventListener('click', (e) => {
        e.preventDefault();
        this.setAuthTab('register');
      });
    }

    const linkSwitchLogin = document.getElementById('btn-switch-to-login-link');
    if (linkSwitchLogin) {
      linkSwitchLogin.addEventListener('click', (e) => {
        e.preventDefault();
        this.setAuthTab('login');
      });
    }

    // --- FORMULARIO DE INICIO DE SESIÓN ---
    this.formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;
        this.auth.loginUser(identifier, password);
        this.hideAuthModal();
        this.switchView('profile');
      } catch (err) {
        this.loginErrorMsg.textContent = err.message;
        this.loginErrorMsg.classList.remove('view-hidden');
      }
    });

    document.getElementById('btn-cancel-login').addEventListener('click', () => {
      this.hideAuthModal();
    });

    // --- FORMULARIO DE REGISTRO DE CUENTA ---
    this.formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const formData = {
          username: document.getElementById('reg-username').value,
          password: document.getElementById('reg-password').value,
          fullName: document.getElementById('reg-fullname').value,
          email: document.getElementById('reg-email').value,
          birthDate: document.getElementById('reg-birthdate').value
        };
        this.auth.registerUser(formData);
        this.hideAuthModal();
        this.switchView('profile');
      } catch (err) {
        this.regErrorMsg.textContent = err.message;
        this.regErrorMsg.classList.remove('view-hidden');
      }
    });

    document.getElementById('btn-cancel-register').addEventListener('click', () => {
      this.hideAuthModal();
    });

    // --- FORMULARIO DE LOGIN DE ADMINISTRADOR ---
    this.formAdminLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        const pwd = document.getElementById('input-admin-password').value;
        this.auth.loginAdmin(pwd);
        this.hideAdminLoginModal();
        this.switchView('editor');
      } catch (err) {
        this.adminLoginError.textContent = err.message;
        this.adminLoginError.classList.remove('view-hidden');
      }
    });

    document.getElementById('btn-cancel-admin-login').addEventListener('click', () => {
      this.hideAdminLoginModal();
    });

    // Acciones del Perfil del Jugador
    document.getElementById('btn-profile-play').addEventListener('click', () => {
      this.startNewGame();
    });

    document.getElementById('btn-profile-logout').addEventListener('click', () => {
      this.auth.logout();
      this.switchView('lobby');
    });

    document.getElementById('btn-profile-export-csv').addEventListener('click', () => {
      const player = this.auth.getPlayer();
      if (!player) return;
      this.exportPlayerPersonalCSV(player);
    });

    // Alternar sonido
    const btnSound = document.getElementById('btn-sound-toggle');
    btnSound.addEventListener('click', () => {
      const isMuted = sounds.toggleMute();
      btnSound.textContent = isMuted ? '🔇' : '🔊';
      btnSound.title = isMuted ? 'Activar sonido' : 'Silenciar sonido';
    });

    // Alternar pantalla completa
    const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Atajos de teclado (1, 2, 3, 4 y A, B, C, D)
    window.addEventListener('keydown', (e) => {
      if (this.currentView !== 'game') return;

      const key = e.key.toUpperCase();
      let optionIndex = -1;

      if (['1', '2', '3', '4'].includes(key)) {
        optionIndex = parseInt(key, 10) - 1;
      } else if (['A', 'B', 'C', 'D'].includes(key)) {
        optionIndex = ['A', 'B', 'C', 'D'].indexOf(key);
      }

      if (optionIndex >= 0 && optionIndex < (this.game.currentOptions ? this.game.currentOptions.length : 0)) {
        this.game.handleAnswerSelected(optionIndex);
      }
    });

    // Botones de Modales de Fin de Partida
    document.getElementById('btn-victory-replay').addEventListener('click', () => {
      this.hideModals();
      this.startNewGame();
    });

    document.getElementById('btn-victory-profile').addEventListener('click', () => {
      this.hideModals();
      this.switchView('profile');
    });

    document.getElementById('btn-victory-exit').addEventListener('click', () => {
      this.hideModals();
      this.switchView('lobby');
    });

    document.getElementById('btn-gameover-retry').addEventListener('click', () => {
      this.hideModals();
      this.startNewGame();
    });

    document.getElementById('btn-gameover-profile').addEventListener('click', () => {
      this.hideModals();
      this.switchView('profile');
    });

    document.getElementById('btn-gameover-exit').addEventListener('click', () => {
      this.hideModals();
      this.switchView('lobby');
    });
  }

  startNewGame() {
    this.quiz = QuizStorage.loadQuiz();
    this.hideModals();
    this.switchView('game');
    this.game.start(this.quiz);
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Actualizar estados visuales de las pestañas
    this.tabPlay.classList.toggle('active', viewName === 'lobby' || viewName === 'game');
    this.tabProfile.classList.toggle('active', viewName === 'profile');
    this.tabEditor.classList.toggle('active', viewName === 'editor');

    // Ocultar todas las vistas
    this.viewLobby.classList.add('view-hidden');
    this.viewGame.classList.add('view-hidden');
    this.viewEditor.classList.add('view-hidden');
    this.viewProfile.classList.add('view-hidden');

    // Mostrar vista objetivo
    if (viewName === 'lobby') {
      this.viewLobby.classList.remove('view-hidden');
      this.updateLobbyInfo();
    } else if (viewName === 'game') {
      this.viewGame.classList.remove('view-hidden');
      if (this.game) this.game.setupResize();
    } else if (viewName === 'editor') {
      this.viewEditor.classList.remove('view-hidden');
      if (this.editor) this.editor.setQuiz(QuizStorage.loadQuiz());
    } else if (viewName === 'profile') {
      this.viewProfile.classList.remove('view-hidden');
      this.renderProfileView();
    }
  }

  renderProfileView() {
    const player = this.auth.getPlayer();
    if (!player) {
      this.showAuthModal('login');
      this.switchView('lobby');
      return;
    }

    // Datos del usuario en cabecera
    document.getElementById('profile-fullname').textContent = player.fullName || 'Jugador';
    document.getElementById('profile-username').textContent = `@${player.username || 'usuario'}`;
    document.getElementById('profile-email').textContent = player.email || '-';
    document.getElementById('profile-birthdate').textContent = player.birthDate || '-';

    // Obtener estadísticas y reportes
    const stats = ResultsStorage.getUserStats(player.username);
    const attempts = ResultsStorage.getUserResults(player.username);

    // KPIs
    document.getElementById('profile-kpi-best').textContent = stats.bestScore;
    document.getElementById('profile-kpi-games').textContent = stats.totalGames;
    document.getElementById('profile-kpi-avg').textContent = stats.avgScore;
    document.getElementById('profile-kpi-winrate').textContent = `${stats.winRate}%`;
    document.getElementById('profile-kpi-victories').textContent = `${stats.victoriesCount} victoria(s) conseguida(s)`;

    // Tabla de historial
    const historyContainer = document.getElementById('profile-history-container');
    if (!historyContainer) return;

    if (attempts.length === 0) {
      historyContainer.innerHTML = `
        <div class="empty-history-box">
          <div class="empty-icon">🦞</div>
          <h3>¡Aún no has jugado ninguna partida!</h3>
          <p>Supera las piscinas respondiendo preguntas y tus calificaciones e intentos aparecerán registrados aquí.</p>
          <button id="btn-empty-play" class="btn btn-primary" style="margin-top: 14px;">
            ▶️ Jugar Mi Primera Partida
          </button>
        </div>
      `;
      document.getElementById('btn-empty-play')?.addEventListener('click', () => {
        this.startNewGame();
      });
      return;
    }

    const rowsHtml = attempts
      .map((att, idx) => {
        const isWin = att.livesRemaining > 0 && att.questionsAnswered === att.totalQuestions;
        const statusBadge = isWin
          ? `<span class="badge-status win">🏆 ¡Misión Cumplida!</span>`
          : `<span class="badge-status loss">❌ En Tierra Seca</span>`;

        return `
          <tr>
            <td><strong>#${attempts.length - idx}</strong></td>
            <td>${this.escapeHtml(att.date || '')}</td>
            <td><strong class="score-val">${att.score || 0} pts</strong></td>
            <td>
              <span class="hearts-left">${att.livesRemaining > 0 ? '❤️'.repeat(att.livesRemaining) : '💀 0'}</span>
            </td>
            <td>${att.questionsAnswered || 0} / ${att.totalQuestions || 0}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      })
      .join('');

    historyContainer.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>Intento</th>
            <th>Fecha y Hora</th>
            <th>Puntaje</th>
            <th>Vidas</th>
            <th>Aciertos</th>
            <th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }

  exportPlayerPersonalCSV(player) {
    const attempts = ResultsStorage.getUserResults(player.username);
    if (attempts.length === 0) {
      alert('Aún no tienes partidas registradas para exportar.');
      return;
    }

    const headers = ['Intento', 'Fecha', 'Usuario', 'Nombre', 'Correo', 'Puntaje', 'Vidas Restantes', 'Preguntas Respondidas', 'Resultado'];
    const rows = attempts.map((r, idx) => {
      const isWin = r.livesRemaining > 0 && r.questionsAnswered === r.totalQuestions;
      return [
        attempts.length - idx,
        `"${r.date || ''}"`,
        `"${player.username}"`,
        `"${player.fullName}"`,
        `"${player.email}"`,
        r.score || 0,
        r.livesRemaining !== undefined ? r.livesRemaining : 0,
        `"${r.questionsAnswered || 0}/${r.totalQuestions || 0}"`,
        `"${isWin ? 'Completado' : 'Fallido'}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_partidas_${player.username}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    link.remove();
  }

  recordAndShowVictory(stats) {
    const player = this.auth.getPlayer();
    const playerName = player ? player.fullName : (this.auth.getRole() === 'admin' ? 'Administrador' : 'Anónimo');
    const username = player ? player.username : (this.auth.getRole() === 'admin' ? 'admin' : 'anon');

    // Registrar en el historial de calificaciones
    ResultsStorage.saveResult({
      username: username,
      playerName: playerName,
      email: player ? player.email : '-',
      birthDate: player ? player.birthDate : '-',
      score: stats.score,
      livesRemaining: stats.livesRemaining,
      totalQuestions: stats.totalQuestions,
      questionsAnswered: stats.totalQuestions,
      quizTitle: this.quiz.title
    });

    document.getElementById('victory-player-name').textContent = playerName;
    document.getElementById('victory-score').textContent = stats.score;
    const starsContainer = document.getElementById('victory-stars');
    if (stats.livesRemaining === stats.maxLives) {
      starsContainer.textContent = '⭐⭐⭐';
    } else if (stats.livesRemaining >= 2) {
      starsContainer.textContent = '⭐⭐';
    } else {
      starsContainer.textContent = '⭐';
    }
    this.modalVictory.classList.remove('view-hidden');
  }

  recordAndShowGameOver(stats) {
    const player = this.auth.getPlayer();
    const playerName = player ? player.fullName : (this.auth.getRole() === 'admin' ? 'Administrador' : 'Anónimo');
    const username = player ? player.username : (this.auth.getRole() === 'admin' ? 'admin' : 'anon');

    // Registrar en el historial de calificaciones
    ResultsStorage.saveResult({
      username: username,
      playerName: playerName,
      email: player ? player.email : '-',
      birthDate: player ? player.birthDate : '-',
      score: stats.score,
      livesRemaining: 0,
      totalQuestions: stats.totalQuestions,
      questionsAnswered: stats.questionsAnswered,
      quizTitle: this.quiz.title
    });

    document.getElementById('gameover-player-name').textContent = playerName;
    document.getElementById('gameover-score').textContent = stats.score;
    this.modalGameOver.classList.remove('view-hidden');
  }

  hideModals() {
    this.modalVictory.classList.add('view-hidden');
    this.modalGameOver.classList.add('view-hidden');
    this.modalAuth.classList.add('view-hidden');
    this.modalAdminLogin.classList.add('view-hidden');
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Inicializar la aplicación cuando cargue el DOM
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
