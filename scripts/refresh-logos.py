"""Import matched NSE company logos from an ISIN-indexed public catalog.

No API credentials. SVGs are checked for active/external content before being
served locally. Missing, mismatched and invalid assets retain the UI fallback.
"""
import argparse,concurrent.futures,csv,datetime,hashlib,json,re,subprocess,tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
MASTER='https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv'
PROVIDER='https://company-logo.shareperks.in'
SVG_NS='http://www.w3.org/2000/svg'
ET.register_namespace('',SVG_NS)
ET.register_namespace('xlink','http://www.w3.org/1999/xlink')
def get(url,header_path,body_path):
    p=subprocess.run(['curl','--http1.1','--fail','--location','--silent','--show-error','--connect-timeout','5','--max-time','20','--retry','1','--retry-delay','1','--user-agent','nesee-company-logo-import/1.0','--dump-header',str(header_path),'--output',str(body_path),url],capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[:180])
def checked_svg(raw):
    if len(raw)>524288 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError('Unsafe or oversized SVG')
    root=ET.fromstring(raw)
    if root.tag!='{'+SVG_NS+'}svg':raise ValueError('Not an SVG image')
    forbidden={'script','foreignObject','iframe','object','embed','audio','video','a'}
    for el in root.iter():
        tag=el.tag.rsplit('}',1)[-1]
        if tag in forbidden or tag in {'animate','animateTransform','set'}:raise ValueError('Active SVG content')
        for name,value in el.attrib.items():
            key=name.rsplit('}',1)[-1].lower()
            if key.startswith('on'):raise ValueError('SVG event handler')
            if key=='href' and not(value.startswith('#') or re.match(r'^data:image/(png|jpeg|webp);base64,',value)):
                raise ValueError('External SVG image reference')
            if re.search(r'url\(\s*[\'"]?(?!#)',value,re.I) and 'url(' in value.lower():
                # Allow local fragment URLs only.
                for target in re.findall(r'url\(([^)]*)\)',value,re.I):
                    if not target.strip(' \'"').startswith('#'):raise ValueError('External SVG URL')
        if tag=='style' and el.text:
            if '@import' in el.text.lower() or '@font-face' in el.text.lower():raise ValueError('External SVG stylesheet')
            for target in re.findall(r'url\(([^)]*)\)',el.text,re.I):
                if not target.strip(' \'"').startswith('#'):raise ValueError('External SVG CSS URL')
    if 'viewBox' not in root.attrib:
        w=re.fullmatch(r'([0-9.]+)(px)?',root.get('width',''));h=re.fullmatch(r'([0-9.]+)(px)?',root.get('height',''))
        if w and h:root.set('viewBox',f'0 0 {w.group(1)} {h.group(1)}')
    return ET.tostring(root,encoding='utf-8',xml_declaration=False)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=8);parser.add_argument('--limit',type=int);parser.add_argument('--refresh',action='store_true');args=parser.parse_args()
    now=datetime.datetime.now(datetime.timezone.utc).isoformat();market=json.loads((ROOT/'data/market.json').read_text())
    logos_dir=ROOT/'public/stock-logos';logos_dir.mkdir(exist_ok=True)
    out=ROOT/'data/stock-logos.json';audit_path=ROOT/'data/stock-logos-audit.json'
    existing=json.loads(out.read_text()) if out.exists() else {};audit_existing=json.loads(audit_path.read_text()).get('matches',{}) if audit_path.exists() else {}
    with tempfile.TemporaryDirectory(prefix='nesee-logos-') as temporary:
        tmp=Path(temporary);master_path=tmp/'master.csv'
        try:get(MASTER,tmp/'master.headers',master_path)
        except Exception:
            previous=Path('/tmp/nse-equities.csv')
            if not previous.exists():raise
            master_path=previous
        master={r['SYMBOL'].strip():r for r in csv.DictReader(master_path.read_text(encoding='utf-8-sig').splitlines())}
        priority=list(json.loads((ROOT/'data/histories.json').read_text()))
        stocks=sorted(market['stocks'],key=lambda s:(0 if s['symbol'] in priority else 1,-s['turnover']))
        if args.limit:stocks=stocks[:args.limit]
        mappings={};matches={};issues={};completed=0
        def fetch_logo(stock):
            symbol=stock['symbol'];record=master.get(symbol)
            if not record:return symbol,None,'No matching NSE identity'
            isin=record[' ISIN NUMBER'].strip()
            if not re.fullmatch(r'[A-Z]{2}[A-Z0-9]{9}[0-9]',isin):return symbol,None,'Invalid official ISIN'
            rel=f'/stock-logos/{isin}.svg';destination=logos_dir/f'{isin}.svg'
            if not args.refresh and existing.get(symbol)==rel and destination.exists() and audit_existing.get(symbol,{}).get('isin')==isin:
                return symbol,dict(audit_existing[symbol],cached=True),None
            header=tmp/f'{isin}.headers';body=tmp/f'{isin}.svg';url=f'{PROVIDER}/logo/{isin}/icon.svg'
            try:
                get(url,header,body);headers={}
                for line in header.read_text().splitlines():
                    if ':' in line:
                        k,v=line.split(':',1);headers[k.lower().strip()]=v.strip()
                if 'x-logo-fallback' in headers:return symbol,None,'Catalog has no logo'
                ticker=headers.get('x-logo-ticker','')
                exchange,_,provider_symbol=ticker.partition(':')
                normal=lambda value:re.sub(r'[^A-Z0-9]','',value.upper())
                # The ISIN is the primary identity. The same company can use an
                # equivalent BSE ticker, or '-' / '_' variants across feeds.
                if exchange not in {'NSE','BSE'} or normal(provider_symbol)!=normal(symbol):
                    return symbol,None,'Catalog ticker does not match NSE symbol: '+ticker
                if 'image/svg+xml' not in headers.get('content-type',''):return symbol,None,'Unexpected content type'
                content=checked_svg(body.read_bytes());destination.write_bytes(content)
                return symbol,{'isin':isin,'company':record['NAME OF COMPANY'].strip(),'ticker':ticker,'path':rel,'sourceUrl':url,'sha256':hashlib.sha256(content).hexdigest(),'retrievedAt':now},None
            except Exception as e:return symbol,None,str(e)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers,12)) as pool:
            futures={pool.submit(fetch_logo,s):s for s in stocks}
            for future in concurrent.futures.as_completed(futures):
                symbol,info,error=future.result();completed+=1
                if info:mappings[symbol]=info['path'];matches[symbol]=info
                else:issues[symbol]=error
                if completed%100==0 or completed==len(stocks):print(f'{completed}/{len(stocks)} checked · {len(mappings)} matched · {len(issues)} fallbacks',flush=True)
        if args.limit:
            existing.update(mappings);mappings=existing;prior=dict(audit_existing);prior.update(matches);matches=prior
        temp_out=out.with_suffix('.tmp');temp_out.write_text(json.dumps(dict(sorted(mappings.items())),separators=(',',':')));temp_out.replace(out)
        report={'provider':PROVIDER,'identitySource':MASTER,'refreshedAt':now,'universeCount':len(market['stocks']),'attempted':len(stocks),'matched':len(mappings),'fallbacks':len(issues),'matches':dict(sorted(matches.items())),'unavailable':dict(sorted(issues.items()))}
        audit_path.write_text(json.dumps(report,indent=2))
        print('Saved verified identity matches:',len(mappings),'of',len(market['stocks']),flush=True)
if __name__=='__main__':main()
