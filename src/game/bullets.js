import { TILESIZE } from '../core/constants.js';

// Projectile types (Dune Legacy include/data.h, parameters from Bullet::init)
export const B = {
  DROCKET: 0,
  LARGE_ROCKET: 1,
  ROCKET: 2,
  TURRET_ROCKET: 3,
  SHELL_SMALL: 4,
  SHELL_MEDIUM: 5,
  SHELL_LARGE: 6,
  SHELL_TURRET: 7,
  SMALL_ROCKET: 8,
  SONIC: 9,
  SANDWORM: 10,
};

export const BULLET_DEF = {
  [B.DROCKET]: { speed: 19.2, radius: 32, timer: 19, shell: false, visual: 'gasRocket' },
  [B.LARGE_ROCKET]: { speed: 32, radius: 64, timer: 0, shell: false, visual: 'bigRocket' },
  [B.ROCKET]: { speed: 19.2, radius: 32, timer: 22, shell: false, visual: 'rocket' },
  [B.TURRET_ROCKET]: { speed: 19.2, radius: 32, timer: 60, shell: false, visual: 'rocket' },
  [B.SHELL_SMALL]: { speed: 20, radius: 32, timer: 0, shell: true, visual: 'bullet' },
  [B.SHELL_MEDIUM]: { speed: 20, radius: 32, timer: 0, shell: true, visual: 'shell' },
  [B.SHELL_LARGE]: { speed: 20, radius: 32, timer: 0, shell: true, visual: 'shellLarge' },
  [B.SHELL_TURRET]: { speed: 20, radius: 32, timer: 0, shell: true, visual: 'shell' },
  [B.SMALL_ROCKET]: { speed: 23.04, radius: 32, timer: 7, shell: false, visual: 'smallRocket' },
  [B.SONIC]: { speed: 6, radius: 48, timer: 45, shell: false, visual: 'sonic' },
};

// 256-step angle helpers (0 = east, counter-clockwise, screen Y down)
function angle256(x1, y1, x2, y2) {
  let a = Math.atan2(-(y2 - y1), x2 - x1);
  if (a < 0) a += Math.PI * 2;
  return (a / (Math.PI * 2)) * 256;
}

let nextBulletId = 1;

export class Bullet {
  // from/to in world pixels
  constructor(game, shooter, fromX, fromY, toX, toY, type, damage, air, target) {
    this.game = game;
    this.id = nextBulletId++;
    this.shooterId = shooter ? shooter.id : 0;
    this.owner = shooter ? shooter.owner : -1;
    this.shooterType = shooter ? shooter.type : null;
    this.type = type;
    this.damage = damage;
    this.air = air;
    this.target = target || null;
    const def = BULLET_DEF[type];
    this.speed = def.speed;
    this.radius = def.radius;
    this.timer = def.timer;
    this.shell = def.shell;
    this.visual = def.visual;
    this.alive = true;
    this.sx = fromX;
    this.sy = fromY;
    this.x = fromX;
    this.y = fromY;
    this.px = fromX; // previous position (render interpolation)
    this.py = fromY;

    if (type === B.TURRET_ROCKET) {
      this.timer = target && target.isAir ? 120 : 60;
    } else if ((type === B.ROCKET || type === B.DROCKET || type === B.SMALL_ROCKET) && this.timer > 0) {
      if (target && target.isAir) this.timer = 50;
    }

    let dx = toX;
    let dy = toY;
    const rng = game.rng;
    if (type === B.SONIC) {
      let diffX = toX - fromX;
      let diffY = toY - fromY;
      const range = (game.stats('sonicTank', this.owner).weaponRange || 8) * TILESIZE;
      if (diffX === 0 && diffY === 0) diffY = range;
      const len = Math.sqrt(diffX * diffX + diffY * diffY);
      const ratio = range / len;
      dx = fromX + Math.floor(diffX * ratio);
      dy = fromY + Math.floor(diffY * ratio);
    } else if (type === B.ROCKET || type === B.DROCKET) {
      const dist = Math.hypot(toX - fromX, toY - fromY);
      const tiles = Math.max(0, Math.round(dist / TILESIZE));
      const limit = rng.randInt(0, 15) !== 0 ? tiles + 8 : rng.randInt(0, 255) + 8;
      let r = rng.randInt(0, 255);
      while (r > limit) r = Math.floor(r / 2);
      const a = Math.PI * 2 * rng.rand();
      dx += Math.round(Math.cos(a) * r);
      dy -= Math.round(Math.sin(a) * r);
    }
    this.dx = dx;
    this.dy = dy;
    // launch toward the original target point
    this.angle = angle256(fromX, fromY, toX, toY);
    this._setSpeeds();
    this.age = 0;
  }

  _setSpeeds() {
    const rad = (this.angle / 256) * Math.PI * 2;
    this.vx = this.speed * Math.cos(rad);
    this.vy = -this.speed * Math.sin(rad);
  }

  _steer() {
    const want = angle256(this.x, this.y, this.dx, this.dy);
    let diff = want - this.angle;
    if (diff > 128) diff -= 256;
    else if (diff < -128) diff += 256;
    const ts = 4.5;
    if (diff > ts) diff = ts;
    else if (diff < -ts) diff = -ts;
    this.angle += diff;
    if (this.angle < 0) this.angle += 256;
    else if (this.angle >= 256) this.angle -= 256;
    this._setSpeeds();
  }

  update() {
    const g = this.game;
    this.px = this.x;
    this.py = this.y;
    this.age++;
    if (this.type === B.ROCKET || this.type === B.DROCKET) {
      const t = this.target;
      if (t && t.alive && t.type === 'ornithopter') {
        this.dx = t.rx;
        this.dy = t.ry;
      }
      this._steer();
    } else if (this.type === B.TURRET_ROCKET) {
      const t = this.target;
      if (t && t.alive) {
        const c = t.centerPoint();
        this.dx = c[0];
        this.dy = c[1];
      }
      this._steer();
    }
    const oldDist = Math.hypot(this.x - this.dx, this.y - this.dy);
    this.x += this.vx;
    this.y += this.vy;
    const tx = Math.floor(this.x / TILESIZE);
    const ty = Math.floor(this.y / TILESIZE);
    const map = g.map;
    if (tx < -5 || ty < -5 || tx >= map.width + 5 || ty >= map.height + 5) {
      this.alive = false;
      return;
    }
    const newDist = Math.hypot(this.x - this.dx, this.y - this.dy);
    if (this.timer > 0) this.timer--;
    if (this.type === B.TURRET_ROCKET && this.timer === 0) {
      this.explode();
      return;
    }
    if (this.type === B.SONIC) {
      if (this.timer === 0) {
        this.alive = false;
        return;
      }
      const W = g.stats('sonicTank', this.owner).weaponDamage;
      const start = (W / 4 + 1) / 4.5;
      const end = ((W - 9) / 4 + 1) / 4.5;
      const dec = -(start - end) / (45 * 2 * this.speed);
      const d = Math.hypot(this.x - this.sx, this.y - this.sy);
      const cur = d * dec + start;
      g.damageArea(this, Math.round(this.x), Math.round(this.y), cur / 2, this.radius, false);
      this.x += this.vx;
      this.y += this.vy;
      g.damageArea(this, Math.round(this.x), Math.round(this.y), cur / 2, this.radius, false);
      g.events.emit('sonicStep', { x: this.x, y: this.y });
    } else if (this.shell && map.inBounds(tx, ty)) {
      const gid = map.ground[map.idx(tx, ty)];
      if (gid) {
        const obj = g.objects.get(gid);
        if (obj && obj.isStructure && (this.type !== B.SHELL_TURRET || obj.owner !== this.owner)) {
          this.explode();
          return;
        }
      }
    }
    if (oldDist < newDist || newDist < 4) {
      if (this.type === B.ROCKET || this.type === B.DROCKET) {
        const t = this.target;
        const airTarget = t && t.alive && t.isAir;
        if (airTarget || this.timer === 0) {
          this.explode();
        }
      } else if (this.type === B.SONIC) {
        // sonic wave fades out once it travelled its full range
        if (newDist < 8 || oldDist < newDist) this.alive = false;
      } else {
        this.x = this.dx;
        this.y = this.dy;
        this.explode();
      }
    }
  }

  explode() {
    if (!this.alive) return;
    this.alive = false;
    const g = this.game;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.type === B.LARGE_ROCKET) {
      // Death Hand: 5x5 grid without corners, 1 tile spacing
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          if (Math.abs(i) === 2 && Math.abs(j) === 2) continue;
          g.damageArea(this, x + i * TILESIZE, y + j * TILESIZE, this.damage, this.radius, false);
        }
      }
      g.events.emit('explosion', { x: x / TILESIZE, y: y / TILESIZE, kind: 'deathHand' });
      return;
    }
    g.damageArea(this, x, y, this.damage, this.radius, this.air);
    let kind = 'small';
    switch (this.type) {
      case B.DROCKET: kind = 'gas'; break;
      case B.ROCKET:
      case B.TURRET_ROCKET: kind = 'rocket'; break;
      case B.SMALL_ROCKET: kind = 'smallRocket'; break;
      case B.SHELL_SMALL: kind = 'bullet'; break;
      case B.SHELL_MEDIUM:
      case B.SHELL_TURRET: kind = 'shell'; break;
      case B.SHELL_LARGE: kind = 'shellLarge'; break;
      default: kind = 'small';
    }
    g.events.emit('explosion', { x: x / TILESIZE, y: y / TILESIZE, kind, air: this.air });
  }
}
