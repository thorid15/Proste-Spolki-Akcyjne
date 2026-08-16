# -*- coding: utf-8 -*-
"""Wspólne funkcje formatujące dla wzorów PSA (Times New Roman 12, A4, marginesy 2,5 cm)."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.enum.section import WD_SECTION

FONT = 'Times New Roman'


def nowy_dokument():
    d = Document()
    st = d.styles['Normal']
    st.font.name = FONT
    st.font.size = Pt(12)
    rpr = st.element.get_or_add_rPr()
    rf = rpr.get_or_add_rFonts()
    rf.set(__import__('docx').oxml.ns.qn('w:eastAsia'), FONT)
    pf = st.paragraph_format
    pf.space_after = Pt(6)
    pf.space_before = Pt(0)
    pf.line_spacing = 1.15
    s = d.sections[0]
    s.page_width = Cm(21.0)
    s.page_height = Cm(29.7)
    for m in ('left_margin', 'right_margin', 'top_margin', 'bottom_margin'):
        setattr(s, m, Cm(2.5))
    return d


def akapit(doc, align='just', przed=0, po=6, wciecie=0, wysuniecie=None, interlinia=1.15):
    p = doc.add_paragraph()
    p.alignment = {'just': WD_ALIGN_PARAGRAPH.JUSTIFY, 'center': WD_ALIGN_PARAGRAPH.CENTER,
                   'left': WD_ALIGN_PARAGRAPH.LEFT, 'right': WD_ALIGN_PARAGRAPH.RIGHT}[align]
    pf = p.paragraph_format
    pf.space_before = Pt(przed)
    pf.space_after = Pt(po)
    pf.line_spacing = interlinia
    if wciecie:
        pf.left_indent = Cm(wciecie)
    if wysuniecie is not None:
        pf.first_line_indent = Cm(wysuniecie)
    return p


def txt(p, tekst, bold=False, italic=False, size=12, sup=False, caps=False, underline=False):
    """Dodaje run. Każdy placeholder powinien być osobnym runem -> patrz pisz()."""
    r = p.add_run(tekst)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    r.underline = underline
    if sup:
        r.font.superscript = True
    if caps:
        r.font.all_caps = True
    return r


import re
_PH = re.compile(r'(\{\{[#/]?[a-z0-9_]+\}\})')
_KSH = re.compile(r'§§(\d{1,3})\^(\d{1,2})')  # zapis §§300^34 -> art. 300(34) z indeksem górnym


def pisz(p, tekst, bold=False, italic=False, size=12):
    """Rozbija tekst na runy tak, by każdy {{placeholder}} był osobnym, nierozbitym runem.
    Obsługuje też zapis §§300^34 -> 300 z indeksem górnym 34."""
    for czesc in _PH.split(tekst):
        if not czesc:
            continue
        if _PH.fullmatch(czesc):
            txt(p, czesc, bold=bold, italic=italic, size=size)
        else:
            pos = 0
            for m in _KSH.finditer(czesc):
                if m.start() > pos:
                    txt(p, czesc[pos:m.start()], bold=bold, italic=italic, size=size)
                txt(p, m.group(1), bold=bold, italic=italic, size=size)
                txt(p, m.group(2), bold=bold, italic=italic, size=size, sup=True)
                pos = m.end()
            if pos < len(czesc):
                txt(p, czesc[pos:], bold=bold, italic=italic, size=size)
    return p


def naglowek_dok(doc, linie, size=14):
    for i, l in enumerate(linie):
        p = akapit(doc, 'center', przed=0 if i else 0, po=2 if i < len(linie) - 1 else 14)
        pisz(p, l, bold=True, size=size)


def paragraf(doc, numer, tytul=None):
    p = akapit(doc, 'center', przed=12, po=6)
    pisz(p, '§ %s' % numer, bold=True)
    if tytul:
        p2 = akapit(doc, 'center', przed=0, po=6)
        pisz(p2, tytul, bold=True)


def ustep(doc, numer, tekst, wciecie=0.75):
    p = akapit(doc, 'just', po=4, wciecie=wciecie, wysuniecie=-0.75)
    pisz(p, '%s\t' % numer)
    pisz(p, tekst)
    pf = p.paragraph_format
    from docx.shared import Cm as _Cm
    tab = p.paragraph_format.tab_stops
    tab.add_tab_stop(_Cm(wciecie))
    return p


def punkt(doc, znacznik, tekst, wciecie=1.5):
    p = akapit(doc, 'just', po=3, wciecie=wciecie, wysuniecie=-0.75)
    pisz(p, '%s\t' % znacznik)
    pisz(p, tekst)
    p.paragraph_format.tab_stops.add_tab_stop(Cm(wciecie))
    return p


def podpisy(doc, lewa, prawa):
    doc.add_paragraph()
    t = doc.add_table(rows=2, cols=2)
    t.autofit = True
    dane = [(lewa, prawa), ('..............................................', '..............................................')]
    for ri, wiersz in enumerate(dane):
        for ci, tekst in enumerate(wiersz):
            c = t.cell(ri, ci)
            c.text = ''
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_after = Pt(2)
            pisz(p, tekst)
    # kolejność wierszy: linia podpisu nad opisem
    return t


def linia_podpisu(doc, opis, align='center', przed=18):
    p = akapit(doc, align, przed=przed, po=0)
    pisz(p, '..............................................................')
    p2 = akapit(doc, align, przed=0, po=6)
    pisz(p2, opis, size=10)


# ============================================================================
# BLOKI WSPÓLNE PISM KANCELARII (wzory 07-12)
# Tekst stały trzymany tu, nie w generatorach — żeby brzmienie nie rozjechało
# się między wzorami przy późniejszych edycjach.
# ============================================================================

SPOLKA_DOPELNIACZ = (
    'spółki {{spolka_firma}} prosta spółka akcyjna z siedzibą w {{spolka_siedziba_miejscownik}}, '
    'wpisanej do rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego przez '
    '{{spolka_sad_rejestrowy}} pod numerem KRS {{spolka_krs}}, NIP {{spolka_nip}}'
)

SPOLKA_MIANOWNIK = (
    '{{spolka_firma}} prosta spółka akcyjna z siedzibą w {{spolka_siedziba_miejscownik}}, '
    'wpisana do rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego przez '
    '{{spolka_sad_rejestrowy}} pod numerem KRS {{spolka_krs}}, NIP {{spolka_nip}}'
)

POUCZENIE_LEGITYMACJA = ('Wobec spółki za akcjonariusza uważa się tylko tę osobę, która jest wpisana '
                         'do rejestru akcjonariuszy (art. §§300^38 § 1 Kodeksu spółek handlowych).')
POUCZENIE_BADANIE = ('Podmiot prowadzący rejestr akcjonariuszy bada treść i formę dokumentów uzasadniających '
                     'dokonanie wpisu. Nie ma obowiązku badania zgodności tych dokumentów z prawem ani ich '
                     'prawdziwości, w tym prawdziwości podpisów, chyba że poweźmie w tym względzie uzasadnione '
                     'wątpliwości (art. §§300^34 § 5 Kodeksu spółek handlowych).')
POUCZENIE_CIEZAR = ('Obowiązek przedłożenia dokumentów uzasadniających dokonanie wpisu spoczywa na osobie '
                    'żądającej wpisu (art. §§300^34 § 4 Kodeksu spółek handlowych). Podmiot prowadzący rejestr '
                    'nie pozyskuje tych dokumentów samodzielnie.')
POUCZENIE_TERMIN = ('Wpis powinien być dokonany niezwłocznie, nie później niż w terminie siedmiu dni od dnia '
                    'otrzymania żądania, a jeżeli dokonanie wpisu wymaga usunięcia przeszkody — w terminie '
                    'siedmiu dni od dnia jej usunięcia (art. §§300^34 § 1 Kodeksu spółek handlowych).')
POUCZENIE_SPOR = ('Podmiot prowadzący rejestr akcjonariuszy nie rozstrzyga sporów o prawo do akcji. '
                  'W razie sporu podstawę wpisu może stanowić orzeczenie sądu.')


def naglowek_pisma(doc):
    """Nagłówek pisma kancelarii: dane nadawcy po lewej, miejscowość i data po prawej."""
    t = doc.add_table(rows=1, cols=2)
    t.autofit = True
    lewa = ['Kancelaria Notarialna Notariusza {{notariusz_dopelniacz}}',
            'ulica {{kancelaria_ulica}}, {{kancelaria_kod}} {{kancelaria_miasto}}',
            '{{kancelaria_email}}, tel. {{kancelaria_telefon}}',
            'podmiot prowadzący rejestr akcjonariuszy']
    c = t.cell(0, 0)
    c.text = ''
    for i, l in enumerate(lewa):
        p = c.paragraphs[0] if i == 0 else c.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        pisz(p, l, size=10, italic=(i == 3), bold=(i == 0))
    c = t.cell(0, 1)
    c.text = ''
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    pisz(p, '{{kancelaria_miasto}}, dnia {{pismo_data}} r.', size=10)
    doc.add_paragraph()
    p = akapit(doc, 'left', po=10)
    pisz(p, 'Znak sprawy: {{sprawa_numer}}', size=10)
    return t


def blok_adresata(doc, opis_roli):
    """Blok adresata wyrównany do prawej. opis_roli = tekst stały wzoru."""
    t = doc.add_table(rows=1, cols=2)
    t.autofit = True
    t.cell(0, 0).text = ''
    c = t.cell(0, 1)
    c.text = ''
    p = c.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    pisz(p, opis_roli, size=10, italic=True)
    for l in ('{{adresat_nazwa}}', '{{adresat_adres}}'):
        p = c.add_paragraph()
        p.paragraph_format.space_after = Pt(0)
        pisz(p, l)
    doc.add_paragraph()
    return t


def tytul_pisma(doc, tytul, podstawa):
    for linia in (tytul if isinstance(tytul, (list, tuple)) else [tytul]):
        p = akapit(doc, 'center', przed=6, po=2)
        pisz(p, linia, bold=True, size=13)
    p = akapit(doc, 'center', po=14)
    pisz(p, podstawa, italic=True, size=10)


def sekcja(doc, tytul):
    p = akapit(doc, 'left', przed=12, po=4)
    pisz(p, tytul, bold=True)


def podpis_podmiotu(doc):
    p = akapit(doc, 'center', przed=26, po=0)
    pisz(p, '.................................................')
    p = akapit(doc, 'center', po=0)
    pisz(p, '{{podpisujacy_funkcja}} {{podpisujacy_mianownik}}', size=11)
    p = akapit(doc, 'center', po=0)
    pisz(p, 'podmiot prowadzący rejestr akcjonariuszy', size=9, italic=True)


def tabela_pozycji(doc):
    """Stan rejestru po wpisie — sekcja powtarzalna {{#pozycje}}."""
    naglowki = ['Akcjonariusz', 'Seria', 'Numery akcji', 'Liczba', 'Obciążenia']
    t = doc.add_table(rows=2, cols=5)
    t.style = 'Table Grid'
    for i, h in enumerate(naglowki):
        c = t.cell(0, i)
        c.text = ''
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        pisz(p, h, bold=True, size=10)
    wiersz = ['{{#pozycje}}{{pozycja_akcjonariusz}}', '{{pozycja_seria}}', '{{pozycja_numery}}',
              '{{pozycja_liczba}}', '{{pozycja_obciazenia}}{{/pozycje}}']
    for i, w in enumerate(wiersz):
        c = t.cell(1, i)
        c.text = ''
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        pisz(p, w, size=10)
    return t
