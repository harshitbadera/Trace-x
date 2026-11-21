"""Build the two upload-ready PDFs from real, synthetic-only application captures."""
from pathlib import Path
import sys, shutil, json, hashlib
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tmp/pdf-deps'))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
from PIL import Image

OUT = ROOT / 'submission/initial-round'
OUT.mkdir(parents=True, exist_ok=True)
SCREENS = ROOT / 'tmp/initial-round/screens'
pdfmetrics.registerFont(TTFont('Arial', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial', normal='Arial', bold='ArialBold', italic='Arial', boldItalic='ArialBold')
NAVY, TEAL, INK, GRAY, PAPER = '#102136', '#008C87', '#1C3049', '#52647A', '#F5F7FA'

class Document:
    def __init__(self, filename, size, title):
        self.path = OUT / filename
        self.w, self.h = size
        self.c = canvas.Canvas(str(self.path), pagesize=size, pageCompression=1)
        self.c.setTitle(title)
        self.c.setAuthor('Trace-X')
        self.c.setSubject('PS05 initial-round action plan, synthetic demonstration')
        self.page = 0
    def text(self, text, x, top, width, size=23, color=INK, bold=False, height=None):
        style = ParagraphStyle('body', fontName='ArialBold' if bold else 'Arial', fontSize=size, leading=size*1.28, textColor=HexColor(color), spaceAfter=0)
        p = Paragraph(text, style)
        _, h = p.wrap(width, 2000)
        if height is not None and h > height + 1:
            raise ValueError(f'Text exceeds allotted height on page {self.page}: {text[:60]} ({h} > {height})')
        if top+h > self.h-16:
            raise ValueError(f'Text exceeds page {self.page}: {text[:60]}')
        p.drawOn(self.c, x, self.h-top-h)
        return h
    def image(self, name, x, top, width, height, crop=None):
        image = Image.open(SCREENS / f'{name}.png')
        if crop: image = image.crop(crop)
        ratio = min(width/image.width, height/image.height)
        w,h = image.width*ratio,image.height*ratio
        self.c.drawImage(ImageReader(image), x+(width-w)/2, self.h-top-h, width=w, height=h, mask='auto')
    def new(self, title=None, dark=False, size=None):
        if self.page: self.c.showPage()
        if size:
            self.w,self.h=size
            self.c.setPageSize(size)
        self.page += 1
        self.c.setFillColor(HexColor(NAVY if dark else '#FFFFFF'))
        self.c.rect(0,0,self.w,self.h,fill=1,stroke=0)
        self.text('TRACE-X / PS05',48,24,400,13,'#9DDCD6' if dark else TEAL,True)
        if title: self.text(title,48,73,self.w-96,40,'#FFFFFF' if dark else INK,True,height=110)
        self.text(f'Initial round / 21 November 2026',48,self.h-33,650,11,'#B4C4D8' if dark else GRAY)
        self.text(f'{self.page:02}',self.w-78,self.h-33,35,11,'#B4C4D8' if dark else GRAY)
    def save(self): self.c.save()

d=Document('Trace-X-Action-Plan.pdf',(1280,720),'Trace-X - PS05 Action Plan')
d.new(dark=True)
d.text('Trace-X',70,145,1100,88,'#FFFFFF',True)
d.text('Financial crime infrastructure<br/>and money-trail analysis',75,265,1070,38,'#FFFFFF',height=110)
d.text('A case workspace with a source behind every finding',75,410,1080,26,'#9DDCD6')
d.text('Working local application and interactive submission preview',75,517,1080,21,'#C3D0E1')
d.text('github.com/harshitbadera/Trace-x',75,566,1000,18,'#C3D0E1')
d.c.linkURL('https://github.com/harshitbadera/Trace-x',(75,120,650,155),relative=0)

d.new('The investigation problem')
d.text('Financial records',48,182,540,28,TEAL,True)
d.text('Statements arrive in different formats. Transfers split, converge and pass through several accounts within minutes.',48,235,525,25,height=150)
d.text('Investigators need a chronological trail with the supporting statement rows.',48,411,525,25,height=130)
d.text('Digital infrastructure',688,182,540,28,TEAL,True)
d.text('Domains, IP addresses and hosting observations arrive separately. Shared or dynamic infrastructure complicates attribution.',688,235,525,25,height=150)
d.text('Investigators need sourced connections, event times and explicit evidence gaps.',688,411,525,25,height=130)
d.text('Trace-X brings these records into one reviewable case workspace.',48,604,1150,25,INK,True)

d.new('The investigator workflow')
steps=[('01','Import and review','PDF, XLSX or CSV statements, a victim UTR and submitted indicators.'),('02','Normalize and preserve','Original files, source rows, SHA-256 fingerprints and original timestamps.'),('03','Trace and explain','Chronological candidate paths and deterministic account risk indicators.'),('04','Connect case evidence','Passive domain/IP observations and exact identifier matches across cases.'),('05','Prepare the next action','Evidence-backed reports, missing-record leads and editable request drafts.')]
for i,(num,title,body) in enumerate(steps):
    y=170+i*96
    d.text(num,48,y,65,30,TEAL,True)
    d.text(title,143,y,1040,25,INK,True)
    d.text(body,143,y+37,1040,21,GRAY,height=54)

d.new('A synthetic split-and-converge money trail')
d.text('INR 2,40,000 starting payment / six observed transfers in 17 minutes',48,139,1160,23,TEAL,True)
d.image('trail-detail',48,190,1184,410)
d.text('Select any transfer to inspect its source rows and original time. The last account lacks a statement.',48,612,1184,20,INK,height=54)

d.new('Statement normalization with analyst review')
d.text('Supported now',48,170,385,26,TEAL,True)
d.text('Selectable-text PDF tables, XLSX and CSV.<br/><br/>Map columns, correct invalid values and exclude non-transaction rows before import.<br/><br/>Keep original values beside reviewed corrections.',48,223,370,23,height=340)
d.image('02-statement-review',465,169,767,440,crop=(240,255,1425,1110))
d.text('One schema: timestamp, debit/credit, amount, balance, account, counterparty, UTR and narration.',48,622,1160,20,GRAY,height=52)

d.new('Explainable account review')
d.text('Five deterministic indicators',48,170,580,27,TEAL,True)
d.text('Rapid incoming-to-outgoing movement<br/><br/>Many senders within 24 hours<br/><br/>Repeated round-figure transfers<br/><br/>Repeated counterparties<br/><br/>Activity after an observed record gap',48,225,580,23,height=355)
d.image('account-detail',680,166,550,435)
d.text('Each finding links to supporting transfers. Scores prioritize review and do not establish guilt.',48,622,1160,20,GRAY,height=52)

d.new('Financial and digital connections')
d.text('Public observations',48,167,450,27,TEAL,True)
d.text('RDAP registration data<br/>DNS records and certificate names<br/>IP network, ASN and reverse DNS<br/><br/>Every observation carries a source, retrieval time and availability state.',48,219,435,23,height=285)
d.text('Submitted evidence links a domain or payment identifier to an account. Shared infrastructure alone cannot establish common control.',48,515,435,21,GRAY,height=123)
d.image('infra-detail',515,165,717,450)

d.new('Evidence remains attached to the finding')
d.text('Reviewable provenance',48,170,560,28,TEAL,True)
d.text('Original file fingerprint and source row<br/><br/>Original timestamp, timezone and UTC<br/><br/>All source observations after transfer matching<br/><br/>Visible uncertainty for date-only records, missing statements and mixed funds',48,228,540,23,height=335)
d.image('transfer-detail',665,160,565,437)
d.text('The local activity log records workspace actions. Shared deployment requires stronger audit controls.',48,622,1160,20,GRAY,height=52)

d.new('Local application architecture')
d.text('Investigation interface',48,169,540,27,TEAL,True)
d.text('React and TypeScript<br/>React Flow graphs and timeline controls<br/>Import review, case search and evidence inspectors',48,219,530,23,height=150)
d.text('Processing and storage',48,410,540,27,TEAL,True)
d.text('Express API and local SQLite<br/>PDF.js and ExcelJS extraction<br/>Integer-paise amounts and explicit analysis rules',48,459,530,23,height=150)
d.text('Public intelligence adapters',688,169,540,27,TEAL,True)
d.text('RDAP, Google DNS, crt.sh and RIPE<br/>Passive requests with caching and timeouts<br/>Unavailable results remain visible',688,219,530,23,height=150)
d.text('Outputs and data boundary',688,410,540,27,TEAL,True)
d.text('PDF and Excel reports, request drafts<br/>Bank files stay in the local workspace<br/>Only queried indicators reach public providers',688,459,530,23,height=150)

d.new('Implemented scope and validation')
d.text('Working now',48,170,540,27,TEAL,True)
d.text('Statement parsing and reviewed imports<br/><br/>Victim-UTR trail and account explanations<br/><br/>Domain/IP observations and cross-case matches<br/><br/>Persistent cases, evidence and report exports',48,227,540,23,height=340)
d.text('Verification evidence',688,170,540,27,TEAL,True)
d.text('24 analysis, parser and API tests passed.<br/><br/>Four browser workflows passed in the project baseline.<br/><br/>The packaged HTML passes an offline investigation workflow with no external requests.',688,227,530,23,height=330)
d.text('Synthetic fixtures: 17 normalized transfers across 14 account identifiers in the main case. No population-level accuracy claim.',48,620,1180,19,GRAY,height=54)

d.new('Execution plan for the 24-hour final')
schedule=[('00-03 h','Inspect R4C data','Check statement formats, timezones, planted identifiers and expected outputs.'),('03-08 h','Adapt ingestion','Map actual columns, preserve source references and review rejected rows.'),('08-14 h','Validate the investigation','Compare the planted chain, supporting rules and submitted infrastructure links.'),('14-19 h','Complete outputs','Verify reports and request drafts against source records. Surface missing coverage.'),('19-24 h','Rehearse and package','Run regressions, check the offline demo and prepare the final demonstration.')]
for i,(hours,title,body) in enumerate(schedule):
    y=163+i*92
    d.text(hours,48,y,150,25,TEAL,True)
    d.text(title,225,y,990,24,INK,True)
    d.text(body,225,y+35,990,20,GRAY,height=52)
d.text('Planning assumption: organizers permit reuse of the existing prototype. Confirm eligibility before the final.',48,640,1180,17,GRAY,height=30)

d.new('Demo scope and next milestones')
d.text('Initial-round package',48,170,540,27,TEAL,True)
d.text('This action plan<br/>Eight-screen wireframe PDF<br/>Self-contained interactive HTML<br/><br/>The HTML demonstrates synthetic case exploration, evidence inspection and request drafting. Live lookups, uploads and generated exports run in the full local application.',48,222,540,23,height=360)
d.text('Remaining validation',688,170,540,27,TEAL,True)
d.text('Adapt to R4C statement formats.<br/><br/>Add balance and statement-period reconciliation.<br/><br/>Add OCR and historical providers if required and available.<br/><br/>Add authentication before shared deployment.',688,222,530,23,height=360)
d.text('Subscriber and login records require lawful process. The system performs no active scanning or bank actions.',48,622,1170,20,GRAY,height=52)
d.save()

screens=[
('01-overview','01 / Case overview','Review the reported payment, flagged accounts and available evidence before following the trail.','Select an account or transfer to open its evidence. Missing endpoint records stay visible.'),
('02-statement-review','02 / Statement review','Upload a supported statement, confirm column mapping and review the extracted rows.','Correct or exclude invalid rows explicitly. Source values remain available after import.'),
('03-money-trail','03 / Money trail','Begin with the victim UTR and explore chronological candidate transfers across accounts.','Adjust hops, amount and time controls. Select a node or edge to inspect supporting records.'),
('04-account-analysis','04 / Account explanations','Inspect an account score, the individual rules and the transactions supporting each finding.','Risk indicators prioritize investigation. An observed record gap does not prove dormancy.'),
('05-infrastructure','05 / Domain and IP observations','Inspect registration, DNS, certificate and network observations with source timestamps.','This screen shows labelled synthetic fixtures. Live queries use passive public-source adapters.'),
('06-relationships','06 / Infrastructure relationships','Explore submitted links between a domain, infrastructure and financial identifiers.','Shared infrastructure supports a lead. It cannot establish the identity of an operator.'),
('07-cross-case','07 / Cross-case links','Find exact account or payment-identifier matches across cases and inspect both sources.','A shared identifier establishes a record match. Investigators decide what it means.'),
('08-reports','08 / Reports and information requests','Export the investigation report or prepare an editable request for further records.','Review the legal authority, identifier and event timestamp before using an approved channel.')
]
w=Document('Trace-X-Wireframes.pdf',(1440,1120),'Trace-X - PS05 Interface Wireframes')
for name,title,description,interaction in screens:
    im=Image.open(SCREENS/f'{name}.png')
    image_height=1344*im.height/im.width
    page_height=185+image_height+110
    w.new(size=(1440,page_height))
    w.text(title,48,68,1344,35,INK,True,height=50)
    w.text(description,48,119,1344,20,GRAY,height=52)
    w.image(name,48,185,1344,image_height)
    w.text(interaction,48,185+image_height+18,1344,18,INK,height=48)
w.save()
shutil.copyfile(ROOT/'submission/Trace-X-prototype.html',OUT/'Trace-X-Prototype.html')

expected={'Trace-X-Action-Plan.pdf':12,'Trace-X-Wireframes.pdf':8}
manifest=[]
for file in sorted(OUT.iterdir()):
    if file.suffix not in ('.pdf','.html'): continue
    size=file.stat().st_size
    if size>25_000_000: raise ValueError(f'{file.name} exceeds portal limit')
    pages=None
    if file.suffix=='.pdf':
        reader=PdfReader(file)
        pages=len(reader.pages)
        assert pages==expected[file.name], (file.name,pages)
        assert all(len(p.extract_text())>60 for p in reader.pages)
    manifest.append({'file':file.name,'bytes':size,'pages':pages,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
(ROOT/'tmp/initial-round/file-verification.json').write_text(json.dumps(manifest,indent=2))
(OUT/'UPLOAD-GUIDE.txt').write_text('''TRACE-X / INITIAL ROUND UPLOAD GUIDE

Portal slot                    File to choose
Action plan presentation       Trace-X-Action-Plan.pdf
Wireframe                      Trace-X-Wireframes.pdf
HTML prototype                 Trace-X-Prototype.html

The action-plan PDF is an accepted alternative to PPT/PPTX in the supplied portal instructions.
All three upload files are below 25 MB. The HTML is self-contained and needs no ZIP.
The wireframe PDF contains eight screens captured from the working local application using synthetic data.

Before uploading:
1. Confirm the portal shows PS05: Financial Crime Infrastructure & Money-Trail Analysis System.
2. Open the PDFs and HTML once on your computer. Check that the project details are correct.
3. Upload each file to its matching slot. Uploading locks your problem statement.
4. Check the selected filenames, then press Submit before the deadline.
5. Save the portal confirmation or acknowledgement. Uploading alone is not submission.

Deadline shown in the supplied portal: 24 November 2026, 11:59 pm IST.
At least one artifact is required. These three files cover all available slots.

The HTML uses synthetic fixtures. Full ingestion, public lookups and generated PDF/Excel exports run in the local application.
Repository: https://github.com/harshitbadera/Trace-x
Full application: npm ci, then npm run dev. Open http://127.0.0.1:5173.

This package has not been uploaded or submitted to the portal by the assistant.
Confirm prebuilt-code eligibility with organizers before the 24-hour final.
''',encoding='utf-8')
print(json.dumps(manifest,indent=2))
