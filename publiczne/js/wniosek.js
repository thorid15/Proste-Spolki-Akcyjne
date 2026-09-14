/* wniosek.js — wniosek o prowadzenie rejestru akcjonariuszy, portal klienta.

   Kreator prowadzi przez cztery etapy: spółka, reprezentant, akcjonariusze,
   podsumowanie. Podział nie jest kosmetyczny — pierwotnie spółka i
   reprezentant stały w jednym kroku, co dawało ekran z dwudziestoma kilkoma
   polami i dwoma różnymi tematami; nie da się go objąć wzrokiem ani wrócić
   do właściwego miejsca po przerwie.

   Akcjonariuszy zbiera LISTA, nie stos rozwiniętych formularzy: widać
   wszystkich naraz, a dane jednego otwiera się osobno i zamyka po
   wypełnieniu. Kolejnego można dopisać dopiero, gdy poprzedni ma nazwisko
   albo firmę — inaczej lista zapełnia się pustymi wierszami, o których nikt
   już nie pamięta, kto miał w nich być.

   Dane trafiają do `psa_wnioski_akcjonariusze` (server/trasy/portal.js), a NIE
   do kartoteki wspólnej: prawdziwymi osobami stają się dopiero, gdy
   kancelaria wniosek przyjmie. Krok spółki i reprezentanta zapisuje się
   jednym PUT całości, każdy akcjonariusz osobno. */

const KROKI_WNIOSKU = ['Spółka', 'Reprezentant', 'Akcjonariusze', 'Podsumowanie'];

const PUSTY_AKCJONARIUSZ_WNIOSKU = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '',
  pesel: '', bez_pesel: 0, data_urodzenia: '', plec: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: 'KRS',
  kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  adres_doreczen: '', adres_edoreczen: '', email: '', telefon: '',
  // Art. 300(33) § 1 pkt 3 KSH — do rejestru wchodzi JEDEN adres, wskazany
  // świadomie, a nie wszystkie wypełnione naraz.
  rodzaj_adresu_rejestrowego: 'zamieszkania',
  // Art. 300(33) § 1 pkt 4 KSH — zgoda dotyczy adresu E-MAIL i jest
  // oświadczeniem samego akcjonariusza, nie zarządu (stąd trzy stany).
  zgoda_email_status: 'brak',
  // Art. 300(33) § 1 pkt 5 KSH — współwłasność akcji.
  wspolwlasnosc: 'brak', wspolwlasciciele: '', udzial_licznik: '', udzial_mianownik: '',
};

const OPIS_ADRESU_REJESTROWEGO = {
  zamieszkania: 'adres zamieszkania / siedziby',
  doreczen: 'inny adres do doręczeń',
  edoreczen: 'adres do e-Doręczeń',
};

/**
 * Etykieta pozycji na liście dokumentów. Nazwa pliku niesie jeszcze numer KRS
 * i rozszerzenie — potrzebne w pobranym pliku, zbędne na ekranie, gdzie cała
 * lista dotyczy tej samej spółki i tego samego formatu.
 */
function etykietaDokumentu(nazwaPliku) {
  return String(nazwaPliku || '')
    .replace(/\.pdf$/i, '')
    .replace(/\s+—\s+KRS\s+\d+$/i, '');
}

/**
 * Jedna pozycja listy „Dokumenty do podpisu": wystawiony dokument do
 * pobrania i miejsce na jego podpisany skan.
 *
 * Slot na skan siedzi PRZY dokumencie, a nie w osobnym formularzu na dole
 * ekranu: klient odsyła kilka plików, każdy do czego innego, i bez tego
 * powiązania musiałby pamiętać, co czym jest — a kancelaria zgadywać.
 */
function PozycjaDokumentu({ dokument, edytowalne, przyZmianie }) {
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const wejscie = useRef(null);
  const podpisany = Boolean(dokument.podpis_nazwa_pliku);

  async function wyslij(plik) {
    if (!plik) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const formularz = new FormData();
      formularz.append('plik', plik);
      const odp = await fetch(`/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`, {
        method: 'POST',
        body: formularz,
      });
      const tresc = await odp.json().catch(() => ({}));
      if (!odp.ok) throw new Error(tresc.blad || `Nie udało się przesłać pliku (błąd ${odp.status}).`);
      przyZmianie(tresc);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
      if (wejscie.current) wejscie.current.value = '';
    }
  }

  async function usun() {
    if (!window.confirm('Usunąć przesłany skan tego dokumentu?')) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      przyZmianie(await API.delete(`/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`));
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pliku.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <div className={`dokument-pozycja ${podpisany ? 'dokument-pozycja-gotowa' : ''}`}>
      <div className="dokument-pozycja-glowna">
        <Ikona nazwa="pobierz" rozmiar={17} />
        <a
          className="dokument-pozycja-nazwa"
          href={`/api/psa/portal/wniosek/dokumenty/${dokument.id}`}
          target="_blank"
          rel="noopener"
        >
          {etykietaDokumentu(dokument.nazwa_pliku)}
        </a>
        <span className="dokument-pozycja-rozmiar">
          {Math.max(1, Math.round((dokument.rozmiar || 0) / 1024))} kB
        </span>
      </div>

      <div className="dokument-pozycja-podpis">
        {podpisany ? (
          <>
            <Znacznik odmiana="zielony">podpisany</Znacznik>
            <a
              className="dokument-pozycja-skan"
              href={`/api/psa/portal/wniosek/dokumenty/${dokument.id}/podpis`}
              target="_blank"
              rel="noopener"
            >
              {dokument.podpis_nazwa_pliku}
            </a>
            {edytowalne && (
              <button className="btn btn-sm" onClick={usun} disabled={wysylanie}>
                {wysylanie ? 'Usuwanie…' : 'Usuń'}
              </button>
            )}
          </>
        ) : (
          <>
            <span className="dokument-pozycja-czeka">czeka na podpisany skan</span>
            {edytowalne && (
              <>
                {/* Systemowe „Choose File / No file chosen" jest po angielsku
                    i wygląda inaczej w każdej przeglądarce — w komplecie
                    ośmiu dokumentów robiło z listy zbieraninę. Pole zostaje
                    ukryte, klika się przycisk aplikacji. */}
                <input
                  ref={wejscie}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={wysylanie}
                  onChange={(z) => wyslij(z.target.files[0])}
                  className="pole-pliku-ukryte"
                />
                <button
                  type="button"
                  className="btn btn-maly"
                  disabled={wysylanie}
                  onClick={() => wejscie.current && wejscie.current.click()}
                >
                  {wysylanie ? 'Przesyłanie…' : 'Wgraj podpisany skan'}
                </button>
              </>
            )}
          </>
        )}
      </div>
      <Komunikat odmiana="blad" tresc={blad} />
    </div>
  );
}

/** Adres zamieszkania albo siedziby złożony z pól formularza — jedną linią. */
function adresAkcjonariusza(a) {
  const linia = [
    [a.kod_pocztowy, a.miejscowosc].filter(Boolean).join(' ').trim(),
    [a.ulica, a.nr_domu, a.nr_lokalu && `m. ${a.nr_lokalu}`].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');
  return linia || null;
}

/**
 * Podsumowanie pokazuje ADRES, nie nazwę jego rodzaju. Wcześniej stała tu
 * etykieta „adres zamieszkania / siedziby", przez co wypełniony i pusty
 * formularz wyglądały na ekranie tak samo — klient widział podpis rubryki
 * zamiast tego, co w niej wpisał.
 *
 * Który z podanych adresów wejdzie do treści rejestru (art. 300(33) § 1
 * pkt 3 KSH dopuszcza jeden) rozstrzyga kancelaria przy weryfikacji, więc
 * wymieniamy po prostu wszystkie podane.
 */
function opisAdresowAkcjonariusza(a) {
  const podane = [];
  const adres = adresAkcjonariusza(a);
  if (adres) podane.push(adres);
  if (a.adres_doreczen && String(a.adres_doreczen).trim()) {
    podane.push(`do doręczeń: ${String(a.adres_doreczen).trim()}`);
  }
  if (a.adres_edoreczen && String(a.adres_edoreczen).trim()) {
    podane.push(`e-Doręczenia: ${String(a.adres_edoreczen).trim()}`);
  }
  return podane.length > 0 ? podane.join(' · ') : 'brak adresu';
}

const OPIS_ZGODY_EMAIL = {
  brak: 'bez zgody na e-mail',
  zadeklarowana: 'zgoda na e-mail — do potwierdzenia',
  potwierdzona: 'zgoda na e-mail potwierdzona',
};

const OPIS_WSPOLWLASNOSCI = {
  laczna: 'współwłasność łączna',
  ulamkowa: 'współwłasność ułamkowa',
};

function nazwaAkcjonariusza(a) {
  if (a.typ === 'prawna') return a.nazwa || 'podmiot bez nazwy';
  return [a.imie, a.nazwisko].filter(Boolean).join(' ') || 'osoba bez nazwiska';
}

function identyfikatorAkcjonariusza(a) {
  if (a.typ === 'prawna') {
    if (a.numer_w_rejestrze) return `${a.nazwa_rejestru || 'rejestr'} ${a.numer_w_rejestrze}`;
    if (a.nip) return `NIP ${a.nip}`;
    return 'bez numeru w rejestrze';
  }
  if (a.pesel) return `PESEL ${a.pesel}`;
  if (a.data_urodzenia) return `ur. ${fmt.data(a.data_urodzenia)}`;
  return 'bez PESEL-u i daty urodzenia';
}

/**
 * Braki wobec art. 300(33) § 1 KSH — lustro `server/logika/akcjonariusz.js`.
 * Serwer i tak sprawdza to u siebie; tutaj chodzi o to, żeby klient zobaczył
 * braki PRZED kliknięciem „Złóż wniosek”, a nie dopiero w odpowiedzi.
 */
function brakiUstawoweAkcjonariusza(a) {
  const braki = [];
  const kto = nazwaAkcjonariusza(a);
  const pusty = (v) => v === undefined || v === null || String(v).trim() === '';

  if (a.typ === 'prawna') {
    if (pusty(a.nazwa)) braki.push(`${kto}: brak firmy (nazwy) podmiotu.`);
    if (pusty(a.numer_w_rejestrze) !== pusty(a.nazwa_rejestru)) {
      braki.push(`${kto}: numer w rejestrze i nazwę rejestru podaje się razem.`);
    }
  } else {
    if (pusty(a.nazwisko)) braki.push(`${kto}: brak nazwiska.`);
    if (pusty(a.pesel) && pusty(a.data_urodzenia)) {
      braki.push(`${kto}: podaj PESEL albo — gdy akcjonariusz go nie ma — datę urodzenia.`);
    }
    if (Number(a.bez_pesel) === 1 && pusty(a.data_urodzenia)) {
      braki.push(`${kto}: przy braku numeru PESEL data urodzenia jest obowiązkowa.`);
    }
  }

  const wypelniony = {
    zamieszkania: [a.kod_pocztowy, a.miejscowosc, a.ulica].some((v) => !pusty(v)),
    doreczen: !pusty(a.adres_doreczen),
    edoreczen: !pusty(a.adres_edoreczen),
  };
  // Klient wpisuje tyle adresów, ile akcjonariusz posiada — który z nich
  // trafi do treści rejestru wybiera kancelaria przy weryfikacji (patrz
  // POLA_KOREKTY_AKCJONARIUSZA w wnioski.js), więc na tym etapie brakiem
  // jest wyłącznie brak JAKIEGOKOLWIEK adresu, nie brak wyboru.
  if (!Object.values(wypelniony).some(Boolean)) {
    braki.push(`${kto}: brak jakiegokolwiek adresu.`);
  }

  if (a.zgoda_email_status && a.zgoda_email_status !== 'brak' && pusty(a.email)) {
    braki.push(`${kto}: zaznaczono zgodę na komunikację elektroniczną, ale nie podano adresu e-mail.`);
  }

  if (a.wspolwlasnosc && a.wspolwlasnosc !== 'brak') {
    if (pusty(a.wspolwlasciciele)) {
      braki.push(`${kto}: przy współwłasności akcji wpisz pozostałych współwłaścicieli.`);
    }
    if (a.wspolwlasnosc === 'ulamkowa' && (pusty(a.udzial_licznik) || pusty(a.udzial_mianownik))) {
      braki.push(`${kto}: przy współwłasności ułamkowej podaj wielkość udziału.`);
    }
  }

  return braki;
}

/**
 * Formularz JEDNEGO akcjonariusza — otwierany z listy, zamykany po
 * wypełnieniu. Bez śródtytułów: pola same mówią, co w nich wpisać, a
 * nagłówek „Adres" nad polem „Kod pocztowy" nie dodaje żadnej wiedzy.
 *
 * Kolejność jest kolejnością dokumentu tożsamości: kto to jest, jak go
 * zidentyfikować, gdzie mieszka, jak się z nim skontaktować. Rzadkie dane
 * (dalsze adresy, współwłasność akcji) siedzą zwinięte na dole.
 */
function FormularzAkcjonariusza({ pozycja, edytowalne, przyZapisie, przyUsunieciu, przyZamknieciu }) {
  // Kolumny puste w bazie wracają jako `null`, a rozwinięcie `...pozycja`
  // nadpisałoby nimi wartości domyślne — dlatego wartości puste odpadają
  // przed scaleniem. Bez tego świeża pozycja gubiła np. „KRS” w polu
  // „Nazwa rejestru” i wracała potem jako brak ustawowy.
  const [dane, ustawDane] = useState({
    ...PUSTY_AKCJONARIUSZ_WNIOSKU,
    ...Object.fromEntries(Object.entries(pozycja).filter(([, v]) => v !== null && v !== undefined)),
  });
  const [usuwanie, ustawUsuwanie] = useState(false);
  const [zamykanie, ustawZamykanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const stanZapisu = useAutozapis(
    dane,
    (wartosci) => API.put(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`, wartosci),
    { wlaczony: edytowalne, przyZapisie: (w) => przyZapisie(w.akcjonariusz) }
  );

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
    disabled: !edytowalne,
    // Autouzupełnianie przeglądarki podstawiało tu WŁASNE dane właściciela
    // komputera (w kancelarii: nazwę i adres kancelarii), nadpisując to, co
    // klient wpisał — i taka nazwa szła potem do umowy. Formularz rejestru
    // opisuje cudze dane, więc książka adresowa przeglądarki nie ma tu czego
    // szukać.
    autoComplete: 'off',
  });

  // Autouzupelnienie daty urodzenia i plci z numeru PESEL — jednorazowe,
  // uzupelnia wylacznie puste pola, wiec nie nadpisuje niczyjej poprawki.
  const pesel = dane.typ === 'fizyczna' ? parsujPesel(dane.pesel) : null;
  useEffect(() => {
    if (!pesel) return;
    ustawDane((p) => ({
      ...p,
      data_urodzenia: p.data_urodzenia || pesel.data_urodzenia,
      plec: p.plec || pesel.plec,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dane.pesel]);

  async function usun() {
    if (!window.confirm('Usunąć tego akcjonariusza z wniosku?')) return;
    ustawUsuwanie(true);
    ustawBlad(null);
    try {
      await API.delete(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`);
      przyUsunieciu(pozycja.id);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pozycji.');
      ustawUsuwanie(false);
    }
  }

  /**
   * Autozapis czeka 800 ms od ostatniej zmiany, a „Gotowe" wraca do listy
   * natychmiast. Bez domknięcia zapisu ostatnie wpisane pole zdążyłoby
   * zniknąć z ekranu, zanim trafi na serwer.
   */
  async function zamknij() {
    if (!edytowalne) { przyZamknieciu(); return; }
    ustawZamykanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.put(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`, dane);
      przyZapisie(wynik.akcjonariusz);
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać danych.');
      ustawZamykanie(false);
    }
  }

  const bezPesel = Boolean(Number(dane.bez_pesel));
  const osobaFizyczna = dane.typ === 'fizyczna';
  // Dopóki pozycja nie ma nazwiska ani firmy, nagłówek nie udaje, że kogoś
  // opisuje: „osoba bez nazwiska" nad pustym formularzem brzmi jak zarzut.
  const nazwany = String(osobaFizyczna ? dane.nazwisko : dane.nazwa || '').trim() !== '';

  return (
    <>
      <KrokNaglowek tytul={nazwany ? nazwaAkcjonariusza(dane) : 'Nowy akcjonariusz'} />
      <Komunikat odmiana="blad" tresc={blad} />

      {/* Uwaga kancelarii siedzi PRZY POZYCJI, której dotyczy — notatka na
          całym wniosku przy pięciu akcjonariuszach nie mówi, przy kim
          poprawić. */}
      {pozycja.uwagi_kancelarii && (
        <Komunikat
          odmiana="uwaga"
          tytul="Kancelaria prosi o poprawienie tych danych"
          tresc={pozycja.uwagi_kancelarii}
        />
      )}

      <Pole etykieta="Rodzaj podmiotu">
        <select
          value={dane.typ}
          onChange={(z) => ustawDane((p) => ({ ...p, typ: z.target.value }))}
          disabled={!edytowalne}
        >
          <option value="fizyczna">Osoba fizyczna</option>
          <option value="prawna">Osoba prawna lub jednostka organizacyjna</option>
        </select>
      </Pole>

      {osobaFizyczna ? (
        <>
          <div className="siatka-2">
            <Pole etykieta="Imię"><input type="text" {...pole('imie')} /></Pole>
            <Pole etykieta="Nazwisko" wymagane><input type="text" {...pole('nazwisko')} /></Pole>
          </div>
          <div className="siatka-2">
            {!bezPesel && (
              <Pole etykieta="PESEL">
                <input type="text" {...pole('pesel')} maxLength={11} placeholder="11 cyfr" />
              </Pole>
            )}
            <Pole etykieta="Data urodzenia" wymagane={bezPesel}>
              <PoleDaty
                wartosc={dane.data_urodzenia || ''}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, data_urodzenia: v }))}
                wylaczone={!edytowalne}
              />
            </Pole>
          </div>
          <label className="chk">
            <input
              type="checkbox"
              checked={bezPesel}
              onChange={(z) =>
                ustawDane((p) => ({
                  ...p,
                  bez_pesel: z.target.checked ? 1 : 0,
                  // Deklaracja braku PESEL-u i wpisany numer wykluczają się —
                  // serwer odrzuciłby taki zapis, więc czyścimy pole od razu.
                  pesel: z.target.checked ? '' : p.pesel,
                }))
              }
              disabled={!edytowalne}
            />
            <span className="chk-tresc">Akcjonariusz nie posiada numeru PESEL</span>
          </label>
          {pesel && !pesel.poprawnaSumaKontrolna && (
            <Komunikat
              odmiana="uwaga"
              tresc="Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer. Zapis nie jest blokowany."
            />
          )}
        </>
      ) : (
        <>
          <Pole etykieta="Firma (nazwa)" wymagane><input type="text" {...pole('nazwa')} /></Pole>
          <div className="siatka-2">
            <Pole etykieta="Numer we właściwym rejestrze">
              <input type="text" {...pole('numer_w_rejestrze')} placeholder="0000123456" />
            </Pole>
            <Pole etykieta="Nazwa rejestru"><input type="text" {...pole('nazwa_rejestru')} /></Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="NIP" opcjonalne><input type="text" {...pole('nip')} /></Pole>
            <Pole etykieta="REGON" opcjonalne><input type="text" {...pole('regon')} /></Pole>
          </div>
        </>
      )}

      <div className="siatka-2">
        <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} placeholder="00-000" /></Pole>
        <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
      </div>
      <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
      <div className="siatka-2">
        <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
        <Pole etykieta="Nr lokalu" opcjonalne><input type="text" {...pole('nr_lokalu')} /></Pole>
      </div>

      <div className="siatka-2">
        <Pole etykieta="Adres e-mail">
          <input type="text" {...pole('email')} placeholder="przyklad@example.com" />
        </Pole>
        <Pole etykieta="Numer telefonu" opcjonalne><input type="text" {...pole('telefon')} /></Pole>
      </div>

      <Przelacznik
        wlaczony={Boolean(dane.zgoda_email_status) && dane.zgoda_email_status !== 'brak'}
        wylaczony={!edytowalne || dane.zgoda_email_status === 'potwierdzona'}
        przyZmianie={(v) =>
          ustawDane((p) => ({ ...p, zgoda_email_status: v ? 'zadeklarowana' : 'brak' }))
        }
        etykieta="Akcjonariusz wyraża zgodę na komunikację elektroniczną"
        opis="Przygotujemy oświadczenie do podpisu. Dopiero podpisane oświadczenie wprowadza adres e-mail do treści rejestru."
      />
      {dane.zgoda_email_status === 'potwierdzona' && (
        <Komunikat odmiana="ok" tresc="Zgoda potwierdzona podpisanym oświadczeniem akcjonariusza." />
      )}
      {dane.zgoda_email_status && dane.zgoda_email_status !== 'brak' && !dane.email && (
        <Komunikat odmiana="uwaga" tresc="Zaznaczono zgodę, ale nie podano adresu e-mail." />
      )}

      <Przelacznik
        wlaczony={Boolean(dane.wspolwlasnosc) && dane.wspolwlasnosc !== 'brak'}
        wylaczony={!edytowalne}
        przyZmianie={(v) =>
          ustawDane((p) => ({
            ...p,
            wspolwlasnosc: v ? 'laczna' : 'brak',
            wspolwlasciciele: v ? p.wspolwlasciciele : '',
            udzial_licznik: v ? p.udzial_licznik : '',
            udzial_mianownik: v ? p.udzial_mianownik : '',
          }))
        }
        etykieta="Akcje należą do kilku osób wspólnie"
        opis="Przy współwłasności rejestr wymienia pozostałych współwłaścicieli, a przy współwłasności ułamkowej także wielkość udziału."
        dzieci={
          <>
            <Pole etykieta="Rodzaj współwłasności">
              <select
                value={dane.wspolwlasnosc && dane.wspolwlasnosc !== 'brak' ? dane.wspolwlasnosc : 'laczna'}
                onChange={(z) => ustawDane((p) => ({ ...p, wspolwlasnosc: z.target.value }))}
                disabled={!edytowalne}
              >
                <option value="laczna">Współwłasność łączna (np. małżeńska)</option>
                <option value="ulamkowa">Współwłasność w częściach ułamkowych</option>
              </select>
            </Pole>
            <Pole etykieta="Pozostali współwłaściciele" wymagane podpowiedz="Imiona i nazwiska albo firmy (nazwy), oddzielone przecinkami.">
              <input type="text" {...pole('wspolwlasciciele')} />
            </Pole>
            {dane.wspolwlasnosc === 'ulamkowa' && (
              <div className="siatka-2">
                <Pole etykieta="Udział — licznik" wymagane>
                  <input type="number" min="1" {...pole('udzial_licznik')} />
                </Pole>
                <Pole etykieta="Udział — mianownik" wymagane>
                  <input type="number" min="1" {...pole('udzial_mianownik')} />
                </Pole>
              </div>
            )}
          </>
        }
      />

      <ZwijanaSekcja
        tytul="Inne adresy do doręczeń"
        wypelniona={Boolean(dane.adres_doreczen || dane.adres_edoreczen)}
      >
        <Pole
          etykieta="Inny adres do doręczeń"
          podpowiedz="Jeśli korespondencja ma iść gdzie indziej niż na adres zamieszkania albo siedziby."
        >
          <input type="text" {...pole('adres_doreczen')} />
        </Pole>
        <Pole etykieta="Adres do doręczeń elektronicznych" podpowiedz="Skrzynka e-Doręczeń, jeśli akcjonariusz ją posiada.">
          <input type="text" {...pole('adres_edoreczen')} placeholder="AE:PL-…" />
        </Pole>
      </ZwijanaSekcja>

      <NawigacjaKreatora
        wstecz={{ etykieta: 'Wróć do listy', przy: przyZamknieciu }}
        dalej={edytowalne
          ? { etykieta: zamykanie ? 'Zapisywanie…' : 'Gotowe', przy: zamknij, wylaczony: zamykanie }
          : null}
      />

      {edytowalne && (
        // Usuwanie stoi POD nawigacją i wygląda inaczej niż ona: sąsiedztwo
        // z zielonym „Gotowe" zamieniałoby pomyłkę w utratę danych.
        <div className="akcja-niszczaca">
          <StanZapisu stan={stanZapisu} />
          <button className="btn btn-maly btn-sygnal" onClick={usun} disabled={usuwanie}>
            {usuwanie ? 'Usuwanie…' : 'Usuń akcjonariusza'}
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Skan dokumentu tożsamości osoby, która podpisze umowę.
 *
 * Wniosek składa się zdalnie, więc notariusz może nigdy nie zobaczyć tej
 * osoby. Skan nie zastępuje okazania dokumentu — jest śladem, na czym
 * oparto identyfikację, i pozwala sprawdzić pisownię nazwiska oraz PESEL
 * przed wpisaniem ich do umowy.
 */
function PoleDowoduReprezentanta({ wniosek, edytowalne, przyZmianie }) {
  const [wysylanie, ustawWysylanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const wejscie = useRef(null);
  const jest = Boolean(wniosek.dowod_nazwa_pliku);

  async function wyslij(plik) {
    if (!plik) return;
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      const formularz = new FormData();
      formularz.append('plik', plik);
      const odp = await fetch('/api/psa/portal/wniosek/dowod', { method: 'POST', body: formularz });
      const tresc = await odp.json().catch(() => ({}));
      if (!odp.ok) throw new Error(tresc.blad || `Nie udało się przesłać pliku (błąd ${odp.status}).`);
      przyZmianie(tresc.wniosek);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
      if (wejscie.current) wejscie.current.value = '';
    }
  }

  async function usun() {
    ustawWysylanie(true);
    ustawBlad(null);
    try {
      przyZmianie((await API.delete('/api/psa/portal/wniosek/dowod')).wniosek);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pliku.');
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <Pole
      etykieta="Skan dokumentu tożsamości"
      podpowiedz="Dowód osobisty albo paszport osoby podpisującej umowę — skan lub zdjęcie. PDF, JPG, PNG."
    >
      {jest ? (
        <div className="lista-plikow">
          <div>
            <Ikona nazwa="dokument" rozmiar={15} />
            <a className="lista-plikow-nazwa" href="/api/psa/portal/wniosek/dowod" target="_blank" rel="noopener">
              {wniosek.dowod_nazwa_pliku}
            </a>
            <Znacznik odmiana="zielony">wgrany</Znacznik>
            {edytowalne && (
              <button type="button" className="btn-tekstowy" onClick={usun} disabled={wysylanie}>
                {wysylanie ? 'Usuwanie…' : 'usuń'}
              </button>
            )}
          </div>
        </div>
      ) : edytowalne ? (
        <>
          <input
            ref={wejscie}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="pole-pliku-ukryte"
            disabled={wysylanie}
            onChange={(z) => wyslij(z.target.files[0])}
          />
          <button
            type="button"
            className="btn"
            disabled={wysylanie}
            onClick={() => wejscie.current && wejscie.current.click()}
          >
            <Ikona nazwa="pobierz" rozmiar={16} /> {wysylanie ? 'Przesyłanie…' : 'Wybierz plik'}
          </button>
        </>
      ) : (
        <span className="wyciszony male">nie przesłano</span>
      )}
      <Komunikat odmiana="blad" tresc={blad} />
    </Pole>
  );
}

function EkranWniosku() {
  const [krok, ustawKrok] = useState(0);
  // Otwarty akcjonariusz zasłania listę: jeden temat na ekranie naraz.
  const [otwartyAkcjonariusz, ustawOtwartyAkcjonariusz] = useState(null);
  const [dane, ustawDane] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [blad, ustawBlad] = useState(null);
  const [pobieranieKrs, ustawPobieranieKrs] = useState(false);
  const [komunikatKrs, ustawKomunikatKrs] = useState(null);
  const [akcjonariusze, ustawAkcjonariusze] = useState([]);
  const [dodawanieAkcjonariusza, ustawDodawanieAkcjonariusza] = useState(false);
  const [bladAkcjonariuszy, ustawBladAkcjonariuszy] = useState(null);
  const [skladanie, ustawSkladanie] = useState(false);
  const [bladSkladania, ustawBladSkladania] = useState(null);
  const [ostrzezeniaZlozenia, ustawOstrzezeniaZlozenia] = useState([]);
  const [dokumenty, ustawDokumenty] = useState([]);

  useEffect(() => {
    Promise.all([
      API.get('/api/psa/portal/wniosek'),
      API.get('/api/psa/portal/wniosek/akcjonariusze'),
      API.get('/api/psa/portal/wniosek/dokumenty'),
    ])
      .then(([w, a, d]) => {
        ustawDane(w.wniosek);
        ustawAkcjonariusze(a.akcjonariusze);
        ustawDokumenty(d.dokumenty || []);
        // Złożony wniosek nie przyjmuje już zmian, więc trzy pierwsze kroki
        // nie mają czego od klienta chcieć — a przeklikiwanie ich po raz
        // drugi tylko odsuwa go od tego, po co wrócił: dokumentów do
        // podpisu. Kreator otwiera się wtedy od razu na podsumowaniu.
        if (!['w_przygotowaniu', 'do_uzupelnienia'].includes(w.wniosek.status)) {
          ustawKrok(KROKI_WNIOSKU.length - 1);
        }
      })
      .catch((e) => ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wczytać wniosku.'))
      .finally(() => ustawLadowanie(false));
  }, []);

  // Przejście między krokami przewija na górę. Bez tego dłuższy krok
  // zostawia następny zaczęty w połowie — z niewidocznym nagłówkiem.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [krok, otwartyAkcjonariusz]);

  const wniosekEdytowalny = Boolean(dane) && ['w_przygotowaniu', 'do_uzupelnienia'].includes(dane.status);
  // Lista dokumentow zostaje na ekranie takze PO odeslaniu umowy: reszta
  // skanow moze jeszcze wracac, a klient ma widziec, czego brakuje.
  const dokumentyWidoczne = Boolean(dane)
    && ['umowa_wygenerowana', 'umowa_podpisana'].includes(dane.status)
    && dokumenty.length > 0;
  const podpisanych = dokumenty.filter((d) => d.podpis_nazwa_pliku).length;

  // Dane spółki zapisują się same. Bez tego dawało się wypełnić formularz,
  // zobaczyć komplet na ekranie i dostać przy składaniu „uzupełnij nazwę
  // spółki” — bo serwer widział tylko to, co ktoś zdążył kliknąć „Zapisz”.
  const stanZapisuSpolki = useAutozapis(
    dane,
    (wartosci) => API.put('/api/psa/portal/wniosek', wartosci),
    { wlaczony: wniosekEdytowalny }
  );

  async function dodajAkcjonariusza() {
    ustawDodawanieAkcjonariusza(true);
    ustawBladAkcjonariuszy(null);
    try {
      const wynik = await API.post('/api/psa/portal/wniosek/akcjonariusze', {});
      ustawAkcjonariusze((p) => [...p, wynik.akcjonariusz]);
      // Nowa pozycja od razu się otwiera: dodanie akcjonariusza i wpisanie
      // jego danych to jedna czynność, nie dwie.
      ustawOtwartyAkcjonariusz(wynik.akcjonariusz.id);
    } catch (e) {
      ustawBladAkcjonariuszy(e instanceof BladApi ? e.message : 'Nie udało się dodać pozycji.');
    } finally {
      ustawDodawanieAkcjonariusza(false);
    }
  }

  function poZapisieAkcjonariusza(zapisany) {
    ustawAkcjonariusze((p) => p.map((a) => (a.id === zapisany.id ? zapisany : a)));
  }

  function poUsunieciuAkcjonariusza(id) {
    ustawAkcjonariusze((p) => p.filter((a) => a.id !== id));
    ustawOtwartyAkcjonariusz(null);
  }

  async function zlozWniosek() {
    ustawSkladanie(true);
    ustawBladSkladania(null);
    ustawOstrzezeniaZlozenia([]);
    try {
      // Autozapis czeka 800 ms od ostatniej zmiany. Gdyby ktoś dopisał
      // nazwę spółki i od razu kliknął „Złóż wniosek”, serwer mógłby jej
      // jeszcze nie mieć — więc domykamy zapis przed złożeniem.
      await API.put('/api/psa/portal/wniosek', dane);
      const wynik = await API.post('/api/psa/portal/wniosek/zloz', {});
      ustawDane(wynik.wniosek);
      ustawOstrzezeniaZlozenia(wynik.braki_akcjonariuszy || []);
      ustawDokumenty(wynik.dokumenty || []);
    } catch (e) {
      ustawBladSkladania(e instanceof BladApi ? e.message : 'Nie udało się złożyć wniosku.');
    } finally {
      ustawSkladanie(false);
    }
  }

  const pole = (klucz) => ({
    value: (dane && dane[klucz]) ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
    disabled: !wniosekEdytowalny,
    // Patrz komentarz przy tym samym haku w formularzu akcjonariusza:
    // podpowiedzi przeglądarki podmieniały nazwę i adres spółki na dane
    // zapamiętane w przeglądarce pracownika kancelarii.
    autoComplete: 'off',
  });

  async function pobierzZKrs() {
    const numer = String((dane && dane.krs) || '').replace(/\D/g, '');
    ustawPobieranieKrs(true);
    ustawKomunikatKrs(null);
    try {
      const wynik = await API.get(`/api/psa/portal/wniosek/z-krs/${numer}`);
      if (!wynik.znaleziono) {
        ustawKomunikatKrs({ odmiana: 'uwaga', tresc: wynik.komunikat });
      } else if (wynik.dopuszczalna === false) {
        ustawKomunikatKrs({ odmiana: 'blad', tresc: wynik.komunikat });
      } else {
        const { sklad_organu, ...reszta } = wynik.dane;
        const pobrane = Object.fromEntries(Object.entries(reszta).filter(([, v]) => v !== null && v !== ''));
        ustawDane((p) => ({ ...p, ...pobrane }));
        ustawKomunikatKrs({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : 'Dane pobrane z rejestru przedsiębiorców. Sprawdź je przed zapisaniem.',
        });
      }
    } catch (e) {
      ustawKomunikatKrs({ odmiana: 'uwaga', tresc: `${e.message} Uzupełnij dane ręcznie.` });
    } finally {
      ustawPobieranieKrs(false);
    }
  }

  if (ladowanie) return <Spinner />;
  if (!dane) return <Komunikat odmiana="blad" tresc={blad || 'Nie udało się wczytać wniosku.'} />;

  const adresSpolki = [
    [dane.kod_pocztowy, dane.miejscowosc].filter(Boolean).join(' '),
    [dane.ulica, dane.nr_domu && `nr ${dane.nr_domu}`, dane.nr_lokalu && `m. ${dane.nr_lokalu}`]
      .filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  // Te same reguły, co po stronie serwera (server/logika/akcjonariusz.js) —
  // tu wyłącznie po to, żeby braki było widać PRZED wysłaniem, a nie dopiero
  // w odpowiedzi.
  const brakiUstawowe = akcjonariusze.flatMap(brakiUstawoweAkcjonariusza);
  const otwarty = akcjonariusze.find((a) => a.id === otwartyAkcjonariusz) || null;
  // Kolejnego akcjonariusza dopisuje się dopiero, gdy poprzedni ma nazwisko
  // albo firmę. Inaczej lista zapełnia się pustymi wierszami „osoba bez
  // nazwiska”, których po tygodniu nikt już nie rozróżnia.
  const wszyscyNazwani = akcjonariusze.every((a) =>
    String(a.typ === 'prawna' ? a.nazwa : a.nazwisko || '').trim() !== '');
  const ostatniKrok = KROKI_WNIOSKU.length - 1;

  function nawigacja(dodatkoweDalej) {
    return (
      <NawigacjaKreatora
        wstecz={krok > 0 ? { etykieta: 'Wstecz', przy: () => ustawKrok((k) => k - 1) } : null}
        dalej={krok < ostatniKrok
          ? { etykieta: 'Dalej', przy: () => ustawKrok((k) => k + 1), ...(dodatkoweDalej || {}) }
          : null}
      />
    );
  }

  return (
    <div className="pion kreator-waski" style={{ gap: 16 }}>
      <Kroki kroki={KROKI_WNIOSKU} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />
      {/* Wniosek odesłany do uzupełnienia prowadzi teraz PROSTO do formularza
          (portal.js), więc uwagi kancelarii muszą być widoczne tutaj — inaczej
          klient zobaczyłby odblokowany formularz, nie wiedząc dlaczego. */}
      {dane.status === 'do_uzupelnienia' && dane.notatka_weryfikacji && (
        <Komunikat
          odmiana="uwaga"
          tytul="Kancelaria prosi o uzupełnienie wniosku"
          tresc={dane.notatka_weryfikacji}
        />
      )}
      {!wniosekEdytowalny && krok < ostatniKrok && (
        <Komunikat
          odmiana="uwaga"
          tresc="Wniosek został już złożony — dane są tylko do wglądu. Jeśli trzeba je poprawić, kancelaria odeśle wniosek do uzupełnienia."
        />
      )}

      <Karta>
        {krok === 0 && (
          <>
            <KrokNaglowek tytul="Dane spółki" />

            <Pole etykieta="Numer KRS">
              <div className="row-g">
                <input type="text" {...pole('krs')} maxLength={10} placeholder="0000123456" />
                <button
                  className="btn"
                  onClick={pobierzZKrs}
                  disabled={pobieranieKrs || String((dane && dane.krs) || '').replace(/\D/g, '').length !== 10}
                >
                  {pobieranieKrs ? 'Pobieranie…' : 'Pobierz z KRS'}
                </button>
              </div>
            </Pole>
            {komunikatKrs && <Komunikat odmiana={komunikatKrs.odmiana} tresc={komunikatKrs.tresc} />}

            <Pole etykieta="Firma (nazwa) spółki" wymagane>
              <input type="text" {...pole('nazwa')} />
            </Pole>
            <div className="siatka-2">
              <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
              <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
            </div>

            <div className="siatka-2">
              <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} placeholder="00-000" /></Pole>
              <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
            </div>
            <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
            <div className="siatka-2">
              <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
              <Pole etykieta="Nr lokalu" opcjonalne><input type="text" {...pole('nr_lokalu')} /></Pole>
            </div>

            <div className="siatka-2">
              <Pole etykieta="Sąd rejestrowy"><input type="text" {...pole('sad_rejestrowy')} /></Pole>
              <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
            </div>

            <Pole
              etykieta="Organ zarządzający"
              podpowiedz="P.S.A. może mieć zarząd albo — w strukturze monistycznej — radę dyrektorów; decyduje umowa spółki."
            >
              <select {...pole('organ_rodzaj')}>
                <option value="">— nie ustalono —</option>
                <option value="zarzad">Zarząd</option>
                <option value="rada_dyrektorow">Rada Dyrektorów</option>
              </select>
            </Pole>

            <div className="siatka-2">
              <Pole etykieta="Data rejestracji w KRS">
                <PoleDaty
                  wartosc={dane.data_utworzenia_spolki || ''}
                  przyZmianie={(v) => ustawDane((p) => ({ ...p, data_utworzenia_spolki: v }))}
                  wylaczone={!wniosekEdytowalny}
                />
              </Pole>
              <Pole etykieta="Kapitał akcyjny">
                <PoleKwoty
                  grosze={dane.kapital_akcyjny_grosze}
                  przyZmianie={(v) => ustawDane((p) => ({ ...p, kapital_akcyjny_grosze: v }))}
                />
              </Pole>
            </div>
            <Pole
              etykieta="Data zawarcia umowy spółki"
              podpowiedz="Data aktu notarialnego zawiązania spółki; przy spółce założonej w S24 — data podpisania w systemie."
            >
              <PoleDaty
                wartosc={dane.data_zawarcia_umowy_spolki || ''}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, data_zawarcia_umowy_spolki: v }))}
                wylaczone={!wniosekEdytowalny}
              />
            </Pole>

            <div className="siatka-2">
              <Pole etykieta="Adres e-mail spółki"><input type="text" {...pole('email')} /></Pole>
              <Pole etykieta="Telefon" opcjonalne><input type="text" {...pole('telefon')} /></Pole>
            </div>

            <ZwijanaSekcja
              tytul="Adres do doręczeń elektronicznych"
              wypelniona={Boolean(dane.adres_edorecze)}
            >
              <Pole etykieta="Adres do doręczeń elektronicznych" podpowiedz="Skrzynka e-Doręczeń spółki, jeśli została uruchomiona.">
                <input type="text" {...pole('adres_edorecze')} placeholder="AE:PL-…" />
              </Pole>
            </ZwijanaSekcja>

            {nawigacja()}
          </>
        )}

        {krok === 1 && (
          <>
            <KrokNaglowek
              tytul="Reprezentant spółki"
              opis="Osoba, która w imieniu spółki podpisze umowę o prowadzenie rejestru."
            />

            <div className="siatka-2">
              <Pole etykieta="Imię i nazwisko">
                <input type="text" {...pole('reprezentant_imie_nazwisko')} placeholder="np. Jan Kowalski" />
              </Pole>
              <Pole etykieta="Funkcja">
                <input type="text" {...pole('reprezentant_funkcja')} placeholder="np. Prezes Zarządu" />
              </Pole>
            </div>
            {/* Sposób reprezentacji NIE jest polem do wypełnienia — kancelaria
                sprawdza go na wydruku z KRS przy podpisaniu umowy, a przy
                pobraniu danych przyciskiem „Pobierz z KRS” wartość dochodzi
                razem z resztą i trafia do umowy bez udziału tego formularza. */}
            <div className="siatka-2">
              <Pole etykieta="PESEL"><input type="text" {...pole('reprezentant_pesel')} maxLength={11} /></Pole>
              <Pole etykieta="Dowód osobisty"><input type="text" {...pole('reprezentant_dowod')} placeholder="ABC 123456" /></Pole>
            </div>
            <Pole etykieta="Imiona rodziców">
              <input type="text" {...pole('reprezentant_rodzice')} placeholder="np. Piotr i Anna" />
            </Pole>
            <Pole etykieta="Adres zamieszkania">
              <input type="text" {...pole('reprezentant_adres')} />
            </Pole>
            <Pole
              etykieta="Adres e-mail"
              podpowiedz="Na ten adres trafi projekt umowy do podpisu i korespondencja w sprawie jej zawarcia."
            >
              <input type="email" {...pole('reprezentant_email')} />
            </Pole>

            <PoleDowoduReprezentanta
              wniosek={dane}
              edytowalne={wniosekEdytowalny}
              przyZmianie={(w) => ustawDane((p) => ({ ...p, ...w }))}
            />

            {nawigacja()}
          </>
        )}

        {krok === 2 && (otwarty ? (
          <FormularzAkcjonariusza
            key={otwarty.id}
            pozycja={otwarty}
            edytowalne={wniosekEdytowalny}
            przyZapisie={poZapisieAkcjonariusza}
            przyUsunieciu={poUsunieciuAkcjonariusza}
            przyZamknieciu={() => ustawOtwartyAkcjonariusz(null)}
          />
        ) : (
          <>
            <KrokNaglowek
              tytul="Akcjonariusze"
              opis="Aktualni akcjonariusze spółki, wpisz dane wszystkich osób."
            />
            <Komunikat odmiana="blad" tresc={bladAkcjonariuszy} />

            {akcjonariusze.length === 0 ? (
              <Pusto
                ikona="osoby"
                tytul="Nie dodano jeszcze żadnego akcjonariusza"
                opis="Wniosek wymaga przynajmniej jednej osoby, która obejmie akcje w spółce."
                akcja={wniosekEdytowalny && (
                  <button
                    className="btn btn-glowny btn-nawigacja"
                    onClick={dodajAkcjonariusza}
                    disabled={dodawanieAkcjonariusza}
                  >
                    {dodawanieAkcjonariusza ? 'Dodawanie…' : 'Dodaj akcjonariusza'}
                  </button>
                )}
              />
            ) : (
              <>
                <div className="lista-podmiotow">
                  {akcjonariusze.map((a) => {
                    const braki = brakiUstawoweAkcjonariusza(a).length;
                    return (
                      <WierszPodmiotu
                        key={a.id}
                        ikona={a.typ === 'prawna' ? 'spolki' : 'osoby'}
                        tytul={nazwaAkcjonariusza(a)}
                        znacznik={a.uwagi_kancelarii
                          ? 'do poprawy'
                          : braki > 0 ? 'do uzupełnienia' : null}
                        opis={[identyfikatorAkcjonariusza(a), opisAdresowAkcjonariusza(a)].join(' · ')}
                        przyKliknieciu={() => ustawOtwartyAkcjonariusz(a.id)}
                      />
                    );
                  })}
                </div>

                {wniosekEdytowalny && (
                  <>
                    <WierszDodania
                      etykieta={dodawanieAkcjonariusza ? 'Dodawanie…' : 'Dodaj kolejnego akcjonariusza'}
                      przyKliknieciu={dodajAkcjonariusza}
                      wylaczony={dodawanieAkcjonariusza || !wszyscyNazwani}
                    />
                    {!wszyscyNazwani && (
                      <div className="podpowiedz">
                        Uzupełnij nazwisko albo firmę poprzedniego akcjonariusza, zanim dodasz kolejnego.
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {nawigacja()}
          </>
        ))}

        {krok === 3 && (
          <>
            <KrokNaglowek
              tytul="Podsumowanie"
              opis={wniosekEdytowalny
                ? 'Sprawdź dane przed złożeniem wniosku. Po złożeniu kancelaria przygotuje komplet dokumentów do podpisu.'
                : 'Tak wygląda złożony wniosek. Dane są do wglądu — poprawić je można dopiero, gdy kancelaria odeśle wniosek do uzupełnienia.'}
            />
            <Komunikat odmiana="blad" tresc={bladSkladania} />

            {/* Stan sprawy stoi PRZED danymi, nie pod przyciskiem nawigacji:
                po powrocie do wniosku pierwsze pytanie brzmi „co się dzieje",
                a nie „co wpisałem". */}
            {dane.status === 'zlozony' && (
              <Komunikat
                odmiana="ok"
                tytul="Wniosek złożony"
                tresc="Kancelaria sprawdza dane i przygotowuje komplet dokumentów do podpisu. Gdy będą gotowe, napiszemy e-mailem — pobierzesz je wtedy w tym miejscu."
              />
            )}
            {dane.status === 'przyjety' && (
              <Komunikat
                odmiana="ok"
                tytul="Wniosek przyjęty"
                tresc="Kancelaria zweryfikowała dane i założyła spółkę w systemie. Rejestr akcjonariuszy zostanie otwarty po ustaleniu pierwszej emisji akcji — o dalszych krokach poinformujemy e-mailem."
              />
            )}
            {dane.status === 'odrzucony' && (
              <Komunikat
                odmiana="blad"
                tytul="Wniosek odrzucony"
                tresc="Kancelaria odrzuciła wniosek. W razie pytań prosimy o kontakt z kancelarią."
              />
            )}

            <dl className="podsumowanie">
              <dt>Firma (nazwa)</dt>
              <dd>{dane.nazwa || <span className="brak">nie uzupełniono</span>}</dd>
              <dt>Numer KRS</dt>
              <dd className="kol-dane">{dane.krs || <span className="brak">nie uzupełniono</span>}</dd>
              <dt>Siedziba</dt>
              <dd>{adresSpolki || <span className="brak">nie uzupełniono</span>}</dd>
              <dt>Reprezentant</dt>
              <dd>
                {dane.reprezentant_imie_nazwisko || <span className="brak">nie uzupełniono</span>}
                {dane.reprezentant_funkcja && (
                  <span className="podsumowanie-dopisek">{dane.reprezentant_funkcja}</span>
                )}
              </dd>
              <dt>E-mail reprezentanta</dt>
              <dd>{dane.reprezentant_email || <span className="brak">nie uzupełniono</span>}</dd>
            </dl>

            <h3 className="podsumowanie-naglowek">{`Akcjonariusze (${akcjonariusze.length})`}</h3>
            {akcjonariusze.length === 0 ? (
              <Pusto
                ikona="osoby"
                tytul="Brak akcjonariuszy"
                opis="Wróć do kroku „Akcjonariusze” i dodaj przynajmniej jedną osobę."
              />
            ) : (
              <div className="podsumowanie-lista">
                {akcjonariusze.map((a) => (
                  <div key={a.id} className="podsumowanie-pozycja">
                    <div className="podsumowanie-nazwa">{nazwaAkcjonariusza(a)}</div>
                    <div className="podsumowanie-cechy">
                      <span>{identyfikatorAkcjonariusza(a)}</span>
                      <span>{opisAdresowAkcjonariusza(a)}</span>
                      <span>{OPIS_ZGODY_EMAIL[a.zgoda_email_status || 'brak']}</span>
                      {a.wspolwlasnosc && a.wspolwlasnosc !== 'brak' && (
                        <span>{OPIS_WSPOLWLASNOSCI[a.wspolwlasnosc]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {brakiUstawowe.length > 0 && (
              <Komunikat
                odmiana="uwaga"
                tytul="Dane niepełne wobec art. 300³³ § 1 KSH"
                tresc="Wniosek można złożyć mimo tych braków — kancelaria uzupełni je przy weryfikacji. Warto jednak poprawić je teraz."
                lista={brakiUstawowe}
              />
            )}

            {wniosekEdytowalny && (
              <Komunikat
                odmiana="info"
                tresc="Po złożeniu wniosku kancelaria sprawdzi dane i przygotuje komplet dokumentów do podpisu — powiadomimy Cię e-mailem, gdy będą gotowe do pobrania. Dane spółki i listę akcjonariuszy będzie można poprawić tylko, jeśli kancelaria odeśle wniosek do uzupełnienia."
              />
            )}

            {dokumentyWidoczne && (
              <>
                <h3 className="podsumowanie-naglowek">Dokumenty do podpisu</h3>
                <Komunikat
                  odmiana="ok"
                  tresc="Kancelaria sprawdziła dane i przygotowała komplet dokumentów. Pobierz wszystkie pozycje z listy poniżej, zbierz podpisy i odeślij skany w tym samym miejscu."
                />
                {ostrzezeniaZlozenia.length > 0 && (
                  <Komunikat
                    odmiana="uwaga"
                    tresc="Sprawdź dokumenty przed podpisaniem — przy złożeniu wniosku część danych była niepełna."
                    lista={ostrzezeniaZlozenia}
                  />
                )}
                <Komunikat
                  odmiana="info"
                  tresc="Umowę podpisuje reprezentant spółki. Uchwałę o wyborze podmiotu prowadzącego rejestr oraz żądanie pierwszego wpisu podpisują wszyscy akcjonariusze wspólnie. Pozostałe oświadczenia każdy akcjonariusz podpisuje osobiście — zarząd nie może złożyć ich za niego."
                />
                <div className="lista-dokumentow">
                  {dokumenty.map((d) => (
                    <PozycjaDokumentu
                      key={d.id}
                      dokument={d}
                      edytowalne={dokumentyWidoczne}
                      przyZmianie={(wynik) => {
                        if (wynik.dokumenty) ustawDokumenty(wynik.dokumenty);
                        if (wynik.wniosek) ustawDane(wynik.wniosek);
                      }}
                    />
                  ))}
                </div>

                {podpisanych === dokumenty.length && (
                  <div className="podsumowanie-podpisow">
                    <Komunikat
                      odmiana="ok"
                      tytul="Komplet podpisanych dokumentów wrócił do kancelarii"
                      tresc="Nic więcej nie musisz robić. Kancelaria zweryfikuje dane i otworzy rejestr akcjonariuszy — o wyniku poinformujemy e-mailem."
                    />
                  </div>
                )}

                <div className="instrukcja-podpisu">
                  <div className="instrukcja-podpisu-tytul">Jak podpisać dokumenty</div>
                  <ul className="instrukcja-podpisu-lista">
                    <li>
                      <strong>Podpisem własnoręcznym</strong> — wydrukuj dokument, podpisz go odręcznie,
                      a następnie zeskanuj albo zrób czytelne zdjęcie każdej strony.
                    </li>
                    <li>
                      <strong>Kwalifikowanym podpisem elektronicznym</strong> — podpisz plik PDF bez
                      drukowania; podpis kwalifikowany jest równoważny podpisowi własnoręcznemu
                      (art. 78<sup>1</sup> § 2 Kodeksu cywilnego).
                    </li>
                    <li>
                      <strong>Podpisem zaufanym albo osobistym</strong> (profil zaufany, e-dowód) —
                      dokument podpisany w ten sposób również przyjmujemy.
                    </li>
                  </ul>
                </div>
              </>
            )}

            {/* Nawigacja zamyka krok — stoi pod wszystkim, także pod listą
                dokumentów do podpisu. Wcześniej wypadała w środku ekranu,
                między akcjonariuszami a dokumentami, i wyglądała jak koniec
                strony, choć połowa treści była jeszcze niżej. */}
            {wniosekEdytowalny ? (
              <>
                {(!dane.nazwa || akcjonariusze.length === 0) && (
                  <div className="podpowiedz">
                    {!dane.nazwa && 'Uzupełnij nazwę spółki (krok „Spółka”). '}
                    {akcjonariusze.length === 0 && 'Dodaj przynajmniej jednego akcjonariusza (krok „Akcjonariusze”).'}
                  </div>
                )}
                <NawigacjaKreatora
                  wstecz={{ etykieta: 'Wstecz', przy: () => ustawKrok((k) => k - 1) }}
                  dalej={{
                    etykieta: skladanie ? 'Składanie…' : 'Złóż wniosek',
                    przy: zlozWniosek,
                    wylaczony: skladanie || !dane.nazwa || akcjonariusze.length === 0,
                  }}
                />
              </>
            ) : (
              <NawigacjaKreatora wstecz={{ etykieta: 'Wstecz', przy: () => ustawKrok((k) => k - 1) }} />
            )}
          </>
        )}
      </Karta>

      {krok < ostatniKrok && wniosekEdytowalny && (
        <div className="stan-zapisu-kreatora"><StanZapisu stan={stanZapisuSpolki} /></div>
      )}
    </div>
  );
}

window.EkranWniosku = EkranWniosku;
