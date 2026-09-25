/* formularz-osoby.js — JEDEN formularz danych osoby dla kartoteki kancelarii,
   kreatorów i wniosku w portalu klienta (FAZA 1 pkt 2, zasada 3 sesji
   frontendowej). Ładowany do obu paczek (kancelaria i portal).

   Do FAZY 1 wniosek w portalu miał własny, zduplikowany formularz
   akcjonariusza — i rozjechał się z kartoteką: nie zbierał kraju (B11), a
   regułę „PESEL albo data urodzenia" pokazywał dopiero na podsumowaniu (B4).
   Teraz oba miejsca renderują `FormularzOsoby`, a różnią się tylko polami
   zależnymi od roli (`tryb`):
     - 'kancelaria' — pełen zakres: wskazanie adresu wpisywanego do rejestru,
       trzy stany zgody e-mail, NIP/REGON pod „Więcej danych";
     - 'portal' — język laika, bez pól AML i notatek wewnętrznych; który
       adres trafi do rejestru, wskazuje kancelaria przy weryfikacji.
   Pola AML, PEP i uwagi wewnętrzne dokłada kancelaria POD tym formularzem
   (osoby.js, `PanelOsoby`) — do portalu nigdy nie trafiają.

   Walidacja (`walidujOsobe`) jest lustrem `server/logika/akcjonariusz.js`
   (braki wobec art. 300(33) § 1 KSH) plus sprawdzenia formatu, i zwraca
   błędy PRZY KOLUMNACH, nie listę zdań — dzięki temu komunikat stoi pod
   polem, którego dotyczy (B4, wzorzec z FAZY 1 pkt 3). */

const PUSTA_OSOBA_FORMULARZA = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '', plec: '',
  pesel: '', bez_pesel: 0, data_urodzenia: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: '',
  kraj: 'Polska', kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  adres_doreczen: '', adres_edoreczen: '', email: '', telefon: '',
  // Art. 300(33) § 1 pkt 3 KSH — do rejestru wchodzi JEDEN adres.
  rodzaj_adresu_rejestrowego: 'zamieszkania',
  // Art. 300(33) § 1 pkt 4 KSH — zgoda jest oświadczeniem samego akcjonariusza.
  zgoda_email_status: 'brak',
  // Art. 300(33) § 1 pkt 5 KSH — współwłasność akcji.
  wspolwlasnosc: 'brak', wspolwlasciciele: '', udzial_licznik: '', udzial_mianownik: '',
};

/** Wartości `null` z bazy nie mogą nadpisać wartości domyślnych formularza. */
function osobaDoFormularza(osoba, domyslne = PUSTA_OSOBA_FORMULARZA) {
  return {
    ...domyslne,
    ...Object.fromEntries(Object.entries(osoba || {}).filter(([, v]) => v !== null && v !== undefined)),
  };
}

const pustaWartosc = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * Błędy przy kolumnach: `{ nazwisko: 'Wpisz nazwisko.', … }`. Komunikat mówi,
 * co zrobić. `tryb` jak w `FormularzOsoby` — e-mail jest obowiązkowy we
 * wniosku (zaproszenie akcjonariusza do portalu po otwarciu rejestru, Z-006),
 * w kartotece nie.
 */
function walidujOsobe(a, { tryb = 'kancelaria' } = {}) {
  const b = {};
  if (a.typ === 'prawna') {
    if (pustaWartosc(a.nazwa)) b.nazwa = 'Wpisz firmę (nazwę) — tak jak w rejestrze, w którym podmiot jest wpisany.';
    if (!pustaWartosc(a.numer_w_rejestrze) && pustaWartosc(a.nazwa_rejestru)) {
      b.nazwa_rejestru = 'Wpisz nazwę rejestru, np. KRS.';
    }
    if (!pustaWartosc(a.nip) && !/^\d{10}$/.test(String(a.nip).replace(/[\s-]/g, ''))) {
      b.nip = 'Wpisz 10 cyfr numeru NIP.';
    }
  } else {
    if (pustaWartosc(a.nazwisko)) b.nazwisko = 'Wpisz nazwisko.';
    if (pustaWartosc(a.imie)) b.imie = 'Wpisz imię.';
    if (Number(a.bez_pesel) === 1) {
      if (pustaWartosc(a.data_urodzenia)) b.data_urodzenia = 'Wpisz datę urodzenia — bez numeru PESEL jest obowiązkowa.';
    } else {
      const pesel = walidujPesel(a.pesel);
      if (pesel.pusty) {
        b.pesel = 'Wpisz numer PESEL albo zaznacz, że ta osoba go nie ma.';
      } else if (pesel.blad) {
        b.pesel = pesel.blad;
      }
    }
  }

  // Adres: brakiem jest brak JAKIEGOKOLWIEK adresu (art. 300(33) § 1 pkt 3).
  const maAdres = [a.kod_pocztowy, a.miejscowosc, a.ulica].some((v) => !pustaWartosc(v));
  const maInnyAdres = !pustaWartosc(a.adres_doreczen) || !pustaWartosc(a.adres_edoreczen);
  if (!maAdres && !maInnyAdres) {
    b.miejscowosc = a.typ === 'prawna' ? 'Wpisz adres siedziby.' : 'Wpisz adres zamieszkania.';
  } else if (maAdres) {
    if (pustaWartosc(a.miejscowosc)) b.miejscowosc = 'Wpisz miejscowość.';
    if (pustaWartosc(a.nr_domu)) b.nr_domu = 'Wpisz numer domu.';
    const kod = walidujKodPocztowy(a.kod_pocztowy, a.kraj);
    if (kod) b.kod_pocztowy = kod;
    else if (pustaWartosc(a.kod_pocztowy)) b.kod_pocztowy = 'Wpisz kod pocztowy.';
  }
  if (tryb === 'kancelaria' && !pustaWartosc(a.rodzaj_adresu_rejestrowego)) {
    const wypelniony = { zamieszkania: maAdres, doreczen: !pustaWartosc(a.adres_doreczen), edoreczen: !pustaWartosc(a.adres_edoreczen) };
    if ((maAdres || maInnyAdres) && !wypelniony[a.rodzaj_adresu_rejestrowego]) {
      b.rodzaj_adresu_rejestrowego = 'Wskazany adres jest pusty — wybierz adres, który jest wypełniony.';
    }
  }

  if (!pustaWartosc(a.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.email).trim())) {
    b.email = 'Wpisz adres e-mail w formacie nazwa@domena.pl.';
  } else if (pustaWartosc(a.email)) {
    if (tryb === 'portal') b.email = 'Wpisz adres e-mail akcjonariusza.';
    else if (a.zgoda_email_status && a.zgoda_email_status !== 'brak') b.email = 'Wpisz adres e-mail — zaznaczono zgodę na komunikację elektroniczną.';
  }

  if (a.wspolwlasnosc && a.wspolwlasnosc !== 'brak') {
    if (pustaWartosc(a.wspolwlasciciele)) b.wspolwlasciciele = 'Wpisz pozostałych współwłaścicieli.';
    if (a.wspolwlasnosc === 'ulamkowa') {
      const l = Number(a.udzial_licznik);
      const m = Number(a.udzial_mianownik);
      if (pustaWartosc(a.udzial_licznik) || pustaWartosc(a.udzial_mianownik)) b.udzial_licznik = 'Wpisz wielkość udziału, np. 1/2.';
      else if (!(l > 0 && m > 0 && l < m)) b.udzial_licznik = 'Udział musi być ułamkiem mniejszym od 1, np. 1/2.';
    }
  }
  return b;
}

/** Błędy w kolejności pól na ekranie — do podsumowania błędów. */
const KOLEJNOSC_POL_OSOBY = [
  'nazwa', 'nazwa_rejestru', 'nip', 'imie', 'nazwisko', 'pesel', 'data_urodzenia',
  'ulica', 'nr_domu', 'kod_pocztowy', 'miejscowosc', 'rodzaj_adresu_rejestrowego', 'email',
  'wspolwlasciciele', 'udzial_licznik',
];

function listaBledowOsoby(bledy, idPrefiks) {
  return KOLEJNOSC_POL_OSOBY
    .filter((k) => bledy[k])
    .map((k) => ({ pole: `${idPrefiks}-${k}`, tresc: bledy[k] }));
}

/**
 * Stan walidacji formularza: błędy pokazują się dla pól OPUSZCZONYCH albo —
 * po próbie przejścia dalej — dla wszystkich (wzorzec GOV.UK).
 */
function useWalidacjaOsoby(dane, opcje) {
  const [dotkniete, ustawDotkniete] = useState(() => new Set());
  const [wszystkie, ustawWszystkie] = useState(false);
  const bledy = walidujOsobe(dane, opcje);
  const widoczne = wszystkie ? bledy : Object.fromEntries(Object.entries(bledy).filter(([k]) => dotkniete.has(k)));
  return {
    bledy,
    widoczne,
    dotknij: (k) => ustawDotkniete((p) => (p.has(k) ? p : new Set([...p, k]))),
    pokazWszystkie: () => ustawWszystkie(true),
    czyPoprawne: Object.keys(bledy).length === 0,
    pokazywaneWszystkie: wszystkie,
  };
}

/**
 * Formularz danych osoby. `dane` + `przyZmianie(łatka)` — stan trzyma
 * rodzic (kartoteka zapisuje przyciskiem, wniosek — automatycznie).
 * `ostrzezeniaIdentyfikatora`: węzły pokazywane PRZY polu PESEL / NIP /
 * numeru KRS, gdy taki identyfikator jest już w kartotece (D-042).
 */
function FormularzOsoby({
  dane, przyZmianie, tryb = 'kancelaria', bledy = {}, przyOpuszczeniu, idPrefiks = 'osoba',
  edytowalne = true, ostrzezeniaIdentyfikatora = {}, pytanieOTyp,
}) {
  const portal = tryb === 'portal';
  const fizyczna = dane.typ !== 'prawna';
  const p = polaObiektu({ dane, przyZmianie, bledy, przyOpuszczeniu, idPrefiks, edytowalne });

  function zmienTyp(typ) {
    przyZmianie({ typ });
  }

  const imie = p('imie', { autoCapitalize: 'words' });
  const nazwisko = p('nazwisko', { autoCapitalize: 'words' });
  const nazwa = p('nazwa');
  const numerRejestru = p('numer_w_rejestrze', {
    inputMode: 'numeric',
    onChange: (z) => {
      const numer = z.target.value;
      // Numer i nazwę rejestru podaje się razem (art. 300(33) § 1 pkt 2) —
      // formularz pilnuje tego sam, zamiast pokazywać błąd po fakcie.
      przyZmianie({
        numer_w_rejestrze: numer,
        nazwa_rejestru: numer.trim() ? (dane.nazwa_rejestru || 'KRS') : '',
      });
    },
  });
  const nazwaRejestru = p('nazwa_rejestru');
  const nip = p('nip', { inputMode: 'numeric' });
  const regon = p('regon', { inputMode: 'numeric' });
  const email = p('email', { type: 'email', inputMode: 'email' });
  const telefon = p('telefon', { type: 'tel', inputMode: 'tel' });
  const adresDoreczen = p('adres_doreczen');
  const adresEdoreczen = p('adres_edoreczen', { placeholder: 'AE:PL-…' });
  const wspolwlasciciele = p('wspolwlasciciele');

  const zgoda = dane.zgoda_email_status || 'brak';
  const wspol = dane.wspolwlasnosc && dane.wspolwlasnosc !== 'brak';

  return (
    <div className="formularz-osoby">
      <WyborTypuOsoby
        wartosc={fizyczna ? 'fizyczna' : 'prawna'} przyZmianie={zmienTyp} edytowalne={edytowalne}
        pytanie={pytanieOTyp || (portal ? 'Kto jest akcjonariuszem?' : 'Rodzaj osoby')}
      />

      {fizyczna ? (
        <>
          <div className="siatka-2">
            <Pole etykieta="Imię" {...imie.pole}><input type="text" {...imie.wejscie} /></Pole>
            <Pole etykieta="Nazwisko" {...nazwisko.pole}><input type="text" {...nazwisko.wejscie} /></Pole>
          </div>
          <PoleTozsamosc
            dane={dane} przyZmianie={przyZmianie} bledy={bledy} przyOpuszczeniu={przyOpuszczeniu}
            idPrefiks={idPrefiks} edytowalne={edytowalne}
            dodatekPesel={ostrzezeniaIdentyfikatora.pesel}
          />
        </>
      ) : (
        <>
          <Pole etykieta="Firma (nazwa)" {...nazwa.pole}><input type="text" {...nazwa.wejscie} /></Pole>
          <div className="siatka-2">
            <Pole
              etykieta="Numer w rejestrze (KRS lub zagranicznym)"
              opcjonalne
              podpowiedz="Pomaga zidentyfikować podmiot — nie jest częścią treści rejestru."
              {...numerRejestru.pole}
            >
              <input type="text" className="dane" {...numerRejestru.wejscie} />
            </Pole>
            {!pustaWartosc(dane.numer_w_rejestrze) && (
              <Pole etykieta="Nazwa rejestru" {...nazwaRejestru.pole}><input type="text" {...nazwaRejestru.wejscie} /></Pole>
            )}
          </div>
          {ostrzezeniaIdentyfikatora.numer_w_rejestrze}
        </>
      )}

      <PoleAdres
        etykieta={fizyczna ? 'Adres zamieszkania' : 'Adres siedziby'}
        dane={dane} przyZmianie={przyZmianie} bledy={bledy} przyOpuszczeniu={przyOpuszczeniu}
        idPrefiks={idPrefiks} edytowalne={edytowalne}
      />

      <div className="siatka-2">
        <Pole
          etykieta="Adres e-mail"
          opcjonalne={!portal}
          podpowiedz={portal ? 'Wyślemy na niego zaproszenie do portalu po otwarciu rejestru.' : undefined}
          {...email.pole}
        >
          <input {...email.wejscie} />
        </Pole>
        <Pole etykieta="Telefon" opcjonalne {...telefon.pole}><input {...telefon.wejscie} /></Pole>
      </div>

      {portal ? (
        <Przelacznik
          wlaczony={zgoda !== 'brak'}
          wylaczony={!edytowalne || zgoda === 'potwierdzona'}
          przyZmianie={(v) => przyZmianie({ zgoda_email_status: v ? 'zadeklarowana' : 'brak' })}
          etykieta="Akcjonariusz chce dostawać pisma od spółki e-mailem"
          opis="Przygotujemy oświadczenie do podpisu. Adres e-mail trafi do rejestru dopiero po podpisaniu go przez akcjonariusza (art. 300(33) § 1 pkt 4 KSH)."
        />
      ) : (
        <Pole
          etykieta="Zgoda na komunikację elektroniczną"
          podpowiedz="Art. 300(33) § 1 pkt 4 KSH — adres e-mail wchodzi do rejestru dopiero po zgodzie SAMEGO akcjonariusza."
          id={`${idPrefiks}-zgoda_email_status`}
        >
          <select value={zgoda} disabled={!edytowalne} onChange={(z) => przyZmianie({ zgoda_email_status: z.target.value })}>
            <option value="brak">Brak — adres e-mail nie wchodzi do rejestru</option>
            <option value="zadeklarowana">Zadeklarowana przez spółkę — czeka na oświadczenie</option>
            <option value="potwierdzona">Potwierdzona oświadczeniem akcjonariusza</option>
          </select>
        </Pole>
      )}

      <Przelacznik
        wlaczony={wspol}
        wylaczony={!edytowalne}
        przyZmianie={(v) => przyZmianie({
          wspolwlasnosc: v ? 'laczna' : 'brak',
          ...(v ? {} : { wspolwlasciciele: '', udzial_licznik: '', udzial_mianownik: '' }),
        })}
        etykieta="Akcje należą do kilku osób wspólnie"
        opis="Rejestr wymienia wtedy pozostałych współwłaścicieli, a przy współwłasności w częściach ułamkowych — wielkość udziału (art. 300(33) § 1 pkt 5 KSH)."
        dzieci={
          <>
            <Pole etykieta="Rodzaj współwłasności" id={`${idPrefiks}-wspolwlasnosc`}>
              <select
                value={wspol ? dane.wspolwlasnosc : 'laczna'} disabled={!edytowalne}
                onChange={(z) => przyZmianie({ wspolwlasnosc: z.target.value })}
              >
                <option value="laczna">Współwłasność łączna (np. małżeńska)</option>
                <option value="ulamkowa">Współwłasność w częściach ułamkowych</option>
              </select>
            </Pole>
            <Pole etykieta="Pozostali współwłaściciele" podpowiedz="Imiona i nazwiska albo firmy, oddzielone przecinkami." {...wspolwlasciciele.pole}>
              <input type="text" {...wspolwlasciciele.wejscie} />
            </Pole>
            {dane.wspolwlasnosc === 'ulamkowa' && (
              <Pole
                etykieta="Udział"
                id={`${idPrefiks}-udzial_licznik`}
                blad={bledy.udzial_licznik}
                przyOpuszczeniu={przyOpuszczeniu ? () => przyOpuszczeniu('udzial_licznik') : undefined}
              >
                <div className="pole-ulamka">
                  <PoleLiczbowe wartosc={dane.udzial_licznik} przyZmianie={(v) => przyZmianie({ udzial_licznik: v ?? '' })} min={1} />
                  <span aria-hidden="true">/</span>
                  <PoleLiczbowe wartosc={dane.udzial_mianownik} przyZmianie={(v) => przyZmianie({ udzial_mianownik: v ?? '' })} min={1} />
                </div>
              </Pole>
            )}
          </>
        }
      />

      <ZwijanaSekcja
        tytul="Więcej danych"
        wypelniona={Boolean(dane.adres_doreczen || dane.adres_edoreczen || (!fizyczna && (dane.nip || dane.regon)))}
      >
        {!fizyczna && (
          <div className="siatka-2">
            <Pole etykieta="NIP" opcjonalne {...nip.pole}><input type="text" className="dane" {...nip.wejscie} /></Pole>
            <Pole etykieta="REGON" opcjonalne {...regon.pole}><input type="text" className="dane" {...regon.wejscie} /></Pole>
          </div>
        )}
        {!fizyczna && ostrzezeniaIdentyfikatora.nip}
        <Pole
          etykieta="Inny adres do doręczeń"
          opcjonalne
          podpowiedz={portal ? 'Jeśli pisma mają przychodzić gdzie indziej niż na adres powyżej.' : undefined}
          {...adresDoreczen.pole}
        >
          <input type="text" {...adresDoreczen.wejscie} />
        </Pole>
        <Pole etykieta="Adres do doręczeń elektronicznych" opcjonalne podpowiedz="Skrzynka e-Doręczeń, jeśli istnieje." {...adresEdoreczen.pole}>
          <input type="text" {...adresEdoreczen.wejscie} />
        </Pole>
        {!portal && (
          <Pole
            etykieta="Adres wpisywany do rejestru"
            podpowiedz="Art. 300(33) § 1 pkt 3 KSH — do rejestru wchodzi jeden z trzech adresów."
            id={`${idPrefiks}-rodzaj_adresu_rejestrowego`}
            blad={bledy.rodzaj_adresu_rejestrowego}
          >
            <select
              value={dane.rodzaj_adresu_rejestrowego || 'zamieszkania'} disabled={!edytowalne}
              onChange={(z) => przyZmianie({ rodzaj_adresu_rejestrowego: z.target.value })}
            >
              <option value="zamieszkania">{fizyczna ? 'Adres zamieszkania' : 'Adres siedziby'}</option>
              <option value="doreczen">Inny adres do doręczeń</option>
              <option value="edoreczen">Adres do doręczeń elektronicznych</option>
            </select>
          </Pole>
        )}
      </ZwijanaSekcja>
    </div>
  );
}
