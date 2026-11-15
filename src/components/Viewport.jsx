import { forwardRef } from 'react';

/** Área de vídeo com camada de desenho (caixa do rosto, pontos). Espelhada para o usuário. */
const Viewport = forwardRef(function Viewport({ videoRef, overlayRef, active, hint, tone = 'idle', children }, _ref) {
  return (
    <div className={`viewport tone-${tone}`}>
      <video ref={videoRef} playsInline muted className={active ? 'on' : ''} />
      <canvas ref={overlayRef} className="overlay" />
      {!active && (
        <div className="viewport-empty">
          
          <p>{hint || 'Câmera desligada'}</p>
        </div>
      )}
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      {children}
    </div>
  );
});
export default Viewport;
