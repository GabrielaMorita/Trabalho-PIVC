// Notícias de meio ambiente para o compartimento do Nível 1.
// Busca feeds RSS públicos pelo navegador. Como os sites não liberam CORS, a leitura passa por um
// conversor público (rss2json) e, se ele falhar, por um proxy simples (allorigins).
const FEEDS = [
  { id: 'panorama', label: 'Panorama', url: 'https://news.google.com/rss/search?q=meio+ambiente&hl=pt-BR&gl=BR&ceid=BR:pt-419', google: true },
  { id: 'mongabay', label: 'Mongabay Brasil', url: 'https://brasil.mongabay.com/feed/' },
  { id: 'oeco', label: '((o))eco', url: 'https://oeco.org.br/feed/' },
];
export const FEED_FILTERS = FEEDS.map(({ id, label }) => ({ id, label }));

// Links úteis quando não há internet.
export const SOURCE_LINKS = [
  { name: 'Ministério do Meio Ambiente', url: 'https://www.gov.br/mma/pt-br' },
  { name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/' },
  { name: 'Mongabay Brasil', url: 'https://brasil.mongabay.com/' },
  { name: '((o))eco', url: 'https://oeco.org.br/' },
];

const CACHE_KEY = 'cofre.news';
const TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;
const MAX_ITEMS = 24;

const text = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};
const clip = (s, n = 170) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);

async function getJson(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function getText(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function normalize(feed, raw) {
  let title = text(raw.title);
  let source = feed.label;
  if (feed.google) {
    // o Google Notícias manda "Título - Veículo"
    const i = title.lastIndexOf(' - ');
    if (i > 0) { source = title.slice(i + 3); title = title.slice(0, i); }
  }
  const date = Date.parse(raw.pubDate) || 0;
  return {
    id: raw.link,
    feed: feed.id,
    title,
    source,
    date,
    link: raw.link,
    excerpt: feed.google ? '' : clip(text(raw.description)),
    image: /^https?:\/\//.test(raw.thumbnail || '') ? raw.thumbnail : '',
  };
}

async function viaRss2Json(feed, signal) {
  const j = await getJson(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, signal);
  if (j.status !== 'ok' || !Array.isArray(j.items)) throw new Error('rss2json');
  return j.items.map((it) => normalize(feed, { title: it.title, link: it.link, pubDate: it.pubDate, description: it.description, thumbnail: it.thumbnail || it.enclosure?.link }));
}

async function viaProxy(feed, signal) {
  const xml = await getText(`https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`, signal);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].slice(0, 12).map((it) => {
    const get = (tag) => it.querySelector(tag)?.textContent || '';
    return normalize(feed, { title: get('title'), link: get('link'), pubDate: get('pubDate'), description: get('description') });
  });
}

async function loadFeed(feed) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    try { return await viaRss2Json(feed, ctl.signal); } catch { return await viaProxy(feed, ctl.signal); }
  } finally { clearTimeout(timer); }
}

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return c && Date.now() - c.at < TTL_MS ? c : null;
  } catch { return null; }
}

/** Retorna { items, at }. Lança erro se nenhum feed responder. */
export async function loadNews({ force = false } = {}) {
  if (!force) { const c = readCache(); if (c) return c; }
  const results = await Promise.allSettled(FEEDS.map(loadFeed));
  const seen = new Set();
  const items = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((n) => n.title && n.link && !seen.has(n.title.toLowerCase()) && seen.add(n.title.toLowerCase()))
    .sort((a, b) => b.date - a.date)
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error('Nenhum feed respondeu.');
  const out = { items, at: Date.now() };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch { /* cota cheia: ignora */ }
  return out;
}
