// 入口：创建数据模型与状态，挂载各组件，处理网址锚点与键盘导航

import { model } from './core/model.js';
import { createStore } from './core/store.js';
import { createHeader } from './components/header.js';
import { createTimeline } from './components/timeline.js';
import { createMinimap } from './components/minimap.js';
import { createEraNav, createSearch } from './components/toolbar.js';
import { createDetail } from './components/detail.js';
import { createList } from './components/list.js';
import { createTerritoryMap } from './components/territoryMap.js';
import { createPeopleIndex } from './components/peopleIndex.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_ID = 'tang';

const store = createStore();

createHeader($('facts'), model);
const timeline = createTimeline(
  { scrollEl: $('scroll'), zoomInput: $('zoom'), zoomIn: $('zin'), zoomOut: $('zout') },
  model,
  store,
);
createMinimap($('mini'), model, timeline);
createEraNav($('eras'), model, store, timeline);
createSearch($('q'), $('qinfo'), model, store);
createDetail($('detail'), model, store);
createList($('list'), model, store, {
  onPick: () => $('scroll').scrollIntoView({ behavior: 'smooth', block: 'center' }),
});
createTerritoryMap($('map'), model, store);
createPeopleIndex($('people'), model, store, {
  onPick: () => $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }),
});

// ---------- 网址锚点：#tang 之类可直接分享某个朝代 ----------
store.on('select', ({ id }) => {
  try {
    history.replaceState(null, '', `#${id}`);
  } catch {
    /* 某些嵌入环境不允许修改地址 */
  }
});
const fromHash = () => location.hash.slice(1);
window.addEventListener('hashchange', () => {
  const id = fromHash();
  if (model.get(id) && id !== store.state.selectedId) store.select(id, { source: 'hash' });
});

// ---------- 键盘 ← → 切换相邻朝代 ----------
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input') || !store.state.selectedId) return;
  const { prev, next } = model.neighbors(model.get(store.state.selectedId));
  const target = { ArrowLeft: prev, ArrowRight: next }[e.key];
  if (!target) return;
  store.select(target.id, { source: 'keyboard' });
  e.preventDefault();
});

store.select(model.get(fromHash()) ? fromHash() : DEFAULT_ID, { source: 'init' });
