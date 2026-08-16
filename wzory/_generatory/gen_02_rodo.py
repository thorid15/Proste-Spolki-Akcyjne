# -*- coding: utf-8 -*-
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wspolne import *

d = nowy_dokument()

p = akapit(d, 'right', po=10)
pisz(p, 'Załącznik do Umowy o prowadzenie rejestru akcjonariuszy', size=10, italic=True)

naglowek_dok(d, ['Informacja o przetwarzaniu danych osobowych',
                 'w rejestrze akcjonariuszy prostej spółki akcyjnej'], size=13)

p = akapit(d, 'just', po=8)
pisz(p, 'Zgodnie z art. 13 ust. 1 i 2 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. '
        'w sprawie ochrony osób fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich '
        'danych oraz uchylenia dyrektywy 95/46/WE (ogólne rozporządzenie o ochronie danych) (Dz. Urz. UE L 119 z 04.05.2016, '
        's. 1), dalej zwanego „RODO”, informujemy, że:')

ustep(d, '1.', 'Administratorem Pani/Pana danych osobowych jest Kancelaria Notarialna Notariusza '
               '{{notariusz_dopelniacz}} z siedzibą w {{kancelaria_miasto_miejscownik}}, ulica {{kancelaria_ulica}} '
               '(kod pocztowy: {{kancelaria_kod}}), '
               'tel. {{kancelaria_telefon}}, adres e-mail: {{kancelaria_email}}, zwana dalej „Kancelarią”.')
ustep(d, '2.', 'Pani/Pana dane osobowe przetwarzane będą w celu:')
punkt(d, 'a)', 'zawarcia umowy o prowadzenie rejestru akcjonariuszy zgodnie z art. §§300^32 ustawy z dnia 15 września 2000 r. '
                '– Kodeks spółek handlowych (podstawa: art. 6 ust. 1 lit. b i c RODO);')
punkt(d, 'b)', 'prowadzenia rejestru akcjonariuszy przez Kancelarię zgodnie z art. §§300^31 ustawy z dnia 15 września 2000 r. '
                '– Kodeks spółek handlowych (podstawa: art. 6 ust. 1 lit. c RODO).')
ustep(d, '3.', 'W związku z przetwarzaniem danych w celach, o których mowa w pkt 2, odbiorcami danych osobowych będą:')
punkt(d, 'a)', 'podmioty przetwarzające dane w naszym imieniu: Krajowa Rada Notarialna prowadząca system Rejestry Notarialne, '
                'w którym udostępniony jest rejestr akcjonariuszy (odbiorcy w rozumieniu art. 4 pkt 9 RODO);')
punkt(d, 'b)', 'organy państwowe oraz organy ochrony prawnej (Policja, sąd, prokuratura) – w związku z prowadzonym '
                'postępowaniem.')
ustep(d, '4.', 'Dane osobowe będą przechowywane przez okres prowadzenia rejestru akcjonariuszy, a także po jego zakończeniu '
               'przez czas, w którym przepisy nakazują nam przechowywać dane w celach archiwalnych, lub do czasu cofnięcia zgody '
               'na przetwarzanie danych (dotyczy adresu poczty elektronicznej).')
ustep(d, '5.', 'W związku z przetwarzaniem Pani/Pana danych osobowych może Pani/Pan złożyć do nas wniosek o: dostęp do danych '
               'oraz o kopię danych, sprostowanie danych, usunięcie danych przetwarzanych bezpodstawnie, ograniczenie '
               'przetwarzania i przenoszenie danych, a także skorzystać z prawa do wniesienia sprzeciwu. Zakres każdego z tych '
               'praw oraz sytuacje, kiedy można z nich skorzystać, wynikają z przepisów prawa. To, z którego uprawnienia może '
               'Pani/Pan korzystać, zależeć będzie m.in. od podstawy prawnej oraz celu przetwarzania Pani/Pana danych '
               'przez Administratora.')
ustep(d, '6.', 'W przypadku gdy przetwarzanie danych osobowych odbywa się na podstawie Pani/Pana zgody (art. 6 ust. 1 lit. a '
               'RODO), podanie danych jest dobrowolne i przysługuje Pani/Panu prawo do cofnięcia tej zgody w dowolnym momencie, '
               'bez wpływu na zgodność z prawem przetwarzania, którego dokonano na podstawie zgody przed jej cofnięciem.')
ustep(d, '7.', 'Może Pani/Pan wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa, jeżeli '
               'uważa Pani/Pan, że przetwarzanie Pani/Pana danych narusza przepisy prawa.')
ustep(d, '8.', 'Podanie przez Panią/Pana danych wynika z przepisów prawa. Podanie adresu poczty elektronicznej jest dobrowolne '
               'i oznacza zgodę na komunikację w stosunkach ze spółką i podmiotem prowadzącym rejestr akcjonariuszy '
               'przy wykorzystaniu poczty elektronicznej.')
ustep(d, '9.', 'Pani/Pana dane osobowe nie będą przetwarzane w sposób zautomatyzowany i nie będą profilowane. Nie będą także '
               'przekazywane do państwa trzeciego.')

p = akapit(d, 'right', przed=24, po=2)
pisz(p, '{{zapoznany}}')
linia_podpisu(d, 'data, imię i nazwisko oraz podpis', align='right', przed=6)

d.save(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '02-Zalacznik-Informacja-RODO-WZOR.docx'))
print('ok')
