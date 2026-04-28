import * as THREE from "three";
import type { Pattern, PatternContext } from "./types";

let mesh: THREE.Mesh | null = null;
let geometry: THREE.PlaneGeometry | null = null;
let material: THREE.ShaderMaterial | null = null;

let dotDensity  = 14;
let dotSize     = 0.65;
let flowScale   = 2.0;
let flowSpeed   = 0.1;
let swirlLines  = 0.5;
let saturation  = 1.0;
let colorSpeed  = 0.15;
let brightness  = 1.0;
let rotateSpeed = 0.0;

let colorPhase = 0;
let rotAngle   = 0;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2  uResolution;
  uniform float uDotDensity;
  uniform float uDotSize;
  uniform float uFlowScale;
  uniform float uFlowSpeed;
  uniform float uSwirlLines;
  uniform float uSaturation;
  uniform float uColorPhase;
  uniform float uBrightness;
  uniform float uRotAngle;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a*noise(p); p = p*2.1+vec2(3.1,1.7); a *= 0.5; }
    return v;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
    float cosR = cos(uRotAngle), sinR = sin(uRotAngle);
    vec2 p = vec2(c.x*cosR - c.y*sinR, c.x*sinR + c.y*cosR);
    float t = uTime * uFlowSpeed;

    // Two fbm fields as curvilinear coordinates
    float fu = fbm(p * uFlowScale + t);
    float fv = fbm(p * uFlowScale + vec2(5.2, 1.3) - t * 0.7);

    // Dot grid in flow space
    vec2 fc  = vec2(fu, fv) * uDotDensity;
    vec2 cf  = fract(fc) - 0.5;
    float dd = length(cf);
    float r  = uDotSize * (0.15 + 0.85 * fu) * 0.45;
    float aa = max(fwidth(dd), 0.003);
    float dotMask = smoothstep(r + aa, r - aa, dd);

    // Sphere shading
    vec2  ln    = cf / max(r, 0.001);
    float nz    = sqrt(max(0.0, 1.0 - dot(ln, ln)));
    vec3  sphN  = normalize(vec3(ln, nz));
    vec3  ldir  = normalize(vec3(-0.5, 0.7, 0.8));
    float diff  = max(0.0, dot(sphN, ldir));
    float spec  = pow(max(0.0, dot(reflect(-ldir, sphN), vec3(0,0,1))), 28.0);
    vec3  sBase = mix(vec3(0.42, 0.05, 0.85), vec3(0.88, 0.72, 1.0), mix(fu, 1.0, uSaturation*0.3));
    vec3  sCol  = sBase * (0.25 + 0.75*diff) + vec3(1.0)*spec*0.9;

    // Background: deep purple with noise depth
    vec3 bgCol = mix(vec3(0.04, 0.0, 0.1), vec3(0.18, 0.02, 0.38), fv*0.6 + 0.4);

    // Decorative swirl lines
    float sphi  = fbm(p * uFlowScale * 1.8 + t*0.4 + vec2(2.3, 4.7));
    float sBand = fract(sphi * 30.0);
    float sAA   = max(fwidth(sBand), 0.008);
    float sLine = smoothstep(0.0, sAA, sBand) * smoothstep(0.08, 0.06 - sAA, sBand);
    bgCol += vec3(0.75, 0.5, 1.0) * sLine * uSwirlLines;

    vec3 col = mix(bgCol, sCol * uBrightness, dotMask);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export const pearlFlow: Pattern = {
  id: "pearlFlow",
  name: "Pearl Flow",
  controls: [
    { label: "Dot Density",  type: "range", min: 5,   max: 40,  step: 1,    get: () => dotDensity,  set: (v) => { dotDensity = v; } },
    { label: "Dot Size",     type: "range", min: 0.1, max: 1.0, step: 0.01, get: () => dotSize,     set: (v) => { dotSize = v; } },
    { label: "Flow Scale",   type: "range", min: 0.5, max: 5.0, step: 0.1,  get: () => flowScale,   set: (v) => { flowScale = v; } },
    { label: "Flow Speed",   type: "range", min: 0.0, max: 0.5, step: 0.01, get: () => flowSpeed,   set: (v) => { flowSpeed = v; } },
    { label: "Swirl Lines",  type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => swirlLines,  set: (v) => { swirlLines = v; } },
    { label: "Color Speed",  type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => colorSpeed,  set: (v) => { colorSpeed = v; } },
    { label: "Saturation",   type: "range", min: 0.0, max: 1.0, step: 0.05, get: () => saturation,  set: (v) => { saturation = v; } },
    { label: "Brightness",   type: "range", min: 0.2, max: 2.0, step: 0.05, get: () => brightness,  set: (v) => { brightness = v; } },
    { label: "Rotate",       type: "range", min: 0.0, max: 0.5, step: 0.01, get: () => rotateSpeed, set: (v) => { rotateSpeed = v; } },
  ],

  init(ctx: PatternContext) {
    geometry = new THREE.PlaneGeometry(2, 2);
    material = new THREE.ShaderMaterial({
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(ctx.size.width, ctx.size.height) },
        uDotDensity: { value: dotDensity },
        uDotSize:    { value: dotSize },
        uFlowScale:  { value: flowScale },
        uFlowSpeed:  { value: flowSpeed },
        uSwirlLines: { value: swirlLines },
        uSaturation: { value: saturation },
        uColorPhase: { value: colorPhase },
        uBrightness: { value: brightness },
        uRotAngle:   { value: rotAngle },
      },
      vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    ctx.scene.add(mesh);
  },

  update(dt: number, elapsed: number) {
    if (!material) return;
    colorPhase += dt * colorSpeed * 0.5;
    rotAngle   += dt * rotateSpeed * 1.5;
    material.uniforms.uTime.value       = elapsed;
    material.uniforms.uDotDensity.value = dotDensity;
    material.uniforms.uDotSize.value    = dotSize;
    material.uniforms.uFlowScale.value  = flowScale;
    material.uniforms.uFlowSpeed.value  = flowSpeed;
    material.uniforms.uSwirlLines.value = swirlLines;
    material.uniforms.uSaturation.value = saturation;
    material.uniforms.uColorPhase.value = colorPhase;
    material.uniforms.uBrightness.value = brightness;
    material.uniforms.uRotAngle.value   = rotAngle;
  },

  resize(width: number, height: number) {
    if (material) material.uniforms.uResolution.value.set(width, height);
  },

  dispose() {
    geometry?.dispose(); material?.dispose();
    mesh = null; geometry = null; material = null;
  },
};
