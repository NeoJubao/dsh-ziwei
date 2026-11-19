/* 20-util：小工具。ZWUI 收纯函数，后面的文件往上挂；27-zwui 把它暴露成 window.ZWUi 供自检用。 */
const ZWUI = {};

/* 档位按面板实测宽度（docs/ui-contract/v6/layout.md「档位」）：
 *   MID  = SIDE_MIN + GUTTER + BOARD_MIN + PAGE_PAD_X                  = 244 + 16 + 420 + 40       = 720
 *   WIDE = ASSISTANT_W + SIDE_MIN + GUTTER + BOARD_COMFORT + PAGE_PAD_X = 360 + 244 + 16 + 520 + 40 = 1180
 * 首帧还没量到宽度（<= 0）按窄档。体检脚本核对这里的两个字面量等于公式。 */
function tierOf(panelW) {
  if (!(panelW > 0)) return 'narrow';
  if (panelW >= 1180) return 'wide';
  if (panelW >= 720) return 'mid';
  return 'narrow';
}
ZWUI.tierOf = tierOf;

/* 三方四正：对宫 = +6，三合 = +4 / +8（宫位序号 mod 12）。和 v5 同一个函数。 */
function relatedPalaces(index) {
  const i = +index;
  return { opp: (i + 6) % 12, tri: [(i + 4) % 12, (i + 8) % 12] };
}
ZWUI.relatedPalaces = relatedPalaces;
