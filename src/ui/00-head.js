/* ================================================================
 * 00-head：React 别名、引擎、版本号
 *
 * src/ui/ 的约定（build.mjs 按文件名顺序把这些文件拼进同一个 factory 闭包，见 spec §4.1）：
 * - 每个文件是一组语法完整的顶层声明，顶层声明写在行首；文件之间直接用名字互相引用，不 import。
 *   重名的顶层声明、CSS 里的反引号 / ${ / 反斜杠、重复的 i18n 键，构建都会直接报错。
 * - 只用这几个 React API：createElement、Component、useState、useEffect、useLayoutEffect、useMemo、useRef。
 * - 渲染函数里不碰 DOM、WebGL、定时器，这些都放进 effect；apply() 里只做样式注入这一件碰 DOM 的事；
 *   读写 localStorage 一律包 try/catch。
 * ================================================================ */
const React = require('react');
const h = React.createElement;
const { useState, useEffect, useMemo, useRef } = React;
const useLayoutEffect = React.useLayoutEffect || useEffect;
/* 引擎在 factory 开头由 __ziweiBootstrapKernel() 物化，这里只取引用 */
const E = window.ZWEngine;
/* 构建时由 build.mjs 换成 package.json 的版本号 */
const APP_VERSION = '__ZIWEI_VERSION__';
