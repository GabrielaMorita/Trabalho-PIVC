import { useRef } from 'react';
import { useApp } from '../AppContext.jsx';
import { useEngine } from '../hooks/useEngine.js';
import { useCamera } from '../hooks/useCamera.js';
import AdminGate from '../components/AdminGate.jsx';
import { DEFAULT_SETTINGS } from '../lib/constants.js';
import { downloadText } from '../lib/csv.js';

function Range({ label, hint, value, min, max, step, onChange, fmt = (v) => v }) {
  return (
    <label className="field range">
      <span>{label} <b>{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small>{hint}</small>
    </label>
  );
}

export default function Configuracoes() {
  const { settings, saveSettings, users, logs, importData, resetAll, notify } = useApp();
  const engine = useEngine();
  const cam = useCamera(settings.cameraId);
  const fileRef = useRef(null);

  async function listCameras() {
    const ok = await cam.start();
    if (ok) cam.stop();
  }

  function exportBackup() {
    downloadText(`backup-cofre-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), users, logs, settings }), 'application/json');
    notify('Backup exportado. Ele contém os dados faciais: guarde com cuidado.');
  }
  async function onImport(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      await importData(JSON.parse(await f.text()));
      notify('Backup importado.');
    } catch (err) {
      notify(err.message || 'Não foi possível ler o arquivo de backup.', 'err');
    }
  }

  return (
    <AdminGate title="Configurações">
      <header className="page-head"><h1>Configurações</h1><p>Ajustes do reconhecimento, da sessão e dos dados. As mudanças valem na próxima verificação.</p></header>

      <div className="cfg-grid">
        <section className="panel">
          <h2>Reconhecimento</h2>
          <Range label="Limite de distância facial" value={settings.threshold} min={0.35} max={0.65} step={0.01}
            onChange={(v) => saveSettings({ threshold: v })}
            hint="Menor é mais rígido: rejeita mais impostores, mas pode negar quem é autorizado. 0,50 é um bom equilíbrio." />
          <Range label="Quadros consecutivos para confirmar" value={settings.consecutive} min={1} max={8} step={1}
            onChange={(v) => saveSettings({ consecutive: v })} hint="Quantos quadros seguidos precisam apontar a mesma pessoa." />
          <Range label="Rosto mínimo no quadro" value={settings.minFaceRatio} min={0.1} max={0.4} step={0.01}
            fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => saveSettings({ minFaceRatio: v })}
            hint="Largura mínima do rosto em relação ao vídeo. Evita reconhecer alguém ao fundo." />
          <label className="field">
            <span>Resolução do detector</span>
            <select value={settings.inputSize} onChange={(e) => saveSettings({ inputSize: Number(e.target.value) })}>
              <option value={224}>224 px · mais rápido</option>
              <option value={320}>320 px · equilibrado</option>
              <option value={416}>416 px · mais preciso</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.requireLiveness} onChange={(e) => saveSettings({ requireLiveness: e.target.checked })} />
            <span><b>Exigir prova de vida</b><small>Pedir para virar o rosto para o lado sorteado. Dificulta o uso de uma foto parada, mas não vence um vídeo gravado.</small></span>
          </label>
        </section>

        <section className="panel">
          <h2>Sessão e bloqueio</h2>
          <Range label="Duração da sessão" value={settings.sessionSeconds} min={30} max={600} step={30} fmt={(v) => `${v}s`}
            onChange={(v) => saveSettings({ sessionSeconds: v })} hint="Depois desse tempo o cofre tranca sozinho." />
          <Range label="Tentativas negadas até bloquear" value={settings.maxAttempts} min={1} max={10} step={1}
            onChange={(v) => saveSettings({ maxAttempts: v })} hint="O contador é guardado no navegador e sobrevive ao recarregar a página." />
          <Range label="Tempo de bloqueio" value={settings.lockSeconds} min={10} max={300} step={10} fmt={(v) => `${v}s`}
            onChange={(v) => saveSettings({ lockSeconds: v })} hint="Quanto o terminal fica parado depois de atingir o limite." />
        </section>

        <section className="panel">
          <h2>Câmera e modelos</h2>
          <label className="field">
            <span>Dispositivo de vídeo</span>
            <select value={settings.cameraId} onChange={(e) => saveSettings({ cameraId: e.target.value })}>
              <option value="">Câmera padrão</option>
              {cam.devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Câmera ${i + 1}`}</option>)}
            </select>
          </label>
          <button className="btn btn-ghost" onClick={listCameras}> Detectar câmeras</button>
          {cam.error && <p className="err small">{cam.error}</p>}
          <dl className="kv">
            <dt>Modelos de IA</dt><dd>{engine.error ? <span className="err">{engine.error}</span> : engine.ready ? 'Carregados' : 'Carregando…'}</dd>
            <dt>Processamento</dt><dd>{engine.backend ? (engine.backend === 'webgl' ? 'GPU (WebGL)' : 'CPU') : '–'}</dd>
            <dt>Detector</dt><dd>Tiny Face Detector</dd>
            <dt>Pontos faciais</dt><dd>68 landmarks</dd>
            <dt>Descritor</dt><dd>128 dimensões (ResNet)</dd>
          </dl>
        </section>

        <section className="panel">
          <h2>Dados</h2>
          <p className="small muted">Tudo fica neste navegador. {users.length} pessoas e {logs.length} registros guardados.</p>
          <div className="actions wrap">
            <button className="btn btn-ghost" onClick={exportBackup}> Exportar backup</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}> Importar backup</button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImport} />
            <button className="btn btn-ghost" onClick={() => saveSettings({ ...DEFAULT_SETTINGS, cameraId: settings.cameraId })}>Restaurar padrões</button>
          </div>
          <div className="danger-zone">
            <b>Apagar tudo</b>
            <p className="small">Remove pessoas, registros e ajustes. O sistema volta à configuração inicial.</p>
            <button className="btn btn-danger" onClick={async () => { if (window.confirm('Apagar todos os dados do cofre? Isso apaga também o banco no Firebase e não pode ser desfeito.')) { try { await resetAll(); notify('Todos os dados foram apagados.'); } catch { notify('Não foi possível apagar os dados no Firebase.', 'err'); } } }}>Apagar tudo</button>
          </div>
        </section>
      </div>
    </AdminGate>
  );
}
