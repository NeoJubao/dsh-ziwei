/**
 * Host half of the 紫微师 workbench bundle (@local/ziwei-workbench).
 *
 * Responsibilities
 * - 紫微师 工具组: ziwei_paipan / ziwei_check / ziwei_context / ziwei_templates,
 *   把确定性排盘引擎交给会话里的 agent 调用（排盘唯一来源，严禁手工排盘）。
 * - /ziwei/interpret: 面板内「直接聊」的 SSE 流式解读通道。走 Harness 自己的
 *   llm 服务（用户已配置的 provider/model），不需要浏览器里另配 API Key。
 *
 * 实现约束: 本插件位于 profile 的 link: 依赖里，运行时无法 import
 * @deepseek-ai/* 包，因此一律通过 ctx.get(...) 取服务，并把随包分发的
 * engine-built.js / ziwei-core.js 在 node:vm 沙箱里求值取用。
 */
import { appendFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

/* 插件身份与依赖 (A1): bundle 以 link: 装载时，宿主按 cordis inject 语义等待服务就绪；
   否则 apply() 会在 tools/systemPrompt/webServer 尚未注册时执行，全部注册被静默跳过。
   agentDefaultModel / sessionController / workspaceRegistry 为可选服务，保持运行时 ctx.get。 */
export const name = 'ziwei-workbench';
export const inject = ['tools', 'systemPrompt'];

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE_FILE = join(HERE, 'engine-built.js');
const CORE_FILE = join(HERE, 'src', 'ziwei-core.js');
const DIAG_FILE = join(HERE, 'host-diag.log');
const INTERPRET_DIAG_FILE = join(HERE, 'interpret-diag.log');
const INTERPRET_DIAG_MAX_BYTES = 512 * 1024;

/**
 * 面板解读的定点诊断：每次请求写一行（模型、档位、输出预算、结束原因、
 * 用时、token 用量）。「输出一半就中断」最需要的正是这组现场数据；
 * 写日志失败不影响主流程。测试用 ZIWEI_DIAG=0 关掉，免得污染包目录。
 */
function diagInterpret(line) {
  if (process.env.ZIWEI_DIAG === '0') return;
  try {
    const row = `${new Date().toISOString()} pid=${process.pid} ${line}\n`;
    let size = 0;
    try { size = statSync(INTERPRET_DIAG_FILE).size; } catch (e) { size = 0; }
    if (size > INTERPRET_DIAG_MAX_BYTES) writeFileSync(INTERPRET_DIAG_FILE, row);
    else appendFileSync(INTERPRET_DIAG_FILE, row);
  } catch (e) {
    try { console.warn('ziwei-workbench: interpret diag write failed:', String((e && e.message) || e)); } catch (e2) { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ *
 * 内核装载: 在同一个沙箱里先跑引擎再跑内核, 两者共享 globalThis.ZWEngine
 * ------------------------------------------------------------------ */
let cached = null;
function kernel() {
  if (cached) return cached;
  const sandbox = { console, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const context = vm.createContext(sandbox);
  new vm.Script(readFileSync(ENGINE_FILE, 'utf8'), { filename: 'engine-built.js' }).runInContext(context);
  new vm.Script(readFileSync(CORE_FILE, 'utf8'), { filename: 'src/ziwei-core.js' }).runInContext(context);
  if (!sandbox.ZWEngine) throw new Error('ziwei-workbench: engine-built.js 未挂载 ZWEngine');
  if (!sandbox.ZWCore) throw new Error('ziwei-workbench: ziwei-core.js 未挂载 ZWCore');
  cached = { engine: sandbox.ZWEngine, core: sandbox.ZWCore };
  return cached;
}

/* ------------------------------------------------------------------ *
 * 工具定义辅助 (无法 import defineTool, 手工构造 ToolDefinition)
 * ------------------------------------------------------------------ */
const text = (t) => [{ type: 'text', text: t }];

/** 把 core 的 {ok,error} 结果包装成工具返回值或抛出可读错误。 */
function must(result, what) {
  if (!result || result.ok !== true) {
    throw new Error(`${what}失败：${(result && result.error) || '未知错误'}。请如实向用户报告，严禁手工排盘或凭记忆补全。`);
  }
  return result;
}

function chartSummaryText(chart, extra) {
  const corr = (chart.meta && chart.meta.solarCorrection) || null;
  const lines = [];
  lines.push(`阳历：${chart.solarDate}　农历：${chart.lunar.year}年${chart.lunarText}　时辰：${chart.timeName}`);
  lines.push(`四柱：${[chart.pillars.yearly, chart.pillars.monthly, chart.pillars.daily, chart.pillars.hourly].join(' ')}`);
  if (corr) {
    lines.push(`真太阳时：${corr.solarTime}（经度 ${corr.longitude}°E，经度修正 ${corr.longitudeMinutes} 分，均时差 ${corr.eotMinutes >= 0 ? '+' : ''}${corr.eotMinutes} 分）`);
    if (corr.boundaryWarning) lines.push('⚠️ 时辰边界告警：校正后距时辰边界不足 3 分钟，出报告前必须向用户声明。');
  } else {
    lines.push('真太阳时：未校正（调用时未提供出生地经度；经度 ≠120° 时必做校正，请补齐经度后重排）。');
  }
  lines.push(`命宫：${chart.soulBranch}　身宫：${chart.bodyBranch}　五行局：${chart.fiveElementsClass}　生肖：${chart.zodiac}　起运：${chart.startAge}岁`);
  lines.push(`命主：${chart.soulMaster}　身主：${chart.bodyMaster}`);
  lines.push(`四化：${(chart.mutagens || []).map((m) => `${m.star}化${m.mutagen}(${m.palaceName})`).join(' ') || '（无）'}`);
  if (extra) lines.push(extra);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * 路由守卫 (A3): 方法白名单 + 来源/鉴权 + JSON Content-Type
 * 用法: guard(req, res, { methods: ['POST'], json: true })；返回 false 表示已响应。
 * ------------------------------------------------------------------ */
function sendJson(res, status, payload, extraHeaders) {
  try {
    if (extraHeaders) for (const k of Object.keys(extraHeaders)) res.setHeader(k, extraHeaders[k]);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  } catch (e) { /* 已发送 */ }
}

/** 从 Host / Origin 头里取 hostname（小写、去掉 IPv6 方括号）；解析失败返回 null。 */
function headerHostname(value) {
  if (!value) return null;
  try {
    const h = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : 'http://' + value).hostname;
    return String(h || '').toLowerCase().replace(/^\[|\]$/g, '');
  } catch (e) { return null; }
}

const LOOPBACK_HOSTNAMES = ['127.0.0.1', 'localhost', '::1'];

function makeGuard(ctx) {
  let fallbackWarned = false;
  return function guard(req, res, opts) {
    const options = opts || {};
    const methods = Array.isArray(options.methods) && options.methods.length ? options.methods : ['GET'];
    const method = String((req && req.method) || 'GET').toUpperCase();

    /* 1) 方法白名单 */
    if (!methods.includes(method)) {
      sendJson(res, 405, { ok: false, reason: 'Method Not Allowed' }, { Allow: methods.join(', ') });
      return false;
    }

    /* 2) 鉴权 / 来源 / 主体。
     *    官方契约（dsh-client-connection）：
     *    - requestRejection(req) 是「给另一条 Web 路由复用 Connection 的 Host/Origin 校验与浏览器认证」的公开入口；
     *    - admit(req) 返回凭据的 Peer；/api 精确 Fetch 路由只允许 owner Peer，本插件路由同样只服务本机 owner，
     *      避免 remote-access / 非 owner Peer 借道消耗 LLM 或让 Host 建会话。
     *    没有 connection 服务（非 Web 组合）时退到 loopback fallback fence。 */
    let connection = null;
    try { connection = ctx.get('connection'); } catch (e) { connection = null; }
    const headers = (req && req.headers) || {};
    const reject = (code, reason) => {
      sendJson(res, code, { ok: false, reason });
      return false;
    };
    if (connection && (typeof connection.requestRejection === 'function' || typeof connection.admit === 'function')) {
      /* 2.1 先跑官方 Web 路由准入（Host/Origin + 浏览器认证） */
      if (typeof connection.requestRejection === 'function') {
        let rejection = null;
        try { rejection = connection.requestRejection(req); } catch (e) { rejection = 403; }
        if (rejection) {
          const code = rejection === 401 ? 401 : 403;
          return reject(code, code === 401 ? '未授权：需要浏览器会话' : '来源不可信');
        }
      }
      /* 2.2 再核对 Peer 主体：只接受 owner（与 /api 精确 Fetch 路由同口径） */
      if (typeof connection.admit === 'function') {
        let admission = null;
        try { admission = connection.admit(req); } catch (e) { admission = { rejection: 403 }; }
        if (!admission || typeof admission !== 'object' || 'rejection' in admission) {
          const code = admission && admission.rejection === 401 ? 401 : 403;
          return reject(code, code === 401 ? '未授权：需要浏览器会话' : '来源不可信');
        }
        /* 旧版/测试桩可能只返回 {}；真实 Connection 的 Peer 一定带 principal */
        if (admission.peer && admission.peer.principal && admission.peer.principal.kind !== 'owner') {
          return reject(403, '仅允许本机所有者会话调用');
        }
      }
    } else {
      if (!fallbackWarned) {
        fallbackWarned = true;
        const msg = 'ziwei-workbench: 未挂载 connection，路由处于无鉴权 fallback（仅 Host/Origin/sec-fetch-site 最小校验）';
        try {
          if (ctx.logger && typeof ctx.logger.warn === 'function') ctx.logger.warn(msg);
          else console.warn(msg);
        } catch (e) { /* ignore */ }
      }
      /* 无 Host 视为本机；带 Host 则必须是 loopback */
      const hostName = headerHostname(headers.host);
      if (hostName !== null && !LOOPBACK_HOSTNAMES.includes(hostName)) {
        return reject(403, '来源不可信');
      }
      /* 浏览器跨站标志 */
      if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
        sendJson(res, 403, { ok: false, reason: '来源不可信' });
        return false;
      }
      /* 带 Origin 时必须与 Host 同源（无 Host 时只接受 loopback Origin） */
      if (headers.origin) {
        const originName = headerHostname(headers.origin);
        const allowed = hostName === null
          ? (originName !== null && LOOPBACK_HOSTNAMES.includes(originName))
          : originName === hostName;
        if (!allowed) {
          sendJson(res, 403, { ok: false, reason: '来源不可信' });
          return false;
        }
      }
    }

    /* 3) 写接口必须是 JSON 请求 */
    if (options.json && method === 'POST') {
      const contentType = String(headers['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('application/json')) {
        sendJson(res, 415, { ok: false, reason: 'Unsupported Media Type: Content-Type 必须为 application/json' });
        return false;
      }
    }
    return true;
  };
}

/* ------------------------------------------------------------------ *
 * 插件本体
 * ------------------------------------------------------------------ */
/* 供 verify/sse-hang.mjs 直接驱动 SSE 核心（含可注入超时预算） */
export { handleInterpret };

export function apply(ctx) {
  diag('=== apply start ===');
  for (const name of ['tools', 'systemPrompt', 'webServer', 'llm', 'agentDefaultModel', 'sessionController', 'workspaceRegistry']) {
    let t = 'undefined';
    try { const v = ctx.get(name); t = v === undefined ? 'undefined' : v === null ? 'null' : typeof v; } catch (e) { t = 'get-error:' + String(e && e.message); }
    diag(`  service ${name} = ${t}`);
  }
  const { core } = kernel();
  diag('kernel loaded ok');
  const guard = makeGuard(ctx);

  /* 面板最近一次排盘的命盘上下文（供会话内 agent 引用） */
  let lastContext = null;

  const registerTools = () => {
    const tools = ctx.get('tools');
    if (!tools || typeof tools.register !== 'function') return;

    tools.register({
      name: 'ziwei_paipan',
      description: '紫微斗数确定性排盘（唯一来源，含真太阳时校正）。给出阳历/农历生日、出生钟表时间、性别、出生地经度，返回完整命盘：十二宫主星辅星杂曜、四化、命主身主、大限。严禁手工排盘——本工具失败时如实报告并停止。',
      parameters: {
        type: 'object',
        properties: {
          calendar: { type: 'string', enum: ['solar', 'lunar'], description: 'solar=阳历（默认），lunar=农历' },
          date: { type: 'string', description: '出生日期 YYYY-MM-DD。lunar 时按农历月/日填写。' },
          time: { type: 'string', description: '出生钟表时间 HH:MM（24 小时制，出生地当地钟表时间，不要自行换算真太阳时）' },
          gender: { type: 'string', enum: ['male', 'female'], description: 'male=男，female=女' },
          longitude: { type: 'number', description: '出生地经度（东经正数，如北京 116.4、乌鲁木齐 87.6）。省略则不做真太阳时校正。' },
          isLeapMonth: { type: 'boolean', description: '农历输入时为闰月则填 true' },
          dayDivide: {
            type: 'string',
            enum: ['current', 'forward'],
            description: '晚子时(23:00-23:59)安星口径。current=按当日（默认，与紫微师来源产品/iztro 一致）；forward=换到次日。仅在用户明确要求该流派时使用。'
          },
          name: { type: 'string', description: '命主称呼（可选，仅用于报告抬头）' }
        },
        required: ['date', 'time', 'gender']
      },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => text(value.text)
      },
      execute(args) {
        /* 手工构造的 ToolDefinition 绕过了 defineTool 的参数校验，这里自己兜住：
           缺 gender 或 gender 非法都必须拒绝——静默按男命排盘会让女性用户的
           十二宫大限整体反向，属于会产出错误命盘的错误。 */
        const gender = args && args.gender;
        if (gender !== 'male' && gender !== 'female' && gender !== '男' && gender !== '女') {
          throw new Error(`排盘失败：gender 必须显式给出 male(男) 或 female(女)，收到 ${JSON.stringify(gender)}。` +
            '性别决定阴阳男女与大限顺逆，缺失或非法时会排出错误的盘，因此不予默认。请先向命主确认性别。');
        }
        /* 晚子时口径显式化: 默认 current（与来源产品一致），可由模型按流派要求覆盖 */
        const dayDivide = args.dayDivide === 'forward' ? 'forward' : 'current';
        const res = must(core.paipan(Object.assign({}, args, {
          settings: Object.assign({}, args.settings, { dayDivide })
        })), '排盘');
        const chart = res.chart;
        /* agent 侧同样要拿到“当前定位”：问「这 10 年大运」时不能只给本命盘。 */
        const currentYear = new Date().getFullYear();
        const currentAge = chart.lunar ? (currentYear - chart.lunar.year + 1) : 0;
        const chartText = core.chartText(chart);
        const fullText = core.fullChartText(chart, { currentAge, currentYear });
        lastContext = { source: 'session-tool', chartText, fullText, at: Date.now(), name: args.name || '', cwd: '' };
        return Promise.resolve({
          text: chartSummaryText(chart, '当前定位（虚岁 ' + currentAge + ' / ' + currentYear + ' 年）见下方【当前定位】区块。') + '\n\n' + fullText,
          solarDate: chart.solarDate,
          timeName: chart.timeName,
          lunar: `${chart.lunar.year}年${chart.lunarText}`,
          fiveElementsClass: chart.fiveElementsClass,
          soulBranch: chart.soulBranch,
          bodyBranch: chart.bodyBranch,
          soulMaster: chart.soulMaster,
          bodyMaster: chart.bodyMaster,
          corrected: !!(chart.meta && chart.meta.solarCorrection),
          boundaryWarning: !!(chart.meta && chart.meta.solarCorrection && chart.meta.solarCorrection.boundaryWarning)
        });
      },
      presentCall: (args) => ({
        card: 'generic',
        title: `紫微斗数排盘 ${args.date} ${args.time} ${args.gender === 'female' ? '女' : '男'}${args.longitude ? ` ${args.longitude}°E` : ''}`,
        kind: 'execute',
        rawInput: args
      })
    });

    tools.register({
      name: 'ziwei_check',
      description: '紫微师黄金用例自检：用黄金用例（1992-05-03 09:30 男 经度 105.97）对排盘引擎做四断言。排盘工具、脚本、运行环境有任何改动后必跑；任一项不符即工具损坏，必须停止交付并如实报告。',
      parameters: { type: 'object', properties: {} },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => text(value.text)
      },
      execute() {
        const r = core.goldenCheck();
        const lines = [];
        lines.push(r.ok ? '✅ 黄金用例 4/4 断言全部通过：排盘工具完好，可以放心交付报告' : `❌ 黄金用例 ${r.passed}/${r.total} 断言通过 — 排盘工具已损坏，停止交付并如实报告`);
        if (r.actual) {
          lines.push(`实际：真太阳时=${r.actual.solarTime} 时辰=${r.actual.timeName}(${r.actual.timeIndex}) 农历=${r.actual.lunarYear}年${r.actual.lunarText} 命宫=${r.actual.soulBranch} 命宫主星=[${r.actual.soulMajor.join(' ')}] 五行局=${r.actual.fiveElementsClass}`);
        }
        (r.failures || []).forEach((f) => lines.push('  ' + f));
        return Promise.resolve({ text: lines.join('\n'), ok: r.ok, passed: r.passed, total: r.total });
      },
      presentCall: () => ({ card: 'generic', title: '紫微师黄金用例自检', kind: 'read' })
    });

    tools.register({
      name: 'ziwei_templates',
      description: '取出「紫微师」完整方法论：agent 人设、工作三段式、意象解盘九诀、鲲鹏报告 14 部分、致命主书与十二字心法、合规红线、交付前自检清单。需要按紫微师标准产出人生规划报告时调用。',
      parameters: { type: 'object', properties: {} },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => text(value.text)
      },
      execute() {
        return Promise.resolve({
          text: core.PERSONA + '\n\n' + core.SELFCHECK + '\n\n报告末尾必含免责声明：\n' + core.DISCLAIMER_REPORT
        });
      },
      presentCall: () => ({ card: 'generic', title: '取出紫微师方法论（九诀 + 鲲鹏 14 部分 + 红线）', kind: 'read' })
    });

    tools.register({
      name: 'ziwei_context',
      description: '读取紫微斗数工作台面板里最近一次排好的命盘（用户在插件面板点过「交给会话」或刚排过盘）。想在会话里接着面板的盘继续聊/写报告时调用。',
      parameters: { type: 'object', properties: {} },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => text(value.text)
      },
      execute() {
        if (!lastContext) {
          return Promise.resolve({ text: '工作台面板还没有命盘上下文。请在插件面板里排盘后点「同步给会话」（把这张盘交给当前会话）或「交给会话」（新建一个会话），也可以直接调用 ziwei_paipan 排盘。' });
        }
        const ageMin = Math.round((Date.now() - lastContext.at) / 60000);
        const head = [];
        head.push(`（来源：${lastContext.source === 'panel' ? '工作台面板（排盘后「同步给会话」或「交给会话」）' : '本进程内 ziwei_paipan 排盘'}，${ageMin} 分钟前` +
          (lastContext.name ? `，命主 ${lastContext.name}` : '') + '）');
        if (lastContext.place) head.push(`出生地：${lastContext.place}`);
        if (lastContext.occupation) head.push(`职业/诉求：${lastContext.occupation}`);
        const body = [head.join('\n'), '', lastContext.fullText];
        if (lastContext.interpretation) {
          body.push('', '──── 面板内已给出的解读（可直接承接，不要重复） ────', '', lastContext.interpretation);
        }
        return Promise.resolve({ text: body.join('\n') });
      },
      presentCall: () => ({ card: 'generic', title: '读取工作台命盘上下文', kind: 'read' })
    });
  };

  const registerSystemPrompt = () => {
    const systemPrompt = ctx.get('systemPrompt');
    if (!systemPrompt || typeof systemPrompt.section !== 'function') return;
    let order = 2900; /* TOOL_REPORT */
    try {
      if (typeof systemPrompt.getSectionOrder === 'function') order = systemPrompt.getSectionOrder('TOOL_REPORT');
    } catch (e) { /* 保持默认 */ }
    systemPrompt.section({
      name: 'tool:ziwei',
      order,
      text: [
        '紫微斗数（紫微师）能力已装配：',
        '- 需要命盘时调用 `ziwei_paipan`（对应 `ziwei_check` 用于黄金用例自检）。它是排盘的唯一来源。',
        '- 铁律：绝不手工排盘。工具失败时停止并如实报告「排盘工具暂不可用，请稍后再试」，不要凭记忆或规则推演命盘。',
        '- 换算（真太阳时校正、时辰索引）已内置在工具里：只传原始四要素（日期 / 钟表时间 / 性别 / 出生地经度），不要自己换算。',
        '- 缺少出生钟表时间或经度时先向用户确认，不要静默任选；校正后距时辰边界不足 3 分钟要主动声明。',
        '- 用户要「人生规划报告 / 紫微解读 / 解盘」时：先 `ziwei_templates` 取九诀与鲲鹏报告 14 部分方法论，再按紫微师红线交付；报告末尾必附免责声明。'
      ].join('\n')
    });
  };

  const registerInterpretRoute = (routeCtx) => {
    const ws = routeCtx.get('webServer');
    if (!ws || typeof ws.register !== 'function') return;

    const disposers = [];

    /* 面板内「直接聊」: SSE 流式解读 */
    disposers.push(ws.register({
      kind: 'exact',
      path: '/ziwei/interpret',
      handler: (req, res) => {
        if (!guard(req, res, { methods: ['POST'], json: true })) return;
        return handleInterpret(routeCtx, core, req, res);
      }
    }));

    /* 面板「交给会话」: 把命盘上下文落到 host, 供 ziwei_context 工具取用 */
    disposers.push(ws.register({
      kind: 'exact',
      path: '/ziwei/context',
      handler: async (req, res) => {
        if (!guard(req, res, { methods: ['POST'], json: true })) return;
        const json = (status, payload) => {
          try {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          } catch (e) { /* 已发送 */ }
        };
        try {
          const payload = await readJsonBody(req, 400000);
          const stored = rememberContext(payload);
          if (stored) lastContext = stored;
          if (!stored) { json(400, { ok: false, reason: '命盘内容为空，请先排盘' }); return; }
          json(200, { ok: true, bytes: stored.fullText.length });
        } catch (e) {
          json(500, { ok: false, reason: String((e && e.message) || e) });
        }
      }
    }));

    /* 面板「交给会话」: 真的开一个新会话, 并把命盘作为首条消息灌进去 */
    disposers.push(ws.register({
      kind: 'exact',
      path: '/ziwei/handoff',
      handler: async (req, res) => {
        if (!guard(req, res, { methods: ['POST'], json: true })) return;
        const json = (status, payload) => {
          try {
            res.statusCode = status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          } catch (e) { /* 已发送 */ }
        };
        try {
          const payload = await readJsonBody(req, 400000);
          const stored = rememberContext(payload);
          if (stored) lastContext = stored;
          if (!stored) { json(400, { ok: false, reason: '命盘内容为空，请先排盘' }); return; }

          const sessionController = routeCtx.get('sessionController');
          if (!sessionController || typeof sessionController.create !== 'function' || typeof sessionController.prompt !== 'function') {
            json(503, { ok: false, reason: '本部署未挂载 sessionController，无法自动开会话。可改用「读取工作台命盘上下文」：在对话里说「读取工作台命盘并写鲲鹏报告」。' });
            return;
          }

          /* 让新会话落在「当前工作区」里，而不是 host 进程的 profile 目录 */
          let target = {};
          const cwd = stored.cwd;
          if (cwd) {
            let ws = null;
            try {
              const reg = routeCtx.get('workspaceRegistry');
              ws = reg && typeof reg.resolveByPath === 'function' ? await reg.resolveByPath(cwd) : null;
            } catch (e) { ws = null; }
            target = ws && ws.id ? { workspaceId: ws.id } : { cwd };
          } else {
            const fallback = currentWorkspaceTarget(routeCtx);
            if (fallback && fallback.workspaceId) target = { workspaceId: fallback.workspaceId };
            else if (fallback && fallback.cwd) target = { cwd: fallback.cwd };
          }
          diag('handoff target = ' + JSON.stringify(target));

          const created = await sessionController.create(target);
          const sessionId = created && created.sessionId;
          if (!sessionId) { json(500, { ok: false, reason: '会话创建失败：未返回 sessionId' }); return; }

          const text = handoffPrompt(stored, payload.mode);
          await sessionController.prompt({
            requestId: (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
              ? globalThis.crypto.randomUUID()
              : `ziwei-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }]
          }, new AbortController().signal);

          json(200, { ok: true, sessionId, bytes: text.length });
        } catch (e) {
          json(500, { ok: false, reason: String((e && e.message) || e) });
        }
      }
    }));

    /* 自检/排查用：当前工作区目标 */
    disposers.push(ws.register({
      kind: 'exact',
      path: '/ziwei/workspace',
      handler: (req, res) => {
        if (!guard(req, res, { methods: ['GET'] })) return;
        try {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, target: currentWorkspaceTarget(routeCtx) }));
        } catch (e) {
          try { res.statusCode = 500; res.end(JSON.stringify({ ok: false, reason: String(e && e.message) })); } catch (e2) { /* ignore */ }
        }
      }
    }));

    const effect = (typeof routeCtx.effect === 'function' ? routeCtx.effect.bind(routeCtx) : ctx.effect.bind(ctx));
    effect(() => disposers, 'ziwei-workbench: ziwei routes');
  };

  diag('registerTools...');
  try { registerTools(); } catch (e) { diag('  registerTools THREW: ' + String(e && e.stack || e)); ctx.logger?.warn?.(`ziwei-workbench: 工具注册失败 ${String(e && e.message)}`); }
  diag('registerSystemPrompt...');
  try { registerSystemPrompt(); } catch (e) { diag('  registerSystemPrompt THREW: ' + String(e && e.stack || e)); ctx.logger?.warn?.(`ziwei-workbench: 提示词注册失败 ${String(e && e.message)}`); }
  diag('registerRoutes...');
  /* webServer / llm 只服务面板通道，放 ctx.inject 里按需等待：没有这两个服务的 profile
     仍能正常注册 4 个排盘工具（官方 practices: optional services in ctx.inject）。 */
  try {
    const onRoutes = (routeCtx) => {
      try { registerInterpretRoute(routeCtx); } catch (e) { diag('  registerRoutes THREW: ' + String(e && e.stack || e)); ctx.logger?.warn?.(`ziwei-workbench: 路由注册失败 ${String(e && e.message)}`); }
    };
    if (typeof ctx.inject === 'function') ctx.inject(['webServer', 'llm'], onRoutes);
    else onRoutes(ctx); /* 兼容旧宿主 / 测试桩 */
  } catch (e) { diag('  ctx.inject THREW: ' + String(e && e.stack || e)); ctx.logger?.warn?.(`ziwei-workbench: 路由依赖注入失败 ${String(e && e.message)}`); }
  /* A1: 冷启动健康日志 —— 服务缺失必须显式报错，不得静默半注册（应出现在 dsh CLI stdout） */
  try {
    const missing = ['tools', 'systemPrompt'].filter((n) => {
      try { return !ctx.get(n); } catch (e) { return true; }
    });
    if (missing.length) ctx.logger?.error?.('ziwei-workbench: 冷启动缺少服务 ' + missing.join(','));
    else ctx.logger?.info?.('ziwei-workbench: 注册完成 tools=4 prompt=ok（面板路由随 webServer/llm 就绪注册）');
  } catch (e) { /* 健康日志不能影响插件 */ }
  diag('apply done');
}

/* ------------------------------------------------------------------ *
 * 诊断落盘（临时，用于定位"插件在真实 Desktop profile 里没生效"）
 * 设 ZIWEI_DIAG=0 可关闭。
 * ------------------------------------------------------------------ */
function diag(line) {
  try {
    if (process.env.ZIWEI_DIAG === '0') return;
    writeFileSync(DIAG_FILE, `${new Date().toISOString()} pid=${process.pid} ${line}\n`, { flag: 'a' });
  } catch (e) { /* 诊断本身不能影响插件 */ }
}

/* ------------------------------------------------------------------ *
 * 工作区解析
 * ------------------------------------------------------------------ */

/**
 * 找出「当前工作区」。面板（浏览器）拿不到 host 路径，所以由 host 兜底：
 * 取注册表里最近有活动的工作区，新会话才不会被丢进 profile 目录。
 */
function currentWorkspaceTarget(ctx) {
  try {
    const reg = ctx.get('workspaceRegistry');
    if (!reg || typeof reg.list !== 'function') return null;
    const list = reg.list() || [];
    let best = null;
    for (const w of list) {
      if (!w || !w.id) continue;
      const t = Date.parse(w.updatedAt || '') || 0;
      if (!best || t > best.t) best = { w, t };
    }
    if (!best) return null;
    return { workspaceId: best.w.id, cwd: best.w.path, title: best.w.title };
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------ *
 * 面板上下文 / 交给会话
 * ------------------------------------------------------------------ */

/** 解析 JSON 请求体（兼容空体）。 */
async function readJsonBody(req, limitBytes) {
  const raw = await readBody(req, limitBytes);
  if (!raw) return {};
  return JSON.parse(raw) || {};
}

/**
 * 把面板 POST 上来的命盘写进 lastContext。
 * @returns 归一化后的上下文，命盘为空时返回 null。
 */
function rememberContext(payload) {
  const p = payload || {};
  const fullText = typeof p.fullText === 'string' ? p.fullText
    : (typeof p.chartText === 'string' ? p.chartText : '');
  if (!fullText.trim()) return null;
  /* cwd 由面板前台给出（浏览器拿不到 host 路径），仅用于把新会话落到同一工作区 */
  const cwd = typeof p.cwd === 'string' ? p.cwd.slice(0, 1024) : '';
  return {
    source: 'panel',
    chartText: typeof p.chartText === 'string' ? p.chartText : fullText,
    fullText: fullText.slice(0, 300000),
    name: typeof p.name === 'string' ? p.name.slice(0, 60) : '',
    place: typeof p.place === 'string' ? p.place.slice(0, 120) : '',
    occupation: typeof p.occupation === 'string' ? p.occupation.slice(0, 200) : '',
    gender: p.gender === 'female' ? 'female' : 'male',
    interpretation: typeof p.interpretation === 'string' ? p.interpretation.slice(0, 60000) : '',
    cwd,
    at: Date.now()
  };
}

/**
 * 交给新会话时灌入的首条消息。
 * 命盘正文由面板直接带上，所以新会话不依赖 ziwei_context 是否已就绪；
 * 但工具名照旧点名，agent 仍会自己跑黄金自检。
 */
function handoffPrompt(stored, mode) {
  const head = [
    '【紫微师 · 工作台交接】',
    `我已经在紫微斗数工作台排好了盘${stored.name ? `，命主称呼：${stored.name}` : ''}${stored.place ? `，出生地：${stored.place}` : ''}${stored.occupation ? `，职业/诉求：${stored.occupation}` : ''}。`,
    '',
    '命盘数据（确定性引擎排盘，含真太阳时校正；这是唯一来源，不要再自己排一次，也不要手工推算）：',
    '',
    stored.fullText
  ];
  if (stored.interpretation) {
    head.push('', '──── 面板内已经给出的解读（请直接承接，不要重复这段内容） ────', '', stored.interpretation);
  }
  head.push(
    '',
    '──── 请你接着做 ────',
    mode === 'report'
      ? '按紫微师标准产出**完整鲲鹏报告**：先调用 `ziwei_check` 确认排盘工具完好，再用 `ziwei_templates` 取九诀与 14 部分方法论，然后交付 14 部分 + 致命主书 + 十二字心法，文末附免责声明。'
      : '先调用 `ziwei_check` 确认排盘工具完好，再用 `ziwei_templates` 取方法论，然后按紫微师标准做结构化解读（九诀至少用 6 诀、每诀至少 1 条命盘证据），需要完整报告就直接产出 14 部分 + 致命主书 + 十二字心法，文末附免责声明。',
    '若这份命盘的数据有疑点（例如时辰边界、缺少经度），先向我确认，不要静默假设。'
  );
  return head.join('\n');
}

/* ------------------------------------------------------------------ *
 * /ziwei/interpret — SSE 流式解读 (面板内「直接聊」)
 * ------------------------------------------------------------------ */
async function readBody(req, limitBytes = 300000) {
  const chunks = [];
  let size = 0;
  await new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    req.on('data', (c) => {
      size += c.length;
      if (size <= limitBytes) chunks.push(c);
    });
    req.on('end', done);
    req.on('error', done);
    req.on('close', done);
  });
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {object} [budget] 可注入的超时预算（毫秒），仅用于测试；省略时按模式取默认值。
 */
async function handleInterpret(ctx, core, req, res, budget) {
  const json = (status, payload) => {
    try {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    } catch (e) { /* 已发送 */ }
  };

  let payload = {};
  try {
    const raw = await readBody(req);
    if (raw) payload = JSON.parse(raw) || {};
  } catch (e) {
    json(400, { ok: false, reason: '请求体解析失败: ' + String((e && e.message) || e) });
    return;
  }

  /* 兼容旧调用：chart 也可以走 query */
  let chartText = typeof payload.chartText === 'string' ? payload.chartText : '';
  if (!chartText) {
    try { chartText = new URL(req.url || '', 'http://x').searchParams.get('chart') || ''; } catch (e) { chartText = ''; }
  }
  chartText = chartText.slice(0, 200000);
  if (!chartText.trim()) { json(400, { ok: false, reason: '命盘内容为空，请先排盘' }); return; }

  const llm = ctx.get('llm');
  if (!llm || typeof llm.stream !== 'function') { json(503, { ok: false, reason: 'llm 服务不可用' }); return; }

  let provider = 'deepseek-official';
  let model = 'deepseek-v4-pro';
  try {
    const sel = ctx.get('agentDefaultModel');
    const cur = sel && typeof sel.currentSelection === 'function' ? sel.currentSelection() : null;
    if (cur && cur.provider) provider = cur.provider;
    if (cur && cur.model) model = cur.model;
  } catch (e) { /* 用默认值 */ }

  const mode = payload.mode === 'report' ? 'report' : 'brief';
  const built = core.buildRequest({
    chartText,
    mode,
    question: typeof payload.question === 'string' ? payload.question.slice(0, 4000) : '',
    history: Array.isArray(payload.history) ? payload.history.slice(-20) : [],
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {}
  });

  /* 组装 llm 请求消息：host 侧没有 dsh-llm 的构造函数可用，按消息契约手工组装 */
  const toMessage = (m) => (m.role === 'assistant'
    ? { role: 'assistant', content: [{ type: 'text', text: m.content }], source: { kind: 'model', provider, model } }
    : { role: 'user', content: [{ type: 'text', text: m.content }], source: { kind: 'ziwei-workbench' } });

  const messages = built.messages.map(toMessage);

  const controller = new AbortController();
  const onClose = () => controller.abort();
  res.on('close', onClose);

  let headersSent = false;
  const sseOpen = () => {
    if (headersSent) return;
    headersSent = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
  };
  const sseSend = (event, data) => {
    sseOpen();
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch (e) { /* 连接已断 */ }
  };

  let out = '';
  let iterator = null;
  let finishKind = '';
  let usage = null;
  let thinkChars = 0;
  let truncated = false;
  let lastThinkSentAt = 0;
  const startedAt = Date.now();

  /* 输出预算 —— 旧实现把 brief 钉死在 maxTokens=2048。适配器默认开 thinking
     （reasoningEffort 缺省为 high），思考 token 与正文共用同一份 max_tokens：
     思考先吃掉几百上千 token，正文写到一半就撞上 max-tokens。这里改成
     「档位预算 + 模型自身输出上限」取小。 */
  const BUDGETS = {
    brief: { maxTokens: 8192, overallMs: 240000 },
    report: { maxTokens: 32768, overallMs: 600000 }
  };
  const plan = BUDGETS[mode] || BUDGETS.brief;
  let maxTokens = plan.maxTokens;
  const overallMs = (budget && budget.overallMs) || plan.overallMs;
  try {
    if (typeof llm.resolveModelInfo === 'function') {
      /* 目录查询只用来封顶；它若挂住不能让整个请求没有响应头，2.5s 内查不到就按档位预算走 */
      const info = await Promise.race([
        llm.resolveModelInfo(provider, model),
        new Promise((resolve) => {
          const t = setTimeout(() => resolve(null), 2500);
          if (typeof t.unref === 'function') t.unref();
        })
      ]);
      if (info && typeof info.defaultMaxTokens === 'number' && info.defaultMaxTokens > 0) {
        maxTokens = Math.min(maxTokens, info.defaultMaxTokens);
      }
    }
  } catch (e) { /* 模型不在目录里也照常发请求，沿用档位预算 */ }
  if (!(maxTokens >= 256)) maxTokens = plan.maxTokens;

  /* 先立通道再等首 token：思考阶段可能几十秒没有 delta，旧实现此时连
     响应头都还没发出去。start 帧同时让面板能把「思考中」和「没反应」分开。 */
  sseSend('start', { provider, model, mode, maxTokens, timeoutMs: overallMs });

  /* 兜底：上游模型流挂住（不 finish 也不 done）时不能让面板永远停在「解读中」。
     - 整体超时：到点 abort，并与 iterator.next() 竞态，保证一定解锁。
     - 心跳：每 15s 发一个注释帧，避免中间代理掐掉长连接。 */
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { controller.abort(); } catch (e) { /* ignore */ }
  }, overallMs);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (e) { /* 连接已断 */ }
  }, 15000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  /* abort / 客户端断连都会 reject 这个 racer，从而把 await 解开 */
  let releaseAbort;
  const abortRacer = new Promise((_, reject) => {
    releaseAbort = () => reject(new Error('aborted'));
    if (controller.signal.aborted) { releaseAbort(); return; }
    controller.signal.addEventListener('abort', releaseAbort, { once: true });
  });
  /* 没有 await 它的地方也要吞掉 rejection，避免 unhandledRejection */
  abortRacer.catch(() => {});

  try {
    let stream = llm.stream({
      provider,
      model,
      messages,
      system: built.system,
      temperature: mode === 'report' ? 0.7 : 0.6,
      maxTokens,
      signal: controller.signal
    });
    /* 真实 dsh-llm 是同步返回 AsyncIterable；若某层中间件返回 Promise，这里兜一下 */
    if (stream && typeof stream.then === 'function') stream = await stream;
    iterator = stream && typeof stream[Symbol.asyncIterator] === 'function' ? stream[Symbol.asyncIterator]() : null;
    if (!iterator) throw new Error('模型流不可迭代');

    /* abort 之后不能只靠 `signal.aborted` 检查——上游若不响应 abort，
       `await iterator.next()` 会永远挂着，超时分支与 finally 都不会执行。
       所以把 next() 与 abort 做成竞态：谁先来谁结束。 */
    for (;;) {
      if (controller.signal.aborted) break;
      const step = await Promise.race([iterator.next(), abortRacer]);
      if (!step || step.done) break;
      const chunk = step.value;
      if (!chunk) continue;
      if (chunk.type === 'text-delta' && chunk.text) {
        out += chunk.text;
        sseSend('delta', { text: chunk.text });
      } else if (chunk.type === 'reasoning-delta' && chunk.text) {
        /* 思考内容是可见性的一环：面板据此显示「思考中」，也计入预算解释 */
        thinkChars += chunk.text.length;
        if (Date.now() - lastThinkSentAt > 1200) {
          lastThinkSentAt = Date.now();
          sseSend('thinking', { chars: thinkChars });
        }
      } else if (chunk.type === 'usage' && chunk.usage) {
        usage = chunk.usage;
      } else if (chunk.type === 'finish') {
        finishKind = (chunk.reason && chunk.reason.kind) || '';
        if (finishKind === 'error') {
          const f = chunk.reason.failure || {};
          throw new Error('模型调用失败: ' + (f.message || f.code || 'unknown'));
        }
        if (finishKind === 'aborted' && !controller.signal.aborted) {
          const f = chunk.reason.failure || {};
          throw new Error('模型调用被中断: ' + (f.message || f.code || 'unknown'));
        }
        if (finishKind === 'max-tokens') truncated = true;
        break;
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const stats = { chars: out.length, thinkingChars: thinkChars, elapsedMs, usage: usage || null };
    diagInterpret(`interpret mode=${mode} model=${provider}/${model} maxTokens=${maxTokens} finish=${finishKind || '(none)'} timedOut=${timedOut} ${JSON.stringify(stats)}`);

    if (timedOut) {
      const reason = `解读超时（${Math.round(overallMs / 1000)}s）${out.trim() ? '，已保留已生成部分；可点「继续生成」接着写' : '，请重试'}`;
      sseSend('error', Object.assign({ reason, kind: 'timeout', canContinue: !!out.trim() }, stats));
    } else if (truncated || finishKind === 'max-tokens') {
      /* 关键修复：命中输出上限不是「正常结束」。旧实现把它当 stop 发 done，
         客户端于是把半截正文当完整结果保存下来，看起来就是「输出一半就中断」。 */
      const reason = `输出达到长度上限（maxTokens=${maxTokens}，含思考 token），已保留前文；可点「继续生成」接着写`;
      sseSend('error', Object.assign({ reason, kind: 'max-tokens', canContinue: true, maxTokens }, stats));
    } else if (!finishKind) {
      const reason = out.trim()
        ? '模型流意外结束（没收到结束标记），内容可能不完整；可点「继续生成」接着写'
        : '模型返回为空';
      sseSend('error', Object.assign({ reason, kind: 'stream-closed', canContinue: !!out.trim() }, stats));
    } else if (!out.trim()) {
      sseSend('error', Object.assign({ reason: '模型返回为空', kind: 'empty' }, stats));
    } else {
      sseSend('done', Object.assign({ text: out, provider, model, mode, finish: finishKind }, stats));
    }
  } catch (e) {
    const abortByClient = controller.signal.aborted && !timedOut;
    const reason = timedOut
      ? `解读超时（${Math.round(overallMs / 1000)}s）${out.trim() ? '，已保留已生成部分；可点「继续生成」接着写' : '，请重试'}`
      : String((e && e.message) || e);
    const stats = { chars: out.length, thinkingChars: thinkChars, elapsedMs: Date.now() - startedAt, usage: usage || null };
    diagInterpret(`interpret mode=${mode} model=${provider}/${model} maxTokens=${maxTokens} finish=${finishKind || '(none)'} timedOut=${timedOut} abortByClient=${abortByClient} error=${reason} ${JSON.stringify(stats)}`);
    if (headersSent) {
      sseSend('error', Object.assign({
        reason,
        kind: timedOut ? 'timeout' : (abortByClient ? 'aborted' : 'error'),
        canContinue: !!out.trim() && !abortByClient
      }, stats));
    } else {
      json(500, { ok: false, reason });
    }
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
    controller.signal.removeEventListener('abort', releaseAbort);
    res.removeListener('close', onClose);
    try { res.end(); } catch (e) { /* ignore */ }
    /* 收尾响应之后再尽力关闭迭代器，且**绝不 await**：
       Promise.race 丢弃的那个 next() 仍挂在 async generator 的请求队列上，
       而 return() 会被串行排到它后面 —— 它永不 settle，await 就会把
       res.end() 一起拖住，导致超时后响应永不关闭、连接泄漏。
       这里 fire-and-forget，结果无人关心。 */
    if (iterator && typeof iterator.return === 'function') {
      try { Promise.resolve(iterator.return()).catch(() => {}); } catch (e) { /* ignore */ }
    }
  }
}
