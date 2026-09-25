/* osoby.js — kartoteka wspólna (reguła domenowa nr 10).
   `parsujPesel` żyje w pesel.js (etap 3D - portal.html go też potrzebuje,
   bez ładowania całego osoby.js), wczytanym wcześniej w index.html. */

const PUSTA_OSOBA = {
  typ: 'fizyczna',
  nazwisko: '', imie: '', nazwa: '', plec: '',
  pesel: '', data_urodzenia: '',
  nip: '', regon: '', numer_w_rejestrze: '', nazwa_rejestru: '',
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
  // Naprawa Z-151/P-010: domyslnie NIEUSTALONO, nie „nie” — nikt jeszcze
  // nie ocenil tej osoby, a to nie to samo, co swiadome „nie jest PEP”.
  pep: 'nieustalono', pep_opis: '',
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

/**
 * Naprawa Z-006/P-004 — zaproszenie akcjonariusza do portalu, akcja przy
 * osobie w kartotece (widoczna tylko, gdy osoba JEST akcjonariuszem
 * przynajmniej jednej spółki — `spolkiOsoby` z `GET /:id/spolki`).
 * E-mail operacyjny konta jest ODRĘBNY od e-maila w treści rejestru
 * (`dane.email` na formularzu wyżej, wymaga osobnej zgody — Z-157), więc
 * podpowiadamy go tylko jako punkt startowy, nie podstawiamy automatycznie.
 */
function SekcjaZaproszeniaPortal({ osobaId, emailPodpowiedz }) {
  const [email, ustawEmail] = useState(emailPodpowiedz || '');
  const [wysylanie, ustawWysylanie] = useState(false);
  const [wynik, ustawWynik] = useState(null);
  const [blad, ustawBlad] = useState(null);

  async function zapros() {
    ustawWysylanie(true);
    ustawBlad(null);
    ustawWynik(null);
    try {
      const odpowiedz = await API.post(`/api/psa/osoby/${osobaId}/zapros-do-portalu`, { email });
      ustawWynik(odpowiedz);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawWysylanie(false);
    }
  }

  return (
    <Pole
      etykieta="Zaproszenie do portalu"
      podpowiedz="Adres OPERACYJNY konta portalowego — niezależny od e-maila w rejestrze i jego zgody (pole „Adres e-mail” wyżej)."
    >
      <div className="rzad" style={{ gap: 8 }}>
        <input type="text" value={email} onChange={(z) => ustawEmail(z.target.value)} placeholder="adres@przyklad.pl" style={{ flex: 1 }} />
        <button className="btn btn-maly btn-glowny" onClick={zapros} disabled={!email.trim() || wysylanie}>
          {wysylanie ? 'Wysyłanie…' : 'Zaproś do portalu'}
        </button>
      </div>
      <Komunikat odmiana="blad" tresc={blad} />
      {wynik && wynik.juz_aktywne && (
        <Komunikat odmiana="info" tresc="Konto na ten adres jest już aktywne — akcjonariusz ma się jak zalogować, nie trzeba nowego zaproszenia." />
      )}
      {wynik && !wynik.juz_aktywne && wynik.email_wyslany && (
        <Komunikat odmiana="ok" tresc="Zaproszenie wysłane e-mailem." />
      )}
      {wynik && !wynik.juz_aktywne && !wynik.email_wyslany && wynik.link_aktywacyjny && (
        <Komunikat
          odmiana="uwaga"
          tresc={<>Wysyłka e-mail nie jest skonfigurowana — przekaż link ręcznie: <code>{wynik.link_aktywacyjny}</code></>}
        />
      )}
    </Pole>
  );
}

/**
 * Kartoteka: dane osoby w PANELU BOCZNYM (formularz dłuższy niż 4 pola nie
 * jest modalem — FAZA 1 pkt 5). Pola wspólne z wnioskiem klienta renderuje
 * `FormularzOsoby` (formularz-osoby.js); tu dochodzą wyłącznie dane
 * kancelarii: AML, PEP, beneficjent, notatki wewnętrzne.
 *
 * `przyWyborzeIstniejacej` — gdy panel otwiera wybór z kartoteki, a wpisany
 * PESEL / NIP / KRS należy już do kogoś, można wybrać tę osobę zamiast
 * zakładać drugą (reguła domenowa nr 10, D-042).
 */
function PanelOsoby({ osoba, przyZamknieciu, przyZapisie, przyWyborzeIstniejacej }) {
  const [dane, ustawDane] = useState(() => osobaDoFormularza(osoba, PUSTA_OSOBA));
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [brakiPokazane, ustawBrakiPokazane] = useState(false);
  const edycja = Boolean(osoba && osoba.id);
  const walidacja = useWalidacjaOsoby(dane, { tryb: 'kancelaria' });
  const idPrefiks = 'kartoteka';
  const poczatkowe = useRef(JSON.stringify(dane));
  const zmienione = () => JSON.stringify(dane) !== poczatkowe.current;
  useBlokadaWyjscia(() => zmienione() && !zapisywanie);
  function anuluj() {
    if (zmienione() && !window.confirm('Zamknąć bez zapisania wprowadzonych danych?')) return;
    przyZamknieciu();
  }

  // Etap 3.1: procedura AML (skan/PEP/beneficjent) jest wlaczana PER SPOLKA,
  // a osoba (kartoteka wspolna) moze byc akcjonariuszem w kilku - wybor
  // "kontekstu" decyduje, ktorej spolki przelacznik gate'uje ten formularz.
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

  const zmien = (latka) => ustawDane((p) => ({ ...p, ...latka }));
  const pole = (klucz) => ({
    value: dane[klucz] ?? '',
    onChange: (z) => zmien({ [klucz]: z.target.value }),
  });

  // Ten sam PESEL / NIP / numer KRS już w kartotece — pokazujemy to PRZY
  // polu, z możliwością wybrania istniejącej osoby (D-042: ostrzeżenie, nie
  // blokada — ta sama osoba bywa w wielu spółkach, ale ma mieć jeden rekord).
  const [kolizje, ustawKolizje] = useState({});
  const identyfikatory = { pesel: dane.typ !== 'prawna' ? dane.pesel : '', nip: dane.typ === 'prawna' ? dane.nip : '', numer_w_rejestrze: dane.typ === 'prawna' ? dane.numer_w_rejestrze : '' };
  const sygnaturaId = JSON.stringify(identyfikatory);
  useEffect(() => {
    const uchwyt = setTimeout(() => {
      const wynik = {};
      const zapytania = Object.entries(identyfikatory)
        .filter(([k, v]) => v && (k === 'pesel' ? /^\d{11}$/.test(v) : String(v).replace(/\D/g, '').length >= 9))
        .map(([k, v]) => API.get(`/api/psa/osoby?q=${encodeURIComponent(v)}`)
          .then((o) => {
            const inna = o.osoby.find((x) => String(x[k] || '') === String(v) && (!edycja || x.id !== osoba.id));
            if (inna) wynik[k] = inna;
          })
          .catch(() => {}));
      Promise.all(zapytania).then(() => ustawKolizje(wynik));
    }, 300);
    return () => clearTimeout(uchwyt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sygnaturaId]);

  const ostrzezeniaIdentyfikatora = Object.fromEntries(Object.entries(kolizje).map(([k, inna]) => [k, (
    <div className="kolizja-kartoteki" role="status" key={k}>
      <span>W kartotece jest już <strong>{inna.oznaczenie}</strong> z tym numerem.</span>
      {przyWyborzeIstniejacej
        ? <button type="button" className="btn btn-maly" onClick={() => przyWyborzeIstniejacej(inna)}>Wybierz tę osobę</button>
        : <a href={`#/osoby/${inna.id}`} onClick={przyZamknieciu}>Otwórz jej dane</a>}
    </div>
  )]));

  async function zapisz(mimoBrakow = false) {
    if (!walidacja.czyPoprawne && !mimoBrakow) {
      walidacja.pokazWszystkie();
      ustawBrakiPokazane(true);
      return;
    }
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

  const listaBledow = listaBledowOsoby(walidacja.widoczne, idPrefiks);
  return (
    <Modal
      panel
      tytul={edycja ? 'Dane osoby' : 'Nowa osoba w kartotece'}
      przyZamknieciu={anuluj}
      stopka={
        <>
          <button type="button" className="btn" onClick={anuluj}>Anuluj</button>
          <button type="button" className="btn btn-glowny" onClick={() => zapisz(false)} disabled={zapisywanie}>
            {zapisywanie ? 'Zapisywanie…' : edycja ? 'Zapisz zmiany' : 'Dodaj do kartoteki'}
          </button>
        </>
      }
    >
      {brakiPokazane && listaBledow.length > 0 && (
        <>
          <PodsumowanieBledow bledy={listaBledow} tytul="Brakuje danych potrzebnych do wpisu" />
          <p className="male wyciszony" style={{ marginTop: 'calc(-1 * var(--od-8))' }}>
            Osobę można zapisać także bez kompletu — braki wrócą jako przeszkoda przy wpisie.{' '}
            <button type="button" className="btn-tekstowy" onClick={() => zapisz(true)} disabled={zapisywanie}>
              Zapisz mimo braków
            </button>
          </p>
        </>
      )}
      <Komunikat odmiana="blad" tresc={blad} />

      <FormularzOsoby
        dane={dane}
        przyZmianie={zmien}
        tryb="kancelaria"
        bledy={walidacja.widoczne}
        przyOpuszczeniu={walidacja.dotknij}
        idPrefiks={idPrefiks}
        ostrzezeniaIdentyfikatora={ostrzezeniaIdentyfikatora}
      />

      <div className="rozdzielacz" />
      <h3 className="grupa-pol-legenda">Dane kancelarii — nie trafiają do portalu ani na wydruki dla klienta</h3>

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
          <PoleDaty wartosc={dane.aml_data || ''} przyZmianie={(v) => zmien({ aml_data: v })} />
        </Pole>
      </div>
      <div className="siatka-2">
        <Pole etykieta="Data ostatniego przeglądu AML" podpowiedz="Przegląd okresowy co 12 miesięcy — nie blokuje wpisu, jest tylko przypomnieniem.">
          <PoleDaty wartosc={dane.aml_data_przegladu || ''} przyZmianie={(v) => zmien({ aml_data_przegladu: v })} />
        </Pole>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
          <ZnacznikPrzegladuAml wymaga={edycja && osoba.wymaga_przegladu_aml} />
        </div>
      </div>
      {/* Status PEP jest DANĄ osoby, nie tylko treścią oświadczenia: wobec
          osoby zajmującej eksponowane stanowisko polityczne kancelaria
          stosuje wzmożone środki bezpieczeństwa finansowego, więc musi go
          widzieć na ekranie, a nie odczytywać z papieru w aktach.

          Naprawa Z-151/P-010: trzy stany, nie przełącznik — „nieustalono”
          (nikt jeszcze nie ocenił) musi wyglądać INACZEJ niż świadome „nie
          jest PEP”, inaczej niesprawdzona osoba wygląda tak samo jak
          sprawdzona. */}
      <Pole
        etykieta="Eksponowane stanowisko polityczne (PEP)"
        podpowiedz="Osoba pełniąca znaczącą funkcję publiczną, członek jej rodziny albo bliski współpracownik — ustawa o przeciwdziałaniu praniu pieniędzy. Wobec takiej osoby stosuje się WZMOŻONE środki bezpieczeństwa finansowego. To OCENA KANCELARII, nie oświadczenie osoby (patrz pole niżej)."
      >
        <select
          value={dane.pep || 'nieustalono'}
          onChange={(z) => {
            const v = z.target.value;
            zmien({ pep: v, pep_opis: ['tak', 'rodzina', 'wspolpracownik'].includes(v) ? dane.pep_opis : '' });
          }}
        >
          <option value="nieustalono">Nieustalono</option>
          <option value="nie">Nie jest PEP</option>
          <option value="tak">Zajmuje eksponowane stanowisko polityczne</option>
          <option value="rodzina">Jest członkiem rodziny takiej osoby</option>
          <option value="wspolpracownik">Jest bliskim współpracownikiem takiej osoby</option>
        </select>
      </Pole>
      {['tak', 'rodzina', 'wspolpracownik'].includes(dane.pep) && (
        <Pole
          etykieta={dane.pep === 'tak' ? 'Stanowisko lub funkcja' : 'Osoba i charakter relacji'}
          wymagane
          podpowiedz="Trafia wprost do oświadczenia AML przygotowanego do podpisu."
        >
          <input type="text" {...pole('pep_opis')} />
        </Pole>
      )}

      <Pole etykieta="Notatka AML" podpowiedz="Nigdy nie trafia na wydruki dla klienta.">
        <textarea {...pole('aml_notatka')} style={{ minHeight: 70 }} />
      </Pole>

      {edycja && spolkiOsoby.length > 0 && (
        <SekcjaZaproszeniaPortal osobaId={osoba.id} emailPodpowiedz={dane.email} />
      )}

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
              <WyborZKartoteki
                wartosc={dane.beneficjent_rzeczywisty_id}
                przyZmianie={(id) => zmien({ beneficjent_rzeczywisty_id: id })}
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
                przyZmianie={(v) => zmien({ pep_oswiadczenie_data: v })}
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
  const [szukaj, ustawSzukaj] = useParametrAdresu('q', '');
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
                    <div className="row-g" style={{ gap: 8 }}>
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
        <PanelOsoby
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

window.PanelOsoby = PanelOsoby;
window.EkranOsob = EkranOsob;
