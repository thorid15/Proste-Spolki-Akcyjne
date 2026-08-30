# -*- coding: utf-8 -*-
"""Umowa o prowadzenie rejestru akcjonariuszy — dokument scalony.
Dawne OWU (osobny załącznik nr 1) wcielone jako rozdziały I i III-VIII.
Usunięto: klauzulę modyfikacyjną OWU (dawny § 13 ust. 1-3) — bez wzorca umownego
nie ma czego jednostronnie zmieniać, zmiana umowy następuje aneksem."""
from _naglowek import *

d = nowy_dokument()


def rozdzial(tytul):
    p = akapit(d, 'center', przed=16, po=6)
    pisz(p, tytul, bold=True)


naglowek_dok(d, ['Umowa', 'o prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej'], size=14)

p = akapit(d, 'just', po=6)
pisz(p, 'zawarta w {{kancelaria_miasto_miejscownik}} dnia {{umowa_data}} roku pomiędzy:')

p = akapit(d, 'just', po=6)
pisz(p, 'Spółką pod firmą {{spolka_firma}} prosta spółka akcyjna z siedzibą w {{spolka_siedziba_miejscownik}} '
        '({{spolka_adres_pelny}}), wpisaną do rejestru przedsiębiorców Krajowego Rejestru Sądowego '
        'prowadzonego przez {{spolka_sad_rejestrowy}} pod numerem KRS {{spolka_krs}}, '
        'NIP {{spolka_nip}}, REGON {{spolka_regon}} (dalej jako „Spółka”),')

p = akapit(d, 'just', po=6)
pisz(p, 'reprezentowaną przez {{reprezentant_biernik}}, {{reprezentant_syn_corka}} {{reprezentant_rodzice}}, '
        '{{reprezentant_legitymujacy}} dowodem osobistym {{reprezentant_dowod}}, PESEL {{reprezentant_pesel}}, '
        '{{reprezentant_zamieszkaly}}: {{reprezentant_adres}}, {{reprezentant_dzialajacy}} jako '
        '{{reprezentant_funkcja_biernik}} – {{reprezentant_reprezentacja}} powyższej Spółki,')

p = akapit(d, 'just', po=6)
pisz(p, 'a')

p = akapit(d, 'just', po=6)
pisz(p, 'Notariuszem {{notariusz_narzednik}} prowadzącym Kancelarię Notarialną w {{kancelaria_miasto_miejscownik}}, '
        'przy ulicy {{kancelaria_ulica}}, NIP {{kancelaria_nip}}, REGON {{kancelaria_regon}} '
        '(dalej jako: „Notariusz”)')

p = akapit(d, 'just', po=10)
pisz(p, 'zwanymi dalej łącznie „Stronami”, a oddzielnie „Stroną”, o następującej treści:')

# ======================================================= ROZDZIAŁ I
rozdzial('Rozdział I. Postanowienia ogólne')

paragraf(d, 1, 'DEFINICJE')
p = akapit(d, 'just', po=4)
pisz(p, 'Przez użyte w Umowie pojęcia rozumie się:')
for lit, tekst in [
    ('1)', '<b>Akcje</b> – akcje Spółki podlegające rejestracji w Rejestrze;'),
    ('2)', '<b>Akcjonariusz</b> – podmiot będący osobą fizyczną, osobą prawną lub jednostką organizacyjną '
           'nieposiadającą osobowości prawnej, o której mowa w art. §§33^1 Kodeksu cywilnego, która jest ujawniona '
           'w Rejestrze jako uprawniona z Akcji;'),
    ('3)', '<b>Kancelaria Notarialna</b> – Kancelaria Notarialna Notariusza prowadzącego Rejestr;'),
    ('4)', '<b>Osoba mająca interes prawny</b> – Akcjonariusz; nabywca Akcji, w tym spadkobierca, zapisobierca '
           'lub inny następca prawny Akcjonariusza; zastawnik Akcji; użytkownik Akcji lub inna osoba, która posiada '
           'interes prawny w dokonaniu Wpisu;'),
    ('5)', '<b>Odpis KRS</b> – odpis aktualny lub pełny z rejestru przedsiębiorców KRS wydany przez Centralną '
           'Informację KRS lub wydruk aktualnej albo pełnej informacji o podmiocie wpisanym do KRS pobrany w trybie '
           'art. 4 ust. 4aa ustawy o Krajowym Rejestrze Sądowym ze strony internetowej Ministerstwa Sprawiedliwości '
           'https://ekrs.ms.gov.pl/;'),
    ('6)', '<b>Rejestr</b> – rejestr akcjonariuszy prostej spółki akcyjnej, o którym mowa w art. §§300^30 § 1 '
           'Kodeksu spółek handlowych;'),
    ('7)', '<b>Uchwała</b> – uchwała Akcjonariuszy o wyborze Notariusza jako podmiotu prowadzącego Rejestr, '
           'o której mowa w art. §§300^31 § 5 Kodeksu spółek handlowych;'),
    ('8)', '<b>Usługa</b> – usługa prowadzenia Rejestru i podejmowanie czynności z tym związanych;'),
    ('9)', '<b>Wpis</b> – wpis, zmiana oraz wykreślenie wpisu w Rejestrze;'),
    ('10)', '<b>Taksa</b> – maksymalne wynagrodzenie Notariusza określone w rozporządzeniu Ministra Sprawiedliwości '
            'w sprawie maksymalnych stawek taksy notarialnej.'),
]:
    p = akapit(d, 'just', po=3, wciecie=1.5, wysuniecie=-0.75)
    p.paragraph_format.tab_stops.add_tab_stop(Cm(1.5))
    pisz(p, '%s\t' % lit)
    for i, cz in enumerate(tekst.replace('<b>', '\x01').replace('</b>', '\x01').split('\x01')):
        if cz:
            pisz(p, cz, bold=(i % 2 == 1))

paragraf(d, 2, 'UPRAWNIENIA NOTARIUSZA')
p = akapit(d, 'just', po=4)
pisz(p, 'Notariusz posiada uprawnienia do prowadzenia Rejestru na podstawie przepisów Rozdziału 8a ustawy '
        'Prawo o notariacie, na zasadach określonych w art. §§300^31–§§300^35 Kodeksu spółek handlowych.')

paragraf(d, 3, 'OŚWIADCZENIA SPÓŁKI')
p = akapit(d, 'just', po=4)
pisz(p, 'W związku z zawarciem niniejszej Umowy Spółka oświadcza, że:')
punkt(d, '1)', 'nie zawarła z innym podmiotem obowiązującej umowy o prowadzenie rejestru akcjonariuszy Spółki '
                '(art. §§300^32 § 1 Kodeksu spółek handlowych);')
punkt(d, '2)', 'obrót Akcjami nie podlega ograniczeniom ustanowionym w powszechnie obowiązujących przepisach prawa, '
                'w szczególności ograniczeniom, o których mowa w art. 3a ust. 1 i art. 4 ust. 6 ustawy z dnia '
                '11 kwietnia 2003 r. o kształtowaniu ustroju rolnego, w brzmieniu obowiązującym na dzień podpisania '
                'niniejszej Umowy;')
punkt(d, '3)', 'wyraża zgodę na przekazywanie jej informacji przez Notariusza na trwałym nośniku informacji innym '
                'niż papier, na adres poczty elektronicznej wskazany w § 15 niniejszej Umowy;')
punkt(d, '4)', 'wszelkie dokumenty i informacje, które zostały przekazane przez Spółkę Notariuszowi lub które będą '
                'przekazane w związku ze świadczeniem Usługi:')
for tir in ['są aktualne na dzień ich przekazania;',
            'są autentyczne, nie zostały podrobione lub przerobione oraz nie wprowadzają w błąd co do okoliczności '
            'prawnych i faktycznych, których dotyczą;',
            'są kompletne;',
            'ich przekazanie nie stanowi naruszenia obowiązujących przepisów prawa ani naruszenia zobowiązań '
            'i powinności Spółki wynikających z umów, których stroną jest Spółka.']:
    punkt(d, '–', tir, wciecie=2.25)

# ======================================================= ROZDZIAŁ II
rozdzial('Rozdział II. Przedmiot Umowy')

paragraf(d, 4, 'PRZEDMIOT UMOWY')
ustep(d, '1.', 'Spółka powierza, a Notariusz przyjmuje zlecenie prowadzenia rejestru akcjonariuszy prostej spółki '
               'akcyjnej, o którym mowa w art. §§300^30 § 1 Kodeksu spółek handlowych, za wynagrodzeniem, w sposób '
               'i na zasadach opisanych w ustawie Prawo o notariacie, Kodeksie spółek handlowych i innych powszechnie '
               'obowiązujących przepisach prawa oraz w niniejszej Umowie.')
ustep(d, '2.', 'Niniejsza Umowa określa całość praw i obowiązków Stron związanych z prowadzeniem Rejestru. '
               'Strony nie stosują odrębnego wzorca umownego.')

paragraf(d, 5, 'DOKUMENTY NIEZBĘDNE DO ZAWARCIA UMOWY')
ustep(d, '1.', 'Do zawarcia Umowy konieczne jest uprzednie przedłożenie przez Spółkę Notariuszowi następujących '
               'dokumentów:')
for lit, t in [('1)', 'Uchwały;'),
               ('2)', 'aktualnej umowy Spółki;'),
               ('3)', 'Odpisu KRS dotyczącego Spółki, przy czym Notariusz może samodzielnie pobrać Odpis KRS '
                      'ze strony internetowej Ministerstwa Sprawiedliwości https://ekrs.ms.gov.pl/;'),
               ('4)', 'dokumentów potwierdzających nadanie numeru statystycznego REGON oraz numeru identyfikacji '
                      'podatkowej NIP, o ile identyfikatory te nie zostały zamieszczone w Odpisie KRS;'),
               ('5)', 'dokumentów na temat dodatkowych informacji ujawnianych w Rejestrze, o ile takie dokumenty '
                      'okażą się niezbędne, oraz innych dokumentów, jeżeli obowiązek taki wynika z przepisów prawa '
                      'w dniu zawarcia Umowy.')]:
    punkt(d, lit, t)
ustep(d, '2.', 'W przypadku gdy Notariusz będzie posiadać uzasadnione wątpliwości co do prawidłowości podjęcia '
               'Uchwały, może według swego wyboru odmówić zawarcia Umowy lub wezwać Spółkę do usunięcia uchybień '
               'w terminie 7 dni.')
ustep(d, '3.', 'W razie odmowy zawarcia Umowy Notariusz jest zobowiązany do pisemnego poinformowania Spółki '
               'o odmowie, jeżeli Spółka zwróciła się do Notariusza w formie dokumentowej lub pisemnej o prowadzenie '
               'Rejestru.')
ustep(d, '4.', 'W okresie obowiązywania Umowy Spółka jest zobowiązana do aktualizacji danych zawartych w Umowie '
               'oraz do przekazywania Notariuszowi informacji o zdarzeniach mogących mieć wpływ na wykonywanie '
               'obowiązków Stron, nie później niż w terminie 7 dni od zmiany danych lub zajścia zdarzenia.')
ustep(d, '5.', 'Dokumenty niezbędne do zawarcia Umowy lub dokonania Wpisów muszą być przedłożone Notariuszowi '
               'w formie wymaganej przez przepisy prawa, w oryginale lub notarialnie poświadczonej kopii, lub – '
               'o ile przewidują to przepisy prawa i zostało to uprzednio uzgodnione z Notariuszem – za pomocą '
               'elektronicznych nośników informacji. Dokumenty, informacje i oświadczenia Spółki sporządzane są '
               'w języku polskim; dokumenty obcojęzyczne wymagają tłumaczenia przysięgłego na język polski. '
               'W razie uzasadnionych wątpliwości, w szczególności co do autentyczności, prawdziwości czy pochodzenia '
               'przedłożonych dokumentów, Notariusz może zażądać dodatkowych dokumentów i informacji, a Spółka '
               'przekaże odpowiedź nie później niż w terminie 7 dni od otrzymania zapytania.')
ustep(d, '6.', 'Żadna ze Stron nie może przenieść praw i obowiązków wynikających z Umowy na rzecz osób trzecich.')

# ======================================================= ROZDZIAŁ III
rozdzial('Rozdział III. Zasady prowadzenia Rejestru')

paragraf(d, 6, 'FORMA PROWADZENIA REJESTRU')
p = akapit(d, 'just', po=4)
pisz(p, 'Rejestr prowadzony jest w postaci elektronicznej, przy wykorzystaniu oprogramowania do prowadzenia '
        'Rejestru Akcjonariuszy Prostej Spółki Akcyjnej udostępnionego przez Krajową Radę Notarialną na stronie '
        'internetowej https://rejestry-notarialne.pl, zapewniającego bezpieczeństwo i integralność danych '
        'zawartych w Rejestrze.')

paragraf(d, 7, 'TREŚĆ REJESTRU')
ustep(d, '1.', 'Rejestr zawiera następujące informacje:')
for lit, t in [('a)', 'firmę, siedzibę i adres Spółki;'),
               ('b)', 'oznaczenie sądu rejestrowego i numer, pod którym Spółka jest wpisana do rejestru '
                      'przedsiębiorców;'),
               ('c)', 'datę zarejestrowania Spółki i emisji Akcji;'),
               ('d)', 'serię i numer, rodzaj danej Akcji i uprawnienia szczególne z Akcji;'),
               ('e)', 'nazwisko i imię albo firmę (nazwę) Akcjonariusza oraz adres jego zamieszkania albo siedziby '
                      'albo inny adres do doręczeń, a także adres poczty elektronicznej, jeżeli Akcjonariusz wyraził '
                      'zgodę na komunikację w stosunkach ze Spółką i Notariuszem przy wykorzystaniu poczty '
                      'elektronicznej;'),
               ('f)', 'na żądanie Osoby mającej interes prawny – Wpis o przejściu Akcji lub praw zastawniczych '
                      'na inną osobę albo o ustanowieniu na Akcji ograniczonego prawa rzeczowego wraz z datą Wpisu '
                      'oraz wskazaniem nabywcy albo zastawnika lub użytkownika, adresu ich zamieszkania albo siedziby '
                      'lub innych adresów do doręczeń, a także adresu poczty elektronicznej, jeżeli osoby te wyraziły '
                      'zgodę na komunikację przy wykorzystaniu poczty elektronicznej, oraz liczby, rodzaju, serii '
                      'i numerów nabytych albo obciążonych Akcji;'),
               ('g)', 'na żądanie zastawnika albo użytkownika – Wpis, że przysługuje mu prawo wykonywania prawa głosu '
                      'z obciążonej Akcji;'),
               ('h)', 'na żądanie Akcjonariusza – Wpis o wykreśleniu obciążenia jego Akcji ograniczonym prawem '
                      'rzeczowym;'),
               ('i)', 'wzmiankę o tym, czy Akcje zostały w całości pokryte;'),
               ('j)', 'ograniczenia co do rozporządzania Akcją;'),
               ('k)', 'postanowienia umowy Spółki o związanych z Akcją obowiązkach wobec Spółki.')]:
    punkt(d, lit, t)
ustep(d, '2.', 'Rejestr może zawierać dodatkowe informacje poza wskazanymi w ust. 1, jeżeli umowa Spółki tak stanowi.')
ustep(d, '3.', 'Wpisanie do Rejestru adresu poczty elektronicznej zgodnie z ust. 1 lit. e) i f) wymaga wyrażenia '
               'zgody na komunikację w stosunkach ze Spółką i Notariuszem przy wykorzystaniu poczty elektronicznej. '
               'Osoby te mogą w każdym czasie zażądać wykreślenia z Rejestru adresu poczty elektronicznej, '
               'co jest równoznaczne z cofnięciem zgody.')
ustep(d, '4.', 'Spółka jest zobowiązana do zawiadomienia Notariusza o wszelkich zmianach informacji wymienionych '
               'w ust. 1 i 2 oraz zmianach umowy Spółki, a także przekazania Notariuszowi umowy Spółki w przypadku '
               'jej zmiany, nie później niż w terminie 7 dni od dnia zajścia zdarzenia powodującego obowiązek Wpisu.')

paragraf(d, 8, 'JAWNOŚĆ REJESTRU I INFORMACJA Z REJESTRU')
ustep(d, '1.', 'Rejestr jest jawny dla Spółki i każdego Akcjonariusza. Spółka i Akcjonariusze mają prawo dostępu '
               'do danych zawartych w Rejestrze za pośrednictwem Notariusza oraz mają prawo żądać wydania, '
               'w postaci papierowej lub elektronicznej, informacji z Rejestru.')
ustep(d, '2.', 'Wniosek o wydanie informacji z Rejestru sporządza się w języku polskim; może być złożony '
               'w Kancelarii Notarialnej w formie pisemnej lub elektronicznie na adres poczty elektronicznej '
               'Notariusza wskazany w § 15 niniejszej Umowy.')
ustep(d, '3.', 'Notariusz wydaje informację z Rejestru w terminie 7 dni od dnia złożenia wniosku, przesyłając ją '
               'na adres korespondencyjny albo na adres poczty elektronicznej wnioskodawcy. Na wniosek Spółki '
               'lub Akcjonariusza informacja może zostać wydana w formie papierowej w Kancelarii Notarialnej.')

# ======================================================= ROZDZIAŁ IV
rozdzial('Rozdział IV. Dokonywanie Wpisów')

paragraf(d, 9, 'TRYB I PODSTAWA WPISU')
ustep(d, '1.', 'Notariusz dokonuje Wpisu na żądanie Spółki lub Osoby mającej interes prawny w terminie nie dłuższym '
               'niż 7 dni od dnia otrzymania żądania. Jeżeli dokonanie Wpisu wymaga usunięcia przeszkody, Wpis '
               'następuje w terminie nie dłuższym niż 7 dni od dnia jej usunięcia (art. §§300^34 § 1 Kodeksu spółek '
               'handlowych).')
ustep(d, '2.', 'Podstawę dokonania Wpisu mogą stanowić wyłącznie dokumenty uzasadniające dokonanie Wpisu, '
               'przedłożone przez Spółkę lub Osobę mającą interes prawny. Podstawę Wpisu stanowi również oświadczenie '
               'Akcjonariusza o zobowiązaniu do przeniesienia Akcji lub obciążenia jej ograniczonym prawem rzeczowym '
               '(art. §§300^34 § 4 Kodeksu spółek handlowych).')
ustep(d, '3.', 'Przed dokonaniem Wpisu Notariusz sprawdza formę i treść dokumentów stanowiących podstawę Wpisu, '
               'weryfikuje tożsamość osoby żądającej Wpisu, ustala, czy czynność prawna stanowiąca podstawę Wpisu '
               'została dokonana w formie wymaganej przez przepisy prawa, oraz sprawdza, czy z treści przedłożonego '
               'dokumentu wynika, że Wpis o żądanej treści powinien zostać dokonany.')
ustep(d, '4.', 'Notariusz nie weryfikuje zgodności z prawem ani prawdziwości dokumentów uzasadniających dokonanie '
               'Wpisu, w tym prawdziwości podpisów, chyba że poweźmie w tym względzie uzasadnione wątpliwości; '
               'w takim przypadku podejmuje dodatkowe czynności w celu ich wyjaśnienia (art. §§300^34 § 5 Kodeksu '
               'spółek handlowych).')
ustep(d, '5.', 'W przypadku gdy dokonania Wpisu żąda osoba prawna lub jednostka organizacyjna, o której mowa '
               'w art. §§33^1 Kodeksu cywilnego, jest ona zobowiązana do przedłożenia Odpisu KRS jej dotyczącego, '
               'przy czym Notariusz może pobrać Odpis KRS samodzielnie.')
ustep(d, '6.', 'Przed dokonaniem Wpisu Notariusz sprawdza w Rejestrze, czy w stosunku do Akcji będących przedmiotem '
               'Wpisu istnieją ograniczenia co do rozporządzania. Jeżeli takie ograniczenia występują, Notariusz '
               'odmawia dokonania Wpisu, gdy treść żądanego Wpisu pozostaje z nimi w sprzeczności '
               '(art. §§300^34 § 6 Kodeksu spółek handlowych).')
ustep(d, '7.', 'W przypadku objęcia Akcji Wpis może nastąpić nie wcześniej niż po wpisie Spółki do rejestru '
               'przedsiębiorców albo po wpisie nowej emisji Akcji w rejestrze przedsiębiorców.')
ustep(d, '8.', 'W przypadku gdy dokumenty przedłożone w celu dokonania Wpisu posiadają niewłaściwą formę lub treść '
               'albo gdy Notariusz poweźmie uzasadnione wątpliwości co do ich zgodności z prawem lub prawdziwości, '
               'Notariusz odmawia dokonania Wpisu i niezwłocznie zawiadamia o tym osobę żądającą Wpisu, podając '
               'przyczyny niedokonania Wpisu (art. §§300^34 § 7 zdanie drugie Kodeksu spółek handlowych).')

paragraf(d, 10, 'POWIADOMIENIA I ZAWIADOMIENIA')
ustep(d, '1.', 'Przed dokonaniem Wpisu, z wyłączeniem przypadku, o którym mowa w art. §§300^34 § 2 Kodeksu spółek '
               'handlowych, Notariusz powiadamia o treści zamierzonego Wpisu osobę, której uprawnienia mają być '
               'wykreślone, zmienione lub obciążone przez Wpis, chyba że wyraziła ona na to zgodę '
               '(art. §§300^34 § 3 Kodeksu spółek handlowych).')
ustep(d, '2.', 'O dokonanym Wpisie Notariusz niezwłocznie zawiadamia osobę żądającą Wpisu oraz Spółkę '
               '(art. §§300^34 § 7 zdanie pierwsze Kodeksu spółek handlowych).')
ustep(d, '3.', 'Powiadomienia i zawiadomienia następują na adres korespondencyjny wskazany w Rejestrze albo '
               'w żądaniu, chyba że wyrażono zgodę na komunikację przy użyciu poczty elektronicznej.')
ustep(d, '4.', 'Po otrzymaniu zawiadomienia o dokonanym Wpisie Spółka niezwłocznie składa do sądu rejestrowego '
               'listę akcjonariuszy podpisaną przez wszystkich {{spolka_organ_czlonkowie}} '
               '(art. §§300^34 § 8 Kodeksu spółek handlowych). Notariusz przekazuje Spółce projekt tej listy '
               'sporządzony na podstawie stanu Rejestru.')

# ======================================================= ROZDZIAŁ V
rozdzial('Rozdział V. Wynagrodzenie i zwrot wydatków')

paragraf(d, 11, 'WYNAGRODZENIE')
ustep(d, '1.', 'Za czynności związane z prowadzeniem Rejestru Notariuszowi przysługuje od Spółki wynagrodzenie '
               'w postaci Taksy, płatne z góry, w wysokości określonej w § 15b rozporządzenia Ministra '
               'Sprawiedliwości z dnia 28 czerwca 2004 r. w sprawie maksymalnych stawek taksy notarialnej, '
               'w brzmieniu obowiązującym na dzień dokonania danej czynności, to jest:')
punkt(d, 'a)', 'za prowadzenie Rejestru – w stosunku rocznym, za każdy rozpoczęty rok – maksymalna stawka wynosi '
                '{{taksa_roczna}} zł ({{taksa_roczna_slownie}});')
punkt(d, 'b)', 'za dokonanie Wpisu – maksymalna stawka wynosi {{taksa_wpis}} zł ({{taksa_wpis_slownie}});')
punkt(d, 'c)', 'za udzielenie informacji z Rejestru, o której mowa w art. §§300^35 § 3 Kodeksu spółek handlowych – '
                'maksymalna stawka wynosi {{taksa_informacja}} zł ({{taksa_informacja_slownie}}).')
ustep(d, '2.', 'Do kwot wskazanych w ust. 1 dolicza się podatek od towarów i usług (VAT) według stawki '
               'obowiązującej w dniu dokonania czynności.')
ustep(d, '3.', 'Warunkiem rozpoczęcia prowadzenia Rejestru, dokonania Wpisu oraz udzielenia informacji z Rejestru '
               'jest uiszczenie Taksy.')
ustep(d, '4.', 'Spółka wyraża zgodę na otrzymywanie faktur w postaci elektronicznej.')
ustep(d, '5.', 'Niezależnie od Taksy Notariuszowi przysługuje zwrot poniesionych wydatków, w szczególności kosztów '
               'obowiązkowej korespondencji wynikającej z przepisów prawa, kierowanej do Spółki lub Akcjonariuszy '
               'i wysłanej pocztą tradycyjną. Zwrot wydatków następuje w terminie 7 dni od doręczenia Spółce faktury '
               'lub noty obciążeniowej.')

# ======================================================= ROZDZIAŁ VI
rozdzial('Rozdział VI. Odpowiedzialność')

paragraf(d, 12, 'ODPOWIEDZIALNOŚĆ STRON')
ustep(d, '1.', 'Notariusz wykonuje czynności dotyczące realizacji Usługi na podstawie Umowy, ustawy Prawo '
               'o notariacie, Kodeksu spółek handlowych i innych powszechnie obowiązujących przepisów prawa, '
               'w oparciu o dokumenty, informacje i oświadczenia przedkładane przez Spółkę oraz inne osoby '
               'uprawnione do składania żądań.')
ustep(d, '2.', 'W celu umożliwienia Notariuszowi prawidłowej realizacji Usługi Spółka zobowiązuje się do ścisłej '
               'współpracy z Notariuszem, niezwłocznego ujawniania mu wszystkich okoliczności mogących mieć wpływ '
               'na prawidłową realizację Usługi i niezwłocznego przekazywania wnioskowanych dokumentów i informacji.')
ustep(d, '3.', 'Opóźnienia Spółki w wykonaniu jej obowiązków lub ich nienależyte wykonanie mogą spowodować '
               'przesunięcie terminu wykonania obowiązków Notariusza, bez konsekwencji po jego stronie za okres '
               'opóźnienia.')
ustep(d, '4.', 'Spółka daje gwarancję prawdziwości i zupełności danych zawartych w informacjach, dokumentach '
               'oraz oświadczeniach przedkładanych Notariuszowi. Notariusz nie ponosi odpowiedzialności za '
               'niezupełność, nieprawdziwość lub niezgodność ze stanem faktycznym lub prawnym tych danych, '
               'w szczególności za dokonanie Wpisów zgodnych z przekazaną mu umową Spółki lub innymi dokumentami, '
               'jeżeli Spółka nie zawiadomiła Notariusza o ich zmianach.')
ustep(d, '5.', 'W przypadku niewykonania lub nienależytego wykonania Usługi przez Notariusza Spółce przysługuje '
               'odszkodowanie za rzeczywiste szkody będące bezpośrednim i normalnym następstwem tych zdarzeń, '
               'jeżeli szkody zostały wyrządzone umyślnie lub wynikają z rażącego niedbalstwa Notariusza, '
               'w wysokości nie wyższej niż dwukrotność wynagrodzenia za prowadzenie Rejestru w stosunku rocznym.')

# ======================================================= ROZDZIAŁ VII
rozdzial('Rozdział VII. Doręczenia i dane osobowe')

paragraf(d, 13, 'ADRESY DO DORĘCZEŃ')
ustep(d, '1.', 'Jeżeli niniejsza Umowa nie stanowi inaczej, wszelkie oświadczenia, żądania, wezwania, informacje '
               'i dokumenty związane z zawarciem i wykonaniem Umowy będą doręczane między Stronami na następujące '
               'adresy:')
p = akapit(d, 'left', po=2, wciecie=1.5)
pisz(p, 'Kancelaria Notarialna Notariusza {{notariusz_dopelniacz}}', bold=True)
p = akapit(d, 'left', po=2, wciecie=1.5)
pisz(p, '– adres korespondencyjny: {{kancelaria_kod}} {{kancelaria_miasto}}, ulica {{kancelaria_ulica}}')
p = akapit(d, 'left', po=8, wciecie=1.5)
pisz(p, '– adres poczty elektronicznej: {{kancelaria_email}}')
p = akapit(d, 'left', po=2, wciecie=1.5)
pisz(p, 'Spółka {{spolka_firma}} prosta spółka akcyjna z siedzibą w {{spolka_siedziba_miejscownik}}', bold=True)
p = akapit(d, 'left', po=2, wciecie=1.5)
pisz(p, '– adres korespondencyjny: {{spolka_adres_pelny}}')
p = akapit(d, 'left', po=8, wciecie=1.5)
pisz(p, '– adres poczty elektronicznej: {{spolka_email}}')
ustep(d, '2.', 'Jeżeli jedna ze Stron nie powiadomi drugiej o zmianie adresu do doręczeń, wszelkie oświadczenia, '
               'żądania, wezwania, informacje i dokumenty wysłane na podany powyżej adres, w tym adres poczty '
               'elektronicznej, będą uważane za skutecznie doręczone.')
ustep(d, '3.', 'Zmiana adresu poczty elektronicznej nie stanowi zmiany Umowy.')
ustep(d, '4.', 'Spółka wyraża zgodę na komunikację z Notariuszem przy użyciu poczty elektronicznej, '
               'w szczególności w zakresie powiadamiania o treści zamierzonego Wpisu (art. §§300^34 § 3 Kodeksu '
               'spółek handlowych) oraz o dokonanym Wpisie.')

paragraf(d, 14, 'OCHRONA DANYCH OSOBOWYCH')
ustep(d, '1.', 'Notariusz przetwarza dane osobowe jako niezależny administrator, na podstawie niniejszej Umowy, '
               'rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. '
               '(Dz. Urz. UE L 119 z 04.05.2016, s. 1), ustawy Prawo o notariacie i innych powszechnie '
               'obowiązujących przepisów prawa.')
ustep(d, '2.', 'Informacja o przetwarzaniu danych osobowych stanowi Załącznik do niniejszej Umowy.')

# ======================================================= ROZDZIAŁ VIII
rozdzial('Rozdział VIII. Obowiązywanie i rozwiązanie Umowy')

paragraf(d, 15, 'WEJŚCIE W ŻYCIE I CZAS TRWANIA')
ustep(d, '1.', 'W przypadku gdy Spółka w dniu zawarcia niniejszej Umowy nie przedłoży Notariuszowi Uchwały, '
               'Umowa wchodzi w życie po jej przedłożeniu; za dzień wejścia w życie uznaje się wówczas dzień '
               'potwierdzenia przez Notariusza przedłożenia Uchwały przez Spółkę.')
ustep(d, '2.', 'Umowa została zawarta na czas nieoznaczony.')

paragraf(d, 16, 'ROZWIĄZANIE UMOWY')
ustep(d, '1.', 'Spółka jest uprawniona do rozwiązania Umowy z zachowaniem jednomiesięcznego okresu wypowiedzenia '
               'wyłącznie w przypadku, gdy zawarła nową umowę o prowadzenie rejestru akcjonariuszy prostej spółki '
               'akcyjnej z innym podmiotem, o którym mowa w art. §§300^31 § 1 Kodeksu spółek handlowych. Warunkiem '
               'skuteczności rozwiązania Umowy jest uprzednie doręczenie Notariuszowi uchwały o wyborze nowego '
               'podmiotu prowadzącego rejestr akcjonariuszy oraz kopii nowej umowy.')
ustep(d, '2.', 'Notariusz jest uprawniony do rozwiązania Umowy z zachowaniem trzymiesięcznego okresu wypowiedzenia '
               'z ważnych powodów, do których w szczególności należą:')
for lit, t in [('1)', 'naruszenie przez Spółkę postanowień Umowy;'),
               ('2)', 'naruszenie przez Spółkę przepisów prawa mogących w ocenie Notariusza zagrażać dalszemu '
                      'wykonywaniu Usługi;'),
               ('3)', 'przedłożenie przez Spółkę podrobionych lub przerobionych dokumentów lub oczywiście '
                      'nieprawdziwych informacji;'),
               ('4)', 'zaprzestanie prowadzenia działalności gospodarczej przez Spółkę;'),
               ('5)', 'wykorzystanie przez Spółkę lub Akcjonariusza Rejestru w celach sprzecznych z prawem;'),
               ('6)', 'brak zapłaty wynagrodzenia lub zwrotu wydatków w terminie określonym w Umowie, pomimo '
                      'uprzedniego wezwania;'),
               ('7)', 'brak możliwości kontaktu ze Spółką, uniemożliwiający wykonywanie Usługi;'),
               ('8)', 'zaistnienie braków w organach Spółki, uniemożliwiających jej funkcjonowanie;'),
               ('9)', 'zajście zdarzenia uniemożliwiającego Notariuszowi wykonywanie Usługi.')]:
    punkt(d, lit, t)
ustep(d, '3.', 'W okresie wypowiedzenia obie Strony zobowiązują się podejmować w dobrej wierze czynności zmierzające '
               'do zakończenia współpracy, w sposób zapewniający prowadzenie Rejestru zgodnie z Umową i przepisami '
               'prawa.')
ustep(d, '4.', 'Umowa wygasa w przypadku wykreślenia Spółki z rejestru przedsiębiorców albo zaprzestania '
               'prowadzenia działalności przez Notariusza. Zamknięcie Rejestru następuje na podstawie postanowienia '
               'o wykreśleniu Spółki z rejestru przedsiębiorców.')

paragraf(d, 17, 'ARCHIWIZACJA I PRZEKAZANIE DANYCH')
ustep(d, '1.', 'Dokumenty i informacje związane z realizacją Usługi, w szczególności dokumenty będące podstawą '
               'Wpisu, przechowywane są przez Notariusza w postaci papierowej lub elektronicznej przez okres 6 lat, '
               'licząc od pierwszego dnia roku następującego po roku, w którym zostały sporządzone lub otrzymane.')
ustep(d, '2.', 'W przypadku rozwiązania Umowy dane zawarte w Rejestrze oraz dokumenty i informacje związane '
               'z realizacją Usługi zostaną niezwłocznie przekazane przez Notariusza podmiotowi, z którym Spółka '
               'zawarła nową umowę o prowadzenie rejestru akcjonariuszy. Notariusz jest uprawniony do sporządzenia '
               'i przechowywania ich kopii przez okres, o którym mowa w ust. 1. Spółka zobowiązana jest zapewnić '
               'Notariuszowi możliwość przekazania tych danych.')
ustep(d, '3.', 'Jeśli po wykreśleniu Spółki z rejestru przedsiębiorców istnieje jej następca prawny, dane zawarte '
               'w Rejestrze oraz dokumenty i informacje związane z realizacją Usługi mogą zostać przekazane następcy '
               'prawnemu, o ile Spółka złożyła takie żądanie przed wykreśleniem z rejestru przedsiębiorców.')
ustep(d, '4.', 'Z chwilą zaprzestania prowadzenia działalności przez Notariusza dokumenty obejmujące dokonanie '
               'czynności notarialnych związanych z prowadzeniem Rejestru wraz z danymi stanowiącymi Rejestr '
               'Notariusz przekazuje radzie właściwej izby notarialnej, o czym prezes tej izby niezwłocznie '
               'zawiadamia Spółkę.')

paragraf(d, 18, 'POSTANOWIENIA KOŃCOWE')
ustep(d, '1.', 'Niniejsza Umowa została sporządzona w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej '
               'ze Stron.')
ustep(d, '2.', 'Wszelkie zmiany niniejszej Umowy wymagają dla swej ważności formy pisemnej lub formy elektronicznej '
               'pod rygorem nieważności.')
ustep(d, '3.', 'Spory wynikające z niniejszej Umowy lub z nią związane rozstrzygane będą przez sąd powszechny '
               'właściwy dla siedziby Kancelarii Notarialnej.')

podpisy(d, 'Za Spółkę', 'Za Notariusza')

p = akapit(d, 'left', przed=16, po=2)
pisz(p, 'Załącznik – Informacja o przetwarzaniu danych osobowych w rejestrze akcjonariuszy prostej spółki akcyjnej.',
     size=11)

zapisz(d, '01-Umowa-o-prowadzenie-rejestru-akcjonariuszy-WZOR.docx')
