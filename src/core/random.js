// Deterministic pseudo random number generator (xorshift128+ style, 32-bit safe).
export class Random {
  constructor(seed = 1) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    // splitmix32 to fill state
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
  }

  // 32 bit unsigned
  nextU32() {
    // xoshiro128**
    const r = Math.imul(rotl(Math.imul(this.b, 5), 7), 9) >>> 0;
    const t = this.b << 9;
    this.c ^= this.a; this.d ^= this.b; this.b ^= this.c; this.a ^= this.d;
    this.c ^= t;
    this.d = rotl(this.d, 11);
    this.a >>>= 0; this.b >>>= 0; this.c >>>= 0; this.d >>>= 0;
    return r;
  }

  // float in [0,1)
  rand() {
    return this.nextU32() / 4294967296;
  }

  // int in [min, max] inclusive
  randInt(min, max) {
    return min + Math.floor(this.rand() * (max - min + 1));
  }

  randFloat(min, max) {
    return min + this.rand() * (max - min);
  }

  randBool() {
    return (this.nextU32() & 1) === 1;
  }

  chance(p) {
    return this.rand() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  getState() { return [this.a, this.b, this.c, this.d]; }
  setState(s) { [this.a, this.b, this.c, this.d] = s; }
}

function rotl(x, k) {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

// Cosmetic randomness (not part of deterministic simulation)
export const fxRandom = new Random((Date.now() & 0xffffffff) >>> 0);
