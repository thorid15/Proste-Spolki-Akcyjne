/* sprawy.js — lista spraw i strona wpisu (D-231). Wpis to jedna strona, od góry: 1. Co się zmienia →
   2. Podstawa → 3. Przed wpisem (powiadomienie albo zgoda, checklista, opłata) → 4. Po wpisie (różnica) →
   „Dokonaj wpisu”. Sprawa powstaje przy pierwszej zmianie w formularzu, nie przy jego otwarciu.
   Numery akcji zawsze wpisuje pracownik (U-26); obok pól widać, co osoba posiada. */

const FILTRY_SPRAW = [['otwarte', 'W toku'], ['zakonczone', 'Zakończone'], ['wszystkie', 'Wszystkie']];
const STANY_FILTRA = { otwarte: 'w_toku,wstrzymana', zakonczone: 'wpisana,odmowa,wycofana', wszystkie: '' };

function opisTerminu(t) {
  if (!t) return null;
  if (t.zamrozony) return 'termin wstrzymany';
  return t.po_terminie ? `po terminie (${fmt.data(t.termin_do)})` : `termin ${fmt.data(t.termin_do)}`;
}

function EkranSpraw() {
  const [filtr, ustawFiltr] = useParametrAdresu('filtr', 'otwarte');
  const stany = STANY_FILTRA[filtr] || '';
  const { dane, blad } = useDane(`/api/psa/sprawy${stany ? `?stan=${stany}` : ''}`);
  return (
    <Karta>
      <Filtr opcje={FILTRY_SPRAW} wartosc={filtr} przyZmianie={ustawFiltr} />
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && !dane.length && <Pusto tytul="Brak spraw" opis="Wpis zaczyna się w rejestrze spółki — „Nowy wpis” przy akcjonariuszu." />}
      {dane && dane.length > 0 && (
        <table className="tabela">
          <thead><tr><th>Nr</th><th>Spółka</th><th>Żądający</th><th>Wpływ</th><th>Termin</th><th>Stan</th></tr></thead>
          <tbody>
            {dane.map((s) => (
              <tr key={s.id} className="klikalna" onClick={() => idz(`/sprawy/${s.id}`)}>
                <td><a href={`#/sprawy/${s.id}`}>{s.id}</a></td>
                <td>{s.spolka}</td>
                <td>{s.zadajacy_nazwa || (s.zadajacy === 'spolka' ? 'spółka' : '—')}</td>
                <td>{fmt.data(s.data_wplywu)}</td>
                <td className={s.termin && (s.termin.po_terminie || s.termin.pilny) ? 'pilne' : ''}>{opisTerminu(s.termin) || '—'}</td>
                <td><Pigulka odmiana={ODMIANY_STANU_SPRAWY[s.stan]}>{STANY_SPRAWY[s.stan]}</Pigulka></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Karta>
  );
}

/* ── Edytory zmian (treść robocza = wejście serwera) ── */

const NOWA_AKCJA = () => ({ seria: '', numery: '', liczba: '' });
const numeryDoPola = (zakresy) => (zakresy || []).map((z) => (z.nr_od === z.nr_do ? String(z.nr_od) : `${z.nr_od}-${z.nr_do}`)).join(', ');

const NOWE_ZMIANY = {
  przeniesienie: () => ({ typ: 'przeniesienie', zbywca_osoba_id: null, nabywcy: [{ osoba_id: null, akcje: [NOWA_AKCJA()] }] }),
  emisja: () => ({ typ: 'emisja', seria: '', numery: '', liczba: '', data_wpisu_krs: '', obejmujacy: [{ osoba_id: null, numery: '', liczba: '' }] }),
  umorzenie: () => ({ typ: 'umorzenie', podstawa: null, akcje: [NOWA_AKCJA()] }),
  obciazenie: () => ({ typ: 'obciazenie', operacja: 'ustanowienie', rodzaj: 'zastaw', osoba_id: null, tresc: '', prawo_glosu: false, akcje: [NOWA_AKCJA()] }),
  adnotacja: () => ({ typ: 'adnotacja', operacja: 'dodanie', rodzaj: 'ograniczenie', tresc: '', akcje: [NOWA_AKCJA()] }),
};

function Lista({ elementy, render, nowy, etykietaDodania, minimum = 1, przyZmianie }) {
  return (
    <>
      {elementy.map((el, i) => (
        <div className="element-listy" key={i}>
          {render(el, (w) => przyZmianie(elementy.map((x, j) => (j === i ? w : x))), i)}
          {elementy.length > minimum && (
            <button type="button" className="btn btn-maly btn-cichy" onClick={() => przyZmianie(elementy.filter((_, j) => j !== i))}>Usuń</button>
          )}
        </div>
      ))}
      {etykietaDodania && <button type="button" className="btn btn-maly btn-cichy" onClick={() => przyZmianie([...elementy, nowy()])}>+ {etykietaDodania}</button>}
    </>
  );
}

/** Akcje: seria, numery i liczba (U-26); `ulamek` — część jednej akcji. */
function EdytorAkcji({ akcje, przyZmianie, b, ulamek = false, bezSerii = false }) {
  return (
    <div className="edytor-akcji">
      {b('') && <p className="pole-blad">{b('')}</p>}
      <Lista
        elementy={akcje || []}
        przyZmianie={przyZmianie}
        nowy={NOWA_AKCJA}
        etykietaDodania="Kolejne akcje"
        render={(a, zmien, i) => (
          <div className="wiersz-akcji">
            {!bezSerii && <Pole etykieta="Seria" blad={b(`${i}.seria`)}><input type="text" className="krotkie" value={a.seria || ''} onChange={(e) => zmien({ ...a, seria: e.target.value })} /></Pole>}
            <Pole etykieta="Numery" blad={b(`${i}.numery`)} podpowiedz="np. 1-100, 150"><input type="text" value={a.numery || ''} onChange={(e) => zmien({ ...a, numery: e.target.value })} /></Pole>
            <Pole etykieta="Liczba" blad={b(`${i}.liczba`)}><input type="text" inputMode="numeric" className="krotkie" value={a.liczba ?? ''} onChange={(e) => zmien({ ...a, liczba: e.target.value })} /></Pole>
            {ulamek && <Pole etykieta="Ułamek" opcjonalne blad={b(`${i}.ulamek`)} podpowiedz="np. 1/2"><input type="text" className="krotkie" value={a.ulamek || ''} onChange={(e) => zmien({ ...a, ulamek: e.target.value })} /></Pole>}
          </div>
        )}
      />
    </div>
  );
}

function DwaPrzyciski({ wartosc, opcje, przyZmianie }) {
  return (
    <div className="rzad" role="group">
      {opcje.map(([v, nazwa]) => (
        <button key={String(v)} type="button" className={`btn btn-maly ${wartosc === v ? 'btn-glowny' : ''}`} aria-pressed={wartosc === v} onClick={() => przyZmianie(v)}>{nazwa}</button>
      ))}
    </div>
  );
}

function WyborAtrybutu({ op, zmien, b, atrybuty, rodzaje }) {
  const dostepne = (atrybuty || []).filter((a) => rodzaje.includes(a.rodzaj));
  const klucz = op.atrybut ? `${op.atrybut.zdarzenie_id}:${op.atrybut.pozycja || 0}` : '';
  return (
    <Pole etykieta="Którego wpisu dotyczy" blad={b('atrybut')}>
      <select
        value={klucz}
        onChange={(e) => {
          const a = dostepne.find((x) => `${x.zdarzenie_id}:${x.pozycja}` === e.target.value);
          zmien({ ...op, atrybut: a ? { zdarzenie_id: a.zdarzenie_id, pozycja: a.pozycja } : null, akcje: a ? [{ seria: a.seria, numery: numeryDoPola(a.zakresy), liczba: String(a.zakresy.reduce((s, z) => s + z.nr_do - z.nr_od + 1, 0)) }] : op.akcje });
        }}
      >
        <option value="">— wybierz —</option>
        {klucz && !dostepne.some((a) => `${a.zdarzenie_id}:${a.pozycja}` === klucz) && <option value={klucz}>wpis nr {op.atrybut.zdarzenie_id}</option>}
        {dostepne.map((a) => (
          <option key={`${a.zdarzenie_id}:${a.pozycja}:${a.seria}`} value={`${a.zdarzenie_id}:${a.pozycja}`}>
            {NAZWY_ATRYBUTOW[a.rodzaj]} — seria {a.seria} nr {numeryAkcji(a.zakresy)}{a.tresc ? ` — ${a.tresc}` : ''}
          </option>
        ))}
      </select>
    </Pole>
  );
}

/** Co osoba ma w rejestrze — podpowiedź obok pól numerów. Niczego nie podstawia (D-232). */
function Posiadanie({ kontekst, osobaId }) {
  if (!kontekst || !osobaId) return null;
  const pakiety = pakietyOsob(kontekst.widok).get(Number(osobaId));
  if (!pakiety || !pakiety.size) return <p className="posiadanie">{nazwaOsoby(kontekst.osoby, osobaId)} nie ma akcji w rejestrze.</p>;
  return (
    <p className="posiadanie">
      <span className="etykieta">{nazwaOsoby(kontekst.osoby, osobaId)} posiada</span>{' '}
      {[...pakiety.values()].map((g) => `seria ${g.seria} nr ${numeryAkcji(g.zakresy)} (${liczbaPakietu(g)})`).join('; ')}
    </p>
  );
}

function EdytorPrzeniesienia({ op, zmien, b, kontekst }) {
  return (
    <>
      <Pole etykieta="Zbywca" blad={b('zbywca_osoba_id')}><WyborOsoby wartosc={op.zbywca_osoba_id} przyZmianie={(id) => zmien({ ...op, zbywca_osoba_id: id })} /></Pole>
      <Posiadanie kontekst={kontekst} osobaId={op.zbywca_osoba_id} />
      {b('nabywcy') && <p className="pole-blad">{b('nabywcy')}</p>}
      <Lista
        elementy={op.nabywcy || []}
        przyZmianie={(nabywcy) => zmien({ ...op, nabywcy })}
        nowy={() => ({ osoba_id: null, akcje: [NOWA_AKCJA()] })}
        etykietaDodania="Nabywca"
        render={(n, zm, i) => (
          <>
            <Pole etykieta={`Nabywca ${i + 1}`} blad={b(`nabywcy.${i}.osoba_id`)}><WyborOsoby wartosc={n.osoba_id} przyZmianie={(id) => zm({ ...n, osoba_id: id })} /></Pole>
            <EdytorAkcji akcje={n.akcje} przyZmianie={(akcje) => zm({ ...n, akcje })} b={(s) => b(`nabywcy.${i}.akcje${s ? `.${s}` : ''}`)} ulamek />
          </>
        )}
      />
    </>
  );
}

function EdytorEmisji({ op, zmien, b }) {
  const t = (pole) => ({ value: op[pole] ?? '', onChange: (e) => zmien({ ...op, [pole]: e.target.value }) });
  return (
    <>
      <div className="wiersz-akcji">
        <Pole etykieta="Seria" blad={b('seria')}><input type="text" className="krotkie" {...t('seria')} /></Pole>
        <Pole etykieta="Numery" blad={b('numery')} podpowiedz="jeden zakres, np. 1-500"><input type="text" {...t('numery')} /></Pole>
        <Pole etykieta="Liczba" blad={b('liczba')}><input type="text" inputMode="numeric" className="krotkie" {...t('liczba')} /></Pole>
      </div>
      <Pole etykieta="Data wpisu emisji do KRS" blad={b('data_wpisu_krs')}>
        <PoleDaty wartosc={op.data_wpisu_krs || ''} przyZmianie={(d) => zmien({ ...op, data_wpisu_krs: d })} max={fmt.dzisIso()} />
      </Pole>
      <Pole etykieta="Czy akcje są pokryte w całości?" blad={b('pokryte')}>
        <DwaPrzyciski wartosc={op.pokryte} opcje={[[true, 'Tak'], [false, 'Nie']]} przyZmianie={(v) => zmien({ ...op, pokryte: v })} />
      </Pole>
      {b('obejmujacy') && <p className="pole-blad">{b('obejmujacy')}</p>}
      <Lista
        elementy={op.obejmujacy || []}
        przyZmianie={(obejmujacy) => zmien({ ...op, obejmujacy })}
        nowy={() => ({ osoba_id: null, numery: '', liczba: '' })}
        etykietaDodania="Obejmujący"
        render={(o, zm, i) => (
          <>
            <Pole etykieta={`Obejmujący ${i + 1}`} blad={b(`obejmujacy.${i}.osoba_id`)}><WyborOsoby wartosc={o.osoba_id} przyZmianie={(id) => zm({ ...o, osoba_id: id })} /></Pole>
            <div className="wiersz-akcji">
              <Pole etykieta="Numery" blad={b(`obejmujacy.${i}.numery`)}><input type="text" value={o.numery || ''} onChange={(e) => zm({ ...o, numery: e.target.value })} /></Pole>
              <Pole etykieta="Liczba" blad={b(`obejmujacy.${i}.liczba`)}><input type="text" inputMode="numeric" className="krotkie" value={o.liczba ?? ''} onChange={(e) => zm({ ...o, liczba: e.target.value })} /></Pole>
            </div>
          </>
        )}
      />
    </>
  );
}

function EdytorUmorzenia({ op, zmien, b, kontekst }) {
  return (
    <>
      <Posiadanie kontekst={kontekst} osobaId={kontekst && kontekst.osobaId} />
      <Pole etykieta="Podstawa" blad={b('podstawa')}>
        <DwaPrzyciski wartosc={op.podstawa} opcje={[['uchwala', 'Uchwała'], ['orzeczenie', 'Orzeczenie sądu']]} przyZmianie={(v) => zmien({ ...op, podstawa: v })} />
      </Pole>
      <EdytorAkcji akcje={op.akcje} przyZmianie={(akcje) => zmien({ ...op, akcje })} b={(s) => b(`akcje${s ? `.${s}` : ''}`)} />
    </>
  );
}

function EdytorObciazenia({ op, zmien, b, atrybuty, kontekst }) {
  const ustanowienie = op.operacja === 'ustanowienie';
  return (
    <>
      {ustanowienie && <Posiadanie kontekst={kontekst} osobaId={kontekst && kontekst.osobaId} />}
      <Pole etykieta="Czynność" blad={b('operacja')}>
        <select value={op.operacja || ''} onChange={(e) => zmien({ ...op, operacja: e.target.value, atrybut: null })}>
          <option value="ustanowienie">ustanowienie</option>
          <option value="zmiana_prawa_glosu">zmiana prawa głosu</option>
          <option value="wykreslenie">wykreślenie</option>
        </select>
      </Pole>
      {ustanowienie ? (
        <>
          <Pole etykieta="Rodzaj" blad={b('rodzaj')}>
            <select value={op.rodzaj || ''} onChange={(e) => zmien({ ...op, rodzaj: e.target.value })}>
              <option value="zastaw">zastaw</option>
              <option value="uzytkowanie">użytkowanie</option>
              <option value="zajecie">zajęcie</option>
            </select>
          </Pole>
          {op.rodzaj !== 'zajecie' && (
            <>
              <Pole etykieta="Uprawniony" blad={b('osoba_id')}><WyborOsoby wartosc={op.osoba_id} przyZmianie={(id) => zmien({ ...op, osoba_id: id })} /></Pole>
              <label className="chk"><input type="checkbox" checked={Boolean(op.prawo_glosu)} onChange={(e) => zmien({ ...op, prawo_glosu: e.target.checked })} /> Prawo głosu przysługuje uprawnionemu</label>
            </>
          )}
          <Pole etykieta="Treść" opcjonalne blad={b('tresc')}><input type="text" value={op.tresc || ''} onChange={(e) => zmien({ ...op, tresc: e.target.value })} /></Pole>
        </>
      ) : (
        <>
          <WyborAtrybutu op={op} zmien={zmien} b={b} atrybuty={atrybuty} rodzaje={['zastaw', 'uzytkowanie', 'zajecie']} />
          {op.operacja === 'zmiana_prawa_glosu' && (
            <Pole etykieta="Prawo głosu przysługuje uprawnionemu" blad={b('prawo_glosu')}>
              <DwaPrzyciski wartosc={op.prawo_glosu} opcje={[[true, 'Tak'], [false, 'Nie']]} przyZmianie={(v) => zmien({ ...op, prawo_glosu: v })} />
            </Pole>
          )}
        </>
      )}
      <EdytorAkcji akcje={op.akcje} przyZmianie={(akcje) => zmien({ ...op, akcje })} b={(s) => b(`akcje${s ? `.${s}` : ''}`)} />
    </>
  );
}

function EdytorAdnotacji({ op, zmien, b, atrybuty, kontekst }) {
  return (
    <>
      {op.operacja === 'dodanie' && <Posiadanie kontekst={kontekst} osobaId={kontekst && kontekst.osobaId} />}
      <Pole etykieta="Czynność" blad={b('operacja')}>
        <select value={op.operacja || ''} onChange={(e) => zmien({ ...op, operacja: e.target.value, atrybut: null })}>
          <option value="dodanie">dodanie</option>
          <option value="wykreslenie">wykreślenie</option>
        </select>
      </Pole>
      {op.operacja === 'dodanie' ? (
        <>
          <Pole etykieta="Rodzaj" blad={b('rodzaj')}>
            <select value={op.rodzaj || ''} onChange={(e) => zmien({ ...op, rodzaj: e.target.value })}>
              {['uprawnienie', 'ograniczenie', 'obowiazek', 'niepokryte', 'inna'].map((r) => <option key={r} value={r}>{NAZWY_ATRYBUTOW[r].toLowerCase()}</option>)}
            </select>
          </Pole>
          <Pole etykieta="Treść" opcjonalne={op.rodzaj === 'niepokryte'} blad={b('tresc')}><textarea rows={2} value={op.tresc || ''} onChange={(e) => zmien({ ...op, tresc: e.target.value })} /></Pole>
        </>
      ) : (
        <WyborAtrybutu op={op} zmien={zmien} b={b} atrybuty={atrybuty} rodzaje={['uprawnienie', 'ograniczenie', 'obowiazek', 'niepokryte', 'inna']} />
      )}
      <EdytorAkcji akcje={op.akcje} przyZmianie={(akcje) => zmien({ ...op, akcje })} b={(s) => b(`akcje${s ? `.${s}` : ''}`)} />
    </>
  );
}

function EdytorZamkniecia({ op, zmien, b }) {
  return (
    <Pole etykieta="Powód zamknięcia rejestru" blad={b('powod')}>
      <select value={op.powod || ''} onChange={(e) => zmien({ ...op, powod: e.target.value })}>
        <option value="">— wybierz —</option>
        <option value="przekazanie">przekazanie rejestru innemu podmiotowi</option>
        <option value="wykreslenie_spolki">wykreślenie spółki z KRS</option>
        <option value="rozwiazanie_umowy">rozwiązanie umowy</option>
      </select>
    </Pole>
  );
}

function EdytorOtwarcia({ op, zmien, b }) {
  return (
    <>
      <Pole etykieta="Źródło" blad={b('zrodlo')}>
        <select value={op.zrodlo || ''} onChange={(e) => zmien({ ...op, zrodlo: e.target.value })}>
          <option value="zalozenie">założenie spółki</option>
          <option value="przejecie">przejęcie rejestru</option>
        </select>
      </Pole>
      <h4>Serie</h4>
      <Lista
        elementy={op.serie || []}
        przyZmianie={(serie) => zmien({ ...op, serie })}
        nowy={() => ({ seria: '', numery: '', liczba: '', data_wpisu_krs: '' })}
        etykietaDodania="Seria"
        render={(s, zm, i) => (
          <div className="wiersz-akcji">
            <Pole etykieta="Seria" blad={b(`serie.${i}.seria`)}><input type="text" className="krotkie" value={s.seria || ''} onChange={(e) => zm({ ...s, seria: e.target.value })} /></Pole>
            <Pole etykieta="Numery" blad={b(`serie.${i}.numery`)}><input type="text" value={s.numery || ''} onChange={(e) => zm({ ...s, numery: e.target.value })} /></Pole>
            <Pole etykieta="Liczba" blad={b(`serie.${i}.liczba`)}><input type="text" className="krotkie" value={s.liczba ?? ''} onChange={(e) => zm({ ...s, liczba: e.target.value })} /></Pole>
            <Pole etykieta="Wpis do KRS" blad={b(`serie.${i}.data_wpisu_krs`)}><PoleDaty wartosc={s.data_wpisu_krs || ''} przyZmianie={(d) => zm({ ...s, data_wpisu_krs: d })} /></Pole>
          </div>
        )}
      />
      <h4>Akcjonariusze</h4>
      <Lista
        elementy={op.akcjonariusze || []}
        przyZmianie={(akcjonariusze) => zmien({ ...op, akcjonariusze })}
        nowy={() => ({ osoba_id: null, akcje: [NOWA_AKCJA()] })}
        etykietaDodania="Akcjonariusz"
        render={(a, zm, i) => (
          <>
            <Pole etykieta={`Akcjonariusz ${i + 1}`} blad={b(`akcjonariusze.${i}.osoba_id`)}><WyborOsoby wartosc={a.osoba_id} przyZmianie={(id) => zm({ ...a, osoba_id: id })} /></Pole>
            <EdytorAkcji akcje={a.akcje} przyZmianie={(akcje) => zm({ ...a, akcje })} b={(s) => b(`akcjonariusze.${i}.akcje${s ? `.${s}` : ''}`)} ulamek />
          </>
        )}
      />
      <h4>Obciążenia i adnotacje</h4>
      <Lista
        elementy={op.atrybuty || []}
        minimum={0}
        przyZmianie={(atrybuty) => zmien({ ...op, atrybuty })}
        nowy={() => ({ rodzaj: 'ograniczenie', akcje: [NOWA_AKCJA()], tresc: '', osoba_id: null, prawo_glosu: false })}
        etykietaDodania="Obciążenie albo adnotacja"
        render={(t, zm, i) => (
          <>
            <Pole etykieta="Rodzaj" blad={b(`atrybuty.${i}.rodzaj`)}>
              <select value={t.rodzaj} onChange={(e) => zm({ ...t, rodzaj: e.target.value })}>
                {Object.entries(NAZWY_ATRYBUTOW).map(([k, n]) => <option key={k} value={k}>{n.toLowerCase()}</option>)}
              </select>
            </Pole>
            {['zastaw', 'uzytkowanie'].includes(t.rodzaj) && (
              <Pole etykieta="Uprawniony" blad={b(`atrybuty.${i}.osoba_id`)}><WyborOsoby wartosc={t.osoba_id} przyZmianie={(id) => zm({ ...t, osoba_id: id })} /></Pole>
            )}
            <Pole etykieta="Treść" opcjonalne><input type="text" value={t.tresc || ''} onChange={(e) => zm({ ...t, tresc: e.target.value })} /></Pole>
            <EdytorAkcji akcje={t.akcje} przyZmianie={(akcje) => zm({ ...t, akcje })} b={(s) => b(`atrybuty.${i}.akcje${s ? `.${s}` : ''}`)} />
          </>
        )}
      />
      <h4>Akcje umorzone</h4>
      <Lista
        elementy={op.umorzone || []}
        minimum={0}
        przyZmianie={(umorzone) => zmien({ ...op, umorzone })}
        nowy={() => ({ ...NOWA_AKCJA(), podstawa: 'uchwala' })}
        etykietaDodania="Akcje umorzone"
        render={(m, zm, i) => (
          <div className="wiersz-akcji">
            <Pole etykieta="Seria" blad={b(`umorzone.${i}.seria`)}><input type="text" className="krotkie" value={m.seria || ''} onChange={(e) => zm({ ...m, seria: e.target.value })} /></Pole>
            <Pole etykieta="Numery" blad={b(`umorzone.${i}.numery`)}><input type="text" value={m.numery || ''} onChange={(e) => zm({ ...m, numery: e.target.value })} /></Pole>
            <Pole etykieta="Liczba" blad={b(`umorzone.${i}.liczba`)}><input type="text" className="krotkie" value={m.liczba ?? ''} onChange={(e) => zm({ ...m, liczba: e.target.value })} /></Pole>
            <Pole etykieta="Podstawa"><select value={m.podstawa} onChange={(e) => zm({ ...m, podstawa: e.target.value })}><option value="uchwala">uchwała</option><option value="orzeczenie">orzeczenie sądu</option></select></Pole>
          </div>
        )}
      />
    </>
  );
}

function EdytorSprostowania({ op, zmien, b, atrybuty, kontekst }) {
  const Edytor = op.zamiast && EDYTORY[op.zamiast.typ];
  return (
    <>
      <p>Wpis nr {op.zdarzenie_id}{op.zamiast ? ` — ${NAZWY_TYPOW[op.zamiast.typ]}` : ''}</p>
      <Pole etykieta="Sprostowanie" blad={b('tryb')}>
        <DwaPrzyciski wartosc={op.tryb} opcje={[['zastap', 'Popraw treść wpisu'], ['wycofaj', 'Wycofaj wpis']]} przyZmianie={(v) => zmien({ ...op, tryb: v })} />
      </Pole>
      {b('zamiast') && <p className="pole-blad">{b('zamiast')}</p>}
      {op.tryb === 'zastap' && Edytor && (
        <div className="podsekcja">
          <Edytor op={op.zamiast} zmien={(z) => zmien({ ...op, zamiast: z })} b={(s) => b(`zamiast.${s}`)} atrybuty={atrybuty} kontekst={kontekst} />
        </div>
      )}
    </>
  );
}

const EDYTORY = {
  przeniesienie: EdytorPrzeniesienia,
  emisja: EdytorEmisji,
  umorzenie: EdytorUmorzenia,
  obciazenie: EdytorObciazenia,
  adnotacja: EdytorAdnotacji,
  sprostowanie: EdytorSprostowania,
  zamkniecie: EdytorZamkniecia,
  otwarcie: EdytorOtwarcia,
};

/* ── Strona wpisu ── */

const POLA_ROBOCZE = ['zadajacy', 'zadajacy_osoba_id', 'zadajacy_opis', 'data_wplywu', 'operacje', 'podstawa', 'podstawa_data'];
const robocza = (s) => Object.fromEntries(POLA_ROBOCZE.map((k) => [k, s[k] ?? (k === 'operacje' ? [] : null)]));

const RODZAJE_WPISU = [
  ['przeniesienie', 'Zbycie akcji'],
  ['obciazenie', 'Zastaw, użytkowanie albo zajęcie'],
  ['umorzenie', 'Umorzenie akcji'],
  ['adnotacja', 'Ograniczenie, uprawnienie albo obowiązek'],
  ['emisja', 'Nowa emisja'],
];

/** Zmiana wybranego rodzaju; przy zbyciu akcjonariusz z wiersza rejestru jest zbywcą. */
function nowaZmiana(typ, osobaId) {
  const op = NOWE_ZMIANY[typ]();
  if (typ === 'przeniesienie' && osobaId) op.zbywca_osoba_id = osobaId;
  return op;
}

/**
 * Autozapis treści: 600 ms po ostatniej zmianie; `teraz()` — od razu (przed czynnością). Zapisy idą jeden po
 * drugim. Sprawa powstaje przy pierwszym zapisie (`zaloz`) — otwarcie formularza niczego nie zakłada.
 */
function useZapisSprawy(idPoczatkowe, tresc, { zaloz, przyZapisie }) {
  const [stan, ustawStan] = useState({ stan: 'spoczynek', blad: null });
  const id = useRef(idPoczatkowe);
  const ostatnia = useRef(JSON.stringify(tresc));
  const czekajacy = useRef(null);
  const kolejka = useRef(Promise.resolve(true));
  const zapisz = useCallback((t, wymus = false) => {
    kolejka.current = kolejka.current.then(async () => {
      const tekst = JSON.stringify(t);
      if (tekst === ostatnia.current && (id.current || !wymus)) return true;
      ustawStan({ stan: 'zapisywanie', blad: null });
      try {
        let p;
        if (!id.current) {
          p = await zaloz(t);
          id.current = p.sprawa.id;
        } else p = await API.put(`/api/psa/sprawy/${id.current}`, t);
        ostatnia.current = tekst;
        ustawStan({ stan: 'zapisano', blad: null });
        przyZapisie(p);
        return true;
      } catch (e) {
        ustawStan({ stan: 'blad', blad: e });
        return false;
      }
    });
    return kolejka.current;
  }, [zaloz, przyZapisie]);
  useEffect(() => {
    if (JSON.stringify(tresc) === ostatnia.current) return undefined;
    clearTimeout(czekajacy.current);
    czekajacy.current = setTimeout(() => zapisz(tresc), 600);
    return () => clearTimeout(czekajacy.current);
  }, [tresc, zapisz]);
  return {
    ...stan,
    id: () => id.current,
    teraz: (wymus = false) => { clearTimeout(czekajacy.current); return zapisz(tresc, wymus); },
    /** Treść przyjęta z serwera (np. po „Zmień treść”) — nie jest zmianą do zapisania. */
    przyjmij: (t) => { ostatnia.current = JSON.stringify(t); },
  };
}

/** Osoba do powiadomienia przed wpisem: powiadomienie o zamierzonym wpisie albo zgoda (art. 300³⁴ § 3 KSH). */
function KafelOsoby({ o, sprawa, pliki, zapisz, odswiez }) {
  const [zgoda, ustawZgode] = useState(null);
  const pow = o.powiadomienie;
  const linia = o.zgoda ? `Zgoda na wpis z ${fmt.data(o.zgoda.data)}`
    : pow && pow.stan === 'wyslane' ? `Powiadomienie wysłane ${fmt.data(pow.wyslano)}`
      : pow && pow.stan === 'blad' ? 'Błąd wysyłki powiadomienia'
        : pow ? `Powiadomienie gotowe — ${KANALY[pow.kanal] || pow.kanal}` : 'Traci uprawnienia — przed wpisem trzeba ją powiadomić albo mieć jej zgodę.';
  const zapiszZgode = () => zapisz({ zgody: [...(sprawa.zgody || []), { osoba_id: o.osoba_id, dopuszczalna: zgoda.dopuszczalna, data: zgoda.data, plik_id: zgoda.plik_id || null }] }).then((ok) => ok && ustawZgode(null));
  return (
    <div className="kafel-osoby">
      <div className="rzad-rozdzielony">
        <a href={`#/osoby/${o.osoba_id}`}><strong>{o.nazwa}</strong></a>
        {o.dopisana && !pow && <button type="button" className="btn btn-maly" onClick={() => zapisz({ dopisane: (sprawa.dopisane || []).filter((x) => x !== o.osoba_id) })}>Usuń</button>}
      </div>
      <div className="kafel-osoby-stan">{linia}</div>
      <div className="rzad">
        {pow && !o.zgoda && pow.stan !== 'wyslane' && <CzynnosciPisma p={pow} poZmianie={odswiez} />}
        {pow && <a className="btn btn-maly" href={adresPdf(pow.id)} target="_blank" rel="noopener">Podgląd</a>}
        {!o.zgoda && !zgoda && <button type="button" className="btn btn-maly" onClick={() => ustawZgode({ data: fmt.dzisIso(), dopuszczalna: false, plik_id: '' })}>Odnotuj zgodę na wpis</button>}
        {o.zgoda && <button type="button" className="btn btn-maly" onClick={() => zapisz({ zgody: (sprawa.zgody || []).filter((z) => z.osoba_id !== o.osoba_id) })}>Cofnij zgodę</button>}
      </div>
      {zgoda && (
        <div className="podsekcja">
          <Pole etykieta="Data zgody"><PoleDaty wartosc={zgoda.data} przyZmianie={(d) => ustawZgode({ ...zgoda, data: d })} max={fmt.dzisIso()} /></Pole>
          <label className="chk"><input type="checkbox" checked={zgoda.dopuszczalna} onChange={(e) => ustawZgode({ ...zgoda, dopuszczalna: e.target.checked })} /> <span className="chk-tresc">Zgoda w dopuszczalnej formie (podpis poświadczony, złożony w kancelarii, kwalifikowany, zaufany albo osobisty)</span></label>
          {pliki.length > 0 && (
            <Pole etykieta="Plik zgody" opcjonalne>
              <select value={zgoda.plik_id} onChange={(e) => ustawZgode({ ...zgoda, plik_id: e.target.value ? Number(e.target.value) : '' })}>
                <option value="">— bez pliku —</option>
                {pliki.map((f) => <option key={f.id} value={f.id}>{f.nazwa}</option>)}
              </select>
            </Pole>
          )}
          <div className="rzad">
            <button type="button" className="btn btn-maly btn-glowny" onClick={zapiszZgode}>Zapisz zgodę</button>
            <button type="button" className="btn btn-maly" onClick={() => ustawZgode(null)}>Anuluj</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SekcjaWpisu({ numer, tytul, akcje, children }) {
  return (
    <section className="karta sekcja-wpisu">
      <div className="rzad-rozdzielony sekcja-wpisu-naglowek">
        <h2 className="karta-tytul"><span className="numer-sekcji">{numer}.</span> {tytul}</h2>
        {akcje}
      </div>
      {children}
    </section>
  );
}

/** Nowy wpis z rejestru spółki: formularz bez sprawy — sprawa powstanie przy pierwszej zmianie. */
function EkranNowegoWpisu({ spolkaId }) {
  const { dane, blad } = useDane(`/api/psa/spolki/${spolkaId}`);
  const [parametry] = useState(() => biezacaTrasa().zapytanie);
  if (blad) return <Bledy blad={blad} />;
  if (!dane) return <Spinner />;
  const otwarty = Boolean(dane.spolka.data_otwarcia) && !dane.spolka.data_zamkniecia;
  if (!otwarty) return <Karta><Pusto tytul="Rejestr nie jest otwarty" opis="Wpisów dokonuje się w otwartym rejestrze." akcja={<a className="btn" href={`#/spolki/${spolkaId}`}>Wróć do rejestru</a>} /></Karta>;
  const typ = parametry.get('typ');
  const osobaId = Number(parametry.get('osoba')) || null;
  const p = {
    sprawa: { id: null, stan: 'w_toku', zadajacy: 'spolka', zadajacy_osoba_id: null, zadajacy_opis: null, data_wplywu: fmt.dzisIso(), operacje: typ && NOWE_ZMIANY[typ] ? [nowaZmiana(typ, osobaId)] : [], podstawa: null, podstawa_data: null, checklista: {}, zgody: [], dopisane: [], oplata: null },
    spolka: { id: dane.spolka.id, nazwa: dane.spolka.nazwa, krs: dane.spolka.krs },
    krok: 1, termin: null, pisma: [], pliki: [], bledy: [], opis: null,
    stan_przed: dane.rejestr, stan_po: null, nazwy: dane.osoby, osoby: [], checklista: [], oplata: { wymagana: false }, przeszkody_wpisu: [],
  };
  return <Wpis p={p} kontekstOsoba={osobaId} />;
}

function EkranSprawy({ sprawaId }) {
  const { dane, blad } = useDane(`/api/psa/sprawy/${sprawaId}`);
  if (blad) return <Bledy blad={blad} />;
  if (!dane) return <Spinner />;
  return <Wpis key={dane.sprawa.id} p={dane} />;
}

function Wpis({ p: poczatkowy, kontekstOsoba = null }) {
  const [p, ustawP] = useState(poczatkowy);
  const s = p.sprawa;
  const otwarta = ['w_toku', 'wstrzymana'].includes(s.stan);
  const zatwierdzona = p.krok >= 2;
  const [tresc, ustawTresc] = useState(() => robocza(s));
  const [panel, ustawPanel] = useState(null);
  const [pole, ustawPole] = useState('');
  const [proba, ustawProbe] = useState(false); // błędy przy polach pokazują się dopiero po próbie przejścia dalej
  const [dodawanie, ustawDodawanie] = useState(false);
  const c = useCzynnosc();

  const przyZapisie = useCallback((nowy) => {
    ustawP((stary) => ({ ...stary, ...nowy }));
    // Adres bez przeładowania ekranu: formularz zostaje, a odświeżenie strony wróci do tej samej sprawy.
    if (nowy.sprawa && !biezacaTrasa().sciezka.startsWith('/sprawy/')) window.history.replaceState(window.history.state, '', `#/sprawy/${nowy.sprawa.id}`);
  }, []);
  const klucz = useRef(`${p.spolka.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const zaloz = useCallback((t) => API.post('/api/psa/sprawy', { spolka_id: p.spolka.id, klucz_idempotencji: klucz.current, ...t }), [p.spolka.id]);
  const zapis = useZapisSprawy(s.id, tresc, { zaloz, przyZapisie });

  /** Sprawa musi istnieć przed czynnością, która zapisuje coś poza treścią (plik, checklista, zgoda). */
  const idSprawy = async () => ((await zapis.teraz(true)) ? zapis.id() : Promise.reject(new Error('Nie udało się zapisać wpisu.')));
  const przeladuj = async () => { const id = zapis.id(); if (id) ustawP(await API.get(`/api/psa/sprawy/${id}`)); };
  const zapisz = (zmiany) => c.wykonaj(async () => { ustawP(await API.put(`/api/psa/sprawy/${await idSprawy()}`, zmiany)); return true; });
  const zmienStan = (stan, dane = {}) => c.wykonaj(async () => { ustawP(await API.post(`/api/psa/sprawy/${await idSprawy()}/stan`, { stan, ...dane })); ustawPanel(null); ustawPole(''); });
  const krokNa = async (k) => {
    const nowy = await API.post(`/api/psa/sprawy/${await idSprawy()}/krok`, { krok: k });
    ustawP(nowy);
    if (k === 1) { const t = robocza(nowy.sprawa); zapis.przyjmij(t); ustawTresc(t); }
    return nowy;
  };

  const bledyTresci = p.bledy || [];
  const pola = proba ? { ...bledyApi({ bledy: bledyTresci }).pola, ...bledyApi(zapis.blad).pola, ...bledyApi(c.blad).pola } : { ...bledyApi(c.blad).pola };
  const komunikat = (x) => (typeof x === 'object' ? x.komunikat : x);
  const braki = !tresc.operacje.length ? ['Wybierz rodzaj wpisu i uzupełnij dane.']
    : !s.id ? []
      : [...new Set((bledyTresci.length ? bledyTresci : p.przeszkody_wpisu || []).map(komunikat))];
  const bezZgody = (p.osoby || []).filter((o) => !o.zgoda);
  const doPrzygotowania = !zatwierdzona && bezZgody.length > 0 && !bledyTresci.length;
  const brakiPozaPowiadomieniem = (p.przeszkody_wpisu || []).filter((x) => !(typeof x === 'object' && x.pole === 'osoby'));

  const naGore = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  async function wpisz() {
    if (!(await zapis.teraz(true))) { ustawProbe(true); return; }
    const aktualny = await API.get(`/api/psa/sprawy/${zapis.id()}`);
    ustawP(aktualny);
    const przeszkody = aktualny.bledy.length ? aktualny.bledy : aktualny.przeszkody_wpisu || [];
    if (przeszkody.length) { ustawProbe(true); if (aktualny.bledy.length) naGore(); return; }
    const tak = await potwierdz({ tytul: 'Dokonać wpisu?', tresc: `${aktualny.opis || ''} Wpisu nie można cofnąć — pomyłkę poprawia sprostowanie.`.trim(), akcja: 'Dokonaj wpisu' });
    if (!tak) return;
    await c.wykonaj(async () => {
      if (aktualny.krok < 2) await krokNa(2);
      ustawP(await API.post(`/api/psa/sprawy/${zapis.id()}/stan`, { stan: 'wpisana' }));
    });
  }
  const przygotuj = () => c.wykonaj(async () => {
    if (!(await zapis.teraz(true))) { ustawProbe(true); return; }
    const aktualny = await API.get(`/api/psa/sprawy/${zapis.id()}`);
    if (aktualny.bledy.length) { ustawP(aktualny); ustawProbe(true); naGore(); return; }
    await krokNa(2);
  });
  async function wycofaj() {
    const tak = await potwierdz({ tytul: 'Wycofać żądanie wpisu?', tresc: 'Sprawa zostanie zakończona bez wpisu.', akcja: 'Wycofaj', niebezpieczna: true });
    if (tak) zmienStan('wycofana');
  }
  async function zmienTresc() {
    const wyslane = (p.osoby || []).some((o) => o.powiadomienie && o.powiadomienie.stan === 'wyslane');
    const tak = !wyslane || await potwierdz({ tytul: 'Zmienić treść wpisu?', tresc: 'Wysłane powiadomienia o zamierzonym wpisie stracą ważność — po zmianie trzeba je wysłać ponownie.', akcja: 'Zmień treść' });
    if (tak) c.wykonaj(() => krokNa(1));
  }

  const zNazwa = (x) => ({ ...x, pismo: NAZWY_PISM[x.typ], adresat_nazwa: (x.kontekst || {}).adresat_nazwa });
  const pismaWpisu = p.pisma.filter((x) => x.typ === 'powiadomienie_wpis').map(zNazwa);
  const pozostale = p.pisma.filter((x) => x.typ !== 'powiadomienie_wpis' && !(otwarta && x.typ === 'powiadomienie_zamierzony')).map(zNazwa);
  const doWyslania = pismaWpisu.filter((x) => x.kanal === 'email' && x.stan !== 'wyslane');
  const wyslijPisma = () => c.wykonaj(async () => {
    for (const x of doWyslania) await API.post(`/api/psa/korespondencja/${x.id}/wyslij`);
    await przeladuj();
  });

  const typy = [...new Set(tresc.operacje.map((o) => o.typ))];
  const tytul = !tresc.operacje.length ? 'Nowy wpis' : typy.length === 1 ? (RODZAJE_WPISU.find(([t]) => t === typy[0]) || [null, NAZWY_TYPOW[typy[0]] || 'Wpis'])[1] : 'Wpis — kilka zmian';
  const samodzielna = tresc.operacje.some((o) => ['otwarcie', 'sprostowanie', 'zamkniecie'].includes(o.typ));
  const kontekst = { widok: p.stan_przed, osoby: p.nazwy, osobaId: kontekstOsoba };
  const atrybuty = p.stan_przed ? p.stan_przed.atrybuty : [];
  const z = (k) => (v) => ustawTresc({ ...tresc, [k]: v });
  const zmienOp = (i) => (op) => ustawTresc({ ...tresc, operacje: tresc.operacje.map((x, j) => (j === i ? op : x)) });
  const dodajZmiane = (typ) => { ustawTresc({ ...tresc, operacje: [...tresc.operacje, nowaZmiana(typ, kontekstOsoba)] }); ustawDodawanie(false); };
  const zmianaObciazen = p.stan_po && JSON.stringify(p.stan_po.atrybuty) !== JSON.stringify(p.stan_przed.atrybuty);

  let glowny = null;
  if (s.stan === 'wstrzymana') glowny = { etykieta: 'Wznów', przyKlik: () => ustawPanel('wznow') };
  else if (otwarta && doPrzygotowania) glowny = { etykieta: 'Przygotuj powiadomienia', przyKlik: przygotuj };
  else if (otwarta) glowny = { etykieta: 'Dokonaj wpisu', przyKlik: wpisz };

  return (
    <div className="ekran-wpisu">
      <NaglowekStrony
        tytul={tytul}
        kontekst={(
          <span className="rzad">
            <a href={`#/spolki/${p.spolka.id}`}>{p.spolka.nazwa}</a>
            {s.id && <span>sprawa nr {s.id}</span>}
            {p.termin && <span className={p.termin.po_terminie || p.termin.pilny ? 'pilne' : ''}>{opisTerminu(p.termin)}</span>}
            {s.id && s.stan !== 'w_toku' && <Pigulka odmiana={ODMIANY_STANU_SPRAWY[s.stan]}>{STANY_SPRAWY[s.stan]}</Pigulka>}
          </span>
        )}
        akcje={(
          <span className="rzad">
            {!s.id && <a className="btn" href={`#/spolki/${p.spolka.id}`}>Anuluj</a>}
            <Wiecej akcje={[
              s.id && s.stan === 'w_toku' && { etykieta: 'Wstrzymaj — wezwij do uzupełnienia', przyKlik: () => ustawPanel('wstrzymaj') },
              s.id && otwarta && { etykieta: 'Odmów wpisu', przyKlik: () => ustawPanel('odmow'), niebezpieczna: true },
              s.id && otwarta && { etykieta: 'Wycofaj żądanie', przyKlik: wycofaj, niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      <Bledy blad={c.blad} />

      {panel === 'wstrzymaj' && (
        <Karta tytul="Wstrzymaj — wezwanie do uzupełnienia">
          <Pole etykieta="Treść wezwania" blad={bledyApi(c.blad).pola.tresc_wezwania}><textarea rows={3} value={pole} onChange={(e) => ustawPole(e.target.value)} /></Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={() => zmienStan('wstrzymana', { tresc_wezwania: pole })} disabled={c.trwa}>Wstrzymaj i przygotuj wezwanie</button>
            <button type="button" className="btn" onClick={() => ustawPanel(null)}>Anuluj</button>
          </div>
        </Karta>
      )}
      {panel === 'wznow' && (
        <Karta tytul="Wznów">
          <Pole etykieta="Data usunięcia przeszkody" opcjonalne podpowiedz="Domyślnie dzień ostatniego pliku w sprawie." blad={bledyApi(c.blad).pola.data_usuniecia_przeszkody}>
            <PoleDaty wartosc={pole} przyZmianie={ustawPole} max={fmt.dzisIso()} />
          </Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={() => zmienStan('w_toku', pole ? { data_usuniecia_przeszkody: pole } : {})} disabled={c.trwa}>Wznów</button>
            <button type="button" className="btn" onClick={() => ustawPanel(null)}>Anuluj</button>
          </div>
        </Karta>
      )}
      {panel === 'odmow' && (
        <Modal
          tytul="Odmowa wpisu"
          przyZamknieciu={() => ustawPanel(null)}
          stopka={(
            <>
              <button type="button" className="btn" onClick={() => ustawPanel(null)}>Anuluj</button>
              <button type="button" className="btn btn-danger" onClick={() => zmienStan('odmowa', { przyczyna: pole })} disabled={c.trwa}>Odmów wpisu</button>
            </>
          )}
        >
          <Pole etykieta="Przyczyna odmowy" blad={bledyApi(c.blad).pola.przyczyna}><textarea rows={3} value={pole} onChange={(e) => ustawPole(e.target.value)} /></Pole>
          <p className="male drugorzedny">Odmowy nie można cofnąć. Powiadomienie o odmowie trafi do Korespondencji.</p>
        </Modal>
      )}

      {s.stan === 'wstrzymana' && <Komunikat odmiana="uwaga" tresc={`Wstrzymano ${fmt.data(s.wstrzymana_od)} — termin nie biegnie do usunięcia przeszkody.`} />}
      {s.stan === 'odmowa' && <Komunikat odmiana="uwaga" tytul="Odmowa wpisu" tresc={s.przyczyna_odmowy} />}
      {s.stan === 'wycofana' && <Komunikat tresc="Żądanie wycofane — bez wpisu." />}
      {s.stan === 'wpisana' && <Komunikat odmiana="rejestr" tytul="Wpisano do rejestru" tresc={p.opis || ''} />}

      {otwarta && (
        <>
          <SekcjaWpisu
            numer={1}
            tytul="Co się zmienia"
            akcje={zatwierdzona && <button type="button" className="btn btn-maly" disabled={c.trwa} onClick={zmienTresc}>Zmień treść</button>}
          >
            {zatwierdzona && <p className="male drugorzedny">Treść jest zatwierdzona — powiadomienia powstały z tej treści.</p>}
            {pola.operacje && <p className="pole-blad">{pola.operacje}</p>}
            <fieldset className="pola-wpisu" disabled={zatwierdzona}>
              {!tresc.operacje.length && (
                <div className="wybor-rodzaju" role="group" aria-label="Rodzaj wpisu">
                  {RODZAJE_WPISU.map(([typ, nazwa]) => <button key={typ} type="button" className="btn" onClick={() => dodajZmiane(typ)}>{nazwa}</button>)}
                </div>
              )}
              {tresc.operacje.map((op, i) => {
                const Edytor = EDYTORY[op.typ];
                const b = (sciezka) => pola[`operacje.${i}${sciezka ? `.${sciezka}` : ''}`];
                return (
                  <div className="zmiana" key={i}>
                    {tresc.operacje.length > 1 && (
                      <div className="rzad-rozdzielony">
                        <h3 className="tytul-zmiany">{i + 1}. {NAZWY_TYPOW[op.typ] || op.typ}</h3>
                        {!zatwierdzona && <button type="button" className="btn btn-maly" onClick={() => ustawTresc({ ...tresc, operacje: tresc.operacje.filter((_, j) => j !== i) })}>Usuń zmianę</button>}
                      </div>
                    )}
                    {b('typ') && <p className="pole-blad">{b('typ')}</p>}
                    {Edytor ? <Edytor op={op} zmien={zmienOp(i)} b={b} atrybuty={atrybuty} kontekst={kontekst} /> : <p>Nieznany rodzaj zmiany.</p>}
                  </div>
                );
              })}
              {tresc.operacje.length > 0 && !samodzielna && !zatwierdzona && (dodawanie ? (
                <div className="wybor-rodzaju" role="group" aria-label="Kolejna zmiana">
                  {RODZAJE_WPISU.map(([typ, nazwa]) => <button key={typ} type="button" className="btn btn-maly" onClick={() => dodajZmiane(typ)}>{nazwa}</button>)}
                  <button type="button" className="btn btn-maly" onClick={() => ustawDodawanie(false)}>Anuluj</button>
                </div>
              ) : (
                <div className="rzad">
                  <button type="button" className="btn btn-maly" onClick={() => ustawDodawanie(true)}>+ Kolejna zmiana w tym wpisie</button>
                  {tresc.operacje.length === 1 && !s.id && <button type="button" className="btn btn-maly" onClick={() => ustawTresc({ ...tresc, operacje: [] })}>Zmień rodzaj wpisu</button>}
                </div>
              ))}
            </fieldset>
          </SekcjaWpisu>

          <SekcjaWpisu numer={2} tytul="Podstawa">
            <fieldset className="pola-wpisu" disabled={zatwierdzona}>
              <div className="siatka-2">
                <Pole etykieta="Dokument" opcjonalne podpowiedz="np. umowa sprzedaży akcji z 3.11.2026" blad={pola.podstawa}>
                  <input type="text" value={tresc.podstawa || ''} onChange={(e) => z('podstawa')(e.target.value)} />
                </Pole>
                <Pole etykieta="Data dokumentu" opcjonalne blad={pola.podstawa_data}><PoleDaty wartosc={tresc.podstawa_data || ''} przyZmianie={z('podstawa_data')} max={fmt.dzisIso()} /></Pole>
                <Pole etykieta="Kto żąda wpisu" blad={pola.zadajacy}>
                  <select value={tresc.zadajacy || ''} onChange={(e) => z('zadajacy')(e.target.value)}>
                    <option value="spolka">spółka</option>
                    <option value="osoba">osoba z kartoteki</option>
                    <option value="organ">organ (zajęcie)</option>
                    <option value="brak">bez żądającego (sprostowanie z inicjatywy kancelarii)</option>
                  </select>
                </Pole>
                <Pole etykieta="Żądanie wpłynęło" blad={pola.data_wplywu} podpowiedz="Od tego dnia biegnie 7 dni na wpis.">
                  <PoleDaty wartosc={tresc.data_wplywu || ''} przyZmianie={z('data_wplywu')} max={fmt.dzisIso()} />
                </Pole>
              </div>
              {tresc.zadajacy === 'osoba' && (
                <Pole etykieta="Osoba żądająca" blad={pola.zadajacy_osoba_id}><WyborOsoby wartosc={tresc.zadajacy_osoba_id} przyZmianie={z('zadajacy_osoba_id')} /></Pole>
              )}
              {tresc.zadajacy === 'organ' && (
                <Pole etykieta="Organ i sygnatura" blad={pola.zadajacy_opis}><input type="text" value={tresc.zadajacy_opis || ''} onChange={(e) => z('zadajacy_opis')(e.target.value)} /></Pole>
              )}
            </fieldset>
            <ListaPlikow pliki={p.pliki} />
            <DodajPlik adres={async () => `/api/psa/sprawy/${await idSprawy()}/pliki`} przyDodaniu={przeladuj} />
          </SekcjaWpisu>

          <SekcjaWpisu numer={3} tytul="Przed wpisem">
            {!s.id || !p.stan_po ? (
              <p className="male drugorzedny">Po uzupełnieniu danych wpisu pojawią się tu osoby do powiadomienia, lista do sprawdzenia i opłata.</p>
            ) : (
              <>
                <h3 className="tytul-zmiany">Powiadomienie o zamierzonym wpisie</h3>
                {!p.osoby.length && <p className="male drugorzedny">Ten wpis nikomu nie odbiera uprawnień — powiadomienie nie jest potrzebne.</p>}
                <div className="kafle-osob">
                  {p.osoby.map((o) => <KafelOsoby key={o.osoba_id} o={o} sprawa={s} pliki={p.pliki} zapisz={zapisz} odswiez={przeladuj} />)}
                </div>
                {dodawanie === 'osoba' ? (
                  <Pole etykieta="Dopisz osobę do powiadomienia">
                    <WyborOsoby wartosc={null} wyklucz={p.osoby.map((o) => o.osoba_id)} przyZmianie={(id) => id && zapisz({ dopisane: [...(s.dopisane || []), id] }).then(() => ustawDodawanie(false))} />
                  </Pole>
                ) : <button type="button" className="btn btn-maly" onClick={() => ustawDodawanie('osoba')}>+ Dopisz osobę do powiadomienia</button>}

                <h3 className="tytul-zmiany">Sprawdzone</h3>
                <div className="checklista">
                  {p.checklista.map((x) => (
                    <label key={x.klucz} className="chk">
                      <input type="checkbox" checked={Boolean((s.checklista || {})[x.klucz])} onChange={(e) => zapisz({ checklista: { ...(s.checklista || {}), [x.klucz]: e.target.checked } })} />
                      <span className="chk-tresc">{x.etykieta} <span className="podstawa-prawna">{x.podstawa}</span></span>
                    </label>
                  ))}
                </div>

                {p.oplata.wymagana && (
                  <>
                    <h3 className="tytul-zmiany">Opłata za wpis</h3>
                    <div className="rzad" role="group" aria-label="Opłata za wpis">
                      {[['tak', 'Opłata 100 zł netto'], ['nie', 'Bez opłaty']].map(([v, n]) => (
                        <button key={v} type="button" className={`btn ${s.oplata === v ? 'btn-wybrany' : ''}`} aria-pressed={s.oplata === v} onClick={() => zapisz({ oplata: v })}>{n}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </SekcjaWpisu>

          <SekcjaWpisu numer={4} tytul={p.stan_po ? 'Po wpisie' : 'Stan rejestru przed wpisem'}>
            <TabelaAkcjonariuszy widok={p.stan_po || p.stan_przed} przed={p.stan_po ? p.stan_przed : null} osoby={p.nazwy} />
            {zmianaObciazen && (
              <>
                <h3 className="tytul-zmiany">Obciążenia, ograniczenia, obowiązki po wpisie</h3>
                <TabelaAtrybutow widok={p.stan_po} osoby={p.nazwy} />
              </>
            )}
          </SekcjaWpisu>

          <div className="pasek-wpisu">
            <div className="pasek-wpisu-braki" aria-live="polite">
              {braki.length > 0 ? (
                <>
                  <strong>Zostało do zrobienia</strong>
                  <ul>{braki.map((b) => <li key={b}>{b}</li>)}</ul>
                </>
              ) : s.id && !doPrzygotowania && !brakiPozaPowiadomieniem.length ? <span>Wszystko gotowe do wpisu.</span> : null}
              {zapis.blad && <p className="pole-blad">{komunikat((bledyApi(zapis.blad).lista || [])[0]) || 'Nie udało się zapisać zmian.'}</p>}
            </div>
            <div className="rzad">
              <StanZapisu stan={zapis.stan === 'blad' ? null : zapis} />
              {glowny && <button type="button" className="btn btn-glowny btn-duzy" onClick={glowny.przyKlik} disabled={c.trwa}>{c.trwa ? 'Chwileczkę…' : glowny.etykieta}</button>}
            </div>
          </div>
        </>
      )}

      {s.stan === 'wpisana' && (
        <Karta
          tytul="Powiadomienia o wpisie"
          akcje={doWyslania.length > 0 && <button type="button" className="btn btn-glowny" disabled={c.trwa} onClick={wyslijPisma}>Wyślij e-maile ({doWyslania.length})</button>}
        >
          <TabelaPism pisma={pismaWpisu} poZmianie={przeladuj} />
        </Karta>
      )}
      {!otwarta && p.opis && s.stan !== 'wpisana' && <Karta tytul="Treść żądania"><p>{p.opis}</p></Karta>}
      {pozostale.length > 0 && <Karta tytul="Pozostałe pisma"><TabelaPism pisma={pozostale} poZmianie={przeladuj} /></Karta>}
      {!otwarta && <Karta tytul="Pliki"><ListaPlikow pliki={p.pliki} /></Karta>}
      {!otwarta && <p><a className="btn" href={`#/spolki/${p.spolka.id}`}>Wróć do rejestru</a></p>}
    </div>
  );
}

/** Czynność z gotową treścią (wykreślenie, zmiana prawa głosu, sprostowanie, zamknięcie): zakłada sprawę i otwiera stronę wpisu. */
async function zalozSprawe(spolkaId, dane = {}) {
  const klucz = `${spolkaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const p = await API.post('/api/psa/sprawy', { spolka_id: spolkaId, zadajacy: 'spolka', operacje: [], klucz_idempotencji: klucz, ...dane });
  idz(`/sprawy/${p.sprawa.id}`);
}

Object.assign(window, { EkranSpraw, EkranSprawy, EkranNowegoWpisu, zalozSprawe, numeryDoPola });
