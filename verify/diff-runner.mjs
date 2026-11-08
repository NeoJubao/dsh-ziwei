/**
 * verify/diff-runner.mjs — 与独立版 run-paipan.js 逐字段差分
 *
 * 用一批跨世纪 / 边界 / 晚子时 / 各经度 / 男女的用例，把工作台引擎与
 * 来源产品（iztro runner）逐字段比对。任何命盘级差异都视为回归。
 *
 * 运行: node verify/diff-runner.mjs
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { resolveRunner, runnerMissingHint } from './runner-path.mjs';
import { CASES } from './cases.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = resolveRunner();

/* 差分来源优先级：
 *   1. 真实来源产品 runner（ZIWEI_RUNNER 或默认安装位置）——最强证据；
 *   2. 无 runner 时退回随仓库提交的 fixture（verify/fixtures/paipan-reference.json）。
 *      fixture 是某次从来源产品 runner 捕获的逐用例原始输出，离线 CI 仍能守住
 *      「与来源产品逐字段一致」；要重新捕获用 `node verify/diff-runner.mjs --write-fixture`。
 *   3. 两者都没有才失败；显式 ZIWEI_ALLOW_SKIP=1 时按退出码 3 跳过。 */
const FIXTURE_FILE = join(root, 'verify', 'fixtures', 'paipan-reference.json');
const WRITE_FIXTURE = process.argv.includes('--write-fixture');
const FORCE_FIXTURE = process.argv.includes('--fixture');
const fixture = existsSync(FIXTURE_FILE) ? JSON.parse(readFileSync(FIXTURE_FILE, 'utf8')) : null;
const SKIP_OK = process.env.ZIWEI_ALLOW_SKIP === '1';
const EXIT_SKIPPED = 3;
const MODE = RUNNER && !FORCE_FIXTURE ? 'runner' : (fixture ? 'fixture' : 'none');
const caseKey = (date, time, genderCn, lon) => `${date}T${time}|${genderCn}|${lon}`;
if (MODE === 'none' && !WRITE_FIXTURE) {
  const msg = runnerMissingHint();
  if (SKIP_OK) { console.log(`⚠️  SKIPPED（ZIWEI_ALLOW_SKIP=1）: ${msg}`); process.exit(EXIT_SKIPPED); }
  console.error(`❌ 无法差分：${msg}`);
  console.error('   或提交 verify/fixtures/paipan-reference.json（有来源产品 runner 时用 --write-fixture 生成）。');
  process.exit(1);
}
if (!RUNNER && WRITE_FIXTURE) {
  console.error('❌ --write-fixture 需要来源产品 runner；' + runnerMissingHint());
  process.exit(1);
}
/* 装载工作台引擎 + 内核 */
const sb = { console };
sb.window = sb; sb.globalThis = sb; sb.self = sb;
const ctxVm = vm.createContext(sb);
new vm.Script(readFileSync(join(root, 'engine-built.js'), 'utf8')).runInContext(ctxVm);
new vm.Script(readFileSync(join(root, 'src', 'ziwei-core.js'), 'utf8')).runInContext(ctxVm);
const core = sb.ZWCore;

const norm = (arr) => (arr || []).map((s) => String(s).replace(/[（(].*$/, '')).sort().join(',');
const bright = (arr) => (arr || []).map((s) => String(s)).sort().join(',');

let pass = 0;
const failures = [];

const captured = {};
for (const [date, time, genderCn, lon] of CASES) {
  let ref;
  try {
    if (MODE === 'runner') {
      ref = JSON.parse(execFileSync('node', [RUNNER, date, time, genderCn, String(lon)], { encoding: 'utf8' }));
      captured[caseKey(date, time, genderCn, lon)] = ref;
    } else {
      ref = fixture && fixture.cases ? fixture.cases[caseKey(date, time, genderCn, lon)] : null;
      if (!ref) { failures.push(`${date} ${time} ${genderCn} ${lon}: fixture 缺少该用例（重新生成 fixture）`); continue; }
    }
  } catch (e) {
    failures.push(`${date} ${time} ${genderCn} ${lon}: runner 执行失败 ${String(e.message).split('\n')[0]}`);
    continue;
  }
  const mine = core.paipan({ date, time, gender: genderCn === '男' ? 'male' : 'female', longitude: lon });
  if (!mine.ok) { failures.push(`${date} ${time}: 工作台排盘失败 ${mine.error}`); continue; }
  const c = mine.chart;

  const diffs = [];
  const corr = c.meta.solarCorrection || {};
  if (ref.校正.校正后真太阳时 !== corr.solarTime) diffs.push(`真太阳时 ref[${ref.校正.校正后真太阳时}] wb[${corr.solarTime}]`);
  /* 时辰索引表示差异（非命盘差异）：工作台把 晚子时(23:00-24:00) 记为 12、早子时记为 0，
     iztro 把两者都记为 0。dayDivide=current 下两者排出的盘完全相同，故归一化后再比。 */
  const refIdx = ref.时辰索引;
  const wbIdx = c.timeIndex === 12 ? 0 : c.timeIndex;
  if (refIdx !== wbIdx) diffs.push(`时辰索引 ref[${refIdx}] wb[${c.timeIndex}]`);
  if (ref.五行局 !== c.fiveElementsClass) diffs.push(`五行局 ref[${ref.五行局}] wb[${c.fiveElementsClass}]`);
  if (ref.命宫地支 !== c.soulBranch) diffs.push(`命宫 ref[${ref.命宫地支}] wb[${c.soulBranch}]`);
  if (ref.身宫地支 !== c.bodyBranch) diffs.push(`身宫 ref[${ref.身宫地支}] wb[${c.bodyBranch}]`);
  if (ref.命主 !== c.soulMaster) diffs.push(`命主 ref[${ref.命主}] wb[${c.soulMaster}]`);
  if (ref.身主 !== c.bodyMaster) diffs.push(`身主 ref[${ref.身主}] wb[${c.bodyMaster}]`);
  if (ref.生肖 !== c.zodiac) diffs.push(`生肖 ref[${ref.生肖}] wb[${c.zodiac}]`);

  const refByPalace = {};
  ref.十二宫.forEach((p) => { refByPalace[p.宫] = p; });
  for (const p of c.palaces) {
    const rp = refByPalace[p.name];
    if (!rp) { diffs.push(`缺宫 ${p.name}`); continue; }
    if (norm(rp.主星) !== norm(p.major.map((s) => s.name))) {
      diffs.push(`${p.name}主星 ref[${norm(rp.主星)}] wb[${norm(p.major.map((s) => s.name))}]`);
    }
    if (bright(rp.主星) !== bright(p.major.map((s) => `${s.name}(${s.brightness})`))) {
      diffs.push(`${p.name}庙旺 ref[${bright(rp.主星)}] wb[${bright(p.major.map((s) => `${s.name}(${s.brightness})`))}]`);
    }
    if (norm(rp.辅星) !== norm(p.minor.map((s) => s.name))) {
      diffs.push(`${p.name}辅星 ref[${norm(rp.辅星)}] wb[${norm(p.minor.map((s) => s.name))}]`);
    }
    if (norm(rp.杂曜) !== norm(p.adjective)) {
      diffs.push(`${p.name}杂曜 ref[${norm(rp.杂曜)}] wb[${norm(p.adjective)}]`);
    }
    const refSihua = (rp.四化 || []).map((s) => s.replace(/^.*?(\S+)化(\S)$/, '$1$2')).sort().join(',');
    const wbSihua = c.mutagens.filter((m) => m.palaceName === p.name).map((m) => `${m.star}${m.mutagen}`).sort().join(',');
    if (refSihua !== wbSihua) diffs.push(`${p.name}四化 ref[${refSihua}] wb[${wbSihua}]`);
  }

  if (diffs.length === 0) { pass++; console.log(`  ✅ ${date} ${time} ${genderCn} ${lon}°E`); }
  else {
    console.log(`  ❌ ${date} ${time} ${genderCn} ${lon}°E`);
    diffs.slice(0, 6).forEach((d) => console.log(`       ${d}`));
    if (diffs.length > 6) console.log(`       …还有 ${diffs.length - 6} 项`);
    failures.push(`${date} ${time} ${genderCn} ${lon}: ${diffs.length} 项差异`);
  }
}

if (MODE === 'runner' && WRITE_FIXTURE) {
  mkdirSync(dirname(FIXTURE_FILE), { recursive: true });
  const payload = {
    _comment: '从「紫微师」来源产品 run-paipan.js 捕获的逐用例原始输出（Chinese keys 原样保留）。',
    _capturedAt: new Date().toISOString(),
    _caseKey: 'dateTtime|gender|longitude',
    cases: captured
  };
  writeFileSync(FIXTURE_FILE, JSON.stringify(payload, null, 2) + '\n');
  console.log(`已写入 fixture: ${FIXTURE_FILE}（${Object.keys(captured).length} 用例）`);
  process.exit(failures.length === 0 ? 0 : 1);
}

console.log(`\n差分结果: ${pass}/${CASES.length} 用例逐字段一致（来源: ${MODE === 'runner' ? '来源产品 runner' : 'fixture（无 runner 时离线复验）'}）`);
if (failures.length) {
  console.log('\n失败用例:');
  failures.forEach((f) => console.log('  - ' + f));
}
process.exit(failures.length === 0 ? 0 : 1);
