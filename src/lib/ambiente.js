// Dados ambientais (Nível 2: monitoramento; Nível 3: inteligência e riscos).
// Todos ficam na coleção "ambiente" do Firestore; o campo `tipo` diz o que cada documento é.
export const TIPOS = ['alerta', 'ocorrencia', 'agua', 'indicador', 'contaminante', 'risco', 'relatorio'];

const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
const str = (v, max = 600) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[;|]/)).map((x) => str(x, 120)).filter(Boolean);
const oneOf = (v, opts, def) => { const p = plain(v); return opts.includes(p) ? p : def; };
const isUrl = (u) => /^https?:\/\/\S+$/i.test(u || '');
function when(v) {
  if (typeof v === 'number' && v > 0) return v;
  const s = String(v ?? '');
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1], 12).getTime();
  return Date.parse(s) || Date.now();
}

const SEV = ['baixa', 'media', 'alta', 'critica'];

/** Converte itens brutos (JSON) em documentos válidos. Retorna { ok, skipped }. */
export function mapAmbiente(items) {
  const ok = [], skipped = [];
  const now = Date.now();
  items.forEach((r, i) => {
    const line = i + 1;
    if (!r || typeof r !== 'object') return skipped.push({ line, reason: 'item inválido' });
    const tipo = plain(r.tipo);
    if (!TIPOS.includes(tipo)) return skipped.push({ line, reason: `tipo desconhecido (${r.tipo ?? 'vazio'})` });
    let d, key;
    if (tipo === 'alerta') {
      if (str(r.titulo).length < 4) return skipped.push({ line, reason: 'alerta sem título' });
      d = { titulo: str(r.titulo, 160), descricao: str(r.descricao), severidade: oneOf(r.severidade, SEV, 'media'), regiao: str(r.regiao, 120), data: when(r.data) };
      key = d.titulo;
    } else if (tipo === 'ocorrencia') {
      const lat = num(r.lat), lon = num(r.lon);
      const categoria = oneOf(r.categoria, ['queimada', 'desmatamento', 'poluicao'], '');
      if (!categoria) return skipped.push({ line, reason: 'ocorrência sem categoria (queimada, desmatamento ou poluição)' });
      if (lat === null || lon === null || lat < -35 || lat > 6 || lon < -75 || lon > -33) return skipped.push({ line, reason: 'coordenadas fora do Brasil' });
      d = { categoria, lat, lon, regiao: str(r.regiao, 120), data: when(r.data), intensidade: num(r.intensidade) };
      key = `${categoria}|${lat}|${lon}|${d.data}`;
    } else if (tipo === 'agua') {
      if (str(r.corpo).length < 2) return skipped.push({ line, reason: 'medição sem corpo d’água' });
      d = { corpo: str(r.corpo, 120), local: str(r.local, 120), classe: oneOf(r.classe, ['boa', 'regular', 'ruim'], 'regular'), ph: num(r.ph), oxigenio: num(r.oxigenio), turbidez: num(r.turbidez), data: when(r.data) };
      key = `${d.corpo}|${d.local}`;
    } else if (tipo === 'indicador') {
      const hist = (Array.isArray(r.historico) ? r.historico : []).map((p) => ({ periodo: str(p?.periodo, 20), valor: num(p?.valor) })).filter((p) => p.periodo && p.valor !== null);
      if (str(r.nome).length < 2) return skipped.push({ line, reason: 'indicador sem nome' });
      if (hist.length < 2) return skipped.push({ line, reason: 'indicador precisa de ao menos 2 pontos no histórico' });
      d = { nome: str(r.nome, 120), unidade: str(r.unidade, 30), historico: hist };
      key = d.nome;
    } else if (tipo === 'contaminante') {
      if (str(r.nome).length < 2) return skipped.push({ line, reason: 'contaminante sem nome' });
      d = { nome: str(r.nome, 120), classe: str(r.classe, 80), ocorreEm: list(r.ocorreEm), metodosDeteccao: list(r.metodosDeteccao), impactos: str(r.impactos, 800), gravidade: oneOf(r.gravidade, SEV, 'media') };
      key = d.nome;
    } else if (tipo === 'risco') {
      const p = Math.round(num(r.probabilidade) ?? 0), s = Math.round(num(r.severidade) ?? 0);
      if (str(r.cenario).length < 4) return skipped.push({ line, reason: 'risco sem cenário' });
      if (p < 1 || p > 5 || s < 1 || s > 5) return skipped.push({ line, reason: 'probabilidade e severidade devem estar entre 1 e 5' });
      d = { cenario: str(r.cenario, 200), local: str(r.local, 120), probabilidade: p, severidade: s, medidas: str(r.medidas, 600) };
      key = d.cenario;
    } else {
      if (str(r.titulo).length < 4) return skipped.push({ line, reason: 'relatório sem título' });
      d = { titulo: str(r.titulo, 200), resumo: str(r.resumo, 800), autor: str(r.autor, 120), data: when(r.data), link: isUrl(str(r.link)) ? str(r.link, 500) : '', tags: list(r.tags) };
      key = d.titulo;
    }
    ok.push({ ...d, tipo, id: str(r.id, 80).replace(/[\/\s]/g, '_') || `${tipo.slice(0, 3)}${hash(`${tipo}|${key}`)}`, demo: r.demo === true, createdAt: now });
  });
  return { ok, skipped };
}

/** Qualidade do ar pela escala AQI dos EUA (usada pelo serviço Open-Meteo). */
export function aqiCategory(aqi) {
  if (aqi == null) return { label: 'Sem dado', tone: 'muted' };
  if (aqi <= 50) return { label: 'Boa', tone: 'ok' };
  if (aqi <= 100) return { label: 'Moderada', tone: 'warn' };
  if (aqi <= 150) return { label: 'Ruim para grupos sensíveis', tone: 'warn' };
  if (aqi <= 200) return { label: 'Ruim', tone: 'no' };
  if (aqi <= 300) return { label: 'Muito ruim', tone: 'no' };
  return { label: 'Perigosa', tone: 'no' };
}

export const riskScore = (r) => r.probabilidade * r.severidade;
export function riskLevel(score) {
  if (score >= 15) return { label: 'Crítico', tone: 'no' };
  if (score >= 10) return { label: 'Alto', tone: 'no' };
  if (score >= 5) return { label: 'Médio', tone: 'warn' };
  return { label: 'Baixo', tone: 'ok' };
}

/** Variação percentual entre os dois últimos pontos do histórico. */
export function trend(hist) {
  const a = hist[hist.length - 2]?.valor, b = hist[hist.length - 1]?.valor;
  if (a == null || b == null || a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

// Contorno simplificado do Brasil (lon, lat), só para o mapa esquemático.
const BR = [[-51.6,4.4],[-50.0,1.9],[-50.3,0.2],[-48.5,-0.9],[-47.0,-0.8],[-44.6,-2.3],[-41.5,-2.9],[-39.0,-3.7],[-37.2,-4.6],[-35.2,-5.4],[-34.8,-7.2],[-35.2,-9.2],[-37.1,-11.0],[-38.6,-13.0],[-39.1,-16.5],[-39.7,-19.0],[-40.9,-21.5],[-42.0,-23.0],[-44.6,-23.4],[-46.6,-24.0],[-48.5,-26.0],[-48.6,-28.4],[-50.2,-30.0],[-52.2,-32.2],[-53.4,-33.7],[-53.2,-32.9],[-55.6,-30.9],[-57.6,-30.2],[-56.0,-28.2],[-54.5,-27.0],[-54.3,-25.6],[-54.6,-24.0],[-55.7,-22.3],[-57.9,-22.1],[-57.7,-20.0],[-58.1,-17.5],[-60.1,-16.3],[-60.3,-14.5],[-62.0,-13.0],[-65.3,-9.8],[-68.0,-10.9],[-70.6,-11.0],[-72.9,-9.5],[-73.2,-7.4],[-72.4,-5.3],[-70.2,-4.2],[-69.9,-1.5],[-69.4,-0.9],[-70.0,1.0],[-67.3,1.8],[-66.9,1.2],[-65.0,2.1],[-64.0,3.8],[-63.5,4.0],[-62.0,4.1],[-60.6,5.2],[-59.8,4.4],[-60.0,1.8],[-58.0,1.4],[-56.5,2.0],[-54.5,2.4],[-52.5,2.3]];
export const MAP_SIZE = 400;
export const project = (lon, lat) => [((lon + 74) / 40) * MAP_SIZE, ((6 - lat) / 40) * MAP_SIZE];
export const BRASIL_PATH = `M${BR.map(([lo, la]) => project(lo, la).map((v) => v.toFixed(1)).join(',')).join('L')}Z`;

export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
