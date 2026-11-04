// 由 index.html 拆分；年份为负数表示公元前
// 七个历史时期，色彩对应 css/tokens.css 中的 --e-<id>
export const ERAS=[
  {id:'xianqin',name:'先秦',s:-2070,e:-221},
  {id:'qinhan',name:'秦汉',s:-221,e:220},
  {id:'weijin',name:'魏晋南北朝',s:220,e:581},
  {id:'suitang',name:'隋唐五代',s:581,e:960},
  {id:'songyuan',name:'宋元',s:960,e:1368},
  {id:'mingqing',name:'明清',s:1368,e:1912},
  {id:'modern',name:'近现代',s:1912,e:2026}
];

export const NOW = 2026;
