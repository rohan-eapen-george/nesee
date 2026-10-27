import {market,getForecast,historyStore} from '../../../lib/market';
import {allocateHorizons,validAmount,type AllocationCandidate} from '../../../lib/allocation';
export async function POST(request:Request){
  let body:any;try{body=await request.json()}catch{return Response.json({error:'Enter a valid investment amount.'},{status:400})}
  const {amount,chargesAllowance=0}=body||{};
  if(!validAmount(amount)||typeof chargesAllowance!=='number'||!Number.isFinite(chargesAllowance)||chargesAllowance<0||chargesAllowance>=amount||Math.abs(chargesAllowance*100-Math.round(chargesAllowance*100))>1e-7)return Response.json({error:'Enter ₹1–₹1,00,000 with at most two decimal places. Any charges allowance must be smaller than your budget.'},{status:400});
  try{
    const m=await market(),asOf=new Date(`${m.date} 00:00:00 GMT`).toISOString().slice(0,10);
    const covered=m.stocks.filter(s=>historyStore[s.symbol]&&s.price<=1000&&s.turnover>10000000);
    // A later closing file must never be combined with a stale return forecast.
    const observations=await Promise.all(covered.map(async s=>{try{const history=historyStore[s.symbol];const f=await getForecast(s.symbol,history.bars.at(-1)!.date<asOf);return {stock:s,forecast:f}}catch{return null}}));
    const groups=[10,50,210].map(sessions=>({sessions,candidates:observations.flatMap(o=>{
      if(!o||o.forecast.asOf!==asOf)return [];
      const h=o.forecast.horizons.find((f:any)=>f.sessions===sessions);
      if(!h||h.error||!Number.isFinite(h.returnPct))return [];
      const s=o.stock;
      return [{symbol:s.symbol,name:s.name,price:s.price,predictedPrice:s.price*(1+h.returnPct/100),low:s.price*h.low/h.lastPrice,high:s.price*h.high/h.lastPrice,beatsBaseline:h.beatsBaseline,mae:h.mae,baselineMae:h.baselineMae,asOf} as AllocationCandidate];
    })}));
    if(groups.some(g=>!g.candidates.length))return Response.json({error:'Matching closing prices and forecast histories are unavailable for one or more horizons. Please try again later.'},{status:503});
    const plans=allocateHorizons(groups,amount,chargesAllowance);
    return Response.json({amount,asOf,generatedAt:new Date().toISOString(),coverage:covered.length,plans,algorithm:'Exact integer knapsack in paise',objective:'Maximum model-estimated net gain, with whole shares and cash allowed',scope:'NSE shares priced at ₹1,000 or less, with bundled model history and more than ₹1 crore daily turnover. This is a covered-stock universe, not every listed stock.',scenarioNote:'Favourable and downside scenarios add each holding’s upper or lower model range. They are not joint portfolio confidence bounds or best/worst possible outcomes.',assumptions:'Each horizon is an independent alternative using the same total budget. No shorting, borrowing or fractional shares. Cash earns zero. Any entered charges allowance is deducted once when shares are allocated; other fees and taxes are excluded. Concentration is unrestricted to maximise the stated objective.'},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'We could not calculate an allocation. Please try again.'},{status:503})}
}
