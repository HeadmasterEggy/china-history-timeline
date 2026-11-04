// 左侧边栏：按时期列出全部政权，点击跳转到朝代详情；高亮当前朝代与搜索结果。
// 窄屏下折叠为抽屉，由页面左下角的按钮打开。

import { formatSpan, eraColor } from '../core/format.js';

const SECTIONS = [
  ['scroll', '长卷'],
  ['detail', '朝代详情'],
  ['map', '疆域演变'],
  ['people-sec', '历史人物'],
  ['list-sec', '历代一览'],
];

export function createSidebar(el, toggle, model, store) {
  const groups = model.eras
    .map((era) => {
      const items = model.ordered
        .filter((d) => d.era === era.id)
        .map(
          (d) => `<li><button data-id="${d.id}" class="${d.lane > 0 ? 'para' : ''}">
            <span class="sb-name">${d.n}</span><span class="sb-years">${formatSpan(d)}</span></button></li>`,
        )
        .join('');
      return `<section class="sb-era" style="--c:${eraColor(era.id)}">
        <h3><button data-era="${era.id}" aria-expanded="true">${era.name}</button></h3>
        <ul>${items}</ul></section>`;
    })
    .join('');

  el.innerHTML = `
    <div class="sb-head">
      <a class="sb-title" href="#">华夏历史长卷</a>
      <nav class="sb-jump">${SECTIONS.map(([id, name]) => `<button data-jump="${id}">${name}</button>`).join('')}</nav>
    </div>
    <div class="sb-list">${groups}</div>`;

  const close = () => document.body.classList.remove('sb-open');
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.id) {
      store.select(btn.dataset.id, { source: 'sidebar' });
      jump('detail');
      close();
    } else if (btn.dataset.jump) {
      jump(btn.dataset.jump);
      close();
    } else if (btn.dataset.era) {
      // 点击时期标题折叠或展开该时期
      const sec = btn.closest('.sb-era');
      const collapsed = sec.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', !collapsed);
    }
  });
  el.querySelector('.sb-title').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    close();
  });

  toggle.addEventListener('click', () => document.body.classList.toggle('sb-open'));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());

  store.on('select', ({ id }) => {
    let current = null;
    el.querySelectorAll('[data-id]').forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('on', on);
      if (on) current = b;
    });
    // 选中项所在的时期若被折叠则展开，并滚动到可见位置
    const sec = current?.closest('.sb-era');
    if (sec?.classList.contains('collapsed')) sec.classList.remove('collapsed');
    // 只滚动侧边栏列表本身；scrollIntoView 会连带滚动整个页面
    const list = el.querySelector('.sb-list');
    if (current) {
      const top = current.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + current.offsetHeight > list.scrollTop + list.clientHeight)
        list.scrollTop = top - list.clientHeight / 2;
    }
  });

  store.on('search', ({ matches }) => {
    el.querySelectorAll('[data-id]').forEach((b) => {
      b.classList.toggle('hit', !!matches && matches.has(b.dataset.id));
      b.classList.toggle('dim', !!matches && !matches.has(b.dataset.id));
    });
  });
}
