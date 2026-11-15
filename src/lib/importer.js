// Importação em massa: lê CSV (vírgula, ponto e vírgula ou tab) ou JSON e converte em notícias/toxinas.
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_ROWS = 5000;

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Lê CSV respeitando aspas. Detecta o separador pela primeira linha. */
export function parseCsv(raw) {
  const text = raw.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const heads = rows[0].map((h) => norm(h));
  return rows.slice(1).map((r) => Object.fromEntries(heads.map((h, i) => [h || `coluna_${i + 1}`, (r[i] ?? '').trim()])));
}

/** Aceita um arquivo .csv ou .json. No JSON vale uma lista ou um objeto com a lista dentro. */
export async function readRows(file, listKeys = []) {
  if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo maior que 8 MB.');
  const raw = await file.text();
  let rows;
  if (/\.json$/i.test(file.name) || /^\s*[[{]/.test(raw)) {
    let j;
    try { j = JSON.parse(raw); } catch { throw new Error('JSON inválido.'); }
    if (j && !Array.isArray(j) && j.colecoes) throw new Error('Este arquivo é o catálogo completo do Firebase. Use o bloco “Catálogo completo”.');
    if (!Array.isArray(j)) j = listKeys.map((k) => j?.[k]).find(Array.isArray) || Object.values(j || {}).find(Array.isArray);
    if (!Array.isArray(j)) throw new Error('Não encontrei uma lista de itens no JSON.');
    rows = j.filter((o) => o && typeof o === 'object').map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [norm(k), typeof v === 'string' ? v.trim() : v])));
  } else {
    rows = parseCsv(raw);
  }
  if (!rows.length) throw new Error('O arquivo não tem linhas de dados.');
  if (rows.length > MAX_ROWS) throw new Error(`O arquivo tem ${rows.length} linhas; o limite é ${MAX_ROWS} por importação.`);
  return rows;
}

const pick = (row, names) => {
  for (const n of names) { const v = row[n]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); }
  return '';
};
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
const isUrl = (u) => /^https?:\/\/\S+$/i.test(u);

function parseDate(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (br) return new Date(+br[3], +br[2] - 1, +br[1], 12).getTime();
  return Date.parse(v) || 0;
}

const NEWS_COLS = ['titulo', 'title', 'manchete', 'noticia', 'fonte', 'source', 'veiculo', 'link', 'url', 'resumo', 'excerpt', 'descricao', 'imagem', 'image', 'data', 'date', 'publicado_em'];

/** Retorna { ok: [...], skipped: [{ line, reason }] }. */
export function mapNews(rows) {
  const ok = [], skipped = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2;
    const title = pick(r, ['titulo', 'title', 'manchete', 'noticia']);
    const link = pick(r, ['link', 'url']);
    if (title.length < 5) return skipped.push({ line, reason: 'sem título (mínimo 5 letras)' });
    if (!isUrl(link)) return skipped.push({ line, reason: 'link ausente ou inválido' });
    if (seen.has(link)) return skipped.push({ line, reason: 'link repetido no arquivo' });
    seen.add(link);
    const image = pick(r, ['imagem', 'image']);
    ok.push({
      id: `n${hash(link)}`, title, link,
      source: pick(r, ['fonte', 'source', 'veiculo']) || new URL(link).hostname.replace(/^www\./, ''),
      excerpt: pick(r, ['resumo', 'excerpt', 'descricao']).slice(0, 400),
      image: isUrl(image) ? image : '',
      date: parseDate(pick(r, ['data', 'date', 'publicado_em'])) || Date.now(),
      createdAt: Date.now(),
    });
  });
  return { ok, skipped };
}

const TOX_KNOWN = ['nivel_minimo_acesso', 'nivel_minimo', 'nivel', 'nome', 'toxina', 'substancia', 'name', 'classe', 'class', 'categoria', 'risco', 'nivel_de_risco', 'nivel_risco', 'descricao', 'description', 'divisao', 'divisao_responsavel'];

/** Colunas que não são as principais ficam em `campos`, para não perder nada da planilha. */
export function mapToxins(rows) {
  const ok = [], skipped = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const line = i + 2;
    const nome = pick(r, ['nome', 'toxina', 'substancia', 'name']);
    if (nome.length < 2) return skipped.push({ line, reason: 'sem nome da toxina' });
    const divisao = pick(r, ['divisao', 'divisao_responsavel']);
    const key = `${nome.toLowerCase()}|${divisao.toLowerCase()}`;
    if (seen.has(key)) return skipped.push({ line, reason: 'toxina repetida no arquivo' });
    seen.add(key);
    const campos = {};
    Object.entries(r).forEach(([k, v]) => {
      if (TOX_KNOWN.includes(k) || v === '' || v == null || typeof v === 'object') return;
      if (!/^__.*__$/.test(k)) campos[k] = String(v).slice(0, 500);
    });
    ok.push({
      id: `t${hash(key)}`, nome,
      classe: pick(r, ['classe', 'class', 'categoria']),
      risco: pick(r, ['risco', 'nivel_de_risco', 'nivel_risco']),
      descricao: pick(r, ['descricao', 'description']).slice(0, 800),
      divisao, campos, createdAt: Date.now(),
      nivelMinimoAcesso: Math.min(3, Math.max(1, Number(pick(r, ['nivel_minimo_acesso', 'nivel_minimo', 'nivel'])) || 2)),
    });
  });
  return { ok, skipped };
}

export const NEWS_TEMPLATE = 'titulo;fonte;data;link;resumo;imagem\n"Exemplo de título da notícia";"Agência Brasil";"07/11/2026";"https://exemplo.com/noticia";"Resumo curto (opcional)";""\n';
export const TOXIN_TEMPLATE = 'nome;classe;risco;divisao;descricao\n"Exemplo de toxina";"Classe química";"Alto";"Controle de Substâncias Tóxicas";"Descrição curta (opcional)"\n';
export { NEWS_COLS };


// ---------- Catálogo completo (JSON exportado no formato do Firebase: { colecoes: { toxinas, divisoes, alertas, ... } }) ----------
const PLACEHOLDER = 'SERVER_TIMESTAMP';
const stamp = (v, now) => {
  if (v === PLACEHOLDER) return now;
  if (Array.isArray(v)) return v.map((x) => stamp(x, now));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stamp(x, now)]));
  return v;
};

export async function readCatalog(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo maior que 8 MB.');
  let j;
  try { j = JSON.parse(await file.text()); } catch { throw new Error('JSON inválido.'); }
  const c = j?.colecoes;
  if (!c || typeof c !== 'object') throw new Error('Não encontrei o campo “colecoes” no JSON. Este bloco é para o catálogo completo.');
  const list = (k) => (Array.isArray(c[k]) ? c[k] : []);
  return { toxinas: list('toxinas'), divisoes: list('divisoes'), alertas: list('alertas') };
}

/** Fichas completas de toxinas. Os IDs de divisão viram nomes; marcadores de data viram a data da importação. */
export function mapCatalogToxins(list, divisoes = []) {
  const ok = [], skipped = [];
  const names = Object.fromEntries(divisoes.filter((d) => d?.id).map((d) => [d.id, d.nome || d.id]));
  const now = Date.now();
  list.forEach((t, i) => {
    const line = i + 1;
    if (!t || typeof t !== 'object') return skipped.push({ line, reason: 'item inválido' });
    if (!t.id || !t.nome) return skipped.push({ line, reason: `sem ${!t.id ? 'id' : 'nome'}` });
    const d = stamp(t, now);
    if (typeof d.criadoPor === 'string' && /^UID_/.test(d.criadoPor)) delete d.criadoPor;
    ok.push({
      ...d,
      id: String(t.id).replace(/[\/]/g, '_'),
      classe: t.categoria || '',
      risco: t.classificacaoRisco?.nivel || '',
      descricao: t.resumo || '',
      divisao: '',
      divisoes: (Array.isArray(t.divisoesPermitidas) ? t.divisoesPermitidas : []).map((id) => names[id] || id),
      nivelMinimoAcesso: Math.min(3, Math.max(1, Number(t.nivelMinimoAcesso) || 1)),
      status: t.status || 'publicada',
    });
  });
  return { ok, skipped };
}

/** Alertas ativos do catálogo viram notícias do Nível 1. */
export function mapCatalogAlerts(list) {
  const ok = [], skipped = [];
  const now = Date.now();
  list.forEach((a, i) => {
    const line = i + 1;
    if (!a || !a.titulo) return skipped.push({ line, reason: 'sem título' });
    if (a.status && a.status !== 'ativo') return skipped.push({ line, reason: 'alerta inativo' });
    if (typeof a.expiraEm === 'string' && Date.parse(a.expiraEm) < now) return skipped.push({ line, reason: 'alerta expirado' });
    if (!isUrl(a.fonteUrl || '')) return skipped.push({ line, reason: 'sem link da fonte' });
    const when = a.publicadoEm === PLACEHOLDER ? now : (Date.parse(a.publicadoEm) || now);
    ok.push({
      id: `n${hash(a.fonteUrl)}`, title: String(a.titulo), link: a.fonteUrl,
      source: `Alerta${a.severidade ? ` · ${a.severidade}` : ''}`,
      excerpt: String(a.descricao || '').slice(0, 400), image: '', date: when, createdAt: now,
    });
  });
  return { ok, skipped };
}
