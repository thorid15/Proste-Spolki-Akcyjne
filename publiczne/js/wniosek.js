/* wniosek.js — formularz wniosku o prowadzenie rejestru, portal klienta (etap 3C).
   Krok „Spółka i umowa" lustrzy krok 1 kreatora wewnętrznego
   (publiczne/js/spolki.js: EkranNowejSpolki) na tyle, na ile dane są takie
   same — dane spółki (z importem z KRS) i reprezentant w mianowniku
   (odmianę liczy backend przy generowaniu projektu umowy, etap 3E).
   Krok „Akcjonariusze" (etap 3D) zbiera dane do PRZYSZŁEJ kartoteki
   (server/trasy/portal.js: psa_wnioski_akcjonariusze) — te wiersze NIE są
   jeszcze prawdziwymi osobami w kartotece wspólnej, dopóki kancelaria nie
   zweryfikuje wniosku (etap 3F). Każda pozycja zapisuje się osobno
   (POST przy dodaniu, PUT przy „Zapisz”, DELETE przy „Usuń”) — inaczej niż
   krok „Spółka”, który zapisuje się jednym PUT całości. */

const KROKI_WNIOSKU = ['Spółka i umowa', 'Akcjonariusze', 'Weryfikacja'];

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
 * Podsumowanie mówi, JAKIE adresy klient podał — nie który z nich trafi do
 * rejestru. Wyboru wymaganego przez art. 300(33) § 1 pkt 3 KSH dokonuje
 * kancelaria przy weryfikacji (formularz klienta nie ma już tego pola), więc
 * pokazywanie tu „adres niewskazany" znaczyłoby dla klienta coś zupełnie
 * innego, niż znaczy naprawdę.
 */
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

function opisAdresowAkcjonariusza(a) {
  const podane = [];
  if ([a.kod_pocztowy, a.miejscowosc, a.ulica].some((v) => v && String(v).trim())) {
    podane.push('adres zamieszkania / siedziby');
  }
  if (a.adres_doreczen && a.adres_doreczen.trim()) podane.push('adres do doręczeń');
  if (a.adres_edoreczen && a.adres_edoreczen.trim()) podane.push('adres do e-Doręczeń');
  return podane.length > 0 ? podane.join(', ') : 'brak adresu';
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

/** Jedna proponowana pozycja akcjonariatu w kroku „Akcjonariusze” wniosku klienta. */
function PozycjaAkcjonariuszaWniosku({ pozycja, edytowalne, przyZapisie, przyUsunieciu }) {
  const [dane, ustawDane] = useState({ ...PUSTY_AKCJONARIUSZ_WNIOSKU, ...pozycja });
  const [usuwanie, ustawUsuwanie] = useState(false);
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
  });

  // Etap 2.8 / 3D: autouzupelnienie daty urodzenia i plci z PESEL,
  // jednorazowe (uzupelnia tylko puste pola).
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
    if (!window.confirm('Usunąć tę pozycję z wniosku?')) return;
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

  const bezPesel = Boolean(Number(dane.bez_pesel));

  return (
    <Karta>
      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="Rodzaj podmiotu" wymagane>
        <select value={dane.typ} onChange={(z) => ustawDane((p) => ({ ...p, typ: z.target.value }))} disabled={!edytowalne}>
          <option value="fizyczna">Osoba fizyczna</option>
          <option value="prawna">Osoba prawna lub jednostka organizacyjna</option>
        </select>
      </Pole>

      {dane.typ === 'fizyczna' ? (
        <>
          <div className="siatka-2">
            <Pole etykieta="Nazwisko" wymagane><input type="text" {...pole('nazwisko')} /></Pole>
            <Pole etykieta="Imię"><input type="text" {...pole('imie')} /></Pole>
          </div>
          <div className="siatka-2">
            <Pole
              etykieta="PESEL"
              podpowiedz={!bezPesel ? 'Data urodzenia uzupełni się automatycznie po wpisaniu 11 cyfr — można ją potem nadpisać.' : null}
            >
              <div className="pole-z-odznaczeniem">
                {!bezPesel && <input type="text" {...pole('pesel')} maxLength={11} />}
                <label className="chk chk-w-linii">
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
                  <span className="chk-tresc">Nie posiada</span>
                </label>
              </div>
            </Pole>
            <Pole etykieta="Data urodzenia" wymagane={bezPesel}>
              <PoleDaty
                wartosc={dane.data_urodzenia || ''}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, data_urodzenia: v }))}
                wylaczone={!edytowalne}
              />
            </Pole>
          </div>
          {pesel && !pesel.poprawnaSumaKontrolna && (
            <Komunikat
              odmiana="uwaga"
              tresc="Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer. Zapis nie jest blokowany."
            />
          )}
          <Pole etykieta="Płeć">
            <select value={dane.plec || ''} onChange={(z) => ustawDane((p) => ({ ...p, plec: z.target.value }))} disabled={!edytowalne}>
              <option value="">— nie podano —</option>
              <option value="mezczyzna">mężczyzna</option>
              <option value="kobieta">kobieta</option>
            </select>
          </Pole>
        </>
      ) : (
        <>
          <Pole etykieta="Firma (nazwa)" wymagane><input type="text" {...pole('nazwa')} /></Pole>
          <div className="siatka-2">
            <Pole
              etykieta="Numer we właściwym rejestrze"
              podpowiedz="Jeżeli podmiot jest wpisany do rejestru — art. 300³³ § 1 pkt 2 KSH."
            >
              <input type="text" {...pole('numer_w_rejestrze')} />
            </Pole>
            <Pole etykieta="Nazwa rejestru" podpowiedz="np. KRS.">
              <input type="text" {...pole('nazwa_rejestru')} />
            </Pole>
          </div>
          <div className="siatka-2">
            <Pole etykieta="NIP"><input type="text" {...pole('nip')} /></Pole>
            <Pole etykieta="REGON"><input type="text" {...pole('regon')} /></Pole>
          </div>
        </>
      )}

      <div className="rozdzielacz" />
      <div className="card-h">Adres</div>
      <Komunikat
        odmiana="info"
        tresc="Wpisz tyle adresów, ile akcjonariusz faktycznie posiada — do treści rejestru trafia jeden z nich (art. 300³³ § 1 pkt 3 KSH), kancelaria wskaże który przy weryfikacji wniosku."
      />
      <div className="siatka-3">
        <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
        <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
        <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
        <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Inny adres do doręczeń" podpowiedz="Jeśli akcjonariusz go posiada i chce, żeby korespondencja szła gdzie indziej.">
          <input type="text" {...pole('adres_doreczen')} />
        </Pole>
        <Pole etykieta="Adres do doręczeń elektronicznych" podpowiedz="Jeśli akcjonariusz go posiada (skrzynka e-Doręczeń).">
          <input type="text" {...pole('adres_edoreczen')} placeholder="AE:PL-…" />
        </Pole>
      </div>

      <div className="rozdzielacz" />
      <div className="card-h">Kontakt i zgoda na komunikację elektroniczną</div>
      <div className="siatka-2">
        <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
        <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
      </div>
      <Komunikat
        odmiana="info"
        tresc="Adres e-mail wchodzi do rejestru tylko wtedy, gdy akcjonariusz wyrazi zgodę na komunikację elektroniczną (art. 300³³ § 1 pkt 4 KSH). Zgoda jest oświadczeniem samego akcjonariusza — zarząd nie może jej złożyć za niego. Zaznacz „zadeklarowana”, a przygotujemy oświadczenie do podpisu."
      />
      <Pole etykieta="Zgoda na komunikację elektroniczną">
        <select
          value={dane.zgoda_email_status || 'brak'}
          onChange={(z) => ustawDane((p) => ({ ...p, zgoda_email_status: z.target.value }))}
          disabled={!edytowalne}
        >
          <option value="brak">Brak — adres e-mail nie wejdzie do rejestru</option>
          <option value="zadeklarowana">Zadeklarowana — akcjonariusz podpisze oświadczenie</option>
        </select>
      </Pole>
      {dane.zgoda_email_status === 'potwierdzona' && (
        <Komunikat odmiana="ok" tresc="Zgoda potwierdzona podpisanym oświadczeniem akcjonariusza." />
      )}
      {dane.zgoda_email_status && dane.zgoda_email_status !== 'brak' && !dane.email && (
        <Komunikat odmiana="uwaga" tresc="Zaznaczono zgodę, ale nie podano adresu e-mail." />
      )}

      <div className="rozdzielacz" />
      <div className="card-h">Współwłasność akcji</div>
      <Pole
        etykieta="Rodzaj współwłasności"
        podpowiedz="Wypełnij tylko, jeśli akcje należą do kilku osób wspólnie — art. 300³³ § 1 pkt 5 KSH."
      >
        <select
          value={dane.wspolwlasnosc || 'brak'}
          onChange={(z) => ustawDane((p) => ({ ...p, wspolwlasnosc: z.target.value }))}
          disabled={!edytowalne}
        >
          <option value="brak">Brak — akcje należą wyłącznie do tej osoby</option>
          <option value="laczna">Współwłasność łączna (np. małżeńska)</option>
          <option value="ulamkowa">Współwłasność w częściach ułamkowych</option>
        </select>
      </Pole>
      {dane.wspolwlasnosc && dane.wspolwlasnosc !== 'brak' && (
        <>
          <Pole
            etykieta="Pozostali współwłaściciele"
            wymagane
            podpowiedz="Imiona i nazwiska albo firmy (nazwy), oddzielone przecinkami."
          >
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
      )}

      {edytowalne && (
        <div className="row-g" style={{ justifyContent: 'flex-end', paddingTop: 8 }}>
          <StanZapisu stan={stanZapisu} />
          <button className="btn btn-maly btn-sygnal" onClick={usun} disabled={usuwanie}>
            {usuwanie ? 'Usuwanie…' : 'Usuń pozycję'}
          </button>
        </div>
      )}
    </Karta>
  );
}

function EkranWniosku() {
  const [krok, ustawKrok] = useState(0);
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
  const [plikPodpisanejUmowy, ustawPlikPodpisanejUmowy] = useState(null);
  const [wysylaniePodpisanej, ustawWysylaniePodpisanej] = useState(false);
  const [bladPodpisanej, ustawBladPodpisanej] = useState(null);
  // Adres kancelarii do odesłania podpisanych oświadczeń — formularz niżej
  // przyjmuje wyłącznie sam egzemplarz umowy (jeden plik, jedna kolumna
  // w `psa_wnioski`), więc instrukcja podpisu musi wskazać, gdzie trafia reszta.
  const { dane: daneKancelarii } = useDane('/api/wspolne/kancelaria');
  const emailKancelarii = daneKancelarii && daneKancelarii.kancelaria
    ? daneKancelarii.kancelaria.email
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
      })
      .catch((e) => ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wczytać wniosku.'))
      .finally(() => ustawLadowanie(false));
  }, []);

  const wniosekEdytowalny = Boolean(dane) && ['w_przygotowaniu', 'do_uzupelnienia'].includes(dane.status);

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
      ustawOstrzezeniaZlozenia(wynik.ostrzezenia || []);
      ustawDokumenty(wynik.dokumenty || []);
      if (wynik.blad_umowy) {
        ustawBladSkladania(
          `Wniosek został złożony, ale nie udało się przygotować projektu umowy: ${wynik.blad_umowy}. `
          + 'Spróbuj złożyć wniosek ponownie za chwilę albo skontaktuj się z kancelarią.'
        );
      } else if (wynik.blad_pakietu) {
        ustawBladSkladania(
          `Wniosek został złożony, ale nie udało się przygotować kompletu dokumentów do podpisu: ${wynik.blad_pakietu}. `
          + 'Kancelaria przygotuje je ręcznie.'
        );
      }
    } catch (e) {
      ustawBladSkladania(e instanceof BladApi ? e.message : 'Nie udało się złożyć wniosku.');
    } finally {
      ustawSkladanie(false);
    }
  }

  async function wyslijPodpisanaUmowe() {
    if (!plikPodpisanejUmowy) return;
    ustawWysylaniePodpisanej(true);
    ustawBladPodpisanej(null);
    try {
      const formularz = new FormData();
      formularz.append('plik', plikPodpisanejUmowy);
      const odp = await fetch('/api/psa/portal/wniosek/umowa-podpisana', { method: 'POST', body: formularz });
      const tresc = await odp.json().catch(() => ({}));
      if (!odp.ok) throw new Error(tresc.blad || `Nie udało się przesłać pliku (błąd ${odp.status}).`);
      ustawDane(tresc.wniosek);
      ustawPlikPodpisanejUmowy(null);
    } catch (e) {
      ustawBladPodpisanej(e.message);
    } finally {
      ustawWysylaniePodpisanej(false);
    }
  }

  const pole = (klucz) => ({
    value: (dane && dane[klucz]) ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
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

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Kroki kroki={KROKI_WNIOSKU} biezacy={krok} />
      <Komunikat odmiana="blad" tresc={blad} />

      <Karta>
        {krok === 0 && (
          <>
            <div className="card-h">Dane spółki</div>
            <Pole
              etykieta="Numer KRS"
              podpowiedz="Dziesięć cyfr. Pobierzemy dane z otwartego rejestru przedsiębiorców; przy niepowodzeniu uzupełnij je ręcznie."
            >
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
            <Pole
              etykieta="Organ zarządzający"
              podpowiedz="P.S.A. może mieć zarząd albo (struktura monistyczna) radę dyrektorów — decyduje umowa spółki."
            >
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
              <Pole etykieta="Kod pocztowy"><input type="text" {...pole('kod_pocztowy')} /></Pole>
              <Pole etykieta="Miejscowość"><input type="text" {...pole('miejscowosc')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Ulica"><input type="text" {...pole('ulica')} /></Pole>
              <Pole etykieta="Nr domu"><input type="text" {...pole('nr_domu')} /></Pole>
              <Pole etykieta="Nr lokalu"><input type="text" {...pole('nr_lokalu')} /></Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Sąd rejestrowy"><input type="text" {...pole('sad_rejestrowy')} /></Pole>
              <Pole etykieta="Wydział"><input type="text" {...pole('wydzial')} /></Pole>
            </div>
            <div className="siatka-3">
              <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
              <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
              <Pole etykieta="Adres do doręczeń elektronicznych">
                <input type="text" {...pole('adres_edorecze')} placeholder="AE:PL-…" />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="Data rejestracji w KRS">
                <PoleDaty wartosc={dane.data_utworzenia_spolki || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_utworzenia_spolki: v }))} />
              </Pole>
              <Pole etykieta="Kapitał akcyjny">
                <PoleKwoty grosze={dane.kapital_akcyjny_grosze} przyZmianie={(v) => ustawDane((p) => ({ ...p, kapital_akcyjny_grosze: v }))} />
              </Pole>
            </div>
            <Pole
              etykieta="Data zawarcia umowy spółki"
              podpowiedz="Data aktu notarialnego zawiązania spółki — przy spółce założonej w S24 data podpisania w systemie."
            >
              <PoleDaty wartosc={dane.data_zawarcia_umowy_spolki || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_zawarcia_umowy_spolki: v }))} />
            </Pole>

            <div className="rozdzielacz" />
            <div className="card-h">Reprezentant, który podpisze umowę</div>
            <Komunikat
              odmiana="info"
              tresc="Osoba, która w imieniu SPÓŁKI podpisze umowę o prowadzenie rejestru. Wpisz dane dokładnie tak, jak widnieją w dokumencie tożsamości — umowa użyje ich w tej samej postaci."
            />
            <div className="siatka-2">
              <Pole etykieta="Imię i nazwisko">
                <input type="text" {...pole('reprezentant_imie_nazwisko')} placeholder="np. Jan Kowalski" />
              </Pole>
              <Pole etykieta="Funkcja">
                <input type="text" {...pole('reprezentant_funkcja')} placeholder="np. Prezes Zarządu" />
              </Pole>
            </div>
            {/* Sposób reprezentacji NIE jest już polem do wypełnienia — kancelaria
                sprawdza go na podstawie wydruku z KRS przy podpisaniu umowy;
                gdy dane spółki pobrano przyciskiem „Pobierz z KRS” wyżej,
                wartość dochodzi razem z resztą i trafia do umowy bez udziału
                tego formularza. */}
            <div className="siatka-2">
              <Pole etykieta="Imiona rodziców">
                <input type="text" {...pole('reprezentant_rodzice')} placeholder="np. Piotr i Anna" />
              </Pole>
              <Pole etykieta="Dowód osobisty">
                <input type="text" {...pole('reprezentant_dowod')} />
              </Pole>
            </div>
            <div className="siatka-2">
              <Pole etykieta="PESEL"><input type="text" {...pole('reprezentant_pesel')} maxLength={11} /></Pole>
              <Pole etykieta="Adres zamieszkania"><input type="text" {...pole('reprezentant_adres')} /></Pole>
            </div>
            <Pole
              etykieta="Adres e-mail"
              podpowiedz="Na ten adres trafi projekt umowy do podpisu i korespondencja w sprawie jej zawarcia."
            >
              <input type="email" {...pole('reprezentant_email')} />
            </Pole>
          </>
        )}

        {krok === 1 && (
          <div className="pion" style={{ gap: 16 }}>
            <div className="card-h">Akcjonariusze</div>
            <Komunikat
              odmiana="info"
              tresc="Wpisz osoby, które mają zostać wpisane do rejestru jako akcjonariusze. Kancelaria porówna te dane z rejestrem KRS i skontaktuje się w razie rozbieżności, zanim rejestr zostanie otwarty."
            />
            {!wniosekEdytowalny && dane.status && (
              <Komunikat
                odmiana="uwaga"
                tresc={`Wniosek ma status „${dane.status}” — lista akcjonariuszy jest już tylko do wglądu.`}
              />
            )}
            <Komunikat odmiana="blad" tresc={bladAkcjonariuszy} />

            {akcjonariusze.length === 0 && (
              <Pusto
                tytul="Brak akcjonariuszy"
                opis="Dodaj przynajmniej jedną osobę, która obejmie akcje w spółce."
              />
            )}

            {akcjonariusze.map((a) => (
              <PozycjaAkcjonariuszaWniosku
                key={a.id}
                pozycja={a}
                edytowalne={wniosekEdytowalny}
                przyZapisie={poZapisieAkcjonariusza}
                przyUsunieciu={poUsunieciuAkcjonariusza}
              />
            ))}

            {wniosekEdytowalny && (
              <button className="btn btn-maly" onClick={dodajAkcjonariusza} disabled={dodawanieAkcjonariusza}>
                {dodawanieAkcjonariusza ? 'Dodawanie…' : '+ Dodaj akcjonariusza'}
              </button>
            )}
          </div>
        )}

        {krok === 2 && (
          <div className="pion" style={{ gap: 16 }}>
            <div className="card-h">Weryfikacja i złożenie wniosku</div>
            <Komunikat odmiana="blad" tresc={bladSkladania} />

            <Karta tytul="Spółka">
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
            </Karta>

            <Karta tytul={`Akcjonariusze (${akcjonariusze.length})`}>
              {akcjonariusze.length === 0 ? (
                <Pusto
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
            </Karta>

            {brakiUstawowe.length > 0 && (
              <Komunikat
                odmiana="uwaga"
                tytul="Dane niepełne wobec art. 300³³ § 1 KSH"
                tresc="Wniosek można złożyć mimo tych braków — kancelaria uzupełni je przy weryfikacji. Warto jednak poprawić je teraz."
                lista={brakiUstawowe}
              />
            )}

            {wniosekEdytowalny && (
              <>
                <Komunikat
                  odmiana="info"
                  tresc="Po złożeniu wniosku system automatycznie przygotuje projekt umowy o prowadzenie rejestru na podstawie powyższych danych. Dane spółki i listę akcjonariuszy będzie można poprawić tylko, jeśli kancelaria odeśle wniosek do uzupełnienia."
                />
                <button
                  className="btn btn-glowny"
                  onClick={zlozWniosek}
                  disabled={skladanie || !dane.nazwa || akcjonariusze.length === 0}
                >
                  {skladanie ? 'Składanie…' : 'Złóż wniosek'}
                </button>
                {(!dane.nazwa || akcjonariusze.length === 0) && (
                  <div className="podpowiedz">
                    {!dane.nazwa && 'Uzupełnij nazwę spółki (krok „Spółka i umowa”). '}
                    {akcjonariusze.length === 0 && 'Dodaj przynajmniej jednego akcjonariusza (krok „Akcjonariusze”).'}
                  </div>
                )}
              </>
            )}

            {dane.status === 'zlozony' && (
              <Komunikat odmiana="info" tresc="Wniosek złożony — trwa przygotowywanie projektu umowy." />
            )}

            {dane.status === 'umowa_wygenerowana' && (
              <>
                <Komunikat
                  odmiana="ok"
                  tresc="Komplet dokumentów jest gotowy. Pobierz wszystkie pozycje z listy poniżej, zbierz podpisy i odeślij je kancelarii."
                />
                {ostrzezeniaZlozenia.length > 0 && (
                  <Komunikat
                    odmiana="uwaga"
                    tresc="Projekt zawiera niepełne dane — kancelaria uzupełni je przy weryfikacji, ale warto sprawdzić dokument przed podpisaniem."
                    lista={ostrzezeniaZlozenia}
                  />
                )}

                <div className="rozdzielacz" />
                <div className="card-h">Dokumenty do podpisu</div>
                <Komunikat
                  odmiana="info"
                  tresc="Umowę podpisuje reprezentant spółki. Uchwałę o wyborze podmiotu prowadzącego rejestr oraz żądanie pierwszego wpisu podpisują wszyscy akcjonariusze wspólnie. Pozostałe oświadczenia każdy akcjonariusz podpisuje osobiście — zarząd nie może złożyć ich za niego."
                />
                <div className="lista-dokumentow">
                  <a
                    className="lista-dokumentow-poz"
                    href="/api/psa/portal/wniosek/umowa-projekt"
                    target="_blank"
                    rel="noopener"
                  >
                    <Ikona nazwa="pobierz" rozmiar={17} />
                    <span className="lista-dokumentow-nazwa">Umowa o prowadzenie rejestru</span>
                  </a>
                  {dokumenty.map((d) => (
                    <a
                      key={d.id}
                      className="lista-dokumentow-poz"
                      href={`/api/psa/portal/wniosek/dokumenty/${d.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <Ikona nazwa="pobierz" rozmiar={17} />
                      <span className="lista-dokumentow-nazwa">{etykietaDokumentu(d.nazwa_pliku)}</span>
                      <span className="lista-dokumentow-rozmiar">
                        {Math.max(1, Math.round((d.rozmiar || 0) / 1024))} kB
                      </span>
                    </a>
                  ))}
                </div>

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
                  <div className="instrukcja-podpisu-uwaga">
                    Każda strona dokumentu musi być czytelna, a podpis widoczny w całości.
                    Podpisaną umowę odeślij formularzem poniżej. Pozostałe podpisane dokumenty
                    prześlij kancelarii
                    {emailKancelarii ? (
                      <> na adres <a href={`mailto:${emailKancelarii}`}>{emailKancelarii}</a></>
                    ) : ' pocztą elektroniczną'}
                    {' '}albo dostarcz je osobiście.
                  </div>
                </div>

                <div className="rozdzielacz" />
                <Pole etykieta="Podpisana umowa (PDF, JPG albo PNG)">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(z) => ustawPlikPodpisanejUmowy(z.target.files[0] || null)}
                  />
                  {plikPodpisanejUmowy && <div className="podpowiedz">{plikPodpisanejUmowy.name}</div>}
                </Pole>
                <Komunikat odmiana="blad" tresc={bladPodpisanej} />
                <button
                  className="btn btn-glowny"
                  onClick={wyslijPodpisanaUmowe}
                  disabled={!plikPodpisanejUmowy || wysylaniePodpisanej}
                >
                  {wysylaniePodpisanej ? 'Przesyłanie…' : 'Prześlij podpisaną umowę'}
                </button>
              </>
            )}

            {dane.status === 'umowa_podpisana' && (
              <Komunikat
                odmiana="ok"
                tytul="Umowa podpisana i przesłana"
                tresc="Sprawa trafiła do kolejki kancelarii. Po weryfikacji danych kancelaria otworzy rejestr akcjonariuszy — o dalszych krokach poinformujemy e-mailem."
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
          </div>
        )}

        {/* Pasek nawigacji przykleja się do dołu okna PO TO, żeby „Dalej"
            było w zasięgu przy długim kroku. Na ostatnim kroku „Dalej" jest
            wyłączone, więc przyklejony pasek już tylko zasłaniałby treść —
            tam zostaje w tekście. */}
        <div className={`kreator-stopka ${krok === KROKI_WNIOSKU.length - 1 ? 'kreator-stopka-statyczna' : ''}`}>
          <button className="btn" onClick={() => ustawKrok((k) => Math.max(0, k - 1))} disabled={krok === 0}>
            Wstecz
          </button>
          <div className="kreator-stopka-prawa row-g">
            <StanZapisu stan={stanZapisuSpolki} />
            <button
              className="btn btn-glowny"
              onClick={() => ustawKrok((k) => Math.min(KROKI_WNIOSKU.length - 1, k + 1))}
              disabled={krok === KROKI_WNIOSKU.length - 1}
            >
              Dalej
            </button>
          </div>
        </div>
      </Karta>
    </div>
  );
}

window.EkranWniosku = EkranWniosku;
