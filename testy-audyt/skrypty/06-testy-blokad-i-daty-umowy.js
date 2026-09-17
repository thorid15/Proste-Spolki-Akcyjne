'use strict';
const { ADRES, KANC_STORAGE, readState, launch } = require('./lib');

async function j(resp) { try { return await resp.json(); } catch { return { _raw: await resp.text() }; } }

(async () => {
  const st = readState();
  const { SPOLKA_ID, DZIS } = st;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });

  console.log('\n--- TEST 1: data_uchwaly_wyboru PO dacie data_umowy (art. 300(32) § 1 w zw. z 300(31) § 5) ---');
  const dataUmowy = DZIS;
  const dataUchwalyPozniej = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10); // +5 dni, PO umowie
  const r1 = await ctx.request.put(`${ADRES}/api/psa/spolki/${SPOLKA_ID}`, {
    data: { data_umowy: dataUmowy, data_uchwaly_wyboru: dataUchwalyPozniej, umowe_zawarl: 'notariusz', umowe_zawarl_imie_nazwisko: 'Łukasz Kozon' },
  });
  console.log('PUT spolka z uchwala PO umowie -> status', r1.status(), JSON.stringify(await j(r1)).slice(0, 200));

  console.log('\n--- TEST 2: DRUGA "umowa" dla tej samej spolki (art. 300(32) § 2) ---');
  const dataUmowy2 = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const r2 = await ctx.request.put(`${ADRES}/api/psa/spolki/${SPOLKA_ID}`, {
    data: { data_umowy: dataUmowy2, data_uchwaly_wyboru: DZIS, umowe_zawarl: 'zastepca', umowe_zawarl_imie_nazwisko: 'Ktoś Inny' },
  });
  console.log('PUT spolka z INNA umowa (nadpisanie) -> status', r2.status(), JSON.stringify(await j(r2)).slice(0, 250));

  // Przywracamy poprawne, spojne daty S1 przed dalszymi krokami (uchwala PRZED umowa, obie <= dzis).
  const rFix = await ctx.request.put(`${ADRES}/api/psa/spolki/${SPOLKA_ID}`, {
    data: { data_umowy: DZIS, data_uchwaly_wyboru: DZIS, umowe_zawarl: 'notariusz', umowe_zawarl_imie_nazwisko: 'Łukasz Kozon' },
  });
  console.log('Przywrocono spojne daty S1 -> status', rFix.status());

  console.log('\n--- TEST 3: spolka NIE-P.S.A. (forma prawna sp. z o.o.), bezposrednie API ---');
  const krsSpZoo = `9999${Date.now().toString().slice(-6)}`.slice(0, 10);
  const r3 = await ctx.request.post(`${ADRES}/api/psa/spolki`, {
    data: {
      krs: krsSpZoo, nazwa: 'Testowa Spółka z o.o. (audyt — nie P.S.A.)',
      forma_prawna: 'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      kraj: 'Polska', kod_pocztowy: '00-001', miejscowosc: 'Warszawa', ulica: 'Testowa', nr_domu: '1',
    },
  });
  console.log('POST spolka z o.o. -> status', r3.status(), JSON.stringify(await j(r3)).slice(0, 300));

  console.log('\n--- TEST 4: emisja BEZ data_wpisu_krs (art. 300(30) § 2, sankcja 592 § 3) ---');
  const podgladBezKrs = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia/podglad`, {
    data: {
      typ: 'emisja',
      data_zdarzenia: DZIS,
      dane: { seria: 'AZ', nr_pierwszy: 1, ilosc: 100, rodzaj_akcji: 'zwykla', tytul: 'Emisja założycielska', data_wpisu_krs: null },
    },
  });
  console.log('Podglad emisji BEZ data_wpisu_krs -> status', podgladBezKrs.status(), JSON.stringify(await j(podgladBezKrs)).slice(0, 300));
  const zapisBezKrs = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'emisja',
      data_zdarzenia: DZIS,
      dane: { seria: 'ZZ-PRE-KRS', nr_pierwszy: 1, ilosc: 10, rodzaj_akcji: 'zwykla', tytul: 'Test bez KRS', data_wpisu_krs: null },
    },
  });
  console.log('BEZPOSREDNI zapis emisji BEZ data_wpisu_krs (z pominieciem podgladu) -> status', zapisBezKrs.status(), JSON.stringify(await j(zapisBezKrs)).slice(0, 300));

  console.log('\n--- TEST 4b: emisja z data_wpisu_krs WCZESNIEJSZA niz data rejestracji spolki w KRS ---');
  const dataPrzeszla = '2000-01-01';
  const zapisWczesnaData = await ctx.request.post(`${ADRES}/api/psa/spolki/${SPOLKA_ID}/zdarzenia`, {
    data: {
      typ: 'emisja',
      data_zdarzenia: DZIS,
      dane: { seria: 'ZZ-WCZESNA', nr_pierwszy: 1, ilosc: 10, rodzaj_akcji: 'zwykla', tytul: 'Test data wczesna', data_wpisu_krs: dataPrzeszla },
    },
  });
  console.log('Zapis emisji z data_wpisu_krs=2000-01-01 (spolka zarejestrowana', DZIS, ') -> status', zapisWczesnaData.status(), JSON.stringify(await j(zapisWczesnaData)).slice(0, 400));

  await browser.close();
  console.log('\n=== 06 OK ===');
})().catch((e) => { console.error('BLAD 06:', e); process.exit(1); });
