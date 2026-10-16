import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create crisp SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="scan" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.2" />
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.2" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="104" fill="url(#bg)" />
  
  <!-- Document Sheet -->
  <rect x="136" y="106" width="240" height="300" rx="20" fill="#ffffff" />
  <rect x="176" y="160" width="160" height="16" rx="8" fill="#cbd5e1" />
  <rect x="176" y="196" width="160" height="16" rx="8" fill="#cbd5e1" />
  <rect x="176" y="232" width="120" height="16" rx="8" fill="#cbd5e1" />
  <rect x="176" y="268" width="140" height="16" rx="8" fill="#cbd5e1" />
  
  <!-- Scan Viewfinder Corners -->
  <path d="M 106 156 L 106 106 L 156 106" fill="none" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 356 106 L 406 106 L 406 156" fill="none" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 106 356 L 106 406 L 156 406" fill="none" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 356 406 L 406 406 L 406 356" fill="none" stroke="#60a5fa" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
  
  <!-- Active Laser Line -->
  <line x1="96" y1="256" x2="416" y2="256" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" />
  <!-- Glow under laser -->
  <rect x="116" y="246" width="280" height="20" fill="url(#scan)" rx="10" />
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent);

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePngBuffer(width, height, isMaskable = false) {
  // Generate RGBA buffer
  // Blue theme #2563eb (37, 99, 235), with document and laser graphic
  const rowSize = 1 + width * 4; // 1 filter byte (0) + width * 4
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = isMaskable ? width * 0.48 : width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base background: vibrant blue
      let r = 37;
      let g = 99;
      let b = 235;
      let a = 255;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isMaskable) {
        // Rounded squircle mask
        const maxDist = Math.max(Math.abs(dx), Math.abs(dy));
        if (maxDist > cx * 0.95 && dist > cx * 0.95) {
          a = 0;
        }
      }

      if (a > 0) {
        // Document rectangle
        const docW = width * 0.45;
        const docH = height * 0.58;
        if (Math.abs(dx) < docW / 2 && Math.abs(dy) < docH / 2) {
          r = 255;
          g = 255;
          b = 255;

          // Text lines
          const lineW = docW * 0.65;
          const lineY1 = -docH * 0.25;
          const lineY2 = -docH * 0.1;
          const lineY3 = docH * 0.05;
          const lineY4 = docH * 0.2;
          const hLine = height * 0.025;

          if (
            (Math.abs(dy - lineY1) < hLine && Math.abs(dx) < lineW / 2) ||
            (Math.abs(dy - lineY2) < hLine && Math.abs(dx) < lineW / 2) ||
            (Math.abs(dy - lineY3) < hLine && Math.abs(dx) < lineW * 0.35) ||
            (Math.abs(dy - lineY4) < hLine && Math.abs(dx) < lineW * 0.45)
          ) {
            r = 203;
            g = 213;
            b = 225; // slate-300
          }
        }

        // Viewfinder corners
        const cornerSize = width * 0.65;
        const cornerThick = width * 0.04;
        const inCorner =
          (Math.abs(dx) > cornerSize / 2 - cornerThick && Math.abs(dx) < cornerSize / 2 && Math.abs(dy) < cornerSize / 2 && Math.abs(dy) > cornerSize * 0.3) ||
          (Math.abs(dy) > cornerSize / 2 - cornerThick && Math.abs(dy) < cornerSize / 2 && Math.abs(dx) < cornerSize / 2 && Math.abs(dx) > cornerSize * 0.3);
        if (inCorner) {
          r = 96;
          g = 165;
          b = 250; // sky-400
        }

        // Horizontal laser beam in center
        if (Math.abs(dy) < height * 0.015 && Math.abs(dx) < width * 0.4) {
          r = 56;
          g = 189;
          b = 248; // cyan beam
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', deflated);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePngBuffer(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePngBuffer(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePngBuffer(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePngBuffer(180, 180, false));

console.log('Generated all PWA icons in /public successfully!');
