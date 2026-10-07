// A* path search on the tile grid with 8-neighbourhood.
// If the destination is unreachable the path leads to the explored node closest to it.

const SQRT2 = Math.SQRT2;
const NB = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

class Heap {
  constructor() {
    this.items = [];
    this.prio = [];
  }
  get size() { return this.items.length; }
  push(item, p) {
    const it = this.items;
    const pr = this.prio;
    it.push(item);
    pr.push(p);
    let i = it.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      it[i] = it[parent];
      pr[i] = pr[parent];
      i = parent;
    }
    it[i] = item;
    pr[i] = p;
  }
  pop() {
    const it = this.items;
    const pr = this.prio;
    const top = it[0];
    const lastI = it.pop();
    const lastP = pr.pop();
    if (it.length > 0) {
      let i = 0;
      const n = it.length;
      while (true) {
        let l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        if (r < n && pr[r] < pr[l]) l = r;
        if (pr[l] >= lastP) break;
        it[i] = it[l];
        pr[i] = pr[l];
        i = l;
      }
      it[i] = lastI;
      pr[i] = lastP;
    }
    return top;
  }
}

export class PathFinder {
  constructor(width, height) {
    this.w = width;
    this.h = height;
    const n = width * height;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.cur = 1;
  }

  // canPass(x, y, fromX, fromY) -> bool ; cost(x,y) -> extra multiplier (>=1)
  // returns array of [x,y] excluding start, or [] if no progress possible
  find(sx, sy, tx, ty, canPass, opts = {}) {
    const w = this.w;
    const h = this.h;
    const maxNodes = opts.maxNodes ?? 6000;
    const cost = opts.cost;
    const stopDist = opts.stopDist ?? 0;
    this.cur++;
    if (this.cur > 0xfffffff0) {
      this.stamp.fill(0);
      this.closed.fill(0);
      this.cur = 1;
    }
    const cur = this.cur;
    const start = sy * w + sx;
    const heur = (x, y) => {
      const dx = Math.abs(x - tx);
      const dy = Math.abs(y - ty);
      return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
    };
    const open = new Heap();
    this.g[start] = 0;
    this.parent[start] = -1;
    this.stamp[start] = cur;
    open.push(start, heur(sx, sy));
    let best = start;
    let bestH = heur(sx, sy);
    let expanded = 0;
    let found = -1;
    while (open.size > 0 && expanded < maxNodes) {
      const node = open.pop();
      if (this.closed[node] === cur) continue;
      this.closed[node] = cur;
      expanded++;
      const x = node % w;
      const y = (node / w) | 0;
      const hh = heur(x, y);
      if (hh < bestH || (hh === bestH && this.g[node] < this.g[best])) {
        bestH = hh;
        best = node;
      }
      if ((x === tx && y === ty) || (stopDist > 0 && Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= stopDist)) {
        found = node;
        break;
      }
      const gN = this.g[node];
      for (let k = 0; k < 8; k++) {
        const nx = x + NB[k][0];
        const ny = y + NB[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.closed[ni] === cur) continue;
        const isTarget = nx === tx && ny === ty;
        if (!canPass(nx, ny, x, y, isTarget)) continue;
        // no corner cutting through blocked diagonals
        if (k >= 4) {
          if (!canPass(x + NB[k][0], y, x, y, false) && !canPass(x, y + NB[k][1], x, y, false)) continue;
        }
        const c = NB[k][2] * (cost ? cost(nx, ny) : 1);
        const ng = gN + c;
        if (this.stamp[ni] !== cur || ng < this.g[ni]) {
          this.stamp[ni] = cur;
          this.g[ni] = ng;
          this.parent[ni] = node;
          open.push(ni, ng + heur(nx, ny) * 1.001);
        }
      }
    }
    const endNode = found >= 0 ? found : best;
    if (endNode === start) return [];
    const path = [];
    let n = endNode;
    while (n !== start && n >= 0) {
      path.push([n % w, (n / w) | 0]);
      n = this.parent[n];
    }
    path.reverse();
    return path;
  }
}
