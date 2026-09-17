'use strict';
const {
  ADRES, KLIENT_STORAGE, readState, writeState, shot, launch,
} = require('./lib');

const PDF_MINIMALNY = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8'
);

(async () => {
  const st = readState();
  const browser = await launch();
  const ctx = await browser.newContext({ storageState: KLIENT_STORAGE });
  const klient = await ctx.newPage();

  await klient.goto(`${ADRES}/portal.html#/wniosek`, { waitUntil: 'networkidle' });
  await shot(klient, 'wniosek-dokumenty-do-podpisu');

  const projekt = await ctx.request.get(`${ADRES}/api/psa/portal/wniosek/umowa-projekt`);
  console.log('Pobranie projektu umowy (klient) -> status', projekt.status(), 'rozmiar', (await projekt.body()).length, 'B');

  const listaResp = await ctx.request.get(`${ADRES}/api/psa/portal/wniosek/dokumenty`);
  const lista = await listaResp.json();
  console.log('Dokumenty widoczne dla klienta:', lista.dokumenty.map((d) => `#${d.id} ${d.typ}`).join(', '));

  for (const d of lista.dokumenty) {
    const resp = await ctx.request.post(`${ADRES}/api/psa/portal/wniosek/dokumenty/${d.id}/podpis`, {
      multipart: { plik: { name: `podpisany-${d.typ}.pdf`, mimeType: 'application/pdf', buffer: PDF_MINIMALNY } },
    });
    console.log(`  odeslano podpisany skan dla #${d.id} (${d.typ}) -> status`, resp.status());
  }

  await klient.reload({ waitUntil: 'networkidle' });
  await shot(klient, 'wniosek-wszystkie-skany-zalaczone');

  const odeslijResp = await ctx.request.post(`${ADRES}/api/psa/portal/wniosek/odeslij`, { data: {} });
  console.log('Odeslanie kompletu do kancelarii -> status', odeslijResp.status());
  console.log('  body:', (await odeslijResp.text()).slice(0, 300));

  await klient.reload({ waitUntil: 'networkidle' });
  await shot(klient, 'wniosek-komplet-odeslany');

  await ctx.storageState({ path: KLIENT_STORAGE });
  console.log('=== 04 OK ===');
  await browser.close();
})().catch((e) => { console.error('BLAD 04:', e); process.exit(1); });
