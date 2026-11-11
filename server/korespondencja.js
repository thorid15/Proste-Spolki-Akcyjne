'use strict';

/**
 * Korespondencja (U-09): jedno miejsce dla wszystkiego, co wychodzi z rejestru. Wysyła zawsze
 * pracownik po podglądzie: e-mail z PDF w załączniku (U-10) albo list — „Nadano” (U-28).
 * Treść e-maila krótka, bez danych osobowych; pismo jest w załączniku.
 */

const pisma = require('./logika/pisma');
const danePisma = require('./dane/pisma');
const daneOsoby = require('./dane/osoby');
const daneSpolki = require('./dane/spolki');
const { BladWalidacji } = require('./logika/walidacje');

const FILTRY = ['do_wyslania', 'listy', 'bledy', 'wyslane'];

function wiersz(p) {
  return {
    id: p.id,
    numer: p.numer,
    typ: p.typ,
    pismo: pisma.TYPY[p.typ],
    spolka_id: p.spolka_id,
    spolka: p.spolka_nazwa || null,
    sprawa_id: p.sprawa_id,
    adresat: p.adresat,
    adresat_nazwa: p.kontekst.adresat_nazwa || p.adresat_opis || null,
    kanal: p.kanal,
    stan: p.stan,
    utworzono: p.utworzono,
    wyslano: p.wyslano,
  };
}

function lista(db, { filtr = 'do_wyslania' } = {}) {
  if (!FILTRY.includes(filtr)) throw new BladWalidacji([{ pole: 'filtr', komunikat: 'Nieznany filtr korespondencji.' }]);
  return danePisma.korespondencja(db, filtr).map(wiersz);
}

/** Adres e-mail adresata (R9): osoba ze zgodą albo spółka z adresem z umowy. */
function adresEmail(db, p) {
  if (p.adresat === 'osoba') {
    const o = daneOsoby.wczytaj(db, p.adresat_osoba_id);
    return o && o.zgoda_email ? o.email : null;
  }
  if (p.adresat === 'spolka') return (daneSpolki.wczytaj(db, p.spolka_id) || {}).email || null;
  return null;
}

/** U-10: krótka treść bez danych osobowych — samo pismo jest w załączniku. */
function trescEmaila(p) {
  const k = p.kontekst;
  const nazwa = pisma.TYPY[p.typ];
  return {
    temat: `${nazwa} nr ${p.numer}`,
    tekst: [
      'Dzień dobry,',
      '',
      `w załączniku przesyłamy pismo „${nazwa}” nr ${p.numer}${k.spolka_firma ? ` dotyczące rejestru akcjonariuszy spółki ${k.spolka_firma}` : ''}.`,
      '',
      `Kancelaria Notarialna, notariusz ${k.notariusz}`,
      k.kancelaria_adres,
    ].join('\n'),
  };
}

function szczegoly(db, id) {
  const p = pisma.wczytaj(db, id);
  const s = p.spolka_id ? daneSpolki.wczytaj(db, p.spolka_id) : null;
  return {
    ...wiersz({ ...p, spolka_nazwa: s && s.nazwa }),
    adresat_adres: p.kontekst.adresat_adres || null,
    email: p.kanal === 'email' ? adresEmail(db, p) : null,
    ...trescEmaila(p),
    id_wiadomosci: p.id_wiadomosci,
    odpowiedz_serwera: p.odpowiedz_serwera,
  };
}

/** „Wyślij” / „Wyślij ponownie” (e-mail). Odmowa serwera poczty → stan „blad” z jego odpowiedzią. */
async function wyslij(db, id, { poczta = require('./poczta') } = {}) {
  const p = pisma.wczytaj(db, id);
  if (p.kanal !== 'email') throw new BladWalidacji(['To pismo idzie listem — po nadaniu kliknij „Nadano”.']);
  if (!pisma.PRZEJSCIA[p.stan].includes('wyslane')) throw new BladWalidacji([`Pismo w stanie „${p.stan}” nie może być wysłane.`]);
  const pdf = await pisma.pdf(db, id);
  const { temat, tekst } = trescEmaila(p);
  const w = await poczta.wyslij({
    do: adresEmail(db, p),
    temat,
    tekst,
    zalaczniki: [{ filename: `${p.numer.replace(/\//g, '-')}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
  if (w.wyslano) {
    return pisma.zmienStan(db, id, 'wyslane', { idWiadomosci: w.idWiadomosci || null, odpowiedzSerwera: w.odpowiedz || w.powod || null });
  }
  return pisma.zmienStan(db, id, 'blad', { odpowiedzSerwera: w.powod || w.status || 'Wysyłka nie powiodła się.' });
}

module.exports = { FILTRY, lista, szczegoly, wyslij, nadano: pisma.nadano };
