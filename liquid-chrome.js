const TAU = Math.PI * 2;

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_bass;
uniform float u_mids;
uniform float u_treble;
uniform float u_transient;
uniform float u_melody;
uniform float u_phase;
uniform float u_reduced_motion;
uniform float u_has_artwork;
uniform sampler2D u_artwork;
uniform vec3 u_palette_a;
uniform vec3 u_palette_b;
uniform vec3 u_palette_c;

float waveRadius(float angle, float time) {
  float motion = mix(time, time * 0.18, u_reduced_motion);
  float broad = sin(angle * 3.0 + motion * 0.42 + u_phase * 6.28318) * (0.018 + u_mids * 0.036);
  float folded = sin(angle * 5.0 - motion * 0.31 + u_melody * 1.8) * (0.008 + u_melody * 0.022);
  float detail = sin(angle * 9.0 + motion * 0.68) * u_treble * 0.012;
  return 0.42 + u_bass * 0.075 + broad + folded + detail;
}

float blobDistance(vec2 point, float time) {
  float angle = atan(point.y, point.x);
  return length(point) - waveRadius(angle, time);
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / u_resolution;
  vec2 point = screenUv * 2.0 - 1.0;
  point.x *= u_resolution.x / max(1.0, u_resolution.y);

  float time = u_time;
  float distanceToBlob = blobDistance(point, time);
  float edge = smoothstep(0.024, -0.018, distanceToBlob);

  float epsilon = 0.006;
  vec2 normal = normalize(vec2(
    blobDistance(point + vec2(epsilon, 0.0), time) - blobDistance(point - vec2(epsilon, 0.0), time),
    blobDistance(point + vec2(0.0, epsilon), time) - blobDistance(point - vec2(0.0, epsilon), time)
  ));

  float radius = max(0.34, waveRadius(atan(point.y, point.x), time));
  vec2 artworkUv = point / (radius * 2.12) + 0.5;
  artworkUv += normal * (0.025 + u_mids * 0.028);
  artworkUv.y = 1.0 - artworkUv.y;
  vec3 artwork = texture2D(u_artwork, clamp(artworkUv, 0.002, 0.998)).rgb;
  float artworkLight = dot(artwork, vec3(0.2126, 0.7152, 0.0722));

  vec3 paletteFlow = mix(u_palette_a, u_palette_b, 0.5 + 0.5 * sin(u_phase * 6.28318 + point.y * 3.2));
  paletteFlow = mix(paletteFlow, u_palette_c, 0.5 + 0.5 * sin(u_phase * 4.8 - point.x * 4.0));
  vec3 material = mix(paletteFlow * (0.48 + artworkLight * 0.72), artwork, 0.34 * u_has_artwork);

  float rim = pow(max(0.0, 1.0 - abs(dot(normal, normalize(vec2(-0.42, 0.92))))), 4.0);
  float sweep = pow(max(0.0, 1.0 - abs(point.x * 1.15 + point.y * 0.62 - sin(time * 0.22) * 0.2)), 18.0);
  float glint = pow(max(0.0, dot(normal, normalize(vec2(-0.72, 0.68)))), 14.0 + u_treble * 20.0);
  vec3 chrome = material * (0.42 + rim * 0.54) + vec3(0.72, 0.78, 0.84) * sweep * (0.24 + u_treble * 0.66);
  chrome += mix(u_palette_c, vec3(1.0), 0.62) * glint * (0.34 + u_treble * 0.82 + u_transient * 0.38);

  vec2 gridUv = screenUv * vec2(18.0, 26.0);
  vec2 gridLine = smoothstep(vec2(0.965), vec2(0.995), fract(gridUv));
  float grid = max(gridLine.x, gridLine.y) * 0.055;
  float gridMask = smoothstep(1.18, 0.22, length(point - vec2(0.36, -0.16)));
  vec3 gridColor = mix(u_palette_a, u_palette_c, 0.56);

  vec2 trailOffset = vec2(0.045 + u_transient * 0.055, -0.025) * (1.0 - u_reduced_motion * 0.7);
  float trailA = smoothstep(0.02, -0.03, blobDistance(point - trailOffset, time - 0.12));
  float trailB = smoothstep(0.02, -0.03, blobDistance(point + trailOffset * 0.68, time - 0.25));
  float trail = max(trailA * 0.075, trailB * 0.045) * (0.3 + u_transient * 0.9 + u_melody * 0.28);

  vec3 color = chrome * edge;
  color += gridColor * grid * gridMask;
  color += paletteFlow * trail;
  float alpha = max(edge * 0.965, max(grid * gridMask, trail));
  gl_FragColor = vec4(color, alpha);
}
`;

function hexToRgb(hex) {
  const clean = String(hex || "#ffffff").replace("#", "");
  const expanded = clean.length === 3 ? clean.split("").map((part) => part + part).join("") : clean;
  const value = Number.parseInt(expanded, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Shader linking failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

export class LiquidChromeRenderer {
  constructor({ webglCanvas, fallbackCanvas, stage, reducedMotion = false }) {
    this.webglCanvas = webglCanvas;
    this.fallbackCanvas = fallbackCanvas;
    this.stage = stage;
    this.reducedMotion = reducedMotion;
    this.active = false;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.palette = ["#282b32", "#8796aa", "#f0f4f7"];
    this.paletteRgb = this.palette.map(hexToRgb);
    this.artworkImage = null;
    this.fallbackContext = fallbackCanvas.getContext("2d", { alpha: true });
    this.forceFallback = new URL(window.location.href).searchParams.get("renderer") === "canvas";
    this.usingFallback = this.forceFallback;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.locations = null;

    webglCanvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.usingFallback = true;
      this.updateSurfaceState("context-lost");
    });
    webglCanvas.addEventListener("webglcontextrestored", () => {
      this.usingFallback = false;
      this.initializeWebGL();
      this.uploadArtwork();
      this.updateSurfaceState("webgl");
    });

    if (!this.forceFallback) {
      try {
        this.initializeWebGL();
      } catch (error) {
        console.warn("Liquid Chrome is using its Canvas renderer.", error);
        this.usingFallback = true;
      }
    }
    this.updateSurfaceState(this.usingFallback ? "canvas" : "webgl");
  }

  initializeWebGL() {
    const gl = this.webglCanvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });
    if (!gl) throw new Error("WebGL is unavailable");

    const program = createProgram(gl);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name) => gl.getUniformLocation(program, name);
    this.locations = {
      resolution: uniform("u_resolution"),
      time: uniform("u_time"),
      bass: uniform("u_bass"),
      mids: uniform("u_mids"),
      treble: uniform("u_treble"),
      transient: uniform("u_transient"),
      melody: uniform("u_melody"),
      phase: uniform("u_phase"),
      reducedMotion: uniform("u_reduced_motion"),
      hasArtwork: uniform("u_has_artwork"),
      paletteA: uniform("u_palette_a"),
      paletteB: uniform("u_palette_b"),
      paletteC: uniform("u_palette_c"),
      artwork: uniform("u_artwork")
    };

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([210, 216, 224, 255]));
    gl.uniform1i(this.locations.artwork, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    this.gl = gl;
    this.program = program;
    this.texture = texture;
    this.usingFallback = false;
  }

  updateSurfaceState(reason) {
    this.stage.dataset.liquidRenderer = this.usingFallback ? "canvas" : "webgl";
    this.stage.dataset.liquidRendererReason = reason;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      this.fallbackContext?.clearRect(0, 0, this.fallbackCanvas.width, this.fallbackCanvas.height);
      if (this.gl) {
        this.gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      }
    }
  }

  setPalette(palette) {
    const colors = Array.isArray(palette?.colors) && palette.colors.length >= 3
      ? palette.colors
      : [palette?.primary, palette?.secondary, palette?.highlight].filter(Boolean);
    this.palette = colors.length >= 3 ? [colors[1] || colors[0], colors[Math.floor(colors.length / 2)], colors.at(-1)] : this.palette;
    this.paletteRgb = this.palette.map(hexToRgb);
  }

  setArtwork(url) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      this.artworkImage = image;
      this.uploadArtwork();
    };
    image.onerror = () => {
      this.artworkImage = null;
    };
    image.src = url;
  }

  uploadArtwork() {
    if (!this.gl || !this.texture || !this.artworkImage) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.artworkImage);
  }

  resize(width, height, pixelRatio) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.pixelRatio = Math.min(2, Math.max(1, pixelRatio || 1));
    const pixelWidth = Math.max(1, Math.round(this.width * this.pixelRatio));
    const pixelHeight = Math.max(1, Math.round(this.height * this.pixelRatio));
    [this.webglCanvas, this.fallbackCanvas].forEach((canvas) => {
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
    });
  }

  render(time, signals) {
    if (!this.active) return;
    if (this.usingFallback || !this.gl || !this.program) this.drawFallback(time, signals);
    else this.drawWebGL(time, signals);
  }

  drawWebGL(time, signals) {
    const gl = this.gl;
    const locations = this.locations;
    gl.viewport(0, 0, this.webglCanvas.width, this.webglCanvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(locations.resolution, this.webglCanvas.width, this.webglCanvas.height);
    gl.uniform1f(locations.time, time * 0.001);
    gl.uniform1f(locations.bass, signals.bass);
    gl.uniform1f(locations.mids, signals.mids);
    gl.uniform1f(locations.treble, signals.treble);
    gl.uniform1f(locations.transient, signals.transient);
    gl.uniform1f(locations.melody, signals.melody);
    gl.uniform1f(locations.phase, signals.palettePhase);
    gl.uniform1f(locations.reducedMotion, this.reducedMotion ? 1 : 0);
    gl.uniform1f(locations.hasArtwork, this.artworkImage ? 1 : 0);
    gl.uniform3fv(locations.paletteA, this.paletteRgb[0]);
    gl.uniform3fv(locations.paletteB, this.paletteRgb[1]);
    gl.uniform3fv(locations.paletteC, this.paletteRgb[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  makeFallbackPath(time, signals, offsetX = 0, offsetY = 0, scale = 1) {
    const path = new Path2D();
    const centerX = this.width / 2 + offsetX;
    const centerY = this.height / 2 + offsetY;
    const base = Math.min(this.width, this.height) * (0.265 + signals.bass * 0.042) * scale;
    const motionTime = this.reducedMotion ? time * 0.00005 : time * 0.00022;
    const points = 28;
    for (let index = 0; index <= points; index += 1) {
      const angle = (index / points) * TAU - Math.PI / 2;
      const radius = base * (
        1
        + Math.sin(angle * 3 + motionTime + signals.palettePhase * TAU) * (0.035 + signals.mids * 0.075)
        + Math.sin(angle * 5 - motionTime * 0.7) * signals.melody * 0.035
        + Math.sin(angle * 9 + motionTime * 1.4) * signals.treble * 0.018
      );
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    return path;
  }

  drawFallback(time, signals) {
    const ctx = this.fallbackContext;
    if (!ctx) return;
    const ratio = this.pixelRatio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.strokeStyle = `${this.palette[1]}18`;
    ctx.lineWidth = 0.6;
    const grid = Math.max(28, Math.min(this.width, this.height) / 14);
    for (let x = this.width * 0.55; x < this.width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, this.height * 0.2);
      ctx.lineTo(x, this.height * 0.78);
      ctx.stroke();
    }
    for (let y = this.height * 0.2; y < this.height * 0.8; y += grid) {
      ctx.beginPath();
      ctx.moveTo(this.width * 0.52, y);
      ctx.lineTo(this.width * 0.94, y);
      ctx.stroke();
    }
    ctx.restore();

    const trailStrength = Math.min(0.16, 0.025 + signals.transient * 0.11 + signals.melody * 0.025);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = `${this.palette[0]}${Math.round(trailStrength * 255).toString(16).padStart(2, "0")}`;
    ctx.fill(this.makeFallbackPath(time - 140, signals, 18, -8, 0.97));
    ctx.fillStyle = `${this.palette[1]}${Math.round(trailStrength * 0.65 * 255).toString(16).padStart(2, "0")}`;
    ctx.fill(this.makeFallbackPath(time - 260, signals, -12, 7, 0.94));
    ctx.restore();

    const shape = this.makeFallbackPath(time, signals);
    ctx.save();
    ctx.clip(shape);
    if (this.artworkImage) {
      const size = Math.min(this.width, this.height) * 0.72;
      ctx.globalAlpha = 0.78;
      ctx.drawImage(this.artworkImage, this.width / 2 - size / 2, this.height / 2 - size / 2, size, size);
    } else {
      ctx.fillStyle = this.palette[0];
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "screen";
    const sheen = ctx.createLinearGradient(this.width * 0.3, this.height * 0.25, this.width * 0.7, this.height * 0.75);
    sheen.addColorStop(0, `${this.palette[0]}66`);
    sheen.addColorStop(0.42, "rgba(238,246,255,.74)");
    sheen.addColorStop(0.53, `${this.palette[2]}7a`);
    sheen.addColorStop(1, `${this.palette[1]}38`);
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = this.palette[2];
    ctx.globalAlpha = 0.42 + signals.treble * 0.45;
    ctx.lineWidth = 0.9 + signals.transient * 1.4;
    ctx.shadowColor = this.palette[2];
    ctx.shadowBlur = 10 + signals.treble * 18;
    ctx.stroke(shape);
    ctx.restore();
  }

  dispose() {
    if (this.gl && this.program) this.gl.deleteProgram(this.program);
    if (this.gl && this.texture) this.gl.deleteTexture(this.texture);
  }
}
