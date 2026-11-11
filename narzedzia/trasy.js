'use strict';

/**
 * Lista tras API przez introspekcję routerów zamontowanych w `serwer.js` (`ROUTERY_API`): metoda,
 * ścieżka i rola — `pracownik` / `admin` (bramka), `portal` (sesja konta, zakres z `zakresKonta()`),
 * `publiczna`. Wspólna dla testu listy dozwolonych tras (§ 7 pkt 1) i `npm run dokumentacja`.
 */

const NAZWY_BRAMEK = { wymagajPracownika: 'pracownik', wymagajAdmina: 'admin' };

function rola(prefiks, bramka, nazwy) {
  if (nazwy.includes('wymagajAdmina')) return 'admin';
  if (nazwy.includes('wymagajPracownika') || (bramka && NAZWY_BRAMEK[bramka.name] === 'pracownik')) return 'pracownik';
  return prefiks === '/api/psa/portal' ? 'portal' : 'publiczna';
}

function listaTras(routery) {
  const wynik = [];
  for (const { prefiks, bramka, router } of routery) {
    const bramkiRoutera = [];
    for (const w of router.stack) {
      if (!w.route) {
        if (NAZWY_BRAMEK[w.name]) bramkiRoutera.push(w.name);
        continue;
      }
      const nazwy = [...bramkiRoutera, ...w.route.stack.map((l) => l.name)];
      for (const m of Object.keys(w.route.methods)) {
        wynik.push({ metoda: m.toUpperCase(), sciezka: `${prefiks}${w.route.path === '/' ? '' : w.route.path}`, rola: rola(prefiks, bramka, nazwy) });
      }
    }
  }
  return wynik;
}

const wiersz = (t) => `${t.metoda} ${t.sciezka} ${t.rola}`;

module.exports = { listaTras, wiersz };
