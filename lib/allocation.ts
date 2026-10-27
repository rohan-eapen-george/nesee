/** Exact whole-share, long-only allocation: maximise predicted gain under a cash budget.
 * Prices/cash use integer paise. Rolling value storage keeps memory bounded by share
 * price; the backtrack buffer is reused across horizons. No fractions or leverage.
 */
export type AllocationCandidate = {
  symbol:string; name:string; price:number; predictedPrice:number; low:number; high:number;
  beatsBaseline:boolean; mae:number; baselineMae:number; asOf:string;
};
export type Holding = AllocationCandidate & {shares:number;cost:number;projectedValue:number};
export type Allocation = {
  sessions:number; budget:number; spent:number; cash:number; chargesAllowance:number;
  estimatedValue:number; estimatedGain:number; estimatedReturnPct:number;
  favourableValue:number; downsideValue:number; holdings:Holding[];
  eligibleStocks:number; profitableStocks:number; weakModelHoldings:number;
  largestPositionPct:number; optimal:boolean;
};
export const MAX_INVESTMENT = 100000;
const paise=(amount:number)=>Math.round(amount*100);
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
export function validAmount(value:unknown):value is number {
  return typeof value==='number'&&Number.isFinite(value)&&value>=1&&value<=MAX_INVESTMENT&&Math.abs(value*100-Math.round(value*100))<1e-7;
}
/** Max-gain unbounded integer knapsack, with cash permitted. */
export function allocate(candidates:AllocationCandidate[],budget:number,sessions:number,allowance=0,backtrack?:Int16Array):Allocation {
  if(!validAmount(budget))throw Error('Enter an amount from ₹1 to ₹1,00,000, with at most two decimal places.');
  if(!Number.isFinite(allowance)||allowance<0||allowance>=budget||Math.abs(allowance*100-paise(allowance))>1e-7)throw Error('The charges allowance must be less than your investment amount.');
  const capital=paise(budget),reserve=paise(allowance),available=capital-reserve;
  const eligible=candidates.filter(s=>Number.isFinite(s.price)&&paise(s.price)>=1&&Math.abs(s.price*100-paise(s.price))<1e-7&&s.price<=1000&&paise(s.price)<=available&&[s.predictedPrice,s.low,s.high].every(v=>Number.isFinite(v)&&v>0)&&s.low<=s.predictedPrice&&s.high>=s.predictedPrice);
  const positive=eligible.filter(s=>s.predictedPrice>s.price).sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const none:Allocation={sessions,budget,spent:0,cash:budget,chargesAllowance:0,estimatedValue:budget,estimatedGain:0,estimatedReturnPct:0,favourableValue:budget,downsideValue:budget,holdings:[],eligibleStocks:eligible.length,profitableStocks:positive.length,weakModelHoldings:0,largestPositionPct:0,optimal:true};
  if(!positive.length)return none;
  const costs=positive.map(s=>paise(s.price)),unit=costs.reduce(gcd),scaled=costs.map(c=>c/unit),capacity=Math.floor(available/unit);
  const choices=backtrack&&backtrack.length>capacity?backtrack:new Int16Array(capacity+1);
  const width=Math.max(...scaled)+1,values=new Float64Array(width);
  const gains=positive.map(s=>s.predictedPrice-paise(s.price)/100);
  for(let b=1;b<=capacity;b++){
    let best=values[(b-1)%width],choice=-1;
    for(let j=0;j<positive.length;j++){
      const c=scaled[j];if(c>b)continue;
      const value=values[(b-c)%width]+gains[j];
      if(value>best+1e-10){best=value;choice=j;}
    }
    values[b%width]=best;choices[b]=choice;
  }
  const profit=values[capacity%width];
  // Cash beats a trade whose projected gain does not cover the allowance.
  if(profit<=reserve/100+1e-10)return none;
  const quantities=new Array(positive.length).fill(0);
  for(let b=capacity;b>0;){const j=choices[b];if(j<0){b--;continue;}quantities[j]++;b-=scaled[j];}
  const holdings:Holding[]=positive.flatMap((s,i)=>quantities[i]?[{...s,shares:quantities[i],cost:costs[i]*quantities[i]/100,projectedValue:s.predictedPrice*quantities[i]}]:[]).sort((a,b)=>b.cost-a.cost);
  const spentP=holdings.reduce((v,s)=>v+paise(s.cost),0),cash=(capital-spentP-reserve)/100;
  const estimatedValue=cash+holdings.reduce((v,s)=>v+s.projectedValue,0),estimatedGain=estimatedValue-budget;
  return {sessions,budget,spent:spentP/100,cash,chargesAllowance:reserve/100,estimatedValue,estimatedGain,estimatedReturnPct:estimatedGain/budget*100,favourableValue:cash+holdings.reduce((v,s)=>v+s.high*s.shares,0),downsideValue:cash+holdings.reduce((v,s)=>v+s.low*s.shares,0),holdings,eligibleStocks:eligible.length,profitableStocks:positive.length,weakModelHoldings:holdings.filter(s=>!s.beatsBaseline).length,largestPositionPct:Math.max(...holdings.map(s=>s.cost))/budget*100,optimal:true};
}
export function allocateHorizons(groups:{sessions:number;candidates:AllocationCandidate[]}[],budget:number,allowance=0){
  if(!validAmount(budget))throw Error('Enter an amount from ₹1 to ₹1,00,000, with at most two decimal places.');
  const choices=new Int16Array(paise(budget)+1);
  return groups.map(g=>allocate(g.candidates,budget,g.sessions,allowance,choices));
}
