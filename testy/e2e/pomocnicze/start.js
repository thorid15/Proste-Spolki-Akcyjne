'use strict';

/** Przed zrzutami: serwer MUSI być w trybie testowym (panel /test, skrzynka testowa). Inaczej błąd. */

module.exports = async (konfiguracja) => {
  const adres = konfiguracja.projects[0].use.baseURL;
  const panel = await fetch(`${adres}/test`).catch(() => null);
  const tresc = panel && panel.ok ? await panel.text() : '';
  const skrzynka = await fetch(`${adres}/test/skrzynka`).catch(() => null);
  if (!/Panel trybu testowego/.test(tresc) || !skrzynka || !skrzynka.ok) {
    throw new Error('Serwer nie działa w trybie testowym (brak panelu /test albo skrzynki testowej) — zrzuty przerwane.');
  }
};
