/* ================================================================
 * 80-assistant：紫微师面板（T6）。结构和类名以 css/80-assistant.css 开头的注释为准。
 *
 * AssistantPanel { tier }   ProApp 只在命盘页渲染它（包在自己的错误边界里）；session.panelOpen 为假时什么都不渲染。
 *   宽档：并排的 aside.zp-assistant，不是浮层（没有 role=dialog、没有遮罩）。
 *   中、窄档：div.zp-as-mask（点了关）+ 同一个 aside，带 role=dialog、aria-modal、名字、焦点陷阱
 *   （useDialogFocus + trapTab）。Esc 由 ProApp 的根节点处理（它自己跳过输入法组字），这里不拦、不停止传播。
 *
 * 组件只读 store、调 store 的动作。提问、续写、重试、停止、清空和撤销、交接、落盘、面板卸载后继续跑的任务，
 * 都在 26-store 里，这里一样也不重写。打开面板不发任何请求：只有点按钮或按 Enter 才会问。
 *
 * 订阅拆得很细：流式增量每秒换很多次 readings，只有对话区（AssistantThread）跟着重画；每条消息一个组件
 * （key = 序号），回答的 HTML 按正文 useMemo，所以一次增量只重新解析最后一条，前面几条的 { __html } 对象不变。
 * 头部、上下文行、输入框、速览选出来的值不随增量变，所以不跟着重渲染。
 *   AssistantHead       header.zp-as-head：紫微师、上下文行（AssistantContext）、新对话 / 在新会话里继续 / 关闭
 *   AssistantThread     div.zp-chat-thread[role=log]：空态（AssistantEmpty）或消息（AssistantMsg）+ 输入指示；
 *                       离底部 48px 以内才跟随新内容
 *   AssistantEmpty      一句话、速览（AssistantQuick，本地算的，不调模型）、起手动作（AssistantStarts）
 *   AssistantError      错误条：可接着写的给「接着写」，其余给「重试」；模型没作答或调用失败时多一个「换个模型」
 *   AssistantSuggest    引导问题，常驻在输入框上方（不只在空对话时）：选中的宫、当前时间层级、两条通用问题
 *   AssistantQuote      引用条（session.quote）
 *   AssistantComposer   输入区 form.zp-as-form：上面是输入框，下面一行 div.zp-as-tools 是模型按钮（68-models 的 ModelChip）
 *                       和发送键。草稿在 store 的 drafts 里（按盘、只在内存）；Enter 发送、Shift+Enter 换行、
 *                       输入法组字时不发；对话在跑时发送键换成停止键。报告在写时不能提问（一张盘同时只有一个任务），
 *                       发送键禁用、不变成停止键：停报告在报告页，免得在这里一按停掉写了几分钟的报告
 * ================================================================ */

const AS_STICK_PX = 48;
const AS_TEXTAREA_MAX = 120;
const AS_CHIP_CLIP = 60;
const AS_BUBBLE_CLIP = 90;
/* 引用拼进问题的格式和 26-store 的 ask（也是 v5）一致：'【引用：' + 标签 + '】\n' + 内容 + '\n\n' + 问题。
   这是协议记号，不是界面文字，所以写成转义（60–90 的源码注释以外不放中文字面量）。 */
const AS_QUOTE_OPEN = '\u3010\u5f15\u7528\uff1a';
const AS_QUOTE_CLOSE = '\u3011\n';

/* ---------------- 小工具 ---------------- */
function asClip(s, n) {
  const chars = Array.from(String(s == null ? '' : s));
  return chars.length > n ? t('asClip', { text: chars.slice(0, n).join('') }) : chars.join('');
}

function asQuoteLine(label, text, n) {
  const body = asClip(text, n);
  return label ? t('asQuoteText', { label: label, text: body }) : body;
}

/* 用户气泡：把按上面的格式拼进去的引用拆出来（显示成 q），剩下的是问的那句。
   问题里可能有空行，引用里也可能有：问题是用户打的、一般一行，所以按最后一个空行切。 */
function asSplitAsk(content) {
  const s = String(content == null ? '' : content);
  if (s.indexOf(AS_QUOTE_OPEN) !== 0) return { quote: null, text: s };
  const close = s.indexOf(AS_QUOTE_CLOSE, AS_QUOTE_OPEN.length);
  if (close < 0) return { quote: null, text: s };
  const rest = s.slice(close + AS_QUOTE_CLOSE.length);
  const cut = rest.lastIndexOf('\n\n');
  if (cut < 0) return { quote: null, text: s };
  return { quote: { label: s.slice(AS_QUOTE_OPEN.length, close), text: rest.slice(0, cut) }, text: rest.slice(cut + 2) };
}

/* 输入框里的提问（带上还挂着的引用，由 store.ask 处理）。引导问题各自带自己的引用和定位，见 asSuggestItems */
function asAsk(question) {
  return appStore().ask(String(question == null ? '' : question).trim());
}

function asTrapKey(ev) {
  trapTab(ev, ev.currentTarget);
}

/* ---------------- 选择器（选窄：只返回原始值或 state 里原有的对象） ---------------- */
function asOpenOf(s) {
  return !!s.session.panelOpen;
}

function asReportDone(rep) {
  return !!rep && rep.status === 'done' && !!rep.text;
}

function asHeadOf(s, store) {
  const r = store.reading();
  return {
    hasThread: r.thread.length > 0,
    busy: !!store.job(),
    handoff: s.session.handoff === 'working',
    hasReport: asReportDone(r.report)
  };
}

function asContextOf(s, store) {
  const e = store.currentEntry();
  const c = e ? store.chartOf(e) : null;
  const p = c ? c.palaces[s.session.sel] : null;
  return { name: e ? String(e.name || '') : '', cls: c ? String(c.fiveElementsClass || '') : '', palace: p ? palaceLabel(p) : '' };
}

function asThreadOf(s, store) {
  const r = store.reading();
  const job = store.job();
  return {
    thread: r.thread,
    chat: !!job && job.kind === 'chat',
    report: !!job && job.kind === 'report',
    thinking: !!job && job.kind === 'chat' && job.thinkChars > 0,
    retried: !!job && job.kind === 'chat' && !!job.retried
  };
}

function asQuickOf(s, store) {
  const today = store.todayOf();
  return { chart: store.currentChart(), y: today.y, m: today.m, d: today.d };
}

function asStartsOf(s, store) {
  const rep = store.reading().report;
  return { busy: !!store.job(), hasReport: !!rep && (rep.status === 'running' || asReportDone(rep)) };
}

function asErrorOf(s, store) {
  const r = store.reading();
  return {
    err: String(r.chatError || ''), cont: !!(r.chatIssue && r.chatIssue.canContinue),
    kind: String((r.chatIssue && r.chatIssue.kind) || ''), busy: !!store.job()
  };
}

/* 引导问题跟着正在看的东西走：选中的宫、当前页签和日期；对话空不空决定条数 */
function asSuggestOf(s, store) {
  const ss = s.session;
  const r = store.reading();
  return {
    entry: store.currentEntry(), sel: ss.sel, tab: ss.tab, when: ss.tab === 'natal' ? null : ss.when,
    hasThread: r.thread.length > 0, reportDone: asReportDone(r.report), busy: !!store.job()
  };
}

function asQuoteOf(s) {
  return s.session.quote;
}

function asComposerOf(s, store) {
  const job = store.job();
  return { draft: store.draft(), job: job ? job.kind : '', quote: s.session.quote };
}

/* ---------------- 面板 ---------------- */
function AssistantPanel(props) {
  const open = useStore(asOpenOf);
  const floating = props.tier !== 'wide';
  const boxRef = useDialogFocus(open && floating);
  const inputRef = useRef(null);
  if (!open) return null;
  const store = appStore();
  /* 被点的按钮会随之消失（新对话、起手动作、示例、错误条、追问建议）：焦点交给输入框，免得掉到 body 上 */
  const focusInput = function () {
    if (inputRef.current) focusQuietly(inputRef.current);
  };
  const aside = h('aside', {
    key: 'aside', ref: boxRef, className: 'zp-assistant', 'data-region': 'ASSISTANT', 'aria-label': t('asTitle'),
    role: floating ? 'dialog' : undefined, 'aria-modal': floating ? 'true' : undefined,
    'data-dsh-automatic-focus': floating ? '' : undefined, tabIndex: floating ? -1 : undefined,
    onKeyDown: floating ? asTrapKey : undefined
  },
  h(AssistantHead, { focusInput: focusInput }),
  h(AssistantThread, { floating: floating, focusInput: focusInput }),
  h(AssistantError, { focusInput: focusInput }),
  h(AssistantSuggest, { focusInput: focusInput }),
  h(AssistantQuote),
  h(AssistantComposer, { inputRef: inputRef }),
  h('div', { className: 'zp-as-foot' }, t('asDisclaimer')));
  if (!floating) return [aside];
  return [
    h('div', { key: 'mask', className: 'zp-as-mask', 'aria-hidden': true, onClick: function () { store.setPanel(false); } }),
    aside
  ];
}

/* ---------------- 头部 ---------------- */
function AssistantHead(props) {
  const m = useStore(asHeadOf);
  const store = appStore();
  return h('header', { className: 'zp-as-head' },
    h('b', null, t('asTitle')),
    h(AssistantContext),
    h('div', { className: 'zp-as-actions' },
      m.hasThread ? h('button', {
        key: 'new', className: 'zp-icon-btn', type: 'button', title: t('asNewChat'), 'aria-label': t('asNewChat'),
        disabled: m.busy ? true : undefined,
        onClick: function () { if (store.clearThread()) props.focusInput(); }
      }, h(Icon, { name: 'newChat' })) : null,
      h('button', {
        key: 'handoff', className: 'zp-icon-btn', type: 'button', title: t('asHandoffHint'), 'aria-label': t('asHandoff'),
        disabled: m.busy || m.handoff ? true : undefined,
        onClick: function () { store.handoff({ mode: m.hasReport ? 'report' : 'brief' }); }
      }, h(Icon, { name: 'handoff' })),
      h('button', {
        key: 'close', className: 'zp-icon-btn', type: 'button', title: t('dialogClose'), 'aria-label': t('dialogClose'),
        onClick: function () { store.setPanel(false); }
      }, h(Icon, { name: 'close' }))));
}

/* 上下文行：盘名 · 五行局 · 选中的宫（选宫只让这一行重画） */
function AssistantContext() {
  const m = useStore(asContextOf);
  const name = m.name || t('headUnnamed');
  return h('small', null, m.palace
    ? t('asContextPalace', { name: name, cls: m.cls, palace: m.palace })
    : t('asContext', { name: name, cls: m.cls }));
}

/* ---------------- 对话区 ---------------- */
function AssistantThread(props) {
  const m = useStore(asThreadOf);
  const boxRef = useRef(null);
  const stick = useRef(true);
  useEffect(function () {
    const el = boxRef.current;
    if (el && stick.current && typeof el.scrollHeight === 'number') el.scrollTop = el.scrollHeight;
  }, [m.thread, m.chat, m.report, m.thinking, m.retried]);
  const onScroll = function (ev) {
    const el = ev.currentTarget;
    if (!el || typeof el.scrollHeight !== 'number') return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < AS_STICK_PX;
  };
  /* 速览解读不带用户提问，thread 还是空的：生成中也要离开空态，让输入指示立刻可见（v5） */
  const empty = !m.thread.length && !m.chat;
  return h('div', {
    className: 'zp-chat-thread', role: 'log', 'aria-live': 'polite', 'aria-busy': m.chat ? 'true' : 'false',
    ref: boxRef, onScroll: onScroll
  },
  empty ? h(AssistantEmpty, { key: 'empty', floating: props.floating, focusInput: props.focusInput }) : null,
  m.thread.map(function (msg, i) {
    return h(AssistantMsg, { key: i, role: msg.role, content: msg.content });
  }),
  m.chat ? h('div', { key: 'typing', className: 'zp-typing' },
    h('span', { className: 'zp-pulse', 'aria-hidden': true }),
    t(m.retried ? 'asRetrying' : (m.thinking ? 'asThinking' : 'asWriting'))) : null,
  m.report ? h('div', { key: 'report', className: 'zp-typing' },
    h('span', { className: 'zp-pulse', 'aria-hidden': true }),
    t('asReportRunning')) : null);
}

/* 一条消息。空白的回答不出气泡（流式刚开始、或者模型什么都没写）；HTML 只在正文变了时重新解析 */
function AssistantMsg(props) {
  const mine = props.role === 'user';
  const content = String(props.content == null ? '' : props.content);
  const view = useMemo(function () {
    if (mine) return asSplitAsk(content);
    return content.trim() ? { __html: ZWREPORT.mdToChatHtml(content) } : null;
  }, [mine, content]);
  if (mine) {
    return h('div', { className: 'zp-msg zp-me' },
      view.quote ? h('q', null, asQuoteLine(view.quote.label, view.quote.text, AS_BUBBLE_CLIP)) : null,
      view.text);
  }
  if (!view) return null;
  return h('div', { className: 'zp-msg zp-bot' }, h('div', { className: 'zp-md', dangerouslySetInnerHTML: view }));
}

/* ---------------- 空态 ---------------- */
function AssistantEmpty(props) {
  return h('div', { className: 'zp-as-empty' },
    h('p', { className: 'zp-l1' }, t('asEmptyLine')),
    h(AssistantQuick),
    h(AssistantStarts, { floating: props.floating, focusInput: props.focusInput }));
}

/* 速览：命宫主星和一句解释、最多两个格局、当前大限、今天流日。本地算（ZWUI.quickLook），不是模型的回答 */
function AssistantQuick() {
  const m = useStore(asQuickOf);
  const q = useMemo(function () {
    if (!m.chart) return null;
    try { return quickLook(m.chart, { y: m.y, m: m.m, d: m.d }); } catch (e) { return null; }
  }, [m.chart, m.y, m.m, m.d]);
  if (!q) return null;
  const rows = [
    h('h4', { key: 'soul-h' }, t('asQuickSoul')),
    h('p', { key: 'soul' }, q.soul.brief ? t('asQuickSoulText', { line: q.soul.line, brief: q.soul.brief }) : q.soul.line)
  ];
  if (q.patterns.length) {
    rows.push(h('h4', { key: 'pat-h' }, t('asQuickPatterns')));
    q.patterns.forEach(function (p, i) {
      rows.push(h('p', { key: 'pat-' + i }, h('b', null, p.name), p.desc ? t('asQuickPatternDesc', { desc: p.desc }) : null));
    });
  }
  if (q.decade) {
    rows.push(h('h4', { key: 'dec-h' }, t('asQuickDecade')));
    rows.push(h('p', { key: 'dec' }, q.decade.line));
  }
  if (q.today) {
    rows.push(h('h4', { key: 'day-h' }, t('asQuickToday')));
    rows.push(h('p', { key: 'day' }, q.today.line));
  }
  return h('section', { className: 'zp-quick' }, rows);
}

/* 起手动作。「写完整报告」只是去报告页（在那里开始写），不在这里发请求；
   中、窄档下面板浮在上面，去报告页时先收起它。示例问题在输入框上方那排常驻的引导里（AssistantSuggest） */
function AssistantStarts(props) {
  const m = useStore(asStartsOf);
  const store = appStore();
  return [
    h('div', { key: 'starts', className: 'zp-as-starts' },
      h('button', {
        className: 'zp-btn', type: 'button', disabled: m.busy ? true : undefined,
        onClick: function () { if (store.ask('', { quote: null })) props.focusInput(); }
      }, t('asStartRead')),
      h('button', {
        className: 'zp-btn', type: 'button',
        onClick: function () {
          store.setStage('report');
          if (props.floating) store.setPanel(false);
        }
      }, m.hasReport ? t('asOpenReport') : t('asStartReport')))
  ];
}

/* ---------------- 错误条、追问建议、引用条 ---------------- */
function AssistantError(props) {
  const m = useStore(asErrorOf);
  if (!m.err) return null;
  const store = appStore();
  /* 模型没作答、或者调用失败：除了重试，再给一条换模型的路 */
  const swap = m.kind === 'empty' || m.kind === 'error';
  return h('div', { className: 'zp-as-error', role: 'alert' },
    h('span', null, m.err),
    h('button', {
      className: 'zp-btn zp-sm', type: 'button', disabled: m.busy ? true : undefined,
      onClick: function () {
        const ok = m.cont ? store.continueChat() : store.retryChat();
        if (ok) props.focusInput();
      }
    }, m.cont ? t('asContinue') : t('asRetry')),
    swap ? h('button', {
      className: 'zp-btn zp-sm', type: 'button',
      /* 带上「选完重问」的标记：在弹层里换成别的模型后，这一问自动再问一次（68-models 的 ModelModal） */
      onClick: function () { store.patchSession({ modelRetry: true }); openModal('model'); }
    }, t('asSwapModel')) : null);
}

/* 引导常驻（spec 2026-11-20 §3.7）：输入框上方一直有一排问题，不只在空对话时出现。
   内容跟着正在看的东西走：选中的宫、当前时间层级；后面是两条通用的。对话为空时最多 4 条，有对话后最多 3 条；
   报告写完后把第二条通用问题换成「说得再通俗一点」。生成中禁用。 */
function asSuggestItems(m, chart) {
  const out = [];
  const p = chart ? chart.palaces[m.sel] : null;
  if (p) {
    out.push({
      id: 'palace', label: t('asSugPalace', { palace: p.name }),
      run: function (store) {
        return store.ask(t('asSugPalace', { palace: p.name }), { quote: { label: t('asQuotePalaceLabel'), text: palaceQuoteText(p, t('asEmptyPalace')) } });
      }
    });
  }
  if (chart && m.tab !== 'natal' && m.when) {
    const rel = relWord(chart, m.tab, m.when, appStore().todayOf());
    if (rel) {
      const q = t('asSugScope', { rel: rel });
      out.push({ id: 'scope', label: q, run: function (store) { return store.ask(q, { scope: true, quote: null }); } });
    }
  } else {
    const q = t('asSugDecade');
    out.push({ id: 'decade', label: q, run: function (store) { return store.ask(q, { quote: null }); } });
  }
  [m.reportDone && m.hasThread ? 'asSuggestPlain' : 'asSugCareer', 'asSugLove'].forEach(function (key) {
    const q = t(key);
    out.push({ id: key, label: q, run: function (store) { return store.ask(q, { quote: null }); } });
  });
  return out.slice(0, m.hasThread ? 3 : 4);
}

function AssistantSuggest(props) {
  const m = useStore(asSuggestOf);
  const chart = useMemo(function () { return m.entry ? appStore().chartOf(m.entry) : null; }, [m.entry]);
  const items = asSuggestItems(m, chart);
  if (!items.length) return null;
  return h('div', { className: 'zp-suggest', role: 'group', 'aria-label': t('asSugLabel') }, items.map(function (it) {
    return h('button', {
      key: it.id, type: 'button', disabled: m.busy ? true : undefined,
      onClick: function () { if (it.run(appStore())) props.focusInput(); }
    }, it.label);
  }));
}

function AssistantQuote() {
  const q = useStore(asQuoteOf);
  if (!q) return null;
  const store = appStore();
  return h('div', { className: 'zp-quote' },
    h('span', { title: q.text }, asQuoteLine(q.label, q.text, AS_CHIP_CLIP)),
    h('button', {
      type: 'button', title: t('asQuoteRemove'), 'aria-label': t('asQuoteRemove'),
      onClick: function () { store.setQuote(null); }
    }, h(Icon, { name: 'close', size: 12 })));
}

/* ---------------- 输入框 ---------------- */
function AssistantComposer(props) {
  const m = useStore(asComposerOf);
  const store = appStore();
  const taRef = props.inputRef;
  const mounted = useRef(false);
  /* 随内容长高，最高 120px（之后在框里滚动） */
  useLayoutEffect(function () {
    const el = taRef.current;
    if (!el || !el.style || typeof el.scrollHeight !== 'number') return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, AS_TEXTAREA_MAX) + 'px';
  }, [m.draft]);
  /* 面板打开（这时才挂载）和引用换了之后，焦点到输入框；打开时正在生成就不抢 */
  useEffect(function () {
    const first = !mounted.current;
    mounted.current = true;
    if (first && m.job) return;
    if (taRef.current) focusQuietly(taRef.current);
  }, [m.quote]);
  const busy = !!m.job;
  const chatting = m.job === 'chat';
  const canSend = !busy && (!!m.draft.trim() || !!m.quote);
  const submit = function () {
    if (!canSend) return;
    if (asAsk(m.draft)) store.setDraft('');
  };
  const placeholder = m.job === 'chat' ? t('asWaitChat') : (m.job === 'report' ? t('asWaitReport') : t('asPlaceholder'));
  return h('form', {
    className: 'zp-as-form',
    onSubmit: function (ev) { ev.preventDefault(); submit(); }
  },
  h('textarea', {
    ref: taRef, rows: 1, value: m.draft, placeholder: placeholder, 'aria-label': t('asInputLabel'),
    onChange: function (ev) { store.setDraft(ev.target.value); },
    onKeyDown: function (ev) {
      if (ev.key !== 'Enter' || ev.shiftKey || isComposingKey(ev)) return;
      ev.preventDefault();
      submit();
    }
  }),
  /* 输入框下面一行：左边是模型按钮，右边是发送 / 停止 */
  h('div', { className: 'zp-as-tools' },
    h(ModelChip, null),
    h('span', { className: 'zp-grow' }),
    chatting
      ? h('button', {
        className: 'zp-send zp-stop', type: 'button', title: t('asStop'), 'aria-label': t('asStop'),
        onClick: function () {
          store.stop();
          if (taRef.current) focusQuietly(taRef.current);
        }
      }, h(Icon, { name: 'stop' }))
      : h('button', {
        className: 'zp-send', type: 'button', title: t('asSend'), 'aria-label': t('asSend'),
        disabled: canSend ? undefined : true, onClick: submit
      }, h(Icon, { name: 'send' }))));
}
