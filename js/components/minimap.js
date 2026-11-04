// 全景缩略条：显示全部时期，方框标出长卷当前视野；点击或拖动跳转

import { eraColor } from '../core/format.js';

export function createMinimap(el, model, timeline) {
  const { min, max } = model.range;
  const firstEra = model.eras[0];
  el.innerHTML =
    `<i style="--c:var(--line);flex:${firstEra.s - min}"></i>` +
    model.eras.map((e) => `<i style="--c:${eraColor(e.id)};flex:${e.e - e.s}">${e.name}</i>`).join('') +
    `<i style="--c:var(--line);flex:${max - model.NOW}"></i><div class="view"></div>`;
  const view = el.querySelector('.view');
  const scroll = timeline.scrollEl;

  function update() {
    const total = timeline.contentWidth();
    const w = el.clientWidth;
    view.style.left = `${(scroll.scrollLeft / total) * w}px`;
    view.style.width = `${Math.max(6, (scroll.clientWidth / total) * w)}px`;
  }

  function jump(ev) {
    const r = el.getBoundingClientRect();
    scroll.scrollLeft = ((ev.clientX - r.left) / r.width) * timeline.contentWidth() - scroll.clientWidth / 2;
  }

  let dragging = false;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    el.setPointerCapture(e.pointerId);
    jump(e);
  });
  el.addEventListener('pointermove', (e) => dragging && jump(e));
  el.addEventListener('pointerup', () => (dragging = false));
  el.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 0.5, ArrowLeft: -0.5 }[e.key];
    if (!step) return;
    scroll.scrollLeft += scroll.clientWidth * step;
    e.preventDefault();
  });

  timeline.onViewChange(update);
  update();
}
