// 极简的全局状态：当前选中的朝代与搜索结果。各组件订阅变化，彼此不直接调用。
//
// 事件：
//   'select'  { id, source, center }   source 标明是谁发起的，避免组件之间来回触发
//   'search'  { query, matches }       matches 为命中的朝代 id 集合，null 表示未搜索
//   'person'  { name }                 打开人物卡片（在 select 之后触发）
//   'event'   { id }                   打开事件详情
//   'focus-year' { year, dynastyId }   在时间轴和地图上定位到某一年

export function createStore() {
  const state = { selectedId: null, eventId: null, query: '', matches: null };
  const listeners = new Map();

  const emit = (type, payload) => (listeners.get(type) ?? []).forEach((fn) => fn(payload, state));

  return {
    state,
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    select(id, { source = 'unknown', center = true } = {}) {
      state.selectedId = id;
      emit('select', { id, source, center });
    },
    /** 选中人物所在的朝代并打开其人物卡片 */
    openPerson(name, dynastyId) {
      this.select(dynastyId, { source: 'person' });
      emit('person', { name });
    },
    openEvent(id) {
      state.eventId = id;
      emit('event', { id });
    },
    closeEvent() {
      state.eventId = null;
      emit('event-close', {});
    },
    focusYear(year, dynastyId) {
      emit('focus-year', { year, dynastyId });
    },
    search(query, matches) {
      state.query = query;
      state.matches = matches;
      emit('search', { query, matches });
    },
  };
}
