// 时间轴底部的"分与合"色带：[起, 止, 类型, 名称]
// 类型：royal 王朝共主；unified 大一统；loose 统一但地方割据；divided 分裂并立
export const UNITY = [
  [-2070, -771, 'royal', '夏商西周 · 王朝共主'],
  [-770, -221, 'divided', '春秋战国 · 列国纷争'],
  [-221, -207, 'unified', '秦'],
  [-206, -202, 'divided', '楚汉'],
  [-202, 190, 'unified', '两汉'],
  [190, 280, 'divided', '汉末三国'],
  [280, 304, 'unified', '西晋'],
  [304, 589, 'divided', '东晋十六国 · 南北朝'],
  [589, 755, 'unified', '隋唐前期'],
  [755, 907, 'loose', '藩镇割据'],
  [907, 979, 'divided', '五代十国'],
  [979, 1279, 'divided', '宋辽夏金并立'],
  [1279, 1368, 'unified', '元'],
  [1368, 1644, 'unified', '明'],
  [1644, 1912, 'unified', '清'],
];

export const UNITY_TYPES = {
  royal: '王朝共主',
  unified: '大一统',
  loose: '统一·地方割据',
  divided: '分裂并立',
};
