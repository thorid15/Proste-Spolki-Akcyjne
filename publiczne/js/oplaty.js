/* oplaty.js — rozliczenia (sekcja 1, 5, 8 specyfikacji).

   Naliczanie samo: wpis odpłatny (workflow sprawy), informacja z rejestru
   (kancelaria i portal), prowadzenie rejestru (wsadowo, raz na rok). Ten
   ekran to wyłącznie PODGLĄD i ręczne korekty/status — logika naliczania
   żyje w server/oplaty.js. */

const TYP_ETYKIETA = {
  prowadzenie: 'Prowadzenie rejestru (rocznie)',
  wpis: 'Wpis w rejestrze',
  informacja: 'Informacja z rejestru',
};

const STATUS_ZNACZNIK = {
  naliczona: 'neutralny',
  zafakturowana: 'lupek',
  oplacona: 'zielony',
  anulowana: 'bordo',
};

const STATUS_ETYKIETA = {
  naliczona: 'naliczona',
  zafakturowana: 'zafakturowana',
  oplacona: 'opłacona',
  anulowana: 'anulowana',
};

function ModalNowaOplata({ spolki, stawki, przyZamknieciu, przyZapisie }) {
  const [dane, ustawDane] = useState({ spolka_id: '', typ: 'informacja', okres: '', kwota_grosze: '', notatka: '' });
  const [blad, ustawBlad] = useState(null);
  const [zapisywanie, ustawZapisywanie] = useState(false);

  const pole = (k) => ({ value: dane[k] ?? '', onChange: (z) => ustawDane((p) => ({ ...p, [k]: z.target.value })) });
  const rokBiezacy = new Date().getFullYear();

  async function zapisz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const wynik = await API.post('/api/psa/oplaty', {
        ...dane,
        spolka_id: Number(dane.spolka_id),
        kwota_grosze: dane.kwota_grosze === '' ? undefined : Math.round(Number(dane.kwota_grosze) * 100),
      });
      przyZapisie(wynik.oplata);
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  const stawkaDomyslna = stawki ? stawki[{ prowadzenie: 'PROWADZENIE_ROCZNIE', wpis: 'WPIS', informacja: 'INFORMACJA' }[dane.typ]] : null;

  return (
    <Modal
      tytul="Nowa opłata"
      przyZamknieciu={przyZamknieciu}
      szerokosc={480}
      stopka={
        <>
          <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
          <button className="btn btn-primary" onClick={zapisz} disabled={zapisywanie || !dane.spolka_id}>
            {zapisywanie ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </>
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      <Pole etykieta="Spółka" wymagane>
        <select {...pole('spolka_id')}>
          <option value="">— wybierz —</option>
          {spolki.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
        </select>
      </Pole>
      <Pole etykieta="Rodzaj opłaty" wymagane>
        <select {...pole('typ')}>
          <option value="informacja">Informacja z rejestru</option>
          <option value="wpis">Wpis w rejestrze</option>
          <option value="prowadzenie">Prowadzenie rejestru (rocznie)</option>
        </select>
      </Pole>
      {dane.typ === 'prowadzenie' && (
        <Pole etykieta="Rok (okres)" wymagane>
          <input type="number" {...pole('okres')} placeholder={String(rokBiezacy)} />
        </Pole>
      )}
      <Pole
        etykieta="Kwota (zł)"
        podpowiedz={stawkaDomyslna != null ? `Zostaw puste, aby użyć stawki kancelarii: ${fmt.zlote(stawkaDomyslna)}.` : undefined}
      >
        <input type="number" step="0.01" min="0" {...pole('kwota_grosze')} placeholder={stawkaDomyslna != null ? String(stawkaDomyslna / 100) : ''} />
      </Pole>
      <Pole etykieta="Notatka"><textarea {...pole('notatka')} /></Pole>
    </Modal>
  );
}

function ModalNaliczenieRoczne({ przyZamknieciu, przyNaliczeniu }) {
  const [rok, ustawRok] = useState(String(new Date().getFullYear()));
  const [zapisywanie, ustawZapisywanie] = useState(false);
  const [blad, ustawBlad] = useState(null);
  const [wynik, ustawWynik] = useState(null);

  async function nalicz() {
    ustawZapisywanie(true);
    ustawBlad(null);
    try {
      const odpowiedz = await API.post('/api/psa/oplaty/naliczenie-roczne', { rok });
      ustawWynik(odpowiedz);
      przyNaliczeniu();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapisywanie(false);
    }
  }

  return (
    <Modal
      tytul="Naliczenie roczne — prowadzenie rejestru"
      przyZamknieciu={przyZamknieciu}
      szerokosc={480}
      stopka={
        wynik
          ? <button className="btn btn-primary" onClick={przyZamknieciu}>Zamknij</button>
          : (
            <>
              <button className="btn" onClick={przyZamknieciu}>Anuluj</button>
              <button className="btn btn-primary" onClick={nalicz} disabled={zapisywanie || !/^\d{4}$/.test(rok)}>
                {zapisywanie ? 'Naliczanie…' : 'Nalicz'}
              </button>
            </>
          )
      }
    >
      <Komunikat odmiana="blad" tresc={blad} />
      {wynik ? (
        <Komunikat odmiana="ok" tresc={wynik.komunikat} />
      ) : (
        <>
          <Pole etykieta="Rok" wymagane podpowiedz="Nalicza opłatę za prowadzenie rejestru każdej spółce (poza wykreśloną), która nie ma jej jeszcze naliczonej za ten rok — idempotentne, można uruchomić wielokrotnie.">
            <input type="number" value={rok} onChange={(z) => ustawRok(z.target.value)} />
          </Pole>
        </>
      )}
    </Modal>
  );
}

function EkranOplat() {
  const sesja = useSesja();
  const [filtrSpolka, ustawFiltrSpolke] = useState('');
  const [filtrTyp, ustawFiltrTyp] = useState('');
  const [filtrStatus, ustawFiltrStatus] = useState('');
  const [filtrOkres, ustawFiltrOkres] = useState('');
  const [modalNowa, ustawModalNowa] = useState(false);
  const [modalRoczne, ustawModalRoczne] = useState(false);
  const [blad, ustawBlad] = useState(null);

  const { dane: spolkiOdp } = useDane('/api/psa/spolki');
  const { dane: meta } = useDane('/api/psa/meta');

  const parametry = new URLSearchParams();
  if (filtrSpolka) parametry.set('spolka_id', filtrSpolka);
  if (filtrTyp) parametry.set('typ', filtrTyp);
  if (filtrStatus) parametry.set('status', filtrStatus);
  if (filtrOkres) parametry.set('okres', filtrOkres);
  const sciezka = `/api/psa/oplaty${parametry.toString() ? `?${parametry}` : ''}`;
  const { dane, ladowanie, odswiez } = useDane(sciezka, [filtrSpolka, filtrTyp, filtrStatus, filtrOkres]);

  async function zmienStatus(oplataId, status) {
    ustawBlad(null);
    try {
      await API.patch(`/api/psa/oplaty/${oplataId}`, { status });
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    }
  }

  const spolki = spolkiOdp ? spolkiOdp.spolki : [];

  return (
    <>
      <div className="pasek-gorny">
        <div />
        <div className="row-g">
          {sesja.uzytkownik && sesja.uzytkownik.rola === 'admin' && (
            <button className="btn" onClick={() => ustawModalRoczne(true)}>Nalicz opłaty roczne</button>
          )}
          <a className="btn" href={`/api/psa/oplaty/eksport${parametry.toString() ? `?${parametry}` : ''}`}>
            Eksportuj CSV
          </a>
          <button className="btn btn-glowny" onClick={() => ustawModalNowa(true)}>+ Nowa opłata</button>
        </div>
      </div>

      <Komunikat odmiana="blad" tresc={blad} />

      <Karta tight>
        <div className="row-g" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
          <select value={filtrSpolka} onChange={(z) => ustawFiltrSpolke(z.target.value)}>
            <option value="">Wszystkie spółki</option>
            {spolki.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
          </select>
          <select value={filtrTyp} onChange={(z) => ustawFiltrTyp(z.target.value)}>
            <option value="">Wszystkie rodzaje</option>
            <option value="prowadzenie">Prowadzenie rejestru</option>
            <option value="wpis">Wpis</option>
            <option value="informacja">Informacja</option>
          </select>
          <select value={filtrStatus} onChange={(z) => ustawFiltrStatus(z.target.value)}>
            <option value="">Wszystkie statusy</option>
            <option value="naliczona">naliczona</option>
            <option value="zafakturowana">zafakturowana</option>
            <option value="oplacona">opłacona</option>
            <option value="anulowana">anulowana</option>
          </select>
          <input type="number" placeholder="Rok (okres)" style={{ maxWidth: 140 }} value={filtrOkres} onChange={(z) => ustawFiltrOkres(z.target.value)} />
          {dane && <span className="podpowiedz" style={{ marginLeft: 'auto' }}>Razem: <strong>{fmt.zlote(dane.suma_grosze)}</strong></span>}
        </div>

        {ladowanie && <Spinner />}
        {dane && dane.oplaty.length === 0 && (
          <Pusto tytul="Brak opłat spełniających filtry" />
        )}
        {dane && dane.oplaty.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Spółka</th>
                <th>Rodzaj</th>
                <th>Okres</th>
                <th className="prawo">Kwota</th>
                <th>Naliczono</th>
                <th>Notatka</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dane.oplaty.map((o) => (
                <tr key={o.id}>
                  <td>{o.spolka_nazwa}</td>
                  <td>{TYP_ETYKIETA[o.typ] || o.typ}</td>
                  <td className="przyciemnione">{o.okres || '—'}</td>
                  <td className="prawo" style={{ fontWeight: 600 }}>{fmt.zlote(o.kwota_grosze)}</td>
                  <td className="przyciemnione">{fmt.data(o.data_naliczenia)}</td>
                  <td className="zawijaj przyciemnione">{o.notatka || '—'}</td>
                  <td><Znacznik odmiana={STATUS_ZNACZNIK[o.status]}>{STATUS_ETYKIETA[o.status]}</Znacznik></td>
                  <td>
                    <select value={o.status} onChange={(z) => zmienStatus(o.id, z.target.value)}>
                      <option value="naliczona">naliczona</option>
                      <option value="zafakturowana">zafakturowana</option>
                      <option value="oplacona">opłacona</option>
                      <option value="anulowana">anulowana</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Karta>

      {modalNowa && (
        <ModalNowaOplata
          spolki={spolki}
          stawki={meta ? meta.stawki_grosze : null}
          przyZamknieciu={() => ustawModalNowa(false)}
          przyZapisie={() => { ustawModalNowa(false); odswiez(); }}
        />
      )}
      {modalRoczne && (
        <ModalNaliczenieRoczne
          przyZamknieciu={() => ustawModalRoczne(false)}
          przyNaliczeniu={odswiez}
        />
      )}
    </>
  );
}

window.EkranOplat = EkranOplat;
