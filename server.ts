import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
process.env.DISABLE_HMR = 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High body limit to support high-resolution scanned images
app.use(express.json({ limit: '30mb' }));

// Server-side Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Cloud Vision OCR endpoint
app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', language, mode = 'document' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    // Clean base64 data string if it includes data:image/... prefix
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const languageHint = language && language !== 'auto' ? ` The expected primary language is ${language}.` : '';
    const modeHint = mode === 'handwriting'
      ? 'Focus especially on handwritten notes, cursive lettering, doctor scripts, diary entries, student notes, and loose sketches.'
      : 'Extract all visible text, whether printed, typed, or handwritten.';

    const promptText = `You are an expert Vision OCR and handwriting transcription engine.
Transcribe and extract ALL text visible in this image verbatim.
${modeHint}${languageHint}

Instructions:
1. Handwriting & Cursive: Decipher all handwritten words, cursive, print, numbers, and symbols even if tilted, faint, or on lined/ruled paper.
2. Printed & Forms: Transcribe printed text, signs, labels, receipts, and book pages accurately.
3. Formatting: Preserve line breaks, lists, headers, and paragraph separation.
4. Completeness: Do not stop early or truncate sentences.
5. Output format: Return ONLY the raw transcribed text. Do NOT wrap in markdown backticks or code blocks. Do NOT include phrases like "Here is the text" or "Transcription:".`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });
    } catch (genErr: any) {
      console.warn('Gemini 3.1 flash-lite call failed, attempting fallback with gemini-3.8-flash:', genErr?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });
    }

    let extractedText = response.text || '';
    // Strip accidental markdown code blocks if returned
    if (extractedText.startsWith('```') && extractedText.endsWith('```')) {
      extractedText = extractedText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
    }
    return res.json({ text: extractedText.trim(), engine: 'cloud' });
  } catch (error: any) {
    console.error('Server OCR error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process image with Cloud Vision AI',
    });
  }
});

function cleanTextRuleBased(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/(\b[a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,}\b)/g, '$1$2');
  const paragraphs = text.split(/\n{2,}/);
  const cleaned = paragraphs.map((para) => {
    const lines = para.split('\n');
    let merged = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (!merged) {
        merged = line;
        continue;
      }
      const isListItem = /^[•\-\*▪▫►\d+\.\)]\s+/.test(line);
      const prevEndsWithPunc = /[.?!:;]$/.test(merged);
      if (isListItem || prevEndsWithPunc) {
        merged += '\n' + line;
      } else {
        merged += ' ' + line;
      }
    }
    return merged;
  });
  text = cleaned.join('\n\n');
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1');
  return text.trim();
}

// AI Text Cleanup endpoint (fixes spelling, line wraps, punctuation)
app.post('/api/cleanup', async (req, res) => {
  const { text, language } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text in request body' });
  }

  try {
    const languageHint = language && language !== 'auto' ? ` Language: ${language}.` : '';

    const prompt = `You are an expert document editor and OCR post-processing assistant.
Below is text extracted from a scanned document or photograph. It may contain common optical character recognition errors, erratic line breaks from wrapped text, hyphenation artifacts, or misspelled words.

${languageHint}

Your task:
1. Merge broken sentences where a line break arbitrarily cut a sentence mid-phrase, while preserving genuine paragraph breaks and bullet points.
2. Correct obvious OCR character misrecognitions (e.g. "rn" -> "m", "vv" -> "w", "l" -> "1" / "I" where context dictates).
3. Correct spelling and grammar while strictly keeping all original factual content, names, numbers, dates, and intent.
4. Clean up inconsistent spacing and trailing hyphens.
5. Return ONLY the polished cleaned text. Do NOT wrap in backticks. Do NOT include notes or introductory pleasantries.

Text to clean:
---
${text}
---`;

    // 8-second timeout for Gemini call to avoid Gateway Timeouts
    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI cleanup timed out')), 8000)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);
    const cleanedText = response.text ? response.text.trim() : cleanTextRuleBased(text);
    return res.json({ text: cleanedText, method: 'gemini' });
  } catch (error: any) {
    console.warn('AI cleanup fallback to rule-based cleaner due to:', error?.message || error);
    const cleaned = cleanTextRuleBased(text);
    return res.json({ text: cleaned, method: 'rules' });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ScanText API' });
});

// Vite middleware or production static files
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ScanText server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
