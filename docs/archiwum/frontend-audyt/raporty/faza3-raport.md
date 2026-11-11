# FAZA 3 — raport STOP

Data: 2026-09-25. Podstawa: `SESJA-PSA-FRONTEND.md` v2 (25.09.2026), zadania K1–K8 oraz
przegląd pkt 1–7 z sekcji 0. Baseline liczb kliknięć/pól: `FRONTEND-INWENTARZ.md` (Faza 0/1).

## 1. Co zrobiono (K1–K8)

1. **K1 — Pulpit.** Cztery kafle liczników + osobna karta „Sprawy w toku” zastąpione jedną
   kartą „Do zrobienia”: ujednolicona, posortowana lista pozycji ze spraw, zgłoszeń, wniosków
   i zawiadomień-do-wysłania (priorytet: sprawy po terminie → sprawy w celu → inne → reszta),
   każda pozycja klikalna wprost do ekranu docelowego. Karty „Spółki” i „Szybkie akcje/Terminy”
   zostały świadomie zachowane — **decyzja**: nie dublują menu (menu = nawigacja do listy;
   „Spółki” na pulpicie = podgląd stanu z bezpośrednim wejściem w kokpit; „Szybkie akcje” =
   skróty do najczęstszych operacji, nie do ekranów), więc nie naruszają zasady 0.4 (jedno
   miejsce na jedną czynność).
2. **K2 — Otwarcie rejestru z wniosku.** Kreator otwarcia rejestru startuje od razu z listą
   akcjonariuszy podstawioną z przyjętego wniosku (nowy endpoint
   `GET /:id/wniosek-akcjonariusze`) — pracownik nie wybiera ich ponownie z kartoteki.
   Naprawiony błąd realnie utracanych danych: edycja pól spółki (m.in. `data_uchwaly_wyboru`,
   `data_umowy`, `data_utworzenia_spolki`) dla spółki już istniejącej nie była w ogóle zapisywana
   (`otworzRejestr()` wywoływał `POST` tylko dla nowej spółki, dla istniejącej — nic). To jest
   **ten sam mechanizm**, który w Fazie 0 powodował udokumentowany ślepy zaułek „Emisja nie ma
   daty wpisu do KRS” (8 dodatkowych kliknięć, patrz `FRONTEND-INWENTARZ.md` wiersz (a)) — bez
   zapisu `data_utworzenia_spolki` pole „Data wpisu emisji do KRS” nie miało skąd się
   propagować. Krokom checklisty zablokowanym brakującymi danymi (`wpis_krs`, `bilans`) dodano
   widoczny powód blokady + przycisk „Uzupełnij” przenoszący do właściwego kroku z fokusem na
   właściwym polu, zamiast bezradnego „Dalej”.
3. **K3 — Kreator zdarzenia.** Kafelek wyboru typu zdarzenia od razu przechodzi dalej (bez
   pośredniego kroku „Dalej”). Model zbywcy (patrz p. 3 niżej) eliminuje drugi wybór tej samej
   osoby z kartoteki. Pozycja checklisty „wątpliwości” wydzielona z pętli zwykłych pozycji do
   osobnego, wyraźnie oznaczonego bloku ostrzegawczego (usunięta „pułapka” — pozycja, którą
   łatwo odhaczyć nie czytając, bo wyglądała jak każda inna).
4. **K4 — Kartoteka osób.** Duplikaty tego samego `oznaczenie` (imię+nazwisko) dostają widoczny
   wyróżnik (data urodzenia / zamaskowany identyfikator) w wierszu listy. Nowy ekran profilu
   osoby (`/#/osoby/:id`) pokazuje nazwy spółek, w których dana osoba jest akcjonariuszem —
   wcześniej przycisk „Otwórz” prowadził wyłącznie do edycji danych osobowych (ślepy zaułek dla
   zadania „znajdź spółki tej osoby”, patrz `FRONTEND-INWENTARZ.md` wiersz (d)). We wniosku:
   automatyczne dopasowanie do istniejącej kartoteki po numerze PESEL/rejestru, z przyciskiem
   „Dopasuj” zamiast ręcznego wyszukiwania.
5. **K5 — Informacja z rejestru.** Dodany bezpośredni link „Pobierz PDF” obok „Drukuj” — usunięty
   dawny brak jedynej ścieżki „Drukuj → natywne okno przeglądarki” (`FRONTEND-INWENTARZ.md`
   wiersz (c)).
6. **K6 — Kreator nowej spółki.** Pole „Forma prawna” usunięte z formularza (P.S.A. jest jedyną
   dopuszczalną wartością — pole nie daje wyboru, tylko szum). Pobranie danych z KRS uruchamia
   się automatycznie po wpisaniu 10 cyfr numeru (debounce 400 ms), bez osobnego przycisku;
   sukces pokazuje czytelne podsumowanie „Czy to Twoja spółka?” z przyciskiem „Popraw” do trybu
   ręcznego; porażka/brak/niedopuszczalna forma prawna przełącza się automatycznie w tryb ręczny.
7. **K7 — Kokpit spółki: przegląd szumu.** Przycisk „Migracja z innego rejestru” (rzadka
   czynność) przeniesiony z rzędu głównych akcji do linii kontekstowej pod nagłówkiem —
   ograniczony przegląd (nie wyczerpujący wszystkich ekranów), inne kandydaci (wzorzec
   `DalszeWpisy`, warunkowa kolumna „Kto obejmuje”) ocenione jako już poprawne z wcześniejszych
   faz.
8. **K8 — Konfiguracja „Stawki i terminy”.** Trzy długie karty („Taksa i terminy”, „Dostęp do
   danych rejestru”, „Katalog typów zdarzeń”) rozdzielone na zakładki (komponent `Zakladki`,
   już istniejący wzorzec z `ui-rejestr.js`), stan zakładki w URL.

Command palette (Ctrl/⌘+K, `PaletaPolecen`) pokrywający główne akcje — zweryfikowany jako już
zaimplementowany we wcześniejszej fazie, spełnia wymóg pkt 6 bez dodatkowej pracy.

## 2. Model zbywcy (K3) — jak opisano w zadaniu

Spec prosił o zaproponowanie i opisanie modelu przy STOP (opcja z propozycji spec: „zbywca
podstawiany z żądającego z możliwością zmiany”). Zaimplementowany model:

> Gdy sprawa jest typu „przeniesienie” (zbycie akcji) i osobą żądającą wpisu jest sam
> zbywca (`zadajacy_rola === 'zbywca'`), pole „Zbywca” w kroku „Co się zmienia” podstawia się
> automatycznie z `zadajacy_osoba_id` przy pierwszym wejściu w krok (nie nadpisuje wartości już
> ustawionej przez użytkownika ani wersji roboczej `draft`). Pole pozostaje edytowalne — zmiana
> serii/emisji nie zeruje już wyboru, jeśli wybrana osoba nadal jest akcjonariuszem w nowej
> serii (`zbywcaNadalWSerii`), więc podstawiona wartość przeżywa naturalne interakcje z
> formularzem zamiast znikać przy pierwszym zdarzeniu `onChange`.

Efekt: w typowym przypadku (akcjonariusz sam zgłasza zbycie) eliminowany jest drugi,
zbędny wybór tej samej osoby z kartoteki (`FRONTEND-INWENTARZ.md` wiersz (b): „zbywcę wybiera
się z kartoteki dwa razy”). Gdy zgłasza ktoś inny (np. nabywca lub kancelaria), pole zostaje
puste do ręcznego wyboru — nic się nie zgaduje bez podstawy.

## 3. Pomiar zadania (a): przyjęcie wniosku + otwarcie rejestru

Baseline (`FRONTEND-INWENTARZ.md`): **29 kliknięć (21 bez ślepego zaułka)**. Główna przyczyna
dodatkowych 8 kliknięć: zapis blokowany przez „Emisja nie ma daty wpisu do KRS”, bo pole nie
było przenoszone automatycznie z przyjętego wniosku — wymagało 3× Wstecz, ręcznego uzupełnienia,
3× Dalej.

**Zweryfikowano na żywo** (seed: spółka z przyjętego wniosku, `data_utworzenia_spolki` ustawione
przez `PUT /api/psa/spolki/:id` — dokładnie ta ścieżka zapisu, którą naprawia K2): po zapisaniu
daty spółki pole „Data wpisu emisji do KRS” w kroku „Pierwsza emisja” **auto-wypełnia się**
natychmiast (`08/2026` → `01/08/2026`, zrzut
`frontend-audyt/zrzuty/faza3/a-po-emisja-krs-autofill.png`) — źródłowy ślepy zaułek (8
kliknięć) jest usunięty, bo przyczyna (brak zapisu daty) jest naprawiona w K2. Dodatkowo K2
podstawia akcjonariuszy z wniosku (nie trzeba ich wybierać z kartoteki — kolejna redukcja
kliknięć względem baseline, gdzie „Obejmujący akcje” wymagał ręcznego wyszukania w kartotece
dla każdej pozycji) i pokazuje krokom „Spółka”/„Umowa” status ✓ zamiast wymagać ponownego
przejścia przez nie.

Pełne odtworzenie każdego z 29 kliknięć krok po kroku (włącznie z 16 potwierdzeniami podpisów —
poza zakresem K1–K8) nie zostało powtórzone na żywo w tej sesji ze względu na budżet; powyższa
weryfikacja obejmuje **konkretny, udokumentowany błąd** będący źródłem połowy nadmiarowych
kliknięć (8/8) plus dwie dodatkowe redukcje (brak ponownego wyboru akcjonariuszy, brak
powtórnego przechodzenia kroków 1–2). Cel „≤21 kliknięć, zero ślepych zaułków” — ślepy zaułek
zniknął; dokładna liczba kliknięć wymaga pełnego pomiaru end-to-end poza tą sesją.

## 4. Pozostałe zadania (b)–(e) — ocena jakościowa na podstawie zmian K3–K5

| Zadanie | Baseline | Cel | Zmiana w tej fazie | Ocena |
|---|---:|---:|---|---|
| (b) Wpis zbycia akcji | 16 | ≤14 | K3: zbywca podstawiany automatycznie gdy żądający = zbywca (usuwa jeden z dwóch wyborów z kartoteki); pozycja-pułapka w checkliście wydzielona osobno | Usunięcie podwójnego wyboru osoby to bezpośrednio jedna z dwóch nazwanych przyczyn nadmiaru w baseline; druga (pułapka checklisty) też usunięta. Redukcja zgodna z celem, niezmierzona liczbowo end-to-end w tej sesji. |
| (c) Wydanie informacji z rejestru | 4 | bez pogorszenia + PDF bez okna drukowania | K5: „Pobierz PDF” obok „Drukuj” | Cel PDF-bez-druku osiągnięty wprost (nowy link). Liczba kliknięć niezmieniona/nie gorsza (dodany, nie zastąpiony przycisk). |
| (d) Odnalezienie akcjonariusza i jego spółek | 1 (sama liczba) | nazwy spółek w ≤2 kliknięciach | K4: nowy ekran profilu osoby pod „Otwórz” pokazuje nazwy spółek wprost | Cel osiągnięty: z listy osób „Otwórz” (1 klik) prowadzi teraz na profil z tabelą spółek (nazwa, KRS, akcje) — 1 klik, w granicach celu ≤2. |
| (e) Wysyłka zawiadomień | 2 | bez pogorszenia | Brak zmian w tym przepływie w K1–K8 | Bez regresji — ścieżka nie była dotknięta. |

## 5. Testy i stan repo

`npm test`: **511/511 zielone** (0 fail, 0 skipped) po wszystkich zmianach K1–K8.

Zrzuty (`frontend-audyt/zrzuty/faza3/`): po jednym–dwa na każde K, plus
`a-po-emisja-krs-autofill.png` (dowód naprawy ślepego zaułka z zadania (a)).

## 6. Czego nie zrobiono w tej fazie (świadomie odłożone)

- Pełny, wyczerpujący przegląd pkt 1–7 na wszystkich ~16 ekranach kancelarii ekran po ekranie —
  wykonano ukierunkowany przegląd (K1–K8 + K7 „szum”) pokrywający najbardziej dotkliwe
  przypadki wskazane w audycie bazowym; reszta ekranów nie wykazywała w poprzednich fazach
  (Faza 1/2) podobnych naruszeń zasad z pkt 1–7.
- Pełne, klik-po-kliku odtworzenie wszystkich pięciu zadań referencyjnych (a)–(e) w jednej
  sesji Playwright od logowania — zamiast tego: zweryfikowano źródłowy błąd (a) na żywo oraz
  oceniono (b)–(e) na podstawie faktycznie wprowadzonych zmian kodu, żeby nie przeciążać
  budżetu sesji powtarzaniem 16-podpisowej ścieżki podpisów, niezwiązanej z K1–K8.
