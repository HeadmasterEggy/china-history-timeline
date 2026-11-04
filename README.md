# 华夏历史长卷

可视化中国历史的静态网页：从夏朝（约前2070年）到今天，按真实年份比例把 52 个政权排在一条可拖动、可缩放的时间长卷上，并配有从夏朝到清末 31 个时间节点的疆域演变地图。

在线访问：<http://qiao1.top/china-history-timeline/>

## 功能

- **长卷时间轴**：并列泳道表示同一时期并存的政权（三国、南北朝、宋辽金夏等）；顶部标出 25 个大事件，底部色带标示"大一统 / 分裂并立"。
- **朝代详情**：建立者、都城、君主、同期政权、代表人物、大事记、制度与文化成就、衰亡原因、成语典故。
- **事件详情**：大事记中每一条都可点击，查看相关人物、同一时期的大事，并在时间轴和地图上定位；鸦片战争、甲午战争等重大事件附有背景、经过、结果与影响。链接 `#e-qing-1894` 可直接打开某个事件。
- **历史人物**：247 位人物的生卒年、身份与简介，可在朝代详情中点击姓名查看，或在人物索引中按时期浏览。
- **疆域演变地图**：播放或拖动查看各时期政权范围，与时间轴选中的朝代双向联动。
- 全景缩略条、时期快速跳转、缩放（Ctrl/⌘ + 滚轮）、全文搜索、键盘 ← → 切换、`#tang` 式分享链接、浅色/深色模式、手机适配。

## 本地预览

页面使用 ES 模块并加载 JSON 地图数据，需要通过本地服务器打开（直接双击 `index.html` 地图无法加载）：

```bash
npm run serve        # 等同于 python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

无需安装依赖，无构建步骤。

## 目录结构

```
index.html              页面结构
css/
  tokens.css            配色（浅色/深色）、字体等设计变量
  base.css              基础样式、卷首、工具条
  timeline.css          全景缩略条、长卷时间轴、分合色带
  detail.css            朝代详情
  map.css               疆域演变地图
  people.css            历史人物索引
  event.css             事件详情弹窗
  list.css              历代一览
js/
  main.js               入口：挂载组件、网址锚点、键盘导航
  core/
    model.js            合并数据并提供查询（相邻朝代、同期政权、搜索）
    store.js            全局状态（选中朝代、搜索结果），组件通过订阅联动
    format.js           年份与文本格式化
  components/
    header.js           卷首统计
    timeline.js         长卷时间轴（绘制、缩放、拖动）
    minimap.js          全景缩略条
    toolbar.js          时期跳转与搜索
    detail.js           朝代详情
    territoryMap.js     疆域演变地图
    peopleIndex.js      历史人物索引
    eventCard.js        事件详情弹窗
    list.js             历代一览
data/
  eras.js               七个历史时期
  dynasties.js          政权基础数据（起止、泳道、都城、大事、人物）
  details.js            补充资料（君主、成就、衰亡原因、更多大事）
  idioms.js             出自各朝的成语典故
  people.js             人物简介（生卒、身份、简介）
  events.js             重大事件详情（背景、经过、结果、影响）
  milestones.js         时间轴顶部的大事件
  unity.js              分合色带
  map/borders.json      地图数据（由脚本生成）
scripts/
  build_map.py          生成地图数据
  check-data.js         数据自检
```

## 修改数据

- 改朝代内容：编辑 `data/dynasties.js` 或 `data/details.js`，然后运行 `npm run check` 检查泳道重叠、年份范围和引用是否正确。
- 改地图：编辑 `scripts/build_map.py` 里的 `FRAMES` 配置（每一帧的政权归属与中文名），再运行：

```bash
npm run build:map -- <historical-basemaps 仓库中 geojson 目录的路径>
```

## 数据来源与说明

- 年代采用通行说法，上古年代依据"夏商周断代工程"等研究，均为约数；部分政权起止年存在不同观点。
- 地图边界改编自 [historical-basemaps](https://github.com/aourednik/historical-basemaps)（A. Ourednik，GPL-3.0）。原始数据中东亚部分有命名错误，本项目逐帧人工校订了政权归属与中文名称；`data/map/borders.json` 作为其衍生数据，同样以 GPL-3.0 发布。
- 地图为示意图，非标准地图，疆界为近似范围。1912 年以后的中国疆域不在此绘制，请以自然资源部[标准地图服务](https://bzdt.ch.mnr.gov.cn/)为准。
