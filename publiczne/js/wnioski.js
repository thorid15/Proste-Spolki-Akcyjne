/* wnioski.js — wniosek klienta po stronie kancelarii.

   Ekran prowadzi przez to samo, co klient wypełniał w portalu, tylko z drugiej
   strony biurka: dane spółki, akcjonariusze, komplet dokumentów, decyzja.
   Zakładki, karty podmiotów i typografia są TE SAME, co w portalu klienta —
   rozmowa o jednym wniosku toczy się po dwóch stronach tego samego ekranu,
   więc nie ma powodu, żeby każda strona wyglądała inaczej.

   Przebieg: klient składa wniosek (status `zlozony`) — i na tym koniec, żaden
   dokument jeszcze nie powstaje. Kancelaria sprawdza dane, w razie potrzeby
   poprawia je i dociąga z KRS, po czym WYSTAWIA komplet dokumentów, czyta go,
   poprawia treść, gdzie trzeba, i dopiero wtedy UDOSTĘPNIA klientowi do
   podpisu. Dawniej komplet powstawał sam w chwili złożenia wniosku, więc
   literówka klienta wędrowała wprost do umowy. */

const STAN_WNIOSKU = {
  w_przygotowaniu: { etykieta: 'w przygotowaniu', znacznik: 'neutralna' },
  zlozony: { etykieta: 'złożony — do sprawdzenia', znacznik: 'mosiadz' },
  do_uzupelnienia: { etykieta: 'odesłany do uzupełnienia', znacznik: 'sygnal' },
  umowa_wygenerowana: { etykieta: 'dokumenty u klienta', znacznik: 'neutralna' },
  umowa_podpisana: { etykieta: 'podpisane — do przyjęcia', znacznik: 'rejestr' },
  przyjety: { etykieta: 'przyjęty', znacznik: 'rejestr' },
  odrzucony: { etykieta: 'odrzucony', znacznik: 'sygnal' },
};

function ZnacznikWniosku({ status }) {
  const s = STAN_WNIOSKU[status] || { etykieta: status, znacznik: 'neutralna' };
  return <Pigulka odmiana={s.znacznik}>{s.etykieta}</Pigulka>;
}

function EkranWnioski() {
  const [filtrStatus, ustawFiltrStatus] = useParametrAdresu('status', '');
  const { dane, ladowanie } = useDane(`/api/psa/wnioski${filtrStatus ? `?status=${filtrStatus}` : ''}`, [filtrStatus]);
  const wnioski = (dane && dane.wnioski) || [];

  return (
    <>
      <div className="pasek-narzedzi">
        <select aria-label="Filtruj wnioski wg statusu" value={filtrStatus} onChange={(z) => ustawFiltrStatus(z.target.value)}>
          <option value="">Wszystkie statusy</option>
          {Object.entries(STAN_WNIOSKU).map(([k, v]) => (
            <option key={k} value={k}>{v.etykieta}</option>
          ))}
        </select>
      </div>

      {ladowanie ? (
        <Spinner />
      ) : wnioski.length === 0 ? (
        <Karta>
          <Pusto tytul="Brak wniosków" opis="Wnioski trafiają tu, gdy klient założy je w portalu po otrzymaniu zaproszenia." />
        </Karta>
      ) : (
        <Karta scisla>
          <table className="tabela">
            <thead>
              <tr>
                <th>Zaktualizowano</th>
                <th>Spółka</th>
                <th>E-mail klienta</th>
                <th>Akcjonariusze</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {wnioski.map((w) => (
                <tr key={w.id} className="klikalna" onClick={() => idz(`/wnioski/${w.id}`)}>
                  <td className="wyciszony">{fmt.dataCzas(w.zaktualizowano || w.utworzono)}</td>
                  <td>{w.nazwa || '— nieuzupełniona —'}</td>
                  <td>{w.konto_email}</td>
                  <td>{w.liczba_akcjonariuszy}</td>
                  <td><ZnacznikWniosku status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Karta>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────
   OPISY DANYCH — te same słowa, które widzi klient
   ───────────────────────────────────────────────────── */

const OPIS_ADRESU_REJESTROWEGO_WNIOSKU = {
  zamieszkania: 'adres zamieszkania / siedziby',
  doreczen: 'inny adres do doręczeń',
  edoreczen: 'adres do e-Doręczeń',
};
const OPIS_ZGODY_EMAIL_WNIOSKU = {
  brak: 'bez zgody na e-mail',
  zadeklarowana: 'zgoda na e-mail zadeklarowana — czeka na oświadczenie',
  potwierdzona: 'zgoda na e-mail potwierdzona',
};
const OPIS_WSPOLWLASNOSCI_WNIOSKU = {
  laczna: 'współwłasność łączna',
  ulamkowa: 'współwłasność ułamkowa',
};
// Status PEP decyduje o WZMOŻONYCH środkach bezpieczeństwa finansowego
// (art. 46 ustawy o przeciwdziałaniu praniu pieniędzy), więc notariusz musi
// go zobaczyć, zanim wniosek przyjmie.
const OPIS_PEP_WNIOSKU = {
  tak: 'PEP — eksponowane stanowisko polityczne',
  rodzina: 'PEP — członek rodziny osoby na eksponowanym stanowisku',
  wspolpracownik: 'PEP — bliski współpracownik osoby na eksponowanym stanowisku',
};

/** Pola korekty danych spółki — pogrupowane tak, jak w formularzu klienta. */
const GRUPY_POL_SPOLKI = [
  {
    tytul: 'Spółka',
    pola: [
      ['nazwa', 'Firma (nazwa) spółki'], ['krs', 'Numer KRS'], ['nip', 'NIP'], ['regon', 'REGON'],
    ],
  },
  {
    tytul: 'Siedziba',
    pola: [
      ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'],
      ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
      ['sad_rejestrowy', 'Sąd rejestrowy'], ['wydzial', 'Wydział'],
    ],
  },
  {
    tytul: 'Kontakt',
    pola: [['telefon', 'Telefon'], ['email', 'E-mail'], ['adres_edorecze', 'Adres do e-Doręczeń']],
  },
  {
    tytul: 'Reprezentant podpisujący umowę',
    pola: [
      ['reprezentant_imie_nazwisko', 'Imię i nazwisko'],
      ['reprezentant_funkcja', 'Funkcja'],
      ['reprezentant_pesel', 'PESEL'],
      ['reprezentant_rodzice', 'Imiona rodziców'],
      ['reprezentant_email', 'E-mail'],
    ],
  },
];

const POLA_KOREKTY_AKCJONARIUSZA = [
  ['nazwisko', 'Nazwisko'], ['imie', 'Imię'], ['nazwa', 'Firma (nazwa)'],
  ['pesel', 'PESEL'], ['data_urodzenia', 'Data urodzenia'],
  ['numer_w_rejestrze', 'Numer w rejestrze'], ['nazwa_rejestru', 'Nazwa rejestru'],
  ['kod_pocztowy', 'Kod pocztowy'], ['miejscowosc', 'Miejscowość'], ['ulica', 'Ulica'],
  ['nr_domu', 'Nr domu'], ['nr_lokalu', 'Nr lokalu'],
  ['adres_doreczen', 'Inny adres do doręczeń'], ['adres_edoreczen', 'Adres do e-Doręczeń'],
  ['email', 'E-mail'], ['telefon', 'Telefon'],
  ['wspolwlasciciele', 'Pozostali współwłaściciele'],
];

function nazwaPozycji(a) {
  if (a.typ === 'prawna') return a.nazwa || '— podmiot bez nazwy —';
  return [a.imie, a.nazwisko].filter(Boolean).join(' ') || '— dane nieuzupełnione —';
}

/** Identyfikator ustawowy: PESEL albo data urodzenia; dla podmiotu numer w rejestrze. */
function identyfikatorPozycji(a) {
  if (a.typ === 'prawna') {
    if (a.numer_w_rejestrze) return `${a.nazwa_rejestru || 'rejestr'} ${a.numer_w_rejestrze}`;
    if (a.nip) return `NIP ${a.nip}`;
    return 'bez numeru w rejestrze';
  }
  if (a.pesel) return `PESEL ${a.pesel}`;
  if (a.data_urodzenia) return `ur. ${fmt.data(a.data_urodzenia)}`;
  return 'bez PESEL-u i daty urodzenia';
}

/** Adres tak, jak go podano — nie nazwa rubryki, tylko jej treść. */
function adresPozycji(a) {
  const linia = [
    [a.kod_pocztowy, a.miejscowosc].filter(Boolean).join(' ').trim(),
    [a.ulica, a.nr_domu, a.nr_lokalu && `m. ${a.nr_lokalu}`].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');
  if (linia) return linia;
  if (a.adres_doreczen) return `do doręczeń: ${a.adres_doreczen}`;
  if (a.adres_edoreczen) return `e-Doręczenia: ${a.adres_edoreczen}`;
  return 'brak adresu';
}

/* ─────────────────────────────────────────────────────
   PORÓWNANIE Z ODPISEM KRS
   ───────────────────────────────────────────────────── */

const POLA_POROWNANIA_KRS = [
  ['nazwa', 'Nazwa'], ['nip', 'NIP'], ['regon', 'REGON'],
  ['miejscowosc', 'Miejscowość'], ['ulica', 'Ulica'], ['nr_domu', 'Nr domu'],
  ['sad_rejestrowy', 'Sąd rejestrowy'],
];

function PorownanieZKrs({ wniosek, krs }) {
  if (!wniosek.krs) {
    return <Komunikat odmiana="info" tresc="Wniosek nie ma podanego numeru KRS — porównanie nie jest możliwe." />;
  }
  if (!krs) return <Spinner />;
  if (!krs.znaleziono) {
    return <Komunikat odmiana="uwaga" tresc={krs.komunikat || 'Nie udało się pobrać danych z KRS.'} />;
  }
  return (
    <table className="tabela">
      <thead><tr><th>Pole</th><th>Wniosek klienta</th><th>Odpis KRS</th></tr></thead>
      <tbody>
        {POLA_POROWNANIA_KRS.map(([klucz, etykieta]) => {
          const a = wniosek[klucz] || '';
          const bWartosc = (krs.dane && krs.dane[klucz]) || '';
          const rozbieznosc = a && bWartosc && String(a).trim().toLowerCase() !== String(bWartosc).trim().toLowerCase();
          return (
            <tr key={klucz}>
              <td className="wyciszony">{etykieta}</td>
              <td>{a || '—'}</td>
              <td className={rozbieznosc ? 'rozbieznosc-krs' : undefined}>
                {bWartosc || '—'}
                {rozbieznosc && <span className="rozbieznosc-znak" title="Wartość różni się od wniosku"> ⚠︎</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 1 — DANE SPÓŁKI
   ───────────────────────────────────────────────────── */

function KrokDaneSpolki({ wniosek, krs, zablokowane, odswiez }) {
  const [edycja, ustawEdycja] = useState(false);
  const [dane, ustawDane] = useState(wniosek);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [pobieranieKrs, ustawPobieranieKrs] = useState(false);
  const [komunikat, ustawKomunikat] = useState(null);
  const [blad, ustawBlad] = useState(null);

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.put(`/api/psa/wnioski/${wniosek.id}`, dane);
      ustawEdycja(false);
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty spółki.');
    } finally {
      ustawZapisywanie(false);
    }
  }

  /* Klient ma ten przycisk w portalu od początku; kancelaria musiała dotąd
     przepisywać dane z odpisu ręcznie — choć to ona odpowiada za ich
     zgodność z rejestrem przedsiębiorców. */
  async function pobierzZKrs() {
    ustawPobieranieKrs(true);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/z-krs`, {});
      if (!wynik.znaleziono) {
        ustawKomunikat({ odmiana: 'uwaga', tresc: wynik.komunikat || 'Nie odnaleziono spółki w KRS.' });
      } else {
        ustawKomunikat({
          odmiana: (wynik.ostrzezenia || []).length ? 'uwaga' : 'ok',
          tresc: (wynik.ostrzezenia || []).length
            ? wynik.ostrzezenia.join(' ')
            : `Dane pobrane z rejestru przedsiębiorców — nadpisano ${wynik.pobrane.length} pól.`,
        });
        ustawDane(wynik.wniosek);
        odswiez();
      }
    } catch (e) {
      ustawKomunikat({ odmiana: 'blad', tresc: e instanceof BladApi ? e.message : 'Nie udało się pobrać danych z KRS.' });
    } finally {
      ustawPobieranieKrs(false);
    }
  }

  const adres = [
    [wniosek.kod_pocztowy, wniosek.miejscowosc].filter(Boolean).join(' ').trim(),
    [wniosek.ulica, wniosek.nr_domu, wniosek.nr_lokalu && `m. ${wniosek.nr_lokalu}`].filter(Boolean).join(' ').trim(),
  ].filter(Boolean).join(', ');

  return (
    <div className="pion" style={{ gap: 16 }}>
      <Karta
        tytul="Dane spółki"
        akcje={!zablokowane && (
          edycja ? (
            <div className="row-g">
              <button className="btn btn-maly" onClick={() => { ustawDane(wniosek); ustawEdycja(false); }}>Anuluj</button>
              <button className="btn btn-maly btn-glowny" onClick={zapisz} disabled={zapisywanie}>
                {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
              </button>
            </div>
          ) : (
            <div className="row-g">
              <button className="btn btn-maly" onClick={pobierzZKrs} disabled={pobieranieKrs}>
                {pobieranieKrs ? 'Pobieranie…' : 'Pobierz z KRS'}
              </button>
              <button className="btn btn-maly" onClick={() => { ustawDane(wniosek); ustawEdycja(true); }}>
                Popraw dane
              </button>
            </div>
          )
        )}
      >
        {komunikat && <Komunikat odmiana={komunikat.odmiana} tresc={komunikat.tresc} />}
        <Komunikat odmiana="blad" tresc={blad} />

        {!edycja ? (
          <dl className="podsumowanie">
            <dt>Firma (nazwa)</dt>
            <dd>{wniosek.nazwa || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Numer KRS</dt>
            <dd className="kol-dane">{wniosek.krs || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>NIP</dt>
            <dd className="kol-dane">{wniosek.nip || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>REGON</dt>
            <dd className="kol-dane">{wniosek.regon || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Siedziba</dt>
            <dd>{adres || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Sąd rejestrowy</dt>
            <dd>{wniosek.sad_rejestrowy || <span className="brak">nie uzupełniono</span>}</dd>
            <dt>Reprezentant</dt>
            <dd>
              {wniosek.reprezentant_imie_nazwisko || <span className="brak">nie uzupełniono</span>}
              {wniosek.reprezentant_funkcja && (
                <span className="podsumowanie-dopisek">{wniosek.reprezentant_funkcja}</span>
              )}
            </dd>
            <dt>E-mail reprezentanta</dt>
            <dd>{wniosek.reprezentant_email || <span className="brak">nie uzupełniono</span>}</dd>
          </dl>
        ) : (
          GRUPY_POL_SPOLKI.map((grupa) => (
            <div key={grupa.tytul}>
              <div className="grupa-pol-tytul">{grupa.tytul}</div>
              <div className="siatka-2">
                {grupa.pola.map(([klucz, etykieta]) => (
                  <Pole key={klucz} etykieta={etykieta}>
                    <input
                      type="text"
                      value={dane[klucz] || ''}
                      onChange={(z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value }))}
                    />
                  </Pole>
                ))}
              </div>
              {/* Dowód i adres reprezentanta są od migracji 53 ustrukturyzowane
                  (B2/B3) — nie pasują do generycznej siatki pól tekstowych
                  wyżej (rodzaj dowodu ma zamknięty katalog, adres kilka
                  kolumn), więc mają własne komponenty. */}
              {grupa.tytul === 'Reprezentant podpisujący umowę' && (
                <>
                  <PoleDowod
                    etykieta="Dowód tożsamości"
                    rodzaj={dane.reprezentant_dowod_rodzaj}
                    numer={dane.reprezentant_dowod_numer}
                    przyZmianie={(latka) => ustawDane((p) => ({ ...p, ...latka }))}
                    idPrefiks="korekta-reprezentant"
                    klucze={{ rodzaj: 'reprezentant_dowod_rodzaj', numer: 'reprezentant_dowod_numer' }}
                  />
                  <PoleAdres
                    etykieta="Adres zamieszkania"
                    dane={dane}
                    przyZmianie={(latka) => ustawDane((p) => ({ ...p, ...latka }))}
                    prefiks="reprezentant_"
                    idPrefiks="korekta-reprezentant"
                  />
                  {!dane.reprezentant_kod_pocztowy && !dane.reprezentant_ulica && dane.reprezentant_adres && (
                    <Komunikat
                      odmiana="info"
                      tresc={`Adres wpisany wcześniej, w jednym polu: „${dane.reprezentant_adres}”. Wpisz go ponownie powyżej, żeby pisma mogły go użyć w nowym formacie.`}
                    />
                  )}
                </>
              )}
              {/* Skan dowodu stoi przy danych reprezentanta, bo tam się go
                  sprawdza: pisownia nazwiska i PESEL w umowie mają zgadzać
                  się z dokumentem, który przysłał klient. */}
              {grupa.tytul === 'Reprezentant podpisujący umowę' && (
                <Pole etykieta="Skan dokumentu tożsamości">
                  {wniosek.dowod_nazwa_pliku ? (
                    <div className="lista-plikow">
                      <div>
                        <Ikona nazwa="dokument" rozmiar={15} />
                        <a
                          className="lista-plikow-nazwa"
                          href={`/api/psa/wnioski/${wniosek.id}/dowod`}
                          target="_blank"
                          rel="noopener"
                        >
                          {wniosek.dowod_nazwa_pliku}
                        </a>
                        <span className="wyciszony male">
                          {Math.max(1, Math.round((wniosek.dowod_rozmiar || 0) / 1024))} kB
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="wyciszony male">klient nie przesłał dokumentu tożsamości</span>
                  )}
                </Pole>
              )}
            </div>
          ))
        )}
      </Karta>

      <Karta tight tytul="Porównanie z odpisem KRS">
        <PorownanieZKrs wniosek={wniosek} krs={krs} />
      </Karta>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 2 — AKCJONARIUSZE
   Lista jak w portalu klienta: widać wszystkich naraz, dane jednego otwiera
   się osobno. Kancelaria dostaje przy tym to, czego klient nie ma:
   weryfikację pozycji i dopasowanie do kartoteki wspólnej.
   ───────────────────────────────────────────────────── */

function SzczegolAkcjonariusza({ pozycja, wniosekId, zablokowane, braki, odswiez, przyZamknieciu }) {
  const [dane, ustawDane] = useState(pozycja);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [pokazUwagi, ustawPokazUwagi] = useState(false);
  const [uwagi, ustawUwagi] = useState('');
  const [blad, ustawBlad] = useState(null);

  /** Zapisuje wpisane poprawki; `null` gdy zapis się nie udał. */
  async function zapiszKorekte() {
    try {
      await API.put(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`, dane);
      return true;
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać korekty.');
      return false;
    }
  }

  /**
   * Weryfikacja pozycji. Otwarcie danych akcjonariusza kończy się jedną
   * z dwóch decyzji — „sprawdziłem" albo „niech klient poprawi" — więc sam
   * zapis nie jest osobną akcją: to, co poprawił pracownik, idzie na serwer
   * razem z decyzją.
   */
  async function zweryfikuj() {
    ustawZapisywanie(true);
    ustawBlad(null);
    if (!(await zapiszKorekte())) { ustawZapisywanie(false); return; }
    try {
      await API.post(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/zweryfikuj`, {
        zweryfikowano: 1,
        osoba_id: pozycja.osoba_id ?? null,
      });
      odswiez();
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać weryfikacji.');
      ustawZapisywanie(false);
    }
  }

  async function odeslijDoPoprawy() {
    if (!uwagi.trim()) {
      ustawBlad('Napisz, co klient ma poprawić przy tej pozycji.');
      return;
    }
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/do-poprawy`, {
        uwagi: uwagi.trim(),
      });
      odswiez();
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się odesłać pozycji do poprawy.');
      ustawZapisywanie(false);
    }
  }

  async function usun() {
    if (!window.confirm('Usunąć tę pozycję z wniosku?')) return;
    try {
      await API.delete(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}`);
      odswiez();
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się usunąć pozycji.');
    }
  }

  async function ustawZweryfikowano(zweryfikowano, osobaId) {
    ustawBlad(null);
    try {
      await API.post(`/api/psa/wnioski/${wniosekId}/akcjonariusze/${pozycja.id}/zweryfikuj`, {
        zweryfikowano,
        osoba_id: osobaId ?? pozycja.osoba_id ?? null,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać weryfikacji.');
    }
  }

  const pole = (klucz) => ({
    value: dane[klucz] || '',
    onChange: (z) => ustawDane((p) => ({ ...p, [klucz]: z.target.value })),
    disabled: zablokowane,
    autoComplete: 'off',
  });

  // B4 — ta sama reguła, co po stronie serwera (server/logika/akcjonariusz.js
  // `ostrzezenia()`), tylko przypięta wprost do dwóch pól, których dotyczy.
  const bladPeselDaty = dane.typ !== 'prawna' && !String(dane.pesel || '').trim() && !String(dane.data_urodzenia || '').trim()
    ? 'Wpisz PESEL albo — gdy akcjonariusz go nie ma — datę urodzenia.'
    : null;

  // K4 (FAZA 3 sesji frontendowej v2): dopasowanie do kartoteki było wyłącznie
  // ręczne (WyborZKartoteki niżej) — ten sam wzorzec kolizji identyfikatora
  // co w PanelOsoby (D-042), tu jako PROPOZYCJA jednym kliknięciem, bo tu nie
  // ma ryzyka założenia duplikatu (pozycja bez dopasowania i tak zakłada
  // nową osobę dopiero przy przyjęciu wniosku, nie od razu).
  const [sugestia, ustawSugestie] = useState(null);
  const identyfikatorDopasowania = pozycja.typ === 'prawna' ? pozycja.numer_w_rejestrze : pozycja.pesel;
  useEffect(() => {
    ustawSugestie(null);
    if (pozycja.osoba_id || !identyfikatorDopasowania) return undefined;
    const klucz = pozycja.typ === 'prawna' ? 'numer_w_rejestrze' : 'pesel';
    let aktualne = true;
    API.get(`/api/psa/osoby?q=${encodeURIComponent(identyfikatorDopasowania)}`)
      .then((o) => {
        if (!aktualne) return;
        const trafienie = o.osoby.find((x) => String(x[klucz] || '') === String(identyfikatorDopasowania));
        if (trafienie) ustawSugestie(trafienie);
      })
      .catch(() => {});
    return () => { aktualne = false; };
  }, [pozycja.osoba_id, identyfikatorDopasowania, pozycja.typ]);

  return (
    <>
      <KrokNaglowek tytul={nazwaPozycji(pozycja)} opis={identyfikatorPozycji(pozycja)} />
      <Komunikat odmiana="blad" tresc={blad} />

      {pozycja.uwagi_kancelarii && (
        <Komunikat
          odmiana="uwaga"
          tytul="Pozycja odesłana do poprawy"
          tresc={pozycja.uwagi_kancelarii}
        />
      )}

      {braki && braki.length > 0 && (
        <Komunikat odmiana="uwaga" tytul="Braki wobec art. 300³³ § 1 KSH" lista={braki} />
      )}

      {/* B4: reguła „PESEL albo data urodzenia" — dziś jedyny błąd wobec
          art. 300³³ § 1 KSH widoczny WYŁĄCZNIE w banerze wyżej — powtórzona
          też PRZY POLACH, których dotyczy (wzorzec z FAZY 1 pkt 3), zamiast
          zmuszać do skojarzenia zdania z bannera z wierszem siatki niżej. */}

      <div className="podsumowanie-cechy" style={{ marginBottom: 'var(--od-16)' }}>
        <span>{pozycja.typ === 'prawna' ? 'osoba prawna' : 'osoba fizyczna'}</span>
        <span>
          do rejestru: {OPIS_ADRESU_REJESTROWEGO_WNIOSKU[pozycja.rodzaj_adresu_rejestrowego] || 'adres niewskazany'}
        </span>
        <span>{OPIS_ZGODY_EMAIL_WNIOSKU[pozycja.zgoda_email_status || 'brak']}</span>
        {OPIS_PEP_WNIOSKU[pozycja.pep] && (
          <span className="cecha-pep" title={pozycja.pep_opis || undefined}>
            {OPIS_PEP_WNIOSKU[pozycja.pep]}
            {pozycja.pep_opis ? ` — ${pozycja.pep_opis}` : ''}
          </span>
        )}
        {pozycja.wspolwlasnosc && pozycja.wspolwlasnosc !== 'brak' && (
          <span>
            {OPIS_WSPOLWLASNOSCI_WNIOSKU[pozycja.wspolwlasnosc]}
            {pozycja.wspolwlasnosc === 'ulamkowa' && pozycja.udzial_licznik
              ? ` ${pozycja.udzial_licznik}/${pozycja.udzial_mianownik}`
              : ''}
          </span>
        )}
      </div>

      <div className="siatka-2">
        {POLA_KOREKTY_AKCJONARIUSZA.map(([klucz, etykieta]) => (
          <Pole
            key={klucz}
            etykieta={etykieta}
            blad={(klucz === 'pesel' || klucz === 'data_urodzenia') ? bladPeselDaty : undefined}
          >
            <input type="text" {...pole(klucz)} />
          </Pole>
        ))}
      </div>

      {/* Klient wpisuje adresy, jakie akcjonariusz ma — KTÓRY z nich trafia do
          treści rejestru (art. 300³³ § 1 pkt 3 KSH dopuszcza jeden) wybiera
          kancelaria. To jedyne pole, którego formularz klienta nie ma. */}
      <Pole
        etykieta="Adres wpisywany do rejestru"
        podpowiedz="Do treści rejestru wchodzi dokładnie jeden adres — art. 300³³ § 1 pkt 3 KSH."
      >
        <select
          value={dane.rodzaj_adresu_rejestrowego || 'zamieszkania'}
          onChange={(z) => ustawDane((p) => ({ ...p, rodzaj_adresu_rejestrowego: z.target.value }))}
          disabled={zablokowane}
        >
          <option value="zamieszkania">Adres zamieszkania albo siedziby</option>
          <option value="doreczen">Inny adres do doręczeń</option>
          <option value="edoreczen">Adres do doręczeń elektronicznych</option>
        </select>
      </Pole>

      {!zablokowane && sugestia && (
        <div className="kolizja-kartoteki" role="status">
          <span>W kartotece jest już <strong>{sugestia.oznaczenie}</strong> z tym numerem.</span>
          <button
            type="button"
            className="btn btn-maly"
            onClick={() => ustawZweryfikowano(pozycja.zweryfikowano ? 1 : 0, sugestia.id)}
          >
            Dopasuj
          </button>
        </div>
      )}

      {!zablokowane && (
        <Pole
          etykieta="Dopasowanie do kartoteki wspólnej"
          podpowiedz="Puste = przy przyjęciu wniosku powstanie nowa osoba w kartotece."
        >
          <WyborZKartoteki
            wartosc={pozycja.osoba_id}
            przyZmianie={(id) => ustawZweryfikowano(1, id)}
            typFiltr={pozycja.typ}
          />
        </Pole>
      )}

      {/* Dwie decyzje, nie zapis: pracownik otwiera pozycję po to, żeby ją
          sprawdzić, więc wychodzi z niej albo z „zweryfikowano", albo
          z uwagą dla klienta. Wpisane poprawki idą na serwer razem z decyzją. */}
      {!zablokowane && !pokazUwagi && (
        <div className="decyzja-pozycji">
          <button className="btn btn-nawigacja" onClick={przyZamknieciu}>Wróć do listy</button>
          <div className="decyzja-pozycji-akcje">
            <button
              className="btn btn-nawigacja"
              onClick={() => { ustawUwagi(pozycja.uwagi_kancelarii || ''); ustawPokazUwagi(true); }}
              disabled={zapisywanie}
            >
              Odeślij do poprawy
            </button>
            <button
              className="btn btn-glowny btn-nawigacja"
              onClick={zweryfikuj}
              disabled={zapisywanie}
            >
              {zapisywanie ? 'Zapisywanie…' : 'Zweryfikowano'}
            </button>
          </div>
        </div>
      )}

      {!zablokowane && pokazUwagi && (
        <div className="pion" style={{ gap: 'var(--od-8)', marginTop: 'var(--od-24)' }}>
          <Pole
            etykieta="Co klient ma poprawić przy tej pozycji"
            wymagane
            podpowiedz="Uwagę zobaczy przy tym akcjonariuszu w swoim formularzu."
          >
            <textarea rows={3} value={uwagi} onChange={(z) => ustawUwagi(z.target.value)} autoFocus />
          </Pole>
          <div className="row-g">
            <button className="btn" onClick={() => ustawPokazUwagi(false)} disabled={zapisywanie}>Anuluj</button>
            <button className="btn btn-glowny" onClick={odeslijDoPoprawy} disabled={zapisywanie}>
              {zapisywanie ? 'Wysyłanie…' : 'Odeślij wniosek do poprawy'}
            </button>
          </div>
        </div>
      )}

      {zablokowane && (
        <NawigacjaKreatora wstecz={{ etykieta: 'Wróć do listy', przy: przyZamknieciu }} />
      )}

      {!zablokowane && (
        <div className="akcja-niszczaca">
          {Boolean(pozycja.zweryfikowano) && (
            <button className="btn btn-maly" onClick={() => ustawZweryfikowano(0)}>
              Cofnij weryfikację
            </button>
          )}
          <button className="btn btn-maly btn-sygnal" onClick={usun}>Usuń akcjonariusza</button>
        </div>
      )}
    </>
  );
}

function KrokAkcjonariusze({ wniosek, akcjonariusze, brakiUstawowe, zablokowane, odswiez }) {
  const [otwarty, ustawOtwarty] = useState(null);
  const [dodawanie, ustawDodawanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  async function dopisz() {
    ustawDodawanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/akcjonariusze`, {});
      odswiez();
      ustawOtwarty(wynik.akcjonariusz.id);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się dopisać osoby.');
    } finally {
      ustawDodawanie(false);
    }
  }

  const pozycja = akcjonariusze.find((a) => a.id === otwarty) || null;

  return (
    <Karta>
      {pozycja ? (
        <SzczegolAkcjonariusza
          key={pozycja.id}
          pozycja={pozycja}
          wniosekId={wniosek.id}
          zablokowane={zablokowane}
          braki={brakiUstawowe[pozycja.id]}
          odswiez={odswiez}
          przyZamknieciu={() => ustawOtwarty(null)}
        />
      ) : (
        <>
          <KrokNaglowek
            tytul="Akcjonariusze"
            opis="Każdą pozycję trzeba otworzyć, sprawdzić i zweryfikować — bez tego wniosku nie da się przyjąć."
          />
          <Komunikat odmiana="blad" tresc={blad} />

          {akcjonariusze.length === 0 ? (
            <Pusto
              ikona="osoby"
              tytul="Wniosek nie ma żadnego akcjonariusza"
              opis="Klient nie dopisał nikogo albo pozycje zostały usunięte. Dopisz osobę, jeśli wynika to z dokumentów."
            />
          ) : (
            <div className="lista-podmiotow">
              {akcjonariusze.map((a) => {
                const braki = (brakiUstawowe[a.id] || []).length;
                return (
                  <WierszPodmiotu
                    key={a.id}
                    ikona={a.typ === 'prawna' ? 'spolki' : 'osoby'}
                    tytul={nazwaPozycji(a)}
                    znacznik={a.uwagi_kancelarii
                      ? 'u klienta do poprawy'
                      : a.zweryfikowano
                        ? 'zweryfikowana'
                        : braki > 0 ? `${braki} braków` : 'do weryfikacji'}
                    opis={[
                      identyfikatorPozycji(a),
                      adresPozycji(a),
                      OPIS_ZGODY_EMAIL_WNIOSKU[a.zgoda_email_status || 'brak'],
                      OPIS_PEP_WNIOSKU[a.pep],
                    ].filter(Boolean).join(' · ')}
                    przyKliknieciu={() => ustawOtwarty(a.id)}
                  />
                );
              })}
            </div>
          )}

          {!zablokowane && (
            <WierszDodania
              etykieta={dodawanie ? 'Dopisywanie…' : 'Dopisz osobę'}
              przyKliknieciu={dopisz}
              wylaczony={dodawanie}
            />
          )}
        </>
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 3 — DOKUMENTY
   ───────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────
   KROK 3 — DOKUMENTY

   Dokument otwiera się JEDNYM przyciskiem. To, co się otwiera, wygląda jak
   dokument — jedna kolumna, tytuł na środku, akapity, miejsca na podpis —
   a nie jak formularz obok podglądu. Kliknięcie w akapit zamienia go w pole
   do pisania i z powrotem; nie trzeba przełączać się między „czytam"
   a „poprawiam", bo przy czytaniu dokumentu właśnie o to chodzi.

   Po odesłaniu podpisanego skanu treść zamyka się na stałe: podpis dotyczy
   TEGO brzmienia dokumentu, a nie następnego. Zostaje czytanie i jedna
   decyzja — czy podpis jest prawidłowy.
   ───────────────────────────────────────────────────── */

/** Data w postaci, w jakiej stoi w dokumencie — bez sekund i strefy. */
function podpisSprawdzenia(dokument) {
  if (dokument.podpis_potwierdzono) return 'podpis potwierdzony';
  if (dokument.sprawdzono) return 'sprawdzony';
  return null;
}

/**
 * Jeden blok w postaci, w jakiej wyjdzie na papier. Klasy `dok-*` opisują
 * dokument, nie interfejs — dlatego nie korzystają z pól aplikacji.
 */
function BlokPodglad({ blok }) {
  switch (blok.rodzaj) {
    case 'naglowek':
      return (
        <div className="dok-naglowek">
          {[blok.miejscowosc || '—', blok.data ? `dnia ${blok.data}` : null].filter(Boolean).join(', ')}
        </div>
      );
    case 'tytul':
      return (
        <div className="dok-tytul-blok">
          <div className="dok-tytul">{blok.tekst}</div>
          {blok.podtytul && <div className="dok-podtytul">{blok.podtytul}</div>}
        </div>
      );
    case 'sekcja':
      return <div className="dok-sekcja">{blok.tekst}</div>;
    case 'akapit':
      return <p className="dok-akapit">{blok.tekst}</p>;
    case 'pola':
      return (
        <dl className="dok-pola">
          {blok.pary.map(([etykieta, wartosc], i) => (
            <React.Fragment key={i}>
              <dt>{etykieta}:</dt>
              <dd>{String(wartosc || '').trim() || '—'}</dd>
            </React.Fragment>
          ))}
        </dl>
      );
    case 'punkt':
      return (
        <div className="dok-punkt">
          <span className="dok-punkt-znacznik">{blok.znacznik}</span>
          <span>{blok.tekst}</span>
        </div>
      );
    case 'opcja':
      return (
        <div className="dok-opcja">
          <span className={`dok-kratka ${blok.zaznaczona ? 'dok-kratka-zaznaczona' : ''}`} aria-hidden="true" />
          <span>{blok.tekst}</span>
        </div>
      );
    case 'doWypelnienia':
      return (
        <div className="dok-wypelnij">
          {blok.etykiety.map((etykieta, i) => (
            <div className="dok-wypelnij-wiersz" key={i}>
              <span>{etykieta}:</span>
              <span className="dok-linia" />
            </div>
          ))}
        </div>
      );
    case 'podpis':
      return (
        <div className="dok-podpis">
          <span className="dok-podpis-linia" />
          <span className="dok-podpis-opis">{blok.opis}</span>
        </div>
      );
    case 'odstep':
      return <div className="dok-odstep" style={{ height: Math.max(1, Number(blok.ile) || 1) * 12 }} />;
    default:
      return null;
  }
}

/** Ten sam blok otwarty do pisania. Pola zależą od rodzaju. */
function BlokEdycja({ blok, przyZmianie }) {
  const wiersz = (etykieta, wartosc, zmien, wiele = false) => (
    <Pole etykieta={etykieta}>
      {wiele
        ? <textarea rows={4} value={wartosc} onChange={(z) => zmien(z.target.value)} />
        : <input type="text" value={wartosc} onChange={(z) => zmien(z.target.value)} />}
    </Pole>
  );

  switch (blok.rodzaj) {
    case 'naglowek':
      return (
        <div className="siatka-2">
          {wiersz('Miejscowość', blok.miejscowosc, (v) => przyZmianie({ ...blok, miejscowosc: v }))}
          {wiersz('Data', blok.data, (v) => przyZmianie({ ...blok, data: v }))}
        </div>
      );
    case 'tytul':
      return (
        <>
          {wiersz('Tytuł', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }))}
          {wiersz('Podtytuł', blok.podtytul, (v) => przyZmianie({ ...blok, podtytul: v }))}
        </>
      );
    case 'sekcja':
      return wiersz('Nagłówek sekcji', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }));
    case 'akapit':
      return wiersz('Treść akapitu', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true);
    case 'punkt':
      return (
        <>
          {wiersz('Znacznik', blok.znacznik, (v) => przyZmianie({ ...blok, znacznik: v }))}
          {wiersz('Treść', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true)}
        </>
      );
    case 'pola':
      return (
        <Pole etykieta="Dane" podpowiedz="Jeden wiersz = jedna pozycja, w postaci „Etykieta: wartość”.">
          <textarea
            rows={Math.max(2, blok.pary.length)}
            value={blok.pary.map(([e, w]) => `${e}: ${w}`).join('\n')}
            onChange={(z) => przyZmianie({
              ...blok,
              pary: z.target.value.split('\n').map((linia) => {
                const rozdzial = linia.indexOf(':');
                return rozdzial === -1
                  ? [linia.trim(), '']
                  : [linia.slice(0, rozdzial).trim(), linia.slice(rozdzial + 1).trim()];
              }),
            })}
          />
        </Pole>
      );
    case 'doWypelnienia':
      return (
        <Pole etykieta="Pola do wypełnienia ręcznie" podpowiedz="Jedna etykieta w wierszu — pod każdą stanie linia na wpis.">
          <textarea
            rows={Math.max(2, blok.etykiety.length)}
            value={blok.etykiety.join('\n')}
            onChange={(z) => przyZmianie({ ...blok, etykiety: z.target.value.split('\n') })}
          />
        </Pole>
      );
    case 'opcja':
      return (
        <>
          {wiersz('Treść pozycji', blok.tekst, (v) => przyZmianie({ ...blok, tekst: v }), true)}
          <label className="chk">
            <input
              type="checkbox"
              checked={Boolean(blok.zaznaczona)}
              onChange={(z) => przyZmianie({ ...blok, zaznaczona: z.target.checked })}
            />
            <span className="chk-tresc">Kratka zaznaczona z góry</span>
          </label>
        </>
      );
    case 'podpis':
      return wiersz('Podpis pod linią', blok.opis, (v) => przyZmianie({ ...blok, opis: v }));
    case 'odstep':
      return (
        <Pole etykieta="Wysokość odstępu (w wierszach)">
          <input
            type="number" min="1" step="1"
            value={blok.ile}
            onChange={(z) => przyZmianie({ ...blok, ile: Number(z.target.value) || 1 })}
          />
        </Pole>
      );
    default:
      return null;
  }
}

/** Kafel otwierający jeden egzemplarz dokumentu jako PDF w nowej karcie. */
function EgzemplarzDokumentu({ nazwa, opis, href, glowny }) {
  return (
    <a
      className={`dok-egzemplarz ${glowny ? 'dok-egzemplarz-glowny' : ''}`}
      href={href}
      target="_blank"
      rel="noopener"
    >
      <Ikona nazwa="dokument" rozmiar={20} />
      <span className="dok-egzemplarz-tresc">
        <span className="dok-egzemplarz-nazwa">{nazwa}</span>
        <span className="dok-egzemplarz-plik">{opis}</span>
      </span>
      <span className="dok-egzemplarz-akcja">Otwórz PDF</span>
    </a>
  );
}

/**
 * Okno dokumentu: czytanie i — dopóki nikt go nie podpisał — poprawianie
 * treści w miejscu.
 *
 * Po podpisaniu okno NIE pokazuje już treści złożonej z bloków. Podpis
 * dotyczy pliku, nie zapisu w bazie, więc jedynym wiarygodnym obrazem tego,
 * co zostało podpisane, jest sam PDF — oba egzemplarze otwiera się w nowej
 * karcie, a w oknie zostaje sama decyzja o prawidłowości podpisu.
 */
function OknoDokumentu({ wniosekId, dokument, zablokowane, przyZamknieciu, przyZapisie }) {
  const [stan, ustawStan] = useState({ ladowanie: true, dokument: null, rodzaje: {} });
  const [bloki, ustawBloki] = useState([]);
  const [aktywny, ustawAktywny] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const podpisany = Boolean(dokument.podpis_nazwa_pliku);
  const doPoprawy = !podpisany && !zablokowane && dokument.edytowalny;

  useEffect(() => {
    // Podpisanego dokumentu nie ma po co wczytywać — jego treści i tak się
    // nie pokazuje ani nie zmienia.
    if (podpisany) {
      ustawStan({ ladowanie: false, dokument: null, rodzaje: {} });
      return;
    }
    API.get(`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/tresc`)
      .then((d) => {
        ustawStan({ ladowanie: false, dokument: d.dokument, rodzaje: d.rodzaje });
        ustawBloki(d.dokument.bloki);
      })
      .catch((e) => {
        ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wczytać treści dokumentu.');
        ustawStan((p) => ({ ...p, ladowanie: false }));
      });
  }, [wniosekId, dokument.id, podpisany]);

  function zmienBlok(i, nowy) {
    ustawBloki((p) => p.map((b, idx) => (idx === i ? nowy : b)));
  }
  function usunBlok(i) {
    ustawBloki((p) => p.filter((_, idx) => idx !== i));
    ustawAktywny(null);
  }
  function przesunBlok(i, kierunek) {
    const cel = i + kierunek;
    ustawBloki((p) => {
      if (cel < 0 || cel >= p.length) return p;
      const kopia = [...p];
      [kopia[i], kopia[cel]] = [kopia[cel], kopia[i]];
      return kopia;
    });
    if (cel >= 0 && cel < bloki.length) ustawAktywny(cel);
  }
  function dopiszAkapit(po) {
    ustawBloki((p) => {
      const kopia = [...p];
      kopia.splice(po + 1, 0, { rodzaj: 'akapit', tekst: '' });
      return kopia;
    });
    ustawAktywny(po + 1);
  }

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.put(`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/tresc`, { bloki });
      przyZapisie(wynik.dokumenty);
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać treści.');
      ustawZapisywanie(false);
    }
  }

  async function potwierdzPodpis(potwierdzono) {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post(
        `/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}/podpis-potwierdz`,
        { potwierdzono }
      );
      przyZapisie(wynik.dokumenty);
      przyZamknieciu();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać potwierdzenia.');
      ustawZapisywanie(false);
    }
  }

  const stopka = podpisany ? (
    <>
      <button className="btn" onClick={przyZamknieciu}>Zamknij</button>
      {!zablokowane && (
        dokument.podpis_potwierdzono ? (
          <button className="btn" onClick={() => potwierdzPodpis(false)} disabled={zapisywanie}>
            Cofnij potwierdzenie
          </button>
        ) : (
          <button className="btn btn-glowny" onClick={() => potwierdzPodpis(true)} disabled={zapisywanie}>
            {zapisywanie ? 'Zapisywanie…' : 'Podpis prawidłowy'}
          </button>
        )
      )}
    </>
  ) : (
    <>
      <button className="btn" onClick={przyZamknieciu}>Zamknij bez zapisu</button>
      {doPoprawy && (
        <button className="btn btn-glowny" onClick={zapisz} disabled={zapisywanie || stan.ladowanie}>
          {zapisywanie ? 'Składanie dokumentu…' : 'Zapisz i oznacz jako sprawdzony'}
        </button>
      )}
    </>
  );

  return (
    <Modal tytul={dokument.nazwa} przyZamknieciu={przyZamknieciu} szerokosc={880} stopka={stopka}>
      <Komunikat odmiana="blad" tresc={blad} />

      {podpisany && (
        <>
          <Komunikat
            odmiana="uwaga"
            tytul="Dokument został podpisany"
            tresc="Treści nie można już zmieniać — podpis dotyczy tego brzmienia dokumentu.
              Oba egzemplarze otwierają się jako pliki PDF w nowej karcie."
          />
          <div className="dok-egzemplarze">
            <EgzemplarzDokumentu
              nazwa="Egzemplarz wystawiony"
              opis={dokument.nazwa_pliku || dokument.nazwa}
              href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}?podglad=1`}
            />
            <EgzemplarzDokumentu
              nazwa="Skan odesłany przez klienta"
              opis={dokument.podpis_nazwa_pliku}
              href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}?egzemplarz=podpisany&podglad=1`}
              glowny
            />
          </div>
        </>
      )}

      {!podpisany && stan.dokument && stan.dokument.brakujace.length > 0 && (
        <Komunikat
          odmiana="uwaga"
          tytul="Wzór nie miał czym wypełnić tych miejsc"
          tresc="W dokumencie stoi w nich kreska. Uzupełnij je tutaj albo popraw dane wniosku i wystaw komplet ponownie."
          lista={stan.dokument.brakujace}
        />
      )}

      {podpisany ? null : stan.ladowanie ? (
        <Spinner />
      ) : (
        <>
          {doPoprawy && (
            <div className="dok-wskazowka">
              Kliknij w dowolny fragment, żeby go poprawić. Zapis składa dokument od nowa
              i zastępuje plik, który zobaczy klient.
            </div>
          )}
          <div className={`dok-strona ${doPoprawy ? 'dok-strona-edytowalna' : ''}`}>
            {bloki.map((blok, i) => (
              <div
                key={i}
                className={`dok-blok ${aktywny === i ? 'dok-blok-otwarty' : ''}`}
                onClick={doPoprawy && aktywny !== i ? () => ustawAktywny(i) : undefined}
              >
                {aktywny === i ? (
                  <>
                    <div className="dok-blok-pasek">
                      <span className="dok-blok-rodzaj">{stan.rodzaje[blok.rodzaj] || blok.rodzaj}</span>
                      <span className="row-g">
                        <button className="btn btn-maly" onClick={() => przesunBlok(i, -1)} title="W górę">↑</button>
                        <button className="btn btn-maly" onClick={() => przesunBlok(i, 1)} title="W dół">↓</button>
                        <button className="btn btn-maly" onClick={() => dopiszAkapit(i)}>Akapit poniżej</button>
                        <button className="btn btn-maly btn-sygnal" onClick={() => usunBlok(i)}>Usuń</button>
                        <button className="btn btn-maly btn-glowny" onClick={() => ustawAktywny(null)}>Gotowe</button>
                      </span>
                    </div>
                    <BlokEdycja blok={blok} przyZmianie={(nowy) => zmienBlok(i, nowy)} />
                  </>
                ) : (
                  <BlokPodglad blok={blok} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/** „1 puste miejsce", „3 puste miejsca", „5 pustych miejsc" — polska odmiana. */
function opisPustychMiejsc(ile) {
  const ostatnia = ile % 10;
  const dwieOstatnie = ile % 100;
  if (ile === 1) return '1 puste miejsce';
  if (ostatnia >= 2 && ostatnia <= 4 && !(dwieOstatnie >= 12 && dwieOstatnie <= 14)) {
    return `${ile} puste miejsca`;
  }
  return `${ile} pustych miejsc`;
}

function PozycjaDokumentuKancelarii({ wniosekId, dokument, dlaKogo, przyOtwarciu }) {
  const podpisany = Boolean(dokument.podpis_nazwa_pliku);
  const stan = podpisSprawdzenia(dokument);
  return (
    <div className={`dokument-pozycja ${podpisany ? 'dokument-pozycja-gotowa' : ''}`}>
      <div className="dokument-pozycja-glowna">
        <Ikona nazwa="dokument" rozmiar={17} />
        <button type="button" className="dokument-pozycja-nazwa jak-odnosnik" onClick={przyOtwarciu}>
          {dokument.nazwa}
          {/* Oświadczenia wystawia się PO JEDNYM NA AKCJONARIUSZA, więc sama
              nazwa dokumentu powtarza się na liście tyle razy, ilu ich jest.
              Bez wskazania osoby nie da się rozróżnić, który jest który. */}
          {dlaKogo && <span className="dokument-pozycja-dla">{dlaKogo}</span>}
        </button>
        <span className="dokument-pozycja-rozmiar">
          {Math.max(1, Math.round((dokument.rozmiar || 0) / 1024))} kB
        </span>
      </div>

      <div className="dokument-pozycja-podpis">
        {dokument.udostepniono
          ? <Pigulka odmiana="neutralna">u klienta</Pigulka>
          : <Pigulka odmiana="mosiadz">nieudostępniony</Pigulka>}
        {/* Jeden znacznik na stan sprawdzenia, nie trzy: „sprawdzony" mówi, że
            ktoś dokument przeczytał, „podpis potwierdzony" — że sprawdził też
            odesłany skan. Ślad po poprawce treści zostaje osobno. */}
        {stan && <Pigulka odmiana="rejestr">{stan}</Pigulka>}
        {dokument.zmodyfikowano && <Pigulka odmiana="mosiadz">treść poprawiona</Pigulka>}
        {dokument.brakujace.length > 0 && (
          <Pigulka odmiana="sygnal">{opisPustychMiejsc(dokument.brakujace.length)}</Pigulka>
        )}
        {podpisany ? (
          <a
            className="dokument-pozycja-skan"
            href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}?egzemplarz=podpisany`}
            target="_blank"
            rel="noopener"
          >
            {dokument.podpis_nazwa_pliku}
          </a>
        ) : (
          <span className="dokument-pozycja-czeka">czeka na podpisany skan</span>
        )}
        <span className="row-g" style={{ marginLeft: 'auto' }}>
          {/* Jeden przycisk zamiast „Podgląd" i „Edytuj treść": dokument
              otwiera się do czytania, a poprawia się go w tym samym oknie,
              klikając w to, co wymaga poprawy. Po podpisaniu nie ma czego
              poprawiać — zostaje sprawdzenie obu egzemplarzy w PDF. */}
          <button className="btn btn-maly btn-glowny" onClick={przyOtwarciu}>
            {podpisany ? 'Sprawdź podpis' : 'Otwórz'}
          </button>
          <a
            className="btn btn-maly"
            href={`/api/psa/wnioski/${wniosekId}/dokumenty/${dokument.id}`}
            target="_blank"
            rel="noopener"
          >
            Pobierz
          </a>
        </span>
      </div>
    </div>
  );
}

function KrokDokumenty({ wniosek, akcjonariusze, dokumenty, ustawDokumenty, zablokowane, odswiez }) {
  const [praca, ustawPrace] = useState(null); // 'wystaw' | 'udostepnij'
  const [komunikat, ustawKomunikat] = useState(null);
  const [blad, ustawBlad] = useState(null);
  const [otwarty, ustawOtwarty] = useState(null);

  const wystawione = dokumenty.length > 0;
  const doUdostepnienia = dokumenty.filter((d) => !d.udostepniono).length;
  const podpisanych = dokumenty.filter((d) => d.podpis_nazwa_pliku).length;
  const potwierdzonych = dokumenty.filter((d) => d.podpis_potwierdzono).length;
  const sprawdzonych = dokumenty.filter((d) => d.sprawdzono).length;
  const pustychMiejsc = dokumenty.reduce((suma, d) => suma + d.brakujace.length, 0);

  async function wystaw() {
    if (wystawione && !window.confirm(
      'Wystawić komplet od nowa? Dotychczasowe dokumenty i odesłane przez klienta skany zostaną zastąpione.'
    )) return;
    ustawPrace('wystaw');
    ustawBlad(null);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/dokumenty/wystaw`, {});
      ustawDokumenty(wynik.dokumenty);
      ustawKomunikat({
        odmiana: 'ok',
        tresc: `Wystawiono ${wynik.dokumenty.length} dokumentów. Przeczytaj je i popraw treść, zanim udostępnisz je klientowi.`,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wystawić dokumentów.');
    } finally {
      ustawPrace(null);
    }
  }

  async function udostepnij() {
    ustawPrace('udostepnij');
    ustawBlad(null);
    ustawKomunikat(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/dokumenty/udostepnij`, {});
      ustawDokumenty(wynik.dokumenty);
      ustawKomunikat({
        odmiana: wynik.email_wyslany ? 'ok' : 'uwaga',
        tresc: wynik.email_wyslany
          ? 'Dokumenty są w portalu klienta. Powiadomienie e-mail zostało wysłane.'
          : `Dokumenty są w portalu klienta, ale powiadomienia nie udało się wysłać: ${wynik.powod} Napisz do klienta innym kanałem.`,
      });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się udostępnić dokumentów.');
    } finally {
      ustawPrace(null);
    }
  }

  return (
    <Karta
      tytul="Komplet dokumentów do podpisu"
      akcje={!zablokowane && (
        <div className="row-g">
          <button className="btn btn-maly" onClick={wystaw} disabled={praca !== null}>
            {praca === 'wystaw' ? 'Wystawianie…' : wystawione ? 'Wystaw od nowa' : 'Wystaw komplet'}
          </button>
          {wystawione && doUdostepnienia > 0 && (
            <button className="btn btn-maly btn-glowny" onClick={udostepnij} disabled={praca !== null}>
              {praca === 'udostepnij' ? 'Udostępnianie…' : 'Udostępnij klientowi'}
            </button>
          )}
        </div>
      )}
    >
      {komunikat && <Komunikat odmiana={komunikat.odmiana} tresc={komunikat.tresc} />}
      <Komunikat odmiana="blad" tresc={blad} />

      {!wystawione ? (
        <Pusto
          ikona="dokument"
          tytul="Komplet nie został jeszcze wystawiony"
          opis="Sprawdź dane spółki i akcjonariuszy, a potem wystaw dokumenty. Klient zobaczy je dopiero po udostępnieniu."
        />
      ) : (
        <>
          <Metryka
            pozycje={[
              { etykieta: 'Dokumentów', wartosc: dokumenty.length, dane: true },
              { etykieta: 'Sprawdzonych', wartosc: `${sprawdzonych} / ${dokumenty.length}`, dane: true },
              { etykieta: 'Podpisanych', wartosc: `${podpisanych} / ${dokumenty.length}`, dane: true },
              { etykieta: 'Podpis potwierdzony', wartosc: `${potwierdzonych} / ${dokumenty.length}`, dane: true },
              pustychMiejsc > 0 ? { etykieta: 'Pustych miejsc', wartosc: pustychMiejsc, dane: true } : null,
            ]}
          />

          {doUdostepnienia > 0 && (
            <Komunikat
              odmiana="uwaga"
              tytul="Klient jeszcze tego nie widzi"
              tresc={`${doUdostepnienia} z ${dokumenty.length} pozycji czeka na udostępnienie. Otwórz je, popraw treść, gdzie trzeba, i dopiero wtedy wpuść komplet do portalu.`}
            />
          )}

          {doUdostepnienia === 0 && podpisanych > 0 && potwierdzonych < dokumenty.length && (
            <Komunikat
              odmiana="uwaga"
              tytul="Podpisy czekają na sprawdzenie"
              tresc={`Potwierdzono ${potwierdzonych} z ${dokumenty.length} podpisów. Otwórz każdą pozycję, obejrzyj odesłany skan i oznacz podpis jako prawidłowy — bez tego wniosku nie da się przyjąć.`}
            />
          )}

          <div className="lista-dokumentow">
            {dokumenty.map((d) => (
              <PozycjaDokumentuKancelarii
                key={d.id}
                wniosekId={wniosek.id}
                dokument={d}
                dlaKogo={d.akcjonariusz_id
                  ? nazwaPozycji(akcjonariusze.find((a) => a.id === d.akcjonariusz_id) || {})
                  : null}
                przyOtwarciu={() => ustawOtwarty(d)}
              />
            ))}
          </div>
        </>
      )}

      {otwarty && (
        <OknoDokumentu
          wniosekId={wniosek.id}
          dokument={dokumenty.find((d) => d.id === otwarty.id) || otwarty}
          zablokowane={zablokowane}
          przyZamknieciu={() => ustawOtwarty(null)}
          przyZapisie={(lista) => ustawDokumenty(lista)}
        />
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   KROK 4 — DECYZJA
   ───────────────────────────────────────────────────── */

function KrokDecyzja({ wniosek, akcjonariusze, dokumenty, zablokowane, odswiez }) {
  const [notatka, ustawNotatka] = useState('');
  const [pokazNotatke, ustawPokazNotatke] = useState(null); // 'do_uzupelnienia' | 'odrzuc' | null
  const [przetwarzanie, ustawPrzetwarzanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const wszystkoZweryfikowane = akcjonariusze.length > 0 && akcjonariusze.every((a) => a.zweryfikowano);
  const niezweryfikowani = akcjonariusze.filter((a) => !a.zweryfikowano).length;
  const bezPotwierdzenia = dokumenty.filter((d) => !d.podpis_potwierdzono).length;
  const podpisySprawdzone = dokumenty.length > 0 && bezPotwierdzenia === 0;

  async function wyslijNotatke(akcja) {
    if (!notatka.trim()) {
      ustawBlad('Podaj notatkę — klient musi wiedzieć, czego dotyczy decyzja.');
      return;
    }
    ustawPrzetwarzanie(true);
    ustawBlad(null);
    try {
      await API.post(`/api/psa/wnioski/${wniosek.id}/${akcja}`, { notatka });
      ustawPokazNotatke(null);
      ustawNotatka('');
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wykonać operacji.');
    } finally {
      ustawPrzetwarzanie(false);
    }
  }

  async function przyjmij() {
    if (!window.confirm('Przyjąć wniosek? Założy to spółkę i akcjonariuszy w kartotece — operacji nie da się cofnąć z tego ekranu.')) return;
    ustawPrzetwarzanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post(`/api/psa/wnioski/${wniosek.id}/przyjmij`, {});
      odswiez();
      if (wynik.spolka_id) {
        window.alert('Wniosek przyjęty. Spółka i akcjonariusze założeni w kartotece — dokończ otwarcie rejestru (emisja założycielska i checklista) na ekranie poniżej.');
      }
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się przyjąć wniosku.');
    } finally {
      ustawPrzetwarzanie(false);
    }
  }

  if (zablokowane) {
    return (
      <Karta tytul="Decyzja kancelarii">
        <Komunikat
          odmiana={wniosek.status === 'przyjety' ? 'ok' : 'blad'}
          tytul={wniosek.status === 'przyjety' ? 'Wniosek przyjęty' : 'Wniosek odrzucony'}
          tresc={wniosek.notatka_weryfikacji || 'Sprawa jest zamknięta — decyzji nie da się cofnąć z tego ekranu.'}
        />
      </Karta>
    );
  }

  const gotowyDoPrzyjecia = wniosek.status === 'umowa_podpisana'
    && wszystkoZweryfikowane && podpisySprawdzone;

  return (
    <Karta tytul="Decyzja kancelarii">
      <Komunikat odmiana="blad" tresc={blad} />

      <dl className="podsumowanie">
        <dt>Stan wniosku</dt>
        <dd>{(STAN_WNIOSKU[wniosek.status] || {}).etykieta || wniosek.status}</dd>
        <dt>Weryfikacja akcjonariuszy</dt>
        <dd>
          {akcjonariusze.length === 0
            ? <span className="brak">brak pozycji</span>
            : niezweryfikowani === 0
              ? `wszystkie ${akcjonariusze.length} pozycji zweryfikowane`
              : `${niezweryfikowani} z ${akcjonariusze.length} czeka na weryfikację`}
        </dd>
        <dt>Podpisy pod dokumentami</dt>
        <dd>
          {dokumenty.length === 0
            ? <span className="brak">nie wystawiono jeszcze dokumentów</span>
            : bezPotwierdzenia === 0
              ? `wszystkie ${dokumenty.length} podpisy potwierdzone`
              : `${bezPotwierdzenia} z ${dokumenty.length} czeka na sprawdzenie`}
        </dd>
      </dl>

      {!gotowyDoPrzyjecia && (
        <Komunikat
          odmiana="info"
          tresc={wniosek.status !== 'umowa_podpisana'
            ? 'Przyjęcie wniosku wymaga, żeby klient odesłał podpisaną umowę o prowadzenie rejestru.'
            : !wszystkoZweryfikowane
              ? 'Zweryfikuj wszystkie pozycje akcjonariuszy (krok „Akcjonariusze”), zanim przyjmiesz wniosek.'
              : 'Otwórz każdy dokument (krok „Dokumenty”), obejrzyj odesłany skan i oznacz podpis jako prawidłowy.'}
        />
      )}

      <div className="row-g" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => ustawPokazNotatke(pokazNotatke === 'do_uzupelnienia' ? null : 'do_uzupelnienia')}>
          Odeślij do uzupełnienia
        </button>
        <button className="btn btn-sygnal" onClick={() => ustawPokazNotatke(pokazNotatke === 'odrzuc' ? null : 'odrzuc')}>
          Odrzuć wniosek
        </button>
        <button className="btn btn-glowny" onClick={przyjmij} disabled={przetwarzanie || !gotowyDoPrzyjecia}>
          Przyjmij wniosek
        </button>
      </div>

      {pokazNotatke && (
        <div className="pion" style={{ gap: 8, marginTop: 'var(--od-16)' }}>
          <Pole
            etykieta={pokazNotatke === 'odrzuc' ? 'Powód odrzucenia' : 'Co klient ma poprawić'}
            wymagane
            podpowiedz="Notatkę zobaczy klient w portalu, nad formularzem wniosku."
          >
            <textarea rows={4} value={notatka} onChange={(z) => ustawNotatka(z.target.value)} />
          </Pole>
          <button
            className={`btn ${pokazNotatke === 'odrzuc' ? 'btn-sygnal' : 'btn-glowny'}`}
            style={{ alignSelf: 'flex-start' }}
            onClick={() => wyslijNotatke(pokazNotatke === 'odrzuc' ? 'odrzuc' : 'do-uzupelnienia')}
            disabled={przetwarzanie}
          >
            {przetwarzanie
              ? 'Zapisywanie…'
              : pokazNotatke === 'odrzuc' ? 'Potwierdź odrzucenie' : 'Odeślij do uzupełnienia'}
          </button>
        </div>
      )}
    </Karta>
  );
}

/* ─────────────────────────────────────────────────────
   EKRAN WNIOSKU
   ───────────────────────────────────────────────────── */

const ZAKLADKI_WNIOSKU = [
  { kod: 'spolka', nazwa: 'Dane spółki' },
  { kod: 'akcjonariusze', nazwa: 'Akcjonariusze' },
  { kod: 'dokumenty', nazwa: 'Dokumenty' },
  { kod: 'decyzja', nazwa: 'Decyzja' },
];

function EkranWniosekSzczegoly({ wniosekId }) {
  const { dane, ladowanie, odswiez } = useDane(`/api/psa/wnioski/${wniosekId}`);
  const [zakladka, ustawZakladke] = useParametrAdresu('zakladka', 'spolka');
  // Lista dokumentów zmienia się częściej niż reszta wniosku (wystawienie,
  // poprawka treści, udostępnienie), więc żyje osobno — inaczej każda z tych
  // czynności ciągnęłaby ze sobą ponowne odpytanie KRS.
  const [dokumenty, ustawDokumenty] = useState(null);

  useEffect(() => {
    if (dane && dane.dokumenty) ustawDokumenty(dane.dokumenty);
  }, [dane]);

  if (ladowanie || !dane) return <Spinner />;
  const { wniosek, akcjonariusze, krs } = dane;
  const brakiUstawowe = dane.braki_ustawowe || {};
  const zablokowane = ['przyjety', 'odrzucony'].includes(wniosek.status);
  const lista = dokumenty || [];
  const niezweryfikowani = akcjonariusze.filter((a) => !a.zweryfikowano).length;

  return (
    <div className="pion" style={{ gap: 16 }}>
      <div className="okruszki bez-druku">
        <button onClick={() => idz('/wnioski')}>Wnioski</button>
        <Ikona nazwa="strzalkaPrawo" rozmiar={13} />
        <span>{wniosek.nazwa || `Wniosek #${wniosek.id}`}</span>
      </div>

      <NaglowekStrony
        tytul={wniosek.nazwa || `Wniosek #${wniosek.id}`}
        kontekst={<>Klient: {wniosek.konto_email}</>}
        akcje={<ZnacznikWniosku status={wniosek.status} />}
      />

      <Metryka
        pozycje={[
          { etykieta: 'KRS', wartosc: wniosek.krs, dane: true },
          { etykieta: 'Akcjonariusze', wartosc: akcjonariusze.length, dane: true },
          { etykieta: 'Dokumenty', wartosc: lista.length, dane: true },
          { etykieta: 'Zaktualizowano', wartosc: fmt.dataCzas(wniosek.zaktualizowano || wniosek.utworzono) },
        ]}
      />

      {wniosek.notatka_weryfikacji && (
        <Komunikat odmiana="uwaga" tytul="Ostatnia notatka kancelarii" tresc={wniosek.notatka_weryfikacji} />
      )}

      {wniosek.spolka_id && (
        <Komunikat
          odmiana="ok"
          tresc={<>Wniosek dowiązany do spółki w kartotece. <a href={`#/spolki/${wniosek.spolka_id}/otworz`}>Dokończ otwarcie rejestru</a> — ta sama checklista, co przy spółce zakładanej wewnętrznie (Z-005).</>}
        />
      )}

      <Zakladki
        zakladki={ZAKLADKI_WNIOSKU.map((z) => ({
          ...z,
          licznik: z.kod === 'akcjonariusze'
            ? (niezweryfikowani || null)
            : z.kod === 'dokumenty' ? (lista.filter((d) => !d.udostepniono).length || null) : null,
        }))}
        biezaca={zakladka}
        przyZmianie={ustawZakladke}
      />

      {zakladka === 'spolka' && (
        <KrokDaneSpolki wniosek={wniosek} krs={krs} zablokowane={zablokowane} odswiez={odswiez} />
      )}
      {zakladka === 'akcjonariusze' && (
        <KrokAkcjonariusze
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          brakiUstawowe={brakiUstawowe}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
      {zakladka === 'dokumenty' && (
        <KrokDokumenty
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          dokumenty={lista}
          ustawDokumenty={ustawDokumenty}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
      {zakladka === 'decyzja' && (
        <KrokDecyzja
          wniosek={wniosek}
          akcjonariusze={akcjonariusze}
          dokumenty={lista}
          zablokowane={zablokowane}
          odswiez={odswiez}
        />
      )}
    </div>
  );
}

window.EkranWnioski = EkranWnioski;
window.EkranWniosekSzczegoly = EkranWniosekSzczegoly;
