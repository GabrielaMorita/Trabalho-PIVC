import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext.jsx';
import { useCamera } from '../hooks/useCamera.js';
import { useEngine } from '../hooks/useEngine.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { detectFaces, identify } from '../lib/faceEngine.js';
import { createChallenge, updateChallenge } from '../lib/liveness.js';
import { canAccess, targetLabel } from '../lib/access.js';
import { DIVISIONS, LEVELS } from '../lib/constants.js';
import { cropToDataUrl } from '../lib/imageProc.js';
import { db } from '../lib/storage.js';
import LevelBadge from '../components/LevelBadge.jsx';
import Viewport from '../components/Viewport.jsx';
import Dial from '../components/Dial.jsx';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP_TIMEOUT = 20000;

export default function Acesso() {
  const { users, settings, session, startSession, addLog } = useApp();
  const engine = useEngine();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const cam = useCamera(settings.cameraId);
  const overlayRef = useRef(null);
  const probeRef = useRef(null);
  const token = useRef(null);

  const [targetLevel, setTargetLevel] = useState(() => [1, 2, 3].includes(Number(params.get('alvo'))) ? Number(params.get('alvo')) : 1);
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [phase, setPhase] = useState('idle'); // idle | starting | running | granted | denied
  const [step, setStep] = useState('idle'); // liveness | match
  const [status, setStatus] = useState({ text: 'Pronto para começar.', tone: 'idle' });
  const [challenge, setChallenge] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [lock, setLock] = useState(() => db.loadLock());

  const lockedUntil = lock.until > Date.now() ? lock.until : 0;
  const lockCount = useCountdown(lockedUntil);
  const locked = lockedUntil > 0 && lockCount.seconds > 0;

  useEffect(() => () => { if (token.current) token.current.active = false; }, []);
  useEffect(() => {
    if (phase !== 'granted') return undefined;
    const t = setTimeout(() => nav('/painel'), 1600);
    return () => clearTimeout(t);
  }, [phase, nav]);

  const target = { level: targetLevel, division: targetLevel === 2 ? division : null };

  const draw = useCallback((v, faces, tone) => {
    const c = overlayRef.current;
    if (!c || !v.videoWidth) return;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const col = { ok: '#6fd08c', warn: '#f0b429', idle: '#e9ece4', bad: '#ff6b57' }[tone] || '#e9ece4';
    faces.forEach((f) => {
      const { x, y, width: w, height: h } = f.box;
      const L = Math.min(w, h) * 0.22;
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, c.width / 240); ctx.lineCap = 'round';
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(px, py + dy * L); ctx.lineTo(px, py); ctx.lineTo(px + dx * L, py); ctx.stroke();
      });
      ctx.fillStyle = col;
      f.points.forEach((p) => { ctx.globalAlpha = 0.55; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); });
      ctx.globalAlpha = 1;
    });
  }, []);

  const luminance = useCallback((v) => {
    let c = probeRef.current;
    if (!c) c = probeRef.current = document.createElement('canvas');
    c.width = 48; c.height = 36;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0, 48, 36);
    const d = ctx.getImageData(0, 0, 48, 36).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    return s / (d.length / 4);
  }, []);

  const finish = useCallback((tk, user, dist, v, box, reason) => {
    tk.active = false;
    const perm = user ? canAccess(user, target) : { ok: false, reason: reason || 'Rosto não reconhecido' };
    const snapshot = !perm.ok && box && v ? cropToDataUrl(v, box, 120, 0.4, 0.6) : null;
    const base = {
      userId: user?.id || null, userName: user?.name || 'Desconhecido', level: user?.level || null,
      target, distance: dist != null ? Math.round(dist * 1000) / 1000 : null, liveness: settings.requireLiveness,
    };
    if (perm.ok) {
      startSession(user, target);
      addLog({ ...base, result: 'granted', reason: 'Acesso concedido', snapshot: null });
      const next = { until: 0, fails: 0 };
      db.saveLock(next); setLock(next);
      setResult({ ok: true, user, dist, text: 'Acesso concedido' });
      setStatus({ text: 'Identidade confirmada.', tone: 'ok' });
      setPhase('granted');
    } else {
      const fails = (lock.fails || 0) + 1;
      const lk = fails >= settings.maxAttempts
        ? { until: Date.now() + settings.lockSeconds * 1000, fails: 0 }
        : { until: 0, fails };
      db.saveLock(lk); setLock(lk);
      addLog({ ...base, result: 'denied', reason: perm.reason, snapshot });
      setResult({ ok: false, user, dist, text: 'Acesso negado', reason: perm.reason, lockedNow: lk.until > 0, left: settings.maxAttempts - fails });
      setPhase('denied');
      setStatus({ text: 'Verificação encerrada sem autorização.', tone: 'bad' });
    }
    cam.stop();
    const oc = overlayRef.current;
    if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.level, target.division, settings, lock, startSession, addLog]);

  const tick = useCallback((tk, faces, v) => {
    const now = performance.now();
    if (now - tk.stepAt > STEP_TIMEOUT) {
      const why = tk.step === 'liveness' ? 'Prova de vida não concluída a tempo' : 'Tempo esgotado sem confirmar a identidade';
      const box = faces[0]?.box;
      finish(tk, null, null, v, box, why);
      return;
    }
    if (faces.length === 0) {
      tk.streak = 0; draw(v, faces, 'idle');
      setStatus({ text: 'Procurando um rosto. Fique de frente para a câmera.', tone: 'idle' });
      return;
    }
    if (faces.length > 1) {
      tk.streak = 0; draw(v, faces, 'bad');
      setStatus({ text: `${faces.length} rostos no quadro. Só uma pessoa por vez.`, tone: 'bad' });
      return;
    }
    const f = faces[0];
    if (f.box.width / v.videoWidth < settings.minFaceRatio) {
      tk.streak = 0; draw(v, faces, 'warn');
      setStatus({ text: 'Aproxime-se da câmera.', tone: 'warn' });
      return;
    }
    if (tk.frames++ % 4 === 0) {
      const l = luminance(v);
      tk.light = l < 45 ? 'dark' : l > 225 ? 'bright' : 'ok';
    }
    if (tk.light !== 'ok') {
      draw(v, faces, 'warn');
      setStatus({ text: tk.light === 'dark' ? 'Pouca luz. Acenda uma luz virada para o rosto.' : 'Luz forte demais. Evite janelas atrás de você.', tone: 'warn' });
      return;
    }
    if (tk.step === 'liveness') {
      draw(v, faces, 'idle');
      const ch = updateChallenge(tk.challenge, f.points);
      setChallenge({ ...ch });
      setProgress(ch.progress || 0);
      if (ch.done) {
        tk.step = 'match'; tk.stepAt = performance.now(); setStep('match');
        setStatus({ text: 'Prova de vida concluída. Reconhecendo o rosto…', tone: 'ok' });
      } else setStatus({ text: ch.text + '.', tone: 'idle' });
      return;
    }
    // reconhecimento
    if (!f.descriptor) return;
    const ranking = identify(f.descriptor, users);
    const best = ranking[0];
    tk.lastBox = f.box;
    if (best.distance <= settings.threshold) {
      tk.unknown = 0;
      if (tk.candidate === best.user.id) tk.streak++; else { tk.candidate = best.user.id; tk.streak = 1; }
      draw(v, faces, 'ok');
      setProgress(Math.min(1, tk.streak / settings.consecutive));
      setStatus({ text: `Confirmando identidade (${tk.streak}/${settings.consecutive})…`, tone: 'ok' });
      if (tk.streak >= settings.consecutive) finish(tk, best.user, best.distance, v, f.box);
    } else {
      tk.streak = 0; tk.candidate = null; tk.unknown++;
      draw(v, faces, 'warn');
      setStatus({ text: 'Comparando com os rostos cadastrados…', tone: 'warn' });
      if (tk.unknown >= 4) finish(tk, null, best.distance, v, f.box, 'Rosto não reconhecido');
    }
  }, [draw, finish, luminance, settings, users]);

  const loop = useCallback(async (tk) => {
    while (tk.active) {
      const v = cam.videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) { await sleep(80); continue; }
      let faces;
      try {
        faces = await detectFaces(v, { inputSize: settings.inputSize, descriptors: tk.step === 'match' });
      } catch (e) {
        tk.active = false; cam.stop(); setPhase('idle');
        setStatus({ text: `Erro no reconhecimento: ${e.message}`, tone: 'bad' });
        return;
      }
      if (!tk.active) return;
      tick(tk, faces, v);
      await sleep(8);
    }
  }, [cam, settings.inputSize, tick]);

  // mantém o loop usando a versão mais recente de tick sem reiniciá-lo
  const loopRef = useRef(loop);
  loopRef.current = loop;

  async function start() {
    if (locked || !engine.ready || users.length === 0) return;
    setResult(null); setChallenge(null); setProgress(0);
    setPhase('starting');
    setStatus({ text: 'Abrindo a câmera…', tone: 'idle' });
    const ok = await cam.start();
    if (!ok) { setPhase('idle'); setStatus({ text: 'Câmera indisponível.', tone: 'bad' }); return; }
    const first = settings.requireLiveness ? 'liveness' : 'match';
    const tk = {
      active: true, step: first, stepAt: performance.now(), streak: 0, candidate: null, unknown: 0,
      frames: 0, light: 'ok', challenge: createChallenge(),
    };
    token.current = tk;
    setStep(first);
    if (first === 'liveness') setChallenge({ ...tk.challenge });
    setPhase('running');
    setStatus({ text: 'Procurando um rosto. Fique de frente para a câmera.', tone: 'idle' });
    loopRef.current(tk);
  }

  function cancel() {
    if (token.current) token.current.active = false;
    cam.stop(); setPhase('idle'); setProgress(0);
    setStatus({ text: 'Verificação cancelada.', tone: 'idle' });
  }

  const running = phase === 'running' || phase === 'starting';
  const dialState = phase === 'granted' ? 'granted' : phase === 'denied' ? 'denied' : running ? 'scan' : 'idle';
  const viewTone = status.tone === 'bad' ? 'bad' : status.tone === 'ok' ? 'ok' : 'idle';

  const steps = [
    { key: 'liveness', label: 'Prova de vida', done: step === 'match' || phase === 'granted' || phase === 'denied' && result?.user, off: !settings.requireLiveness },
    { key: 'match', label: 'Reconhecimento do rosto', done: phase === 'granted' || (phase === 'denied' && !!result?.user) },
    { key: 'perm', label: 'Permissão do compartimento', done: phase === 'granted', fail: phase === 'denied' && !!result?.user },
  ];

  return (
    <>
      <header className="page-head">
        <h1>Acesso ao cofre</h1>
        <p>Escolha o compartimento, fique de frente para a câmera e conclua a verificação. O sistema decidirá em segundos.</p>
      </header>

      {session && phase !== 'granted' && (
        <div className="banner banner-ok" role="status">
          
          <div>Você já está autenticado como <strong>{session.name}</strong> ({targetLabel(session.target)}). <Link to="/painel">Ir para o painel</Link></div>
        </div>
      )}
      {engine.error && <div className="banner banner-err" role="alert"><div>{engine.error}</div></div>}
      {cam.error && <div className="banner banner-err" role="alert"><div>{cam.error}</div></div>}
      {locked && (
        <div className="banner banner-err" role="alert">
          
          <div><strong>Terminal bloqueado por {settings.maxAttempts} tentativas negadas.</strong> Tente de novo em {lockCount.label}. A tentativa foi registrada com foto.</div>
        </div>
      )}

      {users.length === 0 ? (
        <div className="empty">
          
          <h2>Nenhum rosto cadastrado</h2>
          <p>Cadastre primeiro o ministro (Nível 3). Depois disso, o cofre passa a reconhecer as pessoas autorizadas.</p>
          <Link className="btn btn-primary" to="/cadastro">Cadastrar o primeiro rosto</Link>
        </div>
      ) : (
        <div className="access-grid">
          <section className="access-main">
            <fieldset className="targets" disabled={running}>
              <legend>Qual compartimento você quer abrir?</legend>
              <div className="target-row">
                {[1, 2, 3].map((l) => (
                  <label key={l} className={`target t${l} ${targetLevel === l ? 'on' : ''}`}>
                    <input type="radio" name="alvo" checked={targetLevel === l} onChange={() => setTargetLevel(l)} />
                    <LevelBadge level={l} />
                    <b>{LEVELS[l].title}</b>
                    <small>{LEVELS[l].who}</small>
                  </label>
                ))}
              </div>
              {targetLevel === 2 && (
                <label className="field inline">
                  <span>Divisão</span>
                  <select value={division} onChange={(e) => setDivision(e.target.value)}>
                    {DIVISIONS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
              )}
            </fieldset>

            <Viewport videoRef={cam.videoRef} overlayRef={overlayRef} active={cam.active} tone={viewTone}
              hint={phase === 'starting' ? 'Abrindo a câmera…' : 'Câmera desligada. Inicie a verificação.'}>
              {running && step === 'liveness' && challenge && (
                <div className="challenge" aria-live="assertive">{challenge.text}</div>
              )}
              {running && <div className="meter" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${progress * 100}%` }} /></div>}
            </Viewport>

            <div className="actions">
              {running ? (
                <button className="btn btn-ghost" onClick={cancel}>Cancelar</button>
              ) : (
                <button className="btn btn-primary" onClick={start} disabled={!engine.ready || locked}>
                   {engine.ready ? (phase === 'denied' ? 'Tentar de novo' : 'Iniciar verificação') : 'Carregando modelos…'}
                </button>
              )}
              <span className="alvo"><i className={`dot d${targetLevel}`} aria-hidden="true" />Alvo: {targetLabel(target)}</span>
            </div>
          </section>

          <aside className="access-side">
            <div className="dial-wrap">
              <Dial target={targetLevel} state={dialState} scan={progress} />
            </div>
            <p className={`status status-${status.tone}`} role="status" aria-live="polite">{status.text}</p>

            <ol className="steps">
              {steps.map((s) => (
                <li key={s.key} className={`${s.done ? 'done' : ''} ${s.fail ? 'fail' : ''} ${s.off ? 'off' : ''} ${running && step === s.key ? 'now' : ''}`}>
                  <span className="mark">{s.done ? '✓' : s.fail ? '✕' : null}</span>
                  
                  {s.label}{s.off ? ' (desativada)' : ''}
                </li>
              ))}
            </ol>

            {result && (
              <div className={`result ${result.ok ? 'ok' : 'no'}`} role="alert">
                <h2>{result.text}</h2>
                {result.ok ? (
                  <>
                    <p><b>{result.user.name}</b><br />{result.user.role}{result.user.division ? ` · ${result.user.division}` : ''}</p>
                    <p className="small">Distância facial {result.dist.toFixed(3)} (limite {settings.threshold}). Sessão de {settings.sessionSeconds}s.</p>
                    <button className="btn btn-primary" onClick={() => nav('/painel')}>Continuar para o painel</button>
                  </>
                ) : (
                  <>
                    <p>{result.user ? <><b>{result.user.name}</b> foi reconhecido, mas: </> : ''}{result.reason}.</p>
                    <p className="small">
                      {result.lockedNow ? 'Terminal bloqueado temporariamente.' : `Restam ${result.left} tentativa(s) antes do bloqueio.`} Tentativa registrada.
                    </p>
                  </>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
