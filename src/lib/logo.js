// Usa src/assets/logo.png quando o arquivo existir; senão, o logo.svg que acompanha o projeto.
import svgUrl from '../assets/logo.svg';

const png = import.meta.glob('../assets/logo.png', { eager: true, query: '?url', import: 'default' });
export const logoUrl = Object.values(png)[0] || svgUrl;
