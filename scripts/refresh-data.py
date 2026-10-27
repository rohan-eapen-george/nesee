"""Fetch public source data; never synthesize missing market observations."""
import csv,json,os,time,subprocess,concurrent.futures,datetime
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEADERS={'User-Agent':'Mozilla/5.0','Accept':'application/json,text/csv,*/*'}
def fetch(url):
    return subprocess.check_output(['curl','--fail','-L','--max-time','25','-A','Mozilla/5.0','-sS',url])
def refresh():
    names={r['SYMBOL']:r['NAME OF COMPANY'] for r in csv.DictReader(fetch('https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv').decode().splitlines())}
    content=None
    for age in range(1,9):
        day=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=age)
        try:
            raw=fetch('https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_'+day.strftime('%d%m%Y')+'.csv').decode()
            if 'CLOSE_PRICE' in raw:content=raw;break
        except Exception:pass
    if not content:raise RuntimeError('No official NSE closing file available')
    sectors={'ITC':'Consumer staples','HINDUNILVR':'Consumer staples','DABUR':'Consumer staples','MARICO':'Consumer staples','TATACONSUM':'Consumer staples','SBIN':'Banking','PNB':'Banking','BANKBARODA':'Banking','CANBK':'Banking','UNIONBANK':'Banking','IDFCFIRSTB':'Banking','FEDERALBNK':'Banking','HDFCBANK':'Banking','ICICIBANK':'Banking','AXISBANK':'Banking','NTPC':'Energy','POWERGRID':'Energy','ONGC':'Energy','IOC':'Energy','BPCL':'Energy','GAIL':'Energy','NHPC':'Energy','SJVN':'Energy','TATAPOWER':'Energy','JSWENERGY':'Energy','RECLTD':'Financial services','PFC':'Financial services','IRFC':'Financial services','LICHSGFIN':'Financial services','JIOFIN':'Financial services','BAJFINANCE':'Financial services','TATASTEEL':'Metals','SAIL':'Metals','HINDALCO':'Metals','VEDL':'Metals','NMDC':'Metals','WIPRO':'Technology','HCLTECH':'Technology','INFY':'Technology','TECHM':'Technology','TCS':'Technology','IRCTC':'Travel & transport','IRCON':'Infrastructure','RVNL':'Infrastructure','BEL':'Industrials','BHEL':'Industrials','SUZLON':'Industrials','ASHOKLEY':'Automobiles','TATAMOTORS':'Automobiles','MOTHERSON':'Automobiles','IDEA':'Telecom','BHARTIARTL':'Telecom'}
    rows=[]
    for raw in csv.DictReader(content.splitlines()):
        r={k.strip():v.strip() for k,v in raw.items() if k}
        if r.get('SERIES')!='EQ' or r['SYMBOL'] not in names:continue
        try:
            p=float(r['CLOSE_PRICE']);prev=float(r['PREV_CLOSE']);volume=int(r['TTL_TRD_QNTY'])
            if p<=0:continue
            rows.append({'symbol':r['SYMBOL'],'name':names[r['SYMBOL']],'sector':sectors.get(r['SYMBOL'],'Other sectors'),'price':p,'change':round((p/prev-1)*100,2) if prev else 0,'volume':volume,'turnover':float(r['TURNOVER_LACS'])*100000,'date':r['DATE1']})
        except (ValueError,KeyError):continue
    result={'source':'NSE official EQ bhavcopy','sourceUrl':'https://www.nseindia.com/all-reports','fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'date':rows[0]['date'],'scope':'NSE EQ-series common equities; excludes BSE-only, ETFs, SME and other series','stocks':rows}
    with open(ROOT+'/data/market.json','w') as f:json.dump(result,f,separators=(',',':'))
    selected=['ITC','SBIN','NTPC','POWERGRID','TATASTEEL','ONGC','IOC','GAIL','WIPRO','BANKBARODA','CANBK','PNB','BEL','RECLTD','PFC','TATAPOWER','IRFC','DABUR','FEDERALBNK','HINDALCO','NMDC','MARICO','JIOFIN','IDFCFIRSTB']
    histories={}
    def history(s):
        for host in ['query1','query2']:
            try:
                j=json.loads(fetch('https://'+host+'.finance.yahoo.com/v8/finance/chart/'+s+'.NS?range=10y&interval=1d'))['chart']['result'][0]
                q=j['indicators']['quote'][0];adj=j['indicators'].get('adjclose',[{}])[0].get('adjclose',q['close'])
                # Exclude the current Indian calendar day: incomplete bars must not become training labels.
                today=(datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=5,minutes=30)).date().isoformat()
                bars=[{'date':datetime.datetime.fromtimestamp(t,datetime.timezone.utc).date().isoformat(),'close':round(float(a),5),'raw':round(float(c),3),'volume':v or 0} for t,a,c,v in zip(j['timestamp'],adj,q['close'],q['volume']) if a and c and a>0 and c>0 and datetime.datetime.fromtimestamp(t,datetime.timezone.utc).date().isoformat()<today]
                return s,{'source':'Yahoo Finance adjusted daily close','fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bars':bars}
            except Exception:pass
        return s,None
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for s,h in pool.map(history,selected):
            if h:histories[s]=h
            print(s,len(h['bars']) if h else 'unavailable',flush=True)
    with open(ROOT+'/data/histories.json','w') as f:json.dump(histories,f,separators=(',',':'))
    print('Saved',len(rows),'stocks and',len(histories),'real historical series')
if __name__=='__main__':refresh()
