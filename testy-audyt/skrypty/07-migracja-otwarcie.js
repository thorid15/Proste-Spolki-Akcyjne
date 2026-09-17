'use strict';
const {
  ADRES, KANC_STORAGE, readState, writeState, shot, launch,
  frowByLabel, fillPole, selectPole, fillData,
} = require('./lib');

async function j(resp) { try { return await resp.json(); } catch { return { _raw: await resp.text() }; } }

(async () => {
  const st = readState();
  const { SPOLKA_ID, DZIS, AKCJONARIUSZE } = st;
  const osobaAnna = AKCJONARIUSZE.find((a) => a.typ === 'fizyczna').osoba_id;
  const osobaInwestor = AKCJONARIUSZE.find((a) => a.typ === 'prawna').osoba_id;
  console.log('osoba Anna (fizyczna, docelowo 95 akcji):', osobaAnna, '| osoba Inwestor (prawna, docelowo 5 akcji):', osobaInwestor);

  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await kanc.getByRole('button', { name: /migracja.*stan otwarcia/i }).click();
  await kanc.waitForTimeout(600);
  await shot(kanc, 'migracja-krok1-emisja-puste');

  // ── Krok 1: Emisja zalozycielska AZ, 1-100, cena 0,01 zl ──
  await fillPole(kanc, 'Oznaczenie serii', 'AZ', { staff: true });
  await fillPole(kanc, 'Liczba akcji', '100', { staff: true });
  await fillPole(kanc, 'Numer pierwszej akcji', '1', { staff: true });
  await fillPole(kanc, 'Cena emisyjna jednej akcji', '0,01', { staff: true });
  await selectPole(kanc, 'Rodzaj akcji', 'zwykla', { staff: true });
  await fillData(kanc, 'Data wpisu emisji do KRS', DZIS, { staff: true });
  await fillPole(kanc, 'Tytuł emisji', 'Emisja założycielska', { staff: true });
  await fillPole(kanc, 'Podstawa prawna emisji', `Umowa spółki z dnia ${DZIS}`, { staff: true });
  await shot(kanc, 'migracja-krok1-emisja-wypelniona');

  await kanc.getByRole('button', { name: /zapisz emisj/i }).click().catch(async () => {
    // Nazwa przycisku moze byc inna - sprobuj ogolnego "Dalej"/"Zapisz".
    await kanc.getByRole('button', { name: /dalej|zapisz/i }).first().click();
  });
  await kanc.waitForTimeout(800);
  await shot(kanc, 'migracja-krok2-objecie-puste');

  // ── TEST bilansu NA ZYWO: probujemy objac WIECEJ niz wyemitowano (96+5=101>100) BEZPOSREDNIM zadaniem ──
  const emisjaResp = await ctx.request.get(`${ADRES}/api/psa/spolki/${SPOLKA_ID}`);
  const spolkaDane = await j(emisjaResp);
  const emisjaAz = spolkaDane.emisje.find((e) => e.seria === 'AZ');
  console.log('Emisja AZ zdarzenie_id:', emisjaAz && emisjaAz.zdarzenie_id, JSON.stringify(emisjaAz).slice(0, 200));

  const probaNiezgodna = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'objecie',
      data_zdarzenia: DZIS,
      dane: {
        emisja_zdarzenie_id: emisjaAz.zdarzenie_id,
        pozycje: [
          { osoba_id: osobaAnna, ilosc: 96, pokryta: 'tak', cena_emisyjna_grosze: 1 },
          { osoba_id: osobaInwestor, ilosc: 5, pokryta: 'tak', cena_emisyjna_grosze: 1 },
        ],
      },
    },
  });
  console.log('TEST bilansu: objecie 96+5=101 > 100 wyemitowanych -> status', probaNiezgodna.status(), JSON.stringify(await j(probaNiezgodna)).slice(0, 400));

  // ── Objecie POPRAWNE: 95 (Anna) + 5 (Inwestor) = 100 ──
  await kanc.reload({ waitUntil: 'networkidle' });
  await shot(kanc, 'migracja-krok2-po-probie-niezgodnej');

  const objecieResp = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'objecie',
      data_zdarzenia: DZIS,
      dane: {
        emisja_zdarzenie_id: emisjaAz.zdarzenie_id,
        pozycje: [
          { osoba_id: osobaAnna, ilosc: 95, pokryta: 'tak', cena_emisyjna_grosze: 1 },
          { osoba_id: osobaInwestor, ilosc: 5, pokryta: 'tak', cena_emisyjna_grosze: 1 },
        ],
      },
    },
  });
  console.log('Objecie POPRAWNE 95+5=100 (z pokryciem, bezposrednio API bo UI kreatora migracji nie ma pol pokrycia/ceny per osoba) -> status', objecieResp.status(), JSON.stringify(await j(objecieResp)).slice(0, 300));

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(600);
  await shot(kanc, 'kokpit-spolki-po-otwarciu-rejestru');

  writeState({ EMISJA_AZ_ZDARZENIE_ID: emisjaAz.zdarzenie_id });
  console.log('=== 07 OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 07:', e); process.exit(1); });
