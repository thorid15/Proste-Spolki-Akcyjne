# -*- coding: utf-8 -*-
"""Klauzula do wklejenia do umowy zbycia albo obciążenia akcji.
Wariant zalecany: eliminuje odrębne żądanie i krok powiadomienia z art. 300(34) § 3."""
from _naglowek import *

d = nowy_dokument()

naglowek_dok(d, ['Klauzula do umowy zbycia albo obciążenia akcji',
                 'prostej spółki akcyjnej'], size=13)

p = akapit(d, 'just', po=14)
pisz(p, 'Poniższą klauzulę należy zamieścić w umowie przenoszącej akcje albo ustanawiającej na nich '
        'ograniczone prawo rzeczowe. Jej zamieszczenie sprawia, że nie jest konieczne składanie odrębnego '
        'żądania wpisu ani odrębnej zgody, a podmiot prowadzący rejestr nie ma obowiązku uprzedniego '
        'powiadomienia o treści zamierzonego wpisu.', italic=True, size=11)

p = akapit(d, 'center', przed=6, po=8)
pisz(p, '§ {{klauzula_paragraf}}. Zgoda na wpis w rejestrze akcjonariuszy i żądanie wpisu', bold=True)

ustep(d, '1.', 'Zbywca, jako osoba, której uprawnienia z akcji objętych niniejszą umową zostaną przez wpis '
               'wykreślone albo obciążone, wyraża zgodę na dokonanie w rejestrze akcjonariuszy spółki '
               '{{spolka_firma}} prosta spółka akcyjna, siedziba: {{spolka_siedziba_mianownik}}, '
               'KRS {{spolka_krs}}, wpisu wynikającego z niniejszej umowy. Zgoda dotyczy wyłącznie tego wpisu.')
ustep(d, '2.', 'Wobec zgody wyrażonej w ust. 1 powiadomienie, o którym mowa w art. §§300^34 § 3 Kodeksu spółek '
               'handlowych, nie jest wymagane.')
ustep(d, '3.', 'Strony wspólnie żądają dokonania wpisu i upoważniają każdą z nich do przedłożenia niniejszej '
               'umowy podmiotowi prowadzącemu rejestr akcjonariuszy jako dokumentu uzasadniającego wpis.')
ustep(d, '4.', 'Strony wskazują następujące adresy do doręczania powiadomień i zawiadomień dotyczących wpisu: '
               'Zbywca — {{zbywca_email}}; Nabywca — {{nabywca_email}}.')
ustep(d, '5.', 'Strony oświadczają, że akcje objęte niniejszą umową {{klauzula_pokrycie}} oraz że '
               '{{klauzula_ograniczenia}}.')

zapisz(d, '10-Klauzula-do-umowy-zbycia-akcji-WZOR.docx')
