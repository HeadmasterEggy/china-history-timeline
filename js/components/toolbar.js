// 工具条：时期快速跳转按钮与搜索框

import { eraColor } from '../core/format.js';

// 跨时期的快速缩放范围（中国史学通常以 1840 年和 1949 年划分近代、现代）
const RANGES = [
  { id: 'jindai', name: '近代 1840–1949', s: 1840, e: 1949, focus: 'qing', era: 'modern' },
  { id: 'xiandai', name: '现代 1949–今', s: 1949, e: null, focus: 'prc', era: 'modern' },
];

export function createEraNav(el, model, store, timeline) {
  const chip = (attr, color, title, name) =>
    `<button class="chip" style="--c:${eraColor(color)}" ${attr} title="${title}">${name}</button>`;
  el.innerHTML =
    model.eras.map((e) => chip(`data-era="${e.id}"`, e.id, `缩放到${e.name}时期`, e.name)).join('') +
    RANGES.map((r) => chip(`data-range="${r.id}"`, r.era, `缩放到${r.name}`, r.name)).join('');

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-era], [data-range]');
    if (!btn) return;
    if (btn.dataset.range) {
      const r = RANGES.find((x) => x.id === btn.dataset.range);
      timeline.fit(r.s, r.e ?? model.NOW);
      store.select(r.focus, { source: 'eras', center: false });
      return;
    }
    const era = model.era(btn.dataset.era);
    timeline.fit(era.s, era.e);
    const first = model.ordered.find((d) => d.era === era.id && d.lane === 0);
    if (first) store.select(first.id, { source: 'eras', center: false });
  });
}

export function createSearch(input, info, model, store) {
  input.addEventListener('input', () => {
    const matches = model.search(input.value);
    store.search(input.value, matches);
    info.textContent = !matches
      ? ''
      : matches.size
        ? `找到 ${matches.size} 个相关朝代，按回车查看第一个`
        : '没有找到，换个关键词试试';
  });
  input.addEventListener('keydown', (e) => {
    const { matches } = store.state;
    if (e.key !== 'Enter' || !matches?.size) return;
    const first = model.ordered.find((d) => matches.has(d.id));
    store.select(first.id, { source: 'search' });
  });
}
