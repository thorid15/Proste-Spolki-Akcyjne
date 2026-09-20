'use strict';
const { ADRES, KANC_STORAGE, readState, shot, launch } = require('./lib');

(async () => {
  const st = readState();
  const { SPOLKA_ID, AKCJONARIUSZE, DZIS } = st;
  const osobaAnna = AKCJONARIUSZE.find((a) => a.typ === 'fizyczna').osoba_id;
  const osobaInwestor = AKCJONARIUSZE.find((a) => a.typ === 'prawna').osoba_id;

  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}/wydruk/informacja?data=${DZIS}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(500);
  await shot(kanc, 'informacja-domyslnie-rola-spolka');

  // ── Przelaczamy odbiorce na "akcjonariusz" -> Inwestor (mniejszosciowy, 5 akcji) ──
  await kanc.locator('select').first().selectOption('akcjonariusz');
  await kanc.waitForTimeout(300);
  await kanc.locator('select').nth(1).selectOption(String(osobaInwestor));
  await kanc.waitForTimeout(600);
  await shot(kanc, 'informacja-jako-akcjonariusz-inwestor');

  // ── Pobierzmy tresc bezposrednio z API (HTML), sprawdzmy czy PESEL/data urodzenia/adres Anny sa zamaskowane ──
  const urlInformacji = `${ADRES}/api/psa/spolki/${SPOLKA_ID}/informacja.html?data=${DZIS}&rola=akcjonariusz&odbiorca=${osobaInwestor}`;
  const resp = await ctx.request.get(urlInformacji);
  const html = await resp.text();
  console.log('GET informacja.html (rola=akcjonariusz, odbiorca=Inwestor) -> status', resp.status());

  console.log('Zawiera PESEL Anny (85010112345) w postaci jawnej:', html.includes('85010112345'));
  console.log('Zawiera date urodzenia Anny (1985-01-01 / 01.01.1985):', html.includes('1985-01-01') || html.includes('01.01.1985'));
  console.log('Zawiera adres Anny ("Testowa" + "1" w kontekscie adresu / "80-280"):', html.includes('80-280') && html.includes('Testowa'));
  console.log('Zawiera slowo "Kowalska" (imie i nazwisko - NIE powinno byc maskowane, tylko PESEL/data/adres):', html.includes('Kowalska'));
  console.log('Zawiera oznaczenia maskowania (np. "***" albo "ukryt" albo "zastrzez"):', /\*\*\*|ukryt|zastrzeż|niedostępn/i.test(html));

  require('fs').writeFileSync(
    '/home/user/Proste-Spolki-Akcyjne/testy-audyt/skrypty/_stan/informacja-akcjonariusz.html', html
  );

  // ── Dla porownania: informacja jako SPOLKA (powinna pokazywac WSZYSTKO w pelni) ──
  const urlSpolka = `${ADRES}/api/psa/spolki/${SPOLKA_ID}/informacja.html?data=${DZIS}&rola=spolka`;
  const respSpolka = await ctx.request.get(urlSpolka);
  const htmlSpolka = await respSpolka.text();
  console.log('\n[Rola=spolka, dla porownania] Zawiera PESEL Anny w postaci jawnej:', htmlSpolka.includes('85010112345'));

  await browser.close();
  console.log('=== 09 OK ===');
})().catch((e) => { console.error('BLAD 09:', e); process.exit(1); });
