/* osoby.js — kartoteka wspólna (reguła domenowa nr 10).
   `parsujPesel` żyje w pesel.js (etap 3D - portal.html go też potrzebuje,
   bez ładowania całego osoby.js), wczytanym wcześniej w index.html. */

const PUSTA_OSOBA = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '', plec: '',
  pesel: '', data_urodzenia: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: 'KRS',
  kraj: 'Polska', kod_pocztowy: '', miejscowosc: '', ulica: '', nr_domu: '', nr_lokalu: '',
  adres_doreczen: '', adres_edoreczen: '', email: '', telefon: '',
  zgoda_email: 0, aml_status: 'brak', aml_data: '', aml_notatka: '', uwagi: '',
  // Art. 300(33) § 1 pkt 2-5 KSH — patrz server/logika/akcjonariusz.js.
  bez_pesel: 0, rodzaj_adresu_rejestrowego: 'zamieszkania', zgoda_email_status: 'brak',
  wspolwlasnosc: 'brak', wspolwlasciciele: '', udzial_licznik: '', udzial_mianownik: '',
  // Sesja 8, blok C — przegląd okresowy, beneficjent rzeczywisty, oświadczenie PEP:
  aml_data_przegladu: '', beneficjent_rzeczywisty_id: null,
  pep_oswiadczenie: '', pep_oswiadczenie_data: '',
  // Etap 14 — status PEP jako DANA (ocena kancelarii, katalog z przepisy.js),
  // obok `pep_oswiadczenie`, ktore jest oswiadczeniem zlozonym przez osobe.
  pep: 'nie', pep_opis: '',
};

const TYPY_DOKUMENTU_AML = [
  { wartosc: 'dowod_osobisty', etykieta: 'dowód osobisty' },
  { wartosc: 'paszport', etykieta: 'paszport' },
  { wartosc: 'inny', etykieta: 'inny' },
];

/** Skany dokumentow AML (etap 3.1) - widoczne wylacznie, gdy wybrana spolka ma wlaczona procedure. */
function SekcjaSkanowAml({ osobaId, spolkaId }) {
  const [skany, ustawSkany] = useState([]);
  const [ladowanie, ustawLadowanie] = useState(true);
  const [typDokumentu, ustawTypDokumentu] = useState('dowod_osobisty');
  const [retencjaDo, ustawRetencjaDo] = useState('');
  const [plik, ustawPlik] = useState(null);
  const [wgrywanie, ustawWgrywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  function wczytaj() {
    ustawLadowanie(true);
    API.get(`/api/psa/osoby/${osobaId}/aml-skany?spolka_id=${spolkaId}`)
      .then((w) => ustawSkany(w.skany))
      .catch(() => ustawSkany([]))
      .finally(() => ustawLadowanie(false));
  }
  useEffect(wczytaj, [osobaId, spolkaId]);

  async function wgraj() {
    if (!plik) return;
    ustawWgrywanie(true);
    ustawBlad(null);
    try {
      const formularz = new FormData();
      formularz.append('spolka_id', String(spolkaId));
      formularz.append('typ_dokumentu', typDokumentu);
      if (retencjaDo) formularz.append('retencja_do', retencjaDo);
      formularz.append('plik', plik);
      const odp = await fetch(`/api/psa/osoby/${osobaId}/aml-skany`, { method: 'POST', body: formularz });
      const tresc = await odp.json().catch(() => ({}));
      if (!odp.ok) throw new Error(tresc.blad || `Nie udało się przesłać pliku (błąd ${odp.status}).`);
      ustawPlik(null);
      wczytaj();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWgrywanie(false);
    }
  }

  return (
    <Pole
      etykieta="Skany dokumentów tożsamości"
      podpowiedz="Pobranie skanu zostawia ślad w dzienniku dostępu. Okres przechowywania (retencja) ustala kancelaria — zgodnie z polityką AML, nie automatycznie."
    >
      <Komunikat odmiana="blad" tresc={blad} />
      {!ladowanie && skany.length > 0 && (
        <ul className="lista-plaska" style={{ marginBottom: 8 }}>
          {skany.map((s) => (
            <li key={s.id}>
              <a href={`/api/psa/osoby/${osobaId}/aml-skany/${s.id}/plik`} target="_blank" rel="noopener">
                {s.nazwa_pliku}
              </a>{' '}
              <span className="podpowiedz">
                ({TYPY_DOKUMENTU_AML.find((t) => t.wartosc === s.typ_dokumentu)?.etykieta || s.typ_dokumentu}
                {s.retencja_do ? ` · retencja do ${s.retencja_do}` : ''})
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="siatka-3">
        <select value={typDokumentu} onChange={(z) => ustawTypDokumentu(z.target.value)}>
          {TYPY_DOKUMENTU_AML.map((t) => <option key={t.wartosc} value={t.wartosc}>{t.etykieta}</option>)}
        </select>
        <PoleDaty wartosc={retencjaDo} przyZmianie={ustawRetencjaDo} />
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(z) => ustawPlik(z.target.files[0] || null)} />
      </div>
      <button className="btn btn-maly" onClick={wgraj} disabled={!plik || wgrywanie} style={{ marginTop: 8 }}>
        {wgrywanie ? 'Przesyłanie…' : 'Dodaj skan'}
      </button>
    </Pole>
  );
}

function FormularzOsoby({ osoba, przyZamknieciu, przyZapisie }) {
  const [dane, ustawDane] = useState({ ...PUSTA_OSOBA, ...(osoba || {}) });
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const edycja = Boolean(osoba && osoba.id);

  // Etap 3.1: procedura AML (skan/PEP/beneficjent) jest wlaczana PER SPOLKA,
  // a osoba (kartoteka wspolna) moze byc akcjonariuszem w kilku - wybor
  // "kontekstu" decyduje, ktorej spolki przelacznik gate'uje ten formularz.
  // Nowa osoba (bez id) nie ma jeszcze zadnej spolki do wyboru - zostaje przy
  // domyslnym, oszczednym zakresie (dane z dokumentu, bez pliku).
  const [spolkiOsoby, ustawSpolkiOsoby] = useState([]);
  const [kontekstSpolkaId, ustawKontekstSpolkaId] = useState(null);
  useEffect(() => {
    if (!edycja) return;
    API.get(`/api/psa/osoby/${osoba.id}/spolki`)
      .then((w) => {
        ustawSpolkiOsoby(w.spolki);
        if (w.spolki.length === 1) ustawKontekstSpolkaId(w.spolki[0].id);
      })
      .catch(() => ustawSpolkiOsoby([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edycja, osoba && osoba.id]);
  const kontekstSpolka = spolkiOsoby.find((s) => s.id === kontekstSpolkaId) || null;
  const stosujeAml = Boolean(kontekstSpolka && Number(kontekstSpolka.stosuje_procedure_aml));

  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
  });

  // Etap 2.8: autouzupelnienie daty urodzenia i plci z PESEL, JEDNORAZOWE
  // (jak przy dacie emisji zalozycielskiej, etap 2.5) - uzupelnia tylko puste
  // pola, wiec reczna korekta uzytkownika nigdy nie jest nadpisywana.
  const pesel = parsujPesel(dane.pesel);
  useEffect(() => {
    if (!pesel) return;
    ustawDane((p) => ({
      ...p,
      data_urodzenia: p.data_urodzenia || pesel.data_urodzenia,
      plec: p.plec || pesel.plec,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dane.pesel]);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = edycja
        ? await API.put(`/api/psa/osoby/${osoba.id}`, dane)
        : await API.post('/api/psa/osoby', dane);
      przyZapisie(wynik.osoba);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul={edycja ? 'Dane osoby' : 'Nowa osoba w kartotece'}
      przyZamknieciu={przyZamknieciu}
      szerokosc={640}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-glowny" onClick={zapisz} disabled={zapisywanie}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />

      <Pole etykieta="Rodzaj podmiotu" wymagane>
        <select {...pole('typ')}>
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
              podpowiedz={
                !Number(dane.bez_pesel)
                  ? 'Data urodzenia i płeć uzupełnią się automatycznie po wpisaniu 11 cyfr — można je potem nadpisać.'
                  : null
              }
            >
              <div className="pole-z-odznaczeniem">
                {!Number(dane.bez_pesel) && <input type="text" {...pole('pesel')} maxLength={11} />}
                <label className="chk chk-w-linii">
                  <input
                    type="checkbox"
                    checked={Boolean(Number(dane.bez_pesel))}
                    onChange={(z) =>
                      ustawDane((p) => ({
                        ...p,
                        bez_pesel: z.target.checked ? 1 : 0,
                        pesel: z.target.checked ? '' : p.pesel,
                      }))
                    }
                  />
                  <span className="chk-tresc">Nie posiada</span>
                </label>
              </div>
            </Pole>
            <Pole etykieta="Data urodzenia" wymagane={Boolean(Number(dane.bez_pesel))}>
              <PoleDaty wartosc={dane.data_urodzenia || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, data_urodzenia: v }))} />
            </Pole>
          </div>
          {pesel && !pesel.poprawnaSumaKontrolna && (
            <Komunikat
              odmiana="uwaga"
              tresc="Suma kontrolna numeru PESEL się nie zgadza — sprawdź numer. Data urodzenia i płeć uzupełniły się mimo to na podstawie samych cyfr; zapis nie jest blokowany."
            />
          )}
          <Pole
            etykieta="Płeć"
            podpowiedz="Uzupełnia się automatycznie z numeru PESEL. Dana pomocnicza — pisma jej nie używają."
          >
            <select {...pole('plec')}>
              <option value="">— nie podano —</option>
              <option value="mezczyzna">mężczyzna</option>
              <option value="kobieta">kobieta</option>
            </select>
          </Pole>
          <Komunikat
            odmiana="info"
            tresc="Treść rejestru to nazwisko, imię oraz PESEL ALBO data urodzenia, a także adres (art. 300(33) § 1 pkt 2 i 3 KSH). PESEL, data urodzenia i adres zamieszkania są maskowane wobec pozostałych akcjonariuszy."
          />
        </>
      ) : (
        <>
          <Pole etykieta="Nazwa" wymagane><input type="text" {...pole('nazwa')} /></Pole>
          <div className="siatka-2">
            <Pole etykieta="Numer we właściwym rejestrze">
              <input type="text" {...pole('numer_w_rejestrze')} />
            </Pole>
            <Pole etykieta="Nazwa rejestru" podpowiedz="KRS, rejestr zagraniczny, inny — dane pomocnicze do identyfikacji podmiotu.">
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
        <Pole etykieta="Inny adres do doręczeń" podpowiedz="Jeśli osoba go posiada.">
          <input type="text" {...pole('adres_doreczen')} />
        </Pole>
        <Pole etykieta="Adres do doręczeń elektronicznych" podpowiedz="Jeśli osoba go posiada.">
          <input type="text" {...pole('adres_edoreczen')} placeholder="AE:PL-…" />
        </Pole>
      </div>
      <Pole
        etykieta="Adres wpisywany do rejestru"
        wymagane
        podpowiedz="Art. 300(33) § 1 pkt 3 KSH daje wybór jednego z trzech — wskaż, który jest tym z ustawy."
      >
        <select {...pole('rodzaj_adresu_rejestrowego')}>
          <option value="zamieszkania">Adres zamieszkania albo siedziby</option>
          <option value="doreczen">Inny adres do doręczeń</option>
          <option value="edoreczen">Adres do doręczeń elektronicznych</option>
        </select>
      </Pole>

      <div className="rozdzielacz" />

      <div className="siatka-2">
        <Pole etykieta="E-mail"><input type="text" {...pole('email')} /></Pole>
        <Pole etykieta="Telefon"><input type="text" {...pole('telefon')} /></Pole>
      </div>
      <Pole
        etykieta="Zgoda na komunikację elektroniczną"
        podpowiedz="Art. 300(33) § 1 pkt 4 KSH — adres e-mail wchodzi do rejestru dopiero po zgodzie SAMEGO akcjonariusza. Zarząd może ją zadeklarować we wniosku, potwierdza ją podpisane oświadczenie."
      >
        <select {...pole('zgoda_email_status')}>
          <option value="brak">Brak — adres e-mail nie wchodzi do rejestru</option>
          <option value="zadeklarowana">Zadeklarowana przez spółkę — czeka na oświadczenie</option>
          <option value="potwierdzona">Potwierdzona oświadczeniem akcjonariusza</option>
        </select>
      </Pole>

      <div className="rozdzielacz" />

      <Pole
        etykieta="Współwłasność akcji"
        podpowiedz="Art. 300(33) § 1 pkt 5 KSH — wypełnij tylko, gdy akcje należą do kilku osób wspólnie."
      >
        <select {...pole('wspolwlasnosc')}>
          <option value="brak">Brak</option>
          <option value="laczna">Współwłasność łączna</option>
          <option value="ulamkowa">Współwłasność w częściach ułamkowych</option>
        </select>
      </Pole>
      {dane.wspolwlasnosc && dane.wspolwlasnosc !== 'brak' && (
        <>
          <Pole etykieta="Pozostali współwłaściciele" wymagane>
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

      <div className="rozdzielacz" />

      <div className="siatka-2">
        <Pole
          etykieta="Środki bezpieczeństwa finansowego (AML)"
          podpowiedz="Notariusz prowadzący rejestr jest instytucją obowiązaną. Brak możliwości zastosowania środków = przeszkoda wpisu."
        >
          <select {...pole('aml_status')}>
            <option value="brak">nie wykonano</option>
            <option value="wykonane">wykonane</option>
            <option value="niemozliwe">niemożliwe do zastosowania</option>
          </select>
        </Pole>
        <Pole etykieta="Data weryfikacji AML">
          <PoleDaty wartosc={dane.aml_data || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, aml_data: v }))} />
        </Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Data ostatniego przeglądu AML" podpowiedz="Przegląd okresowy co 12 miesięcy — nie blokuje wpisu, jest tylko przypomnieniem.">
          <PoleDaty wartosc={dane.aml_data_przegladu || ''} przyZmianie={(v) => ustawDane((p) => ({ ...p, aml_data_przegladu: v }))} />
        </Pole>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
          <ZnacznikPrzegladuAml wymaga={edycja && osoba.wymaga_przegladu_aml} />
        </div>
      </div>
      {/* Status PEP jest DANĄ osoby, nie tylko treścią oświadczenia: wobec
          osoby zajmującej eksponowane stanowisko polityczne kancelaria
          stosuje wzmożone środki bezpieczeństwa finansowego, więc musi go
          widzieć na ekranie, a nie odczytywać z papieru w aktach. */}
      <Przelacznik
        wlaczony={Boolean(dane.pep) && dane.pep !== 'nie'}
        przyZmianie={(v) =>
          ustawDane((p) => ({ ...p, pep: v ? 'tak' : 'nie', pep_opis: v ? p.pep_opis : '' }))
        }
        etykieta="Eksponowane stanowisko polityczne (PEP)"
        opis="Osoba pełniąca znaczącą funkcję publiczną, członek jej rodziny albo bliski współpracownik — ustawa o przeciwdziałaniu praniu pieniędzy. Wobec takiej osoby stosuje się WZMOŻONE środki bezpieczeństwa finansowego."
        dzieci={
          <>
            <Pole etykieta="Na czym polega status" wymagane>
              <select
                value={dane.pep && dane.pep !== 'nie' ? dane.pep : 'tak'}
                onChange={(z) => ustawDane((p) => ({ ...p, pep: z.target.value }))}
              >
                <option value="tak">Zajmuje eksponowane stanowisko polityczne</option>
                <option value="rodzina">Jest członkiem rodziny takiej osoby</option>
                <option value="wspolpracownik">Jest bliskim współpracownikiem takiej osoby</option>
              </select>
            </Pole>
            <Pole
              etykieta={dane.pep === 'tak' ? 'Stanowisko lub funkcja' : 'Osoba i charakter relacji'}
              wymagane
              podpowiedz="Trafia wprost do oświadczenia AML przygotowanego do podpisu."
            >
              <input type="text" {...pole('pep_opis')} />
            </Pole>
          </>
        }
      />

      <Pole etykieta="Notatka AML" podpowiedz="Nigdy nie trafia na wydruki dla klienta.">
        <textarea {...pole('aml_notatka')} style={{ minHeight: 70 }} />
      </Pole>

      {edycja && spolkiOsoby.length > 0 && (
        <Pole
          etykieta="Kontekst procedury AML"
          podpowiedz="Procedura AML (skan dokumentu, PEP, beneficjent) jest włączana per spółka — wybierz, w kontekście której spółki chcesz nią zarządzać."
        >
          <select value={kontekstSpolkaId ?? ''} onChange={(z) => ustawKontekstSpolkaId(z.target.value ? Number(z.target.value) : null)}>
            <option value="">— nie wybrano —</option>
            {spolkiOsoby.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nazwa}{Number(s.stosuje_procedure_aml) ? '' : ' (procedura AML wyłączona)'}
              </option>
            ))}
          </select>
        </Pole>
      )}

      {!stosujeAml ? (
        <Komunikat
          odmiana="info"
          tresc={
            kontekstSpolka
              ? 'Wybrana spółka nie ma włączonej procedury AML — zbierane są wyłącznie dane z dokumentu tożsamości powyżej, bez pliku, oświadczenia PEP ani beneficjenta rzeczywistego.'
              : 'Wybierz spółkę powyżej, żeby zarządzać skanem dokumentu, oświadczeniem PEP i beneficjentem rzeczywistym (dostępne wyłącznie, gdy spółka ma włączoną procedurę AML).'
          }
        />
      ) : (
        <>
          {dane.typ === 'prawna' && (
            <Pole
              etykieta="Beneficjent rzeczywisty"
              podpowiedz="Osoba fizyczna sprawująca kontrolę nad podmiotem (art. 2 ust. 2 pkt 1 ustawy AML)."
            >
              <WyborOsoby
                wartosc={dane.beneficjent_rzeczywisty_id}
                przyZmianie={(id) => ustawDane((p) => ({ ...p, beneficjent_rzeczywisty_id: id }))}
                typFiltr="fizyczna"
                wyklucz={edycja ? [osoba.id] : []}
                placeholder="Szukaj osoby fizycznej w kartotece…"
              />
            </Pole>
          )}

          <div className="siatka-2">
            <Pole
              etykieta="Oświadczenie o statusie PEP"
              podpowiedz="Oświadczenie SKŁADANE PRZEZ OSOBĘ (art. 46 ustawy AML) — nie ocena ani domysł kancelarii."
            >
              <select {...pole('pep_oswiadczenie')}>
                <option value="">— nie oświadczono —</option>
                <option value="tak">oświadcza, że JEST osobą zajmującą eksponowane stanowisko polityczne</option>
                <option value="nie">oświadcza, że NIE JEST osobą zajmującą eksponowane stanowisko polityczne</option>
              </select>
            </Pole>
            <Pole etykieta="Data oświadczenia PEP">
              <PoleDaty
                wartosc={dane.pep_oswiadczenie_data || ''}
                przyZmianie={(v) => ustawDane((p) => ({ ...p, pep_oswiadczenie_data: v }))}
              />
            </Pole>
          </div>

          <SekcjaSkanowAml osobaId={osoba.id} spolkaId={kontekstSpolkaId} />
        </>
      )}

      <Pole etykieta="Uwagi wewnętrzne" podpowiedz="Nigdy nie trafiają na wydruki.">
        <textarea {...pole('uwagi')} style={{ minHeight: 70 }} />
      </Pole>
    </Modal>
  );
}

function EkranOsob() {
  const [szukaj, ustawSzukaj] = useState('');
  const [zapytanie, ustawZapytanie] = useState('');
  const [formularz, ustawFormularz] = useState(null);
  const { dane, ladowanie, odswiez } = useDane(`/api/psa/osoby?q=${encodeURIComponent(zapytanie)}`);

  useEffect(() => {
    const uchwyt = setTimeout(() => ustawZapytanie(szukaj), 250);
    return () => clearTimeout(uchwyt);
  }, [szukaj]);

  const osoby = (dane && dane.osoby) || [];

  return (
    <>
      <div className="pasek-narzedzi">
        <Szukajka wartosc={szukaj} przyZmianie={ustawSzukaj} placeholder="Szukaj po nazwisku, PESEL, NIP, e-mailu…" />
        <button className="btn btn-glowny" style={{ marginLeft: 'auto' }} onClick={() => ustawFormularz({})}>
          Nowa osoba
        </button>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : osoby.length === 0 ? (
        <Karta>
          <Pusto
            tytul="Kartoteka jest pusta"
            opis={
              zapytanie
                ? 'Żadna osoba nie pasuje do wyszukiwania.'
                : 'Dodaj pierwszą osobę — będzie dostępna we wszystkich prowadzonych rejestrach.'
            }
            akcja={
              !zapytanie && (
                <button className="btn btn-glowny" onClick={() => ustawFormularz({})}>
                  Nowa osoba
                </button>
              )
            }
          />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Oznaczenie</th>
                <th>Rodzaj</th>
                <th>Identyfikator jawny</th>
                <th>AML</th>
                <th className="do-prawej">Spółki</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {osoby.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.oznaczenie}</td>
                  <td className="wyciszony">
                    {o.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}
                  </td>
                  <td className="kol-dane">{o.jawny_identyfikator || '—'}</td>
                  <td>
                    <div className="row-g" style={{ gap: 6 }}>
                      <StatusAml status={o.aml_status} />
                      <ZnacznikPrzegladuAml wymaga={o.wymaga_przegladu_aml} />
                    </div>
                  </td>
                  <td className="do-prawej">{o.liczba_spolek || 0}</td>
                  <td className="do-prawej">
                    <button className="btn btn-maly" onClick={() => ustawFormularz(o)}>
                      Otwórz
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}

      {formularz && (
        <FormularzOsoby
          osoba={formularz.id ? formularz : null}
          przyZamknieciu={() => ustawFormularz(null)}
          przyZapisie={() => {
            ustawFormularz(null);
            odswiez();
          }}
        />
      )}
    </>
  );
}

window.FormularzOsoby = FormularzOsoby;
window.EkranOsob = EkranOsob;
