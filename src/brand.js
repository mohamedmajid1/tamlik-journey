// Brand pieces shared by every scene: the Tamlik logo (the same artwork as the tower film), colours, and the
// Tabler icon set (MIT, assets/icons) as inline SVG.

export const C = {
  ink: '#08090b', paper: '#f2ede4', green: '#01A652', greenText: '#3fd186', grey: '#595A5C',
  amber: '#f5a524', cyan: '#3ad7ff', walnut: '#b98a5e', brass: '#d9b779',
};

export const LOGO_VIEWBOX = '0 0 1390 394';
export const ROOF_LEFT = 'M 0.00 160.50 L 248.50 1.00 L 247.00 47.50 L 0.00 169.50 Z';
export const ROOF_RIGHT = 'M 515.00 156.50 L 504.00 156.50 L 258.00 46.50 L 256.50 1.00 L 515.00 156.50 Z';
export const WORDMARK = 'M 1318.00 392.50 L 1254.00 392.50 L 1208.00 298.50 L 1179.00 392.50 L 1108.50 392.00 L 1179.00 162.50 L 1246.50 163.00 L 1228.00 236.50 L 1315.00 159.50 L 1379.50 160.00 L 1257.50 267.00 L 1318.00 392.50 Z M 167.00 392.50 L 94.50 392.00 L 151.50 217.00 L 121.00 214.50 L 98.00 218.50 L 75.00 227.50 L 53.00 242.50 L 60.50 223.00 L 88.00 189.50 L 104.00 178.50 L 132.00 166.50 L 151.00 162.50 L 299.00 162.50 L 279.00 217.50 L 218.50 219.00 L 167.00 392.50 Z M 456.00 392.50 L 393.00 392.50 L 392.00 342.50 L 317.00 342.50 L 293.00 389.50 L 220.50 389.00 L 330.50 211.00 L 361.00 176.50 L 383.00 163.50 L 456.50 163.00 L 456.00 392.50 Z M 753.00 392.50 L 681.50 392.00 L 726.50 245.00 L 641.00 336.50 L 627.00 343.50 L 617.50 334.00 L 601.00 238.50 L 552.50 391.00 L 480.50 392.00 L 550.00 162.50 L 623.00 162.50 L 644.00 168.50 L 657.50 185.00 L 668.00 235.50 L 681.50 225.00 L 724.00 178.50 L 748.00 163.50 L 820.50 164.00 L 753.00 392.50 Z M 878.00 392.50 L 835.00 387.50 L 812.00 374.50 L 799.50 355.00 L 798.50 326.00 L 845.50 163.00 L 917.00 162.50 L 878.50 287.00 L 874.50 305.00 L 875.50 325.00 L 883.00 334.50 L 892.00 337.50 L 989.50 334.00 L 975.00 387.50 L 878.00 392.50 Z M 1063.00 392.50 L 992.00 392.50 L 991.50 390.00 L 1063.50 164.00 L 1134.00 162.50 L 1063.00 392.50 Z M 396.50 302.00 L 396.00 219.50 L 345.50 302.00 L 396.50 302.00 Z';

export const logoSVG = (cls = 'logo') => `<svg class="${cls}" viewBox="${LOGO_VIEWBOX}" aria-label="Tamlik">
  <path class="roof-left" d="${ROOF_LEFT}" fill="${C.grey}"/><path class="roof-right" d="${ROOF_RIGHT}" fill="${C.green}"/>
  <path class="wordmark" d="${WORDMARK}" fill="${C.green}"/></svg>`;

// icons: loaded once, then placed as <g> centred on (x, y) at the given size
const ICONS = ['tool', 'bolt', 'droplet', 'propeller', 'clock-24', 'hammer', 'paint', 'brand-instagram', 'brand-tiktok',
  'brand-linkedin', 'brand-facebook', 'heart', 'device-laptop', 'device-desktop', 'world-www', 'speakerphone', 'chart-line',
  'player-play', 'device-mobile', 'bulb', 'sofa', 'lamp', 'armchair', 'plant', 'ruler-measure', 'thumb-up',
  'message-circle', 'bell'];
const icons = {};
await Promise.all(ICONS.map(async (n) => {
  const t = await (await fetch(`assets/icons/${n}.svg`)).text();
  icons[n] = t.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<path stroke="none"[^>]*\/>/, '');
}));
export function icon(name, x, y, size = 48, { color = 'currentColor', width = 1.6, cls = '' } = {}) {
  const s = size / 24;
  return `<g class="icon ${cls}" transform="translate(${x - size / 2} ${y - size / 2}) scale(${s})" fill="none" stroke="${color}"
    stroke-width="${(width * 24 / size).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</g>`;
}

// the closing caption (same details as the tower film)
export const captionHTML = () => `<div class="caption">
  <div class="site">tamlikoman.com</div>
  <div class="row">
    <span>${iconInline('brand-instagram')}@tamlikoman</span>
    <span>${iconInline('brand-linkedin')}${iconInline('brand-facebook')}Tamlik Properties</span>
    <span>+968 9215 5559</span>
  </div></div>`;
export const iconInline = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[n] || ''}</svg>`;
