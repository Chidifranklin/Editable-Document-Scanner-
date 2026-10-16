import { createWorker } from 'tesseract.js';
import { cleanTextRuleBased } from '../utils/textCleaner';

export interface OCRLanguage {
  code: string; // Tesseract code
  label: string;
  cloudName: string;
}

export const SUPPORTED_LANGUAGES: OCRLanguage[] = [
  { code: 'eng', label: 'English', cloudName: 'English' },
  { code: 'spa', label: 'Spanish (Español)', cloudName: 'Spanish' },
  { code: 'fra', label: 'French (Français)', cloudName: 'French' },
  { code: 'deu', label: 'German (Deutsch)', cloudName: 'German' },
  { code: 'por', label: 'Portuguese (Português)', cloudName: 'Portuguese' },
  { code: 'ita', label: 'Italian (Italiano)', cloudName: 'Italian' },
  { code: 'chi_sim', label: 'Chinese (Simplified)', cloudName: 'Simplified Chinese' },
  { code: 'jpn', label: 'Japanese (日本語)', cloudName: 'Japanese' },
  { code: 'rus', label: 'Russian (Русский)', cloudName: 'Russian' },
  { code: 'ara', label: 'Arabic (العربية)', cloudName: 'Arabic' },
  { code: 'hin', label: 'Hindi (हिन्दी)', cloudName: 'Hindi' },
];

export interface OCRResult {
  text: string;
  engine: 'cloud' | 'tesseract';
  confidence?: number;
  durationMs: number;
}

export interface ProgressCallback {
  (status: string, progress: number): void;
}

/**
 * Cloud Vision OCR using Gemini via backend server route
 */
export async function runCloudOCR(
  imageBase64: string,
  languageCode = 'eng',
  mode: 'document' | 'handwriting' = 'document',
  timeoutMs = 22000
): Promise<OCRResult> {
  const startTime = performance.now();
  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode);
  const cloudName = langObj ? langObj.cloudName : 'English';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        language: cloudName,
        mode,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server OCR request failed (${response.status})`);
    }

    const data = await response.json();
    const durationMs = Math.round(performance.now() - startTime);

    return {
      text: data.text || '',
      engine: 'cloud',
      durationMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Cloud Vision request timed out. You may be on a weak internet connection.');
    }
    throw error;
  }
}

/**
 * Offline Tesseract.js OCR engine
 */
let cachedWorker: any = null;
let currentWorkerLang = '';

export async function runTesseractOCR(
  imageSource: string | HTMLCanvasElement,
  languageCode = 'eng',
  onProgress?: ProgressCallback
): Promise<OCRResult> {
  const startTime = performance.now();

  try {
    onProgress?.('Initializing offline OCR engine...', 0.1);

    // Reuse worker if same language
    if (!cachedWorker || currentWorkerLang !== languageCode) {
      if (cachedWorker) {
        await cachedWorker.terminate().catch(() => {});
      }
      onProgress?.(`Loading ${languageCode} language model...`, 0.25);
      cachedWorker = await createWorker(languageCode, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.(`Recognizing text (${Math.round(m.progress * 100)}%)...`, 0.3 + m.progress * 0.65);
          } else if (m.status) {
            onProgress?.(`${m.status}...`, 0.2);
          }
        },
      });
      currentWorkerLang = languageCode;
    }

    onProgress?.('Extracting text locally...', 0.7);

    const ret = await cachedWorker.recognize(imageSource);
    const durationMs = Math.round(performance.now() - startTime);
    onProgress?.('Done!', 1.0);

    return {
      text: ret.data.text || '',
      engine: 'tesseract',
      confidence: ret.data.confidence,
      durationMs,
    };
  } catch (err: any) {
    console.error('Tesseract offline OCR error:', err);
    throw new Error(`Offline OCR error: ${err.message || 'Could not recognize text'}`);
  }
}

/**
 * AI Text Cleanup endpoint call with client-side NLP rule fallback
 */
export async function runAICleanup(text: string, languageCode = 'eng'): Promise<string> {
  if (!text || !text.trim()) return text;

  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === languageCode);
  const cloudName = langObj ? langObj.cloudName : 'English';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch('/api/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: cloudName,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && typeof data.text === 'string' && data.text.trim()) {
          return data.text.trim();
        }
      }
    }
  } catch (err) {
    console.warn('Network cleanup request failed or timed out, applying rule-based cleaner:', err);
  }

  // Fallback to client-side deterministic rule cleaner
  return cleanTextRuleBased(text);
}
