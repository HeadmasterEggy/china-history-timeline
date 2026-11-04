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
import { createEventCard } from './components/eventCard.js';
import { createSidebar } from './components/sidebar.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_ID = 'tang';

const store = createStore();

createSidebar($('sidebar'), $('sb-toggle'), model, store);
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
createEventCard($('event-dialog'), model, store);
createPeopleIndex($('people'), model, store, {
  onPick: () => $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }),
});

// ---------- 网址锚点：#tang 之类可直接分享某个朝代 ----------
store.on('select', ({ id }) => {
  if (store.state.eventId) return; // 事件弹窗打开时由弹窗管理地址
  try {
    history.replaceState(null, '', `#${id}`);
  } catch {
    /* 某些嵌入环境不允许修改地址 */
  }
});
// #tang 打开朝代；#e-qing-1840 打开事件
const fromHash = () => location.hash.slice(1);
function openFromHash() {
  const h = fromHash();
  if (h.startsWith('e-') && model.event(h.slice(2))) {
    if (store.state.eventId !== h.slice(2)) store.openEvent(h.slice(2));
  } else if (model.get(h) && h !== store.state.selectedId) {
    store.select(h, { source: 'hash' });
  }
}
window.addEventListener('hashchange', openFromHash);

// ---------- 键盘 ← → 切换相邻朝代 ----------
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input') || !store.state.selectedId || store.state.eventId) return;
  const { prev, next } = model.neighbors(model.get(store.state.selectedId));
  const target = { ArrowLeft: prev, ArrowRight: next }[e.key];
  if (!target) return;
  store.select(target.id, { source: 'keyboard' });
  e.preventDefault();
});

const initial = fromHash();
const initialEvent = initial.startsWith('e-') ? model.event(initial.slice(2)) : null;
store.select(initialEvent?.dynasty.id ?? (model.get(initial) ? initial : DEFAULT_ID), { source: 'init' });
if (initialEvent) store.openEvent(initialEvent.id);
