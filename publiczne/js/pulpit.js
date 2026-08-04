/* pulpit.js — dwie kolumny: sprawy w toku i spółki (sekcja 9 specyfikacji). */

function ZnacznikIntegralnosci({ integralnosc }) {
  if (!integralnosc) return null;
  if (integralnosc.ok) {
    return (
      <span className="podstawa-prawna" title="Łańcuch skrótów zdarzeń zweryfikowany">
        ✓ łańcuch nieprzerwany ({fmt.liczba(integralnosc.sprawdzono)})
      </span>
    );
  }
  return (
    <Znacznik odmiana="bordo">
      łańcuch zerwany przy zdarzeniu #{integralnosc.blad && integralnosc.blad.id}
    </Znacznik>
  );
}

function EkranPulpitu() {
  const { dane, ladowanie, blad } = useDane('/api/psa/pulpit');

  if (ladowanie) return <Spinner />;
  if (blad) return <Komunikat odmiana="blad" tytul="Nie udało się wczytać pulpitu" tresc={blad.message} />;

  const { spolki, liczniki, integralnosc, sprawy } = dane;

  return (
    <>
      <div className="pasek-gorny">
        <div>
          <div className="tytul-strony">Pulpit</div>
          <div className="podtytul-strony">
            Rejestry akcjonariuszy prostych spółek akcyjnych prowadzone przez kancelarię.
          </div>
        </div>
        <ZnacznikIntegralnosci integralnosc={integralnosc} />
      </div>

      {!integralnosc.ok && (
        <Komunikat
          odmiana="blad"
          tytul="Naruszona integralność rejestru zdarzeń"
          tresc={
            integralnosc.blad
              ? integralnosc.blad.opis
              : 'Weryfikacja łańcucha skrótów wykryła niezgodność.'
          }
        />
      )}

      <div className="siatka-4" style={{ marginBottom: 22 }}>
        <div className="licznik">
          <div className="licznik-wartosc">{fmt.liczba(liczniki.spolki)}</div>
          <div className="licznik-etykieta">Prowadzone rejestry</div>
        </div>
        <div className="licznik">
          <div className="licznik-wartosc">{fmt.liczba(liczniki.akcjonariusze)}</div>
          <div className="licznik-etykieta">Akcjonariusze</div>
        </div>
        <div className="licznik">
          <div className="licznik-wartosc">{fmt.liczba(liczniki.osoby)}</div>
          <div className="licznik-etykieta">Osoby w kartotece</div>
        </div>
        <div className="licznik">
          <div className="licznik-wartosc">{fmt.liczba(liczniki.zdarzenia)}</div>
          <div className="licznik-etykieta">Zdarzenia rejestrowe</div>
        </div>
      </div>

      <div className="siatka-2">
        <div>
          <Karta
            tight
            tytul="Sprawy w toku"
            akcje={
              <button className="btn btn-sm" onClick={() => idz('/sprawy')}>
                Cała kolejka
              </button>
            }
          >
            {sprawy.pozycje.length === 0 ? (
              <Pusto
                tytul="Brak spraw w toku"
                opis="Nowe sprawy zakładasz z kokpitu spółki, przyciskiem „Nowe zdarzenie”."
              />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Spółka</th>
                    <th>Zdarzenie</th>
                    <th>Stan</th>
                    <th className="prawo">Termin</th>
                  </tr>
                </thead>
                <tbody>
                  {sprawy.pozycje.slice(0, 8).map((s) => (
                    <tr key={s.id} className="klikalny" onClick={() => idz(`/sprawy/${s.id}`)}>
                      <td style={{ fontWeight: 500 }}>{s.spolka_nazwa}</td>
                      <td className="przyciemnione">{s.typ_nazwa}</td>
                      <td>
                        <Znacznik odmiana={s.stan === 'wstrzymana' ? 'oliwka' : s.stan === 'weryfikacja' ? 'lupek' : 'neutralny'}>
                          {s.stan === 'wstrzymana' ? 'wstrzymana' : s.stan === 'weryfikacja' ? 'w weryfikacji' : 'nowa'}
                        </Znacznik>
                      </td>
                      <td className="prawo">
                        {s.termin.zamrozony ? (
                          <Znacznik odmiana="oliwka">zawieszony</Znacznik>
                        ) : s.termin.po_terminie ? (
                          <Znacznik odmiana="bordo">po terminie</Znacznik>
                        ) : s.termin.pilny ? (
                          <Znacznik odmiana="bordo">{s.termin.dni_pozostale} dz.</Znacznik>
                        ) : (
                          <span className="przyciemnione">{s.termin.dni_pozostale} dz.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Karta>
        </div>

        <div>
          <Karta
            tight
            tytul="Spółki"
            akcje={
              <button className="btn btn-sm" onClick={() => idz('/spolki/nowa')}>
                Dodaj spółkę
              </button>
            }
          >
            {spolki.length === 0 ? (
              <Pusto
                tytul="Brak spółek"
                opis="Dodaj pierwszą spółkę, aby otworzyć dla niej rejestr akcjonariuszy."
                akcja={
                  <button className="btn btn-primary" onClick={() => idz('/spolki/nowa')}>
                    Dodaj spółkę
                  </button>
                }
              />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Spółka</th>
                    <th className="prawo">Akcjonariusze</th>
                    <th className="prawo">Akcje</th>
                    <th>Ostatnie zdarzenie</th>
                  </tr>
                </thead>
                <tbody>
                  {spolki.map((s) => (
                    <tr key={s.id} className="klikalny" onClick={() => idz(`/spolki/${s.id}`)}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.nazwa}</div>
                        <div className="podpowiedz" style={{ marginTop: 2 }}>
                          {s.krs ? `KRS ${s.krs}` : 'bez numeru KRS'}
                          {s.status !== 'aktywna' ? ` · ${NAZWY_STATUSU[s.status] || s.status}` : ''}
                        </div>
                      </td>
                      <td className="prawo">{fmt.liczba(s.liczba_akcjonariuszy)}</td>
                      <td className="prawo">
                        {fmt.liczba(s.liczba_akcji)}
                        {s.akcje_nieobjete > 0 && (
                          <div className="podpowiedz" style={{ color: 'var(--olive)' }}>
                            {fmt.liczba(s.akcje_nieobjete)} nieobjętych
                          </div>
                        )}
                      </td>
                      <td className="przyciemnione">{fmt.data(s.ostatnie_zdarzenie)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Karta>
        </div>
      </div>
    </>
  );
}

window.EkranPulpitu = EkranPulpitu;
