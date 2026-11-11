'use strict';

/**
 * Portal klienta — Faza 4: zgłoszenie spółki (formularz publiczny, U-08), aktywacja konta, logowanie
 * i wniosek (dane → dokumenty). Konto przed przyjęciem wniosku widzi wyłącznie swój wniosek (§ 7 pkt 2).
 * Start, zgłaszanie zmian, informacja z rejestru i płatności — Faza 5.
 */

const express = require('express');

const { db } = require('../baza');
const czas = require('../pomocnicze/czas');
const wnioski = require('../wnioski');
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

router.get('/ja', (zad, odp) => odp.json({ zalogowany: Boolean(zad.konto), email: zad.konto ? zad.konto.email : null, wniosek: zad.konto ? zad.konto.wniosek_id : null }));

/** Wniosek konta — jedyny, jaki to konto widzi. */
function wniosekKonta(zad) {
  if (!zad.konto) throw nieAutoryzowany('Zaloguj się do portalu.');
  if (!zad.konto.wniosek_id) throw nieZnaleziono('Nie ma wniosku powiązanego z tym kontem.');
  return zad.konto.wniosek_id;
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

module.exports = router;
