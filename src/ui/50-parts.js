/* 50-parts：通用部件。现在只有 Icon 和图标表；按钮、分段、提示条、确认按钮、对话框焦点陷阱随 T5a 加进来。 */

/* 内联图标：16 × 16 网格、1.5px 线、随文字色（不用 emoji，跨平台一致）。新图标先加进这张表再用。 */
const ICON_PATHS = {
  exit: [
    ['path', { d: 'M6.7 4L2.7 8l4 4' }],
    ['path', { d: 'M2.7 8h7.3a3.3 3.3 0 0 1 0 6.7H8.7' }]
  ],
  back: [
    ['path', { d: 'M13.4 8H3.2' }],
    ['path', { d: 'M7 4.2L3.2 8l3.8 3.8' }]
  ],
  caret: [
    ['path', { d: 'M6.2 3.6L10.6 8l-4.4 4.4' }]
  ],
  copy: [
    ['rect', { x: 5.6, y: 5.6, width: 7.6, height: 7.6, rx: 1.6 }],
    ['path', { d: 'M10.6 5.6V4.3c0-.9-.7-1.6-1.6-1.6H4.3c-.9 0-1.6.7-1.6 1.6v4.7c0 .9.7 1.6 1.6 1.6h1.3' }]
  ],
  settings: [
    ['circle', { cx: 8, cy: 8, r: 2.1 }],
    ['path', { d: 'M8 1.9v2.1M8 12v2.1M1.9 8h2.1M12 8h2.1M3.7 3.7L5.2 5.2M10.8 10.8l1.5 1.5M12.3 3.7L10.8 5.2M5.2 10.8l-1.5 1.5' }]
  ],
  close: [
    ['path', { d: 'M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6' }]
  ],
  send: [
    ['path', { d: 'M2.6 8.1L13.2 3l-5.1 10.5L7 9.3z' }]
  ],
  stop: [
    ['rect', { x: 4.8, y: 4.8, width: 6.4, height: 6.4, rx: 1.6, fill: 'currentColor', stroke: 'none' }]
  ],
  sparkle: [
    ['path', { d: 'M8 1.9l1.5 4.2 4.2 1.5-4.2 1.5L8 13.3 6.5 9.1 2.3 7.6l4.2-1.5z' }]
  ],
  export: [
    ['path', { d: 'M8 2.1v7M5.3 6.4L8 9.1l2.7-2.7' }],
    ['path', { d: 'M3.1 10.4v1.7c0 .9.7 1.6 1.6 1.6h6.6c.9 0 1.6-.7 1.6-1.6v-1.7' }]
  ],
  report: [
    ['rect', { x: 3.2, y: 2.2, width: 9.6, height: 11.6, rx: 1.6 }],
    ['path', { d: 'M5.6 5.4h4.8M5.6 8h4.8M5.6 10.6h3' }]
  ],
  check: [
    ['path', { d: 'M3.4 8.3l3.1 3.1 6.1-6.7' }]
  ],
  newChat: [
    ['path', { d: 'M8 2.9v10.2M2.9 8h10.2' }]
  ],
  handoff: [
    ['path', { d: 'M2.6 8h7.1M7 5l3.1 3L7 11' }],
    ['path', { d: 'M12.4 3.2v9.6' }]
  ],
  quote: [
    ['path', { d: 'M3 3.4h10M3 6.2h10M3 9h6.4' }],
    ['path', { d: 'M3 12.6h4.4' }]
  ],
  refresh: [
    ['path', { d: 'M13 7.6A5 5 0 1 1 11.4 4' }],
    ['path', { d: 'M13.2 2.6v3.2H10' }]
  ]
};

function Icon(props) {
  const paths = ICON_PATHS[props.name] || [];
  return h('svg', {
    className: 'zp-icon', viewBox: '0 0 16 16', width: props.size || 16, height: props.size || 16,
    'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round', strokeLinejoin: 'round'
  }, paths.map(function (p, i) {
    return h(p[0], Object.assign({ key: i }, p[1]));
  }));
}
ZWUI.iconNames = Object.keys(ICON_PATHS);
