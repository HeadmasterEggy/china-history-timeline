// 工具条：时期快速跳转按钮与搜索框

import { eraColor } from '../core/format.js';

export function createEraNav(el, model, store, timeline) {
  el.innerHTML = model.eras
    .map((e) => `<button class="chip" style="--c:${eraColor(e.id)}" data-era="${e.id}">${e.name}</button>`)
    .join('');
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-era]');
    if (!btn) return;
    const era = model.era(btn.dataset.era);
    const first = model.ordered.find((d) => d.era === era.id && d.lane === 0);
    timeline.scrollEl.scrollTo({ left: timeline.x(era.s) - 40, behavior: 'smooth' });
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
