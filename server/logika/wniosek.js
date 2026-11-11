'use strict';

/**
 * Wniosek o prowadzenie rejestru (Faza 4): jeden schemat danych dla portalu i kancelarii, dokumenty
 * z U-03 (każdy ze stanem — § 3.3), checklista i przeszkody przyjęcia, treść dokumentów do podpisu.
 * Bez dostępu do bazy — operacje są w `server/wnioski.js`.
 */

const czas = require('../pomocnicze/czas');
const osobyLogika = require('./osoby');
const przepisy = require('./przepisy');
const { BladWalidacji } = require('./walidacje');

const PRZEJSCIA = {
  roboczy: ['zlozony'],
  zlozony: ['roboczy', 'przyjety', 'odrzucony'],
  przyjety: [],
  odrzucony: [],
};

function sprawdzPrzejscie(z, na) {
  if (!(PRZEJSCIA[z] || []).includes(na)) throw new BladWalidacji([`Wniosek w stanie „${z}” nie może przejść do stanu „${na}”.`]);
}

const PUSTE = () => ({
  spolka: { nazwa: '', siedziba: '', adres: '', sad_rejestrowy: '', data_rejestracji: '', nip: '', email: '' },
  reprezentant: { nazwa: '', pesel: '', data_urodzenia: '', adres: '', email: '', funkcja: '', pep: false, pep_opis: '' },
  akcjonariusze: [],
  platnosc: 'roczna',
  uchwala: 'podpisana',
});

const UCHWALA = ['podpisana', 'wlasna', 'w_umowie'];
const tekst = (v) => (v == null ? '' : String(v).trim());
const nowyKlucz = () => Math.random().toString(36).slice(2, 10);

/** Odpis KRS → dane spółki we wniosku (do poprawienia przez klienta). */
function zKrs(k) {
  if (!k || !k.nazwa) return {};
  const ulica = [k.ulica, [k.nr_domu, k.nr_lokalu].filter(Boolean).join('/')].filter(Boolean).join(' ');
  return {
    nazwa: k.nazwa,
    siedziba: k.miejscowosc || '',
    adres: [ulica, [k.kod_pocztowy, k.miejscowosc].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    sad_rejestrowy: [k.sad_rejestrowy, k.wydzial].filter(Boolean).join(', '),
    data_rejestracji: k.data_utworzenia_spolki || '',
    nip: k.nip || '',
    email: k.email || '',
  };
}

/** Osoba z wniosku → pola kartoteki (`logika/osoby.sprawdz`). */
const naOsobe = (o, typ = 'fizyczna') => ({
  typ: o.typ || typ,
  nazwa: o.nazwa,
  pesel: o.pesel,
  data_urodzenia: o.data_urodzenia,
  numer_rejestru: o.numer_rejestru,
  adres: o.adres,
  rodzaj_adresu: o.rodzaj_adresu || 'glowny',
  email: o.email,
});

/**
 * Normalizuje dane wniosku i zwraca błędy przy polach (kompletność — przy złożeniu). Wejście z portalu
 * i z kancelarii idzie przez tę samą funkcję.
 */
function sprawdzDane(we = {}, { przejecie = false, dotychczasowyPodmiot = null } = {}) {
  const p = PUSTE();
  const s = { ...p.spolka, ...Object.fromEntries(Object.entries(we.spolka || {}).map(([k, v]) => [k, tekst(v)])) };
  const r0 = we.reprezentant || {};
  const r = { ...p.reprezentant, ...Object.fromEntries(Object.entries(r0).map(([k, v]) => [k, typeof v === 'boolean' ? v : tekst(v)])), pep: Boolean(r0.pep) };
  if (!r.pep) r.pep_opis = '';
  const akcjonariusze = (Array.isArray(we.akcjonariusze) ? we.akcjonariusze : []).map((a) => ({
    klucz: tekst(a.klucz) || nowyKlucz(),
    typ: a.typ === 'prawna' ? 'prawna' : 'fizyczna',
    nazwa: tekst(a.nazwa),
    pesel: tekst(a.pesel),
    data_urodzenia: tekst(a.data_urodzenia),
    numer_rejestru: tekst(a.numer_rejestru),
    adres: tekst(a.adres),
    rodzaj_adresu: a.rodzaj_adresu === 'doreczen' ? 'doreczen' : 'glowny',
    email: tekst(a.email),
    to_ja: Boolean(a.to_ja),
    zgoda_email: Boolean(a.to_ja && a.zgoda_email),
  }));
  const dane = {
    spolka: s,
    reprezentant: r,
    akcjonariusze,
    platnosc: we.platnosc === 'miesieczna' ? 'miesieczna' : 'roczna',
    uchwala: UCHWALA.includes(we.uchwala) ? we.uchwala : 'podpisana',
  };

  const bledy = [];
  const blad = (pole, komunikat) => bledy.push({ pole, komunikat });
  for (const [pole, nazwa] of [['nazwa', 'firmę'], ['siedziba', 'siedzibę'], ['adres', 'adres'], ['sad_rejestrowy', 'sąd rejestrowy']]) {
    if (!s[pole]) blad(`spolka.${pole}`, `Podaj ${nazwa} spółki.`);
  }
  if (!czas.poprawnaData(s.data_rejestracji) || s.data_rejestracji > czas.dzisIso()) blad('spolka.data_rejestracji', 'Podaj datę rejestracji spółki w KRS.');
  if (s.nip && !/^\d{10}$/.test(s.nip.replace(/\D/g, ''))) blad('spolka.nip', 'NIP to 10 cyfr.');
  if (s.email && !osobyLogika.EMAIL.test(s.email)) blad('spolka.email', 'Nieprawidłowy adres e-mail.');

  const osoba = (o, prefiks, typ) => {
    for (const b of osobyLogika.sprawdz(naOsobe(o, typ)).bledy) blad(`${prefiks}.${b.pole}`, b.komunikat);
    if (!o.email) blad(`${prefiks}.email`, 'Podaj adres e-mail.');
  };
  osoba(r, 'reprezentant', 'fizyczna');
  if (r.pep && !r.pep_opis) blad('reprezentant.pep_opis', 'Opisz stanowisko albo powiązanie.');
  if (akcjonariusze.length === 0) blad('akcjonariusze', 'Dodaj akcjonariuszy spółki.');
  akcjonariusze.forEach((a, i) => osoba(a, `akcjonariusze.${i}`));
  if (akcjonariusze.filter((a) => a.to_ja).length > 1) blad('akcjonariusze', '„To ja” można zaznaczyć tylko przy jednym akcjonariuszu.');
  if (przejecie && !tekst(dotychczasowyPodmiot)) blad('dotychczasowy_podmiot', 'Podaj, kto dotąd prowadził rejestr akcjonariuszy.');
  return { dane, bledy };
}

/**
 * Dokumenty wniosku (U-03): umowa spółki (wgrana), umowa o prowadzenie rejestru, uchwała (gdy klient
 * nie ma własnej i wybór nie wynika z umowy spółki), zgody na e-mail akcjonariuszy bez konta.
 */
function dokumenty(w, pisma, pliki) {
  const d = w.dane;
  const lista = [{ klucz: 'umowa_spolki', nazwa: 'Umowa spółki (aktualna)', podpis: false }];
  lista.push({ klucz: 'umowa', nazwa: 'Umowa o prowadzenie rejestru akcjonariuszy', podpis: true, pismo: 'umowa' });
  if (d.uchwala === 'podpisana') lista.push({ klucz: 'uchwala', nazwa: 'Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr', podpis: true, pismo: 'uchwala' });
  if (d.uchwala === 'wlasna') lista.push({ klucz: 'uchwala_wlasna', nazwa: 'Uchwała akcjonariuszy o wyborze podmiotu (własna)', podpis: false });
  for (const a of d.akcjonariusze || []) {
    if (!a.to_ja) lista.push({ klucz: `zgoda:${a.klucz}`, nazwa: `Zgoda na korespondencję e-mail — ${a.nazwa}`, podpis: true, pismo: 'zgoda_email' });
  }
  return lista.map((dok) => {
    const plik = pliki.find((f) => f.dokument === dok.klucz) || null;
    const pismo = dok.pismo ? pisma.find((x) => x.typ === dok.pismo && x.adresat_opis === dok.klucz) || null : null;
    const stan = plik ? plik.stan_podpisu || 'wgrany' : dok.podpis ? 'do_podpisu' : 'brak';
    const wynik = { ...dok, stan, plik, pismo_id: pismo ? pismo.id : null };
    if (dok.klucz === 'umowa') wynik.notariusz = pliki.find((f) => f.dokument === 'umowa_notariusz') || null;
    return wynik;
  });
}

/** Checklista przyjęcia wniosku; „zgody” pokazuje brakujące. */
function checklista(w, doks) {
  const brakZgod = doks.filter((x) => x.klucz.startsWith('zgoda:') && x.stan !== 'potwierdzony').map((x) => x.nazwa.replace(/^Zgoda na korespondencję e-mail — /, ''));
  const pozycje = [
    { klucz: 'reprezentacja', etykieta: 'Reprezentacja spółki zgodna z KRS' },
    {
      klucz: 'uchwala',
      etykieta: { podpisana: 'Uchwała o wyborze podmiotu podpisana przez akcjonariuszy', wlasna: 'Własna uchwała o wyborze podmiotu sprawdzona', w_umowie: 'Wybór podmiotu wynika z umowy spółki' }[w.dane.uchwala],
    },
    { klucz: 'zgody', etykieta: brakZgod.length ? `Zgody na e-mail sprawdzone — brak: ${brakZgod.join(', ')} (korespondencja listem)` : 'Zgody na e-mail sprawdzone' },
  ];
  if (w.przejecie) {
    pozycje.push({ klucz: 'przejecie_umowa', etykieta: 'Rozwiązanie dotychczasowej umowy i data przejęcia potwierdzone' });
    pozycje.push({ klucz: 'przejecie_rejestr', etykieta: 'Rejestr i dokumenty od poprzednika otrzymane' });
  }
  return pozycje.map((p) => ({ ...p, zaznaczona: Boolean((w.checklista || {})[p.klucz]) }));
}

/** Co blokuje „Przyjmij” — lista komunikatów (pusta = można przyjąć). */
function przeszkodyPrzyjecia(w, doks, lista) {
  const p = [];
  if (w.stan !== 'zlozony') p.push('Wniosek nie jest złożony.');
  const dok = (k) => doks.find((x) => x.klucz === k);
  if (dok('umowa_spolki').stan === 'brak') p.push('Brak umowy spółki.');
  if (dok('umowa').stan !== 'potwierdzony') p.push('Podpis spółki na umowie o prowadzenie rejestru nie jest potwierdzony.');
  if (!dok('umowa').notariusz || !w.umowe_zawarl) p.push('Wgraj umowę z podpisem notariusza i wskaż osobę zawierającą umowę.');
  if (dok('uchwala') && dok('uchwala').stan !== 'potwierdzony') p.push('Podpisy na uchwale nie są potwierdzone.');
  if (dok('uchwala_wlasna') && dok('uchwala_wlasna').stan === 'brak') p.push('Brak własnej uchwały o wyborze podmiotu.');
  const niezaznaczone = lista.filter((x) => !x.zaznaczona);
  if (niezaznaczone.length) p.push(`Odhacz checklistę: ${niezaznaczone.map((x) => x.etykieta.split(' — ')[0]).join('; ')}.`);
  return p;
}

const KWOTY_SLOWNIE = { 120000: 'tysiąc dwieście złotych', 10000: 'sto złotych', 5000: 'pięćdziesiąt złotych' };
const zl = (grosze) => String(grosze / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const dataPl = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

/** Pola wzorów umowy, uchwały i zgody z danych wniosku (spółki jeszcze nie ma w bazie). */
function kontekstDokumentu(w, typ, akcjonariusz = null) {
  const d = w.dane;
  const s = d.spolka;
  const r = d.reprezentant;
  const wspolne = { spolka_firma: s.nazwa, spolka_siedziba: s.siedziba, spolka_adres: s.adres, spolka_sad: s.sad_rejestrowy, spolka_krs: w.krs };
  if (typ === 'zgoda_email') {
    return { ...wspolne, akcjonariusz: akcjonariusz.nazwa, akcjonariusz_adres: akcjonariusz.adres, akcjonariusz_email: akcjonariusz.email, adresat_nazwa: akcjonariusz.nazwa };
  }
  if (typ === 'uchwala') {
    return { ...wspolne, uchwala_data: dataPl(czas.dzisIso()), akcjonariusze: d.akcjonariusze.map((a) => ({ nazwa: a.nazwa })), adresat_nazwa: s.nazwa };
  }
  const st = przepisy.STAWKI_GROSZE;
  return {
    ...wspolne,
    adresat_nazwa: s.nazwa,
    umowa_data: dataPl(czas.dzisIso()),
    spolka_nip: s.nip || null,
    spolka_email: s.email || null,
    reprezentant: r.nazwa,
    reprezentant_pesel: r.pesel || (r.data_urodzenia ? `ur. ${dataPl(r.data_urodzenia)}` : ''),
    reprezentant_adres: r.adres,
    reprezentant_funkcja: r.funkcja || 'członek organu',
    reprezentant_reprezentacja: (w.krs_dane && w.krs_dane.reprezentant_reprezentacja) || 'zgodnie z KRS',
    pep: r.pep,
    pep_opis: r.pep_opis || '',
    przejecie: w.przejecie,
    dotychczasowy_podmiot: w.dotychczasowy_podmiot || '',
    data_przejecia: dataPl(w.data_przejecia),
    platnosc_miesieczna: d.platnosc === 'miesieczna',
    taksa_roczna: zl(st.PROWADZENIE_ROCZNIE),
    taksa_roczna_slownie: KWOTY_SLOWNIE[st.PROWADZENIE_ROCZNIE],
    taksa_wpis: zl(st.WPIS),
    taksa_wpis_slownie: KWOTY_SLOWNIE[st.WPIS],
    taksa_informacja: zl(st.INFORMACJA),
    taksa_informacja_slownie: KWOTY_SLOWNIE[st.INFORMACJA],
    taksa_miesieczna: zl(st.PROWADZENIE_MIESIECZNIE),
    taksa_miesieczna_slownie: KWOTY_SLOWNIE[st.PROWADZENIE_MIESIECZNIE],
  };
}

module.exports = { PRZEJSCIA, sprawdzPrzejscie, PUSTE, zKrs, naOsobe, sprawdzDane, dokumenty, checklista, przeszkodyPrzyjecia, kontekstDokumentu };
