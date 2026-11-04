// 重大事件详情，按时期分文件存放。
//
// 键为事件 id：朝代 id-年份（公元前写作 b260），对应该朝代大事记中这一年的第一条事件。
// 字段：title 标题；span 起止；bg 背景；steps 经过 [时间, 事件]；result 结果；impact 影响；
//       people 相关人物（需在 data/people.js 中有简介）；
//       refs 延伸阅读：sources 原始史料（链接到维基文库），books 推荐书籍 [书名, 作者]（链接到豆瓣读书）
//
// 查看哪些事件还没有详情：npm run coverage

import xianqin from './xianqin.js';
import qinhan from './qinhan.js';
import weijin from './weijin.js';
import suitang from './suitang.js';
import songyuan from './songyuan.js';
import mingqing from './mingqing.js';
import modern from './modern.js';

export const EVENT_DETAILS = { ...xianqin, ...qinhan, ...weijin, ...suitang, ...songyuan, ...mingqing, ...modern };
