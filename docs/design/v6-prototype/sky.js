/* 星图 3D：「紫微天仪」。紫微星在中心，外面套一座金色浑天仪，命盘是绕它运行的星球。
   Three.js r128 只负责场景和金属材质；星球、尘埃盘、星云、后期（HDR 多级泛光、体积光、色调映射）都是自己写的着色器。
   夜空和晨光是同一个场景的两套灯光，由 uDay 0→1 连续过渡。 */
window.ZWSky = (function () {
  'use strict';
  const T = window.THREE, canvas = document.getElementById('sky');
  const noop = function () {};
  const stub = { ok: false, introMs: 0, setPlanets: noop, focus: noop, hover: noop, dive: function (id, col, cb) { cb(); }, rise: noop, birth: function (id, cb) { cb(); },
    grade: noop, show: noop, replay: noop, layers: noop, onHover: noop, onPick: noop, onGesture: noop };
  if (!T || !canvas) return stub;
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { return stub; }
  const gl = renderer.getContext();
  const HDR = renderer.capabilities.isWebGL2 && !!gl.getExtension('EXT_color_buffer_float');
  const FT = HDR ? T.HalfFloatType : T.UnsignedByteType;
  let msaa = 0;
  if (HDR) { try { const s = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES); msaa = s && s.length ? Math.min(4, s[0]) : 0; } catch (e) { msaa = 0; } }
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIO = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  let seed = 20261119;
  const rnd = function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 0.87;
  const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
  const TAU = Math.PI * 2;

  /* ---------- 环境光照（PMREM）：给金属环一个可以反射的世界。要在关掉 autoClear 之前生成 ---------- */
  function envCanvas(day) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    if (day) { g.addColorStop(0, '#a9b8ea'); g.addColorStop(0.46, '#f4eef0'); g.addColorStop(0.62, '#b79a80'); g.addColorStop(1, '#4b3a2e'); }
    else { g.addColorStop(0, '#1a1438'); g.addColorStop(0.5, '#0c0a1e'); g.addColorStop(1, '#05040d'); }
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    x.globalCompositeOperation = day ? 'source-over' : 'lighter';
    const blob = (u, v, r, col) => { [-1, 0, 1].forEach(k => { const cx = (u + k) * 512, cy = v * 256, rg = x.createRadialGradient(cx, cy, 0, cx, cy, r * 256); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, 512, 256); }); };
    if (day) {
      blob(0.20, 0.30, 0.40, 'rgba(255,251,240,1)'); blob(0.70, 0.26, 0.30, 'rgba(236,240,255,0.95)'); blob(0.46, 0.84, 0.36, 'rgba(176,124,78,0.6)'); blob(0.92, 0.56, 0.26, 'rgba(120,100,170,0.5)');
    } else {
      blob(0.20, 0.42, 0.62, 'rgba(255,186,110,1)'); blob(0.46, 0.52, 0.5, 'rgba(255,170,96,0.7)'); blob(0.74, 0.42, 0.56, 'rgba(126,100,255,0.85)'); blob(0.50, 0.04, 0.5, 'rgba(190,210,255,0.6)');
      blob(0.06, 0.28, 0.15, 'rgba(255,255,255,1)'); blob(0.31, 0.22, 0.10, 'rgba(255,244,224,1)'); blob(0.60, 0.66, 0.12, 'rgba(255,214,170,0.95)'); blob(0.92, 0.78, 0.36, 'rgba(255,84,168,0.4)'); blob(0.38, 0.80, 0.3, 'rgba(255,150,80,0.4)');
    }
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.mapping = T.EquirectangularReflectionMapping; return tex;
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const envNight = pmrem.fromEquirectangular(envCanvas(false)).texture, envDay = pmrem.fromEquirectangular(envCanvas(true)).texture;
  pmrem.dispose();
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  /* ---------- 公共 uniform 与着色器片段 ---------- */
  const U = {
    uTime: { value: 0 }, uDay: { value: 0 }, uPx: { value: 1 }, uFocal: { value: 1000 }, uIntro: { value: 0 }, uRes: { value: new T.Vector2(1, 1) },
    uRayO: { value: new T.Vector3() }, uRayD: { value: new T.Vector3(0, 0, -1) }, uPush: { value: 0 }, uPulse: { value: -100 },
    uOuter: { value: 7 }, uOrb: { value: [99, 99, 99, 99, 99, 99, 99, 99] }, uHaze: { value: new T.Vector2(10, 32) }
  };
  const NOISE = `
float h31(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(h31(i), h31(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 0.0)), h31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(h31(i + vec3(0.0, 0.0, 1.0)), h31(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h31(i + vec3(0.0, 1.0, 1.0)), h31(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = p*2.03 + vec3(11.7, 3.2, 7.1); a *= 0.5; } return s; }
`;
  const RINGFN = `
float ringBands(float x, float sd){ float n = vnoise(vec3(x*34.0, sd*9.0, 0.5))*0.62 + vnoise(vec3(x*96.0, sd*5.0, 3.7))*0.38;
  return smoothstep(0.20, 0.56, n) * smoothstep(0.015, 0.05, abs(x - 0.60)) * smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.93, x); }
`;
  /* 预乘输出 + (ONE, ONE_MINUS_SRC_ALPHA)：alpha 写 0 就是纯叠加发光，写满就是普通遮盖，夜/昼可以连续过渡 */
  function glow(m) { m.transparent = true; m.depthWrite = false; m.blending = T.CustomBlending; m.blendEquation = T.AddEquation; m.blendSrc = T.OneFactor; m.blendDst = T.OneMinusSrcAlphaFactor; return m; }

  /* ---------- 全屏通道 ---------- */
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new T.Scene();
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), null); quad.frustumCulled = false; quadScene.add(quad);
  const VS_QUAD = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const passMat = (fs, uniforms) => new T.ShaderMaterial({ vertexShader: VS_QUAD, fragmentShader: fs, uniforms: uniforms, depthTest: false, depthWrite: false });
  function runPass(m, target) { quad.material = m; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); }
  const mkRT = (w, h, depth) => { const rt = new T.WebGLRenderTarget(w, h, { type: FT, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: !!depth, stencilBuffer: false }); rt.texture.generateMipmaps = false; return rt; };

  /* ---------- 星云：域扭曲 fbm，一次烘焙成全景图，之后每帧只是一次贴图采样 ---------- */
  const PHI0 = 0.42;
  const viewC = new T.Vector3(0, -Math.sin(PHI0), -Math.cos(PHI0)), upC = new T.Vector3(0, Math.cos(PHI0), -Math.sin(PHI0)), rightC = new T.Vector3(1, 0, 0);
  const tangent = (x, y) => viewC.clone().addScaledVector(rightC, x).addScaledVector(upC, y).normalize();
  const bandT = rightC.clone().multiplyScalar(0.84).addScaledVector(upC, 0.54).normalize();
  const bandP = tangent(0.06, 0.10);
  const bandN = new T.Vector3().crossVectors(bandP, bandT).normalize();
  const bandC = bandP.clone().addScaledVector(bandT, 0.75).normalize();
  const bakeRT = mkRT(2048, 1024, false); bakeRT.texture.wrapS = T.RepeatWrapping;
  runPass(passMat(`varying vec2 vUv; uniform vec3 uN; uniform vec3 uC; ${NOISE}
void main(){
  float lon = (vUv.x - 0.5)*6.2831853, lat = (vUv.y - 0.5)*3.14159265;
  vec3 d = vec3(cos(lat)*cos(lon), sin(lat), cos(lat)*sin(lon));
  float b = dot(d, uN); float band = exp(-b*b*8.0), core = exp(-b*b*50.0);
  float bulge = pow(max(dot(d, uC), 0.0), 5.0);
  vec3 p = d*2.3;
  vec3 q = vec3(fbm(p + vec3(0.0, 3.1, 1.7)), fbm(p + vec3(5.2, 1.3, 2.8)), fbm(p + vec3(1.9, 7.4, 4.2)));
  vec3 r = vec3(fbm(p + 3.0*q + vec3(1.7, 9.2, 4.1)), fbm(p + 3.0*q + vec3(8.3, 2.8, 6.4)), fbm(p + 3.0*q + vec3(3.3, 5.1, 8.8)));
  float f = fbm(p + 2.6*r);
  float wisps = smoothstep(0.34, 0.82, f);
  float fine = fbm(d*9.0 + r*2.0);
  float lanes = smoothstep(0.40, 0.62, fbm(d*6.0 + q*1.8 + 11.0));
  vec3 cBlue = vec3(0.045, 0.10, 0.40), cViolet = vec3(0.22, 0.085, 0.48), cMag = vec3(0.50, 0.07, 0.30), cWarm = vec3(1.0, 0.46, 0.36), cTeal = vec3(0.02, 0.20, 0.27);
  vec3 col = vec3(0.0030, 0.0036, 0.0105) + vec3(0.0020, 0.0030, 0.0100)*(0.5 + 0.5*d.y);
  vec3 tint = mix(cBlue, cViolet, smoothstep(0.30, 0.70, r.x)); tint = mix(tint, cTeal, smoothstep(0.55, 0.85, q.z)*0.5);
  col += tint * wisps*wisps * (0.035 + 0.40*band);
  col += cMag * pow(wisps, 3.0) * smoothstep(0.42, 0.78, q.y) * (0.05 + 0.95*band) * 0.42;
  col += cWarm * (core*0.035 + bulge*0.16*band) * (0.4 + 1.0*fine);
  col += vec3(0.020, 0.075, 0.150) * smoothstep(0.42, 0.78, q.x) * wisps * 0.55;
  col *= 1.0 - lanes*core*0.72;
  col += vec3(0.50, 0.62, 1.0) * pow(fine, 5.0) * band * 0.16;
  float dens = clamp(wisps*(0.25 + 0.75*band) + core*0.45 - lanes*core*0.3, 0.0, 1.0);
  gl_FragColor = vec4(col, dens);
}`, { uN: { value: bandN }, uC: { value: bandC } }), bakeRT);
  renderer.setRenderTarget(null);

  /* ---------- 主场景 ---------- */
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 0.12, 2400);
  scene.environment = envNight;
  scene.fog = new T.Fog(0xcbb9d6, 5000, 10000);
  const lamp = new T.PointLight(0xffe4c4, 2.2, 0, 2); scene.add(lamp);
  scene.add(camera);
  const keyL = new T.DirectionalLight(0xffdcae, 1.5); keyL.position.set(-5, 6, 3); camera.add(keyL);
  const rimL = new T.DirectionalLight(0x8a74ff, 1.3); rimL.position.set(8, 2, -16); camera.add(rimL);
  const fillL = new T.DirectionalLight(0xffb878, 0.55); fillL.position.set(6, -5, 2); camera.add(fillL);
  const skyG = new T.Group(); scene.add(skyG);
  const dome = new T.Mesh(new T.SphereGeometry(1100, 48, 32), new T.ShaderMaterial({
    uniforms: { tNeb: { value: bakeRT.texture }, uDay: U.uDay, uRes: U.uRes },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tNeb; uniform float uDay; uniform vec2 uRes; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir);
  vec2 uv = vec2(atan(d.z, d.x)/6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0))/3.14159265 + 0.5);
  vec4 nb = texture2D(tNeb, uv);
  float h = gl_FragCoord.y/uRes.y + d.y*0.06;
  vec3 day = mix(vec3(0.93, 0.70, 0.54), vec3(0.74, 0.64, 0.80), smoothstep(0.0, 0.62, h)); day = mix(day, vec3(0.40, 0.49, 0.80), smoothstep(0.58, 1.12, h));
  day = mix(day, vec3(0.97, 0.89, 0.89), smoothstep(0.10, 0.80, nb.a)*0.5);
  gl_FragColor = vec4(mix(nb.rgb, day, uDay), 1.0); }`,
    side: T.BackSide, depthTest: false, depthWrite: false }));
  dome.renderOrder = -100; dome.frustumCulled = false; skyG.add(dome);

  /* 恒星：一半随机撒，一半沿银河带聚集；亮度按幂律，少数很亮 */
  (function () {
    const N = 15000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sp = new Float32Array(N * 2);
    const tints = [[1, .80, .60], [1, .92, .82], [1, 1, 1], [.84, .90, 1], [.70, .79, 1]];
    const bU = new T.Vector3().crossVectors(bandN, new T.Vector3(0, 1, 0)).normalize(), bV = new T.Vector3().crossVectors(bandN, bU).normalize();
    const cAng = Math.atan2(bandC.dot(bV), bandC.dot(bU)), v = new T.Vector3();
    for (let i = 0; i < N; i++) {
      let s;
      if (i < 6200) { const u = rnd() * 2 - 1, th = rnd() * TAU, r = Math.sqrt(1 - u * u); v.set(r * Math.cos(th), u, r * Math.sin(th)); s = 0.55 + Math.pow(rnd(), 7) * 4.6; }
      else { const a = i % 2 ? cAng + gauss() * 1.5 : rnd() * TAU; v.copy(bU).multiplyScalar(Math.cos(a)).addScaledVector(bV, Math.sin(a)).addScaledVector(bandN, gauss() * 0.24).normalize(); s = 0.45 + Math.pow(rnd(), 9) * 3.0; }
      pos[i * 3] = v.x * 900; pos[i * 3 + 1] = v.y * 900; pos[i * 3 + 2] = v.z * 900;
      const t = tints[Math.floor(rnd() * tints.length)], b = 0.42 + s * 0.50;
      col[i * 3] = t[0] * b; col[i * 3 + 1] = t[1] * b; col[i * 3 + 2] = t[2] * b; sp[i * 2] = s; sp[i * 2 + 1] = rnd();
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 3)); g.setAttribute('aSP', new T.BufferAttribute(sp, 2));
    const m = glow(new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uPx: U.uPx, uDay: U.uDay, uIntro: U.uIntro },
      vertexShader: `attribute vec3 aCol; attribute vec2 aSP; uniform float uTime, uPx, uDay; varying vec3 vCol;
void main(){ vec4 mv = modelViewMatrix*vec4(position, 1.0); gl_Position = projectionMatrix*mv;
  float tw = 0.74 + 0.26*sin(uTime*(0.6 + fract(aSP.y*7.3)*2.4) + aSP.y*40.0);
  float s = aSP.x*uPx*mix(1.08, 1.2, uDay); gl_PointSize = max(s, 1.0); vCol = aCol*tw*min(s, 1.0); }`,
      fragmentShader: `uniform float uDay, uIntro; varying vec3 vCol;
void main(){ float r = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.0, r); a *= a;
  vec3 night = vCol*(1.0 + 1.6*a*a); vec3 dayc = vec3(0.40, 0.28, 0.12);
  float al = a*mix(1.0, 0.62*min(length(vCol), 1.0), uDay)*uIntro;
  gl_FragColor = vec4(mix(night, dayc, uDay)*al, al*uDay); }` }));
    const pts = new T.Points(g, m); pts.frustumCulled = false; skyG.add(pts);
  })();

  /* 北斗七星：紫微斗数里十四主星的名字，一半出自这把勺子 */
  (function () {
    const shape = [[10.4, 5.75], [10.65, 0.38], [3.35, -2.31], [0.34, 1.03], [-5.03, -0.04], [-9.22, -1.07], [-12.5, -6.69]];
    const k = Math.PI / 180 * 0.52, pts = shape.map(s => tangent(-0.37 + s[0] * k, 0.105 + s[1] * k).multiplyScalar(880));
    const lg = new T.BufferGeometry().setFromPoints([0, 1, 2, 3, 0, 3, 4, 5, 6].map(i => pts[i]));
    const lm = glow(new T.ShaderMaterial({ uniforms: { uDay: U.uDay, uIntro: U.uIntro }, vertexShader: 'void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader: 'uniform float uDay, uIntro; void main(){ float a = mix(0.26, 0.5, uDay)*uIntro; gl_FragColor = vec4(mix(vec3(1.0, 0.82, 0.5), vec3(0.55, 0.40, 0.16), uDay)*a, a*uDay); }' }));
    skyG.add(new T.Line(lg, lm));
    const pg = new T.BufferGeometry().setFromPoints(pts);
    const pm = glow(new T.ShaderMaterial({ uniforms: { uPx: U.uPx, uDay: U.uDay, uIntro: U.uIntro }, vertexShader: 'uniform float uPx; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_PointSize = 9.0*uPx; }',
      fragmentShader: `uniform float uDay, uIntro; void main(){ float r = length(gl_PointCoord - 0.5)*2.0; float core = smoothstep(0.34, 0.12, r), halo = pow(max(1.0 - r, 0.0), 2.6);
  vec3 night = vec3(1.0, 0.94, 0.84)*(core*3.2 + halo*0.9); float ad = smoothstep(0.42, 0.24, r);
  gl_FragColor = vec4(mix(night, vec3(0.58, 0.42, 0.16)*ad, uDay)*uIntro, ad*uDay*uIntro); }` }));
    const dp = new T.Points(pg, pm); dp.frustumCulled = false; skyG.add(dp);
  })();

  /* ---------- 浑天仪 ---------- */
  const arm = new T.Group(); scene.add(arm);
  const occluders = [];
  const gold = new T.MeshStandardMaterial({ color: new T.Color(1.0, 0.76, 0.34), metalness: 1, roughness: 0.26, envMapIntensity: 2.1, side: T.DoubleSide });
  const brass = new T.MeshStandardMaterial({ color: new T.Color(0.84, 0.57, 0.24), metalness: 1, roughness: 0.42, envMapIntensity: 1.25, side: T.DoubleSide });
  /* 一圈环 = 一个带小倒角的矩形截面绕轴旋转；倒角两侧各多放一个点，平面才是平的、棱才是亮的 */
  function hoop(R, w, h) {
    const b = Math.min(w, h) * 0.22, e = b * 0.4, x0 = R - w / 2, x1 = R + w / 2, y0 = -h / 2, y1 = h / 2;
    const pts = [[R, y0], [x1 - b - e, y0], [x1 - b, y0], [x1, y0 + b], [x1, y0 + b + e], [x1, y1 - b - e], [x1, y1 - b], [x1 - b, y1], [x1 - b - e, y1], [x0 + b + e, y1], [x0 + b, y1],
      [x0, y1 - b], [x0, y1 - b - e], [x0, y0 + b + e], [x0, y0 + b], [x0 + b, y0], [x0 + b + e, y0], [R, y0]].map(p => new T.Vector2(p[0], p[1]));
    return new T.LatheGeometry(pts, 180);
  }
  function solid(geo, mat, parent) { const m = new T.Mesh(geo, mat); m.layers.enable(1); parent.add(m); occluders.push(m); return m; }
  solid(hoop(1.89, 0.34, 0.044), brass, arm);
  solid(hoop(2.078, 0.034, 0.08), gold, arm);
  solid(hoop(1.712, 0.026, 0.07), gold, arm);
  const gim = [];
  (function () {
    const spec = [[1.615, 0.082, 0.125], [1.452, 0.072, 0.11], [1.298, 0.064, 0.098], [1.152, 0.056, 0.086]];
    let parent = arm, outer = 1.699;
    spec.forEach((s, i) => {
      const g = new T.Group(); parent.add(g); solid(hoop(s[0], s[1], s[2]), gold, g);
      const a = s[0] + s[1] / 2 - 0.004, len = outer - a + 0.008, axisX = i % 2 === 0;
      [-1, 1].forEach(sg => { const pin = solid(new T.CylinderGeometry(0.014, 0.014, len, 14), gold, parent); const c = sg * (a + len / 2 - 0.004);
        if (axisX) { pin.rotation.z = Math.PI / 2; pin.position.set(c, 0, 0); } else { pin.rotation.x = Math.PI / 2; pin.position.set(0, 0, c); }
        const cap = solid(new T.SphereGeometry(0.026, 16, 12), gold, parent); cap.position.copy(pin.position).multiplyScalar((outer + 0.012) / Math.abs(c)); });
      gim.push({ g: g, axisX: axisX, a0: [0.62, 0.95, -0.7, 1.25][i], w: [0.11, -0.16, 0.21, -0.27][i], kick: 0, ang: 0 });
      parent = g; outer = s[0] - s[1] / 2;
    });
  })();

  /* 十二宫盘面：一条 4096×128 的画布绕成环。地支是固定的，宫名跟着当前这张盘换 */
  const SC = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const plateCv = document.createElement('canvas'); plateCv.width = 4096; plateCv.height = 128;
  const plateTex = new T.CanvasTexture(plateCv); plateTex.flipY = false; plateTex.wrapS = T.RepeatWrapping; plateTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  function drawPlate(names) {
    const x = plateCv.getContext('2d'), W = 4096, H = 128; x.clearRect(0, 0, W, H); x.fillStyle = '#fff';
    x.fillRect(0, 3, W, 2); x.fillRect(0, H - 5, W, 2);
    for (let i = 0; i < 360; i++) { const px = (i + 0.5) / 360 * W, big = i % 30 === 14, mid = i % 5 === 2; x.globalAlpha = big ? 0.95 : mid ? 0.8 : 0.5; if (big) x.fillRect(px + W / 720 - 1.5, 5, 3, H - 10); else x.fillRect(px - 0.75, H - (mid ? 24 : 15), 1.5, mid ? 19 : 10); }
    x.globalAlpha = 1; x.textAlign = 'center'; x.textBaseline = 'middle';
    const serif = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC","SimSun",serif';
    for (let k = 0; k < 12; k++) {
      const cx = ((12 - k) % 12) / 12 * W;
      [cx, cx + W, cx - W].forEach(px => {
        x.font = '600 58px ' + serif; x.globalAlpha = 1; x.fillText(SC[k], px, 44);
        if (names && names[k]) { x.font = '500 25px ' + serif; x.globalAlpha = 0.85; x.fillText(names[k], px, 91); }
      });
    }
    plateTex.needsUpdate = true;
  }
  drawPlate(null);
  function annulus(r0, r1, seg) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) { const t = i / seg * TAU, s = -Math.sin(t), c = Math.cos(t); pos.push(s * r0, 0, c * r0, s * r1, 0, c * r1); uv.push(-i / seg, 0, -i / seg, 1); }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const plateU = { tMap: { value: plateTex }, uMing: { value: 0 }, uToday: { value: 0 }, uShow: { value: 0 }, uTime: U.uTime, uDay: U.uDay, uIntro: U.uIntro, uPulse: U.uPulse };
  const plateFace = new T.Mesh(annulus(1.728, 2.058, 240), glow(new T.ShaderMaterial({ uniforms: plateU, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tMap; uniform float uMing, uToday, uShow, uTime, uDay, uIntro, uPulse; varying vec2 vUv;
void main(){ float m = texture2D(tMap, vUv).a;
  float sg = fract(-vUv.x)*12.0;
  float dM = abs(mod(sg - uMing + 6.0, 12.0) - 6.0), dT = abs(mod(sg - uToday + 6.0, 12.0) - 6.0);
  float gM = (1.0 - smoothstep(0.40, 0.5, dM))*uShow, gT = (1.0 - smoothstep(0.40, 0.5, dT))*uShow*(0.62 + 0.38*sin(uTime*2.0));
  float edge = smoothstep(0.0, 0.07, vUv.y)*smoothstep(1.0, 0.93, vUv.y);
  float wave = exp(-pow((1.9 - uPulse*5.0)*1.4, 2.0))*step(0.0, uPulse);
  vec3 ink = mix(vec3(1.0, 0.80, 0.46)*1.25, vec3(0.19, 0.12, 0.04), uDay);
  vec3 cM = mix(vec3(1.0, 0.74, 0.30), vec3(0.78, 0.52, 0.12), uDay), cT = mix(vec3(0.70, 0.56, 1.0), vec3(0.46, 0.32, 0.86), uDay);
  float a = m*mix(0.8, 0.92, uDay);
  vec3 col = ink*a*(0.55 + 2.4*gM + 1.9*gT + 3.0*wave);
  col += (cM*gM*0.36 + cT*gT*0.34)*edge*mix(1.0, 0.75, uDay);
  float oa = (a + (gM*0.30 + gT*0.26)*edge)*uDay;
  gl_FragColor = vec4(col*uIntro, oa*uIntro); }` })));
  plateFace.position.y = 0.0245; plateFace.renderOrder = 2; arm.add(plateFace);

  /* 十四主星：落在十二宫盘上的十四粒光。换一张盘，它们就沿着环滑到那张盘里的位置 */
  const STARS14 = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
  const beadAng = new Float32Array(14), beadCol = new Float32Array(42), beadSize = new Float32Array(14), beadT = new Float32Array(14);
  for (let i = 0; i < 14; i++) { beadAng[i] = beadT[i] = i / 14 * TAU; beadSize[i] = 0.085; beadCol[i * 3] = beadCol[i * 3 + 1] = beadCol[i * 3 + 2] = 1; }
  const beadGeo = new T.BufferGeometry();
  beadGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(42), 3));
  beadGeo.setAttribute('aAng', new T.BufferAttribute(beadAng, 1)); beadGeo.setAttribute('aCol', new T.BufferAttribute(beadCol, 3)); beadGeo.setAttribute('aSize', new T.BufferAttribute(beadSize, 1));
  const beadU = { uFocal: U.uFocal, uDay: U.uDay, uIntro: U.uIntro, uShow: plateU.uShow, uPx: U.uPx };
  const beads = new T.Points(beadGeo, glow(new T.ShaderMaterial({ uniforms: beadU,
    vertexShader: `attribute float aAng, aSize; attribute vec3 aCol; uniform float uFocal, uPx; varying vec3 vCol;
void main(){ vec3 p = vec3(-sin(aAng)*1.80, 0.105, cos(aAng)*1.80); vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
  gl_PointSize = max(aSize*uFocal/-mv.z, 3.0*uPx); vCol = aCol; }`,
    fragmentShader: `uniform float uDay, uIntro, uShow; varying vec3 vCol;
void main(){ float r = length(gl_PointCoord - 0.5)*2.0; float core = smoothstep(0.34, 0.16, r), halo = pow(max(1.0 - r, 0.0), 2.4);
  vec3 night = vCol*(halo*1.5 + core*2.6) + vec3(core*2.2);
  float ad = smoothstep(0.52, 0.36, r); vec3 dayc = mix(vCol*0.82, vec3(1.0), core*0.4)*ad;
  float k = uIntro*uShow; gl_FragColor = vec4(mix(night, dayc, uDay)*k, ad*uDay*k); }` })));
  beads.frustumCulled = false; beads.renderOrder = 3; arm.add(beads);

  /* ---------- 紫微星 ---------- */
  const starU = { uTime: U.uTime, uDay: U.uDay, uStar: { value: 0 } };
  const core = new T.Mesh(new T.SphereGeometry(0.165, 48, 32), new T.ShaderMaterial({ uniforms: starU,
    vertexShader: 'varying vec3 vObj, vN, vV; void main(){ vObj = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
    fragmentShader: `uniform float uTime, uDay, uStar; varying vec3 vObj, vN, vV; ${NOISE}
void main(){ vec3 p = normalize(vObj); float n = fbm(p*3.4 + vec3(0.0, uTime*0.11, 0.0)), g = fbm(p*8.0 + vec3(uTime*0.17));
  float ndv = max(dot(normalize(vN), normalize(vV)), 0.0);
  vec3 hot = mix(vec3(1.0, 0.97, 0.92), vec3(0.80, 0.69, 1.0), smoothstep(0.36, 0.70, n));
  vec3 col = hot*(4.0 + 6.0*g*g)*(0.45 + 0.55*ndv) + vec3(0.62, 0.42, 1.0)*pow(1.0 - ndv, 1.5)*5.0;
  col = mix(col, vec3(1.0, 0.95, 0.86)*(3.4 + 2.4*g), uDay*0.75);
  gl_FragColor = vec4(col*uStar, 1.0); }` }));
  scene.add(core);
  const corona = new T.Mesh(new T.PlaneGeometry(9.5, 9.5), glow(new T.ShaderMaterial({ uniforms: starU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv - 0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uDay, uStar; varying vec2 vUv; ${NOISE}
void main(){ float r = length(vUv)*2.0, a = atan(vUv.y, vUv.x);
  float fall = max(1.0 - r, 0.0);
  float core = exp(-r*r*190.0)*2.4;
  float halo = pow(fall, 7.0)*0.22 + pow(fall, 36.0)*0.75;
  float n = fbm(vec3(cos(a)*1.7, sin(a)*1.7, uTime*0.07));
  float rays = pow(max(0.5 + 0.5*sin(a*11.0 + n*10.0 + uTime*0.05), 0.0), 6.0)*pow(fall, 7.5)*(0.5 + n)*1.5;
  float sp = exp(-abs(vUv.y)*260.0)*exp(-abs(vUv.x)*8.5)*0.8 + exp(-abs(vUv.x)*280.0)*exp(-abs(vUv.y)*12.0)*0.45;
  float dg = exp(-abs(vUv.x - vUv.y)*190.0)*exp(-length(vUv)*13.0) + exp(-abs(vUv.x + vUv.y)*190.0)*exp(-length(vUv)*13.0);
  vec3 white = vec3(1.0, 0.97, 0.93), vio = mix(vec3(0.60, 0.44, 1.0), vec3(1.0, 0.86, 0.66), uDay), au = vec3(1.0, 0.72, 0.36);
  vec3 c = white*core + mix(vio, white, exp(-r*7.0))*halo + mix(au, vio, 0.35)*rays*0.55 + white*(sp*1.1 + dg*0.35);
  gl_FragColor = vec4(c*uStar*mix(1.0, 0.5, uDay), 0.0); }` })));
  corona.renderOrder = 5; scene.add(corona);
  /* 体积光的光源：只进遮挡通道，被环和星球切成一束一束的 */
  const sunSrc = new T.Mesh(new T.PlaneGeometry(1.9, 1.9), glow(new T.ShaderMaterial({ uniforms: starU,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv - 0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: 'uniform float uStar; varying vec2 vUv; void main(){ float r = length(vUv)*2.0; float a = exp(-r*r*9.0)*1.0 + exp(-r*r*70.0)*2.6; gl_FragColor = vec4(vec3(a*uStar), 0.0); }' })));
  sunSrc.layers.set(2); scene.add(sunSrc);
  const blackMat = new T.MeshBasicMaterial({ color: 0x000000, side: T.DoubleSide });

  /* ---------- 尘埃盘：四万粒金尘按开普勒速度绕紫微星转，星球轨道上扫出空隙；鼠标划过会被拨开，点一下荡开涟漪 ---------- */
  (function () {
    const N = 130000, d = new Float32Array(N * 4), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { d[i * 4] = Math.pow(rnd(), 1.35); d[i * 4 + 1] = rnd() * TAU; d[i * 4 + 2] = gauss() * 2; d[i * 4 + 3] = rnd(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aD', new T.BufferAttribute(d, 4));
    const m = glow(new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uDay: U.uDay, uPx: U.uPx, uFocal: U.uFocal, uIntro: U.uIntro, uOuter: U.uOuter, uOrb: U.uOrb, uRayO: U.uRayO, uRayD: U.uRayD, uPush: U.uPush, uPulse: U.uPulse },
      vertexShader: `attribute vec4 aD; uniform float uTime, uDay, uPx, uFocal, uIntro, uOuter, uPush, uPulse; uniform float uOrb[8]; uniform vec3 uRayO, uRayD; varying vec3 vCol; varying float vA;
void main(){ float rho = aD.x; float r = mix(2.42, uOuter, rho);
  float a = aD.y + uTime*0.30*pow(r, -1.5);
  vec3 p = vec3(cos(a)*r, aD.z*(0.012 + 0.05*rho), sin(a)*r);
  float wv = exp(-pow((r - uPulse*5.0)*1.5, 2.0))*exp(-max(uPulse, 0.0)*0.8)*step(0.0, uPulse);
  p.y += wv*0.26;
  vec3 rel = p - uRayO; vec3 off = rel - uRayD*dot(rel, uRayD); float d2 = dot(off, off);
  p += normalize(off + vec3(1e-4))*uPush*exp(-d2*2.6)*0.75;
  vec4 mv = viewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
  float gap = 1.0; for (int i = 0; i < 8; i++) gap *= smoothstep(0.05, 0.26, abs(r - uOrb[i]));
  float armk = 0.5 + 0.5*sin(2.0*a - 5.2*log(r) + 1.3);
  float fade = smoothstep(0.0, 0.07, rho)*(1.0 - smoothstep(0.72, 1.0, rho));
  float big = step(0.985, aD.w);
  float size = (0.0035 + 0.0075*aD.w*aD.w + 0.016*big)*(1.0 + wv*1.6);
  float px = size*mix(1.0, 1.5, uDay)*uFocal/-mv.z; float minPx = mix(1.25, 1.9, uDay); gl_PointSize = max(px, minPx);
  float al = (0.10 + 0.50*armk*armk)*gap*fade*uIntro*min(px/minPx, 1.0);
  vec3 c = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.60, 0.24), smoothstep(0.0, 0.34, rho)); c = mix(c, vec3(0.50, 0.40, 1.0), smoothstep(0.34, 1.0, rho));
  c *= (0.45 + 0.9*aD.w + 2.2*big)*(1.0 + 3.5*wv)*(1.0 + 4.0/(r*r));
  vCol = mix(c, mix(vec3(0.46, 0.30, 0.09)*(0.7 + 0.6*aD.w), vec3(0.95, 0.70, 0.24), big), uDay); vA = al*mix(0.42, 1.25, uDay); }`,
      fragmentShader: `uniform float uDay; varying vec3 vCol; varying float vA;
void main(){ float r = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.15, r)*vA; gl_FragColor = vec4(vCol*a, a*uDay); }` }));
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1; scene.add(pts);
  })();
  (function () {
    const m = glow(new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uDay: U.uDay, uIntro: U.uIntro, uOuter: U.uOuter, uOrb: U.uOrb, uPulse: U.uPulse }, side: T.DoubleSide,
      vertexShader: 'uniform float uOuter; varying vec3 vP; void main(){ float rr = mix(2.2, uOuter + 0.3, uv.y); vP = normalize(position)*rr; gl_Position = projectionMatrix*viewMatrix*vec4(vP, 1.0); }',
      fragmentShader: `uniform float uTime, uDay, uIntro, uOuter, uPulse; uniform float uOrb[8]; varying vec3 vP; ${NOISE}
void main(){ float r = length(vP.xz), a = atan(vP.z, vP.x); float rho = clamp((r - 2.42)/(uOuter - 2.42), 0.0, 1.0);
  float ar = a - uTime*0.30*pow(r, -1.5);
  float streak = fbm(vec3(cos(ar)*r*1.1, sin(ar)*r*1.1, r*2.6));
  float armk = 0.5 + 0.5*sin(2.0*a - 5.2*log(r) + 1.3);
  float gap = 1.0; for (int i = 0; i < 8; i++) gap *= smoothstep(0.03, 0.30, abs(r - uOrb[i]));
  float fade = smoothstep(0.0, 0.10, rho)*(1.0 - smoothstep(0.55, 1.0, rho));
  float wave = exp(-pow((r - uPulse*5.0)*1.5, 2.0))*exp(-max(uPulse, 0.0)*0.8)*step(0.0, uPulse);
  float k = (0.25 + 0.75*armk*armk)*(0.35 + 1.3*streak*streak)*gap*fade*(0.05 + 0.5/(r*r)) + wave*0.20*smoothstep(2.2, 2.6, r);
  vec3 c = mix(vec3(1.0, 0.72, 0.40), vec3(0.46, 0.36, 1.0), smoothstep(0.1, 0.9, rho));
  float kd = min(k*2.2 + wave*0.5*smoothstep(2.2, 2.6, r), 0.62);
  gl_FragColor = vec4(mix(c*k, vec3(0.70, 0.48, 0.17)*kd, uDay)*uIntro, kd*uDay*uIntro); }` }));
    const disc = new T.Mesh(annulus(1, 2, 220), m); disc.frustumCulled = false; disc.renderOrder = 0; scene.add(disc);
  })();
  /* 近处的虚焦光斑：给画面一点前景和纵深 */
  (function () {
    const N = 46, pos = new Float32Array(N * 3), d = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { const a = rnd() * TAU, r = 3.5 + rnd() * 9; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.35) * 5; pos[i * 3 + 2] = Math.sin(a) * r; d[i * 2] = 0.12 + rnd() * 0.42; d[i * 2 + 1] = rnd(); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aD', new T.BufferAttribute(d, 2));
    const m = glow(new T.ShaderMaterial({ uniforms: { uTime: U.uTime, uDay: U.uDay, uFocal: U.uFocal, uIntro: U.uIntro },
      vertexShader: `attribute vec2 aD; uniform float uTime, uFocal; varying float vK;
void main(){ vec3 p = position; p.y += sin(uTime*0.07 + aD.y*30.0)*0.4; p.x += cos(uTime*0.05 + aD.y*17.0)*0.3;
  vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv; gl_PointSize = min(aD.x*uFocal/-mv.z, 220.0); vK = 0.4 + 0.6*aD.y; }`,
      fragmentShader: `uniform float uDay, uIntro; varying float vK;
void main(){ float r = length(gl_PointCoord - 0.5)*2.0; float a = smoothstep(1.0, 0.55, r)*(0.7 + 0.3*smoothstep(0.3, 0.9, r));
  vec3 c = mix(vec3(0.72, 0.58, 1.0), vec3(1.0, 0.92, 0.80), uDay)*a*vK*mix(0.022, 0.07, uDay)*uIntro; gl_FragColor = vec4(c, 0.0); }` }));
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 6; scene.add(pts);
  })();
  /* 流星：隔一阵划过一颗 */
  const meteor = new T.Mesh(new T.PlaneGeometry(1, 1), glow(new T.ShaderMaterial({ uniforms: { uK: { value: 0 }, uDay: U.uDay },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: 'uniform float uK, uDay; varying vec2 vUv; void main(){ float a = pow(vUv.x, 2.2)*smoothstep(0.5, 0.0, abs(vUv.y - 0.5))*uK*(1.0 - uDay*0.8); gl_FragColor = vec4(vec3(1.0, 0.95, 0.9)*a*3.0, 0.0); }', side: T.DoubleSide })));
  meteor.visible = false; meteor.frustumCulled = false; skyG.add(meteor);
  const met = { t: -1, next: 5, from: new T.Vector3(), dir: new T.Vector3() };

  /* ---------- 星球 ---------- */
  const sphereGeo = new T.SphereGeometry(1, 72, 48);
  const PLANET_VS = 'varying vec3 vObj, vWN, vWP; void main(){ vObj = position; vWN = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }';
  const PLANET_FS = `uniform float uTime, uDay, uKind, uSeed, uGlow, uRad, uHover; uniform vec3 uC1, uC2, uC3, uAtmo, uCenter, uRingN; uniform vec3 uRing; uniform vec2 uHaze; varying vec3 vObj, vWN, vWP;
${NOISE}${RINGFN}
void main(){
  vec3 N = normalize(vWN), V = normalize(cameraPosition - vWP), L = normalize(-vWP);
  vec3 p = normalize(vObj); float s = uSeed*37.0;
  float ndl = dot(N, L), ndv = max(dot(N, V), 0.0);
  vec3 alb; float spec = 0.0, gloss = 48.0; vec3 emi = vec3(0.0);
  if (uKind < 0.5) {                                   /* 气态巨行星：纬向条带 + 湍流 + 一个大风暴 */
    vec3 q = p*vec3(1.5, 4.6, 1.5) + s; float w1 = fbm(q), w2 = fbm(q*2.2 + 7.3);
    float lat = p.y + (w1 - 0.5)*0.17;
    float b = sin(lat*8.5 + s)*0.55 + sin(lat*21.0 + w2*3.2 + s*1.7)*0.30 + sin(lat*45.0 + w1*5.0)*0.15; b = b*0.5 + 0.5;
    float sw = fbm(vec3(p.x*3.6 + w2*2.4, lat*28.0, p.z*3.6) + s);
    alb = mix(uC1, uC2, smoothstep(0.22, 0.78, b)); alb = mix(alb, uC3, smoothstep(0.52, 0.92, sw)*0.6);
    alb *= mix(1.0, 0.58, smoothstep(0.55, 0.98, abs(p.y)));
    vec3 sp = normalize(vec3(cos(s), -0.30, sin(s))); float sd = length((p - sp)*vec3(1.0, 2.3, 1.0));
    alb = mix(alb, uC3*1.08, smoothstep(0.24, 0.05, sd)*0.75);
    emi = alb*uGlow;
  } else if (uKind < 1.5) {                            /* 海洋行星：海、陆、极冠和缓慢移动的云 */
    float h = fbm(p*2.2 + s) + (fbm(p*5.5 - s) - 0.5)*0.35;
    float land = smoothstep(0.50, 0.545, h);
    vec3 sea = mix(uC1*0.30, uC1, smoothstep(0.26, 0.50, h));
    vec3 gnd = mix(uC2, uC3, smoothstep(0.55, 0.78, h));
    alb = mix(sea, gnd, land); spec = (1.0 - land)*1.1; gloss = 70.0;
    vec3 cp = p*3.0 + vec3(uTime*0.012, 0.0, s); float cl = smoothstep(0.50, 0.74, fbm(cp + 0.7*fbm(cp*2.1)));
    alb = mix(alb, vec3(0.96, 0.97, 1.0), cl*0.92); spec *= 1.0 - cl;
    alb = mix(alb, vec3(0.93, 0.96, 1.0), smoothstep(0.80, 0.92, abs(p.y) + 0.10*(h - 0.5)));
  } else if (uKind < 2.5) {                            /* 熔岩行星：黑色地壳，裂缝里透出光 */
    float h = fbm(p*2.6 + s); float rd = abs(fbm(p*3.3 + s*1.3 + h*0.9)*2.0 - 1.0);
    float crack = smoothstep(0.075, 0.0, rd) + smoothstep(0.035, 0.0, abs(fbm(p*7.0 - s)*2.0 - 1.0))*0.5;
    alb = mix(uC1*0.16, uC1*0.8, h);
    float pulse = 0.72 + 0.28*sin(uTime*0.7 + h*16.0);
    emi = mix(uC2, uC3, clamp(crack*crack, 0.0, 1.0))*crack*pulse*3.0 + uC2*smoothstep(0.58, 0.9, h)*0.22;
    spec = 0.25; gloss = 24.0;
  } else {                                             /* 冰封行星：浅色冰原，深色裂隙，高光很亮 */
    float h = fbm(p*3.0 + s); float cr = abs(fbm(p*6.2 + s*2.0 + h)*2.0 - 1.0);
    alb = mix(uC1, uC3, smoothstep(0.30, 0.78, h)); alb = mix(alb, uC2*0.5, smoothstep(0.09, 0.0, cr)*0.85);
    float pit = smoothstep(0.66, 0.72, vnoise(p*9.0 + s)); alb *= 1.0 - pit*0.18;
    spec = 0.8; gloss = 90.0;
  }
  float lit = smoothstep(-0.22, 0.5, ndl);
  float shadow = 1.0;
  if (uRing.z > 0.5) { float den = dot(L, uRingN); if (abs(den) > 1e-3) { float tt = dot(uCenter - vWP, uRingN)/den; if (tt > 0.0) { float rr = length(vWP + L*tt - uCenter)/uRad; float x = (rr - uRing.x)/(uRing.y - uRing.x); if (x > 0.0 && x < 1.0) shadow = 1.0 - ringBands(x, uSeed)*0.62; } } }
  vec3 sun = mix(vec3(2.25, 2.05, 1.85), vec3(1.36, 1.28, 1.18), uDay);
  vec3 amb = mix(vec3(0.026, 0.026, 0.062), vec3(0.30, 0.31, 0.40)*(0.75 + 0.25*N.y), uDay);
  vec3 col = alb*(sun*lit*(0.28 + 0.72*max(ndl, 0.0))*shadow + amb);
  vec3 H = normalize(L + V); col += sun*spec*pow(max(dot(N, H), 0.0), gloss)*lit*shadow;
  float fr = pow(1.0 - ndv, 2.6);
  col += uAtmo*fr*(0.08 + 1.35*lit)*mix(1.0, 0.42, uDay) + uAtmo*fr*fr*mix(0.14, 0.0, uDay);
  col += emi;
  col = mix(col, vec3(0.80, 0.72, 0.84), uDay*smoothstep(uHaze.x, uHaze.y, length(cameraPosition - vWP))*0.42);
  gl_FragColor = vec4(col*(1.0 + uHover*0.12), 1.0);
}`;
  const ATMO_FS = `uniform vec3 uAtmo, uCenter; uniform float uRad, uDay, uAppear, uHover; varying vec3 vWP;
void main(){ vec3 ro = cameraPosition, rd = normalize(vWP - ro), oc = uCenter - ro; float tca = dot(oc, rd); float b = sqrt(max(dot(oc, oc) - tca*tca, 0.0));
  float x = clamp((b - uRad)/(uRad*0.24), 0.0, 1.0); float g = pow(1.0 - x, 3.2)*step(uRad*0.98, b);
  vec3 nq = normalize(ro + rd*tca - uCenter); float lit = smoothstep(-0.5, 0.55, dot(nq, normalize(-uCenter)));
  float k = g*(0.10 + 1.3*lit)*(1.0 + uHover*0.9);
  gl_FragColor = vec4(uAtmo*k*mix(1.5, 1.0, uDay)*uAppear, k*uDay*0.5*uAppear); }`;
  const RING_FS = `uniform vec3 uC2, uC3, uCenter; uniform float uSeed, uRad, uDay, uAppear; varying vec2 vUv; varying vec3 vWP; ${NOISE}${RINGFN}
void main(){ float x = vUv.y; float d = ringBands(x, uSeed);
  vec3 L = normalize(-vWP), Ld = normalize(uCenter), pc = vWP - uCenter; float along = dot(pc, Ld), perp = length(pc - Ld*along);
  float sh = along > 0.0 ? smoothstep(uRad*0.94, uRad*1.05, perp) : 1.0;
  vec3 V = normalize(cameraPosition - vWP); float fwd = pow(max(dot(-V, L), 0.0), 3.0);
  vec3 col = mix(uC2, uC3, vnoise(vec3(x*21.0, uSeed*7.0, 1.0)))*(0.6 + 1.3*fwd);
  col *= mix(vec3(1.9, 1.75, 1.6), vec3(0.80, 0.76, 0.72), uDay)*mix(mix(0.07, 0.5, uDay), 1.0, sh) + mix(vec3(0.02, 0.02, 0.05), vec3(0.22), uDay);
  float a = d*mix(0.88, 0.96, uDay)*uAppear; gl_FragColor = vec4(col*a, a); }`;
  /* 轨道：屏幕空间里等宽的细线，星球身后拖一段亮尾 */
  const orbitGeo = (function () { const N = 320, ang = [], side = [], idx = []; for (let i = 0; i <= N; i++) { const a = i / N * TAU; ang.push(a, a); side.push(-1, 1); } for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array((N + 1) * 6), 3)); g.setAttribute('aAng', new T.Float32BufferAttribute(ang, 1)); g.setAttribute('aSide', new T.Float32BufferAttribute(side, 1)); g.setIndex(idx); return g; })();
  const ORBIT_VS = `attribute float aAng, aSide; uniform float uAng, uWidth; uniform vec2 uRes; varying float vT, vS;
vec4 at(float a){ return projectionMatrix*modelViewMatrix*vec4(cos(a), 0.0, sin(a), 1.0); }
void main(){ vec4 p0 = at(aAng), p1 = at(aAng + 0.03); vec2 dir = normalize((p1.xy/p1.w - p0.xy/p0.w)*uRes + vec2(1e-5)); vec2 nrm = vec2(-dir.y, dir.x);
  p0.xy += nrm*aSide*(uWidth/uRes)*p0.w; gl_Position = p0; vS = aSide; vT = fract((uAng - aAng)/6.2831853); }`;
  const ORBIT_FS = `uniform float uDay, uOp, uHover, uPulse, uR; varying float vT, vS;
void main(){ float trail = pow(1.0 - vT, 7.0); float wave = exp(-pow((uR - uPulse*5.0)*1.6, 2.0))*step(0.0, uPulse);
  float a = (mix(0.11, 0.34, uDay) + 0.75*trail + 0.25*uHover + 1.2*wave)*uOp*(1.0 - abs(vS));
  vec3 c = mix(vec3(1.0, 0.80, 0.50)*(1.0 + 1.8*trail + 3.0*wave), vec3(0.50, 0.35, 0.13), uDay);
  gl_FragColor = vec4(c*a, a*uDay); }`;
  const KIND = { 紫微: 0, 天府: 0, 天梁: 0, 贪狼: 0, 太阳: 0, 天机: 1, 天同: 1, 太阴: 1, 天相: 1, 廉贞: 2, 七杀: 2, 武曲: 3, 巨门: 3, 破军: 3 };
  const RINGED = { 紫微: 1, 天府: 1 };
  function lookOf(it) {
    const kind = KIND[it.star] == null ? 3 : KIND[it.star], base = new T.Color(it.color || '#b4c3cb'), hsl = { h: 0, s: 0, l: 0 }; base.getHSL(hsl);
    const mk = (dh, sm, l) => new T.Color().setHSL((hsl.h + dh + 1) % 1, clamp(hsl.s * sm, 0, 1), l).convertSRGBToLinear();
    let c1, c2, c3, atmo;
    if (kind === 0) { c1 = mk(-0.04, 1.0, 0.30); c2 = mk(0.02, 0.9, 0.64); c3 = mk(0.08, 0.55, 0.88); atmo = mk(0, 1.0, 0.72); if (it.star === '紫微') { c2 = new T.Color(0.80, 0.58, 0.26); c3 = new T.Color(0.93, 0.84, 1.0); } }
    else if (kind === 1) { c1 = mk(0, 1.15, 0.40); c2 = mk(-0.20, 0.5, 0.33); c3 = new T.Color().setHSL(0.11, 0.30, 0.66).convertSRGBToLinear(); atmo = mk(-0.02, 1.0, 0.72); }
    else if (kind === 2) { const eh = it.star === '七杀' ? 0.99 : 0.045, hx = (h, sa, l) => new T.Color().setHSL((h + 1) % 1, sa, l).convertSRGBToLinear(); c1 = hx(eh, 0.35, 0.17); c2 = hx(eh, 1.0, 0.52); c3 = hx(eh + 0.075, 1.0, 0.70); atmo = hx(eh + 0.02, 1.0, 0.60); }
    else { c1 = mk(0, 0.40, 0.70); c2 = mk(-0.05, 0.8, 0.30); c3 = mk(0.03, 0.2, 0.94); atmo = mk(0, 0.7, 0.80); }
    return { kind: kind, c1: c1, c2: c2, c3: c3, atmo: atmo, seed: hashStr(it.id + it.star), ring: !!RINGED[it.star], glow: it.star === '太阳' ? 0.55 : 0 };
  }
  const SLOT_ANG = [158, 338, 204, 22, 236, 304, 180, 0], SLOT_INC = [0.05, -0.07, 0.09, -0.045, 0.06, -0.08, 0.035, -0.05];
  let planets = [], portrait = false;
  const orbitR = i => portrait ? 3.05 + 0.5 * i : 3.42 + 0.76 * i;
  const phiBase = () => (portrait ? 0.92 : PHI0);
  function addPlanet(it, slot, instant) {
    const look = lookOf(it), orbit = new T.Group(), pivot = new T.Group(), tilt = new T.Group();
    orbit.rotation.set(SLOT_INC[slot], 0, SLOT_INC[(slot + 3) % 8] * 0.8); scene.add(orbit); orbit.add(pivot); pivot.add(tilt);
    tilt.rotation.set(0.12 + look.seed * 0.2, 0, 0.22 + look.seed * 0.3);
    const pu = { uTime: U.uTime, uDay: U.uDay, uHaze: U.uHaze, uKind: { value: look.kind }, uSeed: { value: look.seed }, uGlow: { value: look.glow }, uRad: { value: 1 }, uHover: { value: 0 }, uAppear: { value: 0 },
      uC1: { value: look.c1 }, uC2: { value: look.c2 }, uC3: { value: look.c3 }, uAtmo: { value: look.atmo }, uCenter: { value: new T.Vector3() }, uRingN: { value: new T.Vector3(0, 1, 0) }, uRing: { value: new T.Vector3(1.42, 2.28, look.ring ? 1 : 0) } };
    const body = new T.Mesh(sphereGeo, new T.ShaderMaterial({ uniforms: pu, vertexShader: PLANET_VS, fragmentShader: PLANET_FS })); body.layers.enable(1); tilt.add(body);
    const atmo = new T.Mesh(sphereGeo, glow(new T.ShaderMaterial({ uniforms: pu, vertexShader: 'varying vec3 vWP; void main(){ vec4 wp = modelMatrix*vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }', fragmentShader: ATMO_FS, side: T.BackSide })));
    atmo.scale.setScalar(1.24); atmo.renderOrder = 4; pivot.add(atmo);
    let ring = null;
    if (look.ring) { ring = new T.Mesh(annulus(1.42, 2.28, 160), glow(new T.ShaderMaterial({ uniforms: pu, side: T.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vWP; void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp; }', fragmentShader: RING_FS }))); ring.renderOrder = 4; tilt.add(ring); }
    const lu = { uAng: { value: 0 }, uWidth: { value: 1.5 }, uRes: U.uRes, uDay: U.uDay, uOp: { value: 0 }, uHover: pu.uHover, uPulse: U.uPulse, uR: { value: 3 } };
    const line = new T.Mesh(orbitGeo, glow(new T.ShaderMaterial({ uniforms: lu, vertexShader: ORBIT_VS, fragmentShader: ORBIT_FS, side: T.DoubleSide }))); line.frustumCulled = false; orbit.add(line);
    const p = { id: it.id, item: it, slot: slot, look: look, orbit: orbit, pivot: pivot, tilt: tilt, body: body, ring: ring, line: line, pu: pu, lu: lu,
      rad: (0.35 + look.seed * 0.12) * (look.ring ? 1.06 : 1), r: orbitR(slot), ang: SLOT_ANG[slot] * Math.PI / 180, appear: instant ? 1 : 0, appearT: 1, hover: 0, rK: 1, world: new T.Vector3(), sx: -999, sy: -999, sr: 0, vz: 1, tag: null };
    planets.push(p); return p;
  }
  function dropPlanet(p) { scene.remove(p.orbit); p.body.material.dispose(); p.line.material.dispose(); }
  function setPlanets(items) {
    const keep = {}; items.slice(0, 8).forEach(it => { keep[it.id] = it; });
    planets = planets.filter(p => { if (keep[p.id]) { p.item = keep[p.id]; return true; } dropPlanet(p); return false; });
    items.slice(0, 8).forEach(it => { if (planets.some(p => p.id === it.id)) return; let slot = 0; while (planets.some(p => p.slot === slot)) slot++; addPlanet(it, slot, false); });
    planets.sort((a, b) => a.slot - b.slot);
    if (tagLayer) bindTags();
    refit(); shownId = '';
  }

  /* ---------- 相机、交互 ---------- */
  let VW = 1, VH = 1, BW = 1, BH = 1, quality = 1;
  const cam = { theta: 0, phi: PHI0, zoom: 1, zoomT: 1, tgt: new T.Vector3(), vt: 0, vp: 0, px: 0, py: 0, D: 13, DT: 13, off: 0.13, offK: 1 };
  const ZMIN = 0.34, ZMAX = 1.7, PMIN = -0.1, PMAX = 1.32;
  const mouse = { x: 0, y: 0, inside: false, lx: 0, ly: 0, speed: 0 };
  let focusId = null, hoverId = null, shownId = '', tagLayer = null, reticle = null, keepEl = null, keep = null, keepAge = 99;
  const inKeep = p => !!keep && p.sx > keep.l - 30 && p.sx < keep.r + 30 && p.sy + p.sr > keep.t - 6 && p.sy - p.sr < keep.b;
  let cbHover = noop, cbPick = noop, cbGesture = noop;
  let anim = null, flash = 0, flashCol = new T.Color(1, 1, 1);
  const outerUsed = () => planets.reduce((m, p) => Math.max(m, orbitR(p.slot)), orbitR(1));
  function refit() {
    const a = VW / VH, tanH = Math.tan(camera.fov * Math.PI / 360), was = portrait; portrait = a < 0.9;
    if (portrait !== was) cam.phi = phiBase();
    cam.off = portrait ? 0.10 : 0.13;
    cam.DT = Math.max(portrait ? 14 : 11.6, (outerUsed() + (portrait ? 0.55 : 0.95)) / (tanH * a));
    U.uOuter.value = outerUsed() + 1.5;
    const orb = [99, 99, 99, 99, 99, 99, 99, 99]; planets.forEach((p, i) => { if (i < 8) orb[i] = orbitR(p.slot); }); U.uOrb.value = orb;
  }
  const pointers = new Map(); let drag = null, moved = 0, pinch0 = 0;
  const pinchDist = () => { const v = Array.from(pointers.values()); return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); };
  function local(e) { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }
  function hit(x, y) { let best = null; planets.forEach(p => { if (p.appear < 0.5 || p.vz <= 0 || inKeep(p)) return; const d = Math.hypot(x - p.sx, y - p.sy); if (d < p.sr + 7 && (!best || p.vz < best.vz)) best = p; }); return best; }
  function setHover(id, silent) { if (id === hoverId) return; hoverId = id; canvas.classList.toggle('point', !!id); if (!silent) cbHover(id); }
  canvas.addEventListener('pointerdown', function (e) {
    if (anim) return; local(e); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有可捕获的指针 */ } pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { drag = { t: performance.now() }; moved = 0; cam.vt = cam.vp = 0; canvas.classList.add('grabbing'); } else if (pointers.size === 2) { pinch0 = pinchDist(); drag = null; }
  });
  canvas.addEventListener('pointermove', function (e) {
    local(e); mouse.inside = true;
    const p = pointers.get(e.pointerId);
    if (!p) { if (!anim) { const h = hit(mouse.x, mouse.y); setHover(h ? h.id : null); } return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) { const d = pinchDist(); if (pinch0 > 0 && d > 0) cam.zoomT = clamp(cam.zoomT * pinch0 / d, ZMIN, ZMAX); pinch0 = d; cbGesture(); return; }
    if (!drag || anim) return;
    moved += Math.abs(dx) + Math.abs(dy);
    const now = performance.now(), dtm = Math.max(8, now - drag.t) / 1000; drag.t = now;
    cam.theta -= dx * 0.0055; cam.phi = clamp(cam.phi + dy * 0.0045, PMIN, PMAX);
    cam.vt = cam.vt * 0.5 + (-dx * 0.0055 / dtm) * 0.5; cam.vp = cam.vp * 0.5 + (dy * 0.0045 / dtm) * 0.5;
    if (moved > 6) cbGesture();
  });
  function release(e) {
    if (!pointers.has(e.pointerId)) return; pointers.delete(e.pointerId);
    if (pointers.size) return;
    canvas.classList.remove('grabbing');
    if (drag && moved < 6 && !anim) { const h = hit(mouse.x, mouse.y); if (h) cbPick(h.id); else pulse(); }
    if (drag && performance.now() - drag.t > 90) cam.vt = cam.vp = 0;
    drag = null;
  }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', function () { mouse.inside = false; if (!pointers.size) setHover(null); });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); if (anim) return; cam.zoomT = clamp(cam.zoomT * Math.exp(clamp(e.deltaY, -120, 120) * 0.0016), ZMIN, ZMAX); cbGesture(); }, { passive: false });
  canvas.addEventListener('dblclick', function () { if (anim) return; cam.zoomT = 1; cam.phi = phiBase(); cam.theta = 0; cam.vt = cam.vp = 0; });
  function pulse() { if (reduce) return; U.uPulse.value = 0; gim.forEach((g, i) => { g.kick += (i % 2 ? -1 : 1) * (0.9 + i * 0.35); }); starKick = 1; }

  /* ---------- 渲染目标与后期 ---------- */
  let rtScene = null, rtOcc = null, rtRays = null; const dn = [], up = []; const LV = 6;
  function sizeTargets() {
    if (rtScene) rtScene.dispose();
    if (msaa >= 2) { rtScene = new T.WebGLMultisampleRenderTarget(BW, BH, { type: FT, format: T.RGBAFormat, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false }); rtScene.samples = msaa; rtScene.texture.generateMipmaps = false; }
    else rtScene = mkRT(BW, BH, true);
    const qw = Math.max(2, BW >> 2), qh = Math.max(2, BH >> 2);
    if (rtOcc) { rtOcc.setSize(qw, qh); rtRays.setSize(qw, qh); } else { rtOcc = mkRT(qw, qh, true); rtRays = mkRT(qw, qh, false); }
    for (let i = 0; i < LV; i++) { const w = Math.max(2, BW >> (i + 1)), h = Math.max(2, BH >> (i + 1)); if (dn[i]) { dn[i].setSize(w, h); up[i].setSize(w, h); } else { dn[i] = mkRT(w, h, false); up[i] = mkRT(w, h, false); } }
  }
  const mPre = passMat(`uniform sampler2D tMap; uniform vec2 uTexel; uniform float uThr, uKnee; varying vec2 vUv;
void main(){ vec3 c = texture2D(tMap, vUv + uTexel*vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(1.0, 1.0)).rgb; c *= 0.25;
  float br = max(c.r, max(c.g, c.b)); float sf = clamp(br - uThr + uKnee, 0.0, 2.0*uKnee); sf = sf*sf/(4.0*uKnee + 1e-4);
  c *= max(sf, br - uThr)/max(br, 1e-4); gl_FragColor = vec4(min(c, vec3(30.0)), 1.0); }`, { tMap: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 1 }, uKnee: { value: 0.5 } });
  const mDown = passMat(`uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;
void main(){ vec3 c = texture2D(tMap, vUv).rgb*4.0 + texture2D(tMap, vUv + uTexel*vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel*vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(c/8.0, 1.0); }`, { tMap: { value: null }, uTexel: { value: new T.Vector2() } });
  const mUp = passMat(`uniform sampler2D tMap, tAdd; uniform vec2 uTexel; uniform float uMix; varying vec2 vUv;
void main(){ vec2 o = uTexel; vec3 c = texture2D(tMap, vUv + vec2(-2.0*o.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(2.0*o.x, 0.0)).rgb + texture2D(tMap, vUv + vec2(0.0, -2.0*o.y)).rgb + texture2D(tMap, vUv + vec2(0.0, 2.0*o.y)).rgb;
  c += (texture2D(tMap, vUv + vec2(-o.x, o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, o.y)).rgb + texture2D(tMap, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tMap, vUv + vec2(o.x, -o.y)).rgb)*2.0;
  gl_FragColor = vec4(texture2D(tAdd, vUv).rgb + c/12.0*uMix, 1.0); }`, { tMap: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() }, uMix: { value: 0.9 } });
  const mRays = passMat(`uniform sampler2D tMap; uniform vec2 uCenter; uniform float uTime; varying vec2 vUv;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
void main(){ vec2 d = (vUv - uCenter)*(0.94/56.0); vec2 uv = vUv - d*h21(gl_FragCoord.xy + fract(uTime)*91.0); float ill = 1.0; vec3 c = vec3(0.0);
  for (int i = 0; i < 56; i++){ c += texture2D(tMap, uv).rgb*ill; ill *= 0.958; uv -= d; }
  gl_FragColor = vec4(c*0.026, 1.0); }`, { tMap: { value: null }, uCenter: { value: new T.Vector2(0.5, 0.5) }, uTime: U.uTime });
  const cu = { tScene: { value: null }, tBloom: { value: null }, tRays: { value: null }, uExp: { value: 1 }, uBloom: { value: 0.2 }, uRays: { value: 1 }, uRayCol: { value: new T.Color(0.86, 0.76, 1.0) }, uDay: U.uDay,
    uFlash: { value: 0 }, uFlashCol: { value: flashCol }, uTime: U.uTime, uVig: { value: 0.5 }, uScrim: { value: 1 }, uFade: { value: 0 }, uAspect: { value: 1 }, uStarPos: { value: new T.Vector2(0.5, 0.5) } };
  const mComp = passMat(`uniform sampler2D tScene, tBloom, tRays; uniform float uExp, uBloom, uRays, uDay, uFlash, uTime, uVig, uScrim, uFade, uAspect; uniform vec3 uRayCol, uFlashCol; uniform vec2 uStarPos; varying vec2 vUv;
vec3 knee(vec3 x){ vec3 k = vec3(0.72); return mix(x, k + (1.0 - k)*(1.0 - exp(-(x - k)/(1.0 - k))), step(k, x)); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
void main(){ vec2 cc = vUv - 0.5; float r2 = dot(cc, cc); vec2 ca = cc*r2*0.006;
  vec3 hdr = vec3(texture2D(tScene, vUv + ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - ca).b);
  hdr += texture2D(tBloom, vUv).rgb*uBloom + texture2D(tRays, vUv).rgb*uRayCol*uRays;
  float sd = length((vUv - uStarPos)*vec2(uAspect, 1.0));
  hdr += mix(vec3(0.16, 0.11, 0.36)*0.16, vec3(1.0, 0.92, 0.80)*0.20, uDay)*exp(-sd*sd*mix(7.0, 15.0, uDay));
  hdr *= uExp*uFade;
  vec3 c = mix(aces(hdr), knee(hdr), uDay);
  c = pow(c, vec3(1.0/2.2));
  c *= 1.0 - uVig*smoothstep(0.38, 1.05, length(cc*vec2(1.0, 1.12))*1.3);
  float sc = smoothstep(0.56, 0.04, vUv.y)*(0.30 + 0.70*exp(-cc.x*cc.x*9.0))*uScrim;
  c = mix(c, mix(vec3(0.030, 0.030, 0.052), vec3(0.972, 0.960, 0.965), uDay), sc*mix(0.70, 0.60, uDay));
  c = mix(c, uFlashCol, uFlash);
  c += (h21(gl_FragCoord.xy + fract(uTime)*311.0) - 0.5)*mix(0.032, 0.014, uDay)*(1.0 - uFlash);
  gl_FragColor = vec4(c, 1.0); }`, cu);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    VW = w; VH = h;
    let sc = Math.min(window.devicePixelRatio || 1, 2) * quality; const px = w * h * sc * sc, cap = 3.3e6; if (px > cap) sc *= Math.sqrt(cap / px);
    BW = Math.max(2, Math.round(w * sc)); BH = Math.max(2, Math.round(h * sc));
    renderer.setPixelRatio(1); renderer.setSize(BW, BH, false);
    U.uPx.value = BW / w; U.uFocal.value = BH / (2 * Math.tan(camera.fov * Math.PI / 360)); U.uRes.value.set(BW, BH);
    sizeTargets(); camera.aspect = w / h; refit(); if (!started) cam.D = cam.DT;
  }
  let started = false;
  if (window.ResizeObserver) new ResizeObserver(function () { resize(); if (running) draw(); }).observe(canvas); else window.addEventListener('resize', resize);

  /* ---------- 每帧 ---------- */
  let running = true, last = 0, time = 0, iT = reduce ? 1 : 0, dayT = 0, starKick = 0, slow = 0, frames = 0;
  const INTRO = 3.6, v3 = new T.Vector3(), fwd = new T.Vector3();
  function update(dt) {
    if (iT < 1) iT = Math.min(1, iT + dt / INTRO);
    const io = easeOut(iT);
    U.uTime.value = time; U.uIntro.value = sstep(0.08, 0.7, iT);
    cu.uFade.value = sstep(0.0, 0.14, iT);
    /* 夜 → 昼：浅色主题下，开场是一次破晓 */
    const dTarget = dayT * (iT < 1 ? sstep(0.40, 1.0, iT) : 1);
    U.uDay.value += (dTarget - U.uDay.value) * (iT < 1 ? 1 : 1 - Math.exp(-dt * 2.4));
    const day = U.uDay.value; if (Math.abs(day - dayT) < 0.002 && iT >= 1) U.uDay.value = dayT;
    const env = day > 0.5 ? envDay : envNight; if (scene.environment !== env) scene.environment = env;
    scene.fog.near = mix(5000, cam.D * 0.72, day); scene.fog.far = mix(10000, cam.D * 3.0, day); U.uHaze.value.set(cam.D * 0.78, cam.D * 2.5);
    lamp.intensity = mix(2.4, 0.9, day); keyL.intensity = mix(1.5, 0.9, day); rimL.intensity = mix(1.3, 0.35, day); fillL.intensity = mix(0.55, 0.3, day); gold.envMapIntensity = mix(2.1, 1.3, day); brass.envMapIntensity = mix(1.6, 1.1, day);
    cu.uExp.value = 1.0; cu.uBloom.value = mix(0.16, 0.075, day); cu.uRays.value = mix(0.62, 0.24, day); cu.uVig.value = mix(0.5, 0.2, day);
    cu.uRayCol.value.setRGB(mix(0.86, 1.0, day), mix(0.76, 0.93, day), mix(1.0, 0.82, day));
    mPre.uniforms.uThr.value = HDR ? mix(0.95, 1.3, day) : mix(0.7, 0.97, day); mPre.uniforms.uKnee.value = mix(0.5, 0.1, day);
    /* 紫微星点亮 */
    starKick *= Math.exp(-dt * 2.6);
    starU.uStar.value = sstep(0.04, 0.34, iT) * (1 + 1.5 * Math.exp(-Math.pow((iT - 0.3) / 0.075, 2)) * (iT < 1 ? 1 : 0)) * (1 + 0.5 * starKick) * (1 + 0.035 * Math.sin(time * 1.7));
    if (U.uPulse.value >= 0) { U.uPulse.value += dt; if (U.uPulse.value > 4) U.uPulse.value = -100; }
    /* 环：从一张平盘慢慢张开，之后各自绕自己的轴转 */
    const open = easeOut((iT - 0.16) / 0.62);
    gim.forEach(g => { g.kick *= Math.exp(-dt * 1.1); if (!reduce) g.ang += (g.w + g.kick) * dt; const a = (g.a0 + g.ang) * open; if (g.axisX) g.g.rotation.x = a; else g.g.rotation.z = a; });
    /* 相机 */
    if (!drag) { cam.theta += cam.vt * dt; cam.phi = clamp(cam.phi + cam.vp * dt, PMIN, PMAX); }
    const damp = Math.exp(-dt * 2.6); cam.vt *= damp; cam.vp *= damp;
    cam.D += (cam.DT - cam.D) * (1 - Math.exp(-dt * 3));
    const tx = mouse.inside && !drag ? (mouse.x / VW - 0.5) : 0, ty = mouse.inside && !drag ? (mouse.y / VH - 0.5) : 0;
    cam.px += (tx - cam.px) * (1 - Math.exp(-dt * 2.5)); cam.py += (ty - cam.py) * (1 - Math.exp(-dt * 2.5));
    if (anim) stepAnim(dt); else cam.zoom += (cam.zoomT - cam.zoom) * (1 - Math.exp(-dt * 7));
    const th = cam.theta + cam.px * 0.11 - 0.75 * (1 - io) + Math.sin(time * 0.055) * 0.07, ph = clamp(cam.phi + cam.py * 0.05 - 0.30 * (1 - io), -0.14, 1.38), d = cam.D * cam.zoom * (1 + 0.6 * (1 - io));
    camera.position.set(cam.tgt.x + d * Math.sin(th) * Math.cos(ph), cam.tgt.y + d * Math.sin(ph), cam.tgt.z + d * Math.cos(th) * Math.cos(ph)); camera.lookAt(cam.tgt);
    camera.setViewOffset(VW, VH, 0, cam.off * cam.offK * VH, VW, VH); camera.updateMatrixWorld();
    camera.getWorldDirection(fwd);
    skyG.position.copy(camera.position); skyG.rotation.y = time * 0.0035;
    corona.quaternion.copy(camera.quaternion); sunSrc.quaternion.copy(camera.quaternion);
    /* 鼠标射线：拨开尘埃 */
    const sp = Math.hypot(mouse.x - mouse.lx, mouse.y - mouse.ly); mouse.lx = mouse.x; mouse.ly = mouse.y;
    mouse.speed += ((mouse.inside ? Math.min(1, sp / 26) : 0) - mouse.speed) * (1 - Math.exp(-dt * 6)); U.uPush.value = reduce ? 0 : mouse.speed;
    v3.set(mouse.x / VW * 2 - 1, -(mouse.y / VH) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize(); U.uRayD.value.copy(v3); U.uRayO.value.copy(camera.position);
    /* 星球 */
    const tanH = Math.tan(camera.fov * Math.PI / 360), scale = portrait ? 1.3 : 1;
    planets.forEach((p, i) => {
      const at = iT < 1 ? sstep(0.42 + i * 0.07, 0.72 + i * 0.07, iT) * p.appearT : p.appearT;
      p.appear += (at - p.appear) * (iT < 1 ? 1 : 1 - Math.exp(-dt * 3.2));
      p.hover += ((p.id === hoverId ? 1 : 0) - p.hover) * (1 - Math.exp(-dt * 9));
      const rT = orbitR(p.slot); p.r += (rT - p.r) * (1 - Math.exp(-dt * 2.5));
      const r = p.r * p.rK; p.ang += 0.085 * Math.pow(Math.max(r, 1.2), -1.5) * dt * (p.id === hoverId ? 0.25 : 1) * (reduce ? 0 : 1);
      p.pivot.position.set(Math.cos(p.ang) * r, 0, Math.sin(p.ang) * r);
      const k = p.rad * scale * Math.max(p.appear, 1e-4) * (1 + 0.1 * p.hover); p.pivot.scale.setScalar(k);
      p.body.rotation.y = time * 0.11 + p.look.seed * 9;
      p.line.scale.setScalar(r); p.lu.uAng.value = ((p.ang % TAU) + TAU) % TAU; p.lu.uOp.value = p.appear * sstep(0.3, 0.8, iT); p.lu.uR.value = r; p.lu.uWidth.value = 1.5 * U.uPx.value;
      p.orbit.updateMatrixWorld(true); p.pivot.getWorldPosition(p.world);
      p.pu.uCenter.value.copy(p.world); p.pu.uRad.value = k; p.pu.uHover.value = p.hover; p.pu.uAppear.value = p.appear;
      if (p.ring) { v3.set(0, 1, 0).transformDirection(p.tilt.matrixWorld); p.pu.uRingN.value.copy(v3); }
      v3.copy(p.world).sub(camera.position); p.vz = v3.dot(fwd);
      v3.copy(p.world).project(camera); p.sx = (v3.x * 0.5 + 0.5) * VW; p.sy = (-v3.y * 0.5 + 0.5) * VH; p.sr = p.vz > 0 ? k * (VH / 2) / (tanH * p.vz) : 0;
    });
    /* 十二宫盘与十四主星：跟着当前这张盘 */
    const cur = byId(hoverId) || byId(focusId);
    plateU.uShow.value += ((cur ? 1 : 0) - plateU.uShow.value) * (1 - Math.exp(-dt * 4));
    if (cur && cur.id !== shownId) { shownId = cur.id; const it = cur.item; drawPlate(it.names); plateU.uMing.value = it.ming; plateU.uToday.value = it.today;
      const hsl = new T.Color();
      (it.beads || []).forEach(b => { const i = STARS14.indexOf(b.name); if (i < 0) return; beadT[i] = (b.b * 30 + (b.k - (b.n - 1) / 2) * 8.5) * Math.PI / 180; hsl.set(b.color || '#ffffff').convertSRGBToLinear(); beadCol[i * 3] = hsl.r; beadCol[i * 3 + 1] = hsl.g; beadCol[i * 3 + 2] = hsl.b; beadSize[i] = b.big ? 0.15 : 0.115; });
      beadGeo.attributes.aCol.needsUpdate = true; beadGeo.attributes.aSize.needsUpdate = true; }
    for (let i = 0; i < 14; i++) { let dlt = ((beadT[i] - beadAng[i]) % TAU + TAU * 1.5) % TAU - Math.PI; beadAng[i] += dlt * (1 - Math.exp(-dt * (2.2 + i * 0.12))); }
    beadGeo.attributes.aAng.needsUpdate = true;
    /* 流星 */
    if (!reduce && iT >= 1) { if (met.t < 0) { met.next -= dt; if (met.next < 0) { met.t = 0; met.next = 7 + rnd() * 9; met.from.copy(tangent((rnd() - 0.5) * 0.9, 0.02 + rnd() * 0.22)); met.dir.set(rnd() - 0.3, -(0.25 + rnd() * 0.5), 0).normalize(); meteor.visible = true; } }
      else { met.t += dt / 0.85; const k = met.t; if (k >= 1) { met.t = -1; meteor.visible = false; } else { const c = met.from.clone().addScaledVector(rightC, met.dir.x * k * 0.22).addScaledVector(upC, met.dir.y * k * 0.22).normalize().multiplyScalar(870); meteor.position.copy(c); meteor.lookAt(camera.position);
        meteor.rotateZ(Math.atan2(met.dir.y, met.dir.x)); meteor.scale.set(70, 1.4, 1); meteor.material.uniforms.uK.value = Math.sin(k * Math.PI); } } }
    cu.uFlash.value = flash; cu.uScrim.value = cam.offK;
  }
  const byId = id => { for (let i = 0; i < planets.length; i++) if (planets[i].id === id) return planets[i]; return null; };
  function stepAnim(dt) {
    const a = anim; a.t += dt; const k = clamp(a.t / a.dur, 0, 1), p = a.p;
    if (a.kind === 'dive') { const e = easeIO(k); cam.tgt.lerpVectors(a.t0, p.world, e); cam.zoom = mix(a.z0, p.pu.uRad.value * 3.1 / cam.D, e); cam.offK = 1 - e; flash = sstep(0.60, 1.0, k); if (k >= 1 && !a.done) { a.done = true; a.cb(); } }
    else if (a.kind === 'rise') { const e = easeIO(k); if (p) cam.tgt.lerpVectors(p.world, a.t0, e); else cam.tgt.set(0, 0, 0); cam.zoom = mix(a.z0, 1, e); cam.offK = e; flash = 1 - sstep(0.0, 0.5, k); if (k >= 1) { cam.zoom = cam.zoomT = 1; cam.tgt.set(0, 0, 0); cam.offK = 1; flash = 0; anim = null; } }
    else if (a.kind === 'birth') { p.rK = mix(0.1, 1, easeOut(k)); p.appearT = 1; cam.zoom += (cam.zoomT - cam.zoom) * (1 - Math.exp(-dt * 7)); if (k >= 1) { p.rK = 1; anim = null; a.cb(); } }
  }
  function draw() {
    if (!rtScene) return;
    camera.layers.set(0); renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
    /* 遮挡通道 → 径向模糊 = 从环缝里漏出来的光束 */
    renderer.setRenderTarget(rtOcc); renderer.clear();
    camera.layers.set(1); scene.overrideMaterial = blackMat; renderer.render(scene, camera); scene.overrideMaterial = null;
    camera.layers.set(2); renderer.render(scene, camera); camera.layers.set(0);
    v3.set(0, 0, 0).project(camera); mRays.uniforms.uCenter.value.set(v3.x * 0.5 + 0.5, v3.y * 0.5 + 0.5); cu.uStarPos.value.copy(mRays.uniforms.uCenter.value); cu.uAspect.value = VW / VH; mRays.uniforms.tMap.value = rtOcc.texture; runPass(mRays, rtRays);
    /* 多级泛光：逐级缩小再逐级放大叠回去 */
    mPre.uniforms.tMap.value = rtScene.texture; mPre.uniforms.uTexel.value.set(1 / BW, 1 / BH); runPass(mPre, dn[0]);
    for (let i = 1; i < LV; i++) { mDown.uniforms.tMap.value = dn[i - 1].texture; mDown.uniforms.uTexel.value.set(1 / dn[i - 1].width, 1 / dn[i - 1].height); runPass(mDown, dn[i]); }
    let src = dn[LV - 1];
    for (let i = LV - 2; i >= 0; i--) { mUp.uniforms.tMap.value = src.texture; mUp.uniforms.tAdd.value = dn[i].texture; mUp.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height); runPass(mUp, up[i]); src = up[i]; }
    cu.tScene.value = rtScene.texture; cu.tBloom.value = up[0].texture; cu.tRays.value = rtRays.texture; runPass(mComp, null);
  }
  /* 名字标签和准星跟着星球走 */
  function bindTags() { planets.forEach(p => { p.tag = tagLayer.querySelector('[data-pid="' + p.id + '"]'); }); }
  function place() {
    if (keepEl && ++keepAge > 20) { keepAge = 0; const a = keepEl.getBoundingClientRect(), b = canvas.getBoundingClientRect(); keep = a.width ? { l: a.left - b.left, r: a.right - b.left, t: a.top - b.top, b: a.bottom - b.top } : null; }
    v3.set(0, 0, 0).project(camera); const scx = (v3.x * 0.5 + 0.5) * VW, scy = (-v3.y * 0.5 + 0.5) * VH, svz = v3.set(0, 0, 0).sub(camera.position).dot(fwd), sR = 2.1 * (VH / 2) / (Math.tan(camera.fov * Math.PI / 360) * Math.max(svz, 0.1));
    planets.forEach(p => { if (!p.tag) return; const on = p.vz > 0 && p.appear > 0.6 && p.sx > -80 && p.sx < VW + 80 && !inKeep(p); let dim = 1;
      if (on && p.id !== hoverId && p.vz > svz && Math.hypot(p.sx - scx, p.sy + p.sr + 20 - scy) < sR * 0.92) dim = 0.16;
      if (on) planets.forEach(q => { if (q !== p && q.vz > 0 && (q.vz < p.vz || q.id === hoverId) && p.id !== hoverId && ((Math.abs(q.sx - p.sx) < (portrait ? 72 : 104) && Math.abs((q.sy + q.sr) - (p.sy + p.sr)) < (portrait ? 36 : 46)) || Math.hypot(q.sx - p.sx, q.sy - (p.sy + p.sr * (p.ring ? 1.6 : 1) + 24)) < q.sr + (portrait ? 14 : 26))) dim = 0.16; });
      p.tag.style.transform = 'translate3d(' + p.sx.toFixed(1) + 'px,' + (p.sy + p.sr * (p.ring ? 1.6 : 1) + 5).toFixed(1) + 'px,0)'; p.tag.style.opacity = on ? (dim < 1 ? String(dim) : '') : '0'; p.tag.style.visibility = on ? '' : 'hidden'; });
    if (reticle) { const p = byId(hoverId) || byId(focusId); if (p && p.vz > 0 && p.appear > 0.6 && !anim && !inKeep(p)) { const R = p.sr + 9; reticle.style.width = reticle.style.height = (R * 2).toFixed(1) + 'px'; reticle.style.transform = 'translate3d(' + (p.sx - R).toFixed(1) + 'px,' + (p.sy - R).toFixed(1) + 'px,0)'; reticle.classList.add('on'); } else reticle.classList.remove('on'); }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; started = true;
    if (!reduce) time += dt; update(dt); draw(); place();
    /* 帧率持续偏低就降一档分辨率 */
    if (iT >= 1 && !anim) { frames++; if (dt > 0.03) slow++; if (frames >= 120) { if (slow > 70 && quality > 0.55) { quality *= 0.8; resize(); } frames = slow = 0; } }
  }
  resize(); requestAnimationFrame(frame);

  return {
    ok: true, introMs: reduce ? 0 : INTRO * 1000,
    setPlanets: setPlanets,
    focus: function (id) { focusId = id; },
    hover: function (id) { setHover(id || null, true); },
    layers: function (tags, ret, col) { tagLayer = tags; reticle = ret; keepEl = col || null; keepAge = 99; bindTags(); },
    onHover: function (fn) { cbHover = fn; }, onPick: function (fn) { cbPick = fn; }, onGesture: function (fn) { cbGesture = fn; },
    grade: function (day, instant) { dayT = day ? 1 : 0; if (instant) U.uDay.value = dayT; },
    show: function (on) { running = on; if (on) { last = 0; resize(); } },
    replay: function () { if (reduce) return; iT = 0; U.uDay.value = 0; cam.theta = 0; cam.phi = phiBase(); cam.zoom = cam.zoomT = 1; },
    dive: function (id, col, cb) { const p = byId(id); if (!p || reduce) { cb(); return; } setHover(null, true); flashCol.set(col); pointers.clear(); drag = null; anim = { kind: 'dive', t: 0, dur: 1.3, p: p, t0: cam.tgt.clone(), z0: cam.zoom, cb: cb }; },
    rise: function (id, col) { if (reduce) { flash = 0; return; } const p = byId(id); flashCol.set(col); flash = 1; cam.offK = 0; if (p) { p.orbit.updateMatrixWorld(true); p.pivot.getWorldPosition(p.world); cam.tgt.copy(p.world); }
      anim = { kind: 'rise', t: 0, dur: 1.5, p: p, t0: new T.Vector3(), z0: p ? p.rad * 4.4 / cam.D : 0.7 }; cam.zoom = anim.z0; },
    birth: function (id, cb) { const p = byId(id); if (!p || reduce) { cb(); return; } p.rK = 0.1; p.appear = 0; pulse(); anim = { kind: 'birth', t: 0, dur: 2.1, p: p, cb: cb }; }
  };
})();
