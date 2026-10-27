import {readFileSync,writeFileSync} from 'node:fs';
import {analyze} from '../lib/model.ts';
const histories=JSON.parse(readFileSync('data/histories.json','utf8'));
const results={};const t=performance.now();
for(const [symbol,h] of Object.entries(histories)){results[symbol]=analyze(h.bars);console.log(symbol,results[symbol].map(x=>x.error||`${x.sessions}: ${x.returnPct.toFixed(1)}%, MAPE ${x.mae.toFixed(1)} / baseline ${x.baselineMae.toFixed(1)}`).join(' | '))}
writeFileSync('data/forecasts.json',JSON.stringify(results));console.log('Time',Math.round(performance.now()-t),'ms');

await import('./pack-histories.mjs');
