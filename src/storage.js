// Sistema de almacenamiento y gestión de cuestionarios tipo Educaplay
export const DEFAULT_QUIZ = {
  id: 'camaron-default-01',
  title: 'El Gran Salto del Camarón: Aventura Acuática',
  description: 'Ayuda al camarón a saltar de piscina en piscina respondiendo correctamente cada pregunta sobre el fascinante mundo acuático y su hábitat.',
  timePerQuestion: 20, // segundos (0 = sin límite)
  lives: 3,
  pointsPerCorrect: 100,
  randomizeQuestions: false,
  randomizeAnswers: true,
  questions: [
    {
      id: 'q1',
      question: '¿Qué tipo de animal es el camarón?',
      options: [
        'Un crustáceo decápodo',
        'Un molusco gasterópodo',
        'Un pez óseo',
        'Un anfibio de agua dulce'
      ],
      correctAnswer: 0,
      feedback: '¡Exacto! Los camarones son crustáceos decápodos porque poseen diez patas (cinco pares).'
    },
    {
      id: 'q2',
      question: '¿Por qué las piscinas de cultivo de camarón necesitan aireadores que baten el agua?',
      options: [
        'Para oxigenar el agua y mantener a los camarones saludables',
        'Para enfriar el agua y hacerla potable',
        'Para evitar que las algas crezcan rápidamente',
        'Para empujar a los camarones hacia el borde'
      ],
      correctAnswer: 0,
      feedback: '¡Muy bien! Los aireadores crean burbujas y corrientes que aportan el oxígeno disuelto vital para su crecimiento.'
    },
    {
      id: 'q3',
      question: '¿Dónde se encuentra el corazón de un camarón?',
      options: [
        'En la cabeza (cefalotórax)',
        'En la punta de la cola',
        'En el abdomen medio',
        'No tienen corazón'
      ],
      correctAnswer: 0,
      feedback: '¡Increíble pero cierto! La anatomía del camarón concentra sus órganos vitales, incluido el corazón, en la cabeza o cefalotórax.'
    },
    {
      id: 'q4',
      question: '¿Qué le sucede al camarón cuando crece y su caparazón le queda pequeño?',
      options: [
        'Muda su exoesqueleto (proceso de ecdisis)',
        'Su caparazón se estira como un globo',
        'Busca la concha vacía de otro animal',
        'Deja de alimentarse para no crecer más'
      ],
      correctAnswer: 0,
      feedback: '¡Correcto! Los camarones mudan periódicamente su caparazón rígido para poder aumentar de tamaño.'
    },
    {
      id: 'q5',
      question: '¿Cuál es el color natural de la mayoría de camarones vivos en el agua?',
      options: [
        'Translúcidos o grisáceos para camuflarse',
        'Rojo brillante e intenso',
        'Amarillo neón con rayas negras',
        'Azul eléctrico en todas las especies'
      ],
      correctAnswer: 0,
      feedback: '¡Excelente! En su medio natural son casi transparentes para pasar desapercibidos ante los depredadores. Solo se vuelven anaranjados al cocinarse.'
    },
    {
      id: 'q6',
      question: '¿Cómo se impulsan los camarones para dar un salto rápido hacia atrás?',
      options: [
        'Flexionando con fuerza su cola y abanico caudal',
        'Soltando un chorro de tinta',
        'Aleteando con sus largas antenas',
        'Inflándose de burbujas de aire'
      ],
      correctAnswer: 0,
      feedback: '¡Gran salto! Mediante una rápida contracción abdominal hacia abajo, el camarón puede impulsarse hacia atrás a gran velocidad.'
    },
    {
      id: 'q7',
      question: '¿Para qué utilizan los camarones sus largas antenas?',
      options: [
        'Para orientarse, sentir corrientes y detectar comida o peligros',
        'Exclusivamente para nadar en línea recta',
        'Para comunicarse mediante ondas de radio',
        'Para atrapar presas grandes'
      ],
      correctAnswer: 0,
      feedback: '¡Así es! Las antenas y anténulas son órganos sensoriales fundamentales para explorar su entorno acuático.'
    }
  ]
};

const STORAGE_KEY = 'juego_camaron_quiz_data';
const PLAYER_KEY = 'juego_camaron_player_session';
const RESULTS_KEY = 'juego_camaron_results_history';
const ADMIN_PWD_KEY = 'juego_camaron_admin_pwd';

export class QuizStorage {
  static loadQuiz() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error al cargar cuestionario de localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_QUIZ));
  }

  static saveQuiz(quizData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quizData));
      return true;
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
      return false;
    }
  }

  static resetToDefault() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return JSON.parse(JSON.stringify(DEFAULT_QUIZ));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_QUIZ));
    }
  }

  static exportToFile(quizData, filename = 'cuestionario_salto_camaron.json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(quizData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  static importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No se seleccionó ningún archivo'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            reject(new Error('El archivo no contiene un formato de cuestionario válido (falta la lista de preguntas).'));
            return;
          }
          const normalized = {
            id: parsed.id || 'quiz-' + Date.now(),
            title: parsed.title || 'Cuestionario Importado',
            description: parsed.description || '',
            timePerQuestion: typeof parsed.timePerQuestion === 'number' ? parsed.timePerQuestion : 20,
            lives: typeof parsed.lives === 'number' ? parsed.lives : 3,
            pointsPerCorrect: typeof parsed.pointsPerCorrect === 'number' ? parsed.pointsPerCorrect : 100,
            randomizeQuestions: Boolean(parsed.randomizeQuestions),
            randomizeAnswers: parsed.randomizeAnswers !== undefined ? Boolean(parsed.randomizeAnswers) : true,
            questions: parsed.questions.map((q, idx) => ({
              id: q.id || `q-${idx}-${Date.now()}`,
              question: q.question || `Pregunta ${idx + 1}`,
              options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Opción 1', 'Opción 2'],
              correctAnswer: typeof q.correctAnswer === 'number' && q.correctAnswer < (q.options ? q.options.length : 2) ? q.correctAnswer : 0,
              feedback: q.feedback || ''
            }))
          };
          resolve(normalized);
        } catch (err) {
          reject(new Error('Error al parsear el archivo JSON: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  }
}

// Almacenamiento y Sesión del Jugador Registrado
export class PlayerStorage {
  static getPlayer() {
    try {
      const data = localStorage.getItem(PLAYER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  static savePlayer(player) {
    try {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
      return true;
    } catch (e) {
      return false;
    }
  }

  static clearPlayer() {
    localStorage.removeItem(PLAYER_KEY);
  }
}

// Seguridad y Acceso del Administrador
export class AdminStorage {
  static getPassword() {
    return localStorage.getItem(ADMIN_PWD_KEY) || 'admin123';
  }

  static setPassword(newPwd) {
    localStorage.setItem(ADMIN_PWD_KEY, newPwd);
  }

  static verifyPassword(inputPwd) {
    const current = this.getPassword();
    return inputPwd.trim() === current.trim();
  }
}

// Historial de Calificaciones y Resultados de los Jugadores
export class ResultsStorage {
  static getResults() {
    try {
      const raw = localStorage.getItem(RESULTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static saveResult(resultData) {
    try {
      const list = this.getResults();
      const record = {
        id: 'res-' + Date.now(),
        date: new Date().toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }),
        timestamp: Date.now(),
        ...resultData
      };
      list.unshift(record); // más reciente primero
      localStorage.setItem(RESULTS_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error('Error guardando resultado:', e);
      return false;
    }
  }

  static clearResults() {
    localStorage.removeItem(RESULTS_KEY);
  }

  static exportToCSV() {
    const results = this.getResults();
    if (results.length === 0) return false;

    const headers = ['Fecha', 'Jugador', 'Cédula', 'Correo', 'Fecha Nacimiento', 'Puntaje', 'Vidas Restantes', 'Preguntas'];
    const rows = results.map(r => [
      `"${r.date || ''}"`,
      `"${r.playerName || ''}"`,
      `"${r.cedula || ''}"`,
      `"${r.email || ''}"`,
      `"${r.birthDate || ''}"`,
      r.score || 0,
      r.livesRemaining !== undefined ? r.livesRemaining : '-',
      `"${r.questionsAnswered || 0}/${r.totalQuestions || 0}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_jugadores_camaron_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    link.remove();
    return true;
  }
}
