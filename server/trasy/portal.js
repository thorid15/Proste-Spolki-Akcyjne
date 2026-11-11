'use strict';

/**
 * Portal klienta (§ 6): zgłoszenie spółki (formularz publiczny, U-08), aktywacja konta, logowanie,
 * wniosek (dane → dokumenty) — do jego przyjęcia; potem Start, Zgłoś zmianę, informacja z rejestru,
 * płatności i Konto. Każda trasa po zalogowaniu przechodzi przez `portal.zakresKonta()` (U-23) —
 * cudza spółka, sprawa, pismo albo opłata to 404.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const wnioski = require('../wnioski');
const portal = require('../portal');
const pisma = require('../logika/pisma');
const hasla = require('../logika/hasla');
const limiter = require('../logika/limiter');
const autoryzacja = require('../pomocnicze/autoryzacja');
const pliki = require('../pomocnicze/pliki');
const { asy, nieAutoryzowany, nieZnaleziono, dalejPoUploadzie } = require('../pomocnicze/odpowiedzi');

const router = express.Router();
const email = (v) => String(v || '').trim().toLowerCase();

/** Formularz publiczny: zawsze ta sama odpowiedź — nie ujawnia, czy prowadzimy rejestr spółki (D-079). */
router.post('/zgloszenie', asy(async (zad, odp) => {
  limiter.sprawdz(zad.ip, `zgloszenie:${email((zad.body || {}).email)}`);
  limiter.zanotujNieudana(zad.ip, `zgloszenie:${email((zad.body || {}).email)}`);
  await wnioski.zglos(db(), zad.body || {});
  odp.status(202).json({ komunikat: 'Jeśli dane są poprawne, na podany adres wysłaliśmy link do dokończenia zgłoszenia.' });
}));

router.post('/aktywacja', asy(async (zad, odp) => {
  limiter.sprawdz(zad.ip, 'aktywacja');
  const konto = await wnioski.aktywuj(db(), zad.body || {}).catch((e) => { limiter.zanotujNieudana(zad.ip, 'aktywacja'); throw e; });
  autoryzacja.zalogujKonto(zad, odp, konto.id);
  odp.json({ email: konto.email });
}));

router.post('/login', asy(async (zad, odp) => {
  const adres = email((zad.body || {}).email);
  const haslo = String((zad.body || {}).haslo || '');
  limiter.sprawdz(zad.ip, adres);
  const konto = adres ? db().prepare('SELECT * FROM psa_konta WHERE lower(email) = ?').get(adres) : null;
  const pasuje = konto && konto.hash_hasla ? await hasla.zweryfikuj(haslo, konto.hash_hasla) : false;
  if (!konto || !konto.aktywne || !pasuje) {
    limiter.zanotujNieudana(zad.ip, adres);
    throw nieAutoryzowany('Nieprawidłowy e-mail lub hasło.');
  }
  limiter.wyczyscPoUdanej(zad.ip, adres);
  db().prepare('UPDATE psa_konta SET ostatnie_logowanie = ? WHERE id = ?').run(czas.terazIso(), konto.id);
  autoryzacja.zalogujKonto(zad, odp, konto.id);
  odp.json({ email: konto.email });
}));

router.post('/logout', (zad, odp) => {
  autoryzacja.wylogujKonto(zad, odp);
  odp.json({ ok: true });
});

router.get('/ja', asy((zad, odp) => odp.json(zad.konto ? { zalogowany: true, ...portal.ja(db(), zad.konto) } : { zalogowany: false })));

function konto(zad) {
  if (!zad.konto) throw nieAutoryzowany('Zaloguj się do portalu.');
  return zad.konto;
}

/** Wniosek konta — jedyny, jaki to konto widzi, i tylko do jego przyjęcia. */
function wniosekKonta(zad) {
  const id = portal.zakresKonta(db(), konto(zad)).wniosek;
  if (!id) throw nieZnaleziono('Nie ma wniosku powiązanego z tym kontem.');
  return id;
}

router.get('/wniosek', asy((zad, odp) => odp.json(wnioski.widokPortalu(db(), wniosekKonta(zad)))));

router.put('/wniosek', asy((zad, odp) => {
  const id = wniosekKonta(zad);
  const b = zad.body || {};
  wnioski.zmien(db(), id, { dane: b.dane, uchwala: b.uchwala, dotychczasowy_podmiot: b.dotychczasowy_podmiot, data_przejecia: b.data_przejecia }, { przez: 'klient', kto: `konto:${zad.konto.id}` });
  odp.json(wnioski.widokPortalu(db(), id));
}));

router.post('/wniosek/zloz', asy((zad, odp) => {
  const id = wniosekKonta(zad);
  wnioski.zloz(db(), id, `konto:${zad.konto.id}`);
  odp.json(wnioski.widokPortalu(db(), id));
}));

router.post(
  '/wniosek/pliki',
  (zad, odp, dalej) => pliki.odbierz(zad, odp, dalejPoUploadzie(dalej)),
  asy(async (zad, odp) => {
    const id = wniosekKonta(zad);
    await wnioski.wgraj(db(), id, zad.file, (zad.body || {}).dokument, { przez: 'klient', kto: `konto:${zad.konto.id}` });
    odp.status(201).json(wnioski.widokPortalu(db(), id));
  })
);

router.get('/wniosek/dokumenty/:pismo', asy(async (zad, odp) => {
  const p = wnioski.pismoWniosku(db(), wniosekKonta(zad), zad.params.pismo);
  const pdf = await pisma.pdf(db(), p.id);
  odp.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${p.numer.replace(/\//g, '-')}.pdf"`, 'X-Content-Type-Options': 'nosniff' });
  odp.send(pdf);
}));

/** Start: wybrana spółka (`?spolka=`, domyślnie pierwsza z zakresu). */
router.get('/start', asy((zad, odp) => odp.json(portal.start(db(), konto(zad), zad.query.spolka ? Number(zad.query.spolka) : null))));

/** „Zgłoś zmianę”: opis → sprawa; pliki dochodzą osobno (`/sprawy/:id/pliki`). */
router.post('/sprawy', asy((zad, odp) => {
  const b = zad.body || {};
  odp.status(201).json({ id: portal.zglosZmiane(db(), konto(zad), { spolka_id: b.spolka_id, opis: b.opis, klucz: b.klucz }) });
}));

router.post(
  '/sprawy/:id/pliki',
  (zad, odp, dalej) => pliki.odbierz(zad, odp, dalejPoUploadzie(dalej)),
  asy((zad, odp) => odp.status(201).json({ id: portal.dodajPlik(db(), konto(zad), Number(zad.params.id), zad.file) }))
);

router.get('/pisma/:id', asy(async (zad, odp) => {
  const p = portal.pismoKonta(db(), konto(zad), Number(zad.params.id));
  const pdf = await pisma.pdf(db(), p.id);
  odp.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${p.numer.replace(/\//g, '-')}.pdf"`, 'X-Content-Type-Options': 'nosniff' });
  odp.send(pdf);
}));

/** „Zamów informację” — zwraca opłatę, którą front od razu przekazuje do „Zapłać”. Limit: 10 zamówień w 15 minut (§ 7 pkt 11). */
router.post('/informacja', asy((zad, odp) => {
  const b = zad.body || {};
  const k = konto(zad);
  limiter.sprawdz(zad.ip, `informacja:${k.id}`, { limit: 10, bezLicznikaIp: true });
  limiter.zanotujProbe(zad.ip, `informacja:${k.id}`);
  odp.status(201).json({ oplata_id: portal.zamowInformacje(db(), k, { spolka_id: b.spolka_id, dzien: b.dzien || null }) });
}));

router.post('/oplaty/:id/zaplac', asy(async (zad, odp) => odp.json({ link: await portal.zaplac(db(), konto(zad), Number(zad.params.id)) })));

/** „Konto” → „Zapisz”: hasło (z obecnym) i zgoda na korespondencję e-mail. Nowe hasło wylogowuje inne urządzenia. */
router.put('/konto', asy(async (zad, odp) => {
  const k = konto(zad);
  const w = await portal.zmienKonto(db(), k, zad.body || {});
  if (w.hasloZmienione) autoryzacja.zalogujKonto(zad, odp, k.id);
  odp.json(portal.ja(db(), db().prepare('SELECT * FROM psa_konta WHERE id = ?').get(k.id)));
}));

module.exports = router;
