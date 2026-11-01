/* ─────────────────────────────────────────────────────
   Faza 4 — przeniesienie rejestru od innego podmiotu (W7.1–W7.10).
   Lista i karta przeniesienia: status § 7.3, przejścia z warunkami,
   checklisty Etapów 3 i 6 (zaznacza człowiek), dokumenty, pisma, protokół
   przejęcia z podpisem kwalifikowanym, historia.
   ───────────────────────────────────────────────────── */

const ODMIANA_STATUSU_PRZEN = {
  zgloszone: 'mosiadz', weryfikacja: 'mosiadz', umowa_warunkowa: 'neutralna', oczekuje_na_przekazanie: 'neutralna',
  uzgodnienie: 'neutralna', aktywny: 'rejestr', wstrzymane_rozbieznosci: 'sygnal', wygasla: 'sygnal',
};

function EkranPrzeniesien() {
  const { dane } = useDane('/api/psa/przeniesienia');
  const lista = (dane && dane.przeniesienia) || [];
  return (
    <Karta tytul="Przeniesienia rejestru od innego podmiotu">
      {lista.length === 0 ? <Pusto tytul="Brak przeniesień" opis="Zgłoszenia z wariantem „Przenoszę rejestr od innego podmiotu” pojawią się tutaj." /> : (
        <table className="tabela">
          <thead><tr><th>Spółka</th><th>Dotychczasowy podmiot</th><th>Status</th><th>Umowa / skuteczność</th></tr></thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="klikalny" onClick={() => idz(`/przeniesienia/${p.id}`)}>
                <td><strong>{p.nazwa || '—'}</strong><div className="przyciemnione">KRS {p.krs || '—'}</div></td>
                <td>{p.poprzednik_nazwa || '—'}<div className="przyciemnione">{p.poprzednik_opis}</div></td>
                <td><Pigulka odmiana={ODMIANA_STATUSU_PRZEN[p.status]}>{p.nazwa_statusu}</Pigulka>
                  {p.przypomnienia.length > 0 && <div className="przyciemnione">przypomnienia: {p.przypomnienia.length}</div>}</td>
                <td>{p.data_zawarcia_umowy ? fmt.data(p.data_zawarcia_umowy) : '—'} / {p.data_skutecznosci ? fmt.data(p.data_skutecznosci) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Karta>
  );
}

function ChecklistaPrzeniesienia({ id, rodzaj, definicja, zaznaczone, blokady, edytowalna, przyZmianie }) {
  const [blad, ustawBlad] = useState(null);
  async function przelacz(kod) {
    ustawBlad(null);
    try {
      const odp = await API.put(`/api/psa/przeniesienia/${id}/checklista/${rodzaj}`, { zaznaczone: { ...zaznaczone, [kod]: !zaznaczone[kod] } });
      przyZmianie(odp.przeniesienie);
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się zapisać.');
    }
  }
  return (
    <div>
      <Komunikat odmiana="blad" tresc={blad} />
      {definicja.map((poz) => (
        <label key={poz.kod} className="row-g" style={{ alignItems: 'flex-start', marginBottom: 'var(--od-2)' }}>
          <input type="checkbox" checked={Boolean(zaznaczone[poz.kod])} disabled={!edytowalna || Boolean(blokady[poz.kod])} onChange={() => przelacz(poz.kod)} />
          <span>{poz.tresc}{blokady[poz.kod] && <span className="przyciemnione"> — {blokady[poz.kod]}</span>}</span>
        </label>
      ))}
    </div>
  );
}

function EkranPrzeniesienia({ id }) {
  const { dane, odswiez } = useDane(`/api/psa/przeniesienia/${id}`);
  const [blad, ustawBlad] = useState(null);
  const [pola, ustawPola] = useState({ data_zawarcia_umowy: dzisIso(), data_skutecznosci: dzisIso(), uwagi: '' });
  const [typDok, ustawTypDok] = useState('uchwala');
  const [zrodlo, ustawZrodlo] = useState('klient');
  const plik = useRef(null);
  const podpisany = useRef(null);
  if (!dane) return <Spinner />;
  const p = dane.przeniesienie;

  async function wykonaj(fn) {
    ustawBlad(null);
    try { await fn(); odswiez(); } catch (e) { ustawBlad(e instanceof BladApi ? e.message : e.message || 'Błąd.'); }
  }
  const przejdz = (na) => wykonaj(() => API.post(`/api/psa/przeniesienia/${id}/przejscie`, { na, ...pola }));
  async function wyslij(sciezka, input, polaFormularza = {}) {
    const f = new FormData();
    for (const [k, v] of Object.entries(polaFormularza)) f.append(k, v);
    f.append('plik', input.current.files[0]);
    const odp = await fetch(sciezka, { method: 'POST', body: f });
    const t = await odp.json().catch(() => ({}));
    if (!odp.ok) throw new Error(t.blad || `Błąd ${odp.status}`);
    input.current.value = '';
  }

  return (
    <div className="pion" style={{ gap: 'var(--od-6)' }}>
      <Karta tytul={`${p.nazwa || 'Spółka'} — przeniesienie rejestru`}>
        <Komunikat odmiana="blad" tresc={blad} />
        <div className="metryka-pion">
          <MetrykaPoz etykieta="Status" wartosc={<Pigulka odmiana={ODMIANA_STATUSU_PRZEN[p.status]}>{p.nazwa_statusu}</Pigulka>} />
          <MetrykaPoz etykieta="Dotychczasowy podmiot" wartosc={`${p.poprzednik_nazwa || '—'} (${p.poprzednik_opis})`} />
          <MetrykaPoz etykieta="Okres wypowiedzenia (informacyjnie)" wartosc={p.okres_wypowiedzenia || '—'} />
          <MetrykaPoz etykieta="Umowa zawarta" wartosc={p.data_zawarcia_umowy ? fmt.data(p.data_zawarcia_umowy) : '—'} />
          <MetrykaPoz etykieta="Termin ostateczny warunku" wartosc={p.termin_warunku ? fmt.data(p.termin_warunku) : '—'} />
          <MetrykaPoz etykieta="Skuteczność (rozwiązanie dotychczasowej umowy)" wartosc={p.data_skutecznosci ? fmt.data(p.data_skutecznosci) : '—'} />
          <MetrykaPoz etykieta="Opłata za przejęcie / początek gwarancji ceny" wartosc={`${p.oplata_za_przejecie} / ${p.poczatek_gwarancji_ceny}`} />
        </div>
        {p.przypomnienia.map((pr) => <Komunikat key={pr.rodzaj} odmiana="uwaga" tresc={pr.tresc} />)}
        {p.rozbieznosci && p.status === 'wstrzymane_rozbieznosci' && <Komunikat odmiana="uwaga" tytul="Rozbieżności" tresc={p.rozbieznosci} />}
        {p.dozwolone_przejscia.length > 0 && (
          <div className="karta" style={{ marginTop: 'var(--od-4)' }}>
            <div className="siatka-2">
              {p.dozwolone_przejscia.includes('umowa_warunkowa') && (
                <Pole etykieta="Data zawarcia umowy (podpis notariusza)"><input type="date" value={pola.data_zawarcia_umowy} onChange={(z) => ustawPola({ ...pola, data_zawarcia_umowy: z.target.value })} /></Pole>
              )}
              {p.dozwolone_przejscia.includes('oczekuje_na_przekazanie') && (
                <Pole etykieta="Data rozwiązania / wygaśnięcia dotychczasowej umowy (po weryfikacji)"><input type="date" value={pola.data_skutecznosci} onChange={(z) => ustawPola({ ...pola, data_skutecznosci: z.target.value })} /></Pole>
              )}
              {(p.dozwolone_przejscia.includes('wstrzymane_rozbieznosci') || p.status === 'wstrzymane_rozbieznosci') && (
                <Pole etykieta="Opis rozbieżności / wyjaśnienia"><input value={pola.uwagi} onChange={(z) => ustawPola({ ...pola, uwagi: z.target.value })} /></Pole>
              )}
            </div>
            <span className="row-g" style={{ flexWrap: 'wrap' }}>
              {p.dozwolone_przejscia.filter((na) => na !== 'aktywny').map((na) => (
                <button key={na} className="btn btn-maly" onClick={() => przejdz(na)}>→ {dane.statusy[na]}</button>
              ))}
              {p.dozwolone_przejscia.includes('aktywny') && p.spolka_id && (
                <button className="btn btn-glowny btn-maly" onClick={() => idz(`/spolki/${p.spolka_id}`)}>Otwórz rejestr — PRZEJĘCIE (kreator stanu otwarcia)</button>
              )}
            </span>
          </div>
        )}
      </Karta>

      <Karta tytul="Etap 3 — weryfikacja kancelarii">
        <ChecklistaPrzeniesienia id={id} rodzaj="weryfikacji" definicja={dane.checklista_weryfikacji} zaznaczone={p.checklista_weryfikacji}
          blokady={p.blokady_weryfikacji} edytowalna={p.status === 'weryfikacja'} przyZmianie={odswiez} />
      </Karta>

      <Karta tytul="Dokumenty (SHA-256)">
        <table className="tabela">
          <tbody>{p.dokumenty.map((d) => (
            <tr key={d.id}><td><a href={`/api/psa/przeniesienia/${id}/dokumenty/${d.id}`}>{d.nazwa_pliku}</a></td><td>{d.typ}</td><td>{d.zrodlo}</td><td className="przyciemnione" style={{ fontSize: '0.75em' }}>{d.sha256.slice(0, 16)}…</td></tr>
          ))}</tbody>
        </table>
        <div className="row-g" style={{ flexWrap: 'wrap', marginTop: 'var(--od-2)' }}>
          <select value={typDok} onChange={(z) => ustawTypDok(z.target.value)}>
            {['uchwala', 'umowa_spolki', 'informacja_poprzednika', 'umowa_warunkowa', 'wypowiedzenie', 'potwierdzenie_rozwiazania', 'dane_poprzednika', 'inne'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={zrodlo} onChange={(z) => ustawZrodlo(z.target.value)}>
            {['klient', 'kancelaria', 'poprzednik'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="file" ref={plik} />
          <button className="btn btn-maly" onClick={() => wykonaj(() => wyslij(`/api/psa/przeniesienia/${id}/dokumenty`, plik, { typ: typDok, zrodlo }))}>Dodaj dokument</button>
        </div>
      </Karta>

      <Karta tytul="Etap 4 — pisma (szablony)">
        <ul>{dane.pisma.map((x) => (
          <li key={x.kod}><a href={`/api/psa/przeniesienia/${id}/pisma/${x.kod}`} target="_blank" rel="noopener">{x.tytul}</a>{x.projekt && <span className="przyciemnione"> — PROJEKT</span>}</li>
        ))}</ul>
      </Karta>

      <Karta tytul="Etap 6 — odbiór i uzgodnienie">
        <ChecklistaPrzeniesienia id={id} rodzaj="odbioru" definicja={dane.checklista_odbioru} zaznaczone={p.checklista_odbioru}
          blokady={p.blokady_odbioru} edytowalna={p.status === 'uzgodnienie'} przyZmianie={odswiez} />
        <div className="podpowiedz">Rozbieżności nie poprawiamy samodzielnie — rejestr odwzorowujemy, korekty tylko w trybie żądania wpisu.</div>
      </Karta>

      <Karta tytul="Etap 7 — protokół przejęcia i zatwierdzenie (podpis kwalifikowany notariusza)">
        <a className="btn btn-maly" href={`/api/psa/przeniesienia/${id}/protokol.pdf`}>Pobierz protokół przejęcia (PDF)</a>
        {p.protokol_id_dokumentu && <span className="przyciemnione"> ID {p.protokol_id_dokumentu}</span>}
        <div className="row-g" style={{ marginTop: 'var(--od-2)' }}>
          <input type="file" ref={podpisany} accept=".pdf,.xml,.xades" />
          <button className="btn btn-maly btn-glowny" onClick={() => wykonaj(() => wyslij(`/api/psa/przeniesienia/${id}/zatwierdzenie`, podpisany))}>Wgraj protokół podpisany przez notariusza</button>
        </div>
        {p.zatwierdzenie_walidacja && <WynikWalidacji walidacja={p.zatwierdzenie_walidacja} />}
      </Karta>

      <Karta tytul="Historia (append-only)">
        <ul>{p.historia.map((h) => (
          <li key={h.id}>{fmt.dataCzas(h.utworzono)} — {h.z_statusu ? `${dane.statusy[h.z_statusu]} → ` : ''}{dane.statusy[h.na_status]}{h.uwagi ? ` — ${h.uwagi}` : ''} <span className="przyciemnione">({h.autor})</span></li>
        ))}</ul>
        {p.status === 'aktywny' && (
          <span className="row-g">
            <button className="btn btn-maly" onClick={() => wykonaj(() => API.post(`/api/psa/przeniesienia/${id}/zadanie/organy`, {}))}>Organy egzekucyjne powiadomione</button>
            <button className="btn btn-maly" onClick={() => wykonaj(() => API.post(`/api/psa/przeniesienia/${id}/zadanie/krs`, {}))}>Przypomniano o KRS</button>
          </span>
        )}
      </Karta>
    </div>
  );
}
