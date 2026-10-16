export interface ImageAdjustments {
  rotation: number; // 0, 90, 180, 270
  brightness: number; // -100 to 100 (0 default)
  contrast: number; // -100 to 100 (0 default)
  filter: 'none' | 'bw' | 'high_contrast' | 'sharpen';
  crop: {
    x: number; // 0 to 1
    y: number; // 0 to 1
    width: number; // 0 to 1
    height: number; // 0 to 1
  };
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  rotation: 0,
  brightness: 0,
  contrast: 0,
  filter: 'none',
  crop: { x: 0, y: 0, width: 1, height: 1 },
};

/**
 * Loads image object from data url
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Renders the adjusted & cropped image to a high quality canvas
 */
export async function renderProcessedImage(
  imageSrc: string,
  adjustments: ImageAdjustments,
  maxDimension = 2000
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageSrc);

  // Step 1: Create a canvas for full rotation & filtering
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Rotation determines canvas dimensions
  const isRotated90or270 = adjustments.rotation % 180 !== 0;
  const rotatedW = isRotated90or270 ? origH : origW;
  const rotatedH = isRotated90or270 ? origW : origH;

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = rotatedW;
  fullCanvas.height = rotatedH;
  const ctx = fullCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  // Fill with clean white for documents
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rotatedW, rotatedH);

  // Apply rotation
  ctx.save();
  ctx.translate(rotatedW / 2, rotatedH / 2);
  ctx.rotate((adjustments.rotation * Math.PI) / 180);
  ctx.drawImage(img, -origW / 2, -origH / 2);
  ctx.restore();

  // Apply Brightness & Contrast & Filters on pixel data
  const { brightness, contrast, filter } = adjustments;
  if (brightness !== 0 || contrast !== 0 || filter !== 'none') {
    const imgData = ctx.getImageData(0, 0, rotatedW, rotatedH);
    const d = imgData.data;

    // Contrast factor: [-100..100] -> [0..3]
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightOffset = brightness * 1.2;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      // Brightness & Contrast
      r = contrastFactor * (r - 128) + 128 + brightOffset;
      g = contrastFactor * (g - 128) + 128 + brightOffset;
      b = contrastFactor * (b - 128) + 128 + brightOffset;

      // Filter modes
      if (filter === 'bw' || filter === 'high_contrast') {
        // Luminance grayscale
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        if (filter === 'bw') {
          // Grayscale with clean contrast enhancement that preserves faint ink gradients & pencil
          const val = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
          r = g = b = val;
        } else {
          // High contrast text enhance
          const val = Math.min(255, Math.max(0, (gray - 128) * 1.8 + 128));
          r = g = b = val;
        }
      }

      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Step 2: Apply Crop
  const { crop } = adjustments;
  const cropX = Math.max(0, Math.min(rotatedW, crop.x * rotatedW));
  const cropY = Math.max(0, Math.min(rotatedH, crop.y * rotatedH));
  const cropW = Math.max(10, Math.min(rotatedW - cropX, crop.width * rotatedW));
  const cropH = Math.max(10, Math.min(rotatedH - cropY, crop.height * rotatedH));

  // Determine final scaled dimensions to fit within maxDimension
  let outW = cropW;
  let outH = cropH;
  if (outW > maxDimension || outH > maxDimension) {
    if (outW > outH) {
      outH = Math.round((outH * maxDimension) / outW);
      outW = maxDimension;
    } else {
      outW = Math.round((outW * maxDimension) / outH);
      outH = maxDimension;
    }
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = outW;
  finalCanvas.height = outH;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Could not get final context');

  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.fillStyle = '#ffffff';
  finalCtx.fillRect(0, 0, outW, outH);

  finalCtx.drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  return finalCanvas;
}

/**
 * Creates a lightweight JPEG data URL for display and cloud upload
 */
export async function getOptimizedBase64(
  imageSrc: string,
  adjustments: ImageAdjustments,
  quality = 0.85
): Promise<string> {
  const canvas = await renderProcessedImage(imageSrc, adjustments, 1400);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Creates a tiny thumbnail for history cards (max 240px)
 */
export async function createThumbnail(
  imageSrc: string,
  adjustments: ImageAdjustments
): Promise<string> {
  try {
    const canvas = await renderProcessedImage(imageSrc, adjustments, 240);
    return canvas.toDataURL('image/jpeg', 0.65);
  } catch (e) {
    console.warn('Thumbnail generation failed:', e);
    return '';
  }
}
