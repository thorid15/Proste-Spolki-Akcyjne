/* sprawy.js — lista spraw i ekran sprawy (= kreator wpisu, § 5): 1. Treść (zmiany, podstawa,
   pliki; autozapis), 2. Sprawdzenie (stan przed i po, osoby do powiadomienia, checklista, opłata),
   3. Pisma (powiadomienia o wpisie). Numery akcji zawsze wpisuje pracownik (U-26). */

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
      {dane && !dane.length && <Pusto tytul="Brak spraw" opis="Nową sprawę zakłada „Nowy wpis” w kokpicie spółki." />}
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

function EdytorPrzeniesienia({ op, zmien, b }) {
  return (
    <>
      <Pole etykieta="Zbywca" blad={b('zbywca_osoba_id')}><WyborOsoby wartosc={op.zbywca_osoba_id} przyZmianie={(id) => zmien({ ...op, zbywca_osoba_id: id })} /></Pole>
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

function EdytorUmorzenia({ op, zmien, b }) {
  return (
    <>
      <Pole etykieta="Podstawa" blad={b('podstawa')}>
        <DwaPrzyciski wartosc={op.podstawa} opcje={[['uchwala', 'Uchwała'], ['orzeczenie', 'Orzeczenie sądu']]} przyZmianie={(v) => zmien({ ...op, podstawa: v })} />
      </Pole>
      <EdytorAkcji akcje={op.akcje} przyZmianie={(akcje) => zmien({ ...op, akcje })} b={(s) => b(`akcje${s ? `.${s}` : ''}`)} />
    </>
  );
}

function EdytorObciazenia({ op, zmien, b, atrybuty }) {
  const ustanowienie = op.operacja === 'ustanowienie';
  return (
    <>
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

function EdytorAdnotacji({ op, zmien, b, atrybuty }) {
  return (
    <>
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

function EdytorSprostowania({ op, zmien, b, atrybuty }) {
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
          <Edytor op={op.zamiast} zmien={(z) => zmien({ ...op, zamiast: z })} b={(s) => b(`zamiast.${s}`)} atrybuty={atrybuty} />
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

/* ── Krok 1: treść ── */

const POLA_ROBOCZE = ['zadajacy', 'zadajacy_osoba_id', 'zadajacy_opis', 'data_wplywu', 'operacje', 'podstawa', 'podstawa_data'];
const robocza = (s) => Object.fromEntries(POLA_ROBOCZE.map((k) => [k, s[k] ?? (k === 'operacje' ? [] : null)]));

/** Autozapis treści sprawy (krok 1): zapis 600 ms po ostatniej zmianie, `teraz()` — przed „Dalej”. */
function useZapisSprawy(id, tresc, przyZapisie) {
  const [stan, ustawStan] = useState({ stan: 'spoczynek', blad: null });
  const ostatnia = useRef(JSON.stringify(tresc));
  const czekajacy = useRef(null);
  const zapisz = useCallback(async (t) => {
    const tekst = JSON.stringify(t);
    if (tekst === ostatnia.current) return true;
    ustawStan({ stan: 'zapisywanie', blad: null });
    try {
      const p = await API.put(`/api/psa/sprawy/${id}`, t);
      ostatnia.current = tekst;
      ustawStan({ stan: 'zapisano', blad: null });
      przyZapisie(p);
      return true;
    } catch (e) {
      ustawStan({ stan: 'blad', blad: e });
      return false;
    }
  }, [id, przyZapisie]);
  useEffect(() => {
    if (JSON.stringify(tresc) === ostatnia.current) return undefined;
    clearTimeout(czekajacy.current);
    czekajacy.current = setTimeout(() => zapisz(tresc), 600);
    return () => clearTimeout(czekajacy.current);
  }, [tresc, zapisz]);
  return { ...stan, teraz: () => { clearTimeout(czekajacy.current); return zapisz(tresc); } };
}

function KrokTresci({ p, tresc, ustawTresc, edycja, pola, odswiez }) {
  const z = (k) => (v) => ustawTresc({ ...tresc, [k]: v });
  const atrybuty = p.stan_przed ? p.stan_przed.atrybuty : [];
  const zmienOp = (i) => (op) => ustawTresc({ ...tresc, operacje: tresc.operacje.map((x, j) => (j === i ? op : x)) });
  const samodzielna = tresc.operacje.some((o) => ['otwarcie', 'sprostowanie', 'zamkniecie'].includes(o.typ));
  return (
    <fieldset className="krok-tresci" disabled={!edycja}>
      <Karta tytul="Żądający">
        <div className="siatka-2">
          <Pole etykieta="Kto żąda wpisu" blad={pola.zadajacy}>
            <select value={tresc.zadajacy || ''} onChange={(e) => z('zadajacy')(e.target.value)}>
              <option value="spolka">spółka</option>
              <option value="osoba">osoba z kartoteki</option>
              <option value="organ">organ (zajęcie)</option>
              <option value="brak">bez żądającego (sprostowanie z inicjatywy kancelarii)</option>
            </select>
          </Pole>
          <Pole etykieta="Data wpływu żądania" blad={pola.data_wplywu}>
            <PoleDaty wartosc={tresc.data_wplywu || ''} przyZmianie={z('data_wplywu')} max={fmt.dzisIso()} />
          </Pole>
        </div>
        {tresc.zadajacy === 'osoba' && (
          <Pole etykieta="Osoba żądająca" blad={pola.zadajacy_osoba_id}><WyborOsoby wartosc={tresc.zadajacy_osoba_id} przyZmianie={z('zadajacy_osoba_id')} /></Pole>
        )}
        {tresc.zadajacy === 'organ' && (
          <Pole etykieta="Organ i sygnatura" blad={pola.zadajacy_opis}><input type="text" value={tresc.zadajacy_opis || ''} onChange={(e) => z('zadajacy_opis')(e.target.value)} /></Pole>
        )}
      </Karta>

      <Karta tytul="Zmiany">
        {pola.operacje && <p className="pole-blad">{pola.operacje}</p>}
        {tresc.operacje.map((op, i) => {
          const Edytor = EDYTORY[op.typ];
          const b = (s) => pola[`operacje.${i}${s ? `.${s}` : ''}`];
          return (
            <div className="zmiana" key={i}>
              <div className="rzad-rozdzielony">
                <h3 className="tytul-sekcji">{i + 1}. {NAZWY_TYPOW[op.typ] || op.typ}</h3>
                {edycja && <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawTresc({ ...tresc, operacje: tresc.operacje.filter((_, j) => j !== i) })}>Usuń zmianę</button>}
              </div>
              {b('typ') && <p className="pole-blad">{b('typ')}</p>}
              {Edytor ? <Edytor op={op} zmien={zmienOp(i)} b={b} atrybuty={atrybuty} /> : <p>Nieznany rodzaj zmiany.</p>}
            </div>
          );
        })}
        {edycja && !samodzielna && (
          <div className="dodaj-zmiane rzad">
            <span className="male drugorzedny">Dodaj zmianę:</span>
            {[['przeniesienie', 'Przeniesienie'], ['emisja', 'Emisja'], ['umorzenie', 'Umorzenie'], ['obciazenie', 'Obciążenie'], ['adnotacja', 'Informacja o akcjach']].map(([typ, nazwa]) => (
              <button key={typ} type="button" className="btn btn-maly" onClick={() => ustawTresc({ ...tresc, operacje: [...tresc.operacje, NOWE_ZMIANY[typ]()] })}>{nazwa}</button>
            ))}
          </div>
        )}
      </Karta>

      <Karta tytul="Podstawa wpisu">
        <Pole etykieta="Opis dokumentu" opcjonalne podpowiedz="np. umowa sprzedaży akcji z 3.11.2026" blad={pola.podstawa}>
          <textarea rows={2} value={tresc.podstawa || ''} onChange={(e) => z('podstawa')(e.target.value)} />
        </Pole>
        <Pole etykieta="Data dokumentu" opcjonalne blad={pola.podstawa_data}><PoleDaty wartosc={tresc.podstawa_data || ''} przyZmianie={z('podstawa_data')} max={fmt.dzisIso()} /></Pole>
        <ListaPlikow pliki={p.pliki} />
        <DodajPlik adres={`/api/psa/sprawy/${p.sprawa.id}/pliki`} przyDodaniu={odswiez} />
      </Karta>
    </fieldset>
  );
}

/* ── Krok 2: sprawdzenie ── */

function KafelOsoby({ o, sprawa, pliki, zapisz, odswiez }) {
  const [zgoda, ustawZgode] = useState(null);
  const pow = o.powiadomienie;
  const linia = o.zgoda ? `Zgoda na wpis (${fmt.data(o.zgoda.data)})`
    : pow && pow.stan === 'wyslane' ? `Wysłano ${fmt.data(pow.wyslano)}`
      : pow && pow.stan === 'blad' ? 'Błąd wysyłki powiadomienia'
        : pow ? `Powiadomienie — ${KANALY[pow.kanal] || pow.kanal}` : 'Powiadomienie powstanie po „Dalej”';
  const zapiszZgode = () => zapisz({ zgody: [...(sprawa.zgody || []), { osoba_id: o.osoba_id, dopuszczalna: zgoda.dopuszczalna, data: zgoda.data, plik_id: zgoda.plik_id || null }] }).then((ok) => ok && ustawZgode(null));
  return (
    <div className="kafel-osoby">
      <div className="rzad-rozdzielony">
        <a href={`#/osoby/${o.osoba_id}`}><strong>{o.nazwa}</strong></a>
        {o.dopisana && !pow && <button type="button" className="btn btn-maly btn-cichy" onClick={() => zapisz({ dopisane: (sprawa.dopisane || []).filter((x) => x !== o.osoba_id) })}>Usuń</button>}
      </div>
      <div className="kafel-osoby-stan">{linia}</div>
      <div className="rzad">
        {pow && !o.zgoda && pow.stan !== 'wyslane' && <CzynnosciPisma p={pow} poZmianie={odswiez} />}
        {pow && <button type="button" className="btn btn-maly btn-cichy" onClick={() => window.open(adresPdf(pow.id), '_blank', 'noopener')}>Podgląd</button>}
        {!o.zgoda && !zgoda && <button type="button" className="btn btn-maly" onClick={() => ustawZgode({ data: fmt.dzisIso(), dopuszczalna: false, plik_id: '' })}>Odnotuj zgodę na wpis</button>}
        {o.zgoda && <button type="button" className="btn btn-maly btn-cichy" onClick={() => zapisz({ zgody: (sprawa.zgody || []).filter((z) => z.osoba_id !== o.osoba_id) })}>Cofnij zgodę</button>}
      </div>
      {zgoda && (
        <div className="podsekcja">
          <Pole etykieta="Data zgody"><PoleDaty wartosc={zgoda.data} przyZmianie={(d) => ustawZgode({ ...zgoda, data: d })} max={fmt.dzisIso()} /></Pole>
          <label className="chk"><input type="checkbox" checked={zgoda.dopuszczalna} onChange={(e) => ustawZgode({ ...zgoda, dopuszczalna: e.target.checked })} /> Zgoda w dopuszczalnej formie</label>
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

function KrokSprawdzenia({ p, zapisz, odswiez, edycja }) {
  const s = p.sprawa;
  const [dopisz, ustawDopisz] = useState(false);
  // Zaznaczenie widać od razu; zapis idzie w tle (stan z serwera nadpisuje po odpowiedzi).
  const [zaznaczone, ustawZaznaczone] = useState(() => ({ ...(s.checklista || {}) }));
  useEffect(() => { ustawZaznaczone({ ...(s.checklista || {}) }); }, [JSON.stringify(s.checklista || {})]);
  const zaznacz = (klucz, wartosc) => {
    const nowe = { ...zaznaczone, [klucz]: wartosc };
    ustawZaznaczone(nowe);
    zapisz({ checklista: nowe });
  };
  return (
    <>
      <Karta tytul="Stan przed i po wpisie">
        <h4>Przed</h4>
        <TabelaAkcjonariuszy widok={p.stan_przed} osoby={p.nazwy} />
        <h4>Po</h4>
        {p.stan_po ? <TabelaAkcjonariuszy widok={p.stan_po} osoby={p.nazwy} /> : <p className="male drugorzedny">—</p>}
        {p.stan_po && p.stan_po.atrybuty.length > 0 && <><h4>Obciążenia i adnotacje po wpisie</h4><TabelaAtrybutow widok={p.stan_po} osoby={p.nazwy} /></>}
      </Karta>

      <Karta tytul="Osoby do powiadomienia">
        {!p.osoby.length && <p className="male drugorzedny">Wpis nie wymaga powiadomień.</p>}
        <div className="kafle-osob">
          {p.osoby.map((o) => <KafelOsoby key={o.osoba_id} o={o} sprawa={s} pliki={p.pliki} zapisz={zapisz} odswiez={odswiez} />)}
        </div>
        {edycja && (dopisz ? (
          <Pole etykieta="Dopisz osobę do powiadomienia">
            <WyborOsoby wartosc={null} wyklucz={p.osoby.map((o) => o.osoba_id)} przyZmianie={(id) => id && zapisz({ dopisane: [...(s.dopisane || []), id] }).then(() => ustawDopisz(false))} />
          </Pole>
        ) : <button type="button" className="btn btn-maly btn-cichy" onClick={() => ustawDopisz(true)}>+ Dopisz osobę</button>)}
      </Karta>

      <Karta tytul="Checklista">
        <div className="checklista">
          {p.checklista.map((c) => (
            <label key={c.klucz} className="chk">
              <input type="checkbox" checked={Boolean(zaznaczone[c.klucz])} disabled={!edycja} onChange={(e) => zaznacz(c.klucz, e.target.checked)} />
              <span className="chk-tresc">{c.etykieta} <span className="podstawa-prawna">{c.podstawa}</span></span>
            </label>
          ))}
        </div>
      </Karta>

      {p.oplata.wymagana && (
        <Karta tytul="Opłata za wpis">
          <DwaPrzyciski wartosc={s.oplata} opcje={[['tak', 'Opłata 100 zł netto'], ['nie', 'Bez opłaty']]} przyZmianie={(v) => edycja && zapisz({ oplata: v })} />
        </Karta>
      )}
    </>
  );
}

/* ── Ekran sprawy ── */

function EkranSprawy({ sprawaId }) {
  const { dane, blad, odswiez } = useDane(`/api/psa/sprawy/${sprawaId}`);
  const [p, ustawP] = useState(null);
  useEffect(() => { if (dane) ustawP(dane); }, [dane]);
  if (blad) return <Bledy blad={blad} />;
  if (!p) return <Spinner />;
  return <Sprawa key={p.sprawa.id} p={p} ustawP={ustawP} odswiez={odswiez} />;
}

function Sprawa({ p, ustawP, odswiez }) {
  const s = p.sprawa;
  const otwarta = ['w_toku', 'wstrzymana'].includes(s.stan);
  const [tresc, ustawTresc] = useState(() => robocza(s));
  const [panel, ustawPanel] = useState(null);
  const [pole, ustawPole] = useState('');
  const c = useCzynnosc();
  const przyZapisie = useCallback((nowy) => ustawP(nowy), [ustawP]);
  const zapis = useZapisSprawy(s.id, tresc, przyZapisie);
  const krok = p.krok;
  const edycjaTresci = otwarta && krok === 1;

  const pola = { ...bledyApi({ bledy: krok === 1 ? p.bledy || [] : [] }).pola, ...bledyApi(zapis.blad).pola, ...bledyApi(c.blad).pola };

  const zmienStan = (stan, dane = {}) => c.wykonaj(async () => { ustawP(await API.post(`/api/psa/sprawy/${s.id}/stan`, { stan, ...dane })); ustawPanel(null); ustawPole(''); });
  const krokNa = (k) => c.wykonaj(async () => {
    if (k === 2 && !(await zapis.teraz())) return;
    const nowy = await API.post(`/api/psa/sprawy/${s.id}/krok`, { krok: k });
    ustawP(nowy);
    if (k === 1) ustawTresc(robocza(nowy.sprawa));
  });
  const zapisz = (zmiany) => c.wykonaj(async () => { ustawP(await API.put(`/api/psa/sprawy/${s.id}`, zmiany)); return true; });
  const przeladuj = () => API.get(`/api/psa/sprawy/${s.id}`).then(ustawP);

  async function wpisz() {
    const tak = await potwierdz({ tytul: 'Dokonać wpisu?', tresc: 'Wpisu nie można cofnąć — poprawia się go wyłącznie sprostowaniem.', akcja: 'Dokonaj wpisu' });
    if (tak) zmienStan('wpisana');
  }
  async function wycofaj() {
    const tak = await potwierdz({ tytul: 'Wycofać sprawę?', tresc: 'Sprawa zostanie zakończona bez wpisu.', akcja: 'Wycofaj sprawę', niebezpieczna: true });
    if (tak) zmienStan('wycofana');
  }

  const zNazwa = (x) => ({ ...x, pismo: NAZWY_PISM[x.typ], adresat_nazwa: (x.kontekst || {}).adresat_nazwa });
  const pismaWpisu = p.pisma.filter((x) => x.typ === 'powiadomienie_wpis').map(zNazwa);
  // Powiadomienia o zamierzonym wpisie otwartej sprawy są w kafelkach osób (krok 2).
  const pozostale = p.pisma.filter((x) => x.typ !== 'powiadomienie_wpis' && !(otwarta && x.typ === 'powiadomienie_zamierzony')).map(zNazwa);
  const doWyslania = pismaWpisu.filter((x) => x.kanal === 'email' && x.stan !== 'wyslane');
  const wyslijPisma = () => c.wykonaj(async () => {
    for (const x of doWyslania) await API.post(`/api/psa/korespondencja/${x.id}/wyslij`);
    await przeladuj();
  });
  const pierwszy = (l) => { const x = (l || [])[0]; return x ? (typeof x === 'object' ? x.komunikat : x) : null; };

  let glowny = null;
  if (s.stan === 'wstrzymana') glowny = { etykieta: 'Wznów', przyKlik: () => ustawPanel('wznow') };
  else if (otwarta && krok === 1) glowny = { etykieta: 'Dalej', przyKlik: () => krokNa(2), powod: (p.bledy || []).length ? 'Popraw błędy w treści sprawy.' : null };
  else if (otwarta && krok === 2) glowny = { etykieta: 'Dokonaj wpisu', przyKlik: wpisz, powod: (p.przeszkody_wpisu || []).length ? 'Najpierw załatw punkty „Przed wpisem”.' : null };
  else if (s.stan === 'wpisana' && pismaWpisu.some((x) => x.stan !== 'wyslane')) {
    glowny = { etykieta: 'Wyślij pisma', przyKlik: wyslijPisma, powod: doWyslania.length ? null : 'Listy: wydrukuj i kliknij „Nadano” przy piśmie.' };
  }

  const zadajacy = s.zadajacy === 'spolka' ? 'spółka' : s.zadajacy === 'osoba' ? (p.zadajacy_osoba || {}).nazwa : s.zadajacy === 'organ' ? s.zadajacy_opis : 'z inicjatywy kancelarii';
  const biezacy = s.stan === 'wpisana' ? 2 : Math.max(0, Math.min(krok, 3) - 1);

  return (
    <div className="ekran-sprawy">
      <NaglowekStrony
        tytul={`Sprawa nr ${s.id}`}
        kontekst={(
          <span className="rzad">
            <a href={`#/spolki/${p.spolka.id}`}>{p.spolka.nazwa}</a>
            <span>żądający: {zadajacy || '—'}</span>
            {p.termin && <span className={p.termin.po_terminie || p.termin.pilny ? 'pilne' : ''}>{opisTerminu(p.termin)}</span>}
            <Pigulka odmiana={ODMIANY_STANU_SPRAWY[s.stan]}>{STANY_SPRAWY[s.stan]}</Pigulka>
          </span>
        )}
        akcje={(
          <span className="rzad">
            {glowny && <PrzyciskGlowny {...glowny} trwa={c.trwa} />}
            <Wiecej akcje={[
              otwarta && krok === 2 && { etykieta: 'Zmień treść', przyKlik: () => krokNa(1) },
              s.stan === 'w_toku' && { etykieta: 'Wstrzymaj', przyKlik: () => ustawPanel('wstrzymaj') },
              otwarta && { etykieta: 'Odmów', przyKlik: () => ustawPanel('odmow'), niebezpieczna: true },
              otwarta && { etykieta: 'Wycofaj', przyKlik: wycofaj, niebezpieczna: true },
            ]}
            />
          </span>
        )}
      />
      {otwarta && <Kroki kroki={['Treść', 'Sprawdzenie', 'Pisma']} biezacy={biezacy} />}
      {krok === 1 && otwarta && <StanZapisu stan={zapis.stan === 'blad' ? { stan: 'blad', blad: pierwszy(bledyApi(zapis.blad).lista) } : zapis} />}
      <Bledy blad={c.blad} />
      {zapis.blad && !Object.keys(bledyApi(zapis.blad).pola).length && <Bledy blad={zapis.blad} />}

      {panel === 'wstrzymaj' && (
        <Karta tytul="Wstrzymaj sprawę — wezwanie do uzupełnienia">
          <Pole etykieta="Treść wezwania" blad={pola.tresc_wezwania}><textarea rows={3} value={pole} onChange={(e) => ustawPole(e.target.value)} /></Pole>
          <div className="rzad">
            <button type="button" className="btn btn-glowny" onClick={() => zmienStan('wstrzymana', { tresc_wezwania: pole })} disabled={c.trwa}>Wstrzymaj i przygotuj wezwanie</button>
            <button type="button" className="btn" onClick={() => ustawPanel(null)}>Anuluj</button>
          </div>
        </Karta>
      )}
      {panel === 'wznow' && (
        <Karta tytul="Wznów sprawę">
          <Pole etykieta="Data usunięcia przeszkody" opcjonalne podpowiedz="Domyślnie dzień ostatniego pliku w sprawie." blad={pola.data_usuniecia_przeszkody}>
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
          <Pole etykieta="Przyczyna odmowy" blad={pola.przyczyna}><textarea rows={3} value={pole} onChange={(e) => ustawPole(e.target.value)} /></Pole>
          <p className="male drugorzedny">Odmowy nie można cofnąć. Powiadomienie o odmowie trafi do Korespondencji.</p>
        </Modal>
      )}

      {s.stan === 'wstrzymana' && <Komunikat odmiana="uwaga" tresc={`Sprawa wstrzymana od ${fmt.data(s.wstrzymana_od)} — termin nie biegnie.`} />}
      {s.stan === 'odmowa' && <Komunikat odmiana="uwaga" tytul="Odmowa wpisu" tresc={s.przyczyna_odmowy} />}
      {s.stan === 'wycofana' && <Komunikat tresc="Sprawa wycofana — bez wpisu." />}

      {otwarta && krok === 1 && <KrokTresci p={p} tresc={tresc} ustawTresc={ustawTresc} edycja={edycjaTresci} pola={pola} odswiez={przeladuj} />}
      {otwarta && krok === 2 && (
        <>
          <KrokSprawdzenia p={p} zapisz={zapisz} odswiez={przeladuj} edycja={otwarta} />
          {(p.przeszkody_wpisu || []).length > 0 && <Komunikat odmiana="uwaga" tytul="Przed wpisem" lista={p.przeszkody_wpisu.map((x) => (typeof x === 'object' ? x.komunikat : x))} />}
        </>
      )}
      {s.stan === 'wpisana' && (
        <Karta tytul="Powiadomienia o wpisie">
          <TabelaPism pisma={pismaWpisu} poZmianie={przeladuj} />
        </Karta>
      )}
      {pozostale.length > 0 && (
        <Karta tytul="Pozostałe pisma sprawy">
          <TabelaPism pisma={pozostale} poZmianie={przeladuj} />
        </Karta>
      )}
      {!otwarta && <Karta tytul="Pliki"><ListaPlikow pliki={p.pliki} /></Karta>}
    </div>
  );
}

/** „Nowy wpis” i czynności z kokpitu: zakłada sprawę (idempotentnie) i otwiera jej ekran. */
async function zalozSprawe(spolkaId, dane = {}) {
  const klucz = `${spolkaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const p = await API.post('/api/psa/sprawy', { spolka_id: spolkaId, zadajacy: 'spolka', operacje: [], klucz_idempotencji: klucz, ...dane });
  idz(`/sprawy/${p.sprawa.id}`);
}

Object.assign(window, { EkranSpraw, EkranSprawy, zalozSprawe, numeryDoPola });
