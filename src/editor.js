import { QuizStorage, ResultsStorage, AdminStorage } from './storage.js';
import { DocumentParser } from './documentParser.js';
import { AIGenerator } from './aiGenerator.js';

export class QuizEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.quiz = options.initialQuiz || QuizStorage.loadQuiz();
    this.onSave = options.onSave || (() => {});
    this.onPlay = options.onPlay || (() => {});
    this.onExitAdmin = options.onExitAdmin || (() => {});
    this.activeQuestionIndex = 0;
    this.activeAdminTab = 'questions'; // 'questions', 'results', 'security'

    // Estado del generador con IA
    this.currentAiFile = null;
    this.currentExtractedDoc = null;
    this.currentGeneratedQuiz = null;

    this.bindAIGeneratorEvents();
  }

  setQuiz(quiz) {
    this.quiz = JSON.parse(JSON.stringify(quiz));
    if (this.activeQuestionIndex >= this.quiz.questions.length) {
      this.activeQuestionIndex = Math.max(0, this.quiz.questions.length - 1);
    }
    this.render();
  }

  getQuiz() {
    return this.quiz;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="editor-layout">
        <!-- Barra superior del panel administrativo -->
        <header class="editor-header">
          <div class="editor-title-group">
            <span class="editor-badge">🛡️ PANEL DE ADMINISTRACIÓN Y DOCENCIA</span>
            <h2>Gestión de Salto Camaronero</h2>
            <p>Configura las preguntas del juego, revisa las calificaciones de los jugadores y administra la seguridad.</p>
          </div>

          <div class="admin-tab-nav">
            <button class="btn btn-sm ${this.activeAdminTab === 'questions' ? 'btn-accent' : 'btn-secondary'}" id="admin-subtab-questions">
              ✏️ Editor de Preguntas
            </button>
            <button class="btn btn-sm ${this.activeAdminTab === 'results' ? 'btn-accent' : 'btn-secondary'}" id="admin-subtab-results">
              📊 Registro de Jugadores (${ResultsStorage.getResults().length})
            </button>
            <button class="btn btn-sm ${this.activeAdminTab === 'security' ? 'btn-accent' : 'btn-secondary'}" id="admin-subtab-security">
              🔒 Seguridad
            </button>
            <button class="btn btn-sm btn-danger-outline" id="btn-admin-logout" title="Salir del rol de Administrador">
              🚪 Salir de Admin
            </button>
          </div>
        </header>

        <!-- Contenido según la pestaña activa -->
        ${this.renderActiveSubtab()}
      </div>
    `;

    this.bindGlobalAdminEvents();
  }

  renderActiveSubtab() {
    if (this.activeAdminTab === 'results') {
      return this.renderResultsTab();
    } else if (this.activeAdminTab === 'security') {
      return this.renderSecurityTab();
    }
    return this.renderQuestionsTab();
  }

  // --- SUBTAB 1: EDITOR DE PREGUNTAS ---
  renderQuestionsTab() {
    return `
      <div class="editor-actions-bar">
        <div class="editor-top-actions">
          <button id="btn-open-ai-modal" class="btn btn-accent" title="Generar automáticamente preguntas analizando un archivo PDF o PowerPoint con Inteligencia Artificial">
            ✨ Generar con IA (PDF / PPTX)
          </button>
          <button id="btn-save-quiz" class="btn btn-primary" title="Guardar cambios en el navegador">
            💾 Guardar Cuestionario
          </button>
          <button id="btn-export-quiz" class="btn btn-secondary" title="Descargar como archivo JSON">
            📥 Exportar (.json)
          </button>
          <label class="btn btn-secondary file-upload-btn" title="Cargar desde un archivo JSON">
            📤 Importar (.json)
            <input type="file" id="input-import-quiz" accept=".json" style="display: none;" />
          </label>
          <button id="btn-reset-quiz" class="btn btn-danger-outline" title="Restaurar a las preguntas originales">
            🔄 Restaurar Ejemplo
          </button>
          <button id="btn-play-from-editor" class="btn btn-success" title="Iniciar juego como vista previa">
            ▶️ Vista Previa del Juego
          </button>
        </div>
      </div>

      <div class="editor-body">
        <!-- Columna izquierda: Ajustes generales y lista de preguntas -->
        <aside class="editor-sidebar">
          <div class="sidebar-section">
            <h3 class="section-title">⚙️ Parámetros de la Partida</h3>
            
            <div class="form-group">
              <label for="edit-quiz-title">Título de la Actividad</label>
              <input type="text" id="edit-quiz-title" class="form-control" value="${this.escapeHtml(this.quiz.title)}" />
            </div>

            <div class="form-group">
              <label for="edit-quiz-desc">Descripción / Consigna</label>
              <textarea id="edit-quiz-desc" class="form-control" rows="2">${this.escapeHtml(this.quiz.description || '')}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group col">
                <label for="edit-quiz-time">Tiempo por Pregunta</label>
                <select id="edit-quiz-time" class="form-control">
                  <option value="0" ${this.quiz.timePerQuestion === 0 ? 'selected' : ''}>Sin límite</option>
                  <option value="10" ${this.quiz.timePerQuestion === 10 ? 'selected' : ''}>10 segundos</option>
                  <option value="15" ${this.quiz.timePerQuestion === 15 ? 'selected' : ''}>15 segundos</option>
                  <option value="20" ${this.quiz.timePerQuestion === 20 ? 'selected' : ''}>20 segundos</option>
                  <option value="30" ${this.quiz.timePerQuestion === 30 ? 'selected' : ''}>30 segundos</option>
                  <option value="45" ${this.quiz.timePerQuestion === 45 ? 'selected' : ''}>45 segundos</option>
                  <option value="60" ${this.quiz.timePerQuestion === 60 ? 'selected' : ''}>60 segundos</option>
                </select>
              </div>

              <div class="form-group col">
                <label for="edit-quiz-lives">Vidas (Corazones)</label>
                <select id="edit-quiz-lives" class="form-control">
                  <option value="1" ${this.quiz.lives === 1 ? 'selected' : ''}>1 vida (Muerte súbita)</option>
                  <option value="2" ${this.quiz.lives === 2 ? 'selected' : ''}>2 vidas</option>
                  <option value="3" ${this.quiz.lives === 3 ? 'selected' : ''}>3 vidas (Estándar)</option>
                  <option value="4" ${this.quiz.lives === 4 ? 'selected' : ''}>4 vidas</option>
                  <option value="5" ${this.quiz.lives === 5 ? 'selected' : ''}>5 vidas</option>
                </select>
              </div>
            </div>

            <div class="form-switches">
              <label class="switch-label">
                <input type="checkbox" id="edit-quiz-rand-q" ${this.quiz.randomizeQuestions ? 'checked' : ''} />
                <span>Aleatorizar orden de preguntas</span>
              </label>
              <label class="switch-label">
                <input type="checkbox" id="edit-quiz-rand-a" ${this.quiz.randomizeAnswers ? 'checked' : ''} />
                <span>Aleatorizar orden de respuestas</span>
              </label>
            </div>
          </div>

          <!-- Lista de preguntas creadas -->
          <div class="sidebar-section">
            <div class="questions-list-header">
              <h3 class="section-title">📝 Preguntas (${this.quiz.questions.length})</h3>
              <button id="btn-add-question" class="btn btn-sm btn-accent" title="Crear una nueva pregunta">
                ➕ Nueva
              </button>
            </div>

            <div class="questions-nav-list" id="questions-nav-list">
              ${this.renderQuestionsNavList()}
            </div>
          </div>
        </aside>

        <!-- Columna derecha: Editor en detalle de la pregunta seleccionada -->
        <main class="editor-main-panel">
          ${this.renderActiveQuestionForm()}
        </main>
      </div>
    `;
  }

  renderQuestionsNavList() {
    return this.quiz.questions
      .map((q, idx) => {
        const isActive = idx === this.activeQuestionIndex;
        const shortText = q.question.length > 36 ? q.question.substring(0, 36) + '...' : q.question || '(Pregunta vacía)';
        return `
          <div class="q-nav-item ${isActive ? 'active' : ''}" data-index="${idx}">
            <div class="q-nav-index">${idx + 1}</div>
            <div class="q-nav-text" title="${this.escapeHtml(q.question)}">${this.escapeHtml(shortText)}</div>
            <div class="q-nav-badge">${q.options.length} opciones</div>
          </div>
        `;
      })
      .join('');
  }

  renderActiveQuestionForm() {
    const q = this.quiz.questions[this.activeQuestionIndex];
    if (!q) {
      return `
        <div class="empty-editor-message">
          <p>No hay preguntas creadas. Haz clic en <strong>➕ Nueva</strong> para añadir una.</p>
        </div>
      `;
    }

    const letters = ['A', 'B', 'C', 'D'];

    return `
      <div class="question-edit-card">
        <div class="q-card-header">
          <div class="q-title-row">
            <span class="q-number-pill">Pregunta ${this.activeQuestionIndex + 1} de ${this.quiz.questions.length}</span>
            <div class="q-card-actions">
              <button id="btn-move-up-q" class="btn btn-icon" title="Subir orden" ${this.activeQuestionIndex === 0 ? 'disabled' : ''}>⬆️</button>
              <button id="btn-move-down-q" class="btn btn-icon" title="Bajar orden" ${this.activeQuestionIndex === this.quiz.questions.length - 1 ? 'disabled' : ''}>⬇️</button>
              <button id="btn-duplicate-q" class="btn btn-icon" title="Duplicar pregunta">📋 Duplicar</button>
              <button id="btn-delete-q" class="btn btn-icon btn-danger" title="Eliminar pregunta" ${this.quiz.questions.length <= 1 ? 'disabled' : ''}>🗑️ Eliminar</button>
            </div>
          </div>

          <div class="form-group">
            <label for="input-active-q-text"><strong>Enunciado de la Pregunta</strong></label>
            <input type="text" id="input-active-q-text" class="form-control form-control-lg" placeholder="Escribe aquí la pregunta..." value="${this.escapeHtml(q.question)}" />
          </div>
        </div>

        <div class="q-card-answers-section">
          <div class="answers-header-row">
            <label><strong>Opciones de Respuesta (Piscinas de Salto)</strong></label>
            <span class="helper-text">Marca el círculo verde de la opción que sea la respuesta correcta.</span>
          </div>

          <div class="options-container">
            ${q.options
              .map((opt, optIdx) => {
                const isCorrect = optIdx === q.correctAnswer;
                return `
                <div class="option-row ${isCorrect ? 'is-correct-row' : ''}" data-opt-index="${optIdx}">
                  <div class="option-letter-badge">${letters[optIdx] || optIdx + 1}</div>
                  
                  <input type="text" class="form-control option-input" data-opt-index="${optIdx}" value="${this.escapeHtml(opt)}" placeholder="Texto de la opción..." />

                  <label class="correct-radio-label ${isCorrect ? 'active' : ''}" title="Marcar como respuesta correcta">
                    <input type="radio" name="correct-option-radio" value="${optIdx}" ${isCorrect ? 'checked' : ''} />
                    <span class="correct-tag">${isCorrect ? '✅ Correcta' : 'Hacer Correcta'}</span>
                  </label>

                  ${
                    q.options.length > 2
                      ? `<button class="btn btn-icon btn-sm btn-delete-opt" data-opt-index="${optIdx}" title="Eliminar esta opción">✕</button>`
                      : ''
                  }
                </div>
              `;
              })
              .join('')}
          </div>

          ${
            q.options.length < 4
              ? `
            <button id="btn-add-option" class="btn btn-sm btn-secondary" style="margin-top: 12px;">
              ➕ Agregar otra opción de piscina
            </button>
          `
              : ''
          }
        </div>

        <div class="q-card-feedback-section">
          <div class="form-group">
            <label for="input-active-q-feedback"><strong>💡 Dato curioso / Retroalimentación Pedagógica (Opcional)</strong></label>
            <input type="text" id="input-active-q-feedback" class="form-control" placeholder="Ej: ¡Correcto! Los camarones mudan su caparazón..." value="${this.escapeHtml(q.feedback || '')}" />
            <small class="helper-text">Se mostrará al responder la pregunta para reforzar el aprendizaje.</small>
          </div>
        </div>
      </div>
    `;
  }

  // --- SUBTAB 2: REGISTRO DE JUGADORES Y RESULTADOS ---
  renderResultsTab() {
    const results = ResultsStorage.getResults();

    return `
      <div class="admin-results-panel">
        <div class="results-header-actions">
          <div>
            <h3>📊 Historial de Partidas y Calificaciones</h3>
            <p class="helper-text">Aquí se registran todas las partidas jugadas con los datos de identificación de cada participante.</p>
          </div>
          <div class="results-btns">
            <button id="btn-export-csv" class="btn btn-success" ${results.length === 0 ? 'disabled' : ''}>
              📥 Descargar Reporte (.CSV / Excel)
            </button>
            <button id="btn-clear-results" class="btn btn-danger-outline" ${results.length === 0 ? 'disabled' : ''}>
              🗑️ Limpiar Historial
            </button>
          </div>
        </div>

        ${
          results.length === 0
            ? `
          <div class="empty-results-box">
            <div style="font-size: 3rem; margin-bottom: 12px;">📝</div>
            <p><strong>Aún no hay registros de jugadores.</strong></p>
            <p class="helper-text">Cuando los jugadores se registren y completen una partida, sus calificaciones aparecerán en esta tabla.</p>
          </div>
        `
            : `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Nombres y Apellidos</th>
                  <th>Cédula</th>
                  <th>Correo Electrónico</th>
                  <th>F. Nacimiento</th>
                  <th>Puntos</th>
                  <th>Preguntas</th>
                  <th>Vidas</th>
                </tr>
              </thead>
              <tbody>
                ${results
                  .map(
                    (r) => `
                  <tr>
                    <td><span class="badge-date">${this.escapeHtml(r.date)}</span></td>
                    <td><strong>${this.escapeHtml(r.playerName || 'Anónimo')}</strong></td>
                    <td><code>${this.escapeHtml(r.cedula || 'S/N')}</code></td>
                    <td>${this.escapeHtml(r.email || '-')}</td>
                    <td>${this.escapeHtml(r.birthDate || '-')}</td>
                    <td><strong style="color: #f59e0b; font-size: 1.1rem;">${r.score || 0} pts</strong></td>
                    <td>${r.questionsAnswered || 0} / ${r.totalQuestions || 0}</td>
                    <td>${r.livesRemaining !== undefined ? (r.livesRemaining > 0 ? '❤️'.repeat(r.livesRemaining) : '💀 0') : '-'}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    `;
  }

  // --- SUBTAB 3: SEGURIDAD ---
  renderSecurityTab() {
    return `
      <div class="admin-security-panel">
        <div class="security-card">
          <h3>🔒 Configuración de Acceso Administrativo</h3>
          <p class="helper-text">Modifica la clave necesaria para acceder a la edición de preguntas y al historial de jugadores.</p>

          <div class="form-group" style="margin-top: 20px;">
            <label for="input-new-admin-pwd">Nueva Contraseña de Administrador</label>
            <input type="password" id="input-new-admin-pwd" class="form-control" placeholder="Introduce la nueva clave..." />
          </div>

          <div class="form-group">
            <label for="input-confirm-admin-pwd">Confirmar Contraseña</label>
            <input type="password" id="input-confirm-admin-pwd" class="form-control" placeholder="Repite la clave..." />
          </div>

          <button id="btn-save-admin-pwd" class="btn btn-primary" style="margin-top: 12px;">
            💾 Actualizar Contraseña
          </button>
        </div>
      </div>
    `;
  }

  bindGlobalAdminEvents() {
    // 1. Navegación entre subpestañas
    const tabQ = this.container.querySelector('#admin-subtab-questions');
    if (tabQ) {
      tabQ.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        this.activeAdminTab = 'questions';
        this.render();
      });
    }

    const tabR = this.container.querySelector('#admin-subtab-results');
    if (tabR) {
      tabR.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        this.activeAdminTab = 'results';
        this.render();
      });
    }

    const tabS = this.container.querySelector('#admin-subtab-security');
    if (tabS) {
      tabS.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        this.activeAdminTab = 'security';
        this.render();
      });
    }

    // Salir del rol admin
    const btnLogout = this.container.querySelector('#btn-admin-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.onExitAdmin();
      });
    }

    // Eventos específicos según la pestaña
    if (this.activeAdminTab === 'questions') {
      this.bindQuestionsEvents();
    } else if (this.activeAdminTab === 'results') {
      this.bindResultsEvents();
    } else if (this.activeAdminTab === 'security') {
      this.bindSecurityEvents();
    }
  }

  bindQuestionsEvents() {
    // Navegación de preguntas
    this.container.querySelectorAll('.q-nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-index'), 10);
        this.saveCurrentInputsInMemory();
        this.activeQuestionIndex = idx;
        this.render();
      });
    });

    // Añadir nueva pregunta
    const btnAddQ = this.container.querySelector('#btn-add-question');
    if (btnAddQ) {
      btnAddQ.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        const newQuestion = {
          id: 'q-' + Date.now(),
          question: 'Nueva Pregunta ' + (this.quiz.questions.length + 1),
          options: ['Opción correcta', 'Opción incorrecta 1', 'Opción incorrecta 2'],
          correctAnswer: 0,
          feedback: ''
        };
        this.quiz.questions.push(newQuestion);
        this.activeQuestionIndex = this.quiz.questions.length - 1;
        this.render();
      });
    }

    // Eliminar pregunta activa
    const btnDeleteQ = this.container.querySelector('#btn-delete-q');
    if (btnDeleteQ) {
      btnDeleteQ.addEventListener('click', () => {
        if (this.quiz.questions.length <= 1) {
          alert('El cuestionario debe tener al menos una pregunta.');
          return;
        }
        if (confirm('¿Seguro que deseas eliminar esta pregunta?')) {
          this.quiz.questions.splice(this.activeQuestionIndex, 1);
          if (this.activeQuestionIndex >= this.quiz.questions.length) {
            this.activeQuestionIndex = this.quiz.questions.length - 1;
          }
          this.render();
        }
      });
    }

    // Duplicar pregunta
    const btnDuplicateQ = this.container.querySelector('#btn-duplicate-q');
    if (btnDuplicateQ) {
      btnDuplicateQ.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        const currentQ = this.quiz.questions[this.activeQuestionIndex];
        const cloned = JSON.parse(JSON.stringify(currentQ));
        cloned.id = 'q-' + Date.now();
        cloned.question += ' (Copia)';
        this.quiz.questions.splice(this.activeQuestionIndex + 1, 0, cloned);
        this.activeQuestionIndex++;
        this.render();
      });
    }

    // Subir orden
    const btnMoveUp = this.container.querySelector('#btn-move-up-q');
    if (btnMoveUp) {
      btnMoveUp.addEventListener('click', () => {
        if (this.activeQuestionIndex > 0) {
          this.saveCurrentInputsInMemory();
          const temp = this.quiz.questions[this.activeQuestionIndex];
          this.quiz.questions[this.activeQuestionIndex] = this.quiz.questions[this.activeQuestionIndex - 1];
          this.quiz.questions[this.activeQuestionIndex - 1] = temp;
          this.activeQuestionIndex--;
          this.render();
        }
      });
    }

    // Bajar orden
    const btnMoveDown = this.container.querySelector('#btn-move-down-q');
    if (btnMoveDown) {
      btnMoveDown.addEventListener('click', () => {
        if (this.activeQuestionIndex < this.quiz.questions.length - 1) {
          this.saveCurrentInputsInMemory();
          const temp = this.quiz.questions[this.activeQuestionIndex];
          this.quiz.questions[this.activeQuestionIndex] = this.quiz.questions[this.activeQuestionIndex + 1];
          this.quiz.questions[this.activeQuestionIndex + 1] = temp;
          this.activeQuestionIndex++;
          this.render();
        }
      });
    }

    // Inputs de pregunta
    const inputQText = this.container.querySelector('#input-active-q-text');
    if (inputQText) {
      inputQText.addEventListener('input', (e) => {
        if (this.quiz.questions[this.activeQuestionIndex]) {
          this.quiz.questions[this.activeQuestionIndex].question = e.target.value;
          const navItem = this.container.querySelector(`.q-nav-item[data-index="${this.activeQuestionIndex}"] .q-nav-text`);
          if (navItem) navItem.textContent = e.target.value.substring(0, 36) || '(Pregunta vacía)';
        }
      });
    }

    const inputQFeedback = this.container.querySelector('#input-active-q-feedback');
    if (inputQFeedback) {
      inputQFeedback.addEventListener('input', (e) => {
        if (this.quiz.questions[this.activeQuestionIndex]) {
          this.quiz.questions[this.activeQuestionIndex].feedback = e.target.value;
        }
      });
    }

    // Opciones
    this.container.querySelectorAll('.option-input').forEach((optInput) => {
      optInput.addEventListener('input', (e) => {
        const optIdx = parseInt(e.target.getAttribute('data-opt-index'), 10);
        const q = this.quiz.questions[this.activeQuestionIndex];
        if (q && q.options[optIdx] !== undefined) {
          q.options[optIdx] = e.target.value;
        }
      });
    });

    // Marcar correcta
    this.container.querySelectorAll('input[name="correct-option-radio"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const optIdx = parseInt(e.target.value, 10);
        const q = this.quiz.questions[this.activeQuestionIndex];
        if (q) {
          q.correctAnswer = optIdx;
          this.render();
        }
      });
    });

    // Eliminar opción
    this.container.querySelectorAll('.btn-delete-opt').forEach((delBtn) => {
      delBtn.addEventListener('click', (e) => {
        const optIdx = parseInt(e.target.getAttribute('data-opt-index'), 10);
        const q = this.quiz.questions[this.activeQuestionIndex];
        if (q && q.options.length > 2) {
          q.options.splice(optIdx, 1);
          if (q.correctAnswer >= q.options.length) {
            q.correctAnswer = 0;
          } else if (q.correctAnswer === optIdx) {
            q.correctAnswer = 0;
          } else if (q.correctAnswer > optIdx) {
            q.correctAnswer--;
          }
          this.render();
        }
      });
    });

    // Añadir opción
    const btnAddOption = this.container.querySelector('#btn-add-option');
    if (btnAddOption) {
      btnAddOption.addEventListener('click', () => {
        const q = this.quiz.questions[this.activeQuestionIndex];
        if (q && q.options.length < 4) {
          q.options.push(`Opción ${q.options.length + 1}`);
          this.render();
        }
      });
    }

    // Parámetros globales
    const titleInput = this.container.querySelector('#edit-quiz-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.quiz.title = e.target.value;
      });
    }

    const descInput = this.container.querySelector('#edit-quiz-desc');
    if (descInput) {
      descInput.addEventListener('input', (e) => {
        this.quiz.description = e.target.value;
      });
    }

    const timeSelect = this.container.querySelector('#edit-quiz-time');
    if (timeSelect) {
      timeSelect.addEventListener('change', (e) => {
        this.quiz.timePerQuestion = parseInt(e.target.value, 10);
      });
    }

    const livesSelect = this.container.querySelector('#edit-quiz-lives');
    if (livesSelect) {
      livesSelect.addEventListener('change', (e) => {
        this.quiz.lives = parseInt(e.target.value, 10);
      });
    }

    const randQCheck = this.container.querySelector('#edit-quiz-rand-q');
    if (randQCheck) {
      randQCheck.addEventListener('change', (e) => {
        this.quiz.randomizeQuestions = e.target.checked;
      });
    }

    const randACheck = this.container.querySelector('#edit-quiz-rand-a');
    if (randACheck) {
      randACheck.addEventListener('change', (e) => {
        this.quiz.randomizeAnswers = e.target.checked;
      });
    }

    // Guardar
    const btnSave = this.container.querySelector('#btn-save-quiz');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        QuizStorage.saveQuiz(this.quiz);
        this.showToast('✅ ¡Cuestionario guardado con éxito!');
        this.onSave(this.quiz);
      });
    }

    // Exportar
    const btnExport = this.container.querySelector('#btn-export-quiz');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        QuizStorage.exportToFile(this.quiz, `${this.slugify(this.quiz.title || 'cuestionario')}.json`);
        this.showToast('📥 Archivo JSON descargado para compartir.');
      });
    }

    // Importar
    const inputImport = this.container.querySelector('#input-import-quiz');
    if (inputImport) {
      inputImport.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const imported = await QuizStorage.importFromFile(file);
            this.setQuiz(imported);
            QuizStorage.saveQuiz(imported);
            this.showToast('🎉 ¡Cuestionario importado con éxito!');
          } catch (err) {
            alert('Error al importar el archivo: ' + err.message);
          }
        }
      });
    }

    // Restaurar ejemplo
    const btnReset = this.container.querySelector('#btn-reset-quiz');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('¿Deseas restaurar el cuestionario a las preguntas originales sobre el camarón? Se perderán las modificaciones no exportadas.')) {
          const def = QuizStorage.resetToDefault();
          this.setQuiz(def);
          this.showToast('🔄 Cuestionario restaurado al original.');
        }
      });
    }

    // Abrir Modal de IA
    const btnOpenAi = this.container.querySelector('#btn-open-ai-modal');
    if (btnOpenAi) {
      btnOpenAi.addEventListener('click', () => {
        this.openAIGeneratorModal();
      });
    }

    // Probar / Vista previa
    const btnPlay = this.container.querySelector('#btn-play-from-editor');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        this.saveCurrentInputsInMemory();
        QuizStorage.saveQuiz(this.quiz);
        this.onPlay(this.quiz);
      });
    }
  }

  openAIGeneratorModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (!modal) return;

    // Resetear a paso 1
    document.getElementById('ai-step-upload').classList.remove('view-hidden');
    document.getElementById('ai-step-loading').classList.add('view-hidden');
    document.getElementById('ai-step-preview').classList.add('view-hidden');
    document.getElementById('ai-generate-error').classList.add('view-hidden');

    // Cargar API Key almacenada
    const inputKey = document.getElementById('input-gemini-api-key');
    if (inputKey) inputKey.value = AIGenerator.getStoredApiKey();

    modal.classList.remove('view-hidden');
  }

  closeAIGeneratorModal() {
    const modal = document.getElementById('modal-ai-generator');
    if (modal) modal.classList.add('view-hidden');
  }

  bindAIGeneratorEvents() {
    // Dropzone y Selección de Archivo
    const dropzone = document.getElementById('ai-file-dropzone');
    const fileInput = document.getElementById('input-ai-document');
    const fileInfoBox = document.getElementById('ai-file-info');
    const fileNameEl = document.getElementById('ai-file-name');
    const fileMetaEl = document.getElementById('ai-file-meta');
    const btnRemoveFile = document.getElementById('btn-remove-ai-file');
    const errorEl = document.getElementById('ai-generate-error');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-active');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-active');
      });

      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          await this.processSelectedAiFile(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this.processSelectedAiFile(e.target.files[0]);
        }
      });
    }

    if (btnRemoveFile) {
      btnRemoveFile.addEventListener('click', () => {
        this.currentAiFile = null;
        this.currentExtractedDoc = null;
        if (fileInput) fileInput.value = '';
        if (fileInfoBox) fileInfoBox.classList.add('view-hidden');
        if (dropzone) dropzone.classList.remove('view-hidden');
      });
    }

    // Slider de cantidad de preguntas
    const countSlider = document.getElementById('ai-question-count');
    const countDisplay = document.getElementById('ai-question-count-display');
    if (countSlider && countDisplay) {
      countSlider.addEventListener('input', (e) => {
        countDisplay.textContent = `${e.target.value} preguntas`;
      });
    }

    // Guardar API Key de Gemini
    const btnSaveKey = document.getElementById('btn-save-gemini-key');
    if (btnSaveKey) {
      btnSaveKey.addEventListener('click', () => {
        const key = document.getElementById('input-gemini-api-key').value;
        AIGenerator.saveApiKey(key);
        this.showToast('🔑 Clave de Gemini API guardada con éxito.');
      });
    }

    // Botón Iniciar Generación con IA
    const btnStartAi = document.getElementById('btn-start-ai-generate');
    if (btnStartAi) {
      btnStartAi.addEventListener('click', async () => {
        if (!this.currentExtractedDoc || !this.currentExtractedDoc.text) {
          if (errorEl) {
            errorEl.textContent = 'Por favor selecciona primero un archivo PDF o una presentación PowerPoint (.pptx).';
            errorEl.classList.remove('view-hidden');
          }
          return;
        }

        const questionCount = parseInt(document.getElementById('ai-question-count').value, 10) || 5;
        const difficulty = document.getElementById('ai-difficulty').value || 'media';
        const apiKey = document.getElementById('input-gemini-api-key').value;

        // Cambiar a pantalla de carga
        document.getElementById('ai-step-upload').classList.add('view-hidden');
        document.getElementById('ai-step-loading').classList.remove('view-hidden');
        document.getElementById('ai-loading-title').textContent = 'Analizando contenido con Inteligencia Artificial...';
        document.getElementById('ai-loading-desc').textContent = `Extrayendo conceptos clave para generar ${questionCount} preguntas con nivel ${difficulty}...`;

        try {
          const generatedQuiz = await AIGenerator.generateQuizFromDocument(this.currentExtractedDoc.text, {
            questionCount,
            difficulty,
            apiKey
          });

          this.currentGeneratedQuiz = generatedQuiz;
          this.showAiPreview(generatedQuiz);
        } catch (err) {
          console.error('Error generando preguntas:', err);
          document.getElementById('ai-step-loading').classList.add('view-hidden');
          document.getElementById('ai-step-upload').classList.remove('view-hidden');
          if (errorEl) {
            errorEl.textContent = `Error al generar preguntas: ${err.message}`;
            errorEl.classList.remove('view-hidden');
          }
        }
      });
    }

    // Botones de cancelar y volver
    const btnCancel = document.getElementById('btn-cancel-ai');
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeAIGeneratorModal());

    const btnBack = document.getElementById('btn-back-ai-upload');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        document.getElementById('ai-step-preview').classList.add('view-hidden');
        document.getElementById('ai-step-upload').classList.remove('view-hidden');
      });
    }

    // Botón Aplicar Cuestionario al Juego
    const btnAccept = document.getElementById('btn-accept-ai-quiz');
    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        if (!this.currentGeneratedQuiz || !this.currentGeneratedQuiz.questions) return;

        const importModeRadio = document.querySelector('input[name="ai-import-mode"]:checked');
        const mode = importModeRadio ? importModeRadio.value : 'replace';

        if (mode === 'replace') {
          this.quiz.title = this.currentGeneratedQuiz.title || this.quiz.title;
          this.quiz.description = this.currentGeneratedQuiz.description || this.quiz.description;
          this.quiz.questions = this.currentGeneratedQuiz.questions;
        } else {
          this.quiz.questions.push(...this.currentGeneratedQuiz.questions);
        }

        QuizStorage.saveQuiz(this.quiz);
        this.closeAIGeneratorModal();
        this.activeQuestionIndex = 0;
        this.render();
        this.showToast(`🎉 ¡${this.currentGeneratedQuiz.questions.length} preguntas añadidas exitosamente!`);
        this.onSave(this.quiz);
      });
    }
  }

  async processSelectedAiFile(file) {
    const dropzone = document.getElementById('ai-file-dropzone');
    const fileInfoBox = document.getElementById('ai-file-info');
    const fileNameEl = document.getElementById('ai-file-name');
    const fileMetaEl = document.getElementById('ai-file-meta');
    const errorEl = document.getElementById('ai-generate-error');

    if (errorEl) errorEl.classList.add('view-hidden');

    try {
      if (dropzone) dropzone.classList.add('view-hidden');
      if (fileInfoBox) fileInfoBox.classList.remove('view-hidden');
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileMetaEl) fileMetaEl.textContent = `Extrayendo texto del documento (${(file.size / 1024).toFixed(1)} KB)...`;

      const extracted = await DocumentParser.extractText(file);
      this.currentAiFile = file;
      this.currentExtractedDoc = extracted;

      const unitName = extracted.type === 'PDF' ? 'páginas' : 'diapositivas';
      if (fileMetaEl) {
        fileMetaEl.textContent = `${extracted.type} • ${extracted.pageCount} ${unitName} • ${extracted.text.length} caracteres leídos`;
      }
    } catch (err) {
      if (fileInfoBox) fileInfoBox.classList.add('view-hidden');
      if (dropzone) dropzone.classList.remove('view-hidden');
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('view-hidden');
      }
    }
  }

  showAiPreview(quizData) {
    document.getElementById('ai-step-loading').classList.add('view-hidden');
    document.getElementById('ai-step-preview').classList.remove('view-hidden');

    const titleEl = document.getElementById('ai-preview-title');
    const descEl = document.getElementById('ai-preview-desc');
    const listEl = document.getElementById('ai-preview-list');

    if (titleEl) titleEl.textContent = quizData.title;
    if (descEl) descEl.textContent = `${quizData.description} (Fuente: ${quizData.source})`;

    const letters = ['A', 'B', 'C', 'D'];
    if (listEl) {
      listEl.innerHTML = quizData.questions
        .map(
          (q, idx) => `
        <div class="ai-preview-q-card">
          <div class="ai-preview-q-num">Pregunta ${idx + 1}</div>
          <h4 class="ai-preview-q-text">${this.escapeHtml(q.question)}</h4>
          <div class="ai-preview-options-grid">
            ${q.options
              .map(
                (opt, oIdx) => `
              <div class="ai-opt-pill ${oIdx === q.correctAnswer ? 'is-correct' : ''}">
                <span class="letter">${letters[oIdx]}</span>
                <span class="text">${this.escapeHtml(opt)}</span>
                ${oIdx === q.correctAnswer ? '<span class="correct-badge">✓ Correcta</span>' : ''}
              </div>
            `
              )
              .join('')}
          </div>
          ${q.feedback ? `<div class="ai-preview-feedback">💡 <em>${this.escapeHtml(q.feedback)}</em></div>` : ''}
        </div>
      `
        )
        .join('');
    }
  }

  bindResultsEvents() {
    const btnExportCsv = this.container.querySelector('#btn-export-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        const ok = ResultsStorage.exportToCSV();
        if (ok) {
          this.showToast('📥 Reporte de calificaciones descargado en CSV.');
        }
      });
    }

    const btnClearResults = this.container.querySelector('#btn-clear-results');
    if (btnClearResults) {
      btnClearResults.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas eliminar todo el historial de puntuaciones de los jugadores? Esta acción no se puede deshacer.')) {
          ResultsStorage.clearResults();
          this.render();
          this.showToast('🗑️ Historial eliminado correctamente.');
        }
      });
    }
  }

  bindSecurityEvents() {
    const btnSavePwd = this.container.querySelector('#btn-save-admin-pwd');
    if (btnSavePwd) {
      btnSavePwd.addEventListener('click', () => {
        const newPwd = this.container.querySelector('#input-new-admin-pwd').value;
        const confirmPwd = this.container.querySelector('#input-confirm-admin-pwd').value;

        if (!newPwd || newPwd.trim().length < 4) {
          alert('La contraseña debe tener al menos 4 caracteres.');
          return;
        }
        if (newPwd !== confirmPwd) {
          alert('Las contraseñas no coinciden. Por favor, verifícalas.');
          return;
        }

        AdminStorage.setPassword(newPwd);
        this.showToast('🔒 Contraseña de administrador actualizada.');
        this.container.querySelector('#input-new-admin-pwd').value = '';
        this.container.querySelector('#input-confirm-admin-pwd').value = '';
      });
    }
  }

  saveCurrentInputsInMemory() {
    const titleInput = this.container.querySelector('#edit-quiz-title');
    if (titleInput) this.quiz.title = titleInput.value;

    const descInput = this.container.querySelector('#edit-quiz-desc');
    if (descInput) this.quiz.description = descInput.value;

    const timeSelect = this.container.querySelector('#edit-quiz-time');
    if (timeSelect) this.quiz.timePerQuestion = parseInt(timeSelect.value, 10);

    const livesSelect = this.container.querySelector('#edit-quiz-lives');
    if (livesSelect) this.quiz.lives = parseInt(livesSelect.value, 10);

    const randQCheck = this.container.querySelector('#edit-quiz-rand-q');
    if (randQCheck) this.quiz.randomizeQuestions = randQCheck.checked;

    const randACheck = this.container.querySelector('#edit-quiz-rand-a');
    if (randACheck) this.quiz.randomizeAnswers = randACheck.checked;

    const q = this.quiz.questions[this.activeQuestionIndex];
    if (q) {
      const qText = this.container.querySelector('#input-active-q-text');
      if (qText) q.question = qText.value;

      const qFeedback = this.container.querySelector('#input-active-q-feedback');
      if (qFeedback) q.feedback = qFeedback.value;

      this.container.querySelectorAll('.option-input').forEach((optInput) => {
        const optIdx = parseInt(optInput.getAttribute('data-opt-index'), 10);
        if (q.options[optIdx] !== undefined) {
          q.options[optIdx] = optInput.value;
        }
      });
    }
  }

  showToast(message) {
    let toast = document.getElementById('editor-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'editor-toast';
      toast.className = 'editor-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
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

  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '_');
  }
}
