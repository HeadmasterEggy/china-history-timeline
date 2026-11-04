// 历史人物索引：按时期列出全部人物，点击后跳转到所属朝代并打开人物卡片

import { eraColor } from '../core/format.js';

export function createPeopleIndex(el, model, store, { onPick }) {
  const seen = new Set();
  const groups = model.eras.map((era) => {
    const people = [];
    for (const d of model.ordered.filter((x) => x.era === era.id))
      for (const name of d.p) {
        const person = model.person(name);
        if (!person || seen.has(person.name)) continue;
        seen.add(person.name);
        people.push(person);
      }
    return { era, people };
  });

  const total = groups.reduce((n, g) => n + g.people.length, 0);
  el.innerHTML = `<div class="pi-wrap collapsed">${groups
    .filter((g) => g.people.length)
    .map(({ era, people }) => `
      <div class="pi-grp" style="--c:${eraColor(era.id)}">
        <h3>${era.name}<span>${people.length} 人</span></h3>
        <div class="pi-list">${people
          .map((p) => `<button data-person="${p.name}" title="${p.role}"><b>${p.name}</b><small>${p.life}</small></button>`)
          .join('')}</div>
      </div>`)
    .join('')}</div>
    <button class="pi-toggle" aria-expanded="false">展开全部 ${total} 位人物</button>`;

  const wrap = el.querySelector('.pi-wrap');
  const toggle = el.querySelector('.pi-toggle');
  toggle.addEventListener('click', () => {
    const open = wrap.classList.toggle('collapsed') === false;
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? '收起' : `展开全部 ${total} 位人物`;
    if (!open) el.scrollIntoView({ block: 'start' });
  });

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-person]');
    if (!btn) return;
    const person = model.person(btn.dataset.person);
    store.openPerson(person.name, person.dynasties[0].id);
    onPick?.();
  });
}
