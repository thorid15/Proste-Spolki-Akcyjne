/* dokumenty-na-zadanie.js — pięć wzorów wystawianych na żądanie ze spółki
   (blok A5 sesji 8): umowa, RODO, uchwała, lista dla sądu, klauzula zbycia.

   Nie idą automatem — notariusz wybiera wzór, ewentualnie dopisuje dane,
   których nie ma w rejestrze (np. wynik głosowania nad uchwałą), i albo
   ogląda podgląd na REALNYCH danych spółki, albo od razu wystawia. */

const OPISY_PODPOWIEDZI_WZOROW = {
  '01': 'Dane spółki, reprezentanta i stawek pobierają się same z kartoteki i konfiguracji.',
  '02': 'W całości automatyczny — kancelaria i forma podpisu reprezentanta.',
  '03': 'Wynik głosowania nie ma miejsca w rejestrze (to nie jest zdarzenie rejestrowe) — wpisz go poniżej.',
  '08': 'Adresatem jest sąd rejestrowy spółki. Adres sądu nie jest w rejestrze — możesz go wpisać poniżej.',
  '10': 'Wskaż zbywcę i nabywcę z kartoteki oraz treść klauzuli dotyczącej tej konkretnej transakcji.',
  '04': 'W całości automatyczny — dane żądającego, podstawa wpisu i załączniki pochodzą z tej sprawy.',
};

/** Pola ad hoc dla wzoru 03 (uchwała) — dane głosowania, którego rejestr nie przechowuje. */
function PolaUchwaly({ uchwala, ustawUchwale }) {
  const pole = (klucz) => ({
    value: uchwala[klucz] ?? '',
    onChange: (z) => ustawUchwale((p) => ({ ...p, [klucz]: z.target.value })),
  });
  return (
    <>
      <div className="siatka-2">
        <Pole etykieta="Numer uchwały"><input type="text" {...pole('numer')} /></Pole>
        <Pole etykieta="Data (słownie)" podpowiedz="np. „12 sierpnia 2026 roku”"><input type="text" {...pole('dataSlownie')} /></Pole>
      </div>
      <Pole etykieta="Tryb głosowania"><input type="text" {...pole('trybGlosowania')} placeholder="np. jednogłośnie" /></Pole>
      <div className="siatka-3">
        <Pole etykieta="Głosy za"><input type="number" min="0" {...pole('glosyZa')} /></Pole>
        <Pole etykieta="Głosy przeciw"><input type="number" min="0" {...pole('glosyPrzeciw')} /></Pole>
        <Pole etykieta="Głosy wstrzymujące"><input type="number" min="0" {...pole('glosyWstrzymujace')} /></Pole>
      </div>
      <Pole etykieta="Procent głosów" podpowiedz="np. „100%”"><input type="text" {...pole('procentGlosow')} /></Pole>
    </>
  );
}

/** Pola ad hoc dla wzoru 08 (lista dla sądu) — adres sądu, którego rejestr nie przechowuje. */
function PolaListySadu({ adresat, ustawAdresat }) {
  return (
    <div className="siatka-2">
      <Pole etykieta="Nazwa sądu (opcjonalnie)" podpowiedz="Domyślnie sąd rejestrowy spółki.">
        <input type="text" value={adresat.nazwa} onChange={(z) => ustawAdresat((p) => ({ ...p, nazwa: z.target.value }))} />
      </Pole>
      <Pole etykieta="Adres sądu (opcjonalnie)">
        <input type="text" value={adresat.adres} onChange={(z) => ustawAdresat((p) => ({ ...p, adres: z.target.value }))} />
      </Pole>
    </div>
  );
}

/** Pola ad hoc dla wzoru 10 (klauzula zbycia) — strony i treść KONKRETNEJ transakcji. */
function PolaKlauzuli({ klauzula, ustawKlauzule, zbywcaId, ustawZbywce, nabywcaId, ustawNabywce }) {
  const pole = (klucz) => ({
    value: klauzula[klucz] ?? '',
    onChange: (z) => ustawKlauzule((p) => ({ ...p, [klucz]: z.target.value })),
  });
  return (
    <>
      <div className="siatka-2">
        <Pole etykieta="Zbywca"><WyborOsoby wartosc={zbywcaId} przyZmianie={ustawZbywce} /></Pole>
        <Pole etykieta="Nabywca"><WyborOsoby wartosc={nabywcaId} przyZmianie={ustawNabywce} wyklucz={zbywcaId ? [zbywcaId] : []} /></Pole>
      </div>
      <Pole etykieta="Numer paragrafu"><input type="text" {...pole('paragraf')} placeholder="np. 7" /></Pole>
      <Pole etykieta="Oświadczenie o pokryciu"><input type="text" {...pole('pokrycie')} placeholder="np. zostały w całości pokryte" /></Pole>
      <Pole etykieta="Ograniczenia rozporządzania"><input type="text" {...pole('ograniczenia')} placeholder="np. brak" /></Pole>
    </>
  );
}

/**
 * `bazowyUrl` domyślnie wskazuje na wzory wystawiane ZE SPÓŁKI (blok A5);
 * ekran sprawy (wzór 04, blok A7) podaje `/api/psa/sprawy/:id` zamiast.
 * `kontekstNazwa` to tylko etykieta w podglądzie ("na realnych danych …").
 */
function ModalWystawDokumentu({ spolkaId, bazowyUrl, kontekstNazwa = 'spółki', przyZamknieciu }) {
  const url = bazowyUrl || `/api/psa/spolki/${spolkaId}`;
  const { dane: lista, ladowanie: ladowanieListy } = useDane(`${url}/dokumenty/wystaw`);
  const [kod, ustawKod] = useState(null);
  const [uchwala, ustawUchwale] = useState({});
  const [adresat, ustawAdresat] = useState({ nazwa: '', adres: '' });
  const [klauzula, ustawKlauzule] = useState({});
  const [zbywcaId, ustawZbywce] = useState(null);
  const [nabywcaId, ustawNabywce] = useState(null);
  const [podglad, ustawPodglad] = useState(null);
  const [wystawiony, ustawWystawiony] = useState(null);
  const [ladowanie, ustawLadowanie] = useState(false);
  const [blad, ustawBlad] = useState(null);

  function cialoZadania() {
    if (kod === '03') return { uchwala };
    if (kod === '08') return { adresat_nazwa: adresat.nazwa || null, adresat_adres: adresat.adres || null };
    if (kod === '10') return { klauzula, zbywca_osoba_id: zbywcaId, nabywca_osoba_id: nabywcaId };
    return {};
  }

  async function pokazPodglad() {
    ustawLadowanie(true);
    ustawBlad(null);
    try {
      ustawPodglad(await API.post(`${url}/dokumenty/${kod}/podglad`, cialoZadania()));
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawLadowanie(false);
    }
  }

  async function wystaw() {
    ustawLadowanie(true);
    ustawBlad(null);
    try {
      ustawWystawiony(await API.post(`${url}/dokumenty/${kod}`, cialoZadania()));
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawLadowanie(false);
    }
  }

  function wrocDoListy() {
    ustawKod(null);
    ustawPodglad(null);
    ustawWystawiony(null);
    ustawBlad(null);
  }

  if (wystawiony) {
    return (
      <Modal tytul="Dokument wystawiony" przyZamknieciu={przyZamknieciu} stopka={<button className="btn btn-glowny" onClick={przyZamknieciu}>Zamknij</button>}>
        <Komunikat odmiana="ok" tresc="Plik zapisany i gotowy do pobrania." />
        {wystawiony.brakujace.length > 0 && (
          <Komunikat odmiana="uwaga" tytul="Do sprawdzenia — puste pola w piśmie" lista={wystawiony.brakujace} />
        )}
        <a className="btn btn-glowny" href={`${url}/wydane/${wystawiony.id}/plik`}>
          Pobierz plik .docx
        </a>
      </Modal>
    );
  }

  if (!kod) {
    return (
      <Modal tytul="Wystaw dokument" przyZamknieciu={przyZamknieciu} stopka={<button className="btn" onClick={przyZamknieciu}>Anuluj</button>}>
        {ladowanieListy ? (
          <Spinner />
        ) : (
          <div className="lista-wierszy">
            {(lista.wzory || []).map((w) => (
              <button key={w.kod} className="wiersz-wyboru" onClick={() => ustawKod(w.kod)}>
                <span className="kol-dane">{w.kod}</span>
                <span>{w.nazwa}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    );
  }

  const nazwaWzoru = (lista.wzory || []).find((w) => w.kod === kod)?.nazwa || kod;

  return (
    <Modal
      tytul={nazwaWzoru}
      przyZamknieciu={przyZamknieciu}
      szerokosc={720}
      stopka={
        <>
          <button className="btn" onClick={wrocDoListy}>Wstecz</button>
          <button className="btn" onClick={pokazPodglad} disabled={ladowanie}>
            {ladowanie ? 'Składanie…' : 'Podgląd'}
          </button>
          <button className="btn btn-glowny" onClick={wystaw} disabled={ladowanie}>
            {ladowanie ? 'Wystawianie…' : 'Wystaw'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Komunikat odmiana="info" tresc={OPISY_PODPOWIEDZI_WZOROW[kod]} />

      {kod === '03' && <PolaUchwaly uchwala={uchwala} ustawUchwale={ustawUchwale} />}
      {kod === '08' && <PolaListySadu adresat={adresat} ustawAdresat={ustawAdresat} />}
      {kod === '10' && (
        <PolaKlauzuli
          klauzula={klauzula} ustawKlauzule={ustawKlauzule}
          zbywcaId={zbywcaId} ustawZbywce={ustawZbywce}
          nabywcaId={nabywcaId} ustawNabywce={ustawNabywce}
        />
      )}

      {podglad && (
        <>
          {podglad.bledy.length > 0 && <Komunikat odmiana="blad" tytul="Błąd wzoru" lista={podglad.bledy} />}
          {podglad.brakujace.length > 0 && (
            <Komunikat odmiana="uwaga" tytul="Puste pola przy tych danych" lista={podglad.brakujace} />
          )}
          <Karta scisla tytul={`Treść na realnych danych ${kontekstNazwa}`}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--czcionka-dane, monospace)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
              {podglad.tekst}
            </pre>
          </Karta>
        </>
      )}
    </Modal>
  );
}

window.ModalWystawDokumentu = ModalWystawDokumentu;
