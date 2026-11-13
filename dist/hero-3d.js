// Clip Bounty - Lightweight 3D Broadcast Studio Showcase (WebGL)
// Pure WebGL implementation: zero external dependencies, ultra-fast, CSP-compliant.
// Renders a floating 3D broadcast monitor, illuminated timeline, pulsing waveform pillars,
// playhead marker with trim brackets, and responsive pointer tilt.

export function initHero3D(canvas, fallback) {
  if (!canvas) return null;
  
  // Check for reduced motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }

  const gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }

  // Vertex Shader
  const vsSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uMatrix;
    varying vec3 vColor;
    varying vec3 vPos;
    void main() {
      vColor = aColor;
      vPos = aPosition;
      gl_Position = uMatrix * vec4(aPosition, 1.0);
    }
  `;

  // Fragment Shader
  const fsSource = `
    precision mediump float;
    varying vec3 vColor;
    varying vec3 vPos;
    uniform float uTime;
    void main() {
      // Subtle scanline / glow pulse
      float pulse = 0.9 + 0.1 * sin(uTime * 2.0 + vPos.y * 3.0);
      gl_FragColor = vec4(vColor * pulse, 0.95);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('3D Shader Error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (fallback) fallback.style.display = 'block';
    canvas.style.display = 'none';
    return null;
  }
  gl.useProgram(prog);

  const positions = [];
  const colors = [];

  function addQuad(p1, p2, p3, p4, c) {
    positions.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    for (let i = 0; i < 6; i++) colors.push(...c);
  }

  function addBox(cx, cy, cz, w, h, d, c) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    addQuad([cx - hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz + hd], c);
    addQuad([cx + hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz - hd], [cx - hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz - hd], [c[0]*0.6, c[1]*0.6, c[2]*0.6]);
    addQuad([cx - hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz + hd], [cx + hw, cy + hh, cz - hd], [cx - hw, cy + hh, cz - hd], [c[0]*1.2, c[1]*1.2, c[2]*1.2]);
    addQuad([cx - hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy - hh, cz + hd], [cx - hw, cy - hh, cz + hd], [c[0]*0.4, c[1]*0.4, c[2]*0.4]);
    addQuad([cx - hw, cy - hh, cz - hd], [cx - hw, cy - hh, cz + hd], [cx - hw, cy + hh, cz + hd], [cx - hw, cy + hh, cz - hd], [c[0]*0.8, c[1]*0.8, c[2]*0.8]);
    addQuad([cx + hw, cy - hh, cz + hd], [cx + hw, cy - hh, cz - hd], [cx + hw, cy + hh, cz - hd], [cx + hw, cy + hh, cz + hd], [c[0]*0.8, c[1]*0.8, c[2]*0.8]);
  }

  // Monitor frame
  addBox(0, 0.45, 0, 2.8, 1.6, 0.08, [0.08, 0.11, 0.12]);
  addBox(0, 0.45, 0.045, 2.66, 1.46, 0.02, [0.06, 0.09, 0.09]);
  addBox(0, 1.25, 0.05, 2.7, 0.02, 0.02, [0.79, 1.0, 0.26]);

  // Monitor stand
  addBox(0, -0.42, -0.15, 0.35, 0.25, 0.2, [0.12, 0.15, 0.16]);
  addBox(0, -0.55, -0.05, 1.2, 0.04, 0.7, [0.09, 0.12, 0.13]);

  // Secondary top display
  addBox(0, 1.48, -0.22, 2.2, 0.42, 0.06, [0.05, 0.08, 0.09]);
  addBox(0, 1.48, -0.18, 2.1, 0.36, 0.02, [0.12, 0.22, 0.22]);

  // Timeline base track
  addBox(0, -0.48, 0.45, 3.2, 0.05, 0.45, [0.08, 0.12, 0.12]);
  addBox(0, -0.45, 0.25, 3.1, 0.02, 0.02, [0.36, 0.96, 0.91]);
  addBox(0, -0.45, 0.65, 3.1, 0.02, 0.02, [0.79, 1.0, 0.26]);

  // 3D Audio waveform bars
  const waveCount = 28;
  const startX = -1.35;
  const stepX = 2.7 / waveCount;
  for (let i = 0; i < waveCount; i++) {
    const x = startX + i * stepX;
    const norm = (i / waveCount) * Math.PI * 2;
    const waveH = 0.06 + 0.18 * Math.abs(Math.sin(norm * 2.5) * Math.cos(norm * 1.5));
    const t = i / waveCount;
    const barColor = [0.79 * (1 - t) + 0.36 * t, 1.0 * (1 - t) + 0.96 * t, 0.26 * (1 - t) + 0.91 * t];
    addBox(x, -0.42 + waveH / 2, 0.45, 0.04, waveH, 0.06, barColor);
  }

  // Playhead needle and trim brackets
  const phX = 0.22;
  addBox(phX, -0.32, 0.45, 0.035, 0.35, 0.08, [0.79, 1.0, 0.26]);
  addBox(phX, -0.12, 0.45, 0.09, 0.09, 0.09, [0.36, 0.96, 0.91]);
  addBox(phX - 0.22, -0.36, 0.45, 0.03, 0.22, 0.05, [0.79, 1.0, 0.26]);
  addBox(phX - 0.17, -0.26, 0.45, 0.12, 0.025, 0.05, [0.79, 1.0, 0.26]);
  addBox(phX - 0.17, -0.46, 0.45, 0.12, 0.025, 0.05, [0.79, 1.0, 0.26]);
  addBox(phX + 0.22, -0.36, 0.45, 0.03, 0.22, 0.05, [0.79, 1.0, 0.26]);
  addBox(phX + 0.17, -0.26, 0.45, 0.12, 0.025, 0.05, [0.79, 1.0, 0.26]);
  addBox(phX + 0.17, -0.46, 0.45, 0.12, 0.025, 0.05, [0.79, 1.0, 0.26]);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const colBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, 'aPosition');
  const aCol = gl.getAttribLocation(prog, 'aColor');
  const uMatrix = gl.getUniformLocation(prog, 'uMatrix');
  const uTime = gl.getUniformLocation(prog, 'uTime');

  gl.enableVertexAttribArray(aPos);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(aCol);
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 0, 0);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);

  function mat4Perspective(out, fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = (2 * far * near) / (near - far); out[15] = 0;
  }

  function mat4Multiply(out, a, b) {
    const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
    const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
    const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    for (let i = 0; i < 4; i++) {
      const a0 = a[i * 4], a1 = a[i * 4 + 1], a2 = a[i * 4 + 2], a3 = a[i * 4 + 3];
      out[i * 4] = a0 * b00 + a1 * b10 + a2 * b20 + a3 * b30;
      out[i * 4 + 1] = a0 * b01 + a1 * b11 + a2 * b21 + a3 * b31;
      out[i * 4 + 2] = a0 * b02 + a1 * b12 + a2 * b22 + a3 * b32;
      out[i * 4 + 3] = a0 * b03 + a1 * b13 + a2 * b23 + a3 * b33;
    }
  }

  function mat4RotationY(out, rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    out[0] = c;  out[1] = 0; out[2] = -s; out[3] = 0;
    out[4] = 0;  out[5] = 1; out[6] = 0;  out[7] = 0;
    out[8] = s;  out[9] = 0; out[10] = c; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  }

  function mat4RotationX(out, rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = c; out[6] = s; out[7] = 0;
    out[8] = 0; out[9] = -s; out[10] = c; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  }

  let targetRotY = -0.12;
  let targetRotX = 0.08;
  let currentRotY = -0.12;
  let currentRotX = 0.08;

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    targetRotY = -0.12 + nx * 0.35;
    targetRotX = 0.08 + ny * 0.22;
  };

  const onPointerLeave = () => {
    targetRotY = -0.12;
    targetRotX = 0.08;
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);

  let animId = null;
  const proj = new Float32Array(16);
  const rotX = new Float32Array(16);
  const rotY = new Float32Array(16);
  const model = new Float32Array(16);
  const mvp = new Float32Array(16);

  let startTime = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 200 || h < 150) return;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  function render(now) {
    resize();
    const elapsed = (now - startTime) / 1000;

    const idleRotY = Math.sin(elapsed * 0.4) * 0.08;
    const idleRotX = Math.cos(elapsed * 0.3) * 0.04;
    const idleY = Math.sin(elapsed * 0.8) * 0.04;

    currentRotY += (targetRotY + idleRotY - currentRotY) * 0.08;
    currentRotX += (targetRotX + idleRotX - currentRotX) * 0.08;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / Math.max(canvas.height, 1);
    mat4Perspective(proj, 42 * (Math.PI / 180), aspect, 0.1, 100.0);

    mat4RotationX(rotX, currentRotX);
    mat4RotationY(rotY, currentRotY);
    mat4Multiply(model, rotX, rotY);

    model[12] = 0.0;
    model[13] = -0.3 + idleY;
    model[14] = -4.2;

    mat4Multiply(mvp, proj, model);

    gl.uniformMatrix4fv(uMatrix, false, mvp);
    gl.uniform1f(uTime, elapsed);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    animId = requestAnimationFrame(render);
  }

  animId = requestAnimationFrame(render);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    }
  };
}
