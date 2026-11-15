import { logoUrl } from '../lib/logo.js';

/** Logo do Cofre Facial: imagem src/assets/logo.png (ou logo.svg, se não houver PNG). */
export default function Logo({ size = 40, title = 'Cofre Facial' }) {
  return <img src={logoUrl} alt={title} width={size} height={Math.round(size * 1.125)} className="logo" draggable="false" />;
}
