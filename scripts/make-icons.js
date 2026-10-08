// Renders the app icons/splash from the same Shiba drawing as src/components/Shiba.tsx, using headless Chrome.
// Usage: node scripts/make-icons.js   (re-run after changing the mascot)
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const O = '#E8A35A', C = '#FFF4E6', D = '#2B2B2B', P = '#F28B82';

const face = `
  <path d="M16 46 L22 8 L46 28 Z" fill="${O}"/><path d="M84 46 L78 8 L54 28 Z" fill="${O}"/>
  <path d="M24 36 L26 16 L39 28 Z" fill="${C}"/><path d="M76 36 L74 16 L61 28 Z" fill="${C}"/>
  <ellipse cx="50" cy="57" rx="38" ry="33" fill="${O}"/><ellipse cx="50" cy="72" rx="27" ry="17" fill="${C}"/>
  <circle cx="37" cy="43" r="3" fill="${C}"/><circle cx="63" cy="43" r="3" fill="${C}"/>
  <circle cx="38" cy="54" r="4.5" fill="${D}"/><circle cx="62" cy="54" r="4.5" fill="${D}"/>
  <ellipse cx="30" cy="65" rx="5" ry="3" fill="${P}" opacity="0.6"/><ellipse cx="70" cy="65" rx="5" ry="3" fill="${P}" opacity="0.6"/>
  <ellipse cx="50" cy="64" rx="4.5" ry="3.2" fill="${D}"/>
  <path d="M44 69 Q47 73 50 68 Q53 73 56 69" stroke="${D}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
const silhouette = `
  <path d="M16 46 L22 8 L46 28 Z" fill="#fff"/><path d="M84 46 L78 8 L54 28 Z" fill="#fff"/>
  <ellipse cx="50" cy="57" rx="38" ry="33" fill="#fff"/>`;

// scale = fraction of the canvas the 100x100 drawing occupies (adaptive icons need the art inside the middle ~60%).
const svg = (size, inner, scale, bg) => {
  const s = (size * scale) / 100, off = (size - size * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
    <g transform="translate(${off} ${off + size * 0.01}) scale(${s})">${inner}</g></svg>`;
};

const out = {
  'icon.png': svg(1024, face, 0.8, C),
  'android-icon-foreground.png': svg(512, face, 0.56, null),
  'android-icon-background.png': svg(512, '', 1, C),
  'android-icon-monochrome.png': svg(432, silhouette, 0.56, null),
  'splash-icon.png': svg(1024, face, 0.9, null),
  'favicon.png': svg(48, face, 0.95, null),
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shiba-icons-'));
for (const [name, content] of Object.entries(out)) {
  const size = Number(content.match(/width="(\d+)"/)[1]);
  const html = path.join(tmp, name + '.html');
  fs.writeFileSync(html, `<html><body style="margin:0;background:transparent">${content}</body></html>`);
  const png = path.resolve(__dirname, '..', 'assets', name);
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${size},${size}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  console.log('wrote', name, size + 'px');
}
fs.rmSync(tmp, { recursive: true, force: true });
