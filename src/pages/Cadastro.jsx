import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useEngine } from '../hooks/useEngine.js';
import { detectFaces, distance, round4 } from '../lib/faceEngine.js';
import { cropToDataUrl, laplacianVariance, toGray, meanOf } from '../lib/imageProc.js';
import { validateUser } from '../lib/access.js';
import { DIVISIONS, LEVELS, SAMPLES_REQUIRED, SAMPLE_PROMPTS } from '../lib/constants.js';
import AdminGate from '../components/AdminGate.jsx';
import Viewport from '../components/Viewport.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_SAMPLES = 8;

/** Mede nitidez e luminosidade do recorte do rosto. */
function faceQuality(canvas, box) {
  const s = 96;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, s, s);
  const g = toGray(ctx.getImageData(0, 0, s, s));
  return { sharp: laplacianVariance(g, s, s), light: meanOf(g) };
}

export default function Cadastro() {
  const { users, settings, bootstrap, addUser, updateUser, notify } = useApp();
  const [params] = useSearchParams();
  const editingId = params.get('id');
  const editing = users.find((u) => u.id === editingId) || null;
  const nav = useNavigate();
  const engine = useEngine();
  const cam = useCamera(settings.cameraId);
  const overlayRef = useRef(null);
  const fileRef = useRef(null);

  const [form, setForm] = useState({ name: '', role: '', level: bootstrap ? 3 : 1, division: '' });
  const [samples, setSamples] = useState([]);
  const [errors, setErrors] = useState([]);
  const [live, setLive] = useState({ faces: 0, ratio: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (editing) setForm({ name: editing.name, role: editing.role, level: editing.level, division: editing.division || '' });
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const needed = editing ? 3 : SAMPLES_REQUIRED;

  // pré-visualização com caixa do rosto enquanto a câmera está ligada
  useEffect(() => {
    if (!cam.active || !engine.ready) return;
    let on = true;
    (async () => {
      while (on) {
        const v = cam.videoRef.current;
        if (!v || !v.videoWidth) { await sleep(100); continue; }
        try {
          const faces = await detectFaces(v, { inputSize: 320 });
          if (!on) return;
          const c = overlayRef.current;
          if (c) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.strokeStyle = faces.length === 1 ? '#6fd08c' : '#f0b429';
            ctx.lineWidth = Math.max(3, c.width / 240);
            faces.forEach((f) => ctx.strokeRect(f.box.x, f.box.y, f.box.width, f.box.height));
          }
          setLive({ faces: faces.length, ratio: faces[0] ? faces[0].box.width / v.videoWidth : 0 });
        } catch { /* ignora quadro */ }
        await sleep(120);
      }
    })();
    return () => { on = false; };
  }, [cam.active, engine.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Processa uma imagem (canvas/img) e adiciona como amostra, se passar nas verificações. */
  const addSampleFrom = useCallback(async (source, { fromFile = false } = {}) => {
    const w = source.videoWidth || source.naturalWidth || source.width;
    const h = source.videoHeight || source.naturalHeight || source.height;
    const c = document.createElement('canvas');
    // limita fotos enviadas para não travar o navegador
    const scale = Math.min(1, 1280 / Math.max(w, h));
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    const faces = await detectFaces(c, { inputSize: 416, descriptors: true });
    if (faces.length === 0) return { error: 'Nenhum rosto encontrado. Aproxime-se e melhore a luz.' };
    if (faces.length > 1) return { error: 'Há mais de um rosto na imagem. Use uma foto só da pessoa.' };
    const f = faces[0];
    const minRatio = fromFile ? 0.1 : settings.minFaceRatio;
    if (f.box.width / c.width < minRatio) return { error: 'Rosto pequeno demais. Aproxime-se da câmera.' };
    const q = faceQuality(c, f.box);
    if (q.light < 45) return { error: 'Imagem escura demais. Acenda uma luz virada para o rosto.' };
    if (q.light > 225) return { error: 'Imagem clara demais. Evite luz forte direto na câmera.' };
    if (q.sharp < 20) return { error: 'Imagem desfocada. Fique parado e tente de novo.' };
    return { descriptor: round4(f.descriptor), thumb: cropToDataUrl(c, f.box, 96) };
  }, [settings.minFaceRatio]);

  async function capture() {
    if (busy || !cam.videoRef.current) return;
    setBusy(true); setMsg('');
    try {
      const r = await addSampleFrom(cam.videoRef.current);
      if (r.error) setMsg(r.error);
      else setSamples((s) => [...s, r].slice(0, MAX_SAMPLES));
    } catch (e) { setMsg(`Erro ao analisar a imagem: ${e.message}`); }
    setBusy(false);
  }

  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setMsg('');
    const problems = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) { problems.push(`${file.name}: não é uma imagem.`); continue; }
      if (samples.length >= MAX_SAMPLES) break;
      try {
        const img = await new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i); i.onerror = () => rej(new Error('arquivo corrompido'));
          i.src = URL.createObjectURL(file);
        });
        const r = await addSampleFrom(img, { fromFile: true });
        URL.revokeObjectURL(img.src);
        if (r.error) problems.push(`${file.name}: ${r.error}`);
        else setSamples((s) => [...s, r].slice(0, MAX_SAMPLES));
      } catch (err) { problems.push(`${file.name}: ${err.message}.`); }
    }
    setMsg(problems.join(' '));
    setBusy(false);
  }

  function save(e) {
    e.preventDefault();
    const errs = validateUser(form, users, editing?.id);
    const hasNew = samples.length > 0;
    if (!editing && samples.length < SAMPLES_REQUIRED) errs.push(`Capture pelo menos ${SAMPLES_REQUIRED} amostras do rosto (faltam ${SAMPLES_REQUIRED - samples.length}).`);
    if (editing && hasNew && samples.length < needed) errs.push(`Para trocar as amostras, capture pelo menos ${needed}.`);
    if (hasNew) {
      const ref = samples[0].descriptor;
      if (samples.some((s) => distance(s.descriptor, ref) > 0.65)) errs.push('As amostras parecem ser de pessoas diferentes. Refaça a captura com uma só pessoa.');
      for (const u of users) {
        if (u.id === editing?.id) continue;
        const hit = samples.some((s) => u.descriptors.some((d) => distance(s.descriptor, d) <= settings.threshold));
        if (hit) { errs.push(`Este rosto já está cadastrado como ${u.name}.`); break; }
      }
    }
    setErrors(errs);
    if (errs.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const data = {
      name: form.name.trim(), role: form.role.trim(), level: form.level,
      division: form.level === 2 ? form.division : '',
    };
    if (hasNew) { data.descriptors = samples.map((s) => s.descriptor); data.photo = samples[0].thumb; }
    if (editing) { updateUser(editing.id, data); notify(`Cadastro de ${data.name} atualizado.`); }
    else { addUser(data); notify(`${data.name} cadastrado(a) com ${samples.length} amostras.`); }
    cam.stop();
    nav('/usuarios');
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLevel = (l) => setForm((f) => ({ ...f, level: l, division: l === 2 && !f.division ? DIVISIONS[0] : f.division }));
  const prompt = SAMPLE_PROMPTS[Math.min(samples.length, SAMPLE_PROMPTS.length - 1)];
  const canShoot = cam.active && engine.ready && live.faces === 1 && !busy;
  const lockLevel = bootstrap && !editing;

  return (
    <AdminGate title="O cadastro de rostos">
      <header className="page-head">
        <h1>{editing ? `Editar ${editing.name}` : 'Cadastrar rosto'}</h1>
        <p>{editing ? 'Altere os dados ou capture novas amostras para substituir as atuais.' : `Preencha os dados e capture ${SAMPLES_REQUIRED} amostras do rosto, em ângulos levemente diferentes.`}</p>
      </header>

      {errors.length > 0 && (
        <div className="banner banner-err" role="alert">
          
          <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {engine.error && <div className="banner banner-err" role="alert"><div>{engine.error}</div></div>}
      {cam.error && <div className="banner banner-err" role="alert"><div>{cam.error}</div></div>}

      <form className="enroll" onSubmit={save} noValidate>
        <section className="panel">
          <h2>Dados</h2>
          <label className="field"><span>Nome completo</span><input value={form.name} onChange={set('name')} autoComplete="off" required /></label>
          <label className="field"><span>Cargo</span><input value={form.role} onChange={set('role')} autoComplete="off" placeholder="Ex.: Diretor de Biossegurança" required /></label>
          <fieldset className="levels">
            <legend>Nível de acesso</legend>
            {[1, 2, 3].map((l) => (
              <label key={l} className={`target t${l} ${form.level === l ? 'on' : ''}`}>
                <input type="radio" name="level" checked={form.level === l} disabled={lockLevel && l !== 3} onChange={() => setLevel(l)} />
                <b>{LEVELS[l].short} · {LEVELS[l].title}</b>
                <small>{LEVELS[l].who}</small>
              </label>
            ))}
            {lockLevel && <p className="small muted">O primeiro cadastro precisa ser o ministro. Ele passa a controlar as áreas administrativas.</p>}
          </fieldset>
          {form.level === 2 && (
            <label className="field"><span>Divisão que dirige</span>
              <select value={form.division} onChange={set('division')}>
                {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          )}
        </section>

        <section className="panel capture">
          <h2>Amostras do rosto <span className="count">{samples.length}/{needed}{editing && samples.length === 0 ? ' (opcional)' : ''}</span></h2>
          <Viewport videoRef={cam.videoRef} overlayRef={overlayRef} active={cam.active} tone={live.faces === 1 ? 'ok' : 'idle'}
            hint={engine.ready ? 'Ligue a câmera ou envie fotos.' : 'Carregando modelos de IA…'}>
            {cam.active && <div className="challenge">{live.faces === 0 ? 'Procurando rosto…' : live.faces > 1 ? 'Só uma pessoa no quadro' : prompt}</div>}
          </Viewport>
          <div className="actions wrap">
            {cam.active ? (
              <>
                <button type="button" className="btn btn-primary" onClick={capture} disabled={!canShoot}> Capturar amostra</button>
                <button type="button" className="btn btn-ghost" onClick={cam.stop}>Desligar câmera</button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={cam.start} disabled={!engine.ready}> Ligar câmera</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!engine.ready || busy}> Enviar fotos</button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          </div>
          {busy && <p className="small muted" role="status">Analisando imagem…</p>}
          {msg && <p className="small err" role="alert">{msg}</p>}
          <ul className="samples">
            {samples.map((s, i) => (
              <li key={i}>
                <img src={s.thumb} alt={`Amostra ${i + 1}`} width="72" height="72" />
                <button type="button" onClick={() => setSamples((a) => a.filter((_, k) => k !== i))} aria-label={`Remover amostra ${i + 1}`}>×</button>
              </li>
            ))}
            {Array.from({ length: Math.max(0, needed - samples.length) }).map((_, i) => <li key={`e${i}`} className="blank" aria-hidden="true" />)}
          </ul>
          {editing && samples.length === 0 && <p className="small muted">Mantendo as {editing.descriptors.length} amostras atuais.</p>}
        </section>

        <div className="actions end form-actions">
          <Link className="btn btn-ghost" to="/usuarios" onClick={cam.stop}>Cancelar</Link>
          <button type="submit" className="btn btn-primary"> {editing ? 'Salvar alterações' : 'Salvar cadastro'}</button>
        </div>
      </form>
    </AdminGate>
  );
}
