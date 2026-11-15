import { useEffect, useMemo, useState } from 'react';
import { BRASIL_PATH, MAP_SIZE, aqiCategory, project, riskLevel, riskScore } from '../lib/ambiente.js';

const nf = (v, d = 1) => (v == null ? '–' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d }));

/** Gráfico de linha simples em SVG. points: [{ periodo, valor }] */
export function LineChart({ points, label }) {
  const W = 300, H = 110, L = 10, R = 10, T = 14, B = 22;
  const vals = points.map((p) => p.valor);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
  const y = (v) => T + (1 - (v - min) / span) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join('');
  const last = points[points.length - 1], first = points[0];
  return (
    <svg className="linechart" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${label}: de ${nf(first.valor)} em ${first.periodo} para ${nf(last.valor)} em ${last.periodo}; mínimo ${nf(min)}, máximo ${nf(max)}`}>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="lc-axis" />
      <path d={path} className="lc-line" fill="none" />
      {points.map((p, i) => <circle key={p.periodo + i} cx={x(i)} cy={y(p.valor)} r={i === points.length - 1 ? 3.6 : 2} className="lc-dot" />)}
      <text x={L} y={H - 6} className="lc-txt">{first.periodo}</text>
      <text x={W - R} y={H - 6} className="lc-txt" textAnchor="end">{last.periodo}</text>
      <text x={x(points.length - 1)} y={Math.max(10, y(last.valor) - 7)} className="lc-val" textAnchor="end">{nf(last.valor)}</text>
    </svg>
  );
}

const CATS = {
  queimada: { label: 'Queimadas', cls: 'm-fire' },
  desmatamento: { label: 'Desmatamento', cls: 'm-defor' },
  poluicao: { label: 'Poluição', cls: 'm-poll' },
};
function Marker({ cat, x, y, r, title }) {
  const c = CATS[cat].cls;
  if (cat === 'desmatamento') return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} className={`map-pt ${c}`}><title>{title}</title></rect>;
  if (cat === 'poluicao') return <polygon points={`${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`} className={`map-pt ${c}`}><title>{title}</title></polygon>;
  return <circle cx={x} cy={y} r={r} className={`map-pt ${c}`}><title>{title}</title></circle>;
}

/** Mapa esquemático do Brasil (contorno simplificado) com as ocorrências. */
export function MapaOcorrencias({ items }) {
  const [on, setOn] = useState({ queimada: true, desmatamento: true, poluicao: true });
  const count = useMemo(() => Object.fromEntries(Object.keys(CATS).map((k) => [k, items.filter((i) => i.categoria === k).length])), [items]);
  const shown = items.filter((i) => on[i.categoria]);
  return (
    <div className="mapbox">
      <svg viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`} role="img" aria-label={`Mapa esquemático do Brasil com ${shown.length} ocorrências: ${Object.entries(count).map(([k, n]) => `${n} de ${CATS[k].label.toLowerCase()}`).join(', ')}`}>
        <path d={BRASIL_PATH} className="map-br" />
        {shown.map((i) => {
          const [x, y] = project(i.lon, i.lat);
          const r = 3.5 + (i.intensidade || 1) * 0.7;
          return <Marker key={i.id} cat={i.categoria} x={x} y={y} r={r} title={`${CATS[i.categoria].label}${i.regiao ? ` · ${i.regiao}` : ''}`} />;
        })}
      </svg>
      <div className="map-legend" role="group" aria-label="Filtrar ocorrências">
        {Object.entries(CATS).map(([k, c]) => (
          <button key={k} className={`chip ${on[k] ? 'on' : ''}`} aria-pressed={on[k]} onClick={() => setOn((s) => ({ ...s, [k]: !s[k] }))}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={c.cls}>
              {k === 'desmatamento' ? <rect x="1" y="1" width="10" height="10" /> : k === 'poluicao' ? <polygon points="6,1 11,11 1,11" /> : <circle cx="6" cy="6" r="5" />}
            </svg>
            {c.label} ({count[k]})
          </button>
        ))}
      </div>
      <p className="muted small">Mapa esquemático com contorno simplificado; o tamanho do símbolo indica a intensidade.</p>
    </div>
  );
}

/** Matriz de risco 5x5 (probabilidade x severidade) com os cenários numerados. */
export function MatrizRisco({ items }) {
  const rows = [5, 4, 3, 2, 1];
  const cols = [1, 2, 3, 4, 5];
  return (
    <div className="riskm" role="group" aria-label="Matriz de risco: probabilidade por severidade">
      <div className="riskm-y" aria-hidden="true">Severidade</div>
      <div className="riskm-grid">
        {rows.map((sev) => cols.map((pr) => {
          const lvl = riskLevel(sev * pr);
          const here = items.map((it, idx) => ({ it, n: idx + 1 })).filter(({ it }) => it.severidade === sev && it.probabilidade === pr);
          return (
            <div key={`${sev}-${pr}`} className={`riskm-cell t-${lvl.tone}`} title={`Severidade ${sev} × probabilidade ${pr}: ${lvl.label}`}>
              {here.map(({ n, it }) => <span key={it.id} className="riskm-n">{n}</span>)}
            </div>
          );
        }))}
      </div>
      <div className="riskm-x" aria-hidden="true">Probabilidade →</div>
    </div>
  );
}
export { riskScore, riskLevel };

const CITIES = [
  ['Brasília (DF)', -15.78, -47.93], ['São Paulo (SP)', -23.55, -46.63], ['Rio de Janeiro (RJ)', -22.91, -43.17], ['Manaus (AM)', -3.12, -60.02],
  ['Belém (PA)', -1.46, -48.49], ['Porto Alegre (RS)', -30.03, -51.23], ['Recife (PE)', -8.05, -34.88], ['Cuiabá (MT)', -15.6, -56.1],
];

/** Qualidade do ar em tempo real (serviço público Open-Meteo), quando houver dado disponível. */
export function QualidadeAr() {
  const [city, setCity] = useState(0);
  const [st, setSt] = useState({ status: 'loading', data: null });
  useEffect(() => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    setSt({ status: 'loading', data: null });
    const [, lat, lon] = CITIES[city];
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide&timezone=auto`, { signal: ctl.signal })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((j) => { if (!j.current) throw new Error('sem dado'); setSt({ status: 'ok', data: j.current }); })
      .catch(() => setSt({ status: 'error', data: null }))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [city]);
  const d = st.data;
  const cat = aqiCategory(d?.us_aqi);
  return (
    <div className="aqi panel-in">
      <div className="aqi-head">
        <label className="field-inline"><span>Cidade</span>
          <select value={city} onChange={(e) => setCity(Number(e.target.value))}>{CITIES.map((c, i) => <option key={c[0]} value={i}>{c[0]}</option>)}</select>
        </label>
        <span className="muted small">Fonte: Open-Meteo, tempo real</span>
      </div>
      {st.status === 'loading' && <p className="muted" role="status">Consultando a qualidade do ar…</p>}
      {st.status === 'error' && <p className="muted" role="status">Sem dados em tempo real no momento. Verifique a conexão e tente outra cidade.</p>}
      {st.status === 'ok' && (
        <div className="aqi-body" role="status">
          <div className={`aqi-badge t-${cat.tone}`}><b>{nf(d.us_aqi, 0)}</b><span>{cat.label}</span></div>
          <dl className="aqi-dl">
            <div><dt>PM2,5</dt><dd>{nf(d.pm2_5)} µg/m³</dd></div>
            <div><dt>PM10</dt><dd>{nf(d.pm10)} µg/m³</dd></div>
            <div><dt>Ozônio</dt><dd>{nf(d.ozone)} µg/m³</dd></div>
            <div><dt>NO₂</dt><dd>{nf(d.nitrogen_dioxide)} µg/m³</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
