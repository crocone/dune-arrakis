import { TANK_DEFS } from './tanks.js';
import { WHEELED_DEFS } from './wheeled.js';
import { HEAVY_DEFS } from './heavy.js';
import { AIR_DEFS } from './air.js';
import { INFANTRY_DEFS } from './infantry.js';

export const UNIT_DEFS = {
  ...TANK_DEFS,
  ...WHEELED_DEFS,
  ...HEAVY_DEFS,
  ...AIR_DEFS,
  ...INFANTRY_DEFS,
};
