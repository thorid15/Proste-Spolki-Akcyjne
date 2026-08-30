# -*- coding: utf-8 -*-
"""Lista akcjonariuszy składana przez spółkę do sądu rejestrowego.
UWAGA: dokument spółki, nie kancelarii — nagłówek zawiera dane spółki,
podpisują go wszyscy członkowie organu zarządzającego."""
from _naglowek import *

d = nowy_dokument()

for i, l in enumerate(['{{spolka_firma}} prosta spółka akcyjna',
                       '{{spolka_adres_pelny}}',
                       'KRS {{spolka_krs}}, NIP {{spolka_nip}}']):
    p = akapit(d, 'left', po=0)
    pisz(p, l, size=10, bold=(i == 0))
p = akapit(d, 'right', przed=6, po=10)
pisz(p, '{{spolka_siedziba_mianownik}}, dnia {{pismo_data}} r.', size=10)

blok_adresata(d, 'Do')
tytul_pisma(d, 'LISTA AKCJONARIUSZY', 'art. §§300^34 § 8 Kodeksu spółek handlowych')

p = akapit(d, 'just', po=10)
pisz(p, 'Niniejsza lista obejmuje akcjonariuszy spółki {{spolka_firma}} prosta spółka akcyjna według stanu '
        'rejestru akcjonariuszy na dzień {{lista_stan_na_dzien}}.')

t = d.add_table(rows=2, cols=5)
t.style = 'Table Grid'
for i, h in enumerate(['Lp.', 'Nazwisko i imię albo firma (nazwa)', 'Seria', 'Liczba akcji',
                       'Wzmianka o zastawie lub użytkowaniu']):
    c = t.cell(0, i); c.text = ''
    p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
    pisz(p, h, bold=True, size=10)
for i, w in enumerate(['{{#akcjonariusze}}{{akcjonariusz_lp}}', '{{akcjonariusz_nazwa}}',
                       '{{akcjonariusz_seria}}', '{{akcjonariusz_liczba_akcji}}',
                       '{{akcjonariusz_obciazenia}}{{/akcjonariusze}}']):
    c = t.cell(1, i); c.text = ''
    p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
    pisz(p, w, size=10)

p = akapit(d, 'left', przed=10, po=6)
pisz(p, 'Łączna liczba akcji: {{lista_akcje_razem}}.')

p = akapit(d, 'just', po=6)
pisz(p, 'Rejestr akcjonariuszy spółki prowadzi Kancelaria Notarialna, notariusz: {{notariusz_mianownik}}, '
        'adres: ulica {{kancelaria_ulica}}, {{kancelaria_kod}} {{kancelaria_miasto}}.')

p = akapit(d, 'left', przed=18, po=0)
pisz(p, '{{#czlonkowie_organu}}')
p = akapit(d, 'left', przed=16, po=0)
pisz(p, '.......................................')
p = akapit(d, 'left', po=0)
pisz(p, '{{czlonek_mianownik}}', size=11)
p = akapit(d, 'left', po=0)
pisz(p, '{{czlonek_funkcja}}', size=9, italic=True)
p = akapit(d, 'left', po=0)
pisz(p, '{{/czlonkowie_organu}}')

zapisz(d, '08-Lista-akcjonariuszy-do-sadu-WZOR.docx')
