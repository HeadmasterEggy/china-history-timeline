// 极简的全局状态：当前选中的朝代与搜索结果。各组件订阅变化，彼此不直接调用。
//
// 事件：
//   'select'  { id, source, center }   source 标明是谁发起的，避免组件之间来回触发
//   'search'  { query, matches }       matches 为命中的朝代 id 集合，null 表示未搜索

export function createStore() {
  const state = { selectedId: null, query: '', matches: null };
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
    search(query, matches) {
      state.query = query;
      state.matches = matches;
      emit('search', { query, matches });
    },
  };
}
