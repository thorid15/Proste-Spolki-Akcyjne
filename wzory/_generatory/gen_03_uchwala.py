# -*- coding: utf-8 -*-
"""Uchwała akcjonariuszy o wyborze podmiotu prowadzącego rejestr.
Wariant: podjęta poza walnym zgromadzeniem, na piśmie (art. 300(80) § 1 KSH).
Zgoda na tryb pisemny (art. 300(80) § 2 zd. 2 KSH) jest wyrażona w § 3 uchwały —
podpis pod uchwałą jest jednocześnie zgodą na tryb. Wymaga kompletu podpisów."""
from _naglowek import *

d = nowy_dokument()

naglowek_dok(d, ['Uchwała nr {{uchwala_numer}}',
                 'akcjonariuszy spółki {{spolka_firma}} prosta spółka akcyjna',
                 'siedziba: {{spolka_siedziba_mianownik}}',
                 'podjęta poza walnym zgromadzeniem, na piśmie,',
                 'w dniu {{uchwala_data_slownie}}'], size=13)

p = akapit(d, 'center', po=4)
pisz(p, 'w sprawie wyboru podmiotu prowadzącego rejestr akcjonariuszy', bold=True)
p = akapit(d, 'center', po=14)
pisz(p, 'art. §§300^31 § 5 w związku z art. §§300^80 § 1 Kodeksu spółek handlowych', italic=True, size=10)

p = akapit(d, 'center', po=6)
pisz(p, '§ 1', bold=True)
p = akapit(d, 'just', po=8)
pisz(p, 'Akcjonariusze spółki działającej pod firmą {{spolka_firma}} prosta spółka akcyjna, siedziba: '
        '{{spolka_siedziba_mianownik}} ({{spolka_adres_pelny}}), wpisanej do rejestru przedsiębiorców '
        'Krajowego Rejestru Sądowego prowadzonego przez {{spolka_sad_rejestrowy}} pod numerem '
        'KRS {{spolka_krs}}, NIP {{spolka_nip}}, REGON {{spolka_regon}}, działając na podstawie '
        'art. §§300^31 § 5 Kodeksu spółek handlowych, dokonują wyboru podmiotu prowadzącego rejestr '
        'akcjonariuszy Spółki w osobie: Kancelaria Notarialna, notariusz: {{notariusz_mianownik}}, '
        'adres: ulica {{kancelaria_ulica}}, {{kancelaria_kod}} {{kancelaria_miasto}}, '
        'NIP: {{kancelaria_nip}}, REGON: {{kancelaria_regon}}, oraz wyrażają zgodę na zawarcie umowy '
        'o prowadzenie rejestru akcjonariuszy prostej spółki akcyjnej.')

p = akapit(d, 'center', po=6)
pisz(p, '§ 2', bold=True)
p = akapit(d, 'just', po=8)
pisz(p, 'Uchwała wchodzi w życie z dniem jej podjęcia.')

p = akapit(d, 'center', po=6)
pisz(p, '§ 3', bold=True)
p = akapit(d, 'just', po=14)
pisz(p, 'Niżej podpisani akcjonariusze wyrażają zgodę na podjęcie niniejszej uchwały poza walnym zgromadzeniem, '
        'w trybie pisemnym (art. §§300^80 § 2 zdanie drugie Kodeksu spółek handlowych). Złożenie podpisu '
        'pod niniejszą uchwałą jest równoznaczne z wyrażeniem tej zgody.')

p = akapit(d, 'just', po=10)
pisz(p, 'Uchwała została podjęta {{uchwala_tryb_glosowania}}, przy {{uchwala_glosy_za}} głosach „za”, '
        '{{uchwala_glosy_przeciw}} głosach „przeciw” i {{uchwala_glosy_wstrzymujace}} głosach '
        '„wstrzymujących się”, co stanowi {{uchwala_procent_glosow}} ogólnej liczby głosów.')

p = akapit(d, 'left', przed=8, po=8)
pisz(p, 'Akcjonariusze biorący udział w głosowaniu:', bold=True)

p = akapit(d, 'left', po=2)
pisz(p, '{{#akcjonariusze}}')
p = akapit(d, 'left', po=0)
pisz(p, '{{akcjonariusz_nazwa}} – {{akcjonariusz_liczba_akcji}} akcji dających uprawnienie do '
        '{{akcjonariusz_liczba_glosow}} głosów')
p = akapit(d, 'left', przed=14, po=0)
pisz(p, '.....................................................')
p = akapit(d, 'left', po=10)
pisz(p, '{{/akcjonariusze}}')

p = akapit(d, 'left', przed=14, po=0)
pisz(p, 'Uchwałę wpisuje się do księgi protokołów spółki (art. §§300^100 § 4 Kodeksu spółek handlowych).',
     size=9, italic=True)

zapisz(d, '03-Uchwala-o-wyborze-notariusza-WZOR.docx')
