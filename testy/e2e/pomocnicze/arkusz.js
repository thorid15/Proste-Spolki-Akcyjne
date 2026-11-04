'use strict';

/**
 * Arkusze zbiorcze zrzutów i scalenie wyników (SESJA-PSA-ANALIZA-PRZEPLYWOW, Faza 2).
 *
 *   scal()            — raport/czesci/*.json → raport/wyniki.json (+ podsumowanie na konsolę)
 *   arkusze(browser)  — raport/arkusze/<scenariusz>.png: miniatury kroków jednego scenariusza,
 *                       obie szerokości, na jednym obrazie o szerokości ≤ 1600 px; kroki, w których
 *                       heurystyki coś zgłosiły (błąd, HTTP, układ, axe), mają czerwoną ramkę.
 *
 * Uruchamiane jako globalTeardown `npm run e2e` i `npm run e2e:malpa`; można też ręcznie:
 *   node testy/e2e/pomocnicze/arkusz.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { RAPORT, CZESCI } = require('./krok');

const ARKUSZE = path.join(RAPORT, 'arkusze');

function scal() {
  if (!fs.existsSync(CZESCI)) return { scenariusze: [], malpa: [] };
  const czesci = fs.readdirSync(CZESCI).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(CZESCI, f), 'utf8')));
  const wynik = {
    wygenerowano: new Date().toISOString(),
    scenariusze: czesci.filter((c) => !c.malpa),
    malpa: czesci.filter((c) => c.malpa),
  };
  fs.writeFileSync(path.join(RAPORT, 'wyniki.json'), JSON.stringify(wynik, null, 2));
  return wynik;
}

/** Czy krok wymaga obejrzenia zrzutu (heurystyki). */
function oznaczony(k) {
  return Boolean(k.wyjatek || k.bledy_js.length || k.http.length || k.bledy_konsoli.length || k.uklad.length
    || k.axe.some((a) => a.wplyw === 'critical' || a.wplyw === 'serious'));
}

async function arkusze(browser) {
  const { scenariusze } = scal();
  fs.mkdirSync(ARKUSZE, { recursive: true });
  const wg = {};
  for (const s of scenariusze) (wg[s.scenariusz] ||= []).push(s);
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  for (const [nazwa, wersje] of Object.entries(wg)) {
    wersje.sort((a, b) => b.szerokosc - a.szerokosc);
    const wiersze = wersje.map((w) => {
      const kafle = w.kroki.map((k) => {
        const plik = path.join(RAPORT, k.zrzut);
        if (!fs.existsSync(plik)) return '';
        const dane = fs.readFileSync(plik).toString('base64');
        return `<figure class="${oznaczony(k) ? 'zly' : ''}"><img src="data:image/png;base64,${dane}"><figcaption>${k.nr}. ${k.nazwa}</figcaption></figure>`;
      }).join('');
      return `<h2>${w.szerokosc} px — ${w.status}, kliknięcia ${w.metryki.klikniecia}, pola ${w.metryki.pola_wypelnione}, przejścia ${w.metryki.przejscia}</h2><div class="rzad r${w.szerokosc}">${kafle}</div>`;
    }).join('');
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:12px;font:13px system-ui,sans-serif;width:1576px}
      h1{font-size:16px;margin:0 0 6px} h2{font-size:13px;margin:10px 0 4px;font-weight:600}
      .rzad{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
      figure{margin:0;border:2px solid #ccc;padding:2px;background:#fafafa}
      figure.zly{border-color:#c62828}
      .r1440 img{width:300px;max-height:420px;object-fit:cover;object-position:top}
      .r390 img{width:120px;max-height:420px;object-fit:cover;object-position:top}
      figcaption{font-size:11px;max-width:300px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .r390 figcaption{max-width:120px}
    </style></head><body><h1>${nazwa}</h1>${wiersze}</body></html>`);
    await page.screenshot({ path: path.join(ARKUSZE, `${nazwa}.png`), fullPage: true });
  }
  await page.close();
}

module.exports = { scal, arkusze, oznaczony, ARKUSZE };

if (require.main === module) {
  (async () => {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch();
    await arkusze(browser);
    await browser.close();
    console.log(`arkusze: ${ARKUSZE}`);
  })();
}
