const GEMINI_KEY_STORAGE = 'juego_camaron_gemini_api_key';

export class AIGenerator {
  static getStoredApiKey() {
    return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  }

  static saveApiKey(key) {
    if (key) {
      localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  }

  /**
   * Genera preguntas educativas a partir del texto de un documento
   * @param {string} documentText 
   * @param {object} options { questionCount: number, difficulty: string, apiKey: string }
   */
  static async generateQuizFromDocument(documentText, options = {}) {
    const questionCount = options.questionCount || 5;
    const difficulty = options.difficulty || 'media';
    const apiKey = options.apiKey || this.getStoredApiKey();

    if (!documentText || documentText.trim().length < 50) {
      throw new Error('El documento no contiene suficiente texto para generar preguntas relevantes (mínimo 50 caracteres).');
    }

    // Si el usuario proporcionó una clave de API de Gemini, usamos Google Gemini
    if (apiKey) {
      return await this.callGeminiAPI(documentText, questionCount, difficulty, apiKey);
    } else {
      // Modo Heurístico Local / Demostración si aún no ingresó su API Key de Gemini
      return this.generateHeuristicQuestions(documentText, questionCount);
    }
  }

  /**
   * Llama a la API de Google Gemini (gemini-1.5-flash o gemini-2.0-flash)
   */
  static async callGeminiAPI(documentText, count, difficulty, apiKey) {
    // Truncar texto si es excesivamente largo para optimizar tokens (~30,000 caracteres)
    const truncatedText = documentText.length > 30000 ? documentText.substring(0, 30000) + '...' : documentText;

    const prompt = `
Eres un experto pedagógico en diseño de actividades interactivas estilo Educaplay ("Froggy Jumps").
A partir del siguiente texto extraído de un documento (PDF o diapositivas PowerPoint), genera exactamente ${count} preguntas educativas de opción múltiple con nivel de dificultad ${difficulty}.

REGLAS OBLIGATORIAS:
1. Cada pregunta debe tener exactamente 4 opciones de respuesta claras y concisas.
2. La opción en el índice 0 (la primera) DEBE SER SIEMPRE LA RESPUESTA CORRECTA. Las otras 3 deben ser distractores plausibles basados en el tema.
3. Incluye una breve explicación o retroalimentación pedagógica en "feedback" explicando por qué es la respuesta correcta basada en el texto.
4. Genera también un título atractivo y una descripción para el juego.
5. Devuelve ÚNICAMENTE un objeto JSON válido, sin bloques de código markdown ni texto adicional.

FORMATO JSON ESPERADO:
{
  "title": "Título sugerido para el juego",
  "description": "Breve descripción de la actividad",
  "questions": [
    {
      "question": "¿Enunciado de la pregunta?",
      "options": [
        "Respuesta correcta",
        "Opción incorrecta 1",
        "Opción incorrecta 2",
        "Opción incorrecta 3"
      ],
      "correctAnswer": 0,
      "feedback": "Explicación educativa de la respuesta correcta..."
    }
  ]
}

TEXTO DEL DOCUMENTO:
${truncatedText}
`;

    // Probamos primero con gemini-1.5-flash y fallback a gemini-2.0-flash
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    ];

    let lastError = null;

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2500,
              responseMimeType: 'application/json'
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawContent) {
          throw new Error('La respuesta de Gemini no contiene datos.');
        }

        // Limpiar posible formato markdown en caso de que lo incluya
        const cleanedJson = rawContent
          .replace(/^```json/im, '')
          .replace(/^```/im, '')
          .replace(/```$/im, '')
          .trim();

        const parsed = JSON.parse(cleanedJson);

        if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
          throw new Error('La IA no devolvió preguntas en el formato esperado.');
        }

        // Normalizar preguntas con IDs únicos
        const questions = parsed.questions.slice(0, count).map((q, idx) => ({
          id: `ai-q-${idx}-${Date.now()}`,
          question: q.question,
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options.slice(0, 4) : ['Opción A', 'Opción B'],
          correctAnswer: 0,
          feedback: q.feedback || ''
        }));

        return {
          title: parsed.title || 'Cuestionario Generado por IA',
          description: parsed.description || 'Preguntas generadas automáticamente a partir de tu presentación o documento.',
          questions: questions,
          source: 'Google Gemini AI'
        };
      } catch (err) {
        lastError = err;
        console.warn(`Fallo al consultar endpoint ${url}:`, err);
      }
    }

    throw new Error(`Error en la generación con IA: ${lastError?.message || 'Error desconocido'}`);
  }

  /**
   * Generador heurístico local inteligente (usado si el usuario no tiene API Key configurada)
   */
  static generateHeuristicQuestions(documentText, count) {
    // Dividir texto en párrafos o secciones significativas
    const lines = documentText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 20 && !l.startsWith('---'));

    if (lines.length === 0) {
      throw new Error('No se detectaron oraciones suficientes en el documento para analizar.');
    }

    const questions = [];
    const step = Math.max(1, Math.floor(lines.length / count));

    for (let i = 0; i < count && i * step < lines.length; i++) {
      const sentence = lines[i * step];
      const words = sentence.split(' ').filter((w) => w.length > 4);
      const keyword = words[Math.floor(words.length / 2)] || 'concepto principal';

      questions.push({
        id: `local-q-${i}-${Date.now()}`,
        question: `Según el documento: ${sentence.length > 90 ? sentence.substring(0, 90) + '...' : sentence}`,
        options: [
          `Opción correcta fundamentada en: "${keyword}"`,
          `Alternativa incorrecta relacionada con el contexto general`,
          `Afirmación contraria a lo expuesto en el tema`,
          `Concepto no mencionado en la diapositiva`
        ],
        correctAnswer: 0,
        feedback: `Información extraída directamente de la sección: "${sentence.substring(0, 60)}..."`
      });
    }

    return {
      title: 'Cuestionario Extraído del Documento',
      description: 'Preguntas sintetizadas a partir de los puntos clave del archivo cargado.',
      questions: questions,
      source: 'Extractor Inteligente Local (Configura tu API Key de Gemini para preguntas avanzadas con IA)'
    };
  }
}
