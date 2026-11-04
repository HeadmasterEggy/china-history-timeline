// 疆域演变地图：按年份切换各时期的政权范围，并与时间轴选中的朝代联动
// 数据由 scripts/build_map.py 生成（data/map/borders.json）

import { formatYear, eraColor } from '../core/format.js';

const DATA_URL = new URL('../../data/map/borders.json', import.meta.url);
const PLAY_INTERVAL = 2200;
const RETRIES = 2;

// 自动聚焦：视野取当前帧全部政权（中原王朝、并存政权、管辖区域）的外接矩形，四周留白，
// 并限制最大放大倍数，避免夏、商等范围很小的帧放得过大
const FIT_ROLES = new Set(['main', 'para', 'adm']);
const FIT_PAD = 0.08;
const FIT_MIN_W = 0.4;
const FIT_MS = 600;

// 1912 年以后不绘制疆域，提示查阅国家标准地图
const MODERN_FRAME = {
  year: 1912, title: '近现代', focus: 'minguo', modern: true, shapes: [],
  desc: '1912 年以后的中国疆域，请以国家测绘地理信息部门发布的标准地图为准。',
};

const ROLE_LABEL = { main: '中原王朝', para: '并存政权', adm: '管辖 / 羁縻区域', other: '周边政权与部族' };

export function createTerritoryMap(root, model, store) {
  const svg = root.querySelector('svg');
  const side = root.querySelector('.map-side');
  const slider = root.querySelector('#map-range');
  const dots = root.querySelector('.map-dots');
  const playBtn = root.querySelector('#map-play');
  const modernNote = root.querySelector('.map-modern');
  let frames = [];
  let index = 0;
  let timer = null;
  let note = '';
  let full = [0, 0, 1000, 765];
  let view = full;
  let k = 1;   // 当前视野宽度 / 全图宽度，用于让文字和标记在缩放后保持原来的屏幕大小
  let anim = 0;

  const colorOf = (id) => eraColor(model.get(id)?.era ?? 'modern');

  // ---------- 绘制 ----------
  function patterns() {
    return model.eras
      .map((e) => `<pattern id="hatch-${e.id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="var(--map-land)"/><line x1="0" y1="0" x2="0" y2="7" stroke="${eraColor(e.id)}" stroke-width="3"/></pattern>`)
      .join('');
  }

  // 同一朝代下的多个政权（如十国）交替使用深浅不同的色调，便于区分
  const TONES = [38, 58, 30, 50, 44, 64, 34];

  function shapeSVG(s, tone) {
    const c = s.id ? colorOf(s.id) : 'var(--muted)';
    const era = model.get(s.id)?.era;
    const fill = s.role === 'adm' ? `fill="url(#hatch-${era})"` : '';
    const mix = s.role === 'para' && tone != null ? `;--mix:${TONES[tone % TONES.length]}%` : '';
    return `<path class="shape ${s.role}" ${s.id ? `data-id="${s.id}"` : ''} style="--c:${c}${mix}" ${fill} d="${s.d}">
      <title>${s.label || ROLE_LABEL[s.role]}</title></path>`;
  }

  /** 区域标签；若与都城标记过近则向下让开，避免遮挡 */
  function labelSVG(s, capitals) {
    if (!s.label) return '';
    let y = s.ly;
    const halfW = s.label.length * (s.big ? 17 : 11) * k;
    for (let tries = 0; tries < 4; tries++) {
      const hit = capitals.some((c) => Math.abs(c.y - y) < (s.big ? 26 : 18) * k && c.x > s.lx - halfW - 64 * k && c.x < s.lx + halfW);
      if (!hit) break;
      y += (s.big ? 36 : 24) * k;
    }
    const cls = `lbl ${s.role}${s.big ? ' big' : ''}`;
    return `<text class="${cls}" x="${s.lx}" y="${y}" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`;
  }

  /** 都城：第一个为中原王朝都城，用实心方块，其余用圆点 */
  function capitalSVG(c, i) {
    const r = 5 * k;
    const mark = i === 0
      ? `<rect x="${c.x - r}" y="${c.y - r}" width="${2 * r}" height="${2 * r}" transform="rotate(45 ${c.x} ${c.y})"/>`
      : `<circle cx="${c.x}" cy="${c.y}" r="${4.5 * k}"/>`;
    return `<g class="cap${i === 0 ? ' prime' : ''}"><title>都城：${c.name}</title>${mark}
      <text x="${c.x + 10 * k}" y="${c.y}" dominant-baseline="middle">${c.name}</text></g>`;
  }

  // ---------- 自动聚焦 ----------
  /** 当前帧所有政权的外接矩形（从路径坐标直接计算，结果缓存在帧上） */
  function bounds(f) {
    if (f.bbox !== undefined) return f.bbox;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const s of f.shapes) {
      if (!FIT_ROLES.has(s.role) || !s.id) continue;
      const n = s.d.match(/-?\d+(?:\.\d+)?/g) ?? [];
      for (let i = 0; i + 1 < n.length; i += 2) {
        const x = +n[i];
        const y = +n[i + 1];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    f.bbox = x0 < Infinity ? [x0, y0, x1, y1] : null;
    return f.bbox;
  }

  /** 由外接矩形算出保持地图宽高比的视野 [x, y, w, h] */
  function fitView(f) {
    const b = bounds(f);
    const [, , W, H] = full;
    if (!b) return full;
    const ratio = W / H;
    let w = (b[2] - b[0]) * (1 + 2 * FIT_PAD);
    let h = (b[3] - b[1]) * (1 + 2 * FIT_PAD);
    if (w / h < ratio) w = h * ratio;
    else h = w / ratio;
    w = Math.min(W, Math.max(W * FIT_MIN_W, w));
    h = w / ratio;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const x = clamp((b[0] + b[2]) / 2 - w / 2, 0, W - w);
    const y = clamp((b[1] + b[3]) / 2 - h / 2, 0, H - h);
    return [x, y, w, h];
  }

  /** 平滑过渡到新的视野 */
  function zoomTo(target) {
    cancelAnimationFrame(anim);
    const from = view;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const step = (now) => {
      const t = reduce ? 1 : Math.min(1, (now - t0) / FIT_MS);
      const e = 1 - Math.pow(1 - t, 3);
      view = from.map((v, i) => v + (target[i] - v) * e);
      svg.setAttribute('viewBox', view.map((v) => v.toFixed(1)).join(' '));
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function renderFrame() {
    const f = frames[index];
    const layer = svg.querySelector('.frame');
    const target = fitView(f);
    k = target[2] / full[2];
    svg.style.setProperty('--k', k);
    const capitals = f.capitals ?? [];
    const seen = new Map();
    const tones = f.shapes.map((s) => {
      if (s.role !== 'para' || !s.id) return null;
      const n = seen.get(s.id) ?? 0;
      seen.set(s.id, n + 1);
      return n;
    });
    layer.innerHTML = f.shapes.map((s, i) => shapeSVG(s, tones[i])).join('') + f.shapes.map((s) => labelSVG(s, capitals)).join('')
      + capitals.map(capitalSVG).join('');
    layer.classList.remove('fade');
    void layer.getBoundingClientRect();
    layer.classList.add('fade');
    modernNote.hidden = !f.modern;
    slider.value = index;
    dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === index));
    renderSide(f);
    highlight();
    zoomTo(target);
  }

  function renderSide(f) {
    const focus = model.get(f.focus);
    // 按「朝代 + 标签」去重：战国后期的秦与关东六国同属战国，但应分别列出
    const regimes = [...new Map(f.shapes.filter((s) => s.id && s.role !== 'other' && (s.label || s.role === 'main'))
      .map((s) => [`${s.id}|${s.label}`, s])).values()].filter((s) => s.label || !f.shapes.some((o) => o.id === s.id && o.label));
    const legend = regimes
      .map((s) => {
        const d = model.get(s.id);
        const swatch = s.role === 'adm' ? 'adm' : s.role;
        return `<li><button data-id="${d.id}"><i class="sw ${swatch}" style="--c:${colorOf(d.id)}"></i>${s.label || d.n}<small>${ROLE_LABEL[s.role]}</small></button></li>`;
      })
      .join('');
    side.innerHTML = `
      <div class="m-year">${f.modern ? '1912 年 – 今' : `约${formatYear(f.year)}`}</div>
      <h3 class="m-title">${f.title}</h3>
      <p class="m-desc">${f.desc}</p>
      ${note ? `<p class="m-note">${note}</p>` : ''}
      ${legend ? `<ul class="m-legend">${legend}</ul>` : ''}
      <div class="m-keys">
        <span><i class="sw main"></i>中原王朝</span><span><i class="sw para"></i>并存政权</span>
        <span><i class="sw adm"></i>管辖 / 羁縻</span><span><i class="sw other"></i>周边</span><span><i class="sw cap-key"></i>都城</span>
      </div>
      ${focus ? `<button class="m-focus" data-id="${focus.id}">查看「${focus.n}」详情</button>` : ''}`;
  }

  function highlight() {
    const id = store.state.selectedId;
    svg.querySelectorAll('.shape[data-id]').forEach((p) => p.classList.toggle('on', p.dataset.id === id));
  }

  // ---------- 帧切换 ----------
  /** 选中朝代会重绘地图上方的详情区，高度变化会把地图推走；这里抵消位移，让地图停在原处 */
  function keepInPlace(fn) {
    const before = root.getBoundingClientRect().top;
    fn();
    const shift = root.getBoundingClientRect().top - before;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' });
  }

  function goTo(i, { fromUser = false } = {}) {
    index = Math.max(0, Math.min(frames.length - 1, i));
    note = '';
    renderFrame();
    if (fromUser) keepInPlace(() => store.select(frames[index].focus, { source: 'map' }));
  }

  /** 为选中的朝代挑选最合适的地图帧 */
  function frameFor(d) {
    const mid = (d.s + d.e) / 2;
    const near = (list) => list.reduce((a, b) => (Math.abs(b.year - mid) < Math.abs(a.year - mid) ? b : a));
    const own = frames.filter((f) => f.focus === d.id || f.shapes.some((s) => s.id === d.id));
    if (own.length) return { frame: near(own), note: '' };
    if (d.era === 'modern') return { frame: MODERN_FRAME, note: '' };
    const inside = frames.filter((f) => f.year >= d.s && f.year <= d.e);
    return {
      frame: near(inside.length ? inside : frames),
      note: `地图数据中没有「${d.n}」单独的图层，显示最接近的年份。`,
    };
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    playBtn.textContent = '▶ 播放演变';
  }
  function play() {
    if (index >= frames.length - 1) goTo(0, { fromUser: true });
    playBtn.textContent = '❚❚ 暂停';
    timer = setInterval(() => {
      if (index >= frames.length - 1) return stop();
      goTo(index + 1, { fromUser: true });
    }, PLAY_INTERVAL);
  }

  // ---------- 事件 ----------
  playBtn.addEventListener('click', () => (timer ? stop() : play()));
  slider.addEventListener('input', () => {
    stop();
    goTo(+slider.value, { fromUser: true });
  });
  root.querySelector('#map-prev').addEventListener('click', () => (stop(), goTo(index - 1, { fromUser: true })));
  root.querySelector('#map-next').addEventListener('click', () => (stop(), goTo(index + 1, { fromUser: true })));
  dots.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) (stop(), goTo(+b.dataset.i, { fromUser: true }));
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.shape[data-id], .m-legend [data-id], .m-focus');
    if (t) keepInPlace(() => store.select(t.dataset.id, { source: 'map-shape' }));
  });

  // 事件定位：优先选含该朝代的帧中年份最接近的一帧
  store.on('focus-year', ({ year, dynastyId }) => focusYear(year, dynastyId));
  function focusYear(year, dynastyId) {
    if (!frames.length) return;
    const d = model.get(dynastyId);
    if (d.era === 'modern' && year >= 1912) return goToFrame(frames.indexOf(MODERN_FRAME));
    const own = frames.filter((f) => !f.modern && f.shapes.some((s) => s.id === dynastyId));
    const pool = own.length ? own : frames.filter((f) => !f.modern);
    const best = pool.reduce((a, b) => (Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a));
    goToFrame(frames.indexOf(best));
  }
  function goToFrame(i) {
    index = i;
    note = '';
    renderFrame();
  }

  store.on('select', ({ id, source }) => {
    if (!frames.length || source === 'map' || source === 'event') return highlight();
    const picked = frameFor(model.get(id));
    const i = frames.indexOf(picked.frame);
    if (i !== index) {
      index = i;
      renderFrame();
    }
    note = picked.note;
    renderSide(frames[index]);
    highlight();
  });

  // ---------- 加载（网络不稳时自动重试，仍失败则提供重试按钮） ----------
  const fetchData = (tries = RETRIES) =>
    fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .catch((err) => {
        if (tries <= 0) throw err;
        return new Promise((ok) => setTimeout(ok, 1200)).then(() => fetchData(tries - 1));
      });

  const load = () => fetchData()
    .then((data) => {
      frames = [...data.frames, MODERN_FRAME];
      full = [0, 0, data.width, data.height];
      view = full;
      svg.setAttribute('viewBox', full.join(' '));
      svg.innerHTML = `<defs>${patterns()}</defs><rect class="sea" width="100%" height="100%"/>
        <path class="land" d="${data.base}"/><g class="frame"></g>`;
      slider.max = frames.length - 1;
      root.querySelector('#map-count').textContent = ` ${data.frames.length} `;
      dots.innerHTML = frames
        .map((f, i) => `<button data-i="${i}" style="--c:${colorOf(f.focus)}" title="${f.modern ? '1912年以后' : formatYear(f.year)} ${f.title}" aria-label="${f.title}"></button>`)
        .join('');
      root.classList.remove('loading');
      const current = store.state.selectedId && model.get(store.state.selectedId);
      if (current) {
        const picked = frameFor(current);
        index = frames.indexOf(picked.frame);
        note = picked.note;
      }
      renderFrame();
      // 地图数据加载前已打开的事件（如通过 #e-qing-1894 链接进入）
      const ev = store.state.eventId && model.event(store.state.eventId);
      if (ev) focusYear(ev.year, ev.dynasty.id);
    })
    .catch(() => {
      root.classList.remove('loading');
      side.innerHTML = `<p class="m-desc">地图数据加载失败，可能是网络不稳定。</p>
        <button class="m-focus m-retry">重新加载地图</button>
        <p class="m-note">若直接用浏览器打开本地文件，请改用本地服务器预览（见 README）。</p>`;
      side.querySelector('.m-retry').addEventListener('click', () => {
        root.classList.add('loading');
        side.innerHTML = '';
        load();
      });
    });
  return load();
}

