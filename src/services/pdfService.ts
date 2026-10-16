import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using CDN matching installed version or fallback
try {
  // @ts-ignore
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // @ts-ignore
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('PDF.js worker initialization:', e);
}

export interface PDFPageRenderResult {
  dataUrl: string;
  totalPages: number;
  currentPage: number;
  width: number;
  height: number;
}

export async function renderPdfToImage(
  fileOrBuffer: File | ArrayBuffer,
  pageNumber = 1
): Promise<PDFPageRenderResult> {
  const data = fileOrBuffer instanceof File ? await fileOrBuffer.arrayBuffer() : fileOrBuffer;
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  const validPageNum = Math.max(1, Math.min(pageNumber, totalPages));
  const page = await pdfDoc.getPage(validPageNum);

  // High DPI scale for high OCR recognition accuracy
  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas 2D context for PDF rendering');
  }

  // White background for clear contrast
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext: any = {
    canvasContext: ctx,
    viewport: viewport,
    canvas: canvas,
  };

  await page.render(renderContext).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  return {
    dataUrl,
    totalPages,
    currentPage: validPageNum,
    width: viewport.width,
    height: viewport.height,
  };
}
