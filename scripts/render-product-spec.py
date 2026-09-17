"""Render the repository-owned product spec as a dependency-free HTML document."""
from pathlib import Path
import html
import re

root = Path(__file__).resolve().parents[1]
source = root / 'docs/product/ia-functional-spec-2026-09-17.md'
lines = source.read_text().splitlines()

def inline(text):
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

out, toc = [], []
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue
    if line.startswith('#'):
        level = len(line) - len(line.lstrip('#'))
        name = line[level:].strip()
        anchor = 'section-' + str(i)
        out.append(f'<h{level} id="{anchor}">{inline(name)}</h{level}>')
        if level == 2:
            toc.append(f'<a href="#{anchor}">{inline(name)}</a>')
        i += 1
    elif line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[-: ]+', c) for c in cells):
                rows.append(cells)
            i += 1
        out.append('<div class="table-wrap" tabindex="0" role="region" aria-label="가로로 스크롤 가능한 명세 표"><table><thead><tr>')
        out.extend('<th scope="col">' + inline(c) + '</th>' for c in rows[0])
        out.append('</tr></thead><tbody>')
        for cells in rows[1:]:
            out.append('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in cells) + '</tr>')
        out.append('</tbody></table></div>')
    elif line.startswith('- ') or re.match(r'^\d+\. ', line):
        numbered = not line.startswith('- ')
        tag = 'ol' if numbered else 'ul'
        out.append('<' + tag + '>')
        while i < len(lines):
            item = lines[i].strip()
            if numbered:
                match = re.match(r'^\d+\. (.*)', item)
                if not match: break
                item = match.group(1)
            else:
                if not item.startswith('- '): break
                item = item[2:]
            out.append('<li>' + inline(item) + '</li>')
            i += 1
        out.append('</' + tag + '>')
    else:
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||- |\d+\. )', lines[i].strip()):
            paragraph.append(lines[i].strip())
            i += 1
        out.append('<p>' + inline(' '.join(paragraph)) + '</p>')

style = '''
:root{color-scheme:light;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#22372b;background:#f5f7f3}
*{box-sizing:border-box}body{margin:0;font-size:16px;line-height:1.85}header{padding:30px max(24px,calc((100vw - 1100px)/2));background:#284b38;color:white}header strong{font-size:22px}header p{margin:8px 0 0;color:#e1ecdf;font-size:14px}
main{max-width:1100px;margin:32px auto;padding:40px;background:#fff;border:1px solid #dce4d8;border-radius:16px}h1{font-size:30px;line-height:1.5;letter-spacing:-.035em}h2{margin-top:56px;padding-top:24px;border-top:2px solid #dce4d8;font-size:24px;line-height:1.5}h3{margin-top:30px;font-size:19px;line-height:1.5;color:#315640}p{margin:12px 0}ul,ol{padding-left:25px}li{margin:7px 0}a{color:#175537;text-underline-offset:3px}a:focus-visible,.table-wrap:focus-visible{outline:3px solid #a36c24;outline-offset:3px}nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 24px;background:#f0f5ed;padding:24px;border-radius:12px}nav a{font-size:14px}.notice{border-left:4px solid #b78137;background:#fff7e9;padding:14px 18px;font-size:14px;margin:20px 0}.table-wrap{overflow-x:auto;margin:20px 0}table{width:100%;border-collapse:collapse;font-size:13px;min-width:650px}th,td{border:1px solid #dce4d8;padding:12px;vertical-align:top;text-align:left;overflow-wrap:anywhere}th{background:#edf3e9;color:#294633}tr:nth-child(even){background:#fafbf8}code{font-size:.88em;background:#f1f3ef;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}footer{font-size:13px;color:#5b695c;margin-top:32px}
@media(max-width:700px){main{padding:20px;margin:12px;border-radius:10px}header{padding:24px}h1{font-size:25px}h2{font-size:21px}nav{grid-template-columns:1fr}body{font-size:15px}}
@media print{@page{size:A4;margin:15mm}body{background:white;font-size:10pt}header{padding:0;background:white;color:#22372b}header p{color:#435548}main{max-width:none;margin:0;padding:0;border:0}nav{display:none}h1{font-size:21pt}h2{font-size:17pt;break-after:avoid}h3{font-size:12pt;break-after:avoid}table{min-width:0;font-size:8pt}.table-wrap{overflow:visible}th,td{padding:6px}tr,li{break-inside:avoid}a{color:inherit}.notice{font-size:9pt}}
'''
page = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>스픽코칭 — IA 및 기능명세서</title><style>' + style + '</style></head><body><header><strong>스픽코칭 · 제품 구조와 기능명세</strong><p>지금 대화 중에는 도움을 · 평소에는 같은 상황을 연습</p></header><main><div class="notice"><strong>검토 기준 2026-09-17.</strong> 소스 수정·자동 검증과 운영 배포를 구분합니다. 실제 모바일·마이크·AI 실전 응답과 지연는 확인이 남아 있습니다.</div><nav aria-label="문서 목차">' + ''.join(toc) + '</nav>' + ''.join(out) + '<footer>원본: ia-functional-spec-2026-09-17.md · 외부 폰트·스크립트 없이 열고 인쇄할 수 있습니다.</footer></main></body></html>'
target = source.with_suffix('.html')
target.write_text(page)
print(f'{target.name}: {len(lines)} source lines, {len(page.encode())} bytes')
