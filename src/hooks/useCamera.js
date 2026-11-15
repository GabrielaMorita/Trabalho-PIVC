import { useCallback, useEffect, useRef, useState } from 'react';

function explain(err) {
  if (!navigator.mediaDevices?.getUserMedia)
    return 'Este navegador bloqueou a câmera. Abra o sistema por https ou por localhost.';
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permissão da câmera negada. Libere o acesso no ícone de cadeado da barra de endereço e tente de novo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada. Conecte uma webcam ou escolha outro dispositivo em Configurações.';
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente de novo.';
    default:
      return `Não foi possível abrir a câmera (${err?.name || 'erro desconhecido'}).`;
  }
}

export function useCamera(deviceId = '') {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }) },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setActive(true);
      navigator.mediaDevices.enumerateDevices().then((l) => setDevices(l.filter((d) => d.kind === 'videoinput'))).catch(() => {});
      return true;
    } catch (e) {
      setError(explain(e));
      setActive(false);
      return false;
    }
  }, [deviceId, stop]);

  useEffect(() => stop, [stop]);
  return { videoRef, active, error, devices, start, stop, setError };
}
