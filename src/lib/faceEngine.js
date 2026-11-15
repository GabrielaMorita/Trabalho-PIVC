// Carrega o face-api sob demanda e expõe detecção, landmarks e descritores.
let apiPromise = null;
let api = null;

export function loadEngine() {
  if (!apiPromise) {
    apiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api/dist/face-api.esm.js');
      try { await faceapi.tf.setBackend('webgl'); } catch { /* cai para cpu */ }
      await faceapi.tf.ready();
      const url = `${import.meta.env.BASE_URL}models`;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(url),
        faceapi.nets.faceLandmark68Net.loadFromUri(url),
        faceapi.nets.faceRecognitionNet.loadFromUri(url),
      ]);
      api = faceapi;
      return { backend: faceapi.tf.getBackend() };
    })().catch((e) => {
      apiPromise = null;
      throw e;
    });
  }
  return apiPromise;
}

export const engineReady = () => !!api;

/** Detecta rostos. Retorna [{ box, score, points, descriptor? }] */
export async function detectFaces(input, { inputSize = 320, descriptors = false, scoreThreshold = 0.5 } = {}) {
  if (!api) throw new Error('Modelos ainda não carregados');
  const opts = new api.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
  let task = api.detectAllFaces(input, opts).withFaceLandmarks();
  if (descriptors) task = task.withFaceDescriptors();
  const res = await task;
  return res.map((r) => ({
    box: { x: r.detection.box.x, y: r.detection.box.y, width: r.detection.box.width, height: r.detection.box.height },
    score: r.detection.score,
    points: r.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    descriptor: r.descriptor ? Array.from(r.descriptor) : null,
  }));
}

export function distance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/** Identificação 1:N: menor distância entre o descritor e todas as amostras de cada usuário. */
export function identify(descriptor, users) {
  const ranking = users
    .map((u) => ({
      user: u,
      distance: Math.min(...u.descriptors.map((d) => distance(descriptor, d))),
    }))
    .sort((a, b) => a.distance - b.distance);
  return ranking;
}

export const round4 = (arr) => arr.map((v) => Math.round(v * 10000) / 10000);
