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
              <tr key={p.id} className="klikalna" onClick={() => idz(`/przeniesienia/${p.id}`)}>
                <td><strong><a className="lacze-wiersza" href={`#/przeniesienia/${p.id}`}>{p.nazwa || '—'}</a></strong><div className="przyciemnione">KRS {p.krs || '—'}</div></td>
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

/**
 * A-030: bieżący etap rozwinięty (jedna akcja główna), zakończone i późniejsze — zwinięte z tytułem.
 * Etap bieżący wynika ze statusu przeniesienia (wytyczne § 7.2).
 */
const ETAP_STATUSU = {
  zgloszone: 3, weryfikacja: 3, umowa_warunkowa: 4, oczekuje_na_przekazanie: 4,
  uzgodnienie: 6, wstrzymane_rozbieznosci: 6, aktywny: 7, wygasla: 8,
};
function EtapPrzeniesienia({ nr, tytul, status, children }) {
  const biezacy = ETAP_STATUSU[status] || 3;
  if (nr === biezacy) return <Karta tytul={`Etap ${nr} — ${tytul} · bieżący`}>{children}</Karta>;
  return <Sekcja tytul={`Etap ${nr} — ${tytul}${nr < biezacy ? ' ✓' : ' — później'}`}>{children}</Sekcja>;
}

function EkranPrzeniesienia({ id }) {
  const { dane, odswiez } = useDane(`/api/psa/przeniesienia/${id}`);
  const [blad, ustawBlad] = useState(null);
  const [pola, ustawPola] = useState({ data_zawarcia_umowy: dzisIso(), data_skutecznosci: dzisIso(), uwagi: '' });
  const [typDok, ustawTypDok] = useState('uchwala');
  const [maPlik, ustawMaPlik] = useState(false); // A-033: „Dodaj dokument” aktywne dopiero z wybranym plikiem
  const [zrodlo, ustawZrodlo] = useState('klient');
  const plik = useRef(null);
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
          <MetrykaPoz etykieta="Opłata za przejęcie" wartosc={p.oplata_za_przejecie} />
        </div>
        {p.przypomnienia.map((pr) => <Komunikat key={pr.rodzaj} odmiana="uwaga" tresc={pr.tresc} />)}
        {p.rozbieznosci && p.status === 'wstrzymane_rozbieznosci' && <Komunikat odmiana="uwaga" tytul="Rozbieżności" tresc={p.rozbieznosci} />}
        {p.dozwolone_przejscia.length > 0 && (
          <div className="karta" style={{ marginTop: 'var(--od-4)' }}>
            <div className="siatka-2">
              {p.dozwolone_przejscia.includes('umowa_warunkowa') && (
                <Pole etykieta="Data zawarcia umowy (podpis notariusza)"><PoleDaty wartosc={pola.data_zawarcia_umowy || ''} max={fmt.dzisIso()} przyZmianie={(v) => ustawPola({ ...pola, data_zawarcia_umowy: v || '' })} /></Pole>
              )}
              {p.dozwolone_przejscia.includes('oczekuje_na_przekazanie') && (
                <Pole etykieta="Data rozwiązania / wygaśnięcia dotychczasowej umowy (po weryfikacji)"><PoleDaty wartosc={pola.data_skutecznosci || ''} przyZmianie={(v) => ustawPola({ ...pola, data_skutecznosci: v || '' })} /></Pole>
              )}
              {(p.dozwolone_przejscia.includes('wstrzymane_rozbieznosci') || p.status === 'wstrzymane_rozbieznosci') && (
                <Pole etykieta="Opis rozbieżności / wyjaśnienia"><input value={pola.uwagi} onChange={(z) => ustawPola({ ...pola, uwagi: z.target.value })} /></Pole>
              )}
            </div>
            <span className="row-g" style={{ flexWrap: 'wrap' }}>
              {p.dozwolone_przejscia.filter((na) => na !== 'aktywny').map((na) => (
                // A-033: przejście, które na pewno zostanie odrzucone (rozbieżności bez opisu), jest nieaktywne (D-052).
                <button key={na} className="btn btn-maly" onClick={() => przejdz(na)}
                  disabled={(na === 'wstrzymane_rozbieznosci' || p.status === 'wstrzymane_rozbieznosci') && !String(pola.uwagi || '').trim()}>
                  → {dane.statusy[na]}
                </button>
              ))}
              {p.dozwolone_przejscia.includes('aktywny') && p.spolka_id && (
                // B-004: wprost do kreatora otwarcia (`POST /spolki/:id/otworz-rejestr` zapisuje PRZEJĘCIE i kończy
                // przeniesienie) — nie do kokpitu, gdzie jest tylko „Migracja z innego rejestru” (KRN). A-024: jedna nazwa.
                <button className="btn btn-glowny btn-maly" onClick={() => idz(`/spolki/${p.spolka_id}/otworz`)}>Otwórz rejestr</button>
              )}
            </span>
          </div>
        )}
      </Karta>

      <EtapPrzeniesienia nr={3} tytul="weryfikacja kancelarii" status={p.status}>
        <ChecklistaPrzeniesienia id={id} rodzaj="weryfikacji" definicja={dane.checklista_weryfikacji} zaznaczone={p.checklista_weryfikacji}
          blokady={p.blokady_weryfikacji} edytowalna={p.status === 'weryfikacja'} przyZmianie={odswiez} />
      </EtapPrzeniesienia>

      <Karta tytul="Dokumenty (SHA-256)">
        <table className="tabela">
          <tbody>{p.dokumenty.map((d) => (
            <tr key={d.id}><td><a href={`/api/psa/przeniesienia/${id}/dokumenty/${d.id}`}>{nazwaPlikuDoWyswietlenia({ nazwaOryginalna: d.nazwa_pliku, rodzaj: d.typ, data: d.utworzono })}</a></td><td>{d.typ}</td><td>{d.zrodlo}</td><td className="przyciemnione" style={{ fontSize: '0.75em' }}>{d.sha256.slice(0, 16)}…</td></tr>
          ))}</tbody>
        </table>
        <div className="row-g" style={{ flexWrap: 'wrap', marginTop: 'var(--od-2)' }}>
          <select value={typDok} onChange={(z) => ustawTypDok(z.target.value)}>
            {['uchwala', 'umowa_spolki', 'informacja_poprzednika', 'umowa_warunkowa', 'wypowiedzenie', 'potwierdzenie_rozwiazania', 'dane_poprzednika', 'inne'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={zrodlo} onChange={(z) => ustawZrodlo(z.target.value)}>
            {['klient', 'kancelaria', 'poprzednik'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="file" ref={plik} onChange={(z) => ustawMaPlik(Boolean(z.target.files && z.target.files.length))} />
          <button className="btn btn-maly" disabled={!maPlik} onClick={() => wykonaj(() => wyslij(`/api/psa/przeniesienia/${id}/dokumenty`, plik, { typ: typDok, zrodlo }))}>Dodaj dokument</button>
        </div>
      </Karta>

      <EtapPrzeniesienia nr={4} tytul="pisma (szablony)" status={p.status}>
        <ul>{dane.pisma.map((x) => (
          <li key={x.kod}><a href={`/api/psa/przeniesienia/${id}/pisma/${x.kod}`} target="_blank" rel="noopener">{x.tytul}</a>{x.projekt && <span className="przyciemnione"> — PROJEKT</span>}</li>
        ))}</ul>
      </EtapPrzeniesienia>

      <EtapPrzeniesienia nr={6} tytul="odbiór i uzgodnienie" status={p.status}>
        <ChecklistaPrzeniesienia id={id} rodzaj="odbioru" definicja={dane.checklista_odbioru} zaznaczone={p.checklista_odbioru}
          blokady={p.blokady_odbioru} edytowalna={p.status === 'uzgodnienie'} przyZmianie={odswiez} />
        <div className="podpowiedz">Rozbieżności nie poprawiamy samodzielnie — rejestr odwzorowujemy, korekty tylko w trybie żądania wpisu.</div>
      </EtapPrzeniesienia>

      {/* D-095: protokół powstaje automatycznie przy „Otwórz rejestr” (dokumenty ze skrótami + checklista odbioru)
          i trafia do zdarzenia PRZEJĘCIE; zatwierdzeniem notariusza jest samo otwarcie — bez wgrywania podpisanego pliku. */}
      <EtapPrzeniesienia nr={7} tytul="protokół przejęcia" status={p.status}>
        <p className="male">Protokół (dokumenty źródłowe ze skrótami SHA-256 i checklista odbioru) powstaje przy otwarciu rejestru
          i jest dołączany do zdarzenia PRZEJĘCIE. Otwarcie rejestru przez notariusza jest jego zatwierdzeniem.</p>
        <a className="btn btn-maly" href={`/api/psa/przeniesienia/${id}/protokol.pdf`}>Podgląd protokołu (PDF)</a>
        {p.protokol_id_dokumentu && <span className="przyciemnione"> ID {p.protokol_id_dokumentu}</span>}
      </EtapPrzeniesienia>

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
