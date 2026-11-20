/* ================================================================
 * 68-models：模型选择（spec 2026-11-20 §3.5）。参考自媒体工作台（dsh-media-desk）的做法：提问的地方有一个模型按钮，
 * 点开是一个弹层，第一项「跟随 DSH 默认」，下面按提供方分组列出模型。
 *
 * ModelChip { compact? }   button.zp-model：星形图标 + 当前生效的模型名 + 下箭头；点了 openModal('model')。
 *   紫微师输入区（80-assistant）和首页提问框（60-home，compact）各放一个。挂上它不发任何请求。
 *   模型名取：用户选的（prefs.model）→ DSH 的默认模型（models.def，读过列表才知道）→ 最近一次回答实际用的
 *   （session.lastModel，来自 SSE 的 start 帧）→ 都不知道时写「默认模型」。
 * ModelModal {}            ProApp 在 session.modal === 'model' 时渲染；外框用 50-parts 的 Modal。
 *   打开时读一次列表（store.loadModels()）。四种状态：读取中、读到了、列表是空的、读不到（旧 Host：要重启 DSH）。
 *   选一项：store.setModel(...)，关掉弹层，变了才提示；下一次提问生效（请求体带 model，见 26-store 的 buildInterpretBody）。
 * 结构：div.zp-field > span（提供方名）+ div.zp-opts[role=group] > button.zp-opt[aria-pressed]；说明是 p.zp-field-hint。
 * ================================================================ */

function mdlShellOf(s) {
  return { pref: s.prefs.model, models: s.models, last: s.session.lastModel };
}

/* 当前生效的模型名；不知道时是空串 */
function mdlNameOf(m) {
  if (m.pref) return m.pref.model;
  if (m.models.def) return m.models.def.model;
  if (m.last) return m.last.model;
  return '';
}
ZWUI.modelNameOf = mdlNameOf;

function ModelChip(props) {
  const m = useStore(mdlShellOf);
  const name = mdlNameOf(m);
  const label = name ? t('mdlChip', { model: name }) : t('mdlChipNone');
  return h('button', {
    className: 'zp-model' + (props && props.compact ? ' zp-compact' : ''), type: 'button',
    title: label, 'aria-label': label, 'aria-haspopup': 'dialog',
    onClick: function () { openModal('model'); }
  },
  h(Icon, { name: 'sparkle', size: 14 }),
  h('span', null, name || t('mdlChipDefault')),
  h(Icon, { name: 'chevronDown', size: 12 }));
}

function ModelModal() {
  const m = useStore(mdlShellOf);
  const store = appStore();
  /* 每次打开都重读一次：DSH 里可能刚接了新的提供方 */
  useEffect(function () { store.loadModels(); }, []);
  const st = m.models;
  const pick = function (sel, name) {
    const changed = store.setModel(sel);
    closeLayers();
    if (changed) store.showToast(sel ? t('mdlSwitched', { model: name }) : t('mdlSwitchedDefault'));
  };
  const isOn = function (providerId, modelId) {
    return !!m.pref && m.pref.provider === providerId && m.pref.model === modelId;
  };
  const listed = !!m.pref && st.providers.some(function (p) {
    return p.id === m.pref.provider && p.models.some(function (x) { return x.id === m.pref.model; });
  });
  const groups = st.providers.map(function (p) {
    return h('div', { key: 'p-' + p.id, className: 'zp-field' },
      h('span', null, p.name),
      h('div', { className: 'zp-opts', role: 'group', 'aria-label': p.name }, p.models.map(function (x) {
        return h('button', {
          key: x.id, type: 'button', className: 'zp-opt', title: x.id,
          'aria-pressed': isOn(p.id, x.id) ? 'true' : 'false',
          onClick: function () { pick({ provider: p.id, model: x.id }, x.name); }
        }, x.name);
      })));
  });
  let status = null;
  if (st.status === 'idle' || st.status === 'loading') {
    status = h('p', { key: 'loading', className: 'zp-field-hint' }, t('mdlLoading'));
  } else if (st.status === 'error') {
    status = h('div', { key: 'error', className: 'zp-field' },
      h('p', { className: 'zp-field-hint zp-err' }, t('mdlError', { reason: st.error || 'unknown' })),
      h('p', { className: 'zp-field-hint' }, t('mdlErrorHint')),
      h('div', { className: 'zp-opts' },
        h('button', { type: 'button', className: 'zp-btn zp-sm', onClick: function () { store.loadModels(); } }, t('mdlReload'))));
  } else if (!st.providers.length) {
    status = h('p', { key: 'empty', className: 'zp-field-hint' }, t('mdlEmpty'));
  }
  return h(Modal, { title: t('mdlTitle'), onClose: closeLayers },
    h('p', { key: 'intro', className: 'zp-about' }, t('mdlIntro')),
    h('div', { key: 'follow', className: 'zp-field' },
      h('div', { className: 'zp-opts' },
        h('button', {
          type: 'button', className: 'zp-opt', 'aria-pressed': m.pref ? 'false' : 'true',
          onClick: function () { pick(null, ''); }
        }, st.def ? t('mdlFollowWith', { model: st.def.model }) : t('mdlFollow'))),
      h('p', { className: 'zp-field-hint' }, t('mdlFollowHint'))),
    h('div', { key: 'live', 'aria-live': 'polite' }, status),
    groups,
    m.pref && st.status === 'ready' && !listed
      ? h('p', { key: 'missing', className: 'zp-field-hint zp-err' }, t('mdlMissing', { model: m.pref.model })) : null);
}
