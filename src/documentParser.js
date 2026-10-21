import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export class DocumentParser {
  /**
   * Extrae el texto de un archivo PDF o PPTX
   * @param {File} file 
   * @returns {Promise<{ text: string, type: string, pageCount: number }>}
   */
  static async extractText(file) {
    if (!file) throw new Error('No se ha proporcionado ningún archivo');

    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'pdf') {
      return await this.extractFromPDF(file);
    } else if (extension === 'pptx' || extension === 'ppt') {
      return await this.extractFromPPTX(file);
    } else {
      throw new Error(`Formato .${extension} no soportado. Por favor sube un archivo .PDF o .PPTX`);
    }
  }

  /**
   * Extrae texto de un archivo PDF usando pdfjs-dist
   */
  static async extractFromPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(' ');
        fullText += `--- PÁGINA ${i} ---\n${pageText}\n\n`;
      }

      if (!fullText.trim()) {
        throw new Error('El PDF parece estar vacío o contener únicamente imágenes escaneadas sin texto seleccionable.');
      }

      return {
        text: fullText.trim(),
        type: 'PDF',
        pageCount: numPages
      };
    } catch (err) {
      console.error('Error al procesar PDF:', err);
      throw new Error(`Error al leer el archivo PDF: ${err.message}`);
    }
  }

  /**
   * Extrae texto de una presentación PPTX desempaquetando el archivo ZIP y analizando los XML de diapositivas
   */
  static async extractFromPPTX(file) {
    try {
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(file);
      const slideFiles = [];

      // Localizar todos los archivos ppt/slides/slide*.xml
      loadedZip.forEach((relativePath) => {
        if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
          slideFiles.push(relativePath);
        }
      });

      if (slideFiles.length === 0) {
        throw new Error('No se encontraron diapositivas válidas en el archivo PPTX.');
      }

      // Ordenar por número de diapositiva (slide1, slide2, slide10...)
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/i)[1], 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml/i)[1], 10);
        return numA - numB;
      });

      const parser = new DOMParser();
      let fullText = '';

      for (let i = 0; i < slideFiles.length; i++) {
        const slidePath = slideFiles[i];
        const xmlContent = await loadedZip.file(slidePath).async('text');
        const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

        // Extraer todos los elementos <a:t> (text runs en OpenXML)
        const textNodes = xmlDoc.getElementsByTagName('a:t');
        const slideTexts = [];
        for (let j = 0; j < textNodes.length; j++) {
          const t = textNodes[j].textContent.trim();
          if (t) slideTexts.push(t);
        }

        if (slideTexts.length > 0) {
          fullText += `--- DIAPOSITIVA ${i + 1} ---\n${slideTexts.join(' ')}\n\n`;
        }
      }

      if (!fullText.trim()) {
        throw new Error('La presentación no contiene texto legible (podría contener solo imágenes o diagramas).');
      }

      return {
        text: fullText.trim(),
        type: 'PPTX',
        pageCount: slideFiles.length
      };
    } catch (err) {
      console.error('Error al procesar PPTX:', err);
      throw new Error(`Error al leer la presentación PowerPoint: ${err.message}`);
    }
  }
}
