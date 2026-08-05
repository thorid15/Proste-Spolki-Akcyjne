'use strict';

/**
 * Wspolne odpowiedzi HTTP i obsluga bledow.
 *
 * Komunikaty ida do UI po polsku, bez tlumaczenia po drodze.
 * Sekcja 11: NIE logujemy tresci dokumentow ani danych osobowych -
 * wylacznie metadane techniczne.
 */

class BladZadania extends Error {
  constructor(status, komunikat, szczegoly = null) {
    super(komunikat);
    this.name = 'BladZadania';
    this.status = status;
    this.szczegoly = szczegoly;
  }
}

const bledneZadanie = (k, s) => new BladZadania(400, k, s);
const nieZnaleziono = (k = 'Nie odnaleziono zasobu.') => new BladZadania(404, k);
const nieAutoryzowany = (k = 'Ta operacja wymaga zalogowania.') => new BladZadania(401, k);
const brakUprawnien = (k = 'Brak uprawnień do tej operacji.') => new BladZadania(403, k);

/** Opakowanie handlera - wyjatki trafiaja do wspolnego posrednika bledow. */
function asy(handler) {
  return (zad, odp, dalej) => {
    try {
      const wynik = handler(zad, odp, dalej);
      if (wynik && typeof wynik.catch === 'function') wynik.catch(dalej);
    } catch (e) {
      dalej(e);
    }
  };
}

/**
 * Autor czynnosci. Od sprintu 3 tozsamosc niesie sesja pracownika
 * (`pomocnicze/autoryzacja.js`), nie naglowek `X-User-Name` - odstepstwo nr 2
 * z sekcji 2 specyfikacji: dostep publiczny wyklucza identyfikacje samym
 * imieniem. Decyzja nr 3 z sekcji 15: na start wpisu moze dokonac kazdy
 * zalogowany pracownik, z zapisem autora przy zdarzeniu.
 */
function autor(zad) {
  if (!zad.uzytkownik) {
    throw nieAutoryzowany('Ta operacja wymaga zalogowania.');
  }
  return zad.uzytkownik.imie;
}

/** Posrednik bledow - ostatni w lancuchu. */
function posrednikBledow(blad, zad, odp, dalej) {
  if (odp.headersSent) return dalej(blad);

  if (blad instanceof BladZadania) {
    return odp.status(blad.status).json({ blad: blad.message, szczegoly: blad.szczegoly });
  }
  // Bledy domenowe niosa gotowy komunikat po polsku.
  if (['BladWalidacji'].includes(blad.name)) {
    return odp.status(422).json({
      blad: 'Wpis nie może zostać dokonany.',
      bledy: blad.bledy,
      ostrzezenia: blad.ostrzezenia || [],
    });
  }
  if (['BladZakresu', 'BladKreatora', 'BladStanu', 'BladTerminu'].includes(blad.name)) {
    return odp.status(422).json({ blad: blad.message, bledy: [blad.message] });
  }
  if (blad.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return odp.status(409).json({ blad: 'Rekord o tych danych już istnieje.' });
  }
  if (blad.name === 'BladOgraniczenia') {
    return odp.status(429).json({ blad: blad.message });
  }
  // multer - blad limitu rozmiaru/liczby plikow ma czytelny kod, reszta
  // (np. zly typ pliku) trafia tu jako zwykly Error z pomocnicze/odpowiedzi.
  if (blad.name === 'MulterError') {
    const komunikaty = {
      LIMIT_FILE_SIZE: 'Plik jest za duży (limit 20 MB).',
      LIMIT_FILE_COUNT: 'Za dużo plików w jednym żądaniu (limit 10).',
    };
    return odp.status(400).json({ blad: komunikaty[blad.code] || `Błąd przesyłania pliku: ${blad.message}` });
  }

  // Metadane techniczne - bez tresci zadania i bez danych osobowych.
  console.error(`[psa] ${zad.method} ${zad.path} — ${blad.name}: ${blad.message}`);
  return odp.status(500).json({ blad: 'Wystąpił nieoczekiwany błąd serwera.' });
}

module.exports = {
  BladZadania,
  bledneZadanie,
  nieZnaleziono,
  nieAutoryzowany,
  brakUprawnien,
  asy,
  autor,
  posrednikBledow,
};
