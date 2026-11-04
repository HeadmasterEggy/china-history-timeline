// 外部链接：百科、古籍原文与书籍检索。均为搜索链接，词条存在时会直接跳到条目。

const q = encodeURIComponent;

export const links = {
  wikipedia: (term) => `https://zh.wikipedia.org/w/index.php?search=${q(term)}`,
  baike: (term) => `https://baike.baidu.com/search/word?word=${q(term)}`,
  wikisource: (term) => `https://zh.wikisource.org/w/index.php?search=${q(term.replace(/·/g, ' '))}`,
  douban: (term) => `https://search.douban.com/book/subject_search?search_text=${q(term)}`,
};

/** 一组百科链接（维基百科 + 百度百科） */
export function encyclopediaLinks(term) {
  return `<span class="ext-links">
    <a href="${links.wikipedia(term)}" target="_blank" rel="noopener">维基百科</a>
    <a href="${links.baike(term)}" target="_blank" rel="noopener">百度百科</a>
  </span>`;
}

/** 史料原文（维基文库） */
export const sourceLink = (title) =>
  `<a class="ext-source" href="${links.wikisource(title)}" target="_blank" rel="noopener">《${title}》</a>`;

/** 推荐书籍（豆瓣读书） */
export const bookLink = ([title, author]) =>
  `<a class="ext-book" href="${links.douban(title)}" target="_blank" rel="noopener">《${title}》<small>${author}</small></a>`;

/** 事件的检索词：有详情用标题，否则取事件描述的主干 */
export function eventTerm(ev) {
  if (ev.detail) return ev.detail.title;
  const main = ev.text.replace(/（.*?）/g, '').split(/[；，]/)[0];
  return main.length >= 3 ? main : ev.text;
}
