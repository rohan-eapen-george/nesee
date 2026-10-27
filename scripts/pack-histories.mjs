import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../data/histories.json',import.meta.url));
const compressed=gzipSync(source,{level:9});
assert.deepEqual(gunzipSync(compressed),source);
writeFileSync(new URL('../data/histories-packed.json',import.meta.url),JSON.stringify(compressed.toString('base64')));
console.log(`Historical data packed losslessly: ${source.length} → ${compressed.length} bytes.`);
