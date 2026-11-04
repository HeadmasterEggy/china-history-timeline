// 历代一览：按时期分组，色条长度表示存续年数

import { formatSpan, formatYear, duration, eraColor } from '../core/format.js';

export function createList(el, model, store, { onPick }) {
  const maxDur = Math.max(...model.dynasties.filter((d) => !d.open).map(duration));

  el.innerHTML = model.eras
    .map((era) => {
      const rows = model.ordered
        .filter((d) => d.era === era.id)
        .map(
          (d) => `<button class="row" data-id="${d.id}">
            <b>${d.n}</b><span class="yr">${formatSpan(d)}</span><span class="dur">${duration(d)} 年</span>
            <span class="bar" style="width:${Math.min(100, (duration(d) / maxDur) * 100)}%"></span></button>`,
        )
        .join('');
      const end = era.id === 'modern' ? '今' : formatYear(era.e);
      return `<div class="era-grp" style="--c:${eraColor(era.id)}">
        <h3>${era.name}<span>${formatYear(era.s)} – ${end}</span></h3>${rows}</div>`;
    })
    .join('');

  el.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    store.select(row.dataset.id, { source: 'list' });
    onPick?.();
  });

  store.on('select', ({ id }) => {
    el.querySelectorAll('.row').forEach((r) => r.classList.toggle('on', r.dataset.id === id));
  });
}
