// 长卷时间轴：时期底色、大事件标记、朝代泳道、分合色带与年份刻度；负责缩放与拖动

import { formatSpan, formatTick, formatYear, eraColor, drawStart } from '../core/format.js';

const PAD = 24;
const PINS_H = 56;     // 顶部大事件区高度
const UNITY_H = 22;    // 分合色带高度
const AXIS_H = 26;
const TICK_STEPS = [10, 20, 25, 50, 100, 200, 250, 500, 1000];

// 缩放滑块 0–100 对数映射到 0.25–10 像素/年
const sliderToPpy = (v) => 0.25 * Math.pow(40, v / 100);

export function createTimeline({ scrollEl, zoomInput, zoomIn, zoomOut }, model, store) {
  const canvas = scrollEl.querySelector('.canvas');
  const { min, max } = model.range;
  const laneH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lane-h'), 10);
  let ppy = sliderToPpy(+zoomInput.value);
  const viewListeners = [];

  const x = (year) => PAD + (year - min) * ppy;
  const yearAt = (px) => min + (px - PAD) / ppy;
  const laneTop = (lane) => PINS_H + 8 + lane * laneH();

  // ---------- 绘制 ----------
  function bandsHTML() {
    return model.eras
      .map((e) => `<div class="band" style="--c:${eraColor(e.id)};left:${x(e.s)}px;width:${x(e.e) - x(e.s)}px"><span>${e.name}</span></div>`)
      .join('');
  }

  function gridHTML(axisY) {
    const step = TICK_STEPS.find((s) => s * ppy >= 80) ?? 1000;
    let grid = '';
    let ticks = '';
    for (let y = Math.ceil(min / step) * step; y <= max; y += step) {
      grid += `<div class="grid" style="left:${x(y)}px;top:${PINS_H}px;height:${axisY - PINS_H}px"></div>`;
      ticks += `<div class="tick${y === 0 ? ' zero' : ''}" style="left:${x(y)}px">${formatTick(y)}</div>`;
    }
    return { grid, axis: `<div class="axis" style="top:${axisY}px">${ticks}</div>` };
  }

  function pinsHTML() {
    // 两行交错排布，避免标签重叠
    const rowEnd = [-Infinity, -Infinity];
    return model.milestones
      .map(([year, text, id]) => {
        const px = x(year);
        const width = text.length * 12 + 16;
        let row = px > rowEnd[0] + 6 ? 0 : px > rowEnd[1] + 6 ? 1 : rowEnd[0] < rowEnd[1] ? 0 : 1;
        rowEnd[row] = px + width;
        const top = 24 + row * 22;
        return `<div class="pinline" style="left:${px}px;top:${top + 10}px;height:${PINS_H + 8 - top - 10}px"></div>
          <button class="pin" data-id="${id}" style="left:${px}px;top:${top}px" title="${formatYear(year)} ${text}">${text}</button>`;
      })
      .join('');
  }

  function blocksHTML() {
    return model.dynasties
      .map((d) => {
        const left = x(drawStart(d));
        const width = Math.max(3, x(d.e) - left);
        const cls = ['blk', d.major && 'major', width < d.n.length * 16 + 14 && 'tiny', width < 120 && 'narrow']
          .filter(Boolean)
          .join(' ');
        return `<button class="${cls}" data-id="${d.id}" style="--c:${eraColor(d.era)};left:${left}px;width:${width}px;top:${laneTop(d.lane) + 4}px"
          title="${d.n}  ${formatSpan(d)}" aria-label="${d.n}，${formatSpan(d)}"><b>${d.n}</b><small>${formatSpan(d)}</small></button>`;
      })
      .join('');
  }

  function unityHTML(top) {
    return model.unity
      .map(([s, e, type, name]) => {
        const w = x(e) - x(s);
        return `<div class="unity unity-${type}" style="left:${x(s)}px;width:${w}px;top:${top}px" title="${formatYear(s)} – ${formatYear(e)}　${name}（${model.unityTypes[type]}）">${w > name.length * 12 + 10 ? name : ''}</div>`;
      })
      .join('');
  }

  function render() {
    const unityTop = laneTop(model.laneCount) + 2;
    const axisY = unityTop + UNITY_H + 4;
    canvas.style.width = `${x(max) + PAD}px`;
    canvas.style.height = `${axisY + AXIS_H + 6}px`;
    const { grid, axis } = gridHTML(axisY);
    canvas.innerHTML = bandsHTML() + grid + pinsHTML() + blocksHTML() + unityHTML(unityTop) + axis;
    paint();
    notifyView();
  }

  // ---------- 状态高亮 ----------
  function paint() {
    const { selectedId, matches } = store.state;
    canvas.querySelectorAll('.blk').forEach((b) => {
      const id = b.dataset.id;
      b.classList.toggle('on', id === selectedId);
      b.classList.toggle('dim', !!matches && !matches.has(id));
      b.classList.toggle('hit', !!matches && matches.has(id) && id !== selectedId);
    });
    canvas.querySelectorAll('.pin').forEach((p) => p.classList.toggle('on', p.dataset.id === selectedId));
  }

  // ---------- 视野 ----------
  const notifyView = () => viewListeners.forEach((fn) => fn());
  function scrollToYear(year, smooth = true) {
    scrollEl.scrollTo({ left: x(year) - scrollEl.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  function centerOn(d) {
    scrollToYear((drawStart(d) + d.e) / 2);
  }

  // ---------- 缩放（保持视野中心年份不变） ----------
  function setZoom(v) {
    v = Math.max(0, Math.min(100, v));
    const center = yearAt(scrollEl.scrollLeft + scrollEl.clientWidth / 2);
    zoomInput.value = v;
    ppy = sliderToPpy(v);
    render();
    scrollToYear(center, false);
  }
  zoomInput.addEventListener('input', (e) => setZoom(+e.target.value));
  zoomIn.addEventListener('click', () => setZoom(+zoomInput.value + 10));
  zoomOut.addEventListener('click', () => setZoom(+zoomInput.value - 10));
  scrollEl.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(+zoomInput.value - Math.sign(e.deltaY) * 5);
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
        scrollEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false },
  );

  // ---------- 鼠标拖动 ----------
  let drag = null;
  let moved = false;
  scrollEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, left: scrollEl.scrollLeft };
    moved = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) {
      moved = true;
      scrollEl.classList.add('drag');
    }
    if (moved) scrollEl.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    drag = null;
    scrollEl.classList.remove('drag');
  });
  canvas.addEventListener('click', (e) => {
    if (moved) return void (moved = false);
    const target = e.target.closest('[data-id]');
    if (target) store.select(target.dataset.id, { source: 'timeline' });
  });

  scrollEl.addEventListener('scroll', notifyView, { passive: true });
  window.addEventListener('resize', render);

  store.on('select', ({ id, center }) => {
    paint();
    if (center) centerOn(model.get(id));
  });
  store.on('search', paint);

  render();

  return {
    scrollEl,
    x,
    scrollToYear,
    contentWidth: () => canvas.offsetWidth,
    onViewChange: (fn) => viewListeners.push(fn),
  };
}
