// 朝代详情：概况、大事记、制度成就与衰亡原因

import { formatSpan, formatYear, duration, eraColor } from '../core/format.js';

const list = (items, render) => items.map(render).join('');

function personChip(name, model) {
  return model.person(name)
    ? `<button class="chip-person" data-person="${name}" aria-expanded="false">${name}</button>`
    : `<span>${name}</span>`;
}

/** 人物卡片：生卒、身份、简介，以及其出现的所有朝代 */
function personCard(person, currentId) {
  const links = person.dynasties
    .map((d) => (d.id === currentId ? `<b>${d.n}</b>` : `<button data-go="${d.id}" data-keep="${person.name}">${d.n}</button>`))
    .join('');
  return `<div class="person-card" role="region" aria-label="${person.name}简介">
      <div class="pc-head"><h3>${person.name}</h3><span>${person.life}</span>
        <button class="pc-close" data-close aria-label="关闭">×</button></div>
      <div class="pc-role">${person.role}</div>
      <p>${person.bio}</p>
      ${person.dynasties.length > 1 ? `<div class="pc-links">出现于：${links}</div>` : ''}
    </div>`;
}

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
        <dt>代表人物</dt><dd><div class="people">${list(d.p, (x) => personChip(x, model))}</div></dd>
      </dl>
      <div class="person-slot"></div>
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
  let openPerson = null;

  function showPerson(name) {
    openPerson = name;
    const slot = el.querySelector('.person-slot');
    el.querySelectorAll('[data-person]').forEach((b) => {
      const on = b.dataset.person === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-expanded', on);
    });
    slot.innerHTML = name ? personCard(model.person(name), store.state.selectedId) : '';
  }

  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go?.dataset.go) {
      openPerson = go.dataset.keep ?? null;
      store.select(go.dataset.go, { source: 'detail' });
      return;
    }
    const chip = e.target.closest('[data-person]');
    if (chip) return showPerson(chip.dataset.person === openPerson ? null : chip.dataset.person);
    if (e.target.closest('[data-close]')) showPerson(null);
  });

  store.on('person', ({ name }) => {
    const d = model.get(store.state.selectedId);
    showPerson(d.p.find((x) => model.person(x)?.name === name) ?? null);
  });

  store.on('select', ({ id }) => {
    const d = model.get(id);
    el.style.setProperty('--c', eraColor(d.era));
    el.innerHTML = infoColumn(d, model) + eventsColumn(d) + moreColumn(d);
    // 从人物卡片跳转到其他朝代时，保持该人物卡片打开
    const keep = openPerson && d.p.find((x) => model.person(x)?.name === model.person(openPerson)?.name);
    showPerson(keep ?? null);
  });
}
