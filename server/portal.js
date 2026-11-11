'use strict';

/**
 * Portal klienta (§ 6, U-23): jedno konto na osobę, zakres z danych. Każda trasa portalu pyta
 * `zakresKonta()` — przy każdym żądaniu, więc odebranie dostępu działa od razu, bez wylogowania:
 *   - osoba działająca za spółkę (`psa_reprezentanci`) — wszystko o spółce, informacja pełna na koszt spółki;
 *     kancelaria dodaje i usuwa ją w kokpicie („Działają za spółkę”);
 *   - akcjonariusz — tylko gdy ma dziś akcje i zgodę na korespondencję e-mail (D-039, D-083): jego sprawy,
 *     pisma i opłaty, informacja bez danych innych akcjonariuszy z art. 300³⁵ § 1¹ na jego koszt;
 *   - osoba w obu rolach — suma zakresów; konto przed przyjęciem wniosku — wyłącznie wniosek.
 */

const konfiguracja = require('./konfiguracja');
const czas = require('./pomocnicze/czas');
const pomocPliki = require('./pomocnicze/pliki');
const { nieZnaleziono } = require('./pomocnicze/odpowiedzi');
const sprawy = require('./sprawy');
const informacje = require('./informacje');
const platnosci = require('./platnosci');
const pisma = require('./logika/pisma');
const hasla = require('./logika/hasla');
const przepisy = require('./logika/przepisy');
const terminy = require('./logika/terminy');
const { BladWalidacji } = require('./logika/walidacje');
const daneKonta = require('./dane/konta');
const daneOsoby = require('./dane/osoby');
const daneSpolki = require('./dane/spolki');
const daneSprawy = require('./dane/sprawy');
const danePisma = require('./dane/pisma');
const daneOplaty = require('./dane/oplaty');
const daneWnioski = require('./dane/wnioski');
const historia = require('./dane/historia');

const kto = (konto) => `konto:${konto.id}`;

/** Zakres konta: wniosek (do przyjęcia) i spółki z rolą — `pelny` (działa za spółkę), `akcjonariusz`. */
function zakresKonta(db, konto) {
  const w = konto.wniosek_id ? daneWnioski.wczytaj(db, konto.wniosek_id) : null;
  const spolki = new Map();
  const osoba = konto.osoba_id ? daneOsoby.wczytaj(db, konto.osoba_id) : null;
  if (osoba) {
    for (const id of daneKonta.spolkiReprezentanta(db, osoba.id)) spolki.set(id, { id, pelny: true, akcjonariusz: false });
    if (osoba.zgoda_email === 1) {
      for (const id of daneKonta.spolkiAkcjonariusza(db, osoba.id)) spolki.set(id, { ...(spolki.get(id) || { id, pelny: false }), akcjonariusz: true });
    }
  }
  return {
    osobaId: osoba ? osoba.id : null,
    wniosek: w && w.stan !== 'przyjety' ? w.id : null,
    spolki: [...spolki.values()].map((z) => {
      const s = daneSpolki.wczytaj(db, z.id);
      return { ...z, nazwa: s.nazwa, krs: s.krs };
    }),
  };
}

/** Spółka z zakresu konta — cudza albo nieistniejąca: 404 (bez ujawniania, czy istnieje). */
function spolkaZakresu(zakres, spolkaId) {
  const z = zakres.spolki.find((x) => x.id === Number(spolkaId));
  if (!z) throw nieZnaleziono('Nie odnaleziono spółki.');
  return z;
}

const widziSprawe = (z, osobaId, s) => s.spolka_id === z.id && (z.pelny || s.zadajacy_osoba_id === osobaId);
/** R9: pismo do spółki — u osób działających za nią, pismo do osoby — na jej koncie; tylko wysłane i ważne. */
const widziPismo = (z, osobaId, p) =>
  p.spolka_id === z.id && p.stan === 'wyslane' && !p.uniewaznione && ((z.pelny && p.adresat === 'spolka') || p.adresat_osoba_id === osobaId);
const widziOplate = (z, osobaId, o) => o.spolka_id === z.id && ((z.pelny && o.platnik === 'spolka') || o.platnik_osoba_id === osobaId);

const opisPisma = (p) => ({ id: p.id, nazwa: pisma.TYPY[p.typ], numer: p.numer, data: czas.dzienLokalny(p.wyslano) });

/** Start: dane spółki, sprawy z pismami, opłaty do zapłaty, wydane informacje, dostępność informacji (U-24). */
function start(db, konto, spolkaId) {
  const zakres = zakresKonta(db, konto);
  const z = spolkaId ? spolkaZakresu(zakres, spolkaId) : zakres.spolki[0];
  if (!z) return { spolka: null };
  const s = daneSpolki.wczytaj(db, z.id);
  const os = zakres.osobaId;
  const widoczne = danePisma.lista(db, { spolkaId: z.id }).filter((p) => widziPismo(z, os, p));
  const sprawyKonta = daneSprawy
    .lista(db, { spolkaId: z.id })
    .filter((sp) => widziSprawe(z, os, sp))
    .map((sp) => ({ id: sp.id, stan: sp.stan, data_wplywu: sp.data_wplywu, opis: sp.podstawa, pisma: widoczne.filter((p) => p.sprawa_id === sp.id).map(opisPisma) }));
  const oplaty = daneOplaty
    .lista(db, { spolkaId: z.id, stan: 'do_zaplaty' })
    .filter((o) => widziOplate(z, os, o))
    .map((o) => ({ id: o.id, rodzaj: o.typ, okres: o.okres, kwota_brutto_grosze: przepisy.obliczBrutto(o.kwota_netto_grosze, o.stawka_vat_procent) }));
  const otwarcie = czas.dzienLokalny(s.data_otwarcia);
  return {
    spolka: { id: s.id, nazwa: s.nazwa, krs: s.krs, siedziba: s.siedziba, adres: s.adres, otwarty: Boolean(otwarcie) && !s.data_zamkniecia, zamkniety: Boolean(s.data_zamkniecia) },
    rola: { pelny: z.pelny, akcjonariusz: z.akcjonariusz },
    sprawy: sprawyKonta,
    oplaty,
    informacje: widoczne.filter((p) => p.typ === 'informacja').map((p) => ({ ...opisPisma(p), stan_na: p.kontekst.stan_na })),
    informacja: {
      dostepna_od: otwarcie ? terminy.dodajDni(otwarcie, 1) : null,
      najwczesniej: otwarcie,
      najpozniej: terminy.dodajDni(czas.dzisIso(), -1),
      kwota_brutto_grosze: przepisy.obliczBrutto(przepisy.STAWKI_GROSZE.INFORMACJA),
    },
  };
}

/** „Zgłoś zmianę”: opis (+ pliki osobno) → sprawa w toku. Żądający: spółka, gdy osoba działa za nią, inaczej ta osoba. */
function zglosZmiane(db, konto, { spolka_id: spolkaId, opis, klucz }) {
  const z = spolkaZakresu(zakresKonta(db, konto), spolkaId);
  const s = daneSpolki.wczytaj(db, z.id);
  if (!s.data_otwarcia || s.data_zamkniecia) throw new BladWalidacji(['Rejestr spółki nie jest prowadzony — napisz do kancelarii.']);
  const tresc = String(opis || '').trim();
  if (tresc.length < 5) throw new BladWalidacji([{ pole: 'opis', komunikat: 'Opisz krótko, co się zmieniło.' }]);
  if (tresc.length > 2000) throw new BladWalidacji([{ pole: 'opis', komunikat: 'Opis może mieć najwyżej 2000 znaków.' }]);
  const { id } = sprawy.zaloz(
    db,
    {
      spolka_id: z.id,
      zadajacy: z.pelny ? 'spolka' : 'osoba',
      zadajacy_osoba_id: z.pelny ? null : konto.osoba_id,
      podstawa: tresc,
      operacje: [],
      klucz_idempotencji: klucz ? `portal-${konto.id}-${String(klucz).slice(0, 64)}` : null,
    },
    kto(konto)
  );
  return id;
}

/** Plik do własnej sprawy w toku albo wstrzymanej („Dodaj pliki” przy „Wymaga uzupełnienia”). */
function dodajPlik(db, konto, sprawaId, plik) {
  const zakres = zakresKonta(db, konto);
  const sp = daneSprawy.wczytaj(db, sprawaId);
  const z = sp && zakres.spolki.find((x) => x.id === sp.spolka_id);
  if (!z || !widziSprawe(z, zakres.osobaId, sp)) throw nieZnaleziono('Nie odnaleziono sprawy.');
  if (!['w_toku', 'wstrzymana'].includes(sp.stan)) throw new BladWalidacji(['Sprawa jest zakończona — pliki dołącz do nowego zgłoszenia.']);
  return pomocPliki.przyjmij(db, plik, { spolka_id: sp.spolka_id, sprawa_id: sp.id }, kto(konto));
}

/** Pismo widoczne dla konta — do pobrania. */
function pismoKonta(db, konto, pismoId) {
  const zakres = zakresKonta(db, konto);
  const p = danePisma.wczytaj(db, pismoId);
  const z = p && zakres.spolki.find((x) => x.id === p.spolka_id);
  if (!z || !widziPismo(z, zakres.osobaId, p)) throw nieZnaleziono('Nie odnaleziono pisma.');
  return p;
}

/**
 * „Zamów informację” (U-24): stan na koniec wybranego dnia, płatna z góry. Osoba działająca za spółkę —
 * pełna (płaci spółka), akcjonariusz — bez danych innych (płaci on). Niezapłacone zamówienie na ten
 * sam dzień wraca zamiast nowego długu (dwuklik). Zwraca id opłaty.
 */
function zamowInformacje(db, konto, { spolka_id: spolkaId, dzien }) {
  const z = spolkaZakresu(zakresKonta(db, konto), spolkaId);
  const odbiorca = z.pelny ? { rodzaj: 'spolka' } : { rodzaj: 'osoba', osobaId: konto.osoba_id };
  const d = dzien || terminy.dodajDni(czas.dzisIso(), -1);
  const czeka = daneOplaty
    .lista(db, { spolkaId: z.id, stan: 'do_zaplaty' })
    .filter((o) => o.typ === 'informacja' && o.pismo_id)
    .find((o) => {
      const p = danePisma.wczytaj(db, o.pismo_id);
      return p.kanal === 'portal' && p.adresat === (z.pelny ? 'spolka' : 'osoba') && p.adresat_osoba_id === (z.pelny ? null : konto.osoba_id) && p.kontekst.stan_na === pisma.dataPl(d);
    });
  if (czeka) return czeka.id;
  const { pismoId } = informacje.wydajInformacje(db, { spolkaId: z.id, odbiorca, dzien: d, zrodlo: 'portal', kto: kto(konto) });
  return db.prepare('SELECT id FROM psa_oplaty WHERE pismo_id = ?').get(pismoId).id;
}

/** „Zapłać [kwota]” — link do tpay dla opłaty widocznej dla konta. */
async function zaplac(db, konto, oplataId) {
  const zakres = zakresKonta(db, konto);
  const o = daneOplaty.wczytaj(db, oplataId);
  const z = o && zakres.spolki.find((x) => x.id === o.spolka_id);
  if (!z || !widziOplate(z, zakres.osobaId, o)) throw nieZnaleziono('Nie odnaleziono opłaty.');
  if (o.stan !== 'do_zaplaty') throw new BladWalidacji(['Ta opłata jest już rozliczona.']);
  try {
    const { platnosc } = await platnosci.przygotujZaplate(db, {
      oplataId: o.id,
      urlPowiadomienia: new URL('/api/psa/platnosci/tpay/itn', konfiguracja.URL_PORTALU).toString(),
      urlPowrotu: `${konfiguracja.URL_PORTALU}#/?spolka=${o.spolka_id}&platnosc=${o.id}`,
    });
    return platnosc.link;
  } catch (e) {
    console.error(`[psa] portal — płatność opłaty ${o.id}: ${e.message}`);
    throw new BladWalidacji(['Płatność online jest chwilowo niedostępna — spróbuj później albo napisz do kancelarii.']);
  }
}

/** Konto: dane do ekranu „Konto” i nagłówka portalu. */
function ja(db, konto) {
  const zakres = zakresKonta(db, konto);
  const osoba = zakres.osobaId ? daneOsoby.wczytaj(db, zakres.osobaId) : null;
  return {
    email: konto.email,
    wniosek: zakres.wniosek,
    spolki: zakres.spolki,
    akcjonariusz: Boolean(osoba) && daneKonta.spolkiAkcjonariusza(db, osoba.id).length > 0,
    zgoda_email: osoba ? osoba.zgoda_email === 1 : false,
  };
}

/** „Konto” → „Zapisz”: zmiana hasła (z obecnym hasłem) i zgoda na korespondencję e-mail (U-11, D-083). */
async function zmienKonto(db, konto, { haslo_obecne: obecne, haslo_nowe: nowe, zgoda_email: zgoda }) {
  const bledy = [];
  if (nowe) {
    if (!(await hasla.zweryfikuj(String(obecne || ''), konto.hash_hasla))) bledy.push({ pole: 'haslo_obecne', komunikat: 'Obecne hasło jest nieprawidłowe.' });
    const ocena = hasla.ocenSile(String(nowe));
    if (!ocena.ok) bledy.push({ pole: 'haslo_nowe', komunikat: ocena.powod });
  }
  const osoba = konto.osoba_id ? daneOsoby.wczytaj(db, konto.osoba_id) : null;
  if (typeof zgoda === 'boolean' && !osoba) bledy.push({ pole: 'zgoda_email', komunikat: 'Zgodę składa się po przyjęciu wniosku.' });
  if (bledy.length) throw new BladWalidacji(bledy);
  const hash = nowe ? await hasla.hashuj(String(nowe)) : null;
  db.transaction(() => {
    if (hash) daneKonta.zmienHaslo(db, konto.id, hash);
    if (typeof zgoda === 'boolean' && (osoba.zgoda_email === 1) !== zgoda) {
      if (zgoda && !osoba.email) daneOsoby.zmien(db, osoba.id, { email: konto.email }, kto(konto));
      daneOsoby.ustawZgodeEmail(db, osoba.id, { zgoda, data: czas.dzisIso() }, kto(konto));
    }
  })();
  return { hasloZmienione: Boolean(hash) };
}

/** Konto osoby w portalu — do karty osoby: adres, stan, zakres. */
function kontoOsoby(db, osobaId) {
  const konto = daneKonta.poOsobie(db, osobaId);
  if (!konto) return null;
  const zakres = zakresKonta(db, konto);
  return { email: konto.email, aktywne: konto.aktywne === 1, ostatnie_logowanie: konto.ostatnie_logowanie, spolki: zakres.spolki };
}

/**
 * „Zaproś do portalu” (karta osoby): osoba działająca za spółkę albo akcjonariusz ze zgodą na e-mail.
 * Zakłada konto (adres z karty osoby) albo — gdy już jest — wysyła nowy link do ustawienia hasła.
 * E-mail bez danych osobowych; ślad w historii osoby.
 */
async function zapros(db, osobaId, autor, { poczta = require('./poczta') } = {}) {
  const wnioski = require('./wnioski');
  const osoba = daneOsoby.wczytaj(db, osobaId);
  if (!osoba) throw nieZnaleziono('Nie odnaleziono osoby.');
  if (!osoba.email) throw new BladWalidacji([{ pole: 'email', komunikat: 'Podaj adres e-mail osoby.' }]);
  const reprezentant = daneKonta.spolkiReprezentanta(db, osoba.id).length > 0;
  const akcjonariusz = osoba.zgoda_email === 1 && daneKonta.spolkiAkcjonariusza(db, osoba.id).length > 0;
  if (!reprezentant && !akcjonariusz) {
    throw new BladWalidacji(['Do portalu zaprasza się osobę działającą za spółkę albo akcjonariusza ze zgodą na korespondencję e-mail.']);
  }
  const link = db.transaction(() => {
    const email = osoba.email.trim().toLowerCase();
    const zAdresem = daneKonta.poEmailu(db, email);
    let konto = daneKonta.poOsobie(db, osoba.id);
    if (zAdresem && (!konto || zAdresem.id !== konto.id)) throw new BladWalidacji([{ pole: 'email', komunikat: 'Ten adres e-mail ma już konto w portalu innej osoby albo wniosku.' }]);
    if (!konto) konto = daneKonta.wczytaj(db, daneKonta.dodaj(db, { email, osoba_id: osoba.id }));
    else if (konto.email !== email) daneKonta.zmienEmail(db, konto.id, email);
    historia.dopiszZmiany(db, { osobaId: osoba.id, przed: {}, po: { zaproszenie_do_portalu: email }, pola: ['zaproszenie_do_portalu'], kto: autor });
    return wnioski.nowyLinkAktywacji(db, konto.id);
  })();
  await poczta.wyslij({
    do: osoba.email,
    temat: 'Rejestr akcjonariuszy — zaproszenie do portalu',
    tekst: `Dzień dobry,\n\nzapraszamy do portalu rejestru akcjonariuszy. Aby ustawić hasło, otwórz link: ${link}\n\nLink jest ważny 7 dni.\n\nKancelaria Notarialna`,
  });
}

/** „Działają za spółkę” w kokpicie: dodanie albo usunięcie osoby — od razu zmienia zakres jej konta. */
function dodajReprezentanta(db, spolkaId, osobaId, autor) {
  const osoba = daneOsoby.wczytaj(db, osobaId);
  if (!osoba) throw new BladWalidacji([{ pole: 'osoba_id', komunikat: 'Wybierz osobę z kartoteki.' }]);
  db.transaction(() => {
    if (daneKonta.dodajReprezentanta(db, spolkaId, osoba.id)) {
      historia.dopiszZmiany(db, { spolkaId: Number(spolkaId), przed: {}, po: { dzialaja_za_spolke: `${osoba.nazwa} — dodano` }, pola: ['dzialaja_za_spolke'], kto: autor });
    }
  })();
}

function usunReprezentanta(db, spolkaId, osobaId, autor) {
  const osoba = daneOsoby.wczytaj(db, osobaId);
  db.transaction(() => {
    if (!osoba || !daneKonta.usunReprezentanta(db, spolkaId, osoba.id)) throw nieZnaleziono('Ta osoba nie działa za spółkę.');
    historia.dopiszZmiany(db, { spolkaId: Number(spolkaId), przed: {}, po: { dzialaja_za_spolke: `${osoba.nazwa} — usunięto` }, pola: ['dzialaja_za_spolke'], kto: autor });
  })();
}

module.exports = { zakresKonta, start, zglosZmiane, dodajPlik, pismoKonta, zamowInformacje, zaplac, ja, zmienKonto, kontoOsoby, zapros, dodajReprezentanta, usunReprezentanta };
