// 年份与文本格式化工具

/** -221 → "前221年"，618 → "618年" */
export const formatYear = (y) => (y < 0 ? `前${-y}年` : `${y}年`);

/** 刻度用的短格式：-500 → "前500"，0 → "公元元年" */
export const formatTick = (y) => (y === 0 ? '公元元年' : y < 0 ? `前${-y}` : `${y}`);

/** 朝代起止："约前2070年 – 前1600年" */
export const formatSpan = (d) =>
  `${d.approx ? '约' : ''}${formatYear(d.s)} – ${d.open ? '今' : formatYear(d.e)}`;

/** 存续年数（历史纪年没有公元 0 年） */
export const duration = (d) => d.e - d.s + (d.s < 0 && d.e > 0 ? -1 : 0);

/** 时期色彩的 CSS 变量 */
export const eraColor = (eraId) => `var(--e-${eraId})`;

/** 朝代在时间轴上的实际绘制起点 */
export const drawStart = (d) => d.ds ?? d.s;
