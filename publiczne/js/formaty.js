/* formaty.js — wpisywanie daty: „12.03.2026”, „12032026” albo wklejone ISO → RRRR-MM-DD (pole daty, § 5). */

function parsujDate(tekst) {
  const czesci = String(tekst == null ? '' : tekst).trim().split(/[^\d]+/).filter(Boolean);
  let d;
  let m;
  let r;
  if (czesci.length === 3) {
    if (czesci[0].length === 4) [r, m, d] = czesci; else [d, m, r] = czesci;
  } else if (czesci.length === 1 && czesci[0].length === 8) {
    const c = czesci[0];
    if (Number(c.slice(0, 4)) > 1900) { r = c.slice(0, 4); m = c.slice(4, 6); d = c.slice(6, 8); } else { d = c.slice(0, 2); m = c.slice(2, 4); r = c.slice(4, 8); }
  } else {
    return null;
  }
  if (r.length !== 4) return null;
  const iso = `${r}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const proba = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(proba.getTime()) || proba.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { parsujDate };
