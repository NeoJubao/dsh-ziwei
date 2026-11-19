/* 10-i18n：界面字典和 t()
 * DICT 由 build.mjs 从 i18n/NN-*.json 生成：{ 'zh-CN': {...}, 'en-US': {...} }，一个键的中英文写在一起。
 * apply() 把字典登记进宿主的 locale 服务，并用 setTranslator() 换上它 bind 出来的翻译函数；
 * 服务不可用时 t() 查内置中文。vars 里的 {name} 按名字替换。 */
const DICT = /*__ZIWEI_DICT__*/{};
let boundT = null;

function setTranslator(fn) {
  boundT = typeof fn === 'function' ? fn : null;
}

function t(key, vars) {
  let s;
  if (boundT) {
    try { s = boundT(key); } catch (e) { s = undefined; }
  }
  if (typeof s !== 'string') s = DICT['zh-CN'][key] !== undefined ? DICT['zh-CN'][key] : key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, function (m, name) { return vars[name] !== undefined ? String(vars[name]) : m; });
  }
  return s;
}
