// Minimal INI parser compatible with Dune II / Dune Legacy scenario files.
// Keeps key order (needed for [UNITS]/[STRUCTURES] lists) and is case-insensitive for section lookup.
export function parseIni(text) {
  const sections = new Map();
  let cur = null;
  for (let raw of text.replace(/\r/g, '').split('\n')) {
    let line = raw;
    const sc = line.indexOf(';');
    if (sc >= 0) line = line.slice(0, sc);
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      const name = m[1].trim();
      const key = name.toLowerCase();
      if (!sections.has(key)) sections.set(key, { name, entries: [] });
      cur = sections.get(key);
      continue;
    }
    if (!cur) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    cur.entries.push([k, v]);
  }
  return {
    sections,
    has(section) {
      return sections.has(section.toLowerCase());
    },
    get(section, key, fallback = undefined) {
      const s = sections.get(section.toLowerCase());
      if (!s) return fallback;
      const lk = key.toLowerCase();
      for (const [k, v] of s.entries) if (k.toLowerCase() === lk) return v;
      return fallback;
    },
    getInt(section, key, fallback = 0) {
      const v = this.get(section, key);
      if (v === undefined || v === '') return fallback;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? fallback : n;
    },
    entries(section) {
      const s = sections.get(section.toLowerCase());
      return s ? s.entries : [];
    },
    sectionNames() {
      return [...sections.values()].map((s) => s.name);
    },
  };
}
