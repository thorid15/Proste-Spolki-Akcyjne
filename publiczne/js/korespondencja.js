/* korespondencja.js — wszystko, co wychodzi z rejestru (§ 5, U-09): filtr, podgląd (PDF i tekst
   e-maila), „Wyślij” / „Wyślij ponownie”, list: „Drukuj” i „Nadano” (U-28). Tabela pism jest wspólna
   z ekranem sprawy. */

const FILTRY_KORESPONDENCJI = [['do_wyslania', 'Do wysłania'], ['listy', 'Listy do nadania'], ['bledy', 'Błędy'], ['wyslane', 'Wysłane']];

function adresPdf(id) {
  return `/api/psa/korespondencja/${id}/pdf`;
}

/** Podgląd pisma: PDF, adresat, kanał, treść e-maila, identyfikator wiadomości i odpowiedź serwera. */
function PodgladPisma({ id, przyZamknieciu }) {
  const { dane: p, blad } = useDane(`/api/psa/korespondencja/${id}`);
  return (
    <Modal tytul={p ? `${p.pismo} ${p.numer}` : 'Pismo'} panel przyZamknieciu={przyZamknieciu}>
      {blad && <Bledy blad={blad} />}
      {!p && !blad && <Spinner />}
      {p && (
        <>
          <ListaDanych pary={[
            ['Adresat', p.adresat_nazwa],
            ['Adres', p.adresat_adres],
            ['Kanał', `${KANALY[p.kanal] || p.kanal}${p.email ? ` — ${p.email}` : ''}`],
            ['Stan', `${STANY_PISMA[p.stan] || p.stan}${p.wyslano ? ` ${fmt.data(p.wyslano)}` : ''}`],
            p.id_wiadomosci && ['Identyfikator wiadomości', p.id_wiadomosci],
            p.odpowiedz_serwera && ['Odpowiedź serwera poczty', p.odpowiedz_serwera],
          ]}
          />
          {p.kanal === 'email' && (
            <div className="tresc-emaila">
              <div className="male drugorzedny">Temat: {p.temat}</div>
              <pre>{p.tekst}</pre>
            </div>
          )}
          <iframe className="podglad-pdf" title={`Podgląd ${p.numer}`} src={adresPdf(p.id)} />
          <a className="btn btn-maly" href={adresPdf(p.id)} target="_blank" rel="noopener">Otwórz PDF</a>
        </>
      )}
    </Modal>
  );
}

/** Czynności przy piśmie według kanału i stanu (U-09, U-28). */
function CzynnosciPisma({ p, poZmianie }) {
  const c = useCzynnosc();
  const wyslij = () => c.wykonaj(async () => { await API.post(`/api/psa/korespondencja/${p.id}/wyslij`); poZmianie(); });
  const nadano = () => c.wykonaj(async () => { await API.post(`/api/psa/korespondencja/${p.id}/nadano`); poZmianie(); });
  if (p.stan === 'wyslane') return <span className="male drugorzedny">{p.wyslano ? fmt.data(p.wyslano) : ''}</span>;
  return (
    <span className="rzad">
      {p.kanal === 'email' && (
        <button type="button" className="btn btn-maly btn-glowny" onClick={wyslij} disabled={c.trwa}>
          {p.stan === 'blad' ? 'Wyślij ponownie' : 'Wyślij'}
        </button>
      )}
      {p.kanal === 'list' && (
        <>
          <a className="btn btn-maly" href={adresPdf(p.id)} target="_blank" rel="noopener">Drukuj</a>
          <button type="button" className="btn btn-maly btn-glowny" onClick={nadano} disabled={c.trwa}>Nadano</button>
        </>
      )}
      <Bledy blad={c.blad} />
    </span>
  );
}

function TabelaPism({ pisma, poZmianie, zeSpolka = false }) {
  const [podglad, ustawPodglad] = useState(null);
  if (!pisma.length) return <p className="male drugorzedny">Brak pism.</p>;
  return (
    <>
      <table className="tabela">
        <thead>
          <tr>
            <th>Data</th>
            {zeSpolka && <th>Spółka</th>}
            <th>Adresat</th><th>Pismo</th><th>Kanał</th><th>Stan</th><th><span className="sr-only">Czynności</span></th>
          </tr>
        </thead>
        <tbody>
          {pisma.map((p) => (
            <tr key={p.id}>
              <td>{fmt.data(p.wyslano || p.utworzono)}</td>
              {zeSpolka && <td>{p.spolka_id ? <a href={`#/spolki/${p.spolka_id}`}>{p.spolka}</a> : '—'}</td>}
              <td>{p.adresat_nazwa || '—'}</td>
              <td>
                <button type="button" className="jak-odnosnik" onClick={() => ustawPodglad(p.id)}>{p.pismo || NAZWY_PISM[p.typ]} {p.numer}</button>
              </td>
              <td>{KANALY[p.kanal] || p.kanal}</td>
              <td><Pigulka odmiana={p.stan === 'blad' ? 'sygnal' : p.stan === 'do_wyslania' ? 'mosiadz' : null}>{STANY_PISMA[p.stan]}</Pigulka></td>
              <td><CzynnosciPisma p={p} poZmianie={poZmianie} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {podglad && <PodgladPisma id={podglad} przyZamknieciu={() => ustawPodglad(null)} />}
    </>
  );
}

const NAZWY_PISM = {
  umowa: 'Umowa o prowadzenie rejestru', uchwala: 'Uchwała', zgoda_email: 'Zgoda na korespondencję e-mail',
  powiadomienie_zamierzony: 'Powiadomienie o zamierzonym wpisie', powiadomienie_wpis: 'Powiadomienie o wpisie',
  powiadomienie_odmowa: 'Powiadomienie o odmowie', wezwanie: 'Wezwanie do uzupełnienia', informacja: 'Informacja z rejestru',
};

function EkranKorespondencji() {
  const [filtr, ustawFiltr] = useParametrAdresu('filtr', 'do_wyslania');
  const pismo = new URLSearchParams(window.location.hash.split('?')[1] || '').get('pismo');
  const { dane, blad, odswiez } = useDane(`/api/psa/korespondencja?filtr=${filtr}`);
  const [podglad, ustawPodglad] = useState(pismo ? Number(pismo) : null);
  return (
    <Karta>
      <Filtr opcje={FILTRY_KORESPONDENCJI} wartosc={filtr} przyZmianie={ustawFiltr} />
      {blad && <Bledy blad={blad} />}
      {!dane && !blad && <Spinner />}
      {dane && <TabelaPism pisma={dane} poZmianie={odswiez} zeSpolka />}
      {podglad && <PodgladPisma id={podglad} przyZamknieciu={() => ustawPodglad(null)} />}
    </Karta>
  );
}

Object.assign(window, { EkranKorespondencji, TabelaPism, PodgladPisma, adresPdf, NAZWY_PISM });
