/* ================================================================
 * 66-settings：设置弹层（T9）。ProApp 在 session.modal === 'settings' 时渲染 SettingsModal；外框用 50-parts 的 Modal
 * （遮罩、焦点陷阱、Esc、焦点归还）。结构见 css/50-parts.css 的"表单控件"一段：
 *   div.zp-setting > div.zp-setting-text（b 标题 + span 说明）+ 右边的开关或按钮
 * 六块：外观（prefs.theme：深色 / 浅色 / 跟随 DSH，默认深色）、启动时自动打开工作台（prefs.autoOpen）、首页 3D 星图（prefs.sky）、本机数据（清除对话与报告，要点两次；
 * 有任务在跑时不能清）、版本和检查更新、回到 DSH 对话（props.actions.canReturnToConversation 为真时）、关于。
 * 检查更新只在点击时请求一次 /ziwei/version（store.checkVersion）；没有轮询、没有定时器。
 * 更新命令是给终端用的原文，不翻译。
 * ================================================================ */

const SET_UPDATE_CMD = 'dsh plugin --profile <profile> update dsh-ziwei';

function setShellOf(s) {
  return { autoOpen: !!s.prefs.autoOpen, sky: !!s.prefs.sky, theme: s.prefs.theme, busy: Object.keys(s.jobs).length > 0 };
}

/* 一行设置：左边标题和说明，右边一个控件；extra 是说明下面多出来的内容 */
function setRow(key, title, hint, control, extra) {
  return h('div', { key: key, className: 'zp-setting' },
    h('div', { className: 'zp-setting-text' }, h('b', null, title), hint ? h('span', null, hint) : null, extra || null),
    control);
}

function setSwitch(label, on, onToggle) {
  return h('button', {
    className: 'zp-switch', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': label, title: label,
    onClick: function () { onToggle(!on); }
  });
}

function SettingsModal(props) {
  const m = useStore(setShellOf);
  const actions = (props && props.actions) || null;
  const store = appStore();
  /* 检查更新的结果只在这次打开里有用：null | { checking } | { result } */
  const [update, setUpdate] = useState(null);
  const alive = useRef(true);
  useEffect(function () {
    alive.current = true;
    return function () { alive.current = false; };
  }, []);
  const checking = !!(update && update.checking);
  const check = function () {
    if (checking) return;
    setUpdate({ checking: true });
    store.checkVersion().then(function (result) {
      if (alive.current) setUpdate({ result: result || {} });
    });
  };
  const r = update && update.result ? update.result : null;
  let verdict = null;
  if (r && r.ok && r.updateAvailable) {
    verdict = [
      h('p', { key: 'line', className: 'zp-update' }, t('setUpdateAvailable', { latest: r.latest || '?' })),
      h('code', { key: 'cmd', className: 'zp-update-cmd' }, SET_UPDATE_CMD)
    ];
  } else if (r && r.ok) {
    verdict = h('p', { className: 'zp-update' }, t('setUpToDate', { version: r.current || APP_VERSION }));
  } else if (r) {
    verdict = h('p', { className: 'zp-update zp-err' }, t('setUpdateFailed', { reason: r.reason || 'unknown' }));
  }
  return h(Modal, { title: t('headSettings'), onClose: closeLayers },
    setRow('theme', t('setTheme'), t('setThemeHint'),
      h(Seg, {
        radio: true, label: t('setTheme'), value: m.theme,
        items: [
          { id: 'dark', label: t('setThemeDark') },
          { id: 'light', label: t('setThemeLight') },
          { id: 'auto', label: t('setThemeAuto') }
        ],
        onChange: function (id) { store.setPref('theme', id); }
      })),
    setRow('auto', t('setAutoOpen'), t('setAutoOpenHint'),
      setSwitch(t('setAutoOpen'), m.autoOpen, function (v) { store.setPref('autoOpen', v); })),
    setRow('sky', t('setSky'), t('setSkyHint'),
      setSwitch(t('setSky'), m.sky, function (v) { store.setPref('sky', v); })),
    setRow('local', t('setLocal'), t('setLocalHint'),
      h(ConfirmButton, {
        className: 'zp-btn zp-sm', label: t('setClear'), confirmLabel: t('setClearConfirm'),
        disabled: m.busy, title: m.busy ? t('setClearBusy') : undefined,
        onConfirm: function () { if (store.clearLocalRecords()) store.showToast(t('setCleared')); }
      })),
    setRow('version', t('setVersion', { version: APP_VERSION }), t('setUpdateHint'),
      h('button', { className: 'zp-btn zp-sm', type: 'button', disabled: checking ? true : undefined, onClick: check },
        checking ? t('setChecking') : t('setCheck')),
      h('div', { key: 'verdict', 'aria-live': 'polite' }, verdict)),
    /* 顶栏不再有「返回会话」，出口留在这里（layout 服务不可用时不渲染） */
    actions && actions.canReturnToConversation ? setRow('exit', t('setExit'), t('setExitHint'),
      h('button', {
        className: 'zp-btn zp-sm zp-exit', type: 'button',
        onClick: function () { closeLayers(); actions.returnToConversation(); }
      }, t('backToConversation'))) : null,
    h('p', { key: 'about', className: 'zp-about' }, t('setAbout')),
    h('p', { key: 'sign', className: 'zp-about' }, t('setSignature'), h('br'), t('setContact')));
}
