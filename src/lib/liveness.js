// Prova de vida simples baseada nos 68 pontos faciais: girar o rosto para o lado sorteado.

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function ear(p, o) {
  return (d(p[o + 1], p[o + 5]) + d(p[o + 2], p[o + 4])) / (2 * d(p[o], p[o + 3]));
}
// export const eyeAspect = (p) => (ear(p, 36) + ear(p, 42)) / 2;

/** Índice de giro horizontal: ~0 de frente; negativo = usuário girou para a direita dele. */
export function yawIndex(p) {
  const mid = (p[0].x + p[16].x) / 2;
  return (p[30].x - mid) / d(p[0], p[16]);
}

export function createChallenge() {
  const types = ['turn-right', 'turn-left'];
  const type = types[Math.floor(Math.random() * types.length)];
  const text = {
    'turn-right': 'Vire o rosto para a sua direita',
    'turn-left': 'Vire o rosto para a sua esquerda',
  }[type];
  return { type, text, reached: false, done: false, progress: 0 };
}

export function updateChallenge(ch, points) {
  if (ch.done) return ch;
  const y = yawIndex(points);
  const hit = ch.type === 'turn-right' ? y < -0.16 : y > 0.16;
  if (hit) ch.reached = true;
  if (ch.reached && Math.abs(y) < 0.08) ch.done = true;
  ch.progress = ch.done ? 1 : ch.reached ? 0.7 : 0.2;
  return ch;
}
