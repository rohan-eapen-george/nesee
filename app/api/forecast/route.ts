export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
import {getForecast,snapshot} from '../../../lib/market';
export async function GET(request:Request){const url=new URL(request.url),symbol=url.searchParams.get('symbol')||'ITC';if(!snapshot.stocks.some(s=>s.symbol===symbol))return Response.json({error:'Select a supported NSE equity.'},{status:400});try{return Response.json(await getForecast(symbol,url.searchParams.get('refresh')==='1'))}catch(e){return Response.json({error:(e as Error).message},{status:503})}}
