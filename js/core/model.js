// 历史数据模型：合并基础数据与补充资料，提供查询方法

import { ERAS, NOW } from '../../data/eras.js';
import { DYNASTIES } from '../../data/dynasties.js';
import { DETAILS } from '../../data/details.js';
import { PINS } from '../../data/milestones.js';
import { UNITY, UNITY_TYPES } from '../../data/unity.js';
import { IDIOMS } from '../../data/idioms.js';
import { PEOPLE, ALIASES } from '../../data/people.js';
import { drawStart } from './format.js';

function mergeDetails(list) {
  return list.map((base) => {
    const d = { ...base, ev: [...base.ev], p: [...base.p] };
    const more = DETAILS[d.id];
    if (more) {
      if (more.ev) d.ev.push(...more.ev);
      if (more.p) d.p.push(...more.p.filter((x) => !d.p.includes(x)));
      for (const key of ['kings', 'last', 'ach', 'fall']) if (more[key]) d[key] = more[key];
    }
    if (IDIOMS[d.id]) d.idioms = IDIOMS[d.id];
    d.ev.sort((a, b) => a[0] - b[0]);
    return d;
  });
}

const dynasties = mergeDetails(DYNASTIES);
const byId = new Map(dynasties.map((d) => [d.id, d]));
const eraById = new Map(ERAS.map((e) => [e.id, e]));

// 人物索引：规范名 -> 出现的朝代（按时间顺序）
const canonical = (name) => ALIASES[name] ?? name;
const dynastiesOf = new Map();
/** 按起始年排序的阅读顺序，用于"上一个 / 下一个" */
const ordered = [...dynasties].sort((a, b) => a.s - b.s || a.lane - b.lane);
for (const d of ordered)
  for (const name of d.p) {
    const key = canonical(name);
    if (!dynastiesOf.has(key)) dynastiesOf.set(key, []);
    if (!dynastiesOf.get(key).includes(d)) dynastiesOf.get(key).push(d);
  }

export const model = {
  NOW,
  eras: ERAS,
  dynasties,
  ordered,
  milestones: PINS,
  unity: UNITY,
  unityTypes: UNITY_TYPES,
  laneCount: Math.max(...dynasties.map((d) => d.lane)) + 1,
  range: { min: -2150, max: NOW + 30 },

  get: (id) => byId.get(id),
  era: (id) => eraById.get(id),

  neighbors(d) {
    const i = ordered.indexOf(d);
    return { prev: ordered[i - 1], next: ordered[i + 1] };
  },

  /** 与某朝代时间上有重叠的其他政权 */
  concurrent(d) {
    const a = drawStart(d);
    return dynasties.filter((o) => o !== d && drawStart(o) < d.e && o.e > a);
  },

  /** 人物资料：{ name, life, role, bio, dynasties }，无资料时返回 null */
  person(name) {
    const key = canonical(name);
    const info = PEOPLE[key];
    if (!info) return null;
    const [life, role, bio] = info;
    return { name: key, life, role, bio, dynasties: dynastiesOf.get(key) ?? [] };
  },

  /** 全文搜索：名称、建立者、都城、简介、人物及其简介、事件、成就、成语 */
  search(q) {
    q = q.trim();
    if (!q) return null;
    return new Set(
      dynasties
        .filter((d) =>
          [d.n, d.f, d.c, d.sum, d.fall ?? '', ...d.p, ...(d.ach ?? []), ...d.ev.map((x) => x[1]), ...(d.idioms ?? []).flat(),
           ...d.p.map((x) => PEOPLE[canonical(x)]?.join(' ') ?? '')]
            .join(' ')
            .includes(q),
        )
        .map((d) => d.id),
    );
  },

  stats: () => ({
    years: NOW + 2070,
    regimes: dynasties.length,
    events: dynasties.reduce((n, d) => n + d.ev.length, 0),
  }),
};
