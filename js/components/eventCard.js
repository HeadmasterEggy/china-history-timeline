// 事件详情弹窗：点击任意大事记打开。重大事件显示背景、经过、结果与影响；
// 所有事件都显示相关人物、同时期大事，并可在时间轴和地图上定位。

import { formatYear, eraColor } from '../core/format.js';

const list = (items, render) => items.map(render).join('');

function richBody(detail) {
  return `
    <p class="ec-bg"><b>背景</b>${detail.bg}</p>
    <h4>经过</h4>
    <ol class="ec-steps">${list(detail.steps, ([when, what]) => `<li><time>${when}</time><span>${what}</span></li>`)}</ol>
    <h4>结果</h4>
    <ul class="ec-result">${list(detail.result, (r) => `<li>${r}</li>`)}</ul>
    <h4>影响</h4>
    <p>${detail.impact}</p>`;
}

function eventLink(ev) {
  return `<button class="ec-link" data-event="${ev.id}" style="--c:${eraColor(ev.dynasty.era)}">
    <time>${formatYear(ev.year)}</time><span>${ev.text}</span><small>${ev.dynasty.n}</small></button>`;
}

export function createEventCard(dialog, model, store) {
  const body = dialog.querySelector('.ec-body');
  let current = null;

  function render(ev) {
    const d = ev.detail;
    const i = ev.dynasty.events.indexOf(ev);
    const prev = ev.dynasty.events[i - 1];
    const next = ev.dynasty.events[i + 1];
    const people = [...new Set([...(d?.people ?? []), ...model.peopleIn(ev.text + (d ? d.bg + d.steps.flat().join('') : ''))])];
    const near = model.eventsNear(ev);

    dialog.style.setProperty('--c', eraColor(ev.dynasty.era));
    body.innerHTML = `
      <header class="ec-head">
        <button class="ec-dyn" data-dynasty="${ev.dynasty.id}">${ev.dynasty.n}</button>
        <span class="ec-year">${d?.span ?? formatYear(ev.year)}</span>
        <h3>${d?.title ?? ev.text}</h3>
        ${d ? `<p class="ec-sub">${ev.text}</p>` : ''}
      </header>
      ${d ? richBody(d) : ''}
      ${people.length ? `<h4>相关人物</h4><div class="ec-people">${list(people, (p) => `<button data-person="${p}">${p}</button>`)}</div>` : ''}
      <div class="ec-actions">
        <button data-action="timeline">在时间轴上定位</button>
        <button data-action="map">查看当时疆域</button>
      </div>
      ${near.length ? `<h4>同一时期</h4><div class="ec-near">${list(near, eventLink)}</div>` : ''}
      <nav class="ec-nav">
        ${prev ? eventLink(prev).replace('ec-link', 'ec-link prev') : '<span></span>'}
        ${next ? eventLink(next).replace('ec-link', 'ec-link next') : '<span></span>'}
      </nav>`;
    body.scrollTop = 0;
  }

  function open(id) {
    const ev = model.event(id);
    if (!ev) return;
    current = ev;
    render(ev);
    if (!dialog.open) dialog.showModal();
    if (store.state.selectedId !== ev.dynasty.id) store.select(ev.dynasty.id, { source: 'event', center: false });
    store.focusYear(ev.year, ev.dynasty.id);
    try {
      history.replaceState(null, '', `#e-${ev.id}`);
    } catch {
      /* 某些嵌入环境不允许修改地址 */
    }
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) return dialog.close(); // 点击遮罩关闭
    const t = e.target.closest('[data-event], [data-person], [data-dynasty], [data-action], [data-close]');
    if (!t) return;
    if (t.dataset.close !== undefined) return dialog.close();
    if (t.dataset.event) return store.openEvent(t.dataset.event);
    dialog.close();
    if (t.dataset.dynasty) store.select(t.dataset.dynasty, { source: 'event' });
    if (t.dataset.person) {
      const person = model.person(t.dataset.person);
      const home = person.dynasties.includes(current.dynasty) ? current.dynasty : person.dynasties[0];
      store.openPerson(person.name, home.id);
      document.getElementById('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (t.dataset.action === 'timeline') document.getElementById('scroll').scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (t.dataset.action === 'map') document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  dialog.addEventListener('close', () => {
    current = null;
    store.closeEvent();
    try {
      history.replaceState(null, '', `#${store.state.selectedId}`);
    } catch {
      /* 同上 */
    }
  });

  store.on('event', ({ id }) => open(id));
}
