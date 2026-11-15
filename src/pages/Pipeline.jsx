import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useEngine } from '../hooks/useEngine.js';
import { detectFaces, identify } from '../lib/faceEngine.js';
import { yawIndex } from '../lib/liveness.js';
import {
  drawGray, drawHistogram, equalize, gaussian3, grabFrame, histogram, laplacianVariance, meanOf,
  rgbHistograms, skinMask, sobel, toGray,
} from '../lib/imageProc.js';
import LevelBadge from '../components/LevelBadge.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = 320;

const PHASES = [
  { id: 1, name: 'Aquisição', sub: 'sensor' },
  { id: 2, name: 'Pré-processamento', sub: 'realce e ruído' },
  { id: 3, name: 'Segmentação', sub: 'isolar o rosto' },
  { id: 4, name: 'Extração de características', sub: 'pontos e vetor' },
  { id: 5, name: 'Classificação e interpretação', sub: 'quem é e o que pode' },
];

const REGIONS = [
  [0, 16, '#9fb0a5'], [17, 26, '#e0a21a'], [27, 35, '#7bc67e'], [36, 47, '#6aa7ff'], [48, 67, '#ff7a66'],
];

function Canvas({ name, cv, label, caption }) {
  return (
    <figure className="fig">
      <canvas ref={(el) => { cv.current[name] = el; }} />
      <figcaption><b>{label}</b>{caption && <span>{caption}</span>}</figcaption>
    </figure>
  );
}
function Hist({ name, cv, label }) {
  return (
    <figure className="fig hist">
      <canvas ref={(el) => { cv.current[name] = el; }} />
      <figcaption><b>{label}</b></figcaption>
    </figure>
  );
}

export default function Pipeline() {
  const { users, settings, isAdmin } = useApp();
  const engine = useEngine();
  const cam = useCamera(settings.cameraId);
  const imgRef = useRef(null);
  const fileRef = useRef(null);
  const work = useRef(null);
  const cv = useRef({});
  const phaseRef = useRef(1);
  const lastT = useRef(performance.now());
  const busy = useRef(false);

  const [phase, setPhase] = useState(1);
  const [source, setSource] = useState('camera');
  const [imgUrl, setImgUrl] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  phaseRef.current = phase;

  const process = useCallback(async () => {
    if (busy.current) return;
    const src = source === 'camera' ? cam.videoRef.current : imgRef.current;
    if (!src) return;
    busy.current = true;
    try {
      if (!work.current) work.current = document.createElement('canvas');
      const fr = grabFrame(src, work.current, W);
      if (!fr) return;
      const { ctx, w, h } = fr;
      const img = ctx.getImageData(0, 0, w, h);
      const gray = toGray(img);
      const p = phaseRef.current;
      const c = cv.current;
      const now = performance.now();
      const fps = 1000 / Math.max(1, now - lastT.current);
      lastT.current = now;
      const d = { srcW: fr.srcW, srcH: fr.srcH, w, h, fps, meanRaw: meanOf(gray) };

      if (p === 1) {
        if (c.raw) { c.raw.width = w; c.raw.height = h; c.raw.getContext('2d').putImageData(img, 0, 0); }
        const hs = rgbHistograms(img);
        ['r', 'g', 'b'].forEach((k, i) => {
          if (c['h' + k]) drawHistogram(c['h' + k], hs[k], ['#c0392b', '#2e8b57', '#2f6fdb'][i]);
          if (c['ch' + k]) {
            const ch = new Uint8ClampedArray(w * h);
            for (let i2 = 0, q = 0; q < ch.length; i2 += 4, q++) ch[q] = img.data[i2 + i];
            drawGray(c['ch' + k], ch, w, h);
          }
        });
      }

      if (p === 2 || p >= 3) {
        const eq = equalize(gray);
        const blur = gaussian3(eq, w, h);
        d.meanEq = meanOf(eq);
        d.sharpRaw = laplacianVariance(gray, w, h);
        d.sharpBlur = laplacianVariance(blur, w, h);
        if (p === 2) {
          if (c.gray) drawGray(c.gray, gray, w, h);
          if (c.eq) drawGray(c.eq, eq, w, h);
          if (c.blur) drawGray(c.blur, blur, w, h);
          if (c.hGray) drawHistogram(c.hGray, histogram(gray), '#5c6b61');
          if (c.hEq) drawHistogram(c.hEq, histogram(eq), '#17231c');
        }
        if (p === 3) {
          if (c.skin) drawGray(c.skin, skinMask(img), w, h);
          if (c.edge) drawGray(c.edge, sobel(blur, w, h), w, h);
        }
      }

      if (p >= 3) {
        // O detector e o reconhecimento recebem o quadro original em RGB.
        // As operações clássicas acima são demonstradas como análises complementares
        // e não são passadas como entrada para a rede neural.
        const faces = await detectFaces(src, { inputSize: settings.inputSize, descriptors: p >= 4 });
        const k = w / fr.srcW;
        const f = faces[0];
        d.faces = faces.length;
        if (f) {
          const box = { x: f.box.x * k, y: f.box.y * k, width: f.box.width * k, height: f.box.height * k };
          const pts = f.points.map((q) => ({ x: q.x * k, y: q.y * k }));
          d.score = f.score; d.box = box; d.pts = pts; d.srcBox = f.box;
          d.descriptor = f.descriptor;
          const side = Math.max(box.width, box.height) * 1.35;
          const ox = box.x + box.width / 2 - side / 2, oy = box.y + box.height / 2 - side / 2;
          const S = 240, sc = S / side;
          const roi = (canvas) => {
            if (!canvas) return null;
            canvas.width = S; canvas.height = S;
            const g = canvas.getContext('2d');
            g.fillStyle = '#111'; g.fillRect(0, 0, S, S);
            g.drawImage(work.current, ox, oy, side, side, 0, 0, S, S);
            return g;
          };
          if (p === 3) {
            if (c.detect) {
              c.detect.width = w; c.detect.height = h;
              const g = c.detect.getContext('2d');
              g.drawImage(work.current, 0, 0);
              g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, h);
              g.drawImage(work.current, box.x, box.y, box.width, box.height, box.x, box.y, box.width, box.height);
              g.strokeStyle = '#6fd08c'; g.lineWidth = 2; g.strokeRect(box.x, box.y, box.width, box.height);
            }
            roi(c.roi);
          }
          if (p >= 4) {
            const g = roi(c.lm);
            if (g) {
              REGIONS.forEach(([a, b, col]) => {
                g.fillStyle = col;
                for (let i = a; i <= b; i++) { g.beginPath(); g.arc((pts[i].x - ox) * sc, (pts[i].y - oy) * sc, 2.6, 0, 6.3); g.fill(); }
              });
            }
            const dist = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
            d.metrics = {
              interocular: dist(36, 45), widthHeight: dist(0, 16) / dist(8, 27), mouth: dist(48, 54) / dist(0, 16),
              ear: eyeAspect(f.points), yaw: yawIndex(f.points), nose: dist(27, 33) / dist(0, 16),
            };
            if (c.desc && f.descriptor) {
              const cc = c.desc; cc.width = cc.clientWidth * 2 || 640; cc.height = 160;
              const g2 = cc.getContext('2d'); g2.clearRect(0, 0, cc.width, cc.height);
              const bw = cc.width / 128;
              f.descriptor.forEach((v, i) => {
                const hh = Math.min(1, Math.abs(v) * 5) * 70;
                g2.fillStyle = v >= 0 ? '#3f7d4e' : '#c98500';
                g2.fillRect(i * bw + 1, v >= 0 ? 80 - hh : 80, bw - 2, hh);
              });
              g2.fillStyle = '#8a968d'; g2.fillRect(0, 80, cc.width, 1);
            }
          }
          if (p === 5 && f.descriptor && users.length) {
            d.ranking = identify(f.descriptor, users).map((r, i) => ({ id: r.user.id, name: isAdmin ? r.user.name : `Cadastro ${i + 1}`, level: r.user.level, distance: r.distance }));
            roi(c.who);
          }
        } else if (p === 3 && c.detect) {
          c.detect.width = w; c.detect.height = h;
          c.detect.getContext('2d').drawImage(work.current, 0, 0);
        }
      }
      setData(d);
      setErr('');
    } catch (e) {
      setErr(`Falha ao processar o quadro: ${e.message}`);
    } finally {
      busy.current = false;
    }
  }, [source, cam.videoRef, settings.inputSize, users, isAdmin]);

  const processRef = useRef(process);
  processRef.current = process;

  // laço para a câmera
  useEffect(() => {
    if (source !== 'camera' || !cam.active || !engine.ready) return;
    let on = true;
    (async () => {
      while (on) {
        if (cam.videoRef.current?.videoWidth) await processRef.current();
        await sleep(phaseRef.current >= 3 ? 150 : 90);
      }
    })();
    return () => { on = false; };
  }, [source, cam.active, engine.ready, cam.videoRef]);

  // imagem estática: reprocessa ao trocar de fase
  useEffect(() => {
    if (source === 'image' && imgUrl && engine.ready) {
      const t = setTimeout(() => processRef.current(), 60);
      return () => clearTimeout(t);
    }
  }, [source, imgUrl, phase, engine.ready]);

  function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('Escolha um arquivo de imagem (JPG, PNG ou WebP).'); return; }
    cam.stop();
    setSource('image');
    setImgUrl(URL.createObjectURL(f));
    setData(null);
  }

  const m = data?.metrics;
  const best = data?.ranking?.[0];

  return (
    <>
      <header className="page-head">
        <h1>Laboratório de processamento de imagem</h1>
        <p>Demonstração das cinco fases da APS sobre a câmera ou uma foto. As técnicas clássicas de processamento são exibidas junto à detecção neural para mostrar a função de cada método.</p>
      </header>

      <div className="flow" role="tablist" aria-label="Fases do processamento">
        {PHASES.map((p, i) => (
          <button key={p.id} role="tab" aria-selected={phase === p.id} className={`flow-step ${phase === p.id ? 'on' : ''} ${i >= 2 ? 'low' : ''}`}
            onClick={() => { setPhase(p.id); setData(null); }}>
            <span className="n">{p.id}</span>
            <b>{p.name}</b>
            <small>{p.sub}</small>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Fonte da imagem">
          <button className={source === 'camera' ? 'on' : ''} onClick={() => { setSource('camera'); setData(null); }}>Câmera</button>
          <button className={source === 'image' ? 'on' : ''} onClick={() => fileRef.current?.click()}>Foto</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        {source === 'camera' && (cam.active
          ? <button className="btn btn-ghost" onClick={cam.stop}>Desligar câmera</button>
          : <button className="btn btn-primary" onClick={cam.start} disabled={!engine.ready}> Ligar câmera</button>)}
        {!engine.ready && !engine.error && <span className="muted small">Carregando modelos de IA…</span>}
        {data && <span className="muted small">{data.srcW}×{data.srcH} → {data.w}×{data.h} px · {data.fps.toFixed(1)} quadros/s</span>}
      </div>
      {cam.error && <div className="banner banner-err" role="alert"><div>{cam.error}</div></div>}
      {engine.error && <div className="banner banner-err" role="alert"><div>{engine.error}</div></div>}
      {err && <div className="banner banner-err" role="alert"><div>{err}</div></div>}

      {/* fontes ocultas */}
      <video ref={cam.videoRef} playsInline muted className="hidden-src" />
      {imgUrl && <img ref={imgRef} src={imgUrl} alt="" className="hidden-src" onLoad={() => processRef.current()} />}

      {!cam.active && !imgUrl && (
        <div className="empty slim"><p>Ligue a câmera ou envie uma foto de rosto para ver as fases.</p></div>
      )}

      <section className={`phase ${!cam.active && !imgUrl ? 'dim' : ''}`}>
        {phase === 1 && (
          <>
            <div className="explain">
              <h2>1 · Aquisição</h2>
              <p>O sensor converte luz em uma matriz de pixels RGB. A webcam entrega o vídeo em até 1280×720; para processar rápido, cada quadro é reduzido a 320 px de largura. A qualidade da imagem aqui limita tudo o que vem depois.</p>
            </div>
            <div className="figs">
              <Canvas name="raw" cv={cv} label="Quadro capturado" caption="RGB" />
              <Canvas name="chr" cv={cv} label="Canal R" /><Canvas name="chg" cv={cv} label="Canal G" /><Canvas name="chb" cv={cv} label="Canal B" />
            </div>
            <div className="figs three">
              <Hist name="hr" cv={cv} label="Histograma R" /><Hist name="hg" cv={cv} label="Histograma G" /><Hist name="hb" cv={cv} label="Histograma B" />
            </div>
            {data && <dl className="kv"><dt>Brilho médio</dt><dd>{data.meanRaw.toFixed(0)} / 255 {data.meanRaw < 60 ? '· escuro' : data.meanRaw > 200 ? '· claro demais' : '· adequado'}</dd></dl>}
          </>
        )}

        {phase === 2 && (
          <>
            <div className="explain">
              <h2>2 · Pré-processamento</h2>
              <p>O quadro capturado é convertido para escala de cinza (0,299 R + 0,587 G + 0,114 B). Em seguida, o histograma é equalizado para melhorar o contraste e o filtro gaussiano 3×3 suaviza pequenas variações. Nesta demonstração, essas operações são calculadas e exibidas para análise; o detector facial continua recebendo o quadro original em RGB.</p>
            </div>
            <div className="figs three">
              <Canvas name="gray" cv={cv} label="Escala de cinza" /><Canvas name="eq" cv={cv} label="Equalização de histograma" /><Canvas name="blur" cv={cv} label="Filtro gaussiano 3×3" />
            </div>
            <div className="figs two">
              <Hist name="hGray" cv={cv} label="Histograma antes" /><Hist name="hEq" cv={cv} label="Histograma depois" />
            </div>
            {data?.meanEq != null && (
              <dl className="kv">
                <dt>Brilho médio</dt><dd>{data.meanRaw.toFixed(0)} → {data.meanEq.toFixed(0)}</dd>
                <dt>Nitidez (variância do Laplaciano)</dt><dd>{data.sharpRaw.toFixed(0)} → {data.sharpBlur.toFixed(0)} após suavizar</dd>
              </dl>
            )}
          </>
        )}

        {phase === 3 && (
          <>
            <div className="explain">
              <h2>3 · Segmentação</h2>
              <p>O Tiny Face Detector localiza o rosto no quadro original e delimita sua região por uma caixa. Em paralelo, a máscara YCbCr classifica pixels com tonalidades compatíveis com pele, enquanto o operador de Sobel destaca as bordas da imagem. Essas técnicas clássicas são análises complementares; não são entradas do detector neural.</p>
            </div>
            <div className="figs">
              <Canvas name="detect" cv={cv} label="Rosto localizado" caption="fundo escurecido" />
              <Canvas name="roi" cv={cv} label="Região do rosto" />
              <Canvas name="skin" cv={cv} label="Máscara de pele" caption="YCbCr" />
              <Canvas name="edge" cv={cv} label="Bordas" caption="Sobel" />
            </div>
            <dl className="kv">
              <dt>Rostos detectados</dt><dd>{data ? data.faces : '–'}{data && data.faces > 1 ? ' · o terminal nega com mais de um rosto' : ''}</dd>
              {data?.box && <><dt>Confiança do detector</dt><dd>{(data.score * 100).toFixed(0)}%</dd>
                <dt>Caixa (na imagem original)</dt><dd>x {data.srcBox.x.toFixed(0)}, y {data.srcBox.y.toFixed(0)}, {data.srcBox.width.toFixed(0)}×{data.srcBox.height.toFixed(0)} px</dd></>}
            </dl>
          </>
        )}

        {phase === 4 && (
          <>
            <div className="explain">
              <h2>4 · Extração de características</h2>
              <p>Com o rosto localizado, a rede de landmarks identifica 68 pontos de referência (contorno, sobrancelhas, nariz, olhos e boca). A rede de reconhecimento facial, aplicada ao quadro original, gera um vetor de 128 valores. Essa representação numérica é a que será comparada com as amostras cadastradas.</p>
            </div>
            <div className="figs lm">
              <Canvas name="lm" cv={cv} label="68 pontos faciais" />
              <div className="legend">
                {[['#9fb0a5', 'Contorno'], ['#e0a21a', 'Sobrancelhas'], ['#7bc67e', 'Nariz'], ['#6aa7ff', 'Olhos'], ['#ff7a66', 'Boca']].map(([c, l]) => <span key={l}><i style={{ background: c }} />{l}</span>)}
              </div>
            </div>
            <figure className="fig wide"><canvas ref={(el) => { cv.current.desc = el; }} className="desc" /><figcaption><b>Vetor de 128 características</b><span>verde positivo, âmbar negativo</span></figcaption></figure>
            {m ? (
              <dl className="kv">
                <dt>Distância entre os olhos</dt><dd>{m.interocular.toFixed(0)} px</dd>
                <dt>Largura do rosto / altura</dt><dd>{m.widthHeight.toFixed(2)}</dd>
                <dt>Largura da boca / rosto</dt><dd>{m.mouth.toFixed(2)}</dd>
                <dt>Abertura dos olhos (EAR)</dt><dd>{m.ear.toFixed(2)} {m.ear < 0.2 ? '· olhos fechados' : ''}</dd>
                <dt>Giro horizontal</dt><dd>{m.yaw.toFixed(2)} {Math.abs(m.yaw) > 0.16 ? '· rosto virado' : '· de frente'}</dd>
              </dl>
            ) : <p className="muted small">Aguardando um rosto no quadro.</p>}
          </>
        )}

        {phase === 5 && (
          <>
            <div className="explain">
              <h2>5 · Classificação e interpretação</h2>
              <p>Mede a distância euclidiana entre o vetor do rosto e cada amostra cadastrada. Se a menor distância ficar abaixo do limite ({settings.threshold}), a pessoa é identificada e o nível dela decide quais compartimentos abrem. Se não, o terminal volta às fases 3 e 4 com um novo quadro, como no laço da figura da APS.</p>
            </div>
            {users.length === 0 ? (
              <div className="empty slim"><p>Cadastre pelo menos uma pessoa para comparar.</p></div>
            ) : (
              <div className="classify">
                <Canvas name="who" cv={cv} label="Rosto analisado" />
                <div className="rank">
                  {!data?.ranking && <p className="muted small">Aguardando um rosto no quadro.</p>}
                  {data?.ranking && (
                    <>
                      <ul>
                        {data.ranking.map((r) => (
                          <li key={r.id} className={r.distance <= settings.threshold ? 'hit' : ''}>
                            <span className="r-name">{r.name} <LevelBadge level={r.level} /></span>
                            <span className="r-bar"><i style={{ width: `${Math.min(100, r.distance * 100)}%` }} /><u style={{ left: `${settings.threshold * 100}%` }} /></span>
                            <b>{r.distance.toFixed(3)}</b>
                          </li>
                        ))}
                      </ul>
                      <p className={`verdict ${best.distance <= settings.threshold ? 'ok' : 'no'}`}>
                        {best.distance <= settings.threshold
                          ? <>Identificado: <b>{best.name}</b>, Nível {best.level}. Distância {best.distance.toFixed(3)} abaixo do limite {settings.threshold}.</>
                          : <>Ninguém corresponde. A menor distância é {best.distance.toFixed(3)}, acima do limite {settings.threshold}. O terminal negaria o acesso.</>}
                      </p>
                      <p className="muted small">A linha vertical marca o limite. Distâncias menores significam rostos mais parecidos.</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
