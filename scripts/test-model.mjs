import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {forecast,analyze} from '../lib/model.ts';
const all=JSON.parse(readFileSync('data/histories.json','utf8'));const b=all.ITC.bars;
for(const h of [10,50,210]){const f=forecast(b,h);assert.ok(Number.isFinite(f.price)&&f.price>0);assert.ok(f.low<=f.price&&f.high>=f.price);assert.ok(f.validationWindows>=5);assert.ok(f.mae>=0&&f.baselineMae>=0);assert.equal(f.lastDate,b.at(-1).date)}
assert.throws(()=>forecast(b.slice(0,100),210),/more completed/);
const flat=b.map(x=>({...x,close:100,raw:100,volume:100000}));const f=forecast(flat,50);assert.equal(f.price,100);assert.equal(f.mae,0);
const prefix=forecast(b.slice(0,-300),50);const perturbed=b.map((x,i)=>i>=b.length-300?{...x,close:x.close*5,raw:x.raw*5}:x);const prefix2=forecast(perturbed.slice(0,-300),50);assert.deepEqual(prefix,prefix2);
const snapshots=JSON.parse(readFileSync('data/forecasts.json','utf8'));assert.deepEqual(analyze(b),snapshots.ITC);
console.log('Passed: horizons, positive prices, ordered intervals, insufficient data, flat series, historical cutoff isolation, precomputed model parity.');
