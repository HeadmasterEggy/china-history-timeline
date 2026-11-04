// 数据自检：泳道重叠、引用的朝代 id、年份顺序、地图帧引用
// 用法：npm run check

import { readFileSync } from 'node:fs';
import { DYNASTIES } from '../data/dynasties.js';
import { DETAILS } from '../data/details.js';
import { PINS } from '../data/milestones.js';
import { ERAS } from '../data/eras.js';
import { UNITY } from '../data/unity.js';

const errors = [];
const ids = new Set(DYNASTIES.map((d) => d.id));
const eraIds = new Set(ERAS.map((e) => e.id));
const start = (d) => d.ds ?? d.s;

if (ids.size !== DYNASTIES.length) errors.push('朝代 id 有重复');

for (const d of DYNASTIES) {
  if (!eraIds.has(d.era)) errors.push(`${d.n}：未知时期 ${d.era}`);
  if (!(d.s < d.e)) errors.push(`${d.n}：起止年颠倒`);
  for (const [y, t] of d.ev) if (y < d.s - 5 || y > d.e + 5) errors.push(`${d.n}：事件年份超出范围 ${y} ${t}`);
}
for (const k of Object.keys(DETAILS)) if (!ids.has(k)) errors.push(`details.js：未知朝代 ${k}`);
for (const [k, more] of Object.entries(DETAILS))
  for (const [y, t] of more.ev ?? []) {
    const d = DYNASTIES.find((x) => x.id === k);
    if (d && (y < d.s - 5 || y > d.e + 5)) errors.push(`${d.n}：补充事件年份超出范围 ${y} ${t}`);
  }
for (const [, name, id] of PINS) if (!ids.has(id)) errors.push(`milestones.js：${name} 指向未知朝代 ${id}`);

for (const a of DYNASTIES)
  for (const b of DYNASTIES)
    if (a.id < b.id && a.lane === b.lane && start(a) < b.e && start(b) < a.e)
      errors.push(`泳道 ${a.lane} 重叠：${a.n} 与 ${b.n}`);

for (let i = 1; i < UNITY.length; i++)
  if (UNITY[i][0] < UNITY[i - 1][1]) errors.push(`unity.js：${UNITY[i][3]} 与前一段重叠`);

try {
  const map = JSON.parse(readFileSync(new URL('../data/map/borders.json', import.meta.url)));
  for (const f of map.frames) {
    if (!ids.has(f.focus)) errors.push(`地图 ${f.year}：focus 未知 ${f.focus}`);
    for (const s of f.shapes) if (s.id && !ids.has(s.id)) errors.push(`地图 ${f.year}：未知朝代 ${s.id}`);
  }
} catch (e) {
  errors.push(`无法读取地图数据：${e.message}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`数据检查通过：${DYNASTIES.length} 个政权，${DYNASTIES.reduce((n, d) => n + d.ev.length, 0)} 条基础大事。`);
