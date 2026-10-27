export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
import {market,getForecast,historyStore} from '../../../lib/market';
export async function GET(request:Request){const url=new URL(request.url);const m=await market();if(url.searchParams.get('shortlist')==='1'){const candidates=m.stocks.filter(s=>s.price<=1000&&s.turnover>10000000&&historyStore[s.symbol]);const ranked=await Promise.all(candidates.map(async s=>{const f=await getForecast(s.symbol);const h=f.horizons.find((h:any)=>h.sessions===50);return {...s,forecast:h}}));ranked.sort((a,b)=>((b.forecast as any)?.score??-999)-((a.forecast as any)?.score??-999));return Response.json({stocks:ranked,coverage:candidates.length,asOf:m.date})}return Response.json({...m,stocks:m.stocks.map(s=>({...s,hasHistory:!!historyStore[s.symbol]}))},{headers:{'Cache-Control':'private, max-age=300'}})}
