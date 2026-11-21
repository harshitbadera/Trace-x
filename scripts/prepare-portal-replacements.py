"""Record the existing deck as editable slide content and assemble a static wireframe PNG."""
from pathlib import Path
import sys, json, html
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/pdf-deps'))
from PIL import Image

BUILD=ROOT/'tmp/portal-replacements'
BUILD.mkdir(parents=True,exist_ok=True)
source=(ROOT/'scripts/build-initial-round.py').read_text(encoding='utf-8')
source=source[:source.index('\nscreens=[')]
source=source.replace("OUT = ROOT / 'submission/initial-round'", "OUT = ROOT / 'tmp/portal-replacements'")
source=source.replace('self.page = 0','self.page = 0\n        self.record = []')
source=source.replace("self.page += 1", "self.page += 1\n        self.record.append({'dark': dark, 'elements': []})")
source=source.replace('p.drawOn(self.c, x, self.h-top-h)', "self.record[-1]['elements'].append({'type':'text','text':text,'x':x,'y':top,'w':width,'h':h+8,'size':size,'color':color,'bold':bold})\n        p.drawOn(self.c, x, self.h-top-h)")
source=source.replace('self.c.drawImage(ImageReader(image),', "image_path=OUT/f'asset-{self.page}-{len(self.record[-1][\"elements\"])}.png'\n        image.save(image_path)\n        self.record[-1]['elements'].append({'type':'image','path':str(image_path),'x':x+(width-w)/2,'y':top,'w':w,'h':h})\n        self.c.drawImage(ImageReader(image),")
namespace={'__file__':str(ROOT/'scripts/build-initial-round.py')}
exec(compile(source,'existing-action-plan','exec'),namespace)
slides=namespace['d'].record
for slide in slides:
 for element in slide['elements']:
  if element['type']=='text': element['text']=html.unescape(element['text'].replace('<br/>','\n')).replace('Eight-screen wireframe PDF','Eight-screen wireframe PNG')
(BUILD/'editable-slides.json').write_text(json.dumps(slides,ensure_ascii=False),encoding='utf-8')

images=[Image.open(ROOT/f'tmp/initial-round/rendered/Trace-X-Wireframes-{i:02}.png').convert('RGB') for i in range(1,9)]
gap=40
column_width=max(i.width for i in images)
row_heights=[max(images[i].height,images[i+1].height) for i in range(0,8,2)]
board=Image.new('RGB',(2*column_width+3*gap,sum(row_heights)+5*gap),'white')
y=gap
for row in range(4):
 for col in range(2): board.paste(images[2*row+col],(gap+col*(column_width+gap),y))
 y+=row_heights[row]+gap
out=ROOT/'submission/initial-round/Trace-X-Wireframes.png'
board.save(out,optimize=True)
with Image.open(out) as reopened:
 reopened.verify()
assert out.stat().st_size<25_000_000
board.thumbnail((1200,3600))
board.save(BUILD/'wireframes-preview.jpg',quality=90)
print(f'Editable slide specification: {len(slides)} slides')
print(f'Wireframe PNG: {out.stat().st_size} bytes')
