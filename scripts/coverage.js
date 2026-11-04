// 事件详情覆盖情况：按时期统计，并列出尚未撰写详情的事件
// 用法：npm run coverage            只看统计
//       npm run coverage -- 先秦     列出该时期缺少详情的事件（可写时期名或 id，如 xianqin）

import { model } from '../js/core/model.js';

const filter = process.argv[2];
// 指向其他事件的别名也算已覆盖
let total = 0;
let done = 0;
for (const era of model.eras) {
  const events = model.ordered.filter((d) => d.era === era.id).flatMap((d) => d.events);
  const missing = events.filter((e) => !e.detail);
  total += events.length;
  done += events.length - missing.length;
  console.log(`${era.name.padEnd(6, '　')} ${String(events.length - missing.length).padStart(3)} / ${events.length}`);
  if (filter && (filter === era.id || filter === era.name))
    for (const e of missing) console.log(`    ${e.id.padEnd(18)} ${e.text}`);
}
console.log(`合计      ${done} / ${total}（${Math.round((done / total) * 100)}%）`);
