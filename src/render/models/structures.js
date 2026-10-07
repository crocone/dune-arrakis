import { BASE1_DEFS } from './base1.js';
import { BASE2_DEFS } from './base2.js';
import { BASE3_DEFS } from './base3.js';
import { DEFENSE_DEFS, WALL_DEFS } from './defense.js';

export const STRUCT_DEFS = {
  ...BASE1_DEFS,
  ...BASE2_DEFS,
  ...BASE3_DEFS,
  ...DEFENSE_DEFS,
  ...WALL_DEFS,
};
