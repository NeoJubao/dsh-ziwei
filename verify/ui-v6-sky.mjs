/**
 * verify/ui-v6-sky.mjs — 3D 星图进包的方式（T2）
 *
 * 由 verify/ui-v6.mjs 调用。能在 vm 里查的只有"怎么装进去、怎么退回来"：
 *   - vendor/three-r128.min.js 没被改过；Three.js 和场景代码包在 __ziweiBootstrapSky() 里，加载和 factory 都不执行它
 *   - 第一次调用才求值，之后是同一个对象；不产生 window.THREE
 *   - 没有 WebGL 时拿到的是接口齐全的空实现：dive / birth 仍然回调，dispose 可以重复调用
 * 画面、帧率、停放和释放有没有泄漏，自检做不到，要在浏览器里看（audit/sky-dev/、预览壳）。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { THREE_SHA384 } from '../build.mjs';
import { loadBundle } from './client-harness.mjs';

const API = ['setPlanets', 'focus', 'hover', 'layers', 'onHover', 'onPick', 'onGesture', 'onLost', 'grade', 'scrim', 'show', 'replay',
  'dive', 'rise', 'birth', 'resize', 'park', 'reopen', 'isDead', 'dispose'];

export default async function sky(t) {
  const { ok, section } = t;
  section('v6 3D 星图：进包与退路');

  const threePath = join(t.root, 'vendor', 'three-r128.min.js');
  const skyPath = join(t.root, 'src', 'sky.js');
  const have = existsSync(threePath) && existsSync(skyPath);
  ok('vendor/three-r128.min.js 和 src/sky.js 都在', have);
  if (!have) return;

  const buf = readFileSync(threePath);
  ok('Three.js 的 SHA-384 等于固定值（和 cdnjs 的 SRI 一致）',
    THREE_SHA384 === 'CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu' &&
    createHash('sha384').update(buf).digest('base64') === THREE_SHA384);
  ok('Three.js 文件带着自己的 MIT 版权头', /^\/\*\*\s*\n \* @license\s*\n \* Copyright 2010-2021 Three\.js Authors\s*\n \* SPDX-License-Identifier: MIT/.test(buf.toString('utf8', 0, 200)));

  const skySrc = readFileSync(skyPath, 'utf8');
  ok('src/sky.js 定义时不碰全局和 DOM（不读 window.THREE、不按 id 取节点、没有 setInterval）',
    !/window\.THREE/.test(skySrc) && !/getElementById/.test(skySrc) && !/setInterval\(/.test(skySrc) && /^function createSky\(T, canvas, opts\)/m.test(skySrc));

  ok('3D 这一段进了 bundle，排在界面之前', !!t.sky && !!t.client && t.client.indexOf('function __ziweiBootstrapSky()') > 0 &&
    t.client.indexOf('function __ziweiBootstrapSky()') < t.client.indexOf('window.__ModuleLoader__.load('));

  const b = t.client ? loadBundle(t.client) : null;
  ok('整个 bundle（含 Three.js）能在裸 vm 里求值', !!b && !b.error, b && b.error && b.error.message);
  if (!b || b.error) return;
  const ctx = b.sandbox;
  const run = (code) => vm.runInContext(code, ctx);
  ok('加载之后还没有执行 Three.js（没有 THREE，也没有它的版本标记）',
    run('typeof THREE') === 'undefined' && b.win.THREE === undefined && b.win.__THREE__ === undefined && run('typeof __ziweiBootstrapSky.api') === 'undefined');
  let matErr = null;
  try { b.materialize(); } catch (e) { matErr = e; }
  ok('factory 物化之后仍然没有执行 Three.js', !matErr && run('typeof __ziweiBootstrapSky.api') === 'undefined', matErr && matErr.message);

  let api = null, bootErr = null;
  try { api = run('__ziweiBootstrapSky()'); } catch (e) { bootErr = e; }
  ok('第一次调用 __ziweiBootstrapSky() 才求值，返回 acquire / release / destroy / create',
    !bootErr && !!api && ['acquire', 'release', 'destroy', 'create'].every((k) => typeof api[k] === 'function'), bootErr && bootErr.message);
  if (!api) return;
  ok('再调用一次是同一个对象', run('__ziweiBootstrapSky()') === api);
  ok('求值之后也没有 window.THREE', b.win.THREE === undefined && run('typeof THREE') === 'undefined');

  /* 没有 WebGL：getContext 返回 null 的画布 */
  const fakeCanvas = { getContext: () => null, addEventListener() {}, removeEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, clientWidth: 300, clientHeight: 200 };
  let stub = null, stubErr = null;
  try { stub = api.create(fakeCanvas, {}); } catch (e) { stubErr = e; }
  ok('没有 WebGL 时 create() 不抛错，返回 ok: false', !stubErr && !!stub && stub.ok === false, stubErr && stubErr.message);
  if (!stub) return;
  const missing = API.filter((k) => typeof stub[k] !== 'function');
  ok('空实现的接口齐全', missing.length === 0, 'missing: ' + missing.join(', '));
  let dove = false, born = false, threw = null;
  try {
    stub.dive('x', '#000', () => { dove = true; });
    stub.birth('x', () => { born = true; });
    stub.setPlanets([]); stub.layers(null, null, null); stub.grade(true, true); stub.show(false);
    stub.dispose(); stub.dispose();
  } catch (e) { threw = e; }
  ok('空实现里 dive / birth 仍然回调，dispose 可以调两次', !threw && dove && born, threw && threw.message);
  ok('空实现报告自己不可用（isDead）', stub.isDead() === true);

  /* 停放的入口对不可用的场景是空操作 */
  let relErr = null;
  try { api.release(stub); api.release(null); api.destroy(); } catch (e) { relErr = e; }
  ok('release / destroy 对不可用的场景是空操作', !relErr, relErr && relErr.message);
}
