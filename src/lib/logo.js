import svgUrl from '../assets/logo.png';

const png = import.meta.glob('../assets/logo.png', { eager: true, query: '?url', import: 'default' });
export const logoUrl = Object.values(png)[0] || svgUrl;
