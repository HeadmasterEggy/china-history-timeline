// 卷首统计数字

export function createHeader(el, model) {
  const { years, regimes, events } = model.stats();
  const fact = (value, label) => `<div class="fact"><b>${value}</b><span>${label}</span></div>`;
  el.innerHTML = fact(years, '年 · 自夏朝至今') + fact(regimes, '个收录政权') + fact(events, '条大事记');
}
