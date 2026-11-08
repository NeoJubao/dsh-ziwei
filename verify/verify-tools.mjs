/**
 * verify/verify-tools.mjs — 用真实 dsh-tools 校验工具定义
 *
 * verify.mjs 里的假 tools 服务 {register: d => …} 不做任何校验，
 * 这正是 output.schema:{type:'json'} 曾经漏过 58/58 全绿的原因。
 * 这里改用真实的 ToolRuntime + SystemPrompt 挂载插件，再用真实的
 * assertSupportedJsonSchema 校验每个已注册的工具定义。
 * （第一轮的 P0 正是因为假 tools 服务不做校验才漏过 58/58 全绿。）
 *
 * 运行: node verify/verify-tools.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { EventEmitter } from 'node:events';
import { resolveRunner, runnerMissingHint } from './runner-path.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 定位本机 DSH 安装里的 @deepseek-ai/* 包（真实 ToolRuntime 校验用）。
 * 不写死用户主目录绝对路径：按 env → 常见安装位置 → 激活中的 profile 依次探测；
 * 全部缺失时 verify/all 会把本子套件标成「已跳过」而不是假装通过。
 */
function dshNodeModules() {
  const candidates = [
    process.env.DSH_NODE_MODULES,
    process.env.DSH_PROFILE_DIR ? join(process.env.DSH_PROFILE_DIR, 'node_modules') : '',
    process.env.DSH_HOME ? join(process.env.DSH_HOME, 'profiles', process.env.DSH_PROFILE || 'desktop', 'node_modules') : '',
    join(homedir(), '.bun', 'install', 'global', 'node_modules'),
    join(homedir(), '.dsh', 'profiles', process.env.DSH_PROFILE || 'desktop', 'node_modules'),
    join(homedir(), '.npm-global', 'lib', 'node_modules')
  ].filter(Boolean);
  return candidates.find((dir) => existsSync(join(dir, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js'))) || '';
}
const NODE_MODULES = dshNodeModules();
const TOOLS_LIB = NODE_MODULES ? join(NODE_MODULES, '@deepseek-ai', 'dsh-tools', 'lib', 'index.js') : '';
const CORDIS_LIB = NODE_MODULES ? join(NODE_MODULES, '@deepseek-ai', 'cordis', 'lib', 'index.js') : '';
const PROMPT_LIB = NODE_MODULES ? join(NODE_MODULES, '@deepseek-ai', 'dsh-system-prompt', 'lib', 'index.js') : '';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
};

let toolsLib = null;
const SKIP_OK = process.env.ZIWEI_ALLOW_SKIP === '1';
/* 专用跳过退出码: 让聚合器认退出码而不是认文案（文案改了就静默退绿的坑） */
const EXIT_SKIPPED = 3;
let toolsLibError = null;
try { toolsLib = TOOLS_LIB ? await import(pathToFileURL(TOOLS_LIB).href) : null; } catch (e) { toolsLibError = e; toolsLib = null; }
if (!toolsLib) {
  const msg = `无法加载真实 dsh-tools：${String((toolsLibError && toolsLibError.message) || (TOOLS_LIB ? '未知错误' : '本机未找到 @deepseek-ai/dsh-tools'))}`;
  if (SKIP_OK) { console.log(`⚠️  SKIPPED（ZIWEI_ALLOW_SKIP=1）: ${msg}`); process.exit(EXIT_SKIPPED); }
  console.error(`❌ ${msg}`);
  console.error('   真实 ToolRuntime/ToolSchema 校验是拦住"工具静默全部不注册"的唯一哨兵；');
  console.error('   请恢复 DSH 安装，或显式设置 ZIWEI_ALLOW_SKIP=1 表示你接受本次跳过后再跑。');
  process.exit(1);
}
const { assertSupportedJsonSchema } = toolsLib;

/* 真正捕获注册的 ctx */
const registered = new Map();
const routes = new Map();
const promptSections = [];
const warnings = [];

const plugin = await import(pathToFileURL(join(root, 'index.js')).href + '?v=' + Date.now());

/* 真实 ToolRuntime + SystemPrompt：让 dsh-tools 自己的校验真正跑起来 */
let realTools = null;
try {
  const { Context } = await import(pathToFileURL(CORDIS_LIB).href);
  const ToolRuntimeMod = await import(pathToFileURL(TOOLS_LIB).href);
  const SystemPromptMod = await import(pathToFileURL(PROMPT_LIB).href);
  const realCtx = new Context();
  new (SystemPromptMod.default || SystemPromptMod)(realCtx, {});
  realTools = new (ToolRuntimeMod.default || ToolRuntimeMod)(realCtx, {});
} catch (e) {
  console.log(`  ⚠️  真实 ToolRuntime 不可用，退回轻量桩: ${String(e.message).split('\n')[0]}`);
}

plugin.apply({
  get(name) {
    if (name === 'tools') {
      if (realTools) return realTools;
      return { register: (d) => { registered.set(d.name, d); return () => registered.delete(d.name); } };
    }
    if (name === 'systemPrompt') return { section: (s) => { promptSections.push(s); return () => {}; }, getSectionOrder: () => 2900 };
    if (name === 'webServer') return { register: (r) => { routes.set(r.path, r); return () => routes.delete(r.path); } };
    if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) };
    if (name === 'llm') return { stream: () => (async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; })() };
    return undefined;
  },
  effect: () => () => {},
  logger: { warn: (m) => warnings.push(m), info: () => {}, error: () => {} }
});

console.log('== 真实 dsh-tools 契约校验 ==');
if (realTools) {
  /* 唯一的真相来源：真实 runtime 自己的 get()，不再依赖桩记录 */
  for (const n of ['ziwei_paipan', 'ziwei_check', 'ziwei_templates', 'ziwei_context']) {
    const d = realTools.get(n);
    if (d) registered.set(n, d);
  }
  const visible = realTools.schemas().filter((x) => x.name.startsWith('ziwei_')).length;
  ok('真实 ToolRuntime 里 4 个 ziwei_* 工具均已注册', visible === 4, `实际 ${visible} 个可见`);
}
ok('4 个工具全部注册成功', registered.size === 4, `实际 ${registered.size}: ${[...registered.keys()].join(',')}`);
ok('注册过程零警告', warnings.length === 0, warnings.join(' | '));

/* 逐个用 dsh-tools 自己的校验器验收 */
for (const [name, def] of registered) {
  let paramErr = null, outErr = null;
  try { assertSupportedJsonSchema(def.parameters); } catch (e) { paramErr = e.message; }
  try { assertSupportedJsonSchema(def.output.schema); } catch (e) { outErr = e.message; }
  ok(`${name}: parameters 是受支持的 JSON Schema`, paramErr === null, paramErr);
  ok(`${name}: output.schema 是受支持的 JSON Schema`, outErr === null, outErr);
  ok(`${name}: output.render 返回 ContentBlock[]`, (() => {
    try {
      const blocks = def.output.render({}, { text: 'x' });
      return Array.isArray(blocks) && blocks.length > 0 && blocks.every((b) => b && typeof b.type === 'string');
    } catch (e) { return false; }
  })());
  ok(`${name}: 带 execute 函数`, typeof def.execute === 'function');
}

/* 参数必填项在真实 registry 下不被校验（我们手工构造定义），
   所以插件必须自己兜。这里把"静默兜底"当作回归红线来测。 */
console.log('\n== 缺参必须拒绝，不得静默兜底 ==');
const paipan = registered.get('ziwei_paipan');
const tryCall = async (args) => {
  try { return { ok: true, value: await paipan.execute(args, {}) }; }
  catch (e) { return { ok: false, error: String(e && e.message) }; }
};

const noGender = await tryCall({ date: '1992-05-03', time: '09:30' });
ok('缺 gender → 拒绝（不得默认男命）', noGender.ok === false && /gender/.test(noGender.error), noGender.error || JSON.stringify(noGender.value && noGender.value.text));

const badGender = await tryCall({ date: '1992-05-03', time: '09:30', gender: 'x' });
ok('gender 非法 → 拒绝', badGender.ok === false && /gender/.test(badGender.error), badGender.error);

const noTime = await tryCall({ date: '1992-05-03', gender: 'male' });
ok('缺 time → 拒绝', noTime.ok === false && /钟表时间/.test(noTime.error), noTime.error);

const male = await tryCall({ date: '1992-05-03', time: '09:30', gender: 'male', longitude: 105.97 });
const female = await tryCall({ date: '1992-05-03', time: '09:30', gender: 'female', longitude: 105.97 });
ok('男/女盘确实不同（证明性别真的参与排盘）', male.ok && female.ok && male.value.text !== female.value.text);

/* 晚子时口径：与独立版一致（按当日，不换日） */
/* 晚子时口径必须是「按当日」——用独立版 runner 的命宫主星作为黄金值核对，
   而不是只看文本里有没有出现 '23:30'（那种断言在口径退回换日派时照样通过）。 */
const lateRat = await tryCall({ date: '1985-07-15', time: '23:30', gender: 'male', longitude: 116.4 });
const RUNNER = resolveRunner();
let refSoulMajors = null;
/* 有来源产品 runner 时用它（最强证据）；没有时退回随仓库提交的 fixture。 */
try {
  let ref = null;
  if (RUNNER) {
    const { execFileSync } = await import('node:child_process');
    ref = JSON.parse(execFileSync('node', [RUNNER, '1985-07-15', '23:30', '男', '116.4'], { encoding: 'utf8' }));
  } else {
    const fixtureFile = join(root, 'verify', 'fixtures', 'paipan-reference.json');
    if (existsSync(fixtureFile)) {
      const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
      ref = fixture && fixture.cases ? fixture.cases['1985-07-15T23:30|男|116.4'] : null;
    }
  }
  if (!ref) throw new Error(runnerMissingHint());
  const soul = ref.十二宫.find((x) => x.宫 === '命宫');
  refSoulMajors = (soul.主星 || []).map((x) => String(x).replace(/[（(].*$/, '')).sort().join(',');
} catch (e) { refSoulMajors = null; }
if (refSoulMajors === null) {
  if (SKIP_OK) {
    console.log('  ⚠️  SKIPPED（ZIWEI_ALLOW_SKIP=1）: 晚子时黄金值核对（独立版 runner 不可用）');
  } else {
    fail++;
    console.log('  ❌ 无法核对晚子时口径：独立版 runner 不可用（这会让"口径与来源一致"失去保证）');
  }
} else {
  const m = lateRat.ok ? lateRat.value.text.match(/命宫\([^)]*\)\s*(?:大限[^|]*\|)?\s*([^\n]*)/) : null;
  /* 直接从工具返回的命盘正文里取「命宫(...)」那一行的星曜 */
  const line = (lateRat.value.text.split('\n').find((l) => /^命宫\(/.test(l.trim()) || /(^|\s)命宫\(/.test(l)) || '');
  const got = (line.match(/[\u4e00-\u9fa5]{2}\[[^\]]*\]/g) || [])
    .map((x) => x.replace(/\[.*$/, '')).sort().join(',');
  ok('晚子时默认口径的命宫主星与独立版一致', got === refSoulMajors,
    `ref=[${refSoulMajors}] wb=[${got}] (line=${JSON.stringify(line)})`);
}

/* dayDivide 逃生阀：默认 current，显式 forward 才切流派 */
const def = await tryCall({ date: '1985-07-15', time: '23:30', gender: 'male', longitude: 116.4 });
const fwd = await tryCall({ date: '1985-07-15', time: '23:30', gender: 'male', longitude: 116.4, dayDivide: 'forward' });
ok('dayDivide 默认 current，显式 forward 会排出不同的盘',
  def.ok && fwd.ok && def.value.text !== fwd.value.text,
  def.ok && fwd.ok ? '两盘相同（逃生阀失效）' : (def.error || fwd.error));

/* 黄金用例自检 */
const check = registered.get('ziwei_check');
const goldenRes = await check.execute({}, {});
ok('ziwei_check 报 4/4', goldenRes.ok === true && /4\/4/.test(goldenRes.text), goldenRes.text.slice(0, 120));

console.log(`\n${'='.repeat(52)}`);
console.log(`真实契约自检: ${pass} 通过, ${fail} 失败`);
console.log('='.repeat(52));
process.exit(fail === 0 ? 0 : 1);
