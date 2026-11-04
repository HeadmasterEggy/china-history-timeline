// 朝代详情：概况、大事记、制度成就与衰亡原因

import { formatSpan, formatYear, duration, eraColor } from '../core/format.js';

const list = (items, render) => items.map(render).join('');

function infoColumn(d, model) {
  const era = model.era(d.era);
  const { prev, next } = model.neighbors(d);
  const concurrent = model.concurrent(d).map((o) => o.n).join('、') || '—';
  const rulers = [d.kings, d.last && `末代：${d.last}`].filter(Boolean).join('；');
  return `
    <div>
      <div class="d-era">${era.name}${d.lane > 0 ? ' · 并存政权' : ''}</div>
      <h2 class="d-name">${d.n}</h2>
      <div class="d-years">${formatSpan(d)}　·　${d.open ? '至今' : '历时约'} ${duration(d)} 年</div>
      <p class="d-sum">${d.sum}</p>
      <dl class="kv">
        <dt>建立者</dt><dd>${d.f}</dd>
        <dt>都城</dt><dd>${d.c}</dd>
        ${rulers ? `<dt>君主</dt><dd>${rulers}</dd>` : ''}
        <dt>同期政权</dt><dd>${concurrent}</dd>
        <dt>代表人物</dt><dd><div class="people">${list(d.p, (x) => `<span>${x}</span>`)}</div></dd>
      </dl>
      <div class="nav">
        <button data-go="${prev?.id ?? ''}" ${prev ? '' : 'disabled'}>← 上一个<b>${prev?.n ?? '—'}</b></button>
        <button data-go="${next?.id ?? ''}" ${next ? '' : 'disabled'}>下一个 →<b>${next?.n ?? '—'}</b></button>
      </div>
    </div>`;
}

function eventsColumn(d) {
  return `
    <div>
      <div class="ev-title">大事记</div>
      <ol class="events">${list(d.ev, ([y, t]) => `<li><time>${formatYear(y)}</time><span>${t}</span></li>`)}</ol>
    </div>`;
}

function idiomsBlock(d) {
  if (!d.idioms) return '';
  return `<div><div class="ev-title">成语典故</div><dl class="idioms">${list(d.idioms, ([w, t]) => `<dt>${w}</dt><dd>${t}</dd>`)}</dl></div>`;
}

function moreColumn(d) {
  if (!d.ach && !d.fall && !d.idioms) return '';
  return `
    <div class="d-more">
      ${d.ach ? `<div><div class="ev-title">制度 · 经济 · 文化</div><ul class="ach">${list(d.ach, (x) => `<li>${x}</li>`)}</ul></div>` : ''}
      ${d.fall ? `<div><div class="ev-title">${d.open ? '发展' : '衰亡原因'}</div><p class="fall">${d.fall}</p></div>` : ''}
      ${idiomsBlock(d)}
    </div>`;
}

export function createDetail(el, model, store) {
  el.addEventListener('click', (e) => {
    const id = e.target.closest('[data-go]')?.dataset.go;
    if (id) store.select(id, { source: 'detail' });
  });

  store.on('select', ({ id }) => {
    const d = model.get(id);
    el.style.setProperty('--c', eraColor(d.era));
    el.innerHTML = infoColumn(d, model) + eventsColumn(d) + moreColumn(d);
  });
}
