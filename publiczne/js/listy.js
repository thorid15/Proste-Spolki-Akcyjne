/* ─────────────────────────────────────────────────────
   W4.3 — Listy do wysyłki; W5.3/W5.6 — dziennik wydanych informacji.
   ───────────────────────────────────────────────────── */

/** Jeden list: druk z adresem z rejestru, potem data i numer nadania + skan potwierdzenia. */
function WierszListu({ list, odswiez }) {
  const [otwarty, ustawOtwarty] = useState(false);
  const [data, ustawDate] = useState(dzisIso());
  const [numer, ustawNumer] = useState('');
  const [blad, ustawBlad] = useState(null);
  const [zapis, ustawZapis] = useState(false);
  const plik = useRef(null);

  async function nadaj() {
    ustawZapis(true);
    ustawBlad(null);
    try {
      const f = new FormData();
      f.append('data_nadania', data);
      f.append('numer_nadania', numer);
      if (plik.current && plik.current.files[0]) f.append('potwierdzenie', plik.current.files[0]);
      const odp = await fetch(`/api/psa/listy/${list.id}/nadanie`, { method: 'POST', body: f });
      const tresc = await odp.json().catch(() => ({}));
      if (!odp.ok) throw new Error(tresc.blad || `Błąd ${odp.status}`);
      ustawOtwarty(false);
      odswiez();
    } catch (e) {
      ustawBlad(e.message);
    } finally {
      ustawZapis(false);
    }
  }

  return (
    <tr>
      <td>{fmt.data(list.utworzono)}</td>
      <td>{list.rodzaj_nazwa}<div className="przyciemnione">{list.spolka_nazwa}{list.sprawa_numer ? ` · ${list.sprawa_numer}` : ''}</div></td>
      <td><strong>{list.odbiorca_nazwa}</strong><div>{list.adres}</div><ZnacznikKontaktu zawsze /></td>
      <td>
        {list.status === 'nadany' ? (
          <>
            <Pigulka odmiana="rejestr">nadany {fmt.data(list.data_nadania)}</Pigulka>
            <div className="przyciemnione">nr {list.numer_nadania}</div>
            {list.potwierdzenie_sciezka && <a href={`/api/psa/listy/${list.id}/potwierdzenie`}>potwierdzenie nadania</a>}
          </>
        ) : otwarty ? (
          <div className="pion" style={{ gap: 'var(--od-2)' }}>
            <Komunikat odmiana="blad" tresc={blad} />
            <Pole etykieta="Data nadania" wymagane><input type="date" value={data} onChange={(z) => ustawDate(z.target.value)} /></Pole>
            <Pole etykieta="Numer nadania" wymagane><input value={numer} onChange={(z) => ustawNumer(z.target.value)} /></Pole>
            <Pole etykieta="Skan potwierdzenia nadania"><input type="file" ref={plik} accept=".pdf,.jpg,.jpeg,.png" /></Pole>
            <span className="row-g">
              <button className="btn btn-glowny btn-maly" disabled={zapis || !numer.trim()} onClick={nadaj}>Zapisz nadanie</button>
              <button className="btn btn-maly" onClick={() => ustawOtwarty(false)}>Anuluj</button>
            </span>
          </div>
        ) : (
          <span className="row-g">
            <a className="btn btn-maly" href={`/api/psa/listy/${list.id}/pismo`} target="_blank" rel="noopener">Drukuj pismo</a>
            <button className="btn btn-maly btn-glowny" onClick={() => ustawOtwarty(true)}>Nadano</button>
          </span>
        )}
      </td>
    </tr>
  );
}

function EkranListow() {
  const { dane, odswiez } = useDane('/api/psa/listy');
  const listy = (dane && dane.listy) || [];
  return (
    <Karta tytul="Listy do wysyłki">
      <Komunikat
        odmiana="info"
        tresc="Osoba bez zgody na komunikację e-mail dostaje pismo pocztą — na adres z rejestru, nigdy na adres podany przez żądającego wpisu. Powiadomienie uprzednie liczy się jako wysłane z dniem nadania."
      />
      {listy.length === 0 ? <Pusto tytul="Brak listów" opis="Nic nie czeka na wysyłkę." /> : (
        <table className="tabela">
          <thead><tr><th>Wystawiono</th><th>Pismo</th><th>Adresat (z rejestru)</th><th>Nadanie</th></tr></thead>
          <tbody>{listy.map((l) => <WierszListu key={l.id} list={l} odswiez={odswiez} />)}</tbody>
        </table>
      )}
    </Karta>
  );
}

/** W5.6 — dziennik wydanych informacji z rejestru; W5.3 — wydanie informacji organowi. */
function EkranDziennikaInformacji() {
  const { dane, odswiez } = useDane('/api/psa/informacje');
  const spolki = useDane('/api/psa/spolki');
  const [form, ustawForm] = useState({ spolka_id: '', organ: '', sygnatura: '' });
  const [blad, ustawBlad] = useState(null);
  const [wynik, ustawWynik] = useState(null);
  const pozycje = (dane && dane.informacje) || [];
  const listaSpolek = (spolki.dane && (spolki.dane.spolki || spolki.dane)) || [];

  async function wydaj() {
    ustawBlad(null);
    try {
      const odp = await API.post('/api/psa/informacje/organ', { spolka_id: Number(form.spolka_id), organ: form.organ, sygnatura: form.sygnatura });
      ustawWynik(odp);
      ustawForm({ spolka_id: '', organ: '', sygnatura: '' });
      odswiez();
    } catch (e) {
      ustawBlad(e instanceof BladApi ? e.message : 'Nie udało się wydać informacji.');
    }
  }

  return (
    <div className="pion" style={{ gap: 'var(--od-6)' }}>
      <Karta tytul="Wydaj informację organowi (art. 300³⁵ § 4 KSH)">
        <Komunikat odmiana="info" tresc="Sądy, prokuratura, komornicy i administracyjne organy egzekucyjne nie mają dostępu do portalu — informację wydaje kancelaria na żądanie, w związku z toczącym się postępowaniem (sygnatura)." />
        <Komunikat odmiana="blad" tresc={blad} />
        {wynik && <Komunikat odmiana="ok" tresc={<>Wydano informację nr {wynik.numer}. <a href={`/api/psa/informacje/${wynik.dokument_id}`} target="_blank" rel="noopener">Otwórz do druku</a></>} />}
        <div className="siatka-2">
          <Pole etykieta="Spółka" wymagane>
            <select value={form.spolka_id} onChange={(z) => ustawForm({ ...form, spolka_id: z.target.value })}>
              <option value="">— wybierz —</option>
              {listaSpolek.map((s) => <option key={s.id} value={s.id}>{s.nazwa}</option>)}
            </select>
          </Pole>
          <Pole etykieta="Organ (odbiorca)" wymagane>
            <input value={form.organ} onChange={(z) => ustawForm({ ...form, organ: z.target.value })} placeholder="np. Komornik Sądowy przy Sądzie Rejonowym …" />
          </Pole>
          <Pole etykieta="Sygnatura sprawy" wymagane>
            <input value={form.sygnatura} onChange={(z) => ustawForm({ ...form, sygnatura: z.target.value })} placeholder="np. KM 123/26" />
          </Pole>
        </div>
        <button className="btn btn-glowny" disabled={!form.spolka_id || !form.organ.trim() || !form.sygnatura.trim()} onClick={wydaj}>
          Wydaj informację
        </button>
      </Karta>
      <Karta tytul="Dziennik wydanych informacji">
        {pozycje.length === 0 ? <Pusto tytul="Brak wydanych informacji" /> : (
          <table className="tabela">
            <thead><tr><th>Numer</th><th>Data</th><th>Spółka</th><th>Odbiorca</th><th>Opłata</th></tr></thead>
            <tbody>
              {pozycje.map((p) => (
                <tr key={p.id}>
                  <td><a href={`/api/psa/informacje/${p.id}`} target="_blank" rel="noopener">{p.numer || `#${p.id}`}</a></td>
                  <td>{fmt.dataCzas(p.utworzono)}</td>
                  <td>{p.spolka_nazwa}</td>
                  <td>{p.odbiorca}{p.sygnatura ? <div className="przyciemnione">sygn. {p.sygnatura}</div> : null}</td>
                  <td>{p.oplata_brutto_grosze != null ? fmt.zlote(p.oplata_brutto_grosze) : <span className="przyciemnione">{p.oplata_opis}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Karta>
    </div>
  );
}
