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
 * Naglowki HTTP przenosza wylacznie ISO-8859-1, a nazwiska notariuszy
 * i pracownikow maja polskie znaki - `fetch` odrzucilby taka wartosc.
 * Klient wysyla ja wiec zakodowana procentowo (`encodeURIComponent`).
 * Wartosc czysto ASCII przechodzi bez zmian.
 */
function odkodujNaglowek(wartosc) {
  const tekst = String(wartosc || '');
  try {
    return decodeURIComponent(tekst);
  } catch {
    return tekst;
  }
}

/**
 * Autor czynnosci. Sprint 1 nie ma jeszcze logowania (sekcja 14 - konta
 * wchodza w sprincie 3), wiec zgodnie z konwencja mastera tozsamosc niesie
 * naglowek `X-User-Name`. Decyzja nr 3 z sekcji 15: na start wpisu moze
 * dokonac kazdy pracownik, z zapisem autora przy zdarzeniu - dlatego autor
 * jest WYMAGANY przy kazdej operacji zapisujacej.
 */
function autor(zad) {
  const naglowek = zad.get('X-User-Name');
  const imie = odkodujNaglowek(naglowek).trim();
  if (!imie) {
    throw bledneZadanie(
      'Nie ustalono autora czynności. Wybierz osobę prowadzącą sprawę przed dokonaniem wpisu.'
    );
  }
  if (imie.length > 120) {
    throw bledneZadanie('Oznaczenie autora jest za długie.');
  }
  return imie;
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
  if (['BladZakresu', 'BladKreatora', 'BladStanu'].includes(blad.name)) {
    return odp.status(422).json({ blad: blad.message, bledy: [blad.message] });
  }
  if (blad.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return odp.status(409).json({ blad: 'Rekord o tych danych już istnieje.' });
  }

  // Metadane techniczne - bez tresci zadania i bez danych osobowych.
  console.error(`[psa] ${zad.method} ${zad.path} — ${blad.name}: ${blad.message}`);
  return odp.status(500).json({ blad: 'Wystąpił nieoczekiwany błąd serwera.' });
}

module.exports = {
  BladZadania,
  odkodujNaglowek,
  bledneZadanie,
  nieZnaleziono,
  brakUprawnien,
  asy,
  autor,
  posrednikBledow,
};
