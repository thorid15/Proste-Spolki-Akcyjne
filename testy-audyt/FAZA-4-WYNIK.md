# FAZA 4 — wynik: podpisy i tożsamość

> Audyt read-only. Zero zmian w `server/`, `publiczne/`, `wzory/`, głównym `package.json`. Dane
> testowe własne (poza bazą FAZA 1): spółka „Faza4 AML Test 001 P.S.A." (id 7, KRS `0000999001`),
> osoby „Zalozyciel Adam" (id 17), „Nabywca Bogdan" (id 18); wniosek portalowy „Faza4 Podpisy
> P.S.A." (id 8, KRS `0000998877`, spółka końcowa id 12).

## ⚠️ KRYTYCZNE — do przeczytania w pierwszej kolejności

**1. Bramka AML NIE blokuje wpisu w stanie domyślnym.** `aml_status = 'brak'` — czyli status
KAŻDEJ nowo założonej osoby w kartotece, dopóki pracownik jej ręcznie nie zmieni — generuje przy
zdarzeniu transakcyjnym (objęcie, przeniesienie, obciążenie) wyłącznie **ostrzeżenie**, nigdy
**blokadę**. Blokuje wyłącznie jawnie ustawiony status `niemozliwe`. Potwierdzone bezpośrednim
żądaniem (`POST /api/psa/spolki/:id/zdarzenia`, `201 Created`, akcje faktycznie zapisane do
łańcucha) — **i to NIE jest luka jednego endpointu do ominięcia bramki**: dokładnie to samo
zachowanie ma „oficjalna" ścieżka `POST /api/psa/sprawy/:id/wpisz`, używana przez normalny ekran
kancelarii. Bramki AML blokującej wpis **w praktyce nie ma** — jest wyłącznie nienachalne
ostrzeżenie w treści odpowiedzi JSON, które przy jednej z trzech dróg zapisu (`otworz-rejestr`,
Z-204) nawet nie jest zwracane. Szczegóły: **Z-200** (KRYTYCZNY), pogłębione przez Z-201, Z-202,
Z-203, Z-204.

**2. Podpisany plik uznany za wiążący można podmienić PO potwierdzeniu przez kancelarię, bez
śladu.** Kancelaria potwierdza podpis dokumentu (`podpis_potwierdzono`/`podpis_potwierdzil`), po
czym klient wgrywa NA TEN SAM DOKUMENT zupełnie inny plik — serwer to przyjmuje, a znacznik
potwierdzenia zostaje bez zmian, teraz fałszywie przypisany do nowej, nigdy nieobejrzanej treści.
Ten podmieniony plik trafia jako egzemplarz `podpisany` do trwałych akt spółki i jako
`umowa_podpisana_sciezka` — pole, które w kodzie samo siebie opisuje jako prowadzące cały przebieg
wniosku. Zweryfikowane od uploadu przez cały cykl aż po `POST /:id/przyjmij` (spółka powstała) i
zrzutem ekranu UI kancelarii pokazującym zieloną plakietkę „podpis potwierdzony" przy podmienionym
pliku, bez żadnego ostrzeżenia. Tabela `psa_wnioski_dokumenty` nie zapisuje nawet hasha
potwierdzonej treści (w przeciwieństwie do `psa_osoby_skany_aml`), więc podmiany nie da się wykryć
później żadnym audytem. Szczegóły: **Z-205** (KRYTYCZNY). Warunek wystąpienia: kancelaria musi
potwierdzić podpis PRZED formalnym odesłaniem kompletu przez klienta (`POST
/wniosek/odeslij`) — w normalnym biegu UI mało prawdopodobne (kolejka kancelarii pokazuje wnioski
dopiero po odesłaniu), ale serwer TEGO NIE WYMUSZA i NIE SYGNALIZUJE, więc jedna przedwczesna akcja
pracownika wystarcza. Zob. też Z-206 (kontrast pozytywny — ten sam plik ma już analogiczne,
poprawne zabezpieczenie treści dokumentu PRZED podpisaniem, którego brakuje na etapie PO
potwierdzeniu podpisu).

## Faktyczny stan identyfikacji akcjonariusza (opis, bez oceny wystarczalności)

Pełny opis z odniesieniami do kodu: `testy-audyt/ZNALEZISKA.md` Z-210. W skrócie, identyfikacja
akcjonariusza w obecnym prototypie opiera się na kombinacji:

1. **Danych wpisanych przez spółkę/wnioskodawcę** w formularzu wniosku (portal klienta) —
   zweryfikowanych przez pracownika kancelarii wyłącznie pod kątem spójności z odpisem KRS i
   z kartoteką wspólną (unikanie duplikatów), nie pod kątem tożsamości osoby fizycznej.
2. **Skanu dokumentu tożsamości REPREZENTANTA** (`psa_wnioski.dowod_sciezka`) — zbieranego
   bezwarunkowo dla każdego wniosku, ale wyłącznie dla osoby podpisującej umowę w imieniu
   wnioskodawcy, nie dla pozostałych akcjonariuszy. Komentarz w kodzie
   (`server/trasy/portal.js:969-971`) sam przyznaje ograniczenie tej metody. Ten skan nigdy nie
   jest automatycznie powiązany z żadnym polem AML w kartotece.
3. **Opcjonalnego skanu dokumentu AML per osoba** (`psa_osoby_skany_aml`) — mechanizm domyślnie
   WYŁĄCZONY per spółka (`stosuje_procedure_aml = 0`), a gdy włączony — wgrywany WYŁĄCZNIE przez
   pracownika kancelarii, nie przez samego akcjonariusza portalu; treść pliku nigdy nie jest
   automatycznie porównywana z danymi formularza.
4. **Podpisanego oświadczenia własnego** (beneficjent rzeczywisty, status PEP) — czyli
   samoidentyfikacji akcjonariusza pod rygorem odpowiedzialności karnej za fałszywe oświadczenie,
   nie weryfikacji niezależnej.
5. **Swobodnego osądu pracownika kancelarii**, który ostatecznie ustawia `aml_status = wykonane`
   ręcznie, bez wymogu wskazania podstawy poza opcjonalną notatką tekstową.

Nie istnieje żadna metoda dająca wyższy poziom pewności (podpis kwalifikowany akcjonariusza jako
WARUNEK — nie tylko dopuszczalna forma podpisania umowy, weryfikacja wideo, przelew referencyjny,
stawiennictwo). Czy to wystarcza — pytanie **P-012** do Łukasza.

## Wyniki per punkt checklisty FAZA 4

| Punkt | Wynik | Znalezisko |
|---|---|---|
| Forma umowy — bez żądania podpisu kwalifikowanego | Poprawnie: UI dopuszcza skan podpisu własnoręcznego na równi z podpisem kwalifikowanym/zaufanym, cytuje art. 78¹ §2 k.c.; katalog nieprawidłowych „form zgody" świadomie usunięty w sprincie 5. | **Z-207 (POZYTYWNE)** |
| Kolejność podpisów (spółka → notariusz) | Potwierdzone wcześniej w Z-016 (FAZA 1); tu pogłębione: treść dokumentu zablokowana do edycji po podpisaniu (Z-206, pozytywne), ale znacznik POTWIERDZENIA podpisu — nie treść dokumentu przed podpisaniem — da się „przeżyć" podmianę pliku po fakcie. | **Z-205 (KRYTYCZNY)**, Z-206 (pozytywne) |
| Egzemplarz autorytatywny — oznaczony i niemodyfikowalny? | Oznaczony: tak (`umowa_podpisana_sciezka`, rola `podpisany` w aktach spółki). Niemodyfikowalny: NIE — do potwierdzenia podpisu istnieje modyfikowalne okno (patrz wyżej). Brak nawet hasha do wykrycia podmiany po fakcie. | **Z-205 (KRYTYCZNY)** |
| Weryfikacja podpisu kwalifikowanego w pliku | Brak weryfikacji kryptograficznej — kontrola ogranicza się do sygnatury bajtowej formatu (PDF/JPG/PNG); każda z trzech dopuszczonych metod podpisu trafia tą samą drogą, nierozróżnialnie. | **Z-208 (opis stanu)** |
| Rozdzielenie ścieżek: podpis umowy vs identyfikacja AML | Architektura poprawna — `/api/psa/osoby` (AML) dostępne wyłącznie dla pracownika, portal klienta nie ma i nie może mieć wpływu na `aml_status`. Skuteczność rozdzielenia ograniczona przez Z-200 (jedna ze stron „rozdzielenia" i tak nie blokuje niczego). | **Z-209 (POZYTYWNE, z zastrzeżeniem)** |
| Na czym opiera się identyfikacja akcjonariusza | Opisane wyżej i w Z-210 — bez oceny wystarczalności. | **Z-210 (opis stanu)** → pytanie **P-012** |
| Bramka AML blokująca wpis — czy da się ominąć wywołując endpoint bezpośrednio | Bramka blokuje WYŁĄCZNIE `aml_status: 'niemozliwe'`; stan domyślny `brak` nigdy nie blokuje, na ŻADNEJ z trzech dróg zapisu zdarzenia — to nie jest kwestia „ominięcia", tylko strukturalna cecha wspólnej funkcji walidującej. | **Z-200 (KRYTYCZNY)**, Z-201, Z-204 → pytanie **P-013** |
| Data i termin przeglądu AML — dezaktualizacja | Pole i logika liczenia terminu (12 mies.) istnieją, ale są wyłącznie kosmetyczną plakietką w kartotece — nigdy nie wpływają na wynik bramki transakcyjnej. | **Z-202 (POWAŻNY)** → pytanie **P-014** |
| Rozróżnienie osoba fizyczna / prawna (beneficjent rzeczywisty) | Bramka AML traktuje obie identycznie; pole beneficjenta rzeczywistego jest opcjonalne i nigdy nie jest samo sprawdzane przy wpisie, nawet dla nabywcy-osoby prawnej. | **Z-203 (do potwierdzenia wagi)** → pytanie **P-014** |

## Znaleziska dodatkowe (poza checklistą, odkryte po drodze)

- **Z-201** (POWAŻNY) — pozycja checklisty dokumentu „aml" (`wymagana: true`) jest czysto opisowa,
  nic po stronie serwera nie sprawdza jej odhaczenia — źródłowa przyczyna UX dla Z-200.
- **Z-204** (POWAŻNY) — `POST /api/psa/spolki/:id/otworz-rejestr` (jedyna wyeksponowana ścieżka
  otwarcia rejestru dla spółek z portalu — patrz Z-005 z FAZA 1) w ogóle nie zwraca ostrzeżeń AML
  w odpowiedzi, więc nawet pracownik wywołujący ją wprost nie widzi sygnału o brakującej
  weryfikacji przy zdarzeniach założycielskich.

## Czego nie udało się przetestować i dlaczego

1. **Rzeczywista treść skanu AML/porównanie z OCR.** Poza zakresem prototypu — nie istnieje żaden
   mechanizm automatycznego odczytu/porównania treści skanu z danymi formularza, więc nie było
   czego testować poza potwierdzeniem, że taki mechanizm nie istnieje (opisane w Z-210).
2. **Rzeczywisty podpis kwalifikowany (plik PAdES).** Nie miałem dostępu do certyfikatu
   kwalifikowanego w środowisku audytu — test Z-208 oparty na analizie kodu (`pliki.trescPasuje`)
   i na tym, że pliki testowe bez żadnego podpisu (81/97-bajtowe „PDF-y" ze sztuczną treścią)
   zostały przyjęte bez zastrzeżeń, co samo w sobie odpowiada na pytanie checklisty.
3. **Zachowanie UI kancelarii przy próbie potwierdzenia podpisu PRZED statusem `umowa_podpisana`.**
   Przetestowałem to wyłącznie bezpośrednim żądaniem API (`curl`) — nie sprawdziłem, czy sam ekran
   kancelarii (`publiczne/js/wnioski.js`) w ogóle pokazuje przycisk „Sprawdź podpis”/„Potwierdź” dla
   wniosku, który jeszcze nie ma statusu `umowa_podpisana` (czyli czy scenariusz z Z-205 wymaga
   pominięcia UI, czy jest osiągalny też przez samą przeglądarkę, np. przez wejście na URL wniosku
   z zapamiętanej zakładki przed formalnym odesłaniem kompletu przez klienta). Nie zmienia to oceny
   luki — sam fakt, że serwer to dopuszcza, jest wystarczający — ale zawęża opis wektora ataku
   w praktyce.

## Zrzuty ekranu

`testy-audyt/zrzuty/faza4/`:
- `01-wniosek8-po-przyjeciu.png` — karta wniosku #8 po przyjęciu (status „przyjęty”).
- `02-spolka7-kokpit.png` — rejestr spółki #7 z przyjętym przeniesieniem akcji na „Nabywca Bogdan”
  mimo braku AML w chwili wpisu (Z-200); panel „Procedura AML” pokazuje domyślnie odznaczony
  przełącznik `stosuje_procedure_aml` z opisem stanu wyłączonego (Z-209).
- `03-osoba18-nabywca.png` — kartoteka osób z kolumną AML (widoczne statusy `brak` / `niemożliwe` /
  `wykonane` obok siebie, w tym „Nabywca Bogdan” ustawiony na `niemożliwe` w teście kontrolnym
  Z-200).
- `04-wniosek8-dokumenty-swap.png` — DOWÓD Z-205: dokument „Umowa o prowadzenie rejestru” pokazuje
  zieloną plakietkę „podpis potwierdzony” obok linku `umowa-podpisana-B-SWAPPED.pdf` — pliku
  wgranego PO potwierdzeniu przez kancelarię, różnego od pliku faktycznie ocenionego.

## Znaleziska tej fazy — pełna lista

Z-200 (KRYTYCZNY), Z-201 (POWAŻNY), Z-202 (POWAŻNY), Z-203 (do potwierdzenia wagi), Z-204
(POWAŻNY), Z-205 (KRYTYCZNY), Z-206 (POZYTYWNE), Z-207 (POZYTYWNE), Z-208 (opis stanu), Z-209
(POZYTYWNE z zastrzeżeniem), Z-210 (opis stanu). Pytania: P-012, P-013, P-014 w
`testy-audyt/PYTANIA-DO-LUKASZA.md`.
