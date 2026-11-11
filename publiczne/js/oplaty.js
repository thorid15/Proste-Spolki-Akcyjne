/* oplaty.js — Opłaty (§ 5): filtr, eksport CSV; w wierszu „Opłacona”, w „Więcej” numer faktury
   i „Anuluj” z powodem. Numer faktury to pole, nie stan (§ 3.3). Tabela wspólna z kokpitem. */

const FILTRY_OPLAT = [['do_zaplaty', 'Do zapłaty'], ['oplacone', 'Opłacone'], ['wszystkie', 'Wszystkie']];
const RODZAJE_OPLAT = { prowadzenie: 'Prowadzenie rejestru', wpis: 'Wpis', informacja: 'Informacja z rejestru' };
const STANY_OPLAT = { do_zaplaty: 'do zapłaty', oplacona: 'opłacona', anulowana: 'anulowana' };
const brutto = (o) => o.kwota_brutto_grosze ?? Math.round((o.kwota_netto_grosze * (100 + o.stawka_vat_procent)) / 100);

function WierszOplaty({ o, poZmianie, zeSpolka }) {
  const [tryb, ustawTryb] = useState(null);
  const [tekst, ustawTekst] = useState('');
  const c = useCzynnosc();
  const { pola } = bledyApi(c.blad);
  const wykonaj = (fn) => c.wykonaj(async () => { await fn(); ustawTryb(null); poZmianie(); });
  return (
    <>
      <tr>
        <td>{fmt.data(o.utworzono)}</td>
        {zeSpolka && <td><a href={`#/spolki/${o.spolka_id}`}>{o.spolka_nazwa}</a></td>}
        <td>{RODZAJE_OPLAT[o.typ]}{o.okres ? <div className="male drugorzedny">{o.okres.split('..').map(fmt.data).join(' – ')}</div> : null}</td>
        <td>{o.platnik_nazwa || (o.platnik === 'spolka' ? 'spółka' : '—')}</td>
        <td className="liczba">{fmt.zlote(o.kwota_netto_grosze)}<div className="male drugorzedny">brutto {fmt.zlote(brutto(o))}</div></td>
        <td>{STANY_OPLAT[o.stan]}{o.oplacono ? ` ${fmt.data(o.oplacono)}` : ''}{o.numer_faktury ? <div className="male drugorzedny">FV {o.numer_faktury}</div> : null}</td>
        <td>
          {o.stan === 'do_zaplaty' && (
            <span className="rzad">
              <button type="button" className="btn btn-maly btn-glowny" disabled={c.trwa} onClick={() => wykonaj(() => API.post(`/api/psa/oplaty/${o.id}/oplacona`))}>Opłacona</button>
              <Wiecej akcje={[
                { etykieta: 'Numer faktury', przyKlik: () => { ustawTekst(o.numer_faktury || ''); ustawTryb('faktura'); } },
                { etykieta: 'Anuluj', przyKlik: () => { ustawTekst(''); ustawTryb('anuluj'); }, niebezpieczna: true },
              ]}
              />
            </span>
          )}
          {o.stan === 'oplacona' && !o.numer_faktury && (
            <button type="button" className="btn btn-maly btn-cichy" onClick={() => { ustawTekst(''); ustawTryb('faktura'); }}>Numer faktury</button>
          )}
        </td>
      </tr>
      {tryb && (
        <tr className="wiersz-formularza">
          <td colSpan={zeSpolka ? 7 : 6}>
            <span className="rzad">
              <Pole etykieta={tryb === 'faktura' ? 'Numer faktury' : 'Powód anulowania'} blad={pola.powod || pola.numer_faktury}>
                <input type="text" value={tekst} onChange={(e) => ustawTekst(e.target.value)} />
              </Pole>
              <button
                type="button"
                className="btn btn-maly btn-glowny"
                disabled={c.trwa}
                onClick={() => wykonaj(() => (tryb === 'faktura'
                  ? API.put(`/api/psa/oplaty/${o.id}/faktura`, { numer_faktury: tekst })
                  : API.post(`/api/psa/oplaty/${o.id}/anuluj`, { powod: tekst })))}
              >
                {tryb === 'faktura' ? 'Zapisz' : 'Anuluj opłatę'}
              </button>
              <button type="button" className="btn btn-maly" onClick={() => ustawTryb(null)}>Wróć</button>
            </span>
            {c.blad && !Object.keys(pola).length && <Bledy blad={c.blad} />}
          </td>
        </tr>
      )}
    </>
  );
}

function TabelaOplat({ oplaty, poZmianie, zeSpolka = false }) {
  if (!oplaty.length) return <p className="male drugorzedny">Brak opłat.</p>;
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>Data</th>{zeSpolka && <th>Spółka</th>}<th>Za co</th><th>Płatnik</th><th className="liczba">Netto</th><th>Stan</th><th><span className="sr-only">Czynności</span></th>
        </tr>
      </thead>
      <tbody>
        {oplaty.map((o) => <WierszOplaty key={o.id} o={o} poZmianie={poZmianie} zeSpolka={zeSpolka} />)}
      </tbody>
    </table>
  );
}

function EkranOplat() {
  const [filtr, ustawFiltr] = useParametrAdresu('filtr', 'do_zaplaty');
  const { dane, blad, odswiez } = useDane(`/api/psa/oplaty?filtr=${filtr}`);
  return (
    <Karta>
      <div className="rzad-rozdzielony">
        <Filtr opcje={FILTRY_OPLAT} wartosc={filtr} przyZmianie={ustawFiltr} />
        <a className="btn btn-maly" href={`/api/psa/oplaty/csv?filtr=${filtr}`} download>Eksport CSV</a>
      </div>
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && <TabelaOplat oplaty={dane} poZmianie={odswiez} zeSpolka />}
    </Karta>
  );
}

Object.assign(window, { EkranOplat, TabelaOplat });
