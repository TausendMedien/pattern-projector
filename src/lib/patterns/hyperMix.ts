import * as THREE from "three";
import type { Pattern, PatternControl, PatternContext } from "./types";

// Mutable params — read by controls and by the shader uniforms setter
const params = {
  speed: 0.04,
  curlScale: 0.35,
  spread: 1.6,
  pointSize: 2.0,
  pointCount: 40000,
};

// ─── Shaders ──────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `

uniform float uTime;
uniform float uSpeed;
uniform float uCurlScale;
uniform float uSpread;
uniform float uPtSize;

attribute float aSeed;
attribute float aSide;

varying float vColorRatio;
varying float vAlpha;

// ── 3-D Simplex noise (Stefan Gustavson, public domain) ───────────────────────
vec3 _mod289(vec3 x){ return x - floor(x*(1./289.))*289.; }
vec4 _mod289(vec4 x){ return x - floor(x*(1./289.))*289.; }
vec4 _perm(vec4 x){ return _mod289(((x*34.)+1.)*x); }

float snoise(vec3 v){
  const vec2 C = vec2(1./6., 1./3.);
  const vec4 D = vec4(0., 0.5, 1., 2.);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = _mod289(i);
  vec4 p = _perm(_perm(_perm(
      i.z + vec4(0.,i1.z,i2.z,1.))
    + i.y + vec4(0.,i1.y,i2.y,1.))
    + i.x + vec4(0.,i1.x,i2.x,1.));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.*floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.*x_);
  vec4 x  = x_*ns.x + ns.yyyy;
  vec4 y  = y_*ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.+1.;
  vec4 s1 = floor(b1)*2.+1.;
  vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.);
  m = m*m;
  return 42. * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// ── Curl noise via numerical differentiation of a vector potential field ──────
vec3 curlNoise(vec3 p) {
  const float e = 0.07;
  const vec3 OFF1 = vec3(31.416, 127.1,  311.7);
  const vec3 OFF2 = vec3(269.5,  183.3,  246.1);
  // Ax = snoise(p), Ay = snoise(p+OFF1), Az = snoise(p+OFF2)
  // curl.x = dAz/dy - dAy/dz
  float az_py = snoise(p + vec3(0.,e,0.) + OFF2);
  float az_my = snoise(p - vec3(0.,e,0.) + OFF2);
  float ay_pz = snoise(p + vec3(0.,0.,e) + OFF1);
  float ay_mz = snoise(p - vec3(0.,0.,e) + OFF1);
  // curl.y = dAx/dz - dAz/dx
  float ax_pz = snoise(p + vec3(0.,0.,e));
  float ax_mz = snoise(p - vec3(0.,0.,e));
  float az_px = snoise(p + vec3(e,0.,0.) + OFF2);
  float az_mx = snoise(p - vec3(e,0.,0.) + OFF2);
  // curl.z = dAy/dx - dAx/dy
  float ay_px = snoise(p + vec3(e,0.,0.) + OFF1);
  float ay_mx = snoise(p - vec3(e,0.,0.) + OFF1);
  float ax_py = snoise(p + vec3(0.,e,0.));
  float ax_my = snoise(p - vec3(0.,e,0.));
  return vec3(
    (az_py - az_my - ay_pz + ay_mz),
    (ax_pz - ax_mz - az_px + az_mx),
    (ay_px - ay_mx - ax_py + ax_my)
  ) / (2.*e);
}

void main() {
  // Life: each particle cycles through [0,1) based on seed + time
  float period   = 4.0 + aSeed * 8.0;           // individual lifetime 4-12 s
  float tLife    = fract((uTime * uSpeed + aSeed * 37.93) / period);

  // Spawn position on a sphere, offset to one side by the emitter
  float theta    = aSeed * 6.2831853;
  float phi      = acos(2. * fract(aSeed * 127.1 + 0.5) - 1.);
  vec3 onSphere  = vec3(sin(phi)*cos(theta), sin(phi)*sin(theta), cos(phi));
  vec3 spawnPos  = onSphere * uSpread;
  spawnPos.x    += aSide * uSpread * 1.8;       // left / right emitter offset

  // Integrate curl field with 6 Euler steps from spawn to current life position
  vec3 pos = spawnPos;
  float noiseTime = uTime * uSpeed * 0.4 + aSeed * 13.7;
  float intDt = tLife / 6.0;
  for (int i = 0; i < 6; i++) {
    float tt = noiseTime + float(i) * intDt * 0.8;
    pos += curlNoise(pos * uCurlScale + tt) * intDt * 3.0;
  }

  // Drift particles gently toward centre (emitter pull decays with life)
  pos.x -= aSide * smoothstep(0., 0.4, tLife) * uSpread * 0.5;

  vColorRatio = aSide * 0.5 + 0.5;
  // Normalize alpha inversely to point area so brightness stays constant as
  // size changes. Reference size = 2.0; bigger points get proportionally fainter.
  float sizeRef = 2.0;
  float areaNorm = (sizeRef * sizeRef) / (uPtSize * uPtSize);
  vAlpha = smoothstep(0.0, 0.08, tLife) * smoothstep(1.0, 0.75, tLife) * areaNorm;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPtSize * (80.0 / -mv.z);
}
`;

const fragmentShader = /* glsl */ `

uniform vec3 uColor1;
uniform vec3 uColor2;

varying float vColorRatio;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, d) * vAlpha * 0.7;
  vec3 col = mix(uColor1, uColor2, vColorRatio);
  col = mix(col, vec3(1.0), smoothstep(0.3, 0.0, d) * 0.4);
  gl_FragColor = vec4(col, alpha);
}
`;

// ─── Pattern state ─────────────────────────────────────────────────────────────

let points: THREE.Points | null = null;
let geometry: THREE.BufferGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;
let cam: THREE.PerspectiveCamera | null = null;
let sceneRef: THREE.Scene | null = null;

function buildGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const seeds     = new Float32Array(count);
  const sides     = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = Math.cbrt(Math.random()) * params.spread;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    seeds[i] = Math.random();
    sides[i] = i % 2 === 0 ? -1 : 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSeed",    new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute("aSide",    new THREE.BufferAttribute(sides, 1));
  return geo;
}

export const hyperMix: Pattern = {
  id: "hyperMix",
  name: "Hyper Mix",

  controls: [
    {
      label: "Speed",
      type: "range",
      min: 0.002,
      max: 0.6,
      step: 0.002,
      getValue: () => params.speed,
      setValue: (v) => {
        params.speed = v;
        if (material) material.uniforms.uSpeed.value = v;
      },
    },
    {
      label: "Turbulence",
      type: "range",
      min: 0.01,
      max: 2.5,
      step: 0.01,
      getValue: () => params.curlScale,
      setValue: (v) => {
        params.curlScale = v;
        if (material) material.uniforms.uCurlScale.value = v;
      },
    },
    {
      label: "Spread",
      type: "range",
      min: 0.1,
      max: 6.0,
      step: 0.1,
      getValue: () => params.spread,
      setValue: (v) => {
        params.spread = v;
        if (material) material.uniforms.uSpread.value = v;
      },
    },
    {
      label: "Point Size",
      type: "range",
      min: 0.2,
      max: 12.0,
      step: 0.2,
      getValue: () => params.pointSize,
      setValue: (v) => {
        params.pointSize = v;
        if (material) material.uniforms.uPtSize.value = v;
      },
    },
    {
      label: "Point Count",
      type: "range",
      min: 5000,
      max: 100000,
      step: 5000,
      getValue: () => params.pointCount,
      setValue: (v) => {
        params.pointCount = v;
        if (sceneRef && points && material) {
          sceneRef.remove(points);
          geometry?.dispose();
          geometry = buildGeometry(v);
          points = new THREE.Points(geometry, material);
          sceneRef.add(points);
        }
      },
    },
  ],

  init(ctx: PatternContext) {
    cam = ctx.camera;
    sceneRef = ctx.scene;
    cam.position.set(0, 0, 8);
    cam.lookAt(0, 0, 0);

    geometry = buildGeometry(params.pointCount);

    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uSpeed:     { value: params.speed },
        uCurlScale: { value: params.curlScale },
        uSpread:    { value: params.spread },
        uPtSize: { value: params.pointSize },
        uColor1:    { value: new THREE.Color(0x4466ff) },
        uColor2:    { value: new THREE.Color(0xff44aa) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    points = new THREE.Points(geometry, material);
    ctx.scene.add(points);
  },

  update(_dt: number, elapsed: number) {
    if (material) material.uniforms.uTime.value = elapsed;
  },

  resize() {},

  dispose() {
    geometry?.dispose();
    material?.dispose();
    points = null;
    geometry = null;
    material = null;
    cam = null;
    sceneRef = null;
  },
};
