/**
 * Rule-based text cleaner for OCR output.
 * Handles hyphenated line breaks, broken sentences, multi-spaces, and punctuation artifacts.
 */
export function cleanTextRuleBased(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Remove carriage returns
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Fix hyphenated words broken across lines (e.g. "connec-\ntion" -> "connection")
  text = text.replace(/(\b[a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,}\b)/g, '$1$2');

  // 3. Process paragraphs and line breaks
  const paragraphs = text.split(/\n{2,}/);
  const cleanedParagraphs = paragraphs.map((para) => {
    const lines = para.split('\n');
    let merged = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (!merged) {
        merged = line;
        continue;
      }

      // Check if line is a list item or heading
      const isListItem = /^[•\-\*▪▫►\d+\.\)]\s+/.test(line);
      const prevEndsWithPunctuation = /[.?!:;]$/.test(merged);

      if (isListItem || prevEndsWithPunctuation) {
        merged += '\n' + line;
      } else {
        // Merge broken sentence line break with a single space
        merged += ' ' + line;
      }
    }

    return merged;
  });

  text = cleanedParagraphs.join('\n\n');

  // 4. Normalize multiple consecutive spaces (except newlines)
  text = text.replace(/[ \t]{2,}/g, ' ');

  // 5. Clean spaces before punctuation
  text = text.replace(/\s+([.,!?;:])/g, '$1');

  // 6. Clean common OCR quotation artifacts
  text = text.replace(/''/g, '"').replace(/``/g, '"');

  return text.trim();
}
