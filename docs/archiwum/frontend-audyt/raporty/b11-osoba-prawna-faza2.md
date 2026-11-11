# B11 — Akcjonariusz osoba prawna: weryfikacja trzech ścieżek + dwa pytania do Łukasza

Sesja frontendowa v2, FAZA 2, 2026-09-25. Bez implementacji — zgodnie z zakresem B11
(`komponenty-formularze-b1b12-raport.md`, sekcja B11 z FAZY 0 wykryła zduplikowany formularz
wniosku portalowego; ta notatka weryfikuje stan PO ujednoliceniu w FAZIE 1 i domyka dwa pytania
merytoryczne, których ujednolicenie formularza nie rozstrzyga).

## 1. Weryfikacja trzech ścieżek — POTWIERDZONA, jeden wspólny formularz

FAZA 0 wykryła, że wniosek portalowy miał WŁASNY, zduplikowany formularz akcjonariusza-osoby
prawnej, niezależny od kartoteki, i że brakowało kolumny `kraj` w `psa_wnioski_akcjonariusze`.
Stan po FAZIE 1:

1. **Kartoteka kancelarii** — `publiczne/js/osoby.js`, `PanelOsoby` → `<FormularzOsoby tryb="kancelaria" …>`
   (linia 294).
2. **Kreator zdarzenia** — `publiczne/js/kreator.js` nie ma własnego formularza osoby; każde
   `WyborZKartoteki` (np. linie 712, 715, 781…) otwiera przy „+ Nowa osoba w kartotece" TEN SAM
   `PanelOsoby` z `osoby.js` (`ui-rejestr.js:1209-1216`). Ścieżka 2 pokrywa się więc w 100% ze
   ścieżką 1 — to jeden punkt wejścia do formularza, nie osobny formularz.
3. **Wniosek portalowy** — `publiczne/js/wniosek.js:363` → `<FormularzOsoby tryb="portal" …>`.
   Dawny zduplikowany formularz (fizyczna/prawna toggle sprzed FAZY 1) został usunięty.

Kolumna `kraj` w `psa_wnioski_akcjonariusze` istnieje (migracja 52,
`server/migracje.js:2079`) — luka z FAZY 0 zamknięta.

**Wniosek: trzy ścieżki renderują dziś JEDEN formularz (`formularz-osoby.js`) z jednym miejscem
walidacji (`walidujOsobe`) — ryzyko rozjazdu polei/walidacji między ścieżkami, które opisywała
FAZA 0, nie istnieje już strukturalnie.** Pozostają dwie luki MERYTORYCZNE (nie
formularzowe) opisane niżej — obu wspólny formularz nie rozwiązuje, bo dotyczą modelu danych,
nie samego pola wejściowego.

## 2. Pytanie A — kto fizycznie działa za akcjonariusza-osobę prawną

**Ustalenie w kodzie:** dokument „Żądanie pierwszego wpisu" podpisuje każdy akcjonariusz osobno
(`server/logika/dokumenty-wniosku.js:418-419`):

```js
b.sekcja('Podpisy'),
...akcjonariusze.map((a) => b.podpis(`${oznaczenie(a)} — data i podpis`)),
```

Dla akcjonariusza-osoby prawnej `oznaczenie(a)` zwraca WYŁĄCZNIE `a.nazwa` (firmę) —
`dokumenty-wniosku.js:85`. Linia podpisu na wydruku brzmi więc np. „Testowa Sp. z o.o. — data
i podpis", bez żadnego miejsca na imię i nazwisko osoby fizycznej, która w jej imieniu faktycznie
złoży podpis (członek zarządu, prokurent, pełnomocnik). To wprost sprzeczne z komentarzem w tym
samym pliku (`wniosek.js:1097`): „Pozostałe oświadczenia każdy akcjonariusz podpisuje osobiście —
zarząd nie może złożyć ich za niego" — zdanie napisane z założeniem osoby fizycznej; osoba prawna
z definicji nie może podpisać się „osobiście" i wymaga reprezentanta, a formularz `FormularzOsoby`
(`dane.typ === 'prawna'`) nie zbiera dla akcjonariusza żadnego odpowiednika pól
`reprezentant_imie_nazwisko` / `reprezentant_funkcja` / `reprezentant_dowod_*`, które od B2/B3
zbiera się dla reprezentanta SPÓŁKI (kontrahenta umowy o prowadzenie rejestru).

**Skutek praktyczny:** przy akcjonariuszu-osobie prawnej pracownik kancelarii musi dziś dopisać
dane reprezentanta ręcznie na wydrukowanym papierze (poza systemem) albo w polu „Notatka AML"
(`osoby.js`, pole wolnotekstowe, nie trafia na wydruki dla klienta — więc nawet to nie pomaga przy
generowaniu dokumentu do podpisu).

**Pytanie do Łukasza:** czy przy żądaniu wpisu / oświadczeniach podpisywanych przez
akcjonariusza-osobę prawną system powinien zbierać dane osoby fizycznej działającej w jej imieniu
(analogicznie do reprezentanta spółki z B2/B3— imię i nazwisko, funkcja/pełnomocnictwo, dowód
tożsamości), i czy to pole powinno być per-dokument (osoba może się zmienić między dokumentami tego
samego wniosku) czy per-akcjonariusz w kartotece?

## 3. Pytanie B — czy jeden `beneficjent_rzeczywisty_id` wystarcza

**Ustalenie w kodzie:** `psa_osoby.beneficjent_rzeczywisty_id` to pojedynczy klucz obcy do jednej
osoby fizycznej (`osoby.js:404-411`, komponent `WyborZKartoteki` — wybór JEDNEJ osoby). Tymczasem
wydrukowane „Oświadczenie o beneficjencie rzeczywistym" (`dokumenty-wniosku.js:326-344`) używa
liczby mnogiej wprost w treści: „Wskazuję **osoby fizyczne** będące beneficjentami rzeczywistymi
podmiotu wskazanego wyżej" — z jednym zestawem pól do ręcznego wypełnienia
(`b.doWypelnienia([...])`, imię i nazwisko / PESEL / obywatelstwo / państwo / charakter
uprawnień) pod tym zdaniem. Ustawa AML (art. 2 ust. 2 pkt 1) dopuszcza więcej niż jednego
beneficjenta rzeczywistego dla jednego podmiotu (np. dwóch wspólników po 50% w spółce-akcjonariuszu)
— ani schemat (`psa_osoby`), ani `WyborZKartoteki`, ani drukowany formularz nie mają miejsca na
DRUGĄ osobę bez ręcznego dopisania na marginesie.

To pytanie pokrywa się z **P-001** (czy identyfikacja beneficjenta ma być wymagana/ostrzegana) i
**P-014** (czy brak beneficjenta ma blokować wpis) w `DECYZJE.md` — oba dziś otwarte i
świadomie nietknięte z powodu ⚠️ w `PRZEPISY-PSA.md` sekcja 9. To pytanie jest jednak WĘŻSZE i
niezależne od nich: nawet gdyby P-001/P-014 rozstrzygnęły, że identyfikacja beneficjenta jest
zawsze wymagana, dzisiejszy schemat i tak nie pozwoliłby zapisać więcej niż jednego.

**Pytanie do Łukasza:** czy `beneficjent_rzeczywisty_id` ma zostać polem pojedynczym (praktyka:
przy współkontroli kancelaria zapisuje „głównego" beneficjenta, resztę opisowo w notatce AML), czy
model danych powinien dopuszczać wielu beneficjentów rzeczywistych na jedną osobę prawną (nowa
tabela łącząca, analogicznie do współwłasności akcji)?

## Zakres tej notatki

Świadomie BEZ implementacji — obie luki dotyczą modelu danych i wymagają decyzji Łukasza (patrz
pytania wyżej), nie są defektem formularza, który dałoby się naprawić lokalnie. Weryfikacja
trzech ścieżek (sekcja 1) jest kompletna i nie wymaga dalszej pracy w tej sesji.
