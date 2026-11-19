/* 25-board：盘面几何——三方四正、连线端点、方向键（T3c）
 * 三方四正用 20-util 的 relatedPalaces（对宫 +6，三合 +4 / +8）。 */

/* 宫位序号（寅 = 0，顺着地支走）→ 4×4 网格里的 [列, 行]（从 1 起）：巳午未申在上，寅丑子亥在下。和 v5、原型同一张图。 */
const CELL_POS = { 3: [1, 1], 4: [2, 1], 5: [3, 1], 6: [4, 1], 2: [1, 2], 7: [4, 2], 1: [1, 3], 8: [4, 3], 0: [1, 4], 11: [2, 4], 10: [3, 4], 9: [4, 4] };
ZWUI.CELL_POS = CELL_POS;

/* 方向键：沿十二宫的环走（left = 逆一格，right = 顺一格），opp = 对宫；和 v5 的 ringStep 相同 */
function ringStep(idx, dir) {
  if (dir === 'left') return (idx + 11) % 12;
  if (dir === 'right') return (idx + 1) % 12;
  if (dir === 'opp') return (idx + 6) % 12;
  return idx;
}
ZWUI.ringStep = ringStep;

function boardRect(r) {
  if (!r) return null;
  const l = r.left !== undefined ? +r.left : +r.x, top = r.top !== undefined ? +r.top : +r.y, w = +r.width, hh = +r.height;
  return [l, top, w, hh].every(isFinite) ? { l: l, t: top, w: w, h: hh } : null;
}

function boardRound(x) {
  return Math.round(x * 10) / 10;
}

/* 三方四正的连线端点。rects：12 个宫格相对盘面的矩形（{ left, top, width, height }，也认 x / y），按宫位序号排；
 * 每个端点是宫格上离十二宫中心最近的点（朝向中宫的那个角或边）。
 * 返回 { sel, indices: [选中, 对宫, 三合, 三合], points: [[x, y] × 4]（取到 0.1 像素）, key }；
 * key 由选中宫和四个点组成，位置没变 key 就不变（窗口抖一下不必重画）。rects 不全时返回 null。 */
function linePoints(rects, sel) {
  if (!rects || rects.length !== 12) return null;
  const s = +sel;
  if (!(s >= 0 && s < 12) || Math.floor(s) !== s) return null;
  const box = [];
  for (let i = 0; i < 12; i++) { const r = boardRect(rects[i]); if (!r) return null; box.push(r); }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  box.forEach(function (r) { x0 = Math.min(x0, r.l); y0 = Math.min(y0, r.t); x1 = Math.max(x1, r.l + r.w); y1 = Math.max(y1, r.t + r.h); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rel = relatedPalaces(s);
  const indices = [s, rel.opp, rel.tri[0], rel.tri[1]];
  const points = indices.map(function (i) {
    const r = box[i];
    return [boardRound(Math.min(Math.max(cx, r.l), r.l + r.w)), boardRound(Math.min(Math.max(cy, r.t), r.t + r.h))];
  });
  const key = s + '|' + points.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('|');
  return { sel: s, indices: indices, points: points, key: key };
}
ZWUI.linePoints = linePoints;
