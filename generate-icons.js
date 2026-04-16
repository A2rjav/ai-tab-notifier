/**
 * Resize the generated icon to 16x16, 48x48, and 128x128 sizes.
 * Uses Canvas API via a simple approach.
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = (() => {
  try {
    return require('canvas');
  } catch {
    return { createCanvas: null, loadImage: null };
  }
})();

// If canvas module isn't available, create simple colored PNG icons
function createMinimalPNG(size) {
  // Create a minimal valid PNG with a bell-like icon
  // Using a simple approach: create PNG header + IHDR + IDAT + IEND
  
  const { deflateSync } = require('zlib');
  
  const width = size;
  const height = size;
  
  // Create pixel data (RGBA)
  const pixels = Buffer.alloc(width * height * 4);
  
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.4;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Rounded square background
      const margin = width * 0.1;
      const cornerR = width * 0.2;
      const inSquare = x >= margin && x < width - margin && y >= margin && y < height - margin;
      
      // Check rounded corners
      let inRoundedRect = false;
      const left = margin;
      const right = width - margin;
      const top = margin;
      const bottom = height - margin;
      
      if (x >= left + cornerR && x <= right - cornerR && y >= top && y <= bottom) {
        inRoundedRect = true;
      } else if (x >= left && x <= right && y >= top + cornerR && y <= bottom - cornerR) {
        inRoundedRect = true;
      } else {
        // Check corners
        const corners = [
          [left + cornerR, top + cornerR],
          [right - cornerR, top + cornerR],
          [left + cornerR, bottom - cornerR],
          [right - cornerR, bottom - cornerR],
        ];
        for (const [cx2, cy2] of corners) {
          const cd = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
          if (cd <= cornerR) {
            inRoundedRect = true;
            break;
          }
        }
      }
      
      if (inRoundedRect) {
        // Gradient background: purple to cyan
        const t = (x - left) / (right - left);
        const r1 = 124, g1 = 58, b1 = 237;  // #7C3AED
        const r2 = 6, g2 = 182, b2 = 212;    // #06B6D4
        
        let bgR = Math.round(r1 + (r2 - r1) * t);
        let bgG = Math.round(g1 + (g2 - g1) * t);
        let bgB = Math.round(b1 + (b2 - b1) * t);
        
        // Bell shape (simple)
        const bellCx = cx;
        const bellCy = cy - height * 0.05;
        const bellR = width * 0.2;
        const bellDist = Math.sqrt((x - bellCx) ** 2 + (y - bellCy) ** 2);
        
        // Bell body (upper circle)
        const inBellBody = bellDist < bellR && y < cy + height * 0.1;
        // Bell base (wider arc at bottom)
        const bellBaseY = cy + height * 0.1;
        const bellBaseR = width * 0.28;
        const inBellBase = Math.abs(y - bellBaseY) < height * 0.06 && Math.abs(x - cx) < bellBaseR * (1 - Math.abs(y - bellBaseY) / (height * 0.12));
        // Bell clapper (small circle at bottom)
        const clapperY = cy + height * 0.2;
        const clapperR = width * 0.05;
        const inClapper = Math.sqrt((x - cx) ** 2 + (y - clapperY) ** 2) < clapperR;
        // Bell handle (small arc at top)
        const handleY = cy - height * 0.28;
        const handleR = width * 0.06;
        const inHandle = Math.sqrt((x - cx) ** 2 + (y - handleY) ** 2) < handleR;
        
        if (inBellBody || inBellBase || inClapper || inHandle) {
          // White bell
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 255;
        } else {
          // Sparkle dots
          const sparkles = [
            [cx + width * 0.25, cy - height * 0.25, width * 0.03],
            [cx - width * 0.28, cy - height * 0.15, width * 0.02],
            [cx + width * 0.3, cy + height * 0.1, width * 0.025],
          ];
          
          let inSparkle = false;
          for (const [sx, sy, sr] of sparkles) {
            if (Math.sqrt((x - sx) ** 2 + (y - sy) ** 2) < sr) {
              inSparkle = true;
              break;
            }
          }
          
          if (inSparkle) {
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 200;
            pixels[idx + 3] = 255;
          } else {
            pixels[idx] = bgR;
            pixels[idx + 1] = bgG;
            pixels[idx + 2] = bgB;
            pixels[idx + 3] = 255;
          }
        }
      } else {
        // Transparent
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }
  
  // Create PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  // Prepare raw image data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  
  const compressed = deflateSync(rawData);
  
  function createChunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    
    return Buffer.concat([length, typeBuffer, data, crc]);
  }
  
  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate all sizes
const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createMinimalPNG(size);
  const filePath = path.join(__dirname, 'icons', `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated icon: ${filePath} (${png.length} bytes)`);
}

console.log('All icons generated!');
