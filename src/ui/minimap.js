import { T, HOUSE_COLORS_CSS } from '../core/constants.js';

const TERRAIN_RGB = {
  [T.SAND]: [205, 150, 92],
  [T.DUNES]: [222, 170, 108],
  [T.ROCK]: [110, 86, 70],
  [T.MOUNTAIN]: [72, 52, 40],
  [T.SPICE]: [196, 98, 44],
  [T.THICK_SPICE]: [150, 58, 22],
  [T.SPICE_BLOOM]: [240, 120, 60],
  [T.SPECIAL_BLOOM]: [240, 120, 60],
  [T.SLAB]: [140, 136, 128],
};

function hexToRgb(css) {
  const n = parseInt(css.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const HOUSE_RGB = HOUSE_COLORS_CSS.map(hexToRgb);

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 256;
    canvas.width = this.size;
    canvas.height = this.size;
    this.terrainCanvas = document.createElement('canvas');
    this.tctx = this.terrainCanvas.getContext('2d');
    this.dirty = true;
    this.frame = 0;
  }

  setMap(map) {
    this.map = map;
    this.terrainCanvas.width = map.width;
    this.terrainCanvas.height = map.height;
    this.img = this.tctx.createImageData(map.width, map.height);
    this.dirty = true;
  }

  // scale & offset for non-square maps
  _layout() {
    const m = this.map;
    const s = this.size / Math.max(m.width, m.height);
    const ox = (this.size - m.width * s) / 2;
    const oy = (this.size - m.height * s) / 2;
    return { s, ox, oy };
  }

  // convert canvas pixel (css coords relative to element) into tile coords
  toTile(px, py, elW, elH) {
    const { s, ox, oy } = this._layout();
    const x = (px / elW) * this.size;
    const y = (py / elH) * this.size;
    return [(x - ox) / s, (y - oy) / s];
  }

  // radarOn: full radar (terrain + enemies); otherwise only own objects on explored tiles
  draw(game, house, viewCorners, radarOn) {
    const m = this.map;
    if (!m) return;
    this.frame++;
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.size, this.size);
    const { s, ox, oy } = this._layout();
    const team = game.teamOf(house);
    const seen = m.seen[team];
    const fogOn = game.settings?.fogOfWar;
    if (radarOn && (this.dirty || this.frame % 15 === 0)) {
      const d = this.img.data;
      for (let i = 0; i < m.width * m.height; i++) {
        const t = m.types[i];
        const c = TERRAIN_RGB[t] || TERRAIN_RGB[T.SAND];
        let k = 1;
        if (seen[i] < 0) k = 0;
        else if (fogOn && game.cycle - seen[i] > 625) k = 0.6;
        d[i * 4] = c[0] * k;
        d[i * 4 + 1] = c[1] * k;
        d[i * 4 + 2] = c[2] * k;
        d[i * 4 + 3] = 255;
      }
      this.tctx.putImageData(this.img, 0, 0);
      this.dirty = false;
    }
    ctx.imageSmoothingEnabled = false;
    if (radarOn) ctx.drawImage(this.terrainCanvas, ox, oy, m.width * s, m.height * s);
    else {
      ctx.fillStyle = '#0b0806';
      ctx.fillRect(ox, oy, m.width * s, m.height * s);
    }

    // structures
    for (const st of game.structures) {
      if (!st.alive) continue;
      if (seen[m.idx(st.x, st.y)] < 0) continue;
      if (!radarOn && st.team !== team) continue;
      const c = HOUSE_RGB[st.owner];
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(ox + st.x * s, oy + st.y * s, st.w * s, st.h * s);
    }
    // units
    for (const u of game.units) {
      if (!u.alive || u.hidden) continue;
      const tx = Math.floor(u.px);
      const ty = Math.floor(u.py);
      if (!m.inBounds(tx, ty)) continue;
      if (u.team !== team) {
        if (!radarOn) continue;
        if (!game.isTileVisibleToTeam(team, tx, ty)) continue;
        if (u.cloaked && !u.isVisibleTo(team)) continue;
      }
      if (u.type === 'sandworm') {
        ctx.fillStyle = '#f4e3c3';
      } else {
        const c = HOUSE_RGB[u.owner];
        ctx.fillStyle = `rgb(${Math.min(255, c[0] + 40)},${Math.min(255, c[1] + 40)},${Math.min(255, c[2] + 40)})`;
      }
      const r = Math.max(2, s * 0.9);
      ctx.fillRect(ox + u.px * s - r / 2, oy + u.py * s - r / 2, r, r);
    }
    // camera frustum
    if (viewCorners) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      viewCorners.forEach(([x, z], i) => {
        const px = ox + x * s;
        const py = oy + z * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
    }
    // pings
    if (game.pings) {
      const now = performance.now();
      for (const p of game.pings) {
        const age = (now - p.t) / 1000;
        if (age > 3) continue;
        const r = 4 + (age % 1) * 14;
        ctx.strokeStyle = `rgba(255,80,60,${1 - (age % 1)})`;
        ctx.beginPath();
        ctx.arc(ox + p.x * s, oy + p.y * s, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
