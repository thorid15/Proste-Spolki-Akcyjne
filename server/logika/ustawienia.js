'use strict';

/**
 * Ustawienia kancelarii — metryka i stawki — edytowalne z aplikacji.
 *
 * Zasada: `.env` jest DOMYSLNA, baza jest NADPISANIEM. Klucza nie ma
 * w `psa_ustawienia` -> obowiazuje wartosc z pliku konfiguracyjnego, tak jak
 * dzialalo to zawsze. Notariusz zapisuje wlasna wartosc -> od tej chwili
 * liczy sie baza. Nie ma wiec momentu "przenoszenia danych" ani drugiej
 * kopii tego samego, ktora moze sie rozjechac.
 *
 * Dlaczego w ogole baza: zeby zmienic NIP albo adres w `.env`, trzeba miec
 * dostep do serwera i zrestartowac aplikacje. W praktyce tego sie nie robi,
 * wiec kazda wystawiona umowa miala w tych miejscach kreski. Do tego z pliku
 * nie wida, co jest wpisane, nic tego nie sprawdza i nie zostaje slad, kto
 * zmienil dane, ktore trafiaja do aktow.
 *
 * Czego tu NIE MA: sekretow. Klucze tpay, sekret sesji i dane SMTP zostaja
 * w `.env` — baza trafia do kopii zapasowych i eksportow.
 */

const konfiguracja = require('../konfiguracja');
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
];

/** Stawki — w ZŁOTYCH na ekranie, w groszach w bazie (regula domenowa nr 5). */
const POLA_STAWEK = [
  { klucz: 'stawka_prowadzenie', etykieta: 'Prowadzenie rejestru (rocznie)',
    podpowiedz: 'Za każdy rozpoczęty rok — § 15b pkt 1 rozporządzenia.' },
  { klucz: 'stawka_wpis', etykieta: 'Wpis w rejestrze' },
  { klucz: 'stawka_informacja', etykieta: 'Informacja z rejestru' },
];

const KLUCZE_STAWEK = new Set(POLA_STAWEK.map((p) => p.klucz));
const KLUCZE_KANCELARII = new Set(POLA_KANCELARII.map((p) => p.klucz));

/** Surowe wartosci z bazy — tylko te, ktore ktos swiadomie ustawil. */
function zBazy(db) {
  const wynik = {};
  for (const w of db.prepare('SELECT klucz, wartosc FROM psa_ustawienia').all()) {
    wynik[w.klucz] = w.wartosc;
  }
  return wynik;
}

/**
 * Metryka kancelarii w tym samym ksztalcie, co `konfiguracja.KANCELARIA` —
 * wolno ja podstawic wszedzie tam, gdzie dotad czytano stala.
 */
function kancelaria(db) {
  const ustawione = zBazy(db);
  const wynik = { ...konfiguracja.KANCELARIA };
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
  if (!wynik.www_psa) wynik.www_psa = wynik.www;
  return wynik;
}

/** Stawka w groszach: baza, a gdy jej nie ustawiono — wartosc z przepisow. */
function stawkaGrosze(db, typ) {
  const przepisy = require('./przepisy');
  const ustawione = zBazy(db)[`stawka_${typ}`];
  const zPrzepisow = przepisy.stawkaGrosze(typ);
  if (ustawione == null || String(ustawione).trim() === '') return zPrzepisow;
  const liczba = Number(ustawione);
  return Number.isFinite(liczba) && liczba >= 0 ? Math.round(liczba) : zPrzepisow;
}

/** Wszystko, czego potrzebuje ekran konfiguracji: wartosci + skad pochodza. */
function doEkranu(db) {
  const przepisy = require('./przepisy');
  const ustawione = zBazy(db);
  const metryka = kancelaria(db);
  const pole = (p) => ({
    ...p,
    wartosc: metryka[p.klucz] ?? '',
    z_bazy: Object.prototype.hasOwnProperty.call(ustawione, p.klucz),
  });
  const stawka = (p) => {
    const typ = p.klucz.replace('stawka_', '');
    return {
      ...p,
      wartosc: stawkaGrosze(db, typ),
      maksymalna: przepisy.STAWKI_MAKSYMALNE_GROSZE[
        typ === 'prowadzenie' ? 'PROWADZENIE_ROCZNIE' : typ.toUpperCase()
      ],
      z_bazy: Object.prototype.hasOwnProperty.call(ustawione, p.klucz),
    };
  };
  return { kancelaria: POLA_KANCELARII.map(pole), stawki: POLA_STAWEK.map(stawka) };
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

  for (const p of POLA_STAWEK) {
    if (!(p.klucz in zmiany)) continue;
    const liczba = Number(zmiany[p.klucz]);
    if (!Number.isFinite(liczba) || liczba < 0) {
      lista.push(`Stawka „${p.etykieta}” musi być liczbą nieujemną.`);
      continue;
    }
    // Stawki z rozporzadzenia sa MAKSYMALNE — wyzej nie wolno, nizej wolno.
    const przepisy = require('./przepisy');
    const typ = p.klucz.replace('stawka_', '');
    const gorna = przepisy.STAWKI_MAKSYMALNE_GROSZE[
      typ === 'prowadzenie' ? 'PROWADZENIE_ROCZNIE' : typ.toUpperCase()
    ];
    if (gorna != null && Math.round(liczba) > gorna) {
      lista.push(
        `Stawka „${p.etykieta}” przekracza maksymalną z rozporządzenia (${(gorna / 100).toFixed(2)} zł).`
      );
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
  const dozwolone = new Set([...KLUCZE_KANCELARII, ...KLUCZE_STAWEK]);
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

module.exports = {
  POLA_KANCELARII, POLA_STAWEK, kancelaria, stawkaGrosze, doEkranu,
  bledy, zapisz, nipPoprawny,
};
