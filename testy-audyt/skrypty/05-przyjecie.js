'use strict';
const {
  ADRES, KANC_STORAGE, readState, writeState, shot, launch,
} = require('./lib');

(async () => {
  const st = readState();
  const { WNIOSEK_ID } = st;
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KANC_STORAGE });
  const kanc = await ctx.newPage();

  await kanc.goto(`${ADRES}/#/wnioski/${WNIOSEK_ID}`, { waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-wniosek-po-odeslaniu-skanow');

  const szczegolyResp = await ctx.request.get(`${ADRES}/api/psa/wnioski/${WNIOSEK_ID}`);
  const szczegoly = await szczegolyResp.json();
  console.log('Status wniosku:', szczegoly.status, '| akcjonariusze:', szczegoly.akcjonariusze.length, '| dokumenty:', szczegoly.dokumenty.length);

  // ── Weryfikacja pozycji akcjonariuszy ──
  for (const p of szczegoly.akcjonariusze) {
    const r = await ctx.request.post(`${ADRES}/api/psa/wnioski/${WNIOSEK_ID}/akcjonariusze/${p.id}/zweryfikuj`, { data: { zweryfikowano: true } });
    console.log(`  zweryfikowano akcjonariusza #${p.id} -> status`, r.status());
  }

  // ── Potwierdzenie podpisow (teraz PO odeslaniu skanow — powinno przejsc) ──
  for (const d of szczegoly.dokumenty) {
    const r = await ctx.request.post(`${ADRES}/api/psa/wnioski/${WNIOSEK_ID}/dokumenty/${d.id}/podpis-potwierdz`, { data: {} });
    console.log(`  potwierdzenie podpisu dok #${d.id} (${d.typ}) -> status`, r.status());
  }

  await kanc.reload({ waitUntil: 'networkidle' });
  await shot(kanc, 'kancelaria-wniosek-podpisy-potwierdzone');

  const przyjecieResp = await ctx.request.post(`${ADRES}/api/psa/wnioski/${WNIOSEK_ID}/przyjmij`, { data: {} });
  console.log('Przyjecie wniosku -> status', przyjecieResp.status());
  const przyjecie = await przyjecieResp.json();
  console.log('  spolka_id:', przyjecie.spolka_id, '| dokumenty_przeniesione:', przyjecie.dokumenty_przeniesione, '| konto_przepiete:', przyjecie.konto_przepiete);
  console.log('  akcjonariusze (osoba_id):', JSON.stringify(przyjecie.akcjonariusze));

  await kanc.goto(`${ADRES}/#/spolki/${przyjecie.spolka_id}`, { waitUntil: 'networkidle' });
  await kanc.waitForTimeout(600);
  await shot(kanc, 'kokpit-spolki-po-przyjeciu-brak-rejestru');

  writeState({ SPOLKA_ID: przyjecie.spolka_id, AKCJONARIUSZE: przyjecie.akcjonariusze });
  console.log('=== 05 OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 05:', e); process.exit(1); });
