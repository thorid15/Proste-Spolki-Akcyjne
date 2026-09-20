'use strict';
const {
  ADRES, KLIENT_STORAGE, KANC_STORAGE, readState, writeState, shot, launch,
} = require('./lib');

(async () => {
  const st = readState();
  const { EMAIL_KLIENTA } = st;
  const browser = await launch();

  // ── A) Podwojne zlozenie wniosku: bezposrednie zadanie API, z pominieciem formularza ──
  const klientCtx = await browser.newContext({ storageState: KLIENT_STORAGE });
  const klient = await klientCtx.newPage();
  const respZloz2 = await klientCtx.request.post(`${ADRES}/api/psa/portal/wniosek/zloz`, { data: {} });
  console.log('DRUGIE zlozenie (bezposrednie API) -> status', respZloz2.status());
  console.log('  body:', (await respZloz2.text()).slice(0, 500));

  // ── B) Odswiezenie strony po POST (F5) ──
  await klient.goto(`${ADRES}/portal.html#/wniosek`, { waitUntil: 'networkidle' });
  await klient.reload({ waitUntil: 'networkidle' });
  await shot(klient, 'wniosek-po-f5-po-zlozeniu');
  console.log('URL po F5:', klient.url());

  // ── C) Kancelaria: znajdz wniosek w kolejce, otworz ──
  const kancCtx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await kancCtx.newPage();
  await kanc.goto(`${ADRES}/#/wnioski`, { waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-lista-wnioskow');

  const wynikWnioski = await kancCtx.request.get(`${ADRES}/api/psa/wnioski`);
  const listaWnioski = await wynikWnioski.json();
  const wniosek = listaWnioski.wnioski.find((w) => w.konto_email === EMAIL_KLIENTA);
  if (!wniosek) throw new Error('Nie znaleziono wniosku w kolejce kancelarii — konto ' + EMAIL_KLIENTA);
  console.log('Wniosek id=', wniosek.id, 'status=', wniosek.status);

  await kanc.goto(`${ADRES}/#/wnioski/${wniosek.id}`, { waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-wniosek-widok');

  // ── D) Test: probujemy "podpis-potwierdz" (notariusz) ZANIM komplet
  //      dokumentow w ogole istnieje / zanim klient cokolwiek podpisal ──
  const probaPrzedwczesna = await kancCtx.request.post(
    `${ADRES}/api/psa/wnioski/${wniosek.id}/dokumenty/1/podpis-potwierdz`, { data: {} }
  );
  console.log('Proba potwierdzenia podpisu PRZED wystawieniem dokumentow -> status', probaPrzedwczesna.status());
  console.log('  body:', (await probaPrzedwczesna.text()).slice(0, 300));

  // ── Wystawienie kompletu dokumentow (kancelaria) ──
  const wystawResp = await kancCtx.request.post(`${ADRES}/api/psa/wnioski/${wniosek.id}/dokumenty/wystaw`, { data: {} });
  const wystaw = await wystawResp.json();
  console.log('Wystawiono dokumentow:', (wystaw.dokumenty || []).map((d) => `${d.typ}#${d.id}(${d.nazwa_pliku}, pustych:${d.brakujace.length})`).join(', '));
  await kanc.reload({ waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-wniosek-dokumenty-wystawione');

  // ── D2) Teraz probujemy podpis-potwierdz na PIERWSZYM realnym dokumencie,
  //       ZANIM klient przeslal skan — kluczowy test wymuszenia kolejnosci
  //       podpisow (spolka pierwsza, notariusz na koncu) BEZPOSREDNIM zadaniem. ──
  const pierwszyDok = wystaw.dokumenty[0];
  const probaPrzedPodpisemKlienta = await kancCtx.request.post(
    `${ADRES}/api/psa/wnioski/${wniosek.id}/dokumenty/${pierwszyDok.id}/podpis-potwierdz`, { data: {} }
  );
  console.log(
    `Proba "notariusz potwierdza podpis" na dok #${pierwszyDok.id} (${pierwszyDok.typ}) ZANIM klient przeslal skan -> status`,
    probaPrzedPodpisemKlienta.status()
  );
  console.log('  body:', (await probaPrzedPodpisemKlienta.text()).slice(0, 400));

  // ── Udostepnienie kompletu klientowi ──
  const udostepResp = await kancCtx.request.post(`${ADRES}/api/psa/wnioski/${wniosek.id}/dokumenty/udostepnij`, { data: {} });
  const udostep = await udostepResp.json();
  console.log('Udostepniono, status wniosku:', udostep.wniosek.status, 'email_wyslany:', udostep.email_wyslany, udostep.powod || '');
  await kanc.reload({ waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-wniosek-udostepniony');

  writeState({ WNIOSEK_ID: wniosek.id, DOKUMENTY: wystaw.dokumenty });
  console.log('=== 03 OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 03:', e); process.exit(1); });
