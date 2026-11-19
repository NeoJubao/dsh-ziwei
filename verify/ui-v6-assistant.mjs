/**
 * verify/ui-v6-assistant.mjs — 紫微师面板（80-assistant.js，T6）
 *
 * 由 verify/ui-v6.mjs 调用（不单独运行）。用 client-harness 的极简 React 运行时真挂载 ProApp（effect 会跑、
 * setState 会重渲染、有假 DOM 和焦点），通过 store 的动作改状态，在树上断言。覆盖 plan T6 的检查：
 *   - 宽档是并排的 aside（没有 role=dialog、没有遮罩）；中、窄档有遮罩、role=dialog、aria-modal、名字、焦点陷阱，
 *     点遮罩关、Esc 由 ProApp 关（输入法组字时不关）
 *   - 打开面板不发请求；空态：一句话、速览（本地算的，不是气泡）、起手动作、三个示例问题
 *   - 对话区 div.zp-chat-thread[role=log][aria-live=polite]，流式时 aria-busy；输入指示（思考 / 回答）；
 *     空回答不出空气泡；生成中发送键换成停止键
 *   - 错误条：可接着写的给「接着写」，其余给「重试」（重试不重复用户气泡）
 *   - 时间卡提问带定位、气泡只显示看得见的那句；自己打的问题不带定位；「问这一宫」带 palaceQuoteText
 *   - 报告引用截到 600 字、发出后清掉；引用条可以取消
 *   - 新对话可撤销；在新会话里继续的请求字段和 v5 一样
 *   - 草稿按盘放在 store 里：关面板再开、面板卸载再挂载都还在，不写进存储；Enter 发送、Shift+Enter 换行、组字时不发
 *   - 离底部 48px 以内才跟随
 *   - 流式代价：前面的消息的 __html 对象不变；头部、上下文行、输入框、速览不跟着增量重渲染
 *   - 面板关着时答完：提示带「查看」，点了打开面板；报告写完后的四个追问建议
 *   - 源码：注释以外没有中文字面量；字典里的键都被引用
 * 只用黄金用例（1992-05-03 09:30，男，经度 105.97）。"今天"固定为 2026-11-19。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bootRuntime, classesOf, find, findByClass, memoryStorage, settle, text } from './client-harness.mjs';

const GOLDEN = {
  name: '', calendar: 'solar', year: 1992, month: 5, day: 3, isLeap: false, hour: 9, minute: 30, gender: 'male',
  longitude: '105.97', city: '', place: '', occupation: '',
  settings: { yearDivide: 'normal', monthDivide: 'exact', dayDivide: 'current', fixLeap: true }
};
const NOW = new Date(2026, 10, 19, 10, 0, 0).getTime();
const J = (v) => JSON.stringify(v);

const ZH = {
  title: '紫微师',
  context: '甲 · 木三局 · 命宫 癸丑',
  l1: '想问什么，直接说。',
  quickHeads: ['命宫', '格局', '这十年', '今天'],
  quickLines: [
    '命宫在癸丑，坐太阳、太阴。光明之星，主名声、公益与付出。坐命者热情坦荡、乐于助人；庙旺显达，落陷则劳碌。',
    '日月同宫：日月同守一宫（丑未），性格刚柔并济，早年顺遂，得父母长辈之荫。',
    '双禄交流：禄存与化禄同宫或对拱，财禄双美，进财顺遂，理财有方。',
    '现在走田宅大限（33–42 岁），重心在家和住处。',
    '流日命宫在父母，太阴化禄、巨门化忌；重心在长辈与文书。'
  ],
  starts: ['读这张盘', '写完整报告'],
  openReport: '查看完整报告',
  examples: ['今年事业怎么样', '这十年感情要注意什么', '我适合做什么工作'],
  suggestions: ['重点讲事业与财运', '这十年感情要注意什么', '说得再通俗一点', '讲讲我选的这一宫'],
  inputLabel: '问紫微师',
  placeholder: '问紫微师',
  waitChat: '正在回答，写完再问下一个',
  send: '发送',
  stop: '停止',
  close: '关闭',
  newChat: '新对话',
  handoff: '在新会话里继续',
  thinking: '紫微师正在思考…',
  writing: '正在回答…',
  reportRunning: '完整报告正在写，在「报告」里看进度',
  cont: '接着写',
  retry: '重试',
  stopped: '已停止，内容可能不完整，可以接着写',
  stoppedEmpty: '已停止',
  disconnected: '连接断了，内容可能不完整，可以接着写',
  quoteRemove: '取消引用',
  disclaimer: '传统文化解读，仅供参考，不构成专业建议',
  continuePrompt: '请接着上文继续写：从断处接着写，不要重复已写内容，也不要重新开头。',
  quoteDefault: '请针对这段展开说说。',
  cleared: '已清空对话',
  undo: '撤销',
  answerReady: '紫微师回答好了',
  view: '查看'
};

const attr = (el, k) => (el && el.props ? el.props[k] : undefined);
const one = (tree, cls) => findByClass(tree, cls)[0] || null;
const buttons = (tree) => find(tree, (n) => n.type === 'button');
const byLabel = (tree, label) => buttons(tree).find((n) => attr(n, 'aria-label') === label || text(n) === label) || null;
const labelOf = (n) => attr(n, 'aria-label') || text(n);

export default async function assistantChecks(t) {
  const { ok, section } = t;
  const eq = (name, got, want) => ok(name, J(got) === J(want), `got ${J(got)} want ${J(want)}`);
  const safe = async (name, fn) => {
    try { await fn(); } catch (e) { ok(name, false, 'threw: ' + String((e && e.stack) || e).split('\n').slice(0, 4).join(' | ')); }
  };

  /* ---------------------------------------------------------------- */
  section('紫微师：源码');
  const src = readFileSync(join(t.root, 'src', 'ui', '80-assistant.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  ok('80-assistant.js 注释以外没有中文字面量', !/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/.test(code));
  let dict = {};
  try { dict = JSON.parse(readFileSync(join(t.root, 'src', 'ui', 'i18n', '80-assistant.json'), 'utf8')); } catch { dict = {}; }
  const keys = Object.keys(dict);
  ok('i18n/80-assistant.json 有键，且都以 as 开头', keys.length > 0 && keys.every((k) => /^as[A-Z0-9]/.test(k)), keys.filter((k) => !/^as[A-Z0-9]/.test(k)).join(', '));
  const unused = keys.filter((k) => !code.includes(`'${k}'`));
  ok('字典里的每个键都在 80-assistant.js 里被引用', keys.length > 0 && unused.length === 0, 'unused: ' + unused.join(', '));
  ok('80-assistant.js 定义 function AssistantPanel', /^function AssistantPanel\(/m.test(src));
  ok('顶层名字都以 Assistant / as / AS_ 开头',
    [...src.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].every((m) => /^(Assistant|as[A-Z]|AS_)/.test(m[1])),
    [...src.matchAll(/^(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]).filter((n) => !/^(Assistant|as[A-Z]|AS_)/.test(n)).join(', '));

  /* ---------------------------------------------------------------- */
  section('紫微师：装载（极简 React 运行时）');
  const storage = memoryStorage();
  const env = t.client ? bootRuntime(t.client, { now: NOW, storage }) : { error: new Error('没有 v6 bundle') };
  ok('v6 bundle 在运行时里装载、apply()、建默认 store', !env.error, env.error && env.error.message);
  if (env.error) return;
  const { rt, store, h, pipe, win } = env;
  const ZW = win.ZWUi;
  const entry = store.addChart(GOLDEN, '甲');
  store.openChart(entry.id);
  const chart = store.currentChart();

  const tree = () => rt.tree();
  const panel = (tr = tree()) => one(tr, 'zp-assistant');
  const log = (tr = tree()) => one(tr, 'zp-chat-thread');
  const ta = (tr = tree()) => find(panel(tr), (n) => n.type === 'textarea')[0] || null;
  const sendBtn = (tr = tree()) => one(panel(tr), 'zp-send');
  const last = () => pipe.calls[pipe.calls.length - 1];
  const interpretCalls = () => pipe.calls.filter((c) => c.url === '/ziwei/interpret');
  const meTexts = (tr = tree()) => findByClass(log(tr), 'zp-me').map((n) => text(n.children.filter((c) => !(c && c.type === 'q'))));
  const botCount = (tr = tree()) => findByClass(log(tr), 'zp-bot').length;
  const typing = (tr = tree()) => one(log(tr), 'zp-typing');
  const errBar = (tr = tree()) => one(panel(tr), 'zp-as-error');
  const step = async (n = 6) => { await settle(n); rt.flush(); };
  const typeDraft = (value) => { ta().props.onChange({ target: { value } }); rt.flush(); };
  const finish = async (p, body = '好') => { p.send('done', { text: body }).end(); await step(); };
  const mount = (width) => { rt.width = width; rt.mount(h(env.Main)); };
  const open = async () => { store.setPanel(true); rt.flush(); await step(); };

  /* ---------------------------------------------------------------- */
  section('紫微师：开合与三档');
  await safe('宽档', async () => {
    mount(1300);
    eq('面板关着：不渲染 aside.zp-assistant', panel(), null);
    const before = pipe.calls.length;
    await open();
    const a = panel();
    eq('宽档打开：aside.zp-assistant[data-region=ASSISTANT]，没有 role=dialog / aria-modal，没有遮罩',
      [a && a.type, attr(a, 'data-region'), attr(a, 'role'), attr(a, 'aria-modal'), findByClass(tree(), 'zp-as-mask').length],
      ['aside', 'ASSISTANT', undefined, undefined, 0]);
    eq('打开面板不发请求', pipe.calls.length - before, 0);
    ok('打开面板：焦点在输入框', !!ta() && rt.doc.activeElement === ta().node);
    rt.click(byLabel(panel(), ZH.close));
    eq('点「关闭」：面板关上、aside 不在了', [store.getState().session.panelOpen, panel()], [false, null]);
    eq('开、关都不发请求', pipe.calls.length - before, 0);
    rt.unmount();
  });

  for (const [tier, width] of [['中档', 900], ['窄档', 500]]) {
    await safe(tier, async () => {
      mount(width);
      const before = pipe.calls.length;
      await open();
      const a = panel();
      eq(`${tier}：遮罩 div.zp-as-mask + aside[role=dialog][aria-modal=true][aria-label=紫微师]`,
        [findByClass(tree(), 'zp-as-mask').length, attr(a, 'role'), attr(a, 'aria-modal'), attr(a, 'aria-label'), attr(a, 'data-region')],
        [1, 'dialog', 'true', ZH.title, 'ASSISTANT']);
      eq(`${tier}：打开不发请求`, pipe.calls.length - before, 0);
      ok(`${tier}：焦点进了面板`, a.node.contains(rt.doc.activeElement));
      const list = win.ZWUi.parts.focusablesIn(a.node);
      list[list.length - 1].focus();
      rt.key(list[list.length - 1], 'Tab');
      ok(`${tier}：焦点陷阱（最后一个控件上 Tab 回到第一个）`, list.length > 2 && rt.doc.activeElement === list[0]);
      rt.key(list[0], 'Tab', { shiftKey: true });
      ok(`${tier}：第一个控件上 Shift+Tab 到最后一个`, rt.doc.activeElement === list[list.length - 1]);
      rt.key(ta(), 'Escape', { isComposing: true });
      eq(`${tier}：输入法组字时的 Esc 不关面板`, store.getState().session.panelOpen, true);
      const r = rt.key(ta(), 'Escape');
      eq(`${tier}：Esc 关面板（由 ProApp 处理）`, [store.getState().session.panelOpen, panel()], [false, null]);
      ok(`${tier}：Esc 一路冒泡到 ProApp 才停`, r.stopped === true);
      await open();
      rt.click(one(tree(), 'zp-as-mask'));
      eq(`${tier}：点遮罩关面板`, store.getState().session.panelOpen, false);
      rt.unmount();
    });
  }

  /* ---------------------------------------------------------------- */
  section('紫微师：空态');
  await safe('空态', async () => {
    mount(1300);
    await open();
    const a = panel();
    const head = one(a, 'zp-as-head');
    eq('头部：header.zp-as-head > b「紫微师」、small 上下文（盘名 · 五行局 · 选中的宫）',
      [head && head.type, text(find(head, (n) => n.type === 'b')[0]), text(find(head, (n) => n.type === 'small')[0])],
      ['header', ZH.title, ZH.context]);
    eq('头部动作：没有对话时没有「新对话」；有「在新会话里继续」和「关闭」',
      buttons(one(head, 'zp-as-actions')).map(labelOf), [ZH.handoff, ZH.close]);
    const lg = log();
    eq('对话区：div.zp-chat-thread[role=log][aria-live=polite][aria-busy=false]',
      [lg && lg.type, attr(lg, 'role'), attr(lg, 'aria-live'), attr(lg, 'aria-busy')], ['div', 'log', 'polite', 'false']);
    const empty = one(lg, 'zp-as-empty');
    ok('空着：对话区里是 div.zp-as-empty', !!empty);
    eq('一句话 p.zp-l1', text(one(empty, 'zp-l1')), ZH.l1);
    const quick = one(empty, 'zp-quick');
    eq('速览 section.zp-quick：小标题 命宫 / 格局 / 这十年 / 今天',
      [quick && quick.type, find(quick, (n) => n.type === 'h4').map(text)], ['section', ZH.quickHeads]);
    eq('速览的内容是 ZWUI.quickLook 本地算的（命宫主星和解释、两个格局、大限、流日）',
      find(quick, (n) => n.type === 'p').map(text), ZH.quickLines);
    ok('速览不是对话气泡（不在 .zp-msg 里，自己也不带 zp-msg）',
      findByClass(lg, 'zp-msg').length === 0 && !classesOf(quick).includes('zp-msg'));
    const starts = one(empty, 'zp-as-starts');
    eq('起手动作 div.zp-as-starts > button.zp-btn：读这张盘、写完整报告',
      buttons(starts).map((b) => [text(b), classesOf(b).includes('zp-btn')]), ZH.starts.map((s) => [s, true]));
    eq('三个示例问题 div.zp-suggest > button', buttons(one(empty, 'zp-suggest')).map(text), ZH.examples);
    eq('空态下没有错误条、追问建议、引用条',
      [errBar(), findByClass(a, 'zp-suggest').length, one(a, 'zp-quote')], [null, 1, null]);
    const form = one(a, 'zp-as-form');
    const area = ta();
    eq('输入框：form.zp-as-form > textarea（aria-label 问紫微师、占位文字）+ button.zp-send（发送，没字时禁用）',
      [form && form.type, attr(area, 'aria-label'), attr(area, 'placeholder'), attr(area, 'value'), attr(sendBtn(), 'aria-label'), !!attr(sendBtn(), 'disabled'), classesOf(sendBtn()).includes('zp-stop')],
      ['form', ZH.inputLabel, ZH.placeholder, '', ZH.send, true, false]);
    eq('免责声明 div.zp-as-foot', text(one(a, 'zp-as-foot')), ZH.disclaimer);
    const before = pipe.calls.length;
    rt.click(byLabel(starts, ZH.starts[1]));
    eq('点「写完整报告」：去报告页，不发请求；宽档面板留着',
      [store.getState().session.stage, pipe.calls.length - before, store.getState().session.panelOpen], ['report', 0, true]);
    store.setStage('board');
    rt.unmount();
    mount(900);
    await open();
    rt.click(byLabel(one(panel(), 'zp-as-starts'), ZH.starts[1]));
    eq('中档点「写完整报告」：去报告页，浮着的面板收起，不发请求',
      [store.getState().session.stage, store.getState().session.panelOpen, pipe.calls.length - before], ['report', false, 0]);
    store.setStage('board');
    rt.unmount();
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：读这张盘、输入指示、停止、接着写、重试');
  mount(1300);
  await open();
  await safe('读这张盘', async () => {
    const n0 = interpretCalls().length;
    rt.click(byLabel(one(panel(), 'zp-as-starts'), ZH.starts[0]));
    await step();
    const p = last();
    eq('点「读这张盘」：发一次 /ziwei/interpret，问题为空（速览）', [interpretCalls().length - n0, p.url, p.body.question], [1, '/ziwei/interpret', '']);
    eq('没有用户气泡；空态让位给输入指示', [meTexts(), one(log(), 'zp-as-empty'), !!typing()], [[], null, true]);
    eq('输入指示 div.zp-typing > span.zp-pulse + 「正在回答…」；对话区 aria-busy=true',
      [findByClass(typing(), 'zp-pulse').length, text(typing()), attr(log(), 'aria-busy')], [1, ZH.writing, 'true']);
    eq('生成中：发送键换成停止键 button.zp-send.zp-stop（aria-label 停止）',
      [classesOf(sendBtn()), attr(sendBtn(), 'aria-label'), !!attr(sendBtn(), 'disabled')], [['zp-send', 'zp-stop'], ZH.stop, false]);
    eq('生成中：「在新会话里继续」禁用', !!attr(byLabel(panel(), ZH.handoff), 'disabled'), true);
    p.send('thinking', { chars: 12 });
    await step();
    eq('思考中：「紫微师正在思考…」', text(typing()), ZH.thinking);
    p.send('delta', { text: '   ' });
    await step();
    eq('只收到空白：不出空气泡，输入指示还在（正在回答…）', [botCount(), text(typing())], [0, ZH.writing]);
    rt.click(sendBtn());
    await step();
    eq('点停止（还没写出字）：错误条「已停止」+「重试」，输入指示消失',
      [text(find(errBar(), (n) => n.type === 'span')[0]), buttons(errBar()).map(text), typing(), attr(log(), 'aria-busy')],
      [ZH.stoppedEmpty, [ZH.retry], null, 'false']);
    eq('停下后：停止键变回发送键', classesOf(sendBtn()), ['zp-send']);
    const n1 = interpretCalls().length;
    rt.click(byLabel(errBar(), ZH.retry));
    await step();
    const p2 = last();
    eq('点「重试」：同一个问题（空，速览）再问一次，不出用户气泡', [interpretCalls().length - n1, p2.body.question, meTexts()], [1, '', []]);
    eq('重试开始：错误条消失', errBar(), null);
    p2.send('delta', { text: '## 命宫\n太阳坐命' });
    await step();
    const bot = one(log(), 'zp-bot');
    const md = one(bot, 'zp-md');
    ok('回答 div.zp-msg.zp-bot > div.zp-md，走 mdToChatHtml（zp-md-h）',
      !!md && /class="zp-md-h zp-md-h2"/.test(String((attr(md, 'dangerouslySetInnerHTML') || {}).__html)));
    rt.click(sendBtn());
    await step();
    eq('写出字后停止：「已停止，内容可能不完整，可以接着写」+「接着写」',
      [text(find(errBar(), (n) => n.type === 'span')[0]), buttons(errBar()).map(text)], [ZH.stopped, [ZH.cont]]);
    const n2 = interpretCalls().length;
    rt.click(byLabel(errBar(), ZH.cont));
    await step();
    eq('点「接着写」：发续写请求（v5 的续写提示），错误条消失', [interpretCalls().length - n2, last().body.question, errBar()], [1, ZH.continuePrompt, null]);
    await finish(last(), '，接着写完。');
    eq('写完：一个回答气泡，输入指示消失，aria-busy=false', [botCount(), typing(), attr(log(), 'aria-busy')], [1, null, 'false']);
  });

  await safe('转义', async () => {
    store.ask('试一下');
    await step();
    const p = last();
    p.send('delta', { text: '<img src=x onerror=alert(1)>' });
    await step();
    const html = String((attr(findByClass(log(), 'zp-md').slice(-1)[0], 'dangerouslySetInnerHTML') || {}).__html);
    ok('回答里的尖括号被转义（不出 <img>）', !/<img/.test(html) && /&lt;img/.test(html), html);
    await finish(p, '<b>x</b>');
  });

  await safe('断连可接着写', async () => {
    typeDraft('今年事业怎么样');
    rt.key(ta(), 'Enter');
    await step();
    const p = last();
    eq('输入框里按 Enter：发出问题，气泡就是这句', [p.body.question, meTexts().slice(-1)], ['今年事业怎么样', ['今年事业怎么样']]);
    p.send('delta', { text: '写了一半' });
    await step();
    p.end();
    await step();
    eq('断连（已有正文）：「连接断了…可以接着写」+「接着写」',
      [text(find(errBar(), (n) => n.type === 'span')[0]), buttons(errBar()).map(text)], [ZH.disconnected, [ZH.cont]]);
    rt.click(byLabel(errBar(), ZH.cont));
    await step();
    await finish(last(), '写完了');
  });

  await safe('重试不重复气泡', async () => {
    typeDraft('我适合做什么工作');
    rt.key(ta(), 'Enter');
    await step();
    rt.click(sendBtn());
    await step();
    eq('没写出字就停：给「重试」', buttons(errBar()).map(text), [ZH.retry]);
    rt.click(byLabel(errBar(), ZH.retry));
    await step();
    eq('重试：同一个问题，对话里只有一个这句气泡', [last().body.question, meTexts().filter((x) => x === '我适合做什么工作').length], ['我适合做什么工作', 1]);
    await finish(last(), '答');
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：时间卡定位、问这一宫');
  let natalText = '';
  await safe('定位', async () => {
    natalText = interpretCalls().slice(-1)[0].body.chartText;
    store.setTab('daily');
    rt.flush();
    store.ask('今天怎么样', { scope: true });
    await step();
    const p = last();
    ok('时间卡提问（流日）：问题前面加了聚焦说明，命盘文字后面拼了定位',
      p.body.question !== '今天怎么样' && p.body.question.endsWith('\n今天怎么样') && p.body.chartText.length > natalText.length && p.body.chartText.startsWith(natalText));
    eq('气泡只显示看得见的那句', meTexts().slice(-1), ['今天怎么样']);
    await finish(p);
    typeDraft('流日怎么看');
    rt.key(ta(), 'Enter');
    await step();
    const p2 = last();
    eq('停在流日页签时自己打的问题：不带定位（问题原样、命盘文字不拼、meta 没有焦点）',
      [p2.body.question, p2.body.chartText === natalText, p2.body.meta.decadalFocus, p2.body.meta.yearlyFocus], ['流日怎么看', true, null, null]);
    await finish(p2);
    store.setTab('yearly');
    rt.flush();
    store.ask('今年怎么样', { scope: true });
    await step();
    ok('时间卡提问（流年）：带 meta.yearlyFocus', !!last().body.meta.yearlyFocus);
    eq('气泡只显示看得见的那句（流年）', meTexts().slice(-1), ['今年怎么样']);
    await finish(last());
  });

  await safe('问这一宫', async () => {
    store.setTab('natal');
    store.selectPalace(chart.soulIndex);
    rt.flush();
    eq('选中的宫换了：上下文行跟着换', text(find(one(panel(), 'zp-as-head'), (n) => n.type === 'small')[0]), ZH.context);
    const s = store.getState().session;
    const pal = chart.palaces[s.sel];
    const quoteText = ZW.palaceQuoteText(pal, '空宫');
    eq('黄金用例本命选中命宫：palaceQuoteText', quoteText, '命宫 癸丑 · 太阳、太阴');
    store.ask('讲讲我的命宫', { quote: { label: '这一宫', text: quoteText } });
    await step();
    eq('「问这一宫」：问题按 v5 的格式带上宫位引用', last().body.question, '【引用：这一宫】\n命宫 癸丑 · 太阳、太阴\n\n讲讲我的命宫');
    const me = findByClass(log(), 'zp-me').slice(-1)[0];
    eq('气泡：q 里是引用（标签：内容），正文是问的那句',
      [text(find(me, (n) => n.type === 'q')[0]), meTexts().slice(-1)[0]], ['这一宫：命宫 癸丑 · 太阳、太阴', '讲讲我的命宫']);
    await finish(last());
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：报告里的引用');
  await safe('引用', async () => {
    const long = '段'.repeat(700);
    store.setQuote({ label: '报告里的一段', text: long });
    rt.flush();
    eq('setQuote 截到 600 字', Array.from(store.getState().session.quote.text).length, 600);
    const chip = one(panel(), 'zp-quote');
    eq('引用条 div.zp-quote > span（标签：内容开头）+ 取消按钮',
      [text(find(chip, (n) => n.type === 'span')[0]).startsWith('报告里的一段：段段段'), buttons(chip).map((b) => attr(b, 'aria-label'))], [true, [ZH.quoteRemove]]);
    ok('有引用时没打字也能发', !attr(sendBtn(), 'disabled'));
    rt.click(byLabel(chip, ZH.quoteRemove));
    eq('点取消：引用清掉，引用条消失', [store.getState().session.quote, one(panel(), 'zp-quote')], [null, null]);
    store.setQuote({ label: '报告里的一段', text: long });
    rt.flush();
    typeDraft('这段什么意思');
    rt.click(sendBtn());
    await step();
    eq('发出：问题带上 600 字的引用和打的那句', last().body.question, '【引用：报告里的一段】\n' + '段'.repeat(600) + '\n\n这段什么意思');
    eq('发出后：引用清掉、引用条消失、草稿清空', [store.getState().session.quote, one(panel(), 'zp-quote'), store.draft(), attr(ta(), 'value')], [null, null, '', '']);
    const q = find(findByClass(log(), 'zp-me').slice(-1)[0], (n) => n.type === 'q')[0];
    eq('气泡里的引用截短显示', text(q), '报告里的一段：' + '段'.repeat(90) + '…');
    await finish(last());
    store.setQuote({ label: '报告里的一段', text: '短的一段' });
    rt.flush();
    rt.click(sendBtn());
    await step();
    eq('没打字直接发：用 v5 的默认问法', last().body.question, '【引用：报告里的一段】\n短的一段\n\n' + ZH.quoteDefault);
    await finish(last());
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：在新会话里继续、新对话');
  await safe('交接', async () => {
    const thread = store.reading().thread;
    rt.click(byLabel(panel(), ZH.handoff));
    const p = last();
    eq('交接：POST /ziwei/handoff，字段和 v5 一样，没有报告时 mode=brief',
      [p.url, Object.keys(p.body), p.body.mode, p.body.interpretation === thread[thread.length - 1].content],
      ['/ziwei/handoff', ['chartText', 'fullText', 'name', 'place', 'occupation', 'gender', 'interpretation', 'mode'], 'brief', true]);
    await step();
    store.dismissToast();
    rt.flush();
  });

  await safe('新对话', async () => {
    const before = store.reading().thread.length;
    const btn = byLabel(one(panel(), 'zp-as-actions'), ZH.newChat);
    ok('有对话时头部有「新对话」', !!btn && before > 0);
    rt.click(btn);
    eq('点「新对话」：对话清空、回到空态，提示可撤销',
      [store.reading().thread.length, !!one(log(), 'zp-as-empty'), store.getState().session.toast && store.getState().session.toast.text,
        buttons(one(tree(), 'zp-toast')).map(text)], [0, true, ZH.cleared, [ZH.undo]]);
    eq('清空后头部没有「新对话」', byLabel(one(panel(), 'zp-as-actions'), ZH.newChat), null);
    rt.click(byLabel(one(tree(), 'zp-toast'), ZH.undo));
    eq('点「撤销」：对话回来', store.reading().thread.length, before);
    store.dismissToast();
    store.ask('再问一句');
    await step();
    eq('生成中：「新对话」和「在新会话里继续」都禁用',
      [!!attr(byLabel(panel(), ZH.newChat), 'disabled'), !!attr(byLabel(panel(), ZH.handoff), 'disabled')], [true, true]);
    await finish(last());
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：草稿和按键');
  await safe('草稿', async () => {
    const n0 = pipe.calls.length;
    typeDraft('草稿-甲');
    eq('打字：草稿进 store（按盘），输入框受它控制，发送键可用', [store.draft(), attr(ta(), 'value'), !!attr(sendBtn(), 'disabled')], ['草稿-甲', '草稿-甲', false]);
    rt.key(ta(), 'Enter', { shiftKey: true });
    rt.key(ta(), 'Enter', { isComposing: true });
    rt.key(ta(), 'Enter', { keyCode: 229 });
    eq('Shift+Enter、输入法组字时的 Enter：都不发', pipe.calls.length - n0, 0);
    rt.click(byLabel(panel(), ZH.close));
    await open();
    eq('关面板再开：草稿还在', attr(ta(), 'value'), '草稿-甲');
    rt.unmount();
    mount(1300);
    await step();
    eq('面板卸载再挂载：面板还开着，草稿还在', [!!panel(), attr(ta(), 'value')], [true, '草稿-甲']);
    ok('草稿不写进存储', !J(storage.dump()).includes('草稿-甲'));
    rt.key(ta(), 'Enter');
    await step();
    eq('Enter 发出草稿，草稿清空', [last().body.question, store.draft(), attr(ta(), 'value')], ['草稿-甲', '', '']);
    await finish(last());
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：跟随到底部');
  await safe('跟随', async () => {
    const node = log().node;
    const scroll = (top, height, client = 400) => {
      node.scrollTop = top; node.scrollHeight = height; node.clientHeight = client;
      log().props.onScroll({ currentTarget: node, target: node });
    };
    scroll(600, 1000);
    store.ask('跟随一下');
    await step();
    const p = last();
    node.scrollHeight = 1200;
    p.send('delta', { text: '一' });
    await step();
    eq('在底部时：新内容来了跟到底', node.scrollTop, 1200);
    scroll(700, 1200);
    node.scrollHeight = 1300;
    p.send('delta', { text: '二' });
    await step();
    eq('离底部 100px（> 48）：不跟随', node.scrollTop, 700);
    scroll(860, 1300);
    node.scrollHeight = 1500;
    p.send('delta', { text: '三' });
    await step();
    eq('回到离底部 40px（< 48）：又跟随', node.scrollTop, 1500);
    await finish(p);
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：流式的代价');
  await safe('对话流式', async () => {
    store.ask('看重渲染');
    await step();
    const p = last();
    p.send('delta', { text: '第' });
    await step();
    const htmlOf = () => findByClass(log(), 'zp-md').map((n) => attr(n, 'dangerouslySetInnerHTML'));
    const before = htmlOf();
    const c0 = { head: rt.count('AssistantHead'), ctx: rt.count('AssistantContext'), comp: rt.count('AssistantComposer'), thread: rt.count('AssistantThread') };
    for (let i = 0; i < 100; i++) {
      p.send('delta', { text: '字' });
      await step(1);
    }
    const after = htmlOf();
    ok('100 次增量真的到了（最后一条回答 101 字）', String(after[after.length - 1] && after[after.length - 1].__html).includes('第' + '字'.repeat(100)));
    ok('对话区跟着增量重渲染（≥ 100 次）', rt.count('AssistantThread') - c0.thread >= 100, String(rt.count('AssistantThread') - c0.thread));
    eq('前面每条回答的 __html 对象原样不变（=== ），只有最后一条换了',
      [after.length === before.length, after.slice(0, -1).every((o, i) => o === before[i]), after[after.length - 1] !== before[before.length - 1]], [true, true, true]);
    eq('100 次增量：头部、上下文行、输入框都不重渲染',
      [rt.count('AssistantHead') - c0.head, rt.count('AssistantContext') - c0.ctx, rt.count('AssistantComposer') - c0.comp], [0, 0, 0]);
    await finish(p, '第' + '字'.repeat(100));
  });

  await safe('报告流式时的空态', async () => {
    rt.click(byLabel(one(panel(), 'zp-as-actions'), ZH.newChat));
    store.dismissToast();
    rt.flush();
    ok('清空后是空态（速览在）', !!one(log(), 'zp-quick'));
    store.startReport();
    await step();
    const p = last();
    eq('报告在写：空态还在；「读这张盘」和示例禁用，报告按钮可点（去看进度）；提示去报告里看进度；输入框不能发送，也不是停止键（停报告在报告页）',
      [!!one(log(), 'zp-quick'), buttons(one(log(), 'zp-as-starts')).map((b) => [text(b), !!attr(b, 'disabled')]),
        buttons(one(one(log(), 'zp-as-empty'), 'zp-suggest')).every((b) => !!attr(b, 'disabled')), text(typing()),
        classesOf(sendBtn()), attr(sendBtn(), 'aria-label'), !!attr(sendBtn(), 'disabled'), attr(ta(), 'placeholder')],
      [true, [[ZH.starts[0], true], [ZH.openReport, false]], true, ZH.reportRunning, ['zp-send'], '发送', true, '报告写完后再提问']);
    rt.click(sendBtn());
    eq('报告在写时点发送键：报告照常在写', store.job() && store.job().kind, 'report');
    p.send('delta', { text: '## 一、命盘总览\n' });
    await step();
    const c0 = { quick: rt.count('AssistantQuick'), head: rt.count('AssistantHead'), comp: rt.count('AssistantComposer'), ctx: rt.count('AssistantContext') };
    for (let i = 0; i < 100; i++) {
      p.send('delta', { text: '文' });
      await step(1);
    }
    ok('报告的 100 次增量真的到了', String(store.reading().report.text).endsWith('文'.repeat(100)));
    eq('100 次报告增量：速览、头部、输入框、上下文行都不重渲染',
      [rt.count('AssistantQuick') - c0.quick, rt.count('AssistantHead') - c0.head, rt.count('AssistantComposer') - c0.comp, rt.count('AssistantContext') - c0.ctx], [0, 0, 0, 0]);
    await finish(p, '## 一、命盘总览\n' + '文'.repeat(100));
    eq('报告写完：空态里的报告按钮变成「查看完整报告」', buttons(one(log(), 'zp-as-starts')).map(text), [ZH.starts[0], ZH.openReport]);
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：报告写完后的追问建议');
  await safe('追问建议', async () => {
    eq('空态时不另出追问建议条（只有空态里的示例）', findByClass(panel(), 'zp-suggest').length, 1);
    rt.click(byLabel(one(log(), 'zp-as-empty'), ZH.examples[0]));
    await step();
    eq('点示例问题：直接发出', [last().body.question, meTexts()], [ZH.examples[0], [ZH.examples[0]]]);
    await finish(last());
    const bar = one(panel(), 'zp-suggest');
    eq('有报告、有对话：div.zp-suggest（在对话区外）四个 v5 的追问建议',
      [one(log(), 'zp-suggest'), buttons(bar).map(text)], [null, ZH.suggestions]);
    const pal = chart.palaces[store.getState().session.sel];
    rt.click(byLabel(bar, ZH.suggestions[3]));
    await step();
    eq('「讲讲我选的这一宫」带上选中宫位的引用', last().body.question, '【引用：这一宫】\n' + ZW.palaceQuoteText(pal, '空宫') + '\n\n' + ZH.suggestions[3]);
    await finish(last());
    rt.click(byLabel(panel(), ZH.handoff));
    eq('有报告时交接：mode=report，interpretation 是报告正文', [last().url, last().body.mode, last().body.interpretation], ['/ziwei/handoff', 'report', store.reading().report.text]);
    await step();
    store.dismissToast();
    rt.flush();
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：面板关着时写完');
  await safe('查看', async () => {
    store.setPanel(false);
    rt.flush();
    store.ask('关着问');
    await step();
    await finish(last());
    const toast = one(tree(), 'zp-toast');
    eq('面板关着时答完：提示「紫微师回答好了」带「查看」', [text(find(toast, (n) => n.type === 'span')[0]), buttons(toast).map(text)], [ZH.answerReady, [ZH.view]]);
    rt.click(byLabel(toast, ZH.view));
    await step();
    eq('点「查看」：面板打开，看到这次的回答', [store.getState().session.panelOpen, !!panel(), meTexts().slice(-1)], [true, true, ['关着问']]);
  });

  /* ---------------------------------------------------------------- */
  section('紫微师：空回答');
  await safe('空回答', async () => {
    const n = botCount();
    store.ask('空的');
    await step();
    const p = last();
    p.send('start', {});
    await step();
    eq('流式还没有字：只有输入指示，没有新气泡', [!!typing(), botCount()], [true, n]);
    p.send('done', { text: '' }).end();
    await step();
    eq('写完了也是空的：没有空气泡', [typing(), botCount()], [null, n]);
  });

  rt.unmount();
}
