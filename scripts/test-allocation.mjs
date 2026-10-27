import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocate,allocateHorizons,validAmount} from '../lib/allocation.ts';
function candidate(symbol,price,gain){return {symbol,name:symbol,price,predictedPrice:price+gain,low:Math.min(price,price+gain)*.8,high:Math.max(price,price+gain)*1.2,beatsBaseline:true,mae:1,baselineMae:2,asOf:'2026-10-26'}}
// Greedy ROI would choose A (cost 6, gain 9), but two B shares are optimal (10, 14).
const nongreedy=allocate([candidate('A',6,9),candidate('B',5,7)],10,10);
assert.equal(nongreedy.estimatedGain,14);assert.equal(nongreedy.holdings[0].symbol,'B');assert.equal(nongreedy.holdings[0].shares,2);
assert.equal(allocate([candidate('A',6,-1)],10,10).holdings.length,0);
assert.equal(allocate([candidate('A',6,0)],10,10).cash,10);
assert.equal(allocate([candidate('A',6,1)],5,10).cash,5);
assert.equal(allocate([candidate('A',6,.5)],10,10,1).holdings.length,0);
assert.equal(allocate([candidate('A',6,2)],10,10,1).estimatedValue,11);
assert.equal(allocate([candidate('A',3.33,1)],10,10).spent,9.99);
assert.throws(()=>allocate([],0,10));assert.throws(()=>allocate([],100001,10));assert.throws(()=>allocate([],NaN,10));assert.throws(()=>allocate([],10,10,10));assert.equal(validAmount(1.001),false);assert.equal(validAmount(Infinity),false);
// Compare integer-knapsack values against exhaustive enumeration for different
// prices, capacities, gcd scaling, ties, reserves and negative predictions.
for(let seed=1;seed<=50;seed++){
 const cs=[candidate('A',((seed*17)%70+1)/100,((seed*13)%15-3)/100),candidate('B',((seed*31)%80+1)/100,((seed*7)%17-2)/100),candidate('C',((seed*23)%90+1)/100,((seed*11)%14-2)/100)];
 const budget=1+(seed%7)/10,reserve=seed%3/100,cap=Math.round((budget-reserve)*100);let best=0;
 for(let a=0;a*Math.round(cs[0].price*100)<=cap;a++)for(let b=0;a*Math.round(cs[0].price*100)+b*Math.round(cs[1].price*100)<=cap;b++){
  const remain=cap-a*Math.round(cs[0].price*100)-b*Math.round(cs[1].price*100),c=cs[2].predictedPrice>cs[2].price?Math.floor(remain/Math.round(cs[2].price*100)):0;
  best=Math.max(best,a*(cs[0].predictedPrice-cs[0].price)+b*(cs[1].predictedPrice-cs[1].price)+c*(cs[2].predictedPrice-cs[2].price)-reserve);
 }
 const plan=allocate(cs,budget,10,reserve);assert.ok(Math.abs(plan.estimatedGain-best)<1e-8,`optimality seed ${seed}`);assert.ok(Math.round((plan.spent+plan.cash+plan.chargesAllowance)*100)===Math.round(budget*100));assert.ok(plan.holdings.every(s=>Number.isInteger(s.shares)&&s.shares>0));
}
const market=JSON.parse(readFileSync('data/market.json','utf8')),f=JSON.parse(readFileSync('data/forecasts.json','utf8'));
const groups=[10,50,210].map(sessions=>({sessions,candidates:market.stocks.flatMap(s=>{const h=f[s.symbol]?.find(h=>h.sessions===sessions);return h&&!h.error?[{...candidate(s.symbol,s.price,s.price*h.returnPct/100),low:s.price*h.low/h.lastPrice,high:s.price*h.high/h.lastPrice,beatsBaseline:h.beatsBaseline}]:[]})}));
const plans=allocateHorizons(groups,1000);
for(const p of plans){assert.equal(Math.round((p.spent+p.cash+p.chargesAllowance)*100),100000);assert.ok(p.downsideValue<=p.estimatedValue&&p.estimatedValue<=p.favourableValue);assert.ok(p.holdings.every(s=>s.shares>0&&Number.isInteger(s.shares)));console.log(`${p.sessions} sessions: ${p.holdings.map(s=>`${s.shares} ${s.symbol}`).join(', ')}; spent ₹${p.spent.toFixed(2)}; cash ₹${p.cash.toFixed(2)}; estimated ₹${p.estimatedValue.toFixed(2)}`)}
const t=performance.now();allocateHorizons(groups,100000);console.log('₹1 lakh benchmark:',Math.round(performance.now()-t),'ms');
console.log('Passed: exact optimality vs exhaustive search, non-greedy case, paise accuracy, cash option, costs, validation, real-data horizons, budget conservation.');
