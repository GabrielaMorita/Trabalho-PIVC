// Operações clássicas de processamento de imagem, implementadas à mão sobre ImageData
// para ilustrar as fases de pré-processamento e segmentação da APS.

export function toGray(img) {
  const { data, width, height } = img;
  const g = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

export function histogram(gray) {
  const h = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) h[gray[i]]++;
  return h;
}

export function rgbHistograms(img) {
  const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { r[d[i]]++; g[d[i + 1]]++; b[d[i + 2]]++; }
  return { r, g, b };
}

export function meanOf(gray) {
  let s = 0;
  for (let i = 0; i < gray.length; i++) s += gray[i];
  return s / gray.length;
}

/** Equalização de histograma (CDF). */
export function equalize(gray) {
  const h = histogram(gray);
  const n = gray.length;
  const cdf = new Float32Array(256);
  let acc = 0, cdfMin = 0;
  for (let i = 0; i < 256; i++) {
    acc += h[i];
    cdf[i] = acc;
    if (!cdfMin && acc) cdfMin = acc;
  }
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(((cdf[i] - cdfMin) / Math.max(1, n - cdfMin)) * 255);
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) out[i] = lut[gray[i]];
  return out;
}

/** Filtro gaussiano 3x3 (kernel 1-2-1). */
export function gaussian3(gray, w, h) {
  const k = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, ki = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          s += gray[yy * w + xx] * k[ki++];
        }
      }
      out[y * w + x] = s / 16;
    }
  }
  return out;
}

/** Gradiente de Sobel (magnitude normalizada). */
export function sobel(gray, w, h) {
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      out[i] = Math.min(255, Math.hypot(gx, gy) / 2);
    }
  }
  return out;
}

/** Máscara de pele no espaço YCbCr (limiares clássicos de Chai & Ngan). */
export function skinMask(img) {
  const { data, width, height } = img;
  const m = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    m[p] = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 ? 255 : 0;
  }
  return m;
}

/** Variância do Laplaciano: medida de nitidez (foco). */
export function laplacianVariance(gray, w, h) {
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += v; sumSq += v * v; n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function grayToImageData(ctx, gray, w, h) {
  const out = ctx.createImageData(w, h);
  for (let i = 0, p = 0; p < gray.length; i += 4, p++) {
    out.data[i] = out.data[i + 1] = out.data[i + 2] = gray[p];
    out.data[i + 3] = 255;
  }
  return out;
}

export function drawGray(canvas, gray, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(grayToImageData(ctx, gray, w, h), 0, 0);
}

export function drawHistogram(canvas, bins, color = '#17231c', bg = 'transparent') {
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth * 2 || 512);
  const h = (canvas.height = canvas.clientHeight * 2 || 160);
  ctx.clearRect(0, 0, w, h);
  if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  let max = 1;
  for (let i = 0; i < 256; i++) if (bins[i] > max) max = bins[i];
  ctx.fillStyle = color;
  const bw = w / 256;
  for (let i = 0; i < 256; i++) {
    const bh = (bins[i] / max) * (h - 4);
    ctx.fillRect(i * bw, h - bh, Math.ceil(bw), bh);
  }
}

/** Captura um quadro de vídeo/imagem num canvas com largura fixa. */
export function grabFrame(source, canvas, targetW) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return null;
  const w = targetW, h = Math.round((sh / sw) * targetW);
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  return { ctx, w, h, srcW: sw, srcH: sh };
}

/** Recorta um rosto (com margem) e devolve JPEG pequeno em data URL. */
export function cropToDataUrl(source, box, size = 96, margin = 0.35, quality = 0.7) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const side = Math.max(box.width, box.height) * (1 + margin);
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  c.getContext('2d').drawImage(source, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', quality);
}
