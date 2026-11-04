// 疆域演变地图：按年份切换各时期的政权范围，并与时间轴选中的朝代联动
// 数据由 scripts/build_map.py 生成（data/map/borders.json）

import { formatYear, eraColor } from '../core/format.js';

const DATA_URL = new URL('../../data/map/borders.json', import.meta.url);
const PLAY_INTERVAL = 2200;

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

  const colorOf = (id) => eraColor(model.get(id)?.era ?? 'modern');

  // ---------- 绘制 ----------
  function patterns() {
    return model.eras
      .map((e) => `<pattern id="hatch-${e.id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill="var(--map-land)"/><line x1="0" y1="0" x2="0" y2="7" stroke="${eraColor(e.id)}" stroke-width="3"/></pattern>`)
      .join('');
  }

  function shapeSVG(s) {
    const c = s.id ? colorOf(s.id) : 'var(--muted)';
    const era = model.get(s.id)?.era;
    const fill = s.role === 'adm' ? `fill="url(#hatch-${era})"` : '';
    return `<path class="shape ${s.role}" ${s.id ? `data-id="${s.id}"` : ''} style="--c:${c}" ${fill} d="${s.d}">
      <title>${s.label || ROLE_LABEL[s.role]}</title></path>`;
  }

  /** 区域标签；若与都城标记过近则向下让开，避免遮挡 */
  function labelSVG(s, capitals) {
    if (!s.label) return '';
    let y = s.ly;
    const halfW = s.label.length * (s.big ? 14 : 8);
    for (let tries = 0; tries < 4; tries++) {
      const hit = capitals.some((c) => Math.abs(c.y - y) < (s.big ? 22 : 14) && c.x > s.lx - halfW - 50 && c.x < s.lx + halfW);
      if (!hit) break;
      y += s.big ? 30 : 18;
    }
    const cls = `lbl ${s.role}${s.big ? ' big' : ''}`;
    return `<text class="${cls}" x="${s.lx}" y="${y}" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`;
  }

  /** 都城：第一个为中原王朝都城，用实心方块，其余用圆点 */
  function capitalSVG(c, i) {
    const mark = i === 0
      ? `<rect x="${c.x - 4}" y="${c.y - 4}" width="8" height="8" transform="rotate(45 ${c.x} ${c.y})"/>`
      : `<circle cx="${c.x}" cy="${c.y}" r="3.5"/>`;
    return `<g class="cap${i === 0 ? ' prime' : ''}"><title>都城：${c.name}</title>${mark}
      <text x="${c.x + 8}" y="${c.y}" dominant-baseline="middle">${c.name}</text></g>`;
  }

  function renderFrame() {
    const f = frames[index];
    const layer = svg.querySelector('.frame');
    const capitals = f.capitals ?? [];
    layer.innerHTML = f.shapes.map(shapeSVG).join('') + f.shapes.map((s) => labelSVG(s, capitals)).join('')
      + capitals.map(capitalSVG).join('');
    layer.classList.remove('fade');
    void layer.getBoundingClientRect();
    layer.classList.add('fade');
    modernNote.hidden = !f.modern;
    slider.value = index;
    dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === index));
    renderSide(f);
    highlight();
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
  function goTo(i, { fromUser = false } = {}) {
    index = Math.max(0, Math.min(frames.length - 1, i));
    note = '';
    renderFrame();
    if (fromUser) store.select(frames[index].focus, { source: 'map' });
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
    if (t) store.select(t.dataset.id, { source: 'map-shape' });
  });

  store.on('select', ({ id, source }) => {
    if (!frames.length || source === 'map') return highlight();
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

  // ---------- 加载 ----------
  return fetch(DATA_URL)
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((data) => {
      frames = [...data.frames, MODERN_FRAME];
      svg.setAttribute('viewBox', `0 0 ${data.width} ${data.height}`);
      svg.innerHTML = `<defs>${patterns()}</defs><rect class="sea" width="100%" height="100%"/>
        <path class="land" d="${data.base}"/><g class="frame"></g>`;
      slider.max = frames.length - 1;
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
    })
    .catch(() => {
      root.classList.remove('loading');
      side.innerHTML = '<p class="m-desc">地图数据加载失败。若直接用浏览器打开本地文件，请改用本地服务器预览（见 README）。</p>';
    });
}

