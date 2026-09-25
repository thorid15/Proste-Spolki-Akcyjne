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

/* Jeden zestaw pól osoby dla wniosku i kartoteki — formularz-osoby.js. */
const PUSTY_AKCJONARIUSZ_WNIOSKU = PUSTA_OSOBA_FORMULARZA;

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
        {/* B6 — dokument, którego klient jeszcze nie otworzył (kolumna
            ustawia się przy pierwszym pobraniu, `pakiet-wniosku.js`). */}
        {!dokument.otwarto_w_portalu && <Pigulka odmiana="mosiadz">nowy</Pigulka>}
        <span className="dokument-pozycja-rozmiar">
          {Math.max(1, Math.round((dokument.rozmiar || 0) / 1024))} kB
        </span>
      </div>

      <div className="dokument-pozycja-podpis">
        {podpisany ? (
          <>
            <Pigulka odmiana="rejestr">podpisany</Pigulka>
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
  return formatujAdres(a) || null;
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
 * Serwer BLOKUJE nimi złożenie wniosku; tutaj chodzi o to, żeby klient
 * zobaczył je PRZED kliknięciem „Złóż wniosek”, a nie dopiero w odpowiedzi.
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
  const [dane, ustawDane] = useState(() => osobaDoFormularza(pozycja, PUSTY_AKCJONARIUSZ_WNIOSKU));
  const idPrefiks = `akcjonariusz-${pozycja.id}`;
  // B4: reguła „PESEL albo data urodzenia" i pozostałe braki ustawowe
  // pokazują się PRZY POLACH — po ich opuszczeniu albo przy „Gotowe" — a
  // nie dopiero na podsumowaniu wniosku.
  const walidacja = useWalidacjaOsoby(dane, { tryb: 'portal' });
  const [usuwanie, ustawUsuwanie] = useState(false);
  const [zamykanie, ustawZamykanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const stanZapisu = useAutozapis(
    dane,
    (wartosci) => API.put(`/api/psa/portal/wniosek/akcjonariusze/${pozycja.id}`, wartosci),
    { wlaczony: edytowalne, przyZapisie: (w) => przyZapisie(w.akcjonariusz) }
  );

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
    if (!walidacja.czyPoprawne) {
      walidacja.pokazWszystkie();
      return;
    }
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

  const osobaFizyczna = dane.typ !== 'prawna';
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

      {walidacja.pokazywaneWszystkie && (
        <PodsumowanieBledow bledy={listaBledowOsoby(walidacja.widoczne, idPrefiks)} tytul="Uzupełnij dane akcjonariusza" />
      )}

      <FormularzOsoby
        dane={dane}
        przyZmianie={(latka) => ustawDane((p) => ({ ...p, ...latka }))}
        tryb="portal"
        bledy={walidacja.widoczne}
        przyOpuszczeniu={walidacja.dotknij}
        idPrefiks={idPrefiks}
        edytowalne={edytowalne}
      />

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
            <Pigulka odmiana="rejestr">wgrany</Pigulka>
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
  // Pasek postępu klikalny wstecz i do kroków już odwiedzonych (0.4 pkt 8,
  // FAZA4 pkt 4) — bez osobnego śledzenia „najdalej” każdy powrót do kroku
  // 0 cofałby granicę klikalności do bieżącego kroku.
  const [najdalejOsiagniety, ustawNajdalej] = useState(0);
  useEffect(() => { ustawNajdalej((m) => Math.max(m, krok)); }, [krok]);
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
  // Braki odesłane przez serwer przy odmowie złożenia — normalnie pusta:
  // przycisk „Złóż wniosek” jest wtedy nieaktywny. Zostaje na wypadek
  // rozjazdu reguł po obu stronach.
  const [brakiZSerwera, ustawBrakiZSerwera] = useState([]);
  const [dokumenty, ustawDokumenty] = useState([]);
  // B8 — „Użyj danych reprezentanta z poprzedniego wniosku" (kopia, nie
  // powiązanie): tylko konto „spolka" może mieć wcześniejszy, zamknięty
  // wniosek — wnioskodawca wypełnia pierwszy i jedyny.
  const { dane: listaWnioskow } = useDane('/api/psa/portal/wnioski');
  const poprzedniWniosek = dane && listaWnioskow
    ? (listaWnioskow.wnioski || []).find((w) => w.id !== dane.id && w.reprezentant_imie_nazwisko)
    : null;

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
  // Skany zalacza sie po kolei i wymienia do woli; do kancelarii ida dopiero
  // po kliknieciu „Odeslij komplet". Dotad wgranie samej umowy — zwykle
  // pierwszego z osmiu plikow — stawialo wniosek w kolejce kancelarii.
  const kompletZalaczony = dokumenty.length > 0 && podpisanych === dokumenty.length;
  const kompletOdeslany = Boolean(dane) && dane.status === 'umowa_podpisana';

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

  async function odeslijKomplet() {
    ustawSkladanie(true);
    ustawBladSkladania(null);
    ustawBrakiZSerwera([]);
    try {
      const wynik = await API.post('/api/psa/portal/wniosek/odeslij', {});
      ustawDane(wynik.wniosek);
      ustawDokumenty(wynik.dokumenty || []);
    } catch (e) {
      ustawBladSkladania(e instanceof BladApi ? e.message : 'Nie udało się odesłać kompletu.');
      const szczegoly = e instanceof BladApi && e.dane && e.dane.szczegoly;
      ustawBrakiZSerwera(Array.isArray(szczegoly) ? szczegoly : []);
    } finally {
      ustawSkladanie(false);
    }
  }

  async function zlozWniosek() {
    ustawSkladanie(true);
    ustawBladSkladania(null);
    ustawBrakiZSerwera([]);
    try {
      // Autozapis czeka 800 ms od ostatniej zmiany. Gdyby ktoś dopisał
      // nazwę spółki i od razu kliknął „Złóż wniosek”, serwer mógłby jej
      // jeszcze nie mieć — więc domykamy zapis przed złożeniem.
      await API.put('/api/psa/portal/wniosek', dane);
      const wynik = await API.post('/api/psa/portal/wniosek/zloz', {});
      ustawDane(wynik.wniosek);
      ustawDokumenty(wynik.dokumenty || []);
    } catch (e) {
      ustawBladSkladania(e instanceof BladApi ? e.message : 'Nie udało się złożyć wniosku.');
      const szczegoly = e instanceof BladApi && e.dane && e.dane.szczegoly;
      ustawBrakiZSerwera(Array.isArray(szczegoly) ? szczegoly : []);
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
      <Kroki kroki={KROKI_WNIOSKU} biezacy={krok} przyWyborze={ustawKrok} osiagniety={najdalejOsiagniety} />
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

            {poprzedniWniosek && wniosekEdytowalny && !dane.reprezentant_imie_nazwisko && (
              <Komunikat
                odmiana="info"
                tresc={
                  <span className="rzad-rozdzielony">
                    <span>Te same dane reprezentanta jak w „{poprzedniWniosek.nazwa || 'poprzednim wniosku'}"?</span>
                    <button
                      type="button"
                      className="btn btn-maly"
                      onClick={() => ustawDane((p) => ({
                        ...p,
                        reprezentant_imie_nazwisko: poprzedniWniosek.reprezentant_imie_nazwisko,
                        reprezentant_funkcja: poprzedniWniosek.reprezentant_funkcja,
                        reprezentant_reprezentacja: poprzedniWniosek.reprezentant_reprezentacja,
                        reprezentant_rodzice: poprzedniWniosek.reprezentant_rodzice,
                        reprezentant_pesel: poprzedniWniosek.reprezentant_pesel,
                        reprezentant_dowod_rodzaj: poprzedniWniosek.reprezentant_dowod_rodzaj,
                        reprezentant_dowod_numer: poprzedniWniosek.reprezentant_dowod_numer,
                        reprezentant_kraj: poprzedniWniosek.reprezentant_kraj,
                        reprezentant_kod_pocztowy: poprzedniWniosek.reprezentant_kod_pocztowy,
                        reprezentant_miejscowosc: poprzedniWniosek.reprezentant_miejscowosc,
                        reprezentant_ulica: poprzedniWniosek.reprezentant_ulica,
                        reprezentant_nr_domu: poprzedniWniosek.reprezentant_nr_domu,
                        reprezentant_nr_lokalu: poprzedniWniosek.reprezentant_nr_lokalu,
                        reprezentant_email: poprzedniWniosek.reprezentant_email,
                      }))}
                    >
                      Użyj danych reprezentanta z poprzedniego wniosku
                    </button>
                  </span>
                }
              />
            )}

            <div className="siatka-2">
              <Pole etykieta="Imię i nazwisko">
                <input type="text" {...pole('reprezentant_imie_nazwisko')} placeholder="np. Jan Kowalski" />
              </Pole>
              <Pole etykieta="Funkcja">
                <input type="text" {...pole('reprezentant_funkcja')} placeholder="np. Prezes Zarządu" />
              </Pole>
            </div>
            <Pole
              etykieta="Sposób reprezentacji"
              podpowiedz="Z odpisu KRS, dział 2 — np. „jednoosobowo” albo „dwóch członków zarządu łącznie”. Dane pobrane przyciskiem „Pobierz z KRS” nadpiszą to pole automatycznie."
            >
              <input type="text" {...pole('reprezentant_reprezentacja')} placeholder="np. jednoosobowo" />
            </Pole>
            <Pole
              etykieta="PESEL"
              ostrzezenie={dane && walidujPesel(dane.reprezentant_pesel).ostrzezenie}
            >
              <input type="text" {...pole('reprezentant_pesel')} maxLength={11} />
            </Pole>
            <PoleDowod
              etykieta="Dowód tożsamości"
              rodzaj={dane && dane.reprezentant_dowod_rodzaj}
              numer={dane && dane.reprezentant_dowod_numer}
              przyZmianie={(latka) => ustawDane((p) => ({ ...p, ...latka }))}
              edytowalne={wniosekEdytowalny}
              idPrefiks="wniosek-reprezentant"
              klucze={{ rodzaj: 'reprezentant_dowod_rodzaj', numer: 'reprezentant_dowod_numer' }}
            />
            <Pole etykieta="Imiona rodziców">
              <input type="text" {...pole('reprezentant_rodzice')} placeholder="np. Piotr i Anna" />
            </Pole>
            <PoleAdres
              etykieta="Adres zamieszkania"
              dane={dane || {}}
              przyZmianie={(latka) => ustawDane((p) => ({ ...p, ...latka }))}
              prefiks="reprezentant_"
              edytowalne={wniosekEdytowalny}
              idPrefiks="wniosek-reprezentant"
            />
            {dane && !dane.reprezentant_kod_pocztowy && !dane.reprezentant_ulica && dane.reprezentant_adres && (
              <Komunikat
                odmiana="info"
                tresc={`Adres wpisany wcześniej, w jednym polu: „${dane.reprezentant_adres}”. Wpisz go ponownie powyżej, żeby pisma mogły go użyć w nowym formacie.`}
              />
            )}
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
                ? 'Sprawdź dane przed złożeniem wniosku.'
                : null}
            />
            <Komunikat odmiana="blad" tresc={bladSkladania} lista={brakiZSerwera} />

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

            <div className="rzad-rozdzielony">
              <h3 className="podsumowanie-naglowek">Dane spółki</h3>
              {wniosekEdytowalny && (
                <button type="button" className="btn-tekstowy" onClick={() => ustawKrok(0)}>Zmień</button>
              )}
            </div>
            <dl className="podsumowanie">
              <dt>Firma (nazwa)</dt>
              <dd>{dane.nazwa || <span className="brak">nie uzupełniono</span>}</dd>
              <dt>Numer KRS</dt>
              <dd className="kol-dane">{dane.krs || <span className="brak">nie uzupełniono</span>}</dd>
              <dt>Siedziba</dt>
              <dd>{adresSpolki || <span className="brak">nie uzupełniono</span>}</dd>
            </dl>

            <div className="rzad-rozdzielony">
              <h3 className="podsumowanie-naglowek">Reprezentant</h3>
              {wniosekEdytowalny && (
                <button type="button" className="btn-tekstowy" onClick={() => ustawKrok(1)}>Zmień</button>
              )}
            </div>
            <dl className="podsumowanie">
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

            <div className="rzad-rozdzielony">
              <h3 className="podsumowanie-naglowek">{`Akcjonariusze (${akcjonariusze.length})`}</h3>
              {wniosekEdytowalny && (
                <button type="button" className="btn-tekstowy" onClick={() => ustawKrok(2)}>Zmień</button>
              )}
            </div>
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
                odmiana="blad"
                tytul="Dane niepełne — wymagane uzupełnienie"
                tresc="Bez tych danych nie możemy złożyć wniosku — kancelaria nie ma skąd ich uzupełnić. Wróć do kroku „Akcjonariusze” i wpisz brakujące pozycje."
                lista={brakiUstawowe}
              />
            )}

            {wniosekEdytowalny && brakiUstawowe.length === 0 && (
              <Komunikat
                odmiana="info"
                tytul="Co dalej po złożeniu wniosku"
                tresc="Kancelaria zweryfikuje wniosek i przygotuje dokumentację do podpisu. Gdy będzie gotowa, poinformujemy Cię e-mailem o kolejnym kroku."
              />
            )}

            {dokumentyWidoczne && (
              <>
                <h3 className="podsumowanie-naglowek">Dokumenty do podpisu</h3>
                <Komunikat
                  odmiana="ok"
                  tresc={kompletOdeslany
                    ? 'Komplet podpisanych dokumentów wrócił do kancelarii.'
                    : 'Kancelaria sprawdziła dane i przygotowała komplet dokumentów. Pobierz wszystkie pozycje, '
                      + 'zbierz podpisy i załącz skany. Do kancelarii pójdą dopiero, gdy klikniesz „Odeślij komplet” '
                      + '— do tego czasu możesz je wymieniać.'}
                />
                <Komunikat
                  odmiana="info"
                  tresc="Umowę podpisuje reprezentant spółki. Uchwałę o wyborze podmiotu prowadzącego rejestr oraz żądanie pierwszego wpisu podpisują wszyscy akcjonariusze wspólnie. Pozostałe oświadczenia każdy akcjonariusz podpisuje osobiście — zarząd nie może złożyć ich za niego."
                />
                <div className="lista-dokumentow">
                  {dokumenty.map((d) => (
                    <PozycjaDokumentu
                      key={d.id}
                      dokument={d}
                      edytowalne={dokumentyWidoczne && !kompletOdeslany}
                      przyZmianie={(wynik) => {
                        if (wynik.dokumenty) ustawDokumenty(wynik.dokumenty);
                        if (wynik.wniosek) ustawDane(wynik.wniosek);
                      }}
                    />
                  ))}
                </div>

                <div className="podsumowanie-podpisow">
                  {kompletOdeslany ? (
                    <Komunikat
                      odmiana="ok"
                      tytul="Komplet wrócił do kancelarii"
                      tresc="Nic więcej nie musisz robić. Kancelaria zweryfikuje dane i otworzy rejestr akcjonariuszy — o wyniku poinformujemy e-mailem."
                    />
                  ) : (
                    <>
                      <Komunikat
                        odmiana={kompletZalaczony ? 'ok' : 'info'}
                        tresc={kompletZalaczony
                          ? 'Wszystkie dokumenty mają załączony skan. Sprawdź je jeszcze raz i odeślij komplet.'
                          : `Załączono ${podpisanych} z ${dokumenty.length} skanów. Komplet odsyła się w całości, `
                            + 'jednym kliknięciem — nic nie idzie do kancelarii wcześniej.'}
                      />
                      <button
                        className="btn btn-glowny btn-duzy"
                        disabled={!kompletZalaczony || skladanie}
                        onClick={odeslijKomplet}
                      >
                        {skladanie ? 'Odsyłanie…' : 'Odeślij komplet do kancelarii'}
                      </button>
                    </>
                  )}
                </div>

                <details className="instrukcja-podpisu">
                  <summary className="instrukcja-podpisu-tytul">Jak podpisać dokumenty</summary>
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
                </details>
              </>
            )}

            {/* Nawigacja zamyka krok — stoi pod wszystkim, także pod listą
                dokumentów do podpisu. Wcześniej wypadała w środku ekranu,
                między akcjonariuszami a dokumentami, i wyglądała jak koniec
                strony, choć połowa treści była jeszcze niżej. */}
            {wniosekEdytowalny ? (
              <>
                {(!dane.nazwa || akcjonariusze.length === 0 || brakiUstawowe.length > 0) && (
                  <div className="podpowiedz">
                    {!dane.nazwa && 'Uzupełnij nazwę spółki (krok „Spółka”). '}
                    {akcjonariusze.length === 0 && 'Dodaj przynajmniej jednego akcjonariusza (krok „Akcjonariusze”).'}
                    {akcjonariusze.length > 0 && brakiUstawowe.length > 0
                      && 'Uzupełnij dane akcjonariuszy wymienione wyżej (krok „Akcjonariusze”).'}
                  </div>
                )}
                <NawigacjaKreatora
                  wstecz={{ etykieta: 'Wstecz', przy: () => ustawKrok((k) => k - 1) }}
                  dalej={{
                    etykieta: skladanie ? 'Składanie…' : 'Złóż wniosek',
                    przy: zlozWniosek,
                    wylaczony: skladanie || !dane.nazwa || akcjonariusze.length === 0
                      || brakiUstawowe.length > 0,
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
