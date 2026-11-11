'use strict';

/**
 * Ustawienia kancelarii — metryka edytowalna z aplikacji. Stawki są stałymi w `przepisy.js` (U-05).
 *
 * Jedyne źródło danych kancelarii (dane do pism, stopka, osoby zawierające umowy) — ekran Ustawienia,
 * z historią zmian w dzienniku. Pole nieustawione jest puste.
 *
 * Czego tu NIE MA: sekretow. Klucze tpay, sekret sesji i dane SMTP zostaja
 * w `.env` — baza trafia do kopii zapasowych i eksportow.
 */

const czas = require('../pomocnicze/czas');

/**
 * Klucze metryki kancelarii wraz ze zrodlem wartosci domyslnej.
 * `etykieta` i `podpowiedz` sluza ekranowi konfiguracji — jedno miejsce
 * opisuje pole, zamiast dwoch list rozjezdzajacych sie po pierwszej zmianie.
 */
const POLA_KANCELARII = [
  { klucz: 'nazwa', etykieta: 'Nazwa kancelarii', wymagane: true,
    podpowiedz: 'Pełna nazwa, tak jak ma stać w nagłówku umowy.' },
  { klucz: 'notariusz_mianownik', etykieta: 'Notariusz', wymagane: true,
    podpowiedz: 'Imię i nazwisko w mianowniku.' },
  { klucz: 'podpisujacy_mianownik', etykieta: 'Podpisujący dokumenty',
    podpowiedz: 'Gdy dokumenty podpisuje zastępca — jego imię i nazwisko.' },
  { klucz: 'podpisujacy_funkcja', etykieta: 'Funkcja podpisującego',
    podpowiedz: 'Notariusz, zastępca notarialny, osoba upoważniona.' },
  { klucz: 'kancelaria_ulica', etykieta: 'Ulica i numer', wymagane: true },
  { klucz: 'kancelaria_kod', etykieta: 'Kod pocztowy', wymagane: true, format: 'kod' },
  { klucz: 'kancelaria_miasto', etykieta: 'Miejscowość', wymagane: true },
  { klucz: 'kancelaria_nip', etykieta: 'NIP', wymagane: true, format: 'nip' },
  { klucz: 'kancelaria_regon', etykieta: 'REGON', format: 'regon' },
  { klucz: 'telefon', etykieta: 'Telefon' },
  { klucz: 'email', etykieta: 'E-mail kancelarii', format: 'email',
    podpowiedz: 'Adres podawany w umowach i pismach.' },
  { klucz: 'www', etykieta: 'Strona kancelarii', format: 'url' },
  { klucz: 'osoby_zawierajace_umowy', etykieta: 'Osoby zawierające umowy', wielowierszowe: true,
    podpowiedz: 'Imię i nazwisko z funkcją, jedna osoba w wierszu — wybór przy podpisie notariusza na umowie.' },
];

const KLUCZE_KANCELARII = new Set(POLA_KANCELARII.map((p) => p.klucz));

/** Surowe wartosci z bazy — tylko te, ktore ktos swiadomie ustawil. */
function zBazy(db) {
  const wynik = {};
  for (const w of db.prepare('SELECT klucz, wartosc FROM psa_ustawienia').all()) {
    wynik[w.klucz] = w.wartosc;
  }
  return wynik;
}

/** Metryka kancelarii — jedyne źródło: `psa_ustawienia` (ekran Ustawienia); puste pola mają wartość ''. */
function kancelaria(db) {
  const ustawione = zBazy(db);
  const wynik = { ...Object.fromEntries([...KLUCZE_KANCELARII].map((k) => [k, ''])), nazwa: 'Kancelaria Notarialna', podpisujacy_funkcja: 'Notariusz' };
  for (const klucz of KLUCZE_KANCELARII) {
    if (ustawione[klucz] != null && String(ustawione[klucz]).trim() !== '') {
      wynik[klucz] = ustawione[klucz];
    }
  }
  // Pola zlozone, ktorych wzory i stopka uzywaja obok atomowych.
  if (!wynik.miejscowosc) wynik.miejscowosc = wynik.kancelaria_miasto || '';
  if (!wynik.adres) {
    wynik.adres = [wynik.kancelaria_ulica, [wynik.kancelaria_kod, wynik.kancelaria_miasto]
      .filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  if (!wynik.podpisujacy_mianownik) wynik.podpisujacy_mianownik = wynik.notariusz_mianownik;
  if (!wynik.www_psa) wynik.www_psa = wynik.www;
  return wynik;
}

/** Wszystko, czego potrzebuje ekran konfiguracji: wartosci + skad pochodza. */
function doEkranu(db) {
  const ustawione = zBazy(db);
  const metryka = kancelaria(db);
  const pole = (p) => ({
    ...p,
    wartosc: metryka[p.klucz] ?? '',
    z_bazy: Object.prototype.hasOwnProperty.call(ustawione, p.klucz),
  });
  return {
    kancelaria: POLA_KANCELARII.map(pole),
  };
}

/** Bledy blokujace zapis. Pusta lista = w porzadku. */
function bledy(zmiany) {
  const lista = [];
  const cyfry = (v) => String(v || '').replace(/\D/g, '');

  for (const p of POLA_KANCELARII) {
    if (!(p.klucz in zmiany)) continue;
    const wartosc = String(zmiany[p.klucz] ?? '').trim();
    if (p.wymagane && !wartosc) {
      lista.push(`Pole „${p.etykieta}” jest wymagane — trafia do każdej umowy.`);
      continue;
    }
    if (!wartosc) continue;
    if (p.format === 'nip' && !nipPoprawny(cyfry(wartosc))) {
      lista.push('NIP kancelarii ma niepoprawną sumę kontrolną.');
    }
    if (p.format === 'regon' && ![9, 14].includes(cyfry(wartosc).length)) {
      lista.push('REGON ma 9 albo 14 cyfr.');
    }
    if (p.format === 'kod' && !/^\d{2}-\d{3}$/.test(wartosc)) {
      lista.push('Kod pocztowy zapisuje się w postaci 00-000.');
    }
    if (p.format === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(wartosc)) {
      lista.push('Adres e-mail kancelarii jest niepoprawny.');
    }
    if (p.format === 'url' && !/^https?:\/\//.test(wartosc)) {
      lista.push('Adres strony zaczyna się od http:// albo https://.');
    }
  }

  return lista;
}

/** NIP — suma kontrolna z wagami. */
function nipPoprawny(cyfry) {
  if (!/^\d{10}$/.test(cyfry)) return false;
  const wagi = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const suma = wagi.reduce((s, w, i) => s + w * Number(cyfry[i]), 0);
  return suma % 11 === Number(cyfry[9]);
}

/**
 * Zapisuje wskazane klucze. Pusta wartosc USUWA nadpisanie — wraca wtedy
 * wartosc z `.env`, zamiast zostawiac w bazie pusty napis, ktory wyglada
 * jak celowo skasowana nazwa kancelarii.
 */
function zapisz(db, zmiany, autor) {
  const dozwolone = KLUCZE_KANCELARII;
  const teraz = czas.terazIso();
  const wstaw = db.prepare(
    `INSERT INTO psa_ustawienia (klucz, wartosc, zaktualizowano, autor)
     VALUES (@klucz, @wartosc, @teraz, @autor)
     ON CONFLICT(klucz) DO UPDATE SET wartosc = @wartosc, zaktualizowano = @teraz, autor = @autor`
  );
  const usun = db.prepare('DELETE FROM psa_ustawienia WHERE klucz = ?');

  const zmienione = [];
  const transakcja = db.transaction(() => {
    for (const [klucz, wartosc] of Object.entries(zmiany)) {
      if (!dozwolone.has(klucz)) continue;
      const tekst = wartosc == null ? '' : String(wartosc).trim();
      if (tekst === '') usun.run(klucz);
      else wstaw.run({ klucz, wartosc: tekst, teraz, autor });
      zmienione.push(klucz);
    }
  });
  transakcja();

  return zmienione;
}

/** Osoby zawierające umowy o prowadzenie rejestru (art. 300(32) § 1(2) KSH) — lista z Ustawień, domyślnie notariusz. */
function osobyZawierajaceUmowy(db) {
  const lista = String(zBazy(db).osoby_zawierajace_umowy || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (lista.length) return lista;
  const k = kancelaria(db);
  return k.notariusz_mianownik ? [`${k.notariusz_mianownik} — notariusz`] : [];
}

module.exports = {
  kancelaria,
  doEkranu,
  bledy,
  zapisz,
  osobyZawierajaceUmowy,
};
