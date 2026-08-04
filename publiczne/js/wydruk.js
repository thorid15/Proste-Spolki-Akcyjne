/* wydruk.js — wydruki natywne: window.print() + @media print, bez bibliotek PDF.

   Czego NIE umieszczamy na wydrukach dla klienta (sekcja 10 specyfikacji):
   pola `uwagi`, checklist weryfikacji, notatek AML, danych kontaktowych innych
   akcjonariuszy ani skrótów. Serwer nie wysyła ich dla ról innych niż
   kancelaria — maskowanie jest po stronie API, nie w tym pliku. */

function NaglowekWydruku({ tytul, podtytul, kancelaria }) {
  return (
    <div className="wydruk-naglowek">
      <div>
        <div className="wydruk-tytul">{tytul}</div>
        {podtytul && <div className="podstawa-prawna">{podtytul}</div>}
      </div>
      <div className="wydruk-kancelaria prawo">
        {kancelaria ? kancelaria.nazwa : ''}
        {kancelaria && kancelaria.adres && <span>{kancelaria.adres}</span>}
        {kancelaria && kancelaria.miejscowosc && <span>{kancelaria.miejscowosc}</span>}
        {kancelaria && kancelaria.telefon && <span>tel. {kancelaria.telefon}</span>}
        {kancelaria && kancelaria.email && <span>{kancelaria.email}</span>}
      </div>
    </div>
  );
}

function Para({ etykieta, children }) {
  return (
    <>
      <dt>{etykieta}</dt>
      <dd>{children || '—'}</dd>
    </>
  );
}

function StopkaWydruku({ data, dodatek }) {
  return (
    <div className="wydruk-stopka">
      <div>
        Stan rejestru na dzień {fmt.data(data)}. Dokument sporządzono {fmt.data(fmt.dzisIso())}.
      </div>
      {dodatek && <div style={{ marginTop: 5 }}>{dodatek}</div>}
      <div style={{ marginTop: 5 }}>
        Rejestr akcjonariuszy prowadzony na podstawie art. 300(31) § 1 Kodeksu spółek handlowych.
      </div>
    </div>
  );
}

function TabelaAkcjonariuszyWydruk({ akcjonariusze, razem, pokazObciazenia = true }) {
  if (akcjonariusze.length === 0) {
    return <div className="przyciemnione">Na wskazany dzień rejestr nie wykazuje akcjonariuszy.</div>;
  }
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Lp.</th>
          <th>Akcjonariusz</th>
          <th>Seria</th>
          <th className="prawo">Liczba akcji</th>
          <th>Numery akcji</th>
          <th className="prawo">% akcji</th>
          {pokazObciazenia && <th>Obciążenia</th>}
        </tr>
      </thead>
      <tbody>
        {akcjonariusze.map((a, i) => (
          <tr key={`${a.osoba_id}-${a.emisja_klucz}`}>
            <td>{i + 1}</td>
            <td>
              <div>{a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}</div>
              {a.osoba && a.osoba.jawny_identyfikator && (
                <div className="podstawa-prawna">{a.osoba.jawny_identyfikator}</div>
              )}
            </td>
            <td>{a.seria}</td>
            <td className="prawo">{fmt.liczba(a.ilosc)}</td>
            <td className="numery">{a.numery}</td>
            <td className="prawo">{fmt.procent(a.procent)}</td>
            {pokazObciazenia && (
              <td>
                {a.obciazenia.length === 0
                  ? '—'
                  : a.obciazenia
                      .map((o) => `${o.typ === 'zajecie' ? 'zajęcie' : o.typ} ${o.numery}`)
                      .join('; ')}
              </td>
            )}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} style={{ fontWeight: 600 }}>Razem</td>
          <td className="prawo" style={{ fontWeight: 600 }}>{fmt.liczba(razem)}</td>
          <td />
          <td className="prawo" style={{ fontWeight: 600 }}>100%</td>
          {pokazObciazenia && <td />}
        </tr>
      </tfoot>
    </table>
  );
}

function PaskiWydruku({ spolkaId, data, ustawDate, dzieci }) {
  return (
    <div className="pasek-gorny bez-druku">
      <div className="row-g" style={{ flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => idz(`/spolki/${spolkaId}`)}>← Kokpit spółki</button>
        <span className="fl" style={{ marginBottom: 0 }}>Stan na dzień</span>
        <input
          type="date"
          value={data}
          max={fmt.dzisIso()}
          onChange={(z) => z.target.value && ustawDate(z.target.value)}
          style={{ width: 'auto' }}
        />
        {dzieci}
      </div>
      <button className="btn btn-primary" onClick={() => window.print()}>Drukuj</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   RAPORT SPÓŁKI
   ───────────────────────────────────────────────────── */
function EkranRaportu({ spolkaId, dataPoczatkowa }) {
  const [data, ustawDate] = useState(dataPoczatkowa || fmt.dzisIso());
  const stan = useDane(`/api/psa/spolki/${spolkaId}/stan?data=${data}`, [data]);
  const rdzen = useDane('/api/wspolne/kancelaria');

  if (stan.ladowanie || rdzen.ladowanie) return <Spinner />;
  if (stan.blad) return <Komunikat odmiana="blad" tresc={stan.blad.message} />;

  const d = stan.dane;
  const kancelaria = rdzen.dane ? rdzen.dane.kancelaria : null;
  const adres = [
    d.spolka.ulica && `${d.spolka.ulica} ${d.spolka.nr_domu || ''}${d.spolka.nr_lokalu ? `/${d.spolka.nr_lokalu}` : ''}`,
    [d.spolka.kod_pocztowy, d.spolka.miejscowosc].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ');

  return (
    <>
      <PaskiWydruku spolkaId={spolkaId} data={data} ustawDate={ustawDate} />

      <div className="wydruk">
        <NaglowekWydruku
          tytul="Raport spółki"
          podtytul={`Rejestr akcjonariuszy — stan na dzień ${fmt.data(data)}`}
          kancelaria={kancelaria}
        />

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Spółka</div>
          <dl className="pary">
            <Para etykieta="Firma">{d.spolka.nazwa}</Para>
            <Para etykieta="Forma prawna">{d.spolka.forma_prawna}</Para>
            <Para etykieta="Numer KRS">{d.spolka.krs}</Para>
            <Para etykieta="NIP">{d.spolka.nip}</Para>
            <Para etykieta="REGON">{d.spolka.regon}</Para>
            <Para etykieta="Siedziba i adres">{adres}</Para>
            <Para etykieta="Sąd rejestrowy">
              {[d.spolka.sad_rejestrowy, d.spolka.wydzial].filter(Boolean).join(', ')}
            </Para>
            <Para etykieta="Status">{NAZWY_STATUSU[d.spolka.status] || d.spolka.status}</Para>
          </dl>
        </div>

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Podmiot prowadzący rejestr</div>
          <dl className="pary">
            <Para etykieta="Podmiot">{kancelaria ? kancelaria.nazwa : '—'}</Para>
            <Para etykieta="Podstawa prowadzenia">art. 300(31) § 1 KSH</Para>
            <Para etykieta="Data uchwały o wyborze">{fmt.data(d.spolka.data_uchwaly_wyboru)}</Para>
            <Para etykieta="Data umowy o prowadzenie rejestru">{fmt.data(d.spolka.data_umowy)}</Para>
            <Para etykieta="Data otwarcia rejestru">{fmt.data(d.spolka.data_otwarcia_rejestru)}</Para>
          </dl>
        </div>

        {d.spolka.opis && (
          <div className="wydruk-sekcja">
            <div className="wydruk-sekcja-tytul">Opis</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{d.spolka.opis}</div>
          </div>
        )}

        {d.uprawnienia.length > 0 && (
          <div className="wydruk-sekcja">
            <div className="wydruk-sekcja-tytul">Uprawnienia, przywileje i obowiązki</div>
            <table className="tbl">
              <thead>
                <tr><th>Rodzaj</th><th>Dotyczy</th><th>Tytuł</th><th>Treść</th><th>Od dnia</th></tr>
              </thead>
              <tbody>
                {d.uprawnienia.map((u) => (
                  <tr key={u.klucz}>
                    <td>{u.rodzaj}</td>
                    <td>{u.osoba ? u.osoba.oznaczenie : u.seria || 'cała spółka'}</td>
                    <td>{u.tytul || '—'}</td>
                    <td className="zawijaj">{u.tresc || '—'}</td>
                    <td>{fmt.data(u.data_ustanowienia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Emisje akcji</div>
          {d.emisje.length === 0 ? (
            <div className="przyciemnione">Rejestr nie wykazuje emisji.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Seria</th><th>Tytuł</th><th>Podstawa</th><th>Numery</th>
                  <th className="prawo">Wyemitowane</th><th className="prawo">Umorzone</th>
                  <th className="prawo">W obrocie</th><th className="prawo">Cena emisyjna</th><th>Data</th>
                </tr>
              </thead>
              <tbody>
                {d.emisje.map((e) => {
                  const b = d.bilans.find((x) => x.emisja_klucz === e.klucz) || {};
                  return (
                    <tr key={e.klucz}>
                      <td style={{ fontWeight: 600 }}>{e.seria}</td>
                      <td>{e.tytul || '—'}</td>
                      <td>{e.podstawa_prawna || '—'}</td>
                      <td className="numery">{e.zakres}</td>
                      <td className="prawo">{fmt.liczba(e.ilosc)}</td>
                      <td className="prawo">{fmt.liczba(b.umorzone || 0)}</td>
                      <td className="prawo">{fmt.liczba(b.w_obrocie || 0)}</td>
                      <td className="prawo">{fmt.zlote(e.cena_emisyjna_grosze)}</td>
                      <td>{fmt.data(e.data_emisji)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Akcjonariusze na dzień {fmt.data(data)}</div>
          <TabelaAkcjonariuszyWydruk akcjonariusze={d.akcjonariusze} razem={d.razem_akcji} />
        </div>

        {d.obciazenia.length > 0 && (
          <div className="wydruk-sekcja">
            <div className="wydruk-sekcja-tytul">Obciążenia i zajęcia</div>
            <table className="tbl">
              <thead>
                <tr><th>Typ</th><th>Seria</th><th>Numery</th><th>Uprawniony</th><th>Prawo głosu</th><th>Od dnia</th></tr>
              </thead>
              <tbody>
                {d.obciazenia.map((o) => (
                  <tr key={o.klucz}>
                    <td>{o.typ === 'zajecie' ? 'zajęcie' : o.typ}</td>
                    <td>{o.seria}</td>
                    <td className="numery">{o.numery}</td>
                    <td>{o.uprawniony ? o.uprawniony.oznaczenie : '—'}</td>
                    <td>{o.prawo_glosu ? 'tak' : 'nie'}</td>
                    <td>{fmt.data(o.data_od)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <StopkaWydruku data={data} />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────
   INFORMACJA Z REJESTRU (art. 300(35) KSH)
   ───────────────────────────────────────────────────── */
function EkranInformacji({ spolkaId, dataPoczatkowa }) {
  const [data, ustawDate] = useState(dataPoczatkowa || fmt.dzisIso());
  const [rola, ustawRole] = useState('spolka');
  const [odbiorca, ustawOdbiorce] = useState('');
  const [organ, ustawOrgan] = useState('sąd');

  const zapytanie =
    `/api/psa/spolki/${spolkaId}/stan?data=${data}&rola=${rola}` +
    (rola === 'akcjonariusz' && odbiorca ? `&odbiorca=${odbiorca}` : '');
  const stan = useDane(zapytanie, [data, rola, odbiorca]);
  const rdzen = useDane('/api/wspolne/kancelaria');

  if (stan.ladowanie || rdzen.ladowanie) return <Spinner />;
  if (stan.blad) return <Komunikat odmiana="blad" tresc={stan.blad.message} />;

  const d = stan.dane;
  const kancelaria = rdzen.dane ? rdzen.dane.kancelaria : null;
  const zamaskowane = d.akcjonariusze.some((a) => a.osoba && a.osoba.zamaskowane);
  const odbiorcaOsoba = d.akcjonariusze.find((a) => String(a.osoba_id) === String(odbiorca));

  const opisOdbiorcy = {
    kancelaria: 'podmiot prowadzący rejestr',
    spolka: 'spółka, której rejestr dotyczy',
    akcjonariusz: odbiorcaOsoba && odbiorcaOsoba.osoba ? odbiorcaOsoba.osoba.oznaczenie : 'akcjonariusz',
    organ,
  }[rola];

  return (
    <>
      <PaskiWydruku
        spolkaId={spolkaId}
        data={data}
        ustawDate={ustawDate}
        dzieci={
          <>
            <span className="fl" style={{ marginBottom: 0 }}>Odbiorca</span>
            <select value={rola} onChange={(z) => ustawRole(z.target.value)} style={{ width: 'auto' }}>
              <option value="spolka">spółka</option>
              <option value="akcjonariusz">akcjonariusz</option>
              <option value="organ">sąd, prokurator, komornik, organ egzekucyjny</option>
              <option value="kancelaria">na potrzeby wewnętrzne kancelarii</option>
            </select>
            {rola === 'akcjonariusz' && (
              <select
                value={odbiorca}
                onChange={(z) => ustawOdbiorce(z.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">— który akcjonariusz —</option>
                {d.akcjonariusze.map((a) => (
                  <option key={a.osoba_id} value={a.osoba_id}>
                    {a.osoba ? a.osoba.oznaczenie : `osoba #${a.osoba_id}`}
                  </option>
                ))}
              </select>
            )}
            {rola === 'organ' && (
              <select value={organ} onChange={(z) => ustawOrgan(z.target.value)} style={{ width: 'auto' }}>
                <option value="sąd">sąd</option>
                <option value="prokurator">prokurator</option>
                <option value="komornik sądowy">komornik sądowy</option>
                <option value="administracyjny organ egzekucyjny">administracyjny organ egzekucyjny</option>
              </select>
            )}
          </>
        }
      />

      {rola === 'akcjonariusz' && (
        <Komunikat
          odmiana={zamaskowane ? 'ok' : 'info'}
          tytul="Maskowanie danych wrażliwych"
          tresc={
            'Pozostali akcjonariusze nie mają dostępu do numeru PESEL, daty urodzenia ani adresu ' +
            'zamieszkania — art. 300(35) § 1(1) KSH. Dane własne odbiorcy pokazujemy w całości.'
          }
        />
      )}

      <div className="wydruk">
        <NaglowekWydruku
          tytul="Informacja z rejestru akcjonariuszy"
          podtytul={`art. 300(35) KSH · stan na dzień ${fmt.data(data)}`}
          kancelaria={kancelaria}
        />

        <div className="wydruk-sekcja">
          <dl className="pary">
            <Para etykieta="Spółka">{d.spolka.nazwa}</Para>
            <Para etykieta="Numer KRS">{d.spolka.krs}</Para>
            <Para etykieta="Podmiot prowadzący rejestr">{kancelaria ? kancelaria.nazwa : '—'}</Para>
            <Para etykieta="Odbiorca informacji">{opisOdbiorcy}</Para>
            <Para etykieta="Stan na dzień">{fmt.data(data)}</Para>
          </dl>
        </div>

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Akcjonariusze</div>
          <TabelaAkcjonariuszyWydruk akcjonariusze={d.akcjonariusze} razem={d.razem_akcji} />
        </div>

        <div className="wydruk-sekcja">
          <div className="wydruk-sekcja-tytul">Serie akcji</div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Seria</th><th>Numery</th>
                <th className="prawo">Wyemitowane</th>
                <th className="prawo">Umorzone</th>
                <th className="prawo">W obrocie</th>
              </tr>
            </thead>
            <tbody>
              {d.bilans.map((b) => (
                <tr key={b.emisja_klucz}>
                  <td style={{ fontWeight: 600 }}>{b.seria}</td>
                  <td className="numery">
                    {(d.emisje.find((e) => e.klucz === b.emisja_klucz) || {}).zakres}
                  </td>
                  <td className="prawo">{fmt.liczba(b.wyemitowane)}</td>
                  <td className="prawo">{fmt.liczba(b.umorzone)}</td>
                  <td className="prawo">{fmt.liczba(b.w_obrocie)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <StopkaWydruku
          data={data}
          dodatek={
            zamaskowane
              ? 'Numery PESEL, daty urodzenia i adresy zamieszkania pozostałych akcjonariuszy ' +
                'zostały zasłonięte — art. 300(35) § 1(1) KSH.'
              : null
          }
        />
      </div>
    </>
  );
}

window.EkranRaportu = EkranRaportu;
window.EkranInformacji = EkranInformacji;
