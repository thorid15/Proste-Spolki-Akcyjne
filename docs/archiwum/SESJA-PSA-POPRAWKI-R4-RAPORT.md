# Raport — SESJA-PSA-POPRAWKI-R4 (1–3.11.2026)

**Wykonane: 16 z 16 zadań** (0–15), trzy fazy, każda zakończona STOP. Testy `npm test`: **581 → 610**
(0 błędów); testy przeglądarkowe `npm run zrzuty`: **35** (w tym kontrola układu: 19 problemów → 0);
`npm run scenariusz:testowy`: **35/35**. Migracje 66–69. Szczegóły i rozstrzygnięcia: ledger
`.superpowers/sdd/SESJA-PSA-POPRAWKI-R4/progress.md` (lokalnie), decyzje `DECYZJE.md` D-089–D-094.

| Zad. | Pozycja | Wynik |
|---|---|---|
| 0 | Narzędzie zrzutów i kontroli układu | `npm run zrzuty` (Playwright, tryb testowy, osobna baza), `sprawdzUklad` |
| 1 | P1 „Dane spółki” | `ListaDanych`, margines karty |
| 2 | P2 „Do zapłaty” + baner kroku wniosku | Start portalu |
| 3 | P3/P4 | przycisk „Zgłoś błąd we wpisie”, nowy tekst o akcjonariacie |
| 4 | P5 „Stan na dzień” | `PoleDaty` tylko na datę |
| 5 | K4 PDF emisji | blok na serię, łamanie numerów, A4 |
| 6 | K1 układ sprawy | `KolumnaSprawy`, `PasekAkcji`, nazwy plików bez UUID |
| 7 | K5 oświadczenia poza rejestrem (D-092) | `stanOswiadczen`, historia, znacznik „list”, migr. 66, 68, 69 |
| 8 | P7 ponowne oświadczenie | checkboxy, jeden stan osoby |
| 9 | P8 ostrzeżenie przed cofnięciem zgody | okno „Cofnąć zgodę na e-mail?” |
| 10 | P6 bez nowej spółki z konta | 403 z komunikatem |
| 11 | K3 „Usuń z wysyłki” | migr. 67, 409 po nadaniu, blokada wpisu |
| 12 | K2 kartoteka w jednym widoku | sekcje, historia oświadczeń |
| 13 | D-089 pokrycie | „brak informacji o pełnym pokryciu”, zgoda spółki + art. 300⁴⁰ § 3 |
| 14 | D-090 powiadomienie domyślne | przycisk główny, zgoda jednym polem |
| 15 | D-091 nowy przebieg zbycia | 3 kroki, dobór numerów, definicja wpisu |

**Nowy przebieg zbycia — przed/po** (typowe zbycie z kokpitu, zbywca bez zgody na e-mail):
pola widoczne **21 → 9**; kliknięcia i wpisy **17 → 9**, plus checklista weryfikacji (6 pozycji, bez zmian — D-052).

**Rozstrzygnięcia domyślne:** potwierdzone przez Łukasza 3.11.2026 (karta „Do zapłaty” ukryta gdy pusta;
kolumna sprawy 48rem; powiadomienia automatyczne na osobę); dawne sprawy o zgodę — automatycznie (migr. 69).

**Przegląd kodu:** jeden, osobny recenzent po fazie 2 — werdykt „z poprawkami”; 3 poprawki z testami
(adres e-mail tylko z kartoteki, jedna reguła zgody, stan zgody nie dla innych akcjonariuszy). Faza 3 bez
osobnego przeglądu (plan przewidywał jeden).

**Otwarte / odłożone:**
- Zbycie akcji kilku serii albo na kilku nabywców = kilka spraw — **zaakceptowane przez Łukasza 3.11.2026**, bez zmian.

**Drobne poprawki po przeglądzie (3.11.2026, przed scaleniem):**
- Kwoty opłat — wszędzie netto (mniejsze) i brutto (wytłuszczone), jeden komponent `KwotaNettoBrutto`:
  Start i zakładka „Płatności” w portalu, cena informacji przed zamówieniem, wiersze i sumy w „Opłatach” kancelarii.
  **Błąd naprawiony przy okazji:** Start portalu doliczał VAT drugi raz (API portalu podaje już brutto) — np. 151,29 zł
  zamiast 123,00 zł; teraz API podaje wprost `kwota_netto_grosze` / `kwota_brutto_grosze`, przeglądarka niczego nie przelicza.
- „Usuń z wysyłki”: przycisk aktywny od 5 znaków powodu, błąd serwera zostaje w oknie razem z tekstem.
- Kartoteka osoby, sekcja „Sprawy”: nazwa typu i stanu sprawy zamiast kodów.
- Zgoda na e-mail w kartotece: wybór „W kancelarii” / „Pismem (nadesłane)” — trafia do historii oświadczeń.
- Usunięcie listu z wysyłki nie kasuje już znacznika powiadomienia wysłanego e-mailem do innej osoby; odrzucone
  nadanie (409) nie zostawia pliku skanu (dopisane do listy W6.4); kartoteka: zmiana danych i historia zgody w jednej transakcji.
- `POST /portal/oswiadczenia` z nieznaną spółką — 404 już z kontroli dostępu (test); komentarze o zgodzie zaktualizowane do D-092.
- Test `front-js`: żadna nazwa najwyższego poziomu nie powtarza się w paczce (sprawdzony na dawnej kolizji `zakresyNakladajaSie`).
- Zrzuty: dodane ekrany `portal-platnosci` i `kancelaria-oplaty` (układ bez problemów).
