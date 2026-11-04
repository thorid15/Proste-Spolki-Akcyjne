/* pola.js — złożone pola wspólne dla kancelarii i portalu (FAZA 1 pkt 2).

   Zasada 3 sesji frontendowej: adres, tożsamość osoby, dokument tożsamości
   wyglądają i działają tak samo w kartotece, w kreatorze i we wniosku
   klienta. Każde z tych pól operuje na OBIEKCIE danych (te same nazwy
   kolumn co w bazie) i zgłasza zmiany jako łatkę `{ kolumna: wartość }`;
   `prefiks` pozwala użyć ich dla kolumn z przedrostkiem (np. adres
   reprezentanta: `reprezentant_kod_pocztowy`).

   Błędy przychodzą z zewnątrz (`bledy[kolumna]`) — o tym, kiedy je pokazać
   (po opuszczeniu pola albo przy próbie przejścia dalej), decyduje
   formularz. Identyfikatory pól: `${idPrefiks}-${kolumna}` — pod nie linkuje
   podsumowanie błędów. */

/** Wspólna plumbing pól tekstowych opartych na obiekcie danych. */
function polaObiektu({ dane, przyZmianie, prefiks = '', bledy = {}, przyOpuszczeniu, idPrefiks = 'pole', edytowalne = true }) {
  return (kolumna, dodatki = {}) => {
    const klucz = prefiks + kolumna;
    return {
      pole: {
        id: `${idPrefiks}-${klucz}`,
        blad: bledy[klucz],
        przyOpuszczeniu: przyOpuszczeniu ? () => przyOpuszczeniu(klucz) : undefined,
      },
      wejscie: {
        value: dane[klucz] ?? '',
        onChange: (z) => przyZmianie({ [klucz]: z.target.value }),
        disabled: !edytowalne,
        // Formularze rejestru opisują CUDZE dane — książka adresowa
        // przeglądarki podstawiałaby dane właściciela komputera.
        autoComplete: 'off',
        ...dodatki,
      },
    };
  };
}

/**
 * Adres: kraj (domyślnie Polska), kod pocztowy z maską 00-000 tylko dla
 * Polski, miejscowość, ulica, nr domu, nr lokalu. Jeden układ dla
 * akcjonariusza, reprezentanta i siedziby spółki.
 */
function PoleAdres({ etykieta = 'Adres', dane, przyZmianie, prefiks = '', bledy, przyOpuszczeniu, idPrefiks, edytowalne = true, podpowiedz }) {
  const p = polaObiektu({ dane, przyZmianie, prefiks, bledy, przyOpuszczeniu, idPrefiks, edytowalne });
  const kraj = dane[`${prefiks}kraj`];
  const polska = czyPolska(kraj);
  const kod = p('kod_pocztowy', {
    inputMode: polska ? 'numeric' : 'text',
    placeholder: polska ? '00-000' : undefined,
    maxLength: polska ? 6 : 12,
    onChange: (z) => przyZmianie({ [`${prefiks}kod_pocztowy`]: maskujKodPocztowy(z.target.value, kraj) }),
  });
  const ulica = p('ulica');
  const nrDomu = p('nr_domu');
  const nrLokalu = p('nr_lokalu');
  const miejscowosc = p('miejscowosc');
  const krajPole = p('kraj');

  return (
    <fieldset className="grupa-pol">
      <legend className="grupa-pol-legenda">{etykieta}</legend>
      {podpowiedz && <div className="pole-podpowiedz">{podpowiedz}</div>}
      <div className="siatka-adresu">
        <Pole etykieta="Ulica" opcjonalne {...ulica.pole}
          podpowiedz={!dane[`${prefiks}ulica`] ? 'Pomiń, jeśli miejscowość nie ma ulic.' : undefined}
        >
          <input type="text" {...ulica.wejscie} />
        </Pole>
        <Pole etykieta="Nr domu" {...nrDomu.pole}><input type="text" {...nrDomu.wejscie} /></Pole>
        <Pole etykieta="Nr lokalu" opcjonalne {...nrLokalu.pole}><input type="text" {...nrLokalu.wejscie} /></Pole>
      </div>
      <div className="siatka-adresu siatka-adresu-miasto">
        <Pole etykieta="Kod pocztowy" {...kod.pole}><input type="text" {...kod.wejscie} /></Pole>
        <Pole etykieta="Miejscowość" {...miejscowosc.pole}><input type="text" {...miejscowosc.wejscie} /></Pole>
      </div>
      {/* D-34: wybór ze słownika ISO 3166-1 (kod zapisuje baza). Wartość
          spoza słownika (dane sprzed D-34) zostaje widoczna jako osobna
          opcja — do ręcznej poprawy, nie zgadujemy. */}
      <Pole etykieta="Kraj" {...krajPole.pole}>
        <select {...krajPole.wejscie} value={kraj ?? KRAJ_DOMYSLNY}>
          {kraj && !KRAJE.some(([, n]) => n === kraj) && (
            <option value={kraj}>{kraj} (spoza słownika — wybierz właściwy kraj)</option>
          )}
          {KRAJE.map(([kod, nazwa]) => <option key={kod} value={nazwa}>{nazwa}</option>)}
        </select>
      </Pole>
    </fieldset>
  );
}

/**
 * Tożsamość osoby fizycznej: PESEL z sumą kontrolną ALBO — po zaznaczeniu
 * „nie ma numeru PESEL" — data urodzenia. Z numeru PESEL data urodzenia i
 * płeć wynikają same (pesel.js) i pokazują się jako jedno zdanie pod polem,
 * a nie drugi raz jako pole do przepisania (zasada 0.4 pkt 2 i 7).
 *
 * Dla osoby prawnej komponentu się nie renderuje — blok znika w całości.
 * Kolumny: pesel, bez_pesel, data_urodzenia, plec.
 */
function PoleTozsamosc({ dane, przyZmianie, prefiks = '', bledy = {}, przyOpuszczeniu, idPrefiks = 'pole', edytowalne = true, ostrzezenie, dodatekPesel }) {
  const k = (kolumna) => prefiks + kolumna;
  const bezPesel = Boolean(Number(dane[k('bez_pesel')]));
  const pesel = String(dane[k('pesel')] ?? '');
  const wynik = walidujPesel(pesel);
  const idPesel = `${idPrefiks}-${k('pesel')}`;
  const idData = `${idPrefiks}-${k('data_urodzenia')}`;

  function zmienPesel(tekst) {
    const cyfry = tekst.replace(/\D/g, '').slice(0, 11);
    const w = walidujPesel(cyfry);
    // Data urodzenia i płeć WYNIKAJĄ z numeru — przy PESEL-u nie są osobnymi
    // polami, więc liczą się od nowa przy każdej zmianie numeru.
    przyZmianie({
      [k('pesel')]: cyfry,
      [k('data_urodzenia')]: w.data_urodzenia || '',
      [k('plec')]: w.plec || '',
    });
  }

  function przelaczBezPesel(zaznaczone) {
    przyZmianie(zaznaczone
      ? { [k('bez_pesel')]: 1, [k('pesel')]: '', [k('data_urodzenia')]: '', [k('plec')]: '' }
      : { [k('bez_pesel')]: 0, [k('data_urodzenia')]: '' });
  }

  const echo = !bezPesel && wynik.data_urodzenia
    ? `Urodzony(-a) ${fmt.data(wynik.data_urodzenia)} · ${wynik.plec === 'kobieta' ? 'kobieta' : 'mężczyzna'}`
    : null;

  return (
    <div className="grupa-tozsamosci">
      {!bezPesel ? (
        <Pole
          etykieta="Numer PESEL"
          id={idPesel}
          blad={bledy[k('pesel')]}
          ostrzezenie={ostrzezenie || wynik.ostrzezenie}
          echo={echo}
          przyOpuszczeniu={przyOpuszczeniu ? () => przyOpuszczeniu(k('pesel')) : undefined}
        >
          <input
            type="text" inputMode="numeric" autoComplete="off" maxLength={11} placeholder="11 cyfr"
            value={pesel} disabled={!edytowalne} className="dane"
            onChange={(z) => zmienPesel(z.target.value)}
          />
        </Pole>
      ) : (
        <Pole
          etykieta="Data urodzenia"
          id={idData}
          blad={bledy[k('data_urodzenia')]}
          przyOpuszczeniu={przyOpuszczeniu ? () => przyOpuszczeniu(k('data_urodzenia')) : undefined}
        >
          <PoleDaty
            wartosc={dane[k('data_urodzenia')] || ''}
            przyZmianie={(v) => przyZmianie({ [k('data_urodzenia')]: v })}
            wylaczone={!edytowalne}
          />
        </Pole>
      )}
      {dodatekPesel}
      <label className="chk">
        <input type="checkbox" checked={bezPesel} disabled={!edytowalne} onChange={(z) => przelaczBezPesel(z.target.checked)} />
        <span className="chk-tresc">Ta osoba nie ma numeru PESEL</span>
      </label>
    </div>
  );
}

/** Dokument tożsamości: rodzaj (dowód osobisty / paszport) + seria i numer. */
const RODZAJE_DOWODU = [
  { wartosc: 'dowod_osobisty', etykieta: 'Dowód osobisty' },
  { wartosc: 'paszport', etykieta: 'Paszport' },
];

function PoleDowod({ etykieta = 'Dowód tożsamości', rodzaj, numer, przyZmianie, bledy = {}, idPrefiks = 'pole', klucze = { rodzaj: 'dowod_rodzaj', numer: 'dowod_numer' }, edytowalne = true, przyOpuszczeniu }) {
  return (
    <fieldset className="grupa-pol">
      <legend className="grupa-pol-legenda">{etykieta}</legend>
      <div className="siatka-2">
        <Pole etykieta="Rodzaj dokumentu" id={`${idPrefiks}-${klucze.rodzaj}`} blad={bledy[klucze.rodzaj]}
          przyOpuszczeniu={przyOpuszczeniu ? () => przyOpuszczeniu(klucze.rodzaj) : undefined}
        >
          <select value={rodzaj || ''} disabled={!edytowalne} onChange={(z) => przyZmianie({ [klucze.rodzaj]: z.target.value })}>
            <option value="">— wybierz —</option>
            {RODZAJE_DOWODU.map((r) => <option key={r.wartosc} value={r.wartosc}>{r.etykieta}</option>)}
          </select>
        </Pole>
        <Pole etykieta="Seria i numer" id={`${idPrefiks}-${klucze.numer}`} blad={bledy[klucze.numer]}
          przyOpuszczeniu={przyOpuszczeniu ? () => przyOpuszczeniu(klucze.numer) : undefined}
        >
          <input
            type="text" className="dane" autoComplete="off" value={numer || ''} disabled={!edytowalne}
            placeholder={rodzaj === 'paszport' ? 'np. EA1234567' : 'np. ABC123456'}
            onChange={(z) => przyZmianie({ [klucze.numer]: z.target.value.toUpperCase().replace(/\s/g, '') })}
          />
        </Pole>
      </div>
    </fieldset>
  );
}

/**
 * Typ osoby jako dwa duże pola wyboru (B11). „Osoba prawna lub spółka
 * osobowa": spółki osobowe nabywają prawa we własnym imieniu (art. 8 § 1
 * KSH). Spółka cywilna nie jest akcjonariuszem — jej wspólników wpisuje się
 * jako współwłaścicieli.
 */
function WyborTypuOsoby({ wartosc, przyZmianie, edytowalne = true, id, pytanie = 'Rodzaj osoby' }) {
  const nazwa = useId();
  const opcje = [
    { wartosc: 'fizyczna', etykieta: 'Osoba fizyczna', opis: 'Człowiek — także przedsiębiorca działający na własne nazwisko.' },
    { wartosc: 'prawna', etykieta: 'Osoba prawna lub spółka osobowa', opis: 'Np. spółka z o.o., P.S.A., fundacja, spółka jawna lub komandytowa.' },
  ];
  return (
    <fieldset className="grupa-pol wybor-typu" id={id}>
      <legend className="grupa-pol-legenda">{pytanie}</legend>
      <div className="wybor-typu-opcje">
        {opcje.map((o) => (
          <label key={o.wartosc} className={`wybor-typu-opcja ${wartosc === o.wartosc ? 'wybrana' : ''}`}>
            <input
              type="radio" name={nazwa} value={o.wartosc} checked={wartosc === o.wartosc} disabled={!edytowalne}
              onChange={() => przyZmianie(o.wartosc)}
            />
            <span>
              <span className="wybor-typu-etykieta">{o.etykieta}</span>
              <span className="wybor-typu-opis">{o.opis}</span>
            </span>
          </label>
        ))}
      </div>
      {wartosc === 'prawna' && (
        <div className="pole-podpowiedz">
          Spółka cywilna nie może być akcjonariuszem — wpisz jej wspólników jako osoby, które mają akcje wspólnie
          (współwłasność).
        </div>
      )}
    </fieldset>
  );
}

/**
 * A-002: dane spółki — jeden zestaw pól we wniosku portalu (P3, krok 1) i przy otwarciu rejestru w kancelarii (K3a).
 * `pole(klucz)` — powiązanie pola ze stanem rodzica (każdy ekran ma własną walidację); `podpowiedzi` — uwagi
 * zależne od ekranu (np. sąd zaproponowany z siedziby, ADE nieujawnione w KRS).
 */
function PolaDanychSpolki({ dane, ustawDane, pole, podpowiedzi = {}, wylaczone = false, wymaganaNazwa = false, idNazwy }) {
  const data = (klucz) => ({ wartosc: dane[klucz] || '', przyZmianie: (v) => ustawDane((p) => ({ ...p, [klucz]: v })), wylaczone });
  return (
    <>
      <Pole etykieta="Firma (nazwa) spółki" wymagane={wymaganaNazwa} id={idNazwy}>
        <input type="text" {...pole('nazwa')} />
      </Pole>
      <Pole etykieta="Organ zarządzający" podpowiedz="P.S.A. może mieć zarząd albo — w strukturze monistycznej — radę dyrektorów; decyduje umowa spółki.">
        <select {...pole('organ_rodzaj')}>
          <option value="">— nie ustalono —</option>
          <option value="zarzad">Zarząd</option>
          <option value="rada_dyrektorow">Rada Dyrektorów</option>
        </select>
      </Pole>
      <div className="siatka-2">
        <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
        <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} placeholder="00-000" /></Pole>
        <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
      </div>
      <div className="siatka-3">
        <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
        <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
        <Pole etykieta="Nr lokalu" opcjonalne><input type="text" {...pole('nr_lokalu')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Sąd rejestrowy" podpowiedz={podpowiedzi.sad_rejestrowy}><input type="text" {...pole('sad_rejestrowy')} /></Pole>
        <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Data rejestracji w KRS"><PoleDaty {...data('data_utworzenia_spolki')} /></Pole>
        <Pole etykieta="Kapitał akcyjny">
          <PoleKwoty grosze={dane.kapital_akcyjny_grosze} przyZmianie={(v) => ustawDane((p) => ({ ...p, kapital_akcyjny_grosze: v }))} />
        </Pole>
      </div>
      <Pole
        etykieta="Data zawarcia umowy spółki"
        podpowiedz={podpowiedzi.data_zawarcia_umowy_spolki || 'Data aktu notarialnego zawiązania spółki; przy spółce założonej w S24 — data podpisania w systemie.'}
      >
        <PoleDaty {...data('data_zawarcia_umowy_spolki')} />
      </Pole>
      <div className="siatka-2">
        <Pole etykieta="Adres e-mail spółki"><input type="text" {...pole('email')} /></Pole>
        <Pole etykieta="Telefon" opcjonalne><input type="text" {...pole('telefon')} /></Pole>
      </div>
      <ZwijanaSekcja tytul="Adres do doręczeń elektronicznych" wypelniona={Boolean(dane.adres_edorecze) || Boolean(podpowiedzi.adres_edorecze)}>
        <Pole etykieta="Adres do doręczeń elektronicznych" podpowiedz={podpowiedzi.adres_edorecze || 'Skrzynka e-Doręczeń spółki, jeśli została uruchomiona.'}>
          <input type="text" {...pole('adres_edorecze')} placeholder="AE:PL-…" />
        </Pole>
      </ZwijanaSekcja>
    </>
  );
}
