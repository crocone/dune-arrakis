import { H, HOUSE_COLORS_CSS } from '../core/constants.js';

// Simple vector emblems for the houses (original designs)
export function emblemSVG(house, size = 64) {
  const c = HOUSE_COLORS_CSS[house] || '#c9a06a';
  const ring = `<circle cx="32" cy="32" r="29" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.9"/>
    <circle cx="32" cy="32" r="24" fill="${c}" opacity="0.14"/>`;
  let body = '';
  switch (house) {
    case H.ATREIDES: // stylized hawk
      body = `<path d="M32 14 L36 26 L52 20 L42 32 L50 36 L36 38 L32 50 L28 38 L14 36 L22 32 L12 20 L28 26 Z" fill="${c}"/>
        <circle cx="32" cy="30" r="3" fill="#0b0806"/>`;
      break;
    case H.HARKONNEN: // stylized ram head
      body = `<path d="M20 22 C10 18 10 36 20 34 C18 30 18 26 22 25 Z M44 22 C54 18 54 36 44 34 C46 30 46 26 42 25 Z" fill="${c}"/>
        <path d="M24 22 L40 22 L38 42 L32 50 L26 42 Z" fill="${c}"/>
        <circle cx="28" cy="30" r="2" fill="#0b0806"/><circle cx="36" cy="30" r="2" fill="#0b0806"/>`;
      break;
    case H.ORDOS: // serpent
      body = `<path d="M40 14 C26 14 22 24 30 30 C38 36 36 46 24 48" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="40" cy="15" r="4.5" fill="${c}"/><circle cx="41" cy="14" r="1.3" fill="#0b0806"/>`;
      break;
    case H.SARDAUKAR:
      body = `<path d="M18 44 L22 20 L28 32 L32 16 L36 32 L42 20 L46 44 Z" fill="${c}"/>`;
      break;
    case H.FREMEN:
      body = `<path d="M16 40 Q32 8 48 40 Q32 30 16 40 Z" fill="${c}"/><circle cx="32" cy="44" r="3" fill="${c}"/>`;
      break;
    default:
      body = `<path d="M22 20 L42 20 L46 32 L32 48 L18 32 Z" fill="${c}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${ring}${body}</svg>`;
}

// ---------------------------------------------------------------------------
// Mentat portraits: hand-drawn vector busts, one per House.
//   Cyril (Atreides): noble and calm, gold-trimmed uniform with a hawk brooch
//   Radnor (Harkonnen): bald and scarred, black spiked armour, red rim light
//   Ammon (Ordos): lean merchant-prince, silver hair, glowing cyber-monocle
// Mentats' lips are stained red by sapho juice, so every face has them.
// ---------------------------------------------------------------------------
const SKIN = {
  cyril: ['#e6b992', '#c58f69', '#6d4636'],
  radnor: ['#dccbbb', '#b19b8b', '#51403c'],
  ammon: ['#dcbea6', '#b8957c', '#5f4538'],
};
const SAPHO = '#a1262f';

function defsFor(id, c, skin, cloth) {
  return `<defs>
    <radialGradient id="bg${id}" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.62"/>
      <stop offset="55%" stop-color="${c}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#0b0806" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sk${id}" cx="38%" cy="34%" r="82%">
      <stop offset="0%" stop-color="${skin[0]}"/><stop offset="55%" stop-color="${skin[1]}"/><stop offset="100%" stop-color="${skin[2]}"/>
    </radialGradient>
    <linearGradient id="nk${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skin[2]}"/><stop offset="60%" stop-color="${skin[1]}"/><stop offset="100%" stop-color="${skin[2]}"/>
    </linearGradient>
    <linearGradient id="sh${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="55%" stop-color="#000" stop-opacity="0.05"/><stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
    </linearGradient>
    <linearGradient id="cl${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${cloth[0]}"/><stop offset="100%" stop-color="${cloth[1]}"/>
    </linearGradient>
    <radialGradient id="vg${id}" cx="50%" cy="46%" r="72%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.65"/>
    </radialGradient>
    <filter id="nz${id}" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/>
    </filter>
  </defs>`;
}

// shared eye: sclera, iris with glow, lids
function eye(cx, cy, iris, w = 10, h = 4.6, tilt = 0, glow = 0.5) {
  return `<g transform="rotate(${tilt} ${cx} ${cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="${w + 3}" ry="${h + 3}" fill="${iris}" opacity="${glow * 0.18}"/>
    <path d="M${cx - w} ${cy} Q${cx} ${cy - h * 1.55} ${cx + w} ${cy} Q${cx} ${cy + h} ${cx - w} ${cy} Z" fill="#e9e1d4"/>
    <circle cx="${cx + 0.6}" cy="${cy - 0.2}" r="${h * 0.95}" fill="${iris}"/>
    <circle cx="${cx + 0.6}" cy="${cy - 0.2}" r="${h * 0.95}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="0.8"/>
    <circle cx="${cx + 0.6}" cy="${cy - 0.2}" r="${h * 0.42}" fill="#05060a"/>
    <circle cx="${cx - 1.2}" cy="${cy - 1.6}" r="1.1" fill="#fff" opacity="0.85"/>
    <path d="M${cx - w} ${cy} Q${cx} ${cy - h * 1.7} ${cx + w} ${cy}" fill="none" stroke="#1a0f0b" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M${cx - w + 1} ${cy + 1} Q${cx} ${cy + h * 0.9} ${cx + w - 1} ${cy + 1}" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="0.9"/>
  </g>`;
}

const range = (n) => Array.from({ length: n }, (_, k) => k);

function cyril(c) {
  const id = 'C';
  const skin = SKIN.cyril;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" width="100%" height="100%">
    ${defsFor(id, c, skin, ['#20303d', '#0d1319'])}
    <rect width="160" height="190" fill="url(#bg${id})"/>
    <path d="M18 190 V70 Q18 24 80 24 Q142 24 142 70 V190" fill="none" stroke="${c}" stroke-opacity="0.22" stroke-width="2"/>
    <path d="M30 190 V76 Q30 38 80 38 Q130 38 130 76 V190" fill="none" stroke="#d9b24e" stroke-opacity="0.16" stroke-width="1.2"/>
    <path d="M4 190 C8 154 36 138 80 136 C124 138 152 154 156 190 Z" fill="url(#cl${id})"/>
    <path d="M40 150 C56 142 70 140 80 140 C90 140 104 142 120 150" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="2"/>
    <path d="M118 146 L152 176 L152 190 L128 190 L100 156 Z" fill="${c}" opacity="0.92"/>
    <path d="M118 146 L152 176" stroke="#d9b24e" stroke-width="1.6" opacity="0.9"/>
    <path d="M30 160 C40 176 48 182 50 190 M34 156 C46 172 56 182 58 190" fill="none" stroke="#d9b24e" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>
    <circle cx="30" cy="160" r="3.6" fill="#d9b24e"/>
    <path d="M62 108 L62 142 C62 150 98 150 98 142 L98 108 Z" fill="url(#nk${id})"/>
    <path d="M62 126 Q80 136 98 126 L98 112 Q80 124 62 112 Z" fill="#000" opacity="0.22"/>
    <path d="M56 138 L66 124 L80 148 L94 124 L104 138 L98 152 L80 160 L62 152 Z" fill="#121a22"/>
    <path d="M56 138 L66 124 L80 148 L94 124 L104 138" fill="none" stroke="#d9b24e" stroke-width="2.4" stroke-linejoin="round"/>
    <g transform="translate(80 164) scale(0.2)"><path d="M0 -50 L10 -22 L50 -38 L36 -2 L17 6 L8 50 L0 30 L-8 50 L-17 6 L-36 -2 L-50 -38 L-10 -22 Z" fill="#d9b24e" stroke="#7a5a1a" stroke-width="4"/></g>
    <ellipse cx="50.5" cy="84" rx="5" ry="9" fill="${skin[1]}"/><ellipse cx="109.5" cy="84" rx="5" ry="9" fill="${skin[2]}"/>
    <path d="M51 80 C49 52 62 38 80 38 C98 38 111 52 109 80 C108 100 98 118 80 124 C62 118 52 100 51 80 Z" fill="url(#sk${id})"/>
    <path d="M51 80 C49 52 62 38 80 38 C98 38 111 52 109 80 C108 100 98 118 80 124 C62 118 52 100 51 80 Z" fill="url(#sh${id})"/>
    <path d="M49 82 C44 46 62 28 82 29 C104 30 116 48 111 82 C110 64 104 54 94 49 C84 45 70 47 62 53 C55 59 51 70 49 82 Z" fill="#2b1f19"/>
    <path d="M54 66 C60 52 72 46 86 46" fill="none" stroke="#4a382d" stroke-width="2" opacity="0.7"/>
    <path d="M62 50 C70 44 84 42 96 46" fill="none" stroke="#4a382d" stroke-width="1.4" opacity="0.6"/>
    <path d="M49 82 C48 70 50 62 54 58 L56 74 Z M111 82 C112 70 110 62 106 58 L104 74 Z" fill="#8a8580" opacity="0.8"/>
    <path d="M56 70 Q66 64 76 69" fill="none" stroke="#2b1f19" stroke-width="3" stroke-linecap="round"/>
    <path d="M84 69 Q94 64 104 70" fill="none" stroke="#2b1f19" stroke-width="3" stroke-linecap="round"/>
    ${eye(66.5, 79, '#4f9be8', 9.5, 4.4, -2)}${eye(93.5, 79, '#4f9be8', 9.5, 4.4, 2)}
    <path d="M80 80 C78 92 76 98 72 102 Q80 107 88 102 C85 98 83 92 82 80" fill="#000" opacity="0.1"/>
    <path d="M78 82 C77 92 75 98 71 101" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="1.4"/>
    <path d="M72 102 Q80 106 88 102" fill="none" stroke="#3a241b" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
    <path d="M56 94 C58 104 64 112 72 116" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="3"/>
    <path d="M60 106 C62 118 70 124 80 124 C90 124 98 118 100 106 C94 112 88 113 80 113 C72 113 66 112 60 106 Z" fill="#2b1f19" opacity="0.2"/>
    <path d="M70 113 Q80 109 90 113 Q80 119 70 113 Z" fill="${SAPHO}"/>
    <path d="M70 113 Q80 116 90 113" fill="none" stroke="#3b0c10" stroke-width="1.2"/>
    <path d="M73 112 Q80 109.5 87 112" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <rect width="160" height="190" fill="url(#vg${id})"/>
    <rect width="160" height="190" filter="url(#nz${id})"/>
  </svg>`;
}

function radnor(c) {
  const id = 'R';
  const skin = SKIN.radnor;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" width="100%" height="100%">
    ${defsFor(id, c, skin, ['#222226', '#0a0a0c'])}
    <rect width="160" height="190" fill="url(#bg${id})"/>
    ${range(6).map((k) => `<path d="M${-10 + k * 34} 0 C${14 + k * 34} 60 ${14 + k * 34} 130 ${-10 + k * 34} 190" fill="none" stroke="${c}" stroke-opacity="0.16" stroke-width="3"/>`).join('')}
    <path d="M0 190 C4 152 34 136 80 134 C126 136 156 152 160 190 Z" fill="url(#cl${id})"/>
    <path d="M6 160 L-2 128 L26 146 Z M154 160 L162 128 L134 146 Z" fill="#17171a" stroke="${c}" stroke-opacity="0.6" stroke-width="1"/>
    <path d="M20 150 L8 122 L32 142 Z M140 150 L152 122 L128 142 Z" fill="#101013"/>
    <path d="M24 160 C40 148 60 144 80 144 C100 144 120 148 136 160" fill="none" stroke="${c}" stroke-width="2.4" opacity="0.85"/>
    <path d="M34 190 L46 160 M126 190 L114 160" stroke="#2a2a30" stroke-width="3"/>
    <path d="M44 150 L38 104 L58 128 L62 150 Z M116 150 L122 104 L102 128 L98 150 Z" fill="#131316" stroke="${c}" stroke-opacity="0.55" stroke-width="1"/>
    <path d="M62 108 L62 142 C62 148 98 148 98 142 L98 108 Z" fill="url(#nk${id})"/>
    <path d="M62 122 Q80 134 98 122 L98 110 Q80 122 62 110 Z" fill="#000" opacity="0.3"/>
    <path d="M60 140 L80 156 L100 140 L96 152 L80 164 L64 152 Z" fill="#101013" stroke="${c}" stroke-opacity="0.7" stroke-width="1.6"/>
    <ellipse cx="47.5" cy="82" rx="5.5" ry="10" fill="${skin[1]}"/><ellipse cx="112.5" cy="82" rx="5.5" ry="10" fill="${skin[2]}"/>
    <path d="M49 78 C45 46 62 30 80 30 C98 30 115 46 111 78 C110 100 100 118 80 126 C60 118 50 100 49 78 Z" fill="url(#sk${id})"/>
    <path d="M49 78 C45 46 62 30 80 30 C98 30 115 46 111 78 C110 100 100 118 80 126 C60 118 50 100 49 78 Z" fill="url(#sh${id})"/>
    <path d="M58 44 C66 36 80 33 94 38" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M52 74 Q66 62 78 71 L78 78 Q66 70 54 80 Z" fill="#000" opacity="0.45"/>
    <path d="M82 71 Q94 62 108 74 L106 80 Q94 70 82 78 Z" fill="#000" opacity="0.4"/>
    <path d="M55 72 Q66 66 77 72" fill="none" stroke="#2a2220" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M83 72 Q94 66 105 72" fill="none" stroke="#2a2220" stroke-width="3.2" stroke-linecap="round"/>
    ${eye(66.5, 80, '#d23a33', 8.6, 3.6, 4, 1)}${eye(93.5, 80, '#d23a33', 8.6, 3.6, -4, 1)}
    <path d="M57 86 L71 108" stroke="#7a3b3b" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M57 86 L71 108" stroke="#d9a9a0" stroke-width="0.8" stroke-linecap="round" opacity="0.8"/>
    ${range(4).map((k) => `<path d="M${56.5 + k * 3.4} ${90 + k * 5.2} l4 -3" stroke="#2a1a1a" stroke-width="1"/>`).join('')}
    <path d="M52 92 C54 104 60 112 68 118" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="4"/>
    <path d="M108 92 C106 104 100 112 92 118" fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="4"/>
    <path d="M80 80 C78 92 77 98 73 103 Q80 108 87 103 C84 98 82 92 82 80" fill="#000" opacity="0.14"/>
    <path d="M73 103 Q80 107 87 103" fill="none" stroke="#2a1a1a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M68 114 Q74 111 80 112.5 Q86 111 92 114 Q86 117 80 116 Q74 117 68 114 Z" fill="${SAPHO}"/>
    <path d="M67 115 Q80 112.5 93 115" fill="none" stroke="#2a0a0c" stroke-width="1.3"/>
    <path d="M92 114 L95 118" stroke="#2a0a0c" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M111 78 C110 100 100 118 80 126" fill="none" stroke="${c}" stroke-width="2" opacity="0.55"/>
    <path d="M111 78 C115 46 98 30 80 30" fill="none" stroke="${c}" stroke-width="1.4" opacity="0.4"/>
    <rect width="160" height="190" fill="url(#vg${id})"/>
    <rect width="160" height="190" filter="url(#nz${id})"/>
  </svg>`;
}

function ammon(c) {
  const id = 'A';
  const skin = SKIN.ammon;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 190" width="100%" height="100%">
    ${defsFor(id, c, skin, ['#17332a', '#08130f'])}
    <rect width="160" height="190" fill="url(#bg${id})"/>
    <circle cx="80" cy="84" r="72" fill="none" stroke="${c}" stroke-opacity="0.2" stroke-width="1.4"/>
    <circle cx="80" cy="84" r="86" fill="none" stroke="#c7d3cf" stroke-opacity="0.1" stroke-width="1" stroke-dasharray="3 6"/>
    <path d="M6 190 C10 154 38 138 80 136 C122 138 150 154 154 190 Z" fill="url(#cl${id})"/>
    <path d="M30 190 C34 168 52 154 80 152 C108 154 126 168 130 190" fill="none" stroke="${c}" stroke-opacity="0.5" stroke-width="2"/>
    <path d="M52 190 L66 160 M108 190 L94 160" stroke="#c7d3cf" stroke-opacity="0.5" stroke-width="1.6"/>
    <path d="M65 108 L65 142 C65 148 95 148 95 142 L95 108 Z" fill="url(#nk${id})"/>
    <path d="M65 122 Q80 132 95 122 L95 110 Q80 120 65 110 Z" fill="#000" opacity="0.25"/>
    <path d="M52 136 L64 122 L80 146 L96 122 L108 136 L100 152 L80 162 L60 152 Z" fill="#0c1d17"/>
    <path d="M52 136 L64 122 L80 146 L96 122 L108 136" fill="none" stroke="#c7d3cf" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M62 150 Q80 176 98 150" fill="none" stroke="#c7d3cf" stroke-width="1.8" stroke-dasharray="2.4 1.8"/>
    <circle cx="80" cy="171" r="7.5" fill="#0c1d17" stroke="#c7d3cf" stroke-width="1.8"/>
    <path d="M83 166 C74 166 74 172 80 173 C86 174 85 179 76 178" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="52.5" cy="84" rx="4.6" ry="9" fill="${skin[1]}"/><ellipse cx="107.5" cy="84" rx="4.6" ry="9" fill="${skin[2]}"/>
    <path d="M53 78 C52 52 64 38 80 38 C96 38 108 52 107 78 C107 100 96 122 80 130 C64 122 53 100 53 78 Z" fill="url(#sk${id})"/>
    <path d="M53 78 C52 52 64 38 80 38 C96 38 108 52 107 78 C107 100 96 122 80 130 C64 122 53 100 53 78 Z" fill="url(#sh${id})"/>
    <path d="M52 76 C48 44 64 28 84 29 C104 30 114 46 108 76 C108 62 102 52 92 47 C80 43 66 46 58 56 C54 62 52 68 52 76 Z" fill="#cdd2d5"/>
    ${range(6).map((k) => `<path d="M${58 + k * 7} 50 C${64 + k * 7} 42 ${74 + k * 7} 40 ${88 + k * 4} 44" fill="none" stroke="#8d969b" stroke-width="1.1" opacity="0.7"/>`).join('')}
    <path d="M60 36 C70 31 86 30 98 34" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="2"/>
    <path d="M57 70 L76 66" fill="none" stroke="#7d8488" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M84 66 L103 70" fill="none" stroke="#7d8488" stroke-width="2.6" stroke-linecap="round"/>
    ${eye(66.5, 78, '#6dff6a', 9.4, 3.5, 5, 0.9)}
    <circle cx="93.5" cy="78" r="16" fill="#6dff6a" opacity="0.1"/>
    <circle cx="93.5" cy="78" r="12" fill="#0a1a14" fill-opacity="0.55" stroke="#c7d3cf" stroke-width="2.2"/>
    <circle cx="93.5" cy="78" r="8.4" fill="${c}" fill-opacity="0.35" stroke="#6dff6a" stroke-width="1.2"/>
    <circle cx="93.5" cy="78" r="3.6" fill="#6dff6a"/>
    <circle cx="92.2" cy="76.6" r="1.1" fill="#fff"/>
    <path d="M93.5 66 L93.5 62 M101.5 69 L104 66 M105.5 78 L110 78" stroke="#c7d3cf" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M105 82 C112 88 112 96 108 104" fill="none" stroke="#c7d3cf" stroke-width="1.2" opacity="0.8"/>
    <path d="M80 80 C78.5 92 77 99 74 104 Q80 108 86 104 C84 99 82 92 81.5 80" fill="#000" opacity="0.11"/>
    <path d="M74 104 Q80 107 86 104" fill="none" stroke="#3a2418" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M57 92 C60 104 66 114 74 122" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="3.4"/>
    <path d="M103 92 C100 104 94 114 86 122" fill="none" stroke="#000" stroke-opacity="0.26" stroke-width="3.4"/>
    <path d="M68 109 Q74 105 80 108 Q86 105 92 109 Q86 109.5 80 111 Q74 109.5 68 109 Z" fill="#9aa1a5"/>
    <path d="M70 114 Q80 109.5 90 114 Q80 118 70 114 Z" fill="${SAPHO}"/>
    <path d="M70 113.4 Q80 117.4 91.5 112.4" fill="none" stroke="#2a0a0c" stroke-width="1.1"/>
    <path d="M74 120 Q80 138 86 120 Q80 124 74 120 Z" fill="#9aa1a5"/>
    <rect width="160" height="190" fill="url(#vg${id})"/>
    <rect width="160" height="190" filter="url(#nz${id})"/>
  </svg>`;
}

export function mentatSVG(house) {
  const c = HOUSE_COLORS_CSS[house] || '#c9a06a';
  if (house === H.HARKONNEN) return radnor(c);
  if (house === H.ORDOS) return ammon(c);
  return cyril(c);
}
