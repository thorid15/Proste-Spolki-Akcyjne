# Baza sądów rejestrowych (`sady-rejestrowe.json`)

Fallback dla oznaczenia sądu rejestrowego, gdy API KRS go nie zwraca —
sekcja 1.7 poprawek. Potwierdzone empirycznie (żywa odpowiedź API, KRS
0001114217, rejestr=P, 17.08.2026): odpis dla rejestru przedsiębiorców
**nie zawiera** żadnego pola z oznaczeniem sądu rejestrowego. Fallback jest
więc potrzebny zawsze, nie tylko w rzadkich przypadkach.

## Stan na dziś: PUSTA

Plik zawiera schemat i puste tablice. `ustalSadRejestrowy()`
(`server/logika/sad-rejestrowy.js`) zwraca wtedy zawsze `null`, więc
aplikacja zachowuje się dokładnie tak jak przed poprawką — pole zostaje
puste i edytowalne, bez fałszywej propozycji. **To bezpieczny stan, nie
błąd** — nie wolno wypełnić tej bazy zgadywaniem.

## Dlaczego pusta, a nie wypełniona od razu

Zbudowanie tabeli wymaga dwóch źródeł danych naraz:

1. **Rozporządzenie MS z 28.12.2018 r.** (Dz.U. 2018 poz. 2548, tekst
   jednolity z późn. zm., ostatnia nowelizacja Dz.U. 2025 poz. 925 z
   11.07.2025) — które powiaty należą do obszaru właściwości którego sądu
   okręgowego.
2. **Wykaz Ministerstwa Sprawiedliwości** „Siedziby i obszary właściwości
   Wydziałów Gospodarczych KRS” (gov.pl/web/sprawiedliwosc) — który
   konkretnie sąd rejonowy i który numer wydziału prowadzi KRS dla obszaru
   danego sądu okręgowego (to NIE zawsze ten sam budynek co sąd okręgowy).

W środowisku, w którym powstał ten kod, dostęp sieciowy do obu źródeł (i w
zasadzie do całej domeny `gov.pl`, ISAP-u i Wikipedii) jest zablokowany na
poziomie proxy sesji — dokładnie ten sam problem, co z API KRS (patrz
`server/trasy/krs.js`). Wypełnienie tabeli zgadywaniem z pamięci byłoby
dokładnie tym błędem, przed którym ostrzega prompt poprawek („zakaz
opierania się na opracowaniach branżowych", „nie zgaduj — zgłoś").

## Jak uzupełnić

1. Pobrać tekst jednolity rozporządzenia (link: ISAP, `DU/2018/2548`) i
   wykaz wydziałów gospodarczych KRS (plik `.xlsx` na stronie MS,
   aktualizowany, stan na luty 2025 w chwili pisania tego pliku) —
   najprościej wkleić linki bezpośrednio w rozmowie z Claude, tak jak
   zrobiono to z odpowiedzią API KRS.
2. Wypełnić trzy tablice w `sady-rejestrowe.json`:
   - `sady_okregowe`: lista sądów okręgowych, każdy z `id`, `nazwa` i
     `wydzial_krs: { sad, numer_wydzialu, nazwa_pelna }` (sąd rejonowy
     prowadzący KRS dla tego okręgu — patrz wykaz MS, punkt 1 wyżej),
   - `powiaty`: dla każdego powiatu (~380 pozycji) — `teryt` (kod TERYT),
     `powiat` (nazwa, WIELKIMI LITERAMI jak zwraca KRS), `wojewodztwo`,
     `sad_okregowy_id` (klucz do `sady_okregowe`),
   - `wyjatki_gminne`: powiaty podzielone między okręgi — te same pola co
     `powiaty`, plus `gmina` (dopasowanie wtedy idzie po
     powiat+gmina+województwo, ma pierwszeństwo przed `powiaty`).
3. Uzupełnić `wersja_danych` (data przygotowania) i `obowiazuje_od` (data
   wejścia w życie ostatniej uwzględnionej nowelizacji rozporządzenia) —
   właściwości sądów się zmieniają, kolejne aktualizacje pliku powinny to
   pole aktualizować.
4. Dopisać testy w `testy/sad-rejestrowy.test.js` sprawdzające kilka
   konkretnych, znanych przypadków (w tym co najmniej jeden z
   `wyjatki_gminne`).

## Format dopasowania

`ustalSadRejestrowy({ wojewodztwo, powiat, gmina })` czyta te pola
dokładnie tak, jak przychodzą z `dzial1.siedzibaIAdres.siedziba` w
odpowiedzi API KRS (potwierdzone na żywych danych: WIELKIMI LITERAMI, np.
`"POMORSKIE"`, `"GDAŃSK"`). Dopasowanie jest wielkości liter niewrażliwe.

Wynik jest **zawsze propozycją**, nigdy wartością wiążącą — pole w
formularzu spółki zostaje edytowalne niezależnie od tego, czy dopasowanie
się powiodło (sekcja 1.7, punkt 3 poprawek).
