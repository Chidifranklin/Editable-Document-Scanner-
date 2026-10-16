export type EntityType = 'email' | 'phone' | 'date' | 'currency' | 'url';

export interface DetectedEntity {
  id: string;
  type: EntityType;
  value: string;
  raw: string;
  startIndex: number;
  endIndex: number;
  label: string;
  numericValue?: number; // for currency
  currencySymbol?: string;
}

export interface EntitySummary {
  emails: DetectedEntity[];
  phones: DetectedEntity[];
  dates: DetectedEntity[];
  currencies: DetectedEntity[];
  urls: DetectedEntity[];
  totalCurrencyAmount?: number;
  currencySymbol?: string;
}

// Regex patterns
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// International & domestic phone numbers
const PHONE_REGEX = /(?:(?:\+?([1-9]\d{0,2})[\s.-]*)?(?:\(?(\d{2,4})\)?[\s.-]*)?(\d{3,4})[\s.-]*(\d{3,4})(?:[\s.-]*\d{1,4})?)/g;

// Currencies: $, €, £, ¥, ₦, ₹, USD, EUR, GBP followed or preceded by numbers
const CURRENCY_REGEX = /(?:([$€£¥₦₹]|USD|EUR|GBP|CAD|AUD)\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)|(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*([$€£¥₦₹]|USD|EUR|GBP))/gi;

// Dates: ISO, US, EU, and written Month DD, YYYY
const DATE_REGEX = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(?:\d{1,2})(?:(?:st|nd|rd|th)?)[,\s]+(?:\d{2,4})|\d{1,2}(?:st|nd|rd|th)?[,\s]+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s]+(?:\d{2,4})?)\b/gi;

// URLs
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`[\]]+/gi;

export function detectEntities(text: string): { all: DetectedEntity[]; summary: EntitySummary } {
  if (!text || typeof text !== 'string') {
    return {
      all: [],
      summary: { emails: [], phones: [], dates: [], currencies: [], urls: [] },
    };
  }

  const entities: DetectedEntity[] = [];

  // 1. Detect Emails
  let match: RegExpExecArray | null;
  while ((match = EMAIL_REGEX.exec(text)) !== null) {
    entities.push({
      id: `email_${match.index}_${match[0]}`,
      type: 'email',
      value: match[0],
      raw: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      label: 'Email',
    });
  }

  // 2. Detect URLs
  while ((match = URL_REGEX.exec(text)) !== null) {
    const rawUrl = match[0];
    const cleanUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    entities.push({
      id: `url_${match.index}_${rawUrl}`,
      type: 'url',
      value: cleanUrl,
      raw: rawUrl,
      startIndex: match.index,
      endIndex: match.index + rawUrl.length,
      label: 'Website Link',
    });
  }

  // 3. Detect Currencies
  while ((match = CURRENCY_REGEX.exec(text)) !== null) {
    const symbol = match[1] || match[4] || '$';
    const amountStr = match[2] || match[3] || '0';
    const num = parseFloat(amountStr.replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      entities.push({
        id: `currency_${match.index}_${match[0]}`,
        type: 'currency',
        value: `${symbol}${num.toFixed(2)}`,
        raw: match[0].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        numericValue: num,
        currencySymbol: symbol,
        label: 'Currency',
      });
    }
  }

  // 4. Detect Dates
  while ((match = DATE_REGEX.exec(text)) !== null) {
    const rawDate = match[0].trim();
    // Validate length to avoid false positives on simple numbers
    if (rawDate.length >= 6) {
      entities.push({
        id: `date_${match.index}_${rawDate}`,
        type: 'date',
        value: rawDate,
        raw: rawDate,
        startIndex: match.index,
        endIndex: match.index + rawDate.length,
        label: 'Date',
      });
    }
  }

  // 5. Detect Phone Numbers (avoid overlapping with dates or simple numbers)
  while ((match = PHONE_REGEX.exec(text)) !== null) {
    const rawPhone = match[0].trim();
    const digitsOnly = rawPhone.replace(/\D/g, '');
    // Minimum 7 digits, maximum 15 digits
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      // Ensure it doesn't overlap with dates or currencies
      const overlaps = entities.some(
        (e) =>
          (match!.index >= e.startIndex && match!.index < e.endIndex) ||
          (match!.index + rawPhone.length > e.startIndex &&
            match!.index + rawPhone.length <= e.endIndex)
      );

      if (!overlaps) {
        entities.push({
          id: `phone_${match.index}_${rawPhone}`,
          type: 'phone',
          value: rawPhone,
          raw: rawPhone,
          startIndex: match.index,
          endIndex: match.index + rawPhone.length,
          label: 'Phone Number',
        });
      }
    }
  }

  // Sort entities by appearance
  entities.sort((a, b) => a.startIndex - b.startIndex);

  // Filter overlapping entities
  const nonOverlapping: DetectedEntity[] = [];
  let lastEnd = -1;
  for (const item of entities) {
    if (item.startIndex >= lastEnd) {
      nonOverlapping.push(item);
      lastEnd = item.endIndex;
    }
  }

  const emails = nonOverlapping.filter((e) => e.type === 'email');
  const phones = nonOverlapping.filter((e) => e.type === 'phone');
  const dates = nonOverlapping.filter((e) => e.type === 'date');
  const currencies = nonOverlapping.filter((e) => e.type === 'currency');
  const urls = nonOverlapping.filter((e) => e.type === 'url');

  let totalCurrencyAmount = 0;
  let detectedSymbol = '$';
  if (currencies.length > 0) {
    currencies.forEach((c) => {
      if (c.numericValue) totalCurrencyAmount += c.numericValue;
      if (c.currencySymbol) detectedSymbol = c.currencySymbol;
    });
  }

  return {
    all: nonOverlapping,
    summary: {
      emails,
      phones,
      dates,
      currencies,
      urls,
      totalCurrencyAmount: Math.round(totalCurrencyAmount * 100) / 100,
      currencySymbol: detectedSymbol,
    },
  };
}

/**
 * Creates Google Calendar URL for detected date
 */
export function getGoogleCalendarUrl(dateStr: string, title = 'Event from ScanText'): string {
  try {
    const parsedDate = new Date(dateStr);
    const valid = !isNaN(parsedDate.getTime());
    const startDate = valid ? parsedDate : new Date();
    const formatted = startDate.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, 15) + 'Z';

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title
    )}&dates=${formatted}/${formatted}&details=${encodeURIComponent(
      `Extracted date: ${dateStr} via ScanText`
    )}`;
  } catch (e) {
    return 'https://calendar.google.com';
  }
}
