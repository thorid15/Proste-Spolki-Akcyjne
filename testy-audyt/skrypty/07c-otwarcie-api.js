'use strict';
const { ADRES, KANC_STORAGE, readState, writeState, shot, launch } = require('./lib');

async function j(resp) { try { return await resp.json(); } catch { return { _raw: await resp.text() }; } }

(async () => {
  const st = readState();
  const { SPOLKA_ID, DZIS, AKCJONARIUSZE } = st;
  const osobaAnna = AKCJONARIUSZE.find((a) => a.typ === 'fizyczna').osoba_id;
  const osobaInwestor = AKCJONARIUSZE.find((a) => a.typ === 'prawna').osoba_id;

  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  // ── Emisja zalozycielska AZ 1-100, cena 0,01 zl = 1 grosz ──
  const emisjaResp = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'emisja',
      data_zdarzenia: DZIS,
      dane: {
        seria: 'AZ', nr_pierwszy: 1, ilosc: 100, rodzaj_akcji: 'zwykla',
        tytul: 'Emisja założycielska', podstawa_prawna: `Umowa spółki z dnia ${DZIS}`,
        data_wpisu_krs: DZIS,
      },
    },
  });
  const emisja = await j(emisjaResp);
  console.log('Emisja AZ (1-100) -> status', emisjaResp.status(), JSON.stringify(emisja).slice(0, 200));
  const emisjaZdarzenieId = emisja.zdarzenie.id;

  // ── TEST na zywo: bilans - probujemy objac 96+5=101 > 100 ──
  const probaNiezgodna = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'objecie',
      data_zdarzenia: DZIS,
      dane: {
        emisja_zdarzenie_id: emisjaZdarzenieId,
        pozycje: [
          { osoba_id: osobaAnna, ilosc: 96, pokryta: 'tak', cena_emisyjna_grosze: 1 },
          { osoba_id: osobaInwestor, ilosc: 5, pokryta: 'tak', cena_emisyjna_grosze: 1 },
        ],
      },
    },
  });
  console.log('TEST bilansu na zywo: objecie 96+5=101 > 100 wyemitowanych -> status', probaNiezgodna.status());
  console.log('  body:', JSON.stringify(await j(probaNiezgodna)).slice(0, 500));

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(500);
  await shot(kanc, 'kokpit-po-probie-bilansu-niezgodnego');

  // ── Objecie POPRAWNE: Anna 95 + Inwestor 5 = 100, w calosci pokryte ──
  const objecieResp = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'objecie',
      data_zdarzenia: DZIS,
      dane: {
        emisja_zdarzenie_id: emisjaZdarzenieId,
        pozycje: [
          { osoba_id: osobaAnna, ilosc: 95, pokryta: 'tak', cena_emisyjna_grosze: 1 },
          { osoba_id: osobaInwestor, ilosc: 5, pokryta: 'tak', cena_emisyjna_grosze: 1 },
        ],
      },
    },
  });
  console.log('Objecie POPRAWNE 95 (Anna, fizyczna) + 5 (Inwestor, prawna) = 100, w calosci pokryte -> status', objecieResp.status());
  console.log('  body:', JSON.stringify(await j(objecieResp)).slice(0, 300));

  await kanc.goto(`${ADRES}/#/spolki/${SPOLKA_ID}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(600);
  await shot(kanc, 'kokpit-rejestr-otwarty-95-5');

  writeState({ EMISJA_AZ_ZDARZENIE_ID: emisjaZdarzenieId });
  console.log('=== 07c OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 07c:', e); process.exit(1); });
