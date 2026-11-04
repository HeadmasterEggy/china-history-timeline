// 历史数据模型：合并基础数据与补充资料，提供查询方法

import { ERAS, NOW } from '../../data/eras.js';
import { DYNASTIES } from '../../data/dynasties.js';
import { DETAILS } from '../../data/details.js';
import { PINS } from '../../data/milestones.js';
import { UNITY, UNITY_TYPES } from '../../data/unity.js';
import { IDIOMS } from '../../data/idioms.js';
import { PEOPLE, ALIASES } from '../../data/people.js';
import { EVENT_DETAILS } from '../../data/events/index.js';
import { DYNASTY_SOURCES } from '../../data/sources.js';
import { drawStart } from './format.js';

function mergeDetails(list) {
  return list.map((base) => {
    const d = { ...base, ev: [...base.ev], p: [...base.p] };
    const more = DETAILS[d.id];
    if (more) {
      if (more.ev) d.ev.push(...more.ev);
      if (more.p) d.p.push(...more.p.filter((x) => !d.p.includes(x)));
      for (const key of ['kings', 'last', 'ach', 'fall', 'phases', 'sections']) if (more[key]) d[key] = more[key];
    }
    if (IDIOMS[d.id]) d.idioms = IDIOMS[d.id];
    d.wiki = DYNASTY_SOURCES[d.id]?.wiki ?? d.n;
    d.histories = DYNASTY_SOURCES[d.id]?.books ?? [];
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
// 事件索引：每条大事记都有稳定的 id（朝代-年份，同年多条时加序号），前 210 年记作 b210
const eventById = new Map();
for (const d of ordered) {
  const perYear = new Map();
  d.events = d.ev.map(([year, text]) => {
    const n = (perYear.get(year) ?? 0) + 1;
    perYear.set(year, n);
    const base = `${d.id}-${year < 0 ? `b${-year}` : year}`;
    const id = n === 1 ? base : `${base}-${n}`;
    // 同一件事在两个政权的大事记里都有时，可用字符串指向另一条详情
    const raw = EVENT_DETAILS[id];
    const ev = { id, year, text, dynasty: d, detail: typeof raw === 'string' ? EVENT_DETAILS[raw] : raw };
    eventById.set(ev.id, ev);
    return ev;
  });
}
const allEvents = [...eventById.values()].sort((a, b) => a.year - b.year);
// 人名按长度倒序匹配，避免"刘秀"先于"刘秀才"之类的短名误配
const personNames = [...new Set([...Object.keys(PEOPLE), ...Object.keys(ALIASES)])].sort((a, b) => b.length - a.length);

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
  milestones: [...PINS].sort((a, b) => a[0] - b[0]),
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

  event: (id) => eventById.get(id),

  /** 某事件前后 range 年内其他朝代的大事 */
  eventsNear(ev, range = 3, limit = 8) {
    return allEvents
      .filter((o) => o.dynasty !== ev.dynasty && Math.abs(o.year - ev.year) <= range)
      .sort((a, b) => Math.abs(a.year - ev.year) - Math.abs(b.year - ev.year))
      .slice(0, limit)
      .sort((a, b) => a.year - b.year);
  },

  /** 文本中提到的、有简介的人物 */
  peopleIn(text) {
    const found = [];
    let rest = text;
    for (const name of personNames) {
      if (name.length < 2 || !rest.includes(name)) continue;
      const key = canonical(name);
      if (PEOPLE[key] && !found.includes(key)) found.push(key);
      rest = rest.replaceAll(name, '');
    }
    return found;
  },

  /** 全文搜索：名称、建立者、都城、简介、人物及其简介、事件、成就、成语 */
  search(q) {
    q = q.trim();
    if (!q) return null;
    return new Set(
      dynasties
        .filter((d) =>
          [d.n, d.f, d.c, d.sum, d.fall ?? '', ...d.p, ...(d.ach ?? []), ...d.ev.map((x) => x[1]), ...(d.idioms ?? []).flat(), ...(d.sections ?? []).flatMap((s) => s.items.flat()),
           ...d.events.flatMap((e) => (e.detail ? [e.detail.title, e.detail.bg, ...e.detail.steps.flat(), e.detail.impact] : [])),
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
