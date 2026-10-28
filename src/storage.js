// Sistema de almacenamiento y gestión de cuestionarios tipo Educaplay
export const DEFAULT_QUIZ = {
  id: 'langosta-default-01',
  title: 'El Gran Salto de la Langosta: Aventura Acuática',
  description: 'Ayuda a la simpática langosta a saltar de piscina en piscina respondiendo correctamente cada pregunta sobre el fascinante ecosistema acuático y biología marina.',
  timePerQuestion: 20, // segundos (0 = sin límite)
  lives: 3,
  pointsPerCorrect: 100,
  randomizeQuestions: true, // Por defecto activado para orden aleatorio
  randomizeAnswers: true,
  questions: [
    {
      id: 'q1',
      question: '¿Qué tipo de extremidades principales caracterizan a las langostas y les permiten sujetar alimentos y defenderse?',
      options: [
        'Un par de grandes y poderosas pinzas o quelas',
        'Tentáculos con ventosas adherentes',
        'Aletas natatorias de cartílago',
        'Espinas dorsales venenosas'
      ],
      correctAnswer: 0,
      feedback: '¡Exacto! Las langostas tienen grandes quelas o pinzas frontales muy fuertes que usan para alimentarse y protegerse.'
    },
    {
      id: 'q2',
      question: '¿Por qué las piscinas y estanques de acuicultura necesitan sistemas de aireación continua?',
      options: [
        'Para suministrar oxígeno disuelto vital y mantener el agua saludable',
        'Para enfriar el agua hasta congelarla',
        'Para evitar que las piedras del fondo floten',
        'Para que los animales no puedan nadar hacia el centro'
      ],
      correctAnswer: 0,
      feedback: '¡Muy bien! Los aireadores crean burbujas y corrientes que mantienen niveles óptimos de oxígeno en el agua.'
    },
    {
      id: 'q3',
      question: '¿Cómo renuevan las langostas su duro caparazón exterior cuando crecen?',
      options: [
        'Mediante el proceso de muda o ecdisis de su exoesqueleto',
        'Estirando el caparazón con agua caliente',
        'Buscando y habitando la concha vacía de caracoles',
        'Cambiando de color cada estación del año'
      ],
      correctAnswer: 0,
      feedback: '¡Correcto! Al crecer, la langosta se desprende de su caparazón rígido y forma uno nuevo más grande.'
    },
    {
      id: 'q4',
      question: '¿Dónde se encuentran concentrados los órganos vitales más importantes de una langosta?',
      options: [
        'En el cefalotórax (región de la cabeza y tórax)',
        'En el extremo de su abanico caudal',
        'En el interior de sus pinzas delanteras',
        'Distribuido únicamente en sus patas traseras'
      ],
      correctAnswer: 0,
      feedback: '¡Así es! La anatomía de los crustáceos concentra sus órganos vitales, como el corazón y estómago, en el cefalotórax protegido por el caparazón.'
    },
    {
      id: 'q5',
      question: '¿Cómo utilizan las langostas su cola o abdomen para escapar rápidamente ante una amenaza?',
      options: [
        'Flexionan con fuerza el abdomen hacia adelante dando un gran impulso hacia atrás',
        'Expulsan una nube de tinta oscura',
        'Se enrollan como una esfera y flotan',
        'Aletean con sus largas antenas'
      ],
      correctAnswer: 0,
      feedback: '¡Gran salto! Con un potente golpe de cola hacia el vientre, las langostas se propulsan velozmente hacia atrás en el agua.'
    },
    {
      id: 'q6',
      question: '¿Para qué le sirven a la langosta sus largas antenas y anténulas?',
      options: [
        'Como órganos sensoriales para detectar corrientes, olores y peligros en el agua',
        'Únicamente para mantener el equilibrio al caminar',
        'Para atrapar presas grandes directamente',
        'Para generar calor en aguas frías'
      ],
      correctAnswer: 0,
      feedback: '¡Excelente! Las antenas tienen receptores químicos y táctiles fundamentales para orientarse en el medio acuático.'
    },
    {
      id: 'q7',
      question: '¿Qué pigmento natural le da a la langosta viva su color oscuro y cambia a rojo brillante al calentarse?',
      options: [
        'La astaxantina combinada con proteínas (crustacianina)',
        'La clorofila absorbida de las algas',
        'La melanina de la arena del fondo',
        'El caroteno de las zanahorias'
      ],
      correctAnswer: 0,
      feedback: '¡Dato curioso! La astaxantina está unida a proteínas que la mantienen oscura. Al calentarse, la proteína se desnaturaliza y resalta el rojo brillante.'
    }
  ]
};

const STORAGE_KEY = 'juego_langosta_quiz_data';
const USERS_LIST_KEY = 'juego_langosta_registered_users';
const ACTIVE_SESSION_KEY = 'juego_langosta_active_session';
const RESULTS_KEY = 'juego_langosta_results_history';
const ADMIN_PWD_KEY = 'juego_langosta_admin_pwd';

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

  static exportToFile(quizData, filename = 'cuestionario_salto_langosta.json') {
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
            randomizeQuestions: parsed.randomizeQuestions !== undefined ? Boolean(parsed.randomizeQuestions) : true,
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

// Almacenamiento y Gestión de Cuentas de Usuario (Registro e Inicio de Sesión)
export class UserStorage {
  static getUsers() {
    try {
      const raw = localStorage.getItem(USERS_LIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  static saveUsers(usersList) {
    try {
      localStorage.setItem(USERS_LIST_KEY, JSON.stringify(usersList));
      return true;
    } catch (e) {
      return false;
    }
  }

  static findUserByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    const users = this.getUsers();
    return users.find(u => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean || u.cedula === clean) || null;
  }

  static registerUser(userData) {
    const { username, password, fullName, cedula, email, birthDate } = userData;
    const users = this.getUsers();

    const cleanUsername = username.trim().toLowerCase();
    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
      throw new Error(`El nombre de usuario "${username}" ya está registrado. Elige otro diferente.`);
    }

    const cleanCedula = cedula.trim();
    if (users.some(u => u.cedula === cleanCedula)) {
      throw new Error(`El número de cédula "${cedula}" ya tiene una cuenta registrada.`);
    }

    const newUser = {
      id: 'usr-' + Date.now(),
      username: username.trim(),
      password: password.trim(),
      fullName: fullName.trim(),
      cedula: cleanCedula,
      email: email.trim().toLowerCase(),
      birthDate: birthDate,
      registeredAt: Date.now()
    };

    users.push(newUser);
    this.saveUsers(users);
    this.setCurrentSession(newUser);
    return newUser;
  }

  static loginUser(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Por favor ingresa tu usuario y contraseña.');
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u =>
      u.username.toLowerCase() === cleanIdentifier ||
      u.email.toLowerCase() === cleanIdentifier ||
      u.cedula === identifier.trim()
    );

    if (!user) {
      throw new Error('No existe ninguna cuenta con ese usuario, correo o cédula.');
    }

    if (user.password !== password.trim()) {
      throw new Error('Contraseña incorrecta. Por favor verifícala.');
    }

    this.setCurrentSession(user);
    return user;
  }

  static getCurrentSession() {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  static setCurrentSession(user) {
    try {
      // Guardar sesión sin exponer directamente la contraseña en la sesión activa
      const sessionData = { ...user };
      delete sessionData.password;
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Error guardando sesión:', e);
    }
  }

  static clearSession() {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

// Compatibilidad con PlayerStorage
export const PlayerStorage = {
  getPlayer: () => UserStorage.getCurrentSession(),
  savePlayer: (player) => UserStorage.setCurrentSession(player),
  clearPlayer: () => UserStorage.clearSession()
};

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

// Historial de Calificaciones y Reportes de los Jugadores
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

  static getUserResults(username) {
    if (!username) return [];
    const clean = username.trim().toLowerCase();
    const all = this.getResults();
    return all.filter(r => (r.username && r.username.toLowerCase() === clean) || (r.cedula && r.cedula === username));
  }

  static getUserStats(username) {
    const attempts = this.getUserResults(username);
    if (attempts.length === 0) {
      return {
        totalGames: 0,
        bestScore: 0,
        avgScore: 0,
        victoriesCount: 0,
        winRate: 0,
        lastPlayed: 'Sin partidas aún'
      };
    }

    const scores = attempts.map(a => a.score || 0);
    const bestScore = Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / attempts.length);
    const victoriesCount = attempts.filter(a => a.livesRemaining > 0 && a.questionsAnswered === a.totalQuestions).length;
    const winRate = Math.round((victoriesCount / attempts.length) * 100);

    return {
      totalGames: attempts.length,
      bestScore,
      avgScore,
      victoriesCount,
      winRate,
      lastPlayed: attempts[0].date
    };
  }

  static clearResults() {
    localStorage.removeItem(RESULTS_KEY);
  }

  static exportToCSV() {
    const results = this.getResults();
    if (results.length === 0) return false;

    const headers = ['Fecha', 'Usuario', 'Jugador', 'Cédula', 'Correo', 'Fecha Nacimiento', 'Puntaje', 'Vidas Restantes', 'Preguntas'];
    const rows = results.map(r => [
      `"${r.date || ''}"`,
      `"${r.username || '-'}"`,
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
    link.download = `reporte_jugadores_langosta_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    link.remove();
    return true;
  }
}
