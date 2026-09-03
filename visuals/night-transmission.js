import { resolveReleaseArtwork, resolveTrackAudio } from "../media-provider.js?v=20260901-3";

const elements = {
  audio: document.querySelector("#audio"),
  backdrop: document.querySelector("#transmission-backdrop"),
  heroCopy: document.querySelector(".hero-copy"),
  trackCode: document.querySelector("#track-code"),
  trackTitle: document.querySelector("#track-title"),
  artistName: document.querySelector("#artist-name"),
  mixName: document.querySelector("#mix-name"),
  metaArtist: document.querySelector("#meta-artist"),
  metaTrack: document.querySelector("#meta-track"),
  metaRelease: document.querySelector("#meta-release"),
  metaYear: document.querySelector("#meta-year"),
  metaGenre: document.querySelector("#meta-genre"),
  metaRuntime: document.querySelector("#meta-runtime"),
  rightsNote: document.querySelector("#rights-note"),
  sourceLink: document.querySelector("#source-link"),
  playbackStatus: document.querySelector("#playback-status"),
  waveformState: document.querySelector("#waveform-state"),
  signalState: document.querySelector("#signal-state"),
  signalFill: document.querySelector("#signal-fill"),
  signalValue: document.querySelector("#signal-value"),
  waveformCanvas: document.querySelector("#waveform-canvas"),
  frequencyCanvas: document.querySelector("#frequency-canvas"),
  disc: document.querySelector("#compact-disc"),
  discArt: document.querySelector("#disc-art"),
  discRelease: document.querySelector("#disc-release"),
  discCatalog: document.querySelector("#disc-catalog"),
  previousButton: document.querySelector("#previous-button"),
  playButton: document.querySelector("#play-button"),
  nextButton: document.querySelector("#next-button"),
  trackSelect: document.querySelector("#track-select"),
  playerTrackNumber: document.querySelector("#player-track-number"),
  seek: document.querySelector("#seek"),
  elapsed: document.querySelector("#elapsed"),
  duration: document.querySelector("#duration"),
  volume: document.querySelector("#volume"),
  volumeValue: document.querySelector("#volume-value"),
  themeColor: document.querySelector('meta[name="theme-color"]')
};

const state = {
  catalog: null,
  releases: new Map(),
  currentIndex: 0,
  audioContext: null,
  analyser: null,
  sourceNode: null,
  frequencyData: null,
  waveformData: null,
  signalLevel: 0,
  playbackPromise: null,
  raf: 0,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

function formatTime(seconds, round = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = round ? Math.round(seconds) : Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function releaseName(release) {
  return release.displayTitle || release.title;
}

function rightsFor(track) {
  return { ...state.catalog.rights?.defaults, ...track.rights };
}

function versionName(track, release) {
  if (/slowed/i.test(track.title)) return /reverb/i.test(track.title) ? "SLOWED + REVERB" : "SLOWED EDIT";
  if (release.type === "single") return "ORIGINAL RELEASE";
  return String(release.type || "ARCHIVE RELEASE").replaceAll("-", " ").toUpperCase();
}

function setStatus(message) {
  elements.playbackStatus.textContent = message.toUpperCase();
}

function persistTrack(track) {
  try {
    localStorage.setItem("rg-player-current-track", track.id);
  } catch {
    // Cross-page continuity is optional; the visual still works without storage.
  }
}

function updateMediaSession(track, release, artwork) {
  if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: releaseName(release),
    artwork: [{ src: artwork, sizes: `${release.artwork.width || 1200}x${release.artwork.height || 1200}`, type: release.artwork.mimeType || "image/jpeg" }]
  });
}

function applyTrack(index, { autoplay = false, updateUrl = true } = {}) {
  const tracks = state.catalog.tracks;
  const nextIndex = (index + tracks.length) % tracks.length;
  const track = tracks[nextIndex];
  const release = state.releases.get(track.releaseId);
  const rights = rightsFor(track);
  const artwork = resolveReleaseArtwork(state.catalog, release);
  const wasPlaying = !elements.audio.paused;

  state.currentIndex = nextIndex;
  elements.trackCode.textContent = `TRACK_${String(nextIndex + 1).padStart(2, "0")}`;
  elements.trackTitle.textContent = track.title;
  elements.heroCopy.dataset.titleScale = track.title.length > 18 ? "compact" : "display";
  elements.artistName.textContent = track.artist;
  elements.mixName.textContent = versionName(track, release);
  elements.metaArtist.textContent = track.artist;
  elements.metaTrack.textContent = track.title;
  elements.metaRelease.textContent = releaseName(release);
  elements.metaYear.textContent = String(release.releaseDate || track.releaseDate || "").slice(0, 4) || "—";
  elements.metaGenre.textContent = release.genre || track.genre || "Unclassified";
  elements.metaRuntime.textContent = formatTime(track.durationMs / 1000, true);
  elements.rightsNote.textContent = rights.credit || "Rights remain with the recording owner.";
  elements.sourceLink.href = rights.sourceUrl || release.sourceUrl || "../index.html";
  elements.sourceLink.textContent = rights.sourceLabel || "Official source ↗";
  elements.discArt.src = artwork;
  elements.discArt.alt = `${release.title} cover art`;
  elements.discRelease.textContent = releaseName(release);
  elements.discCatalog.textContent = `RG-${String(nextIndex + 1).padStart(2, "0")} / ${elements.metaYear.textContent} / DIGITAL AUDIO`;
  elements.duration.textContent = formatTime(track.durationMs / 1000, true);
  elements.trackSelect.value = track.id;
  elements.playerTrackNumber.textContent = `${String(nextIndex + 1).padStart(2, "0")} / ${String(tracks.length).padStart(2, "0")}`;
  elements.playButton.setAttribute("aria-label", `Play ${track.title}`);

  const palette = release.palette;
  document.documentElement.style.setProperty("--track-bg", palette.background);
  document.documentElement.style.setProperty("--track-panel", palette.surface);
  document.documentElement.style.setProperty("--track-accent", palette.accent);
  document.documentElement.style.setProperty("--track-highlight", palette.highlight);
  document.documentElement.style.setProperty("--track-art", `url("${artwork}")`);
  elements.themeColor.setAttribute("content", palette.background);

  elements.seek.value = "0";
  elements.elapsed.textContent = "0:00";
  elements.audio.src = resolveTrackAudio(state.catalog, track);
  elements.audio.load();
  setStatus("Archive loaded");
  document.title = `${track.title} — Night Transmission · RG Player`;
  updateMediaSession(track, release, artwork);
  persistTrack(track);

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("track", track.id);
    history.replaceState({}, "", url);
  }

  if (autoplay || wasPlaying) void startPlayback().catch(() => {});
}

async function ensureAudioGraph() {
  if (state.audioContext && state.analyser && state.sourceNode) {
    if (state.audioContext.state === "suspended") await state.audioContext.resume();
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const audioContext = state.audioContext || new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.78;
  const sourceNode = audioContext.createMediaElementSource(elements.audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  state.audioContext = audioContext;
  state.analyser = analyser;
  state.sourceNode = sourceNode;
  state.frequencyData = new Uint8Array(analyser.frequencyBinCount);
  state.waveformData = new Uint8Array(analyser.fftSize);
  if (audioContext.state === "suspended") await audioContext.resume();
}

function reportPlaybackError(error) {
  const mediaError = elements.audio.error;
  if (error?.name === "NotAllowedError") setStatus("Tap play once more");
  else if (error?.name === "NotSupportedError" || mediaError?.code === 4) setStatus("Audio format unavailable");
  else setStatus("Playback failed — retry");
  console.error("Night Transmission playback failed.", { error, mediaError });
}

function setPlaybackPending(pending) {
  elements.playButton.toggleAttribute("aria-busy", pending);
  document.body.dataset.playbackPending = String(pending);
}

function startPlayback() {
  if (state.playbackPromise) return state.playbackPromise;
  if (!elements.audio.paused && !elements.audio.ended) return Promise.resolve();

  setPlaybackPending(true);
  // Native playback is started synchronously inside the original tap. Web
  // Audio analysis is optional and can never block or cancel audible playback.
  const playbackAttempt = elements.audio.play();
  void ensureAudioGraph().catch((error) => {
    console.warn("Night Transmission playback started without audio analysis.", error);
  });

  state.playbackPromise = playbackAttempt
    .catch((error) => {
      reportPlaybackError(error);
      throw error;
    })
    .finally(() => {
      state.playbackPromise = null;
      setPlaybackPending(false);
    });
  return state.playbackPromise;
}

function togglePlayback() {
  if (state.playbackPromise) return;
  if (elements.audio.paused) void startPlayback().catch(() => {});
  else elements.audio.pause();
}

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, dpr };
}

function cssColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function drawWaveform() {
  const canvas = elements.waveformCanvas;
  const { width, height, dpr } = fitCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const accent = cssColor("--track-accent", "#53bde6");
  const highlight = cssColor("--track-highlight", "#e0f8ff");
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(169,243,255,.12)";
  ctx.lineWidth = dpr;
  for (let row = 1; row < 4; row += 1) {
    const y = (height / 4) * row;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.beginPath();
  const data = state.waveformData;
  if (state.analyser && data) state.analyser.getByteTimeDomainData(data);
  const points = data || new Uint8Array(96).fill(128);
  for (let i = 0; i < points.length; i += 1) {
    const x = (i / (points.length - 1)) * width;
    const normalized = (points[i] - 128) / 128;
    const y = height / 2 + normalized * height * .38;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = highlight;
  ctx.lineWidth = Math.max(1.2 * dpr, 1);
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10 * dpr;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawFrequency() {
  const canvas = elements.frequencyCanvas;
  const { width, height, dpr } = fitCanvas(canvas);
  const ctx = canvas.getContext("2d");
  const accent = cssColor("--track-accent", "#53bde6");
  const highlight = cssColor("--track-highlight", "#e0f8ff");
  ctx.clearRect(0, 0, width, height);
  if (state.analyser && state.frequencyData) state.analyser.getByteFrequencyData(state.frequencyData);
  const data = state.frequencyData || new Uint8Array(128);
  const bars = 52;
  const gap = 3 * dpr;
  const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
  for (let i = 0; i < bars; i += 1) {
    const sourceIndex = Math.floor((i / bars) ** 1.7 * Math.min(data.length - 1, 180));
    const value = data[sourceIndex] / 255;
    const barHeight = Math.max(2 * dpr, value * height * .82);
    const x = i * (barWidth + gap);
    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, i > bars * .72 ? "#ffc51b" : highlight);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, height - barHeight, barWidth, barHeight);
  }
}

function updateSignal() {
  let target = 0;
  if (state.analyser && state.waveformData) {
    let energy = 0;
    for (const value of state.waveformData) {
      const normalized = (value - 128) / 128;
      energy += normalized * normalized;
    }
    target = Math.min(1, Math.sqrt(energy / state.waveformData.length) * 3.6);
  }
  const speed = target > state.signalLevel ? .24 : .08;
  state.signalLevel += (target - state.signalLevel) * speed;
  const percentage = Math.round(state.signalLevel * 100);
  document.documentElement.style.setProperty("--signal-level", state.signalLevel.toFixed(3));
  elements.signalValue.textContent = `${String(percentage).padStart(2, "0")}%`;
  elements.signalState.textContent = percentage > 62 ? "PEAK" : percentage > 18 ? "ACTIVE" : elements.audio.paused ? "QUIET" : "LOW SIGNAL";
  if (!state.reducedMotion && !elements.audio.paused) {
    document.documentElement.style.setProperty("--disc-turn", `${(elements.audio.currentTime * .6) % 360}deg`);
  }
}

function render() {
  drawWaveform();
  drawFrequency();
  updateSignal();
  state.raf = requestAnimationFrame(render);
}

function updateTimeline() {
  const duration = Number.isFinite(elements.audio.duration)
    ? elements.audio.duration
    : state.catalog.tracks[state.currentIndex].durationMs / 1000;
  const progress = duration > 0 ? elements.audio.currentTime / duration : 0;
  elements.seek.value = String(Math.round(progress * 1000));
  elements.seek.style.setProperty("--seek-fill", `${progress * 100}%`);
  elements.elapsed.textContent = formatTime(elements.audio.currentTime);
  elements.duration.textContent = formatTime(duration, true);
}

function buildTrackPicker() {
  const options = state.catalog.tracks.map((track, index) => {
    const option = document.createElement("option");
    option.value = track.id;
    option.textContent = `${String(index + 1).padStart(2, "0")} — ${track.artist} / ${track.title}`;
    return option;
  });
  elements.trackSelect.replaceChildren(...options);
}

function bindEvents() {
  elements.playButton.addEventListener("click", togglePlayback);
  elements.previousButton.addEventListener("click", () => applyTrack(state.currentIndex - 1, { autoplay: !elements.audio.paused }));
  elements.nextButton.addEventListener("click", () => applyTrack(state.currentIndex + 1, { autoplay: !elements.audio.paused }));
  elements.trackSelect.addEventListener("change", () => {
    const index = state.catalog.tracks.findIndex((track) => track.id === elements.trackSelect.value);
    if (index >= 0) applyTrack(index, { autoplay: !elements.audio.paused });
  });
  elements.seek.addEventListener("input", () => {
    if (!Number.isFinite(elements.audio.duration)) return;
    elements.audio.currentTime = (Number(elements.seek.value) / 1000) * elements.audio.duration;
    updateTimeline();
  });
  elements.volume.addEventListener("input", () => {
    elements.audio.volume = Number(elements.volume.value);
    elements.volumeValue.value = String(Math.round(elements.audio.volume * 100));
    elements.volumeValue.textContent = elements.volumeValue.value;
  });
  elements.audio.addEventListener("play", () => {
    document.body.dataset.playing = "true";
    elements.playButton.setAttribute("aria-label", "Pause current track");
    elements.waveformState.textContent = "LIVE >>>";
    setStatus("Signal acquired");
  });
  elements.audio.addEventListener("pause", () => {
    document.body.dataset.playing = "false";
    const track = state.catalog.tracks[state.currentIndex];
    elements.playButton.setAttribute("aria-label", `Play ${track.title}`);
    elements.waveformState.textContent = "STANDBY >>>";
    if (elements.audio.currentTime > 0 && elements.audio.currentTime < elements.audio.duration) setStatus("Transmission paused");
  });
  elements.audio.addEventListener("playing", () => setStatus("Signal acquired"));
  elements.audio.addEventListener("waiting", () => setStatus("Buffering transmission"));
  elements.audio.addEventListener("canplay", () => {
    if (elements.audio.paused) setStatus("Ready to play");
  });
  elements.audio.addEventListener("loadedmetadata", updateTimeline);
  elements.audio.addEventListener("timeupdate", updateTimeline);
  elements.audio.addEventListener("ended", () => applyTrack(state.currentIndex + 1, { autoplay: true }));
  elements.audio.addEventListener("error", () => setStatus("Audio source unavailable"));
  window.addEventListener("resize", () => {
    fitCanvas(elements.waveformCanvas);
    fitCanvas(elements.frequencyCanvas);
  });
}

function bindMediaSession() {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.setActionHandler("play", () => startPlayback().catch(() => {}));
  navigator.mediaSession.setActionHandler("pause", () => elements.audio.pause());
  navigator.mediaSession.setActionHandler("previoustrack", () => applyTrack(state.currentIndex - 1, { autoplay: true }));
  navigator.mediaSession.setActionHandler("nexttrack", () => applyTrack(state.currentIndex + 1, { autoplay: true }));
}

async function initialize() {
  try {
    const response = await fetch("../data/library.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    state.catalog = await response.json();
    if (state.catalog.mediaProviders?.["private-library"]) {
      state.catalog.mediaProviders["private-library"].baseUrl = "..";
    }
    state.releases = new Map(state.catalog.releases.map((release) => [release.id, release]));
    buildTrackPicker();
    bindEvents();
    bindMediaSession();
    elements.audio.volume = Number(elements.volume.value);

    const requested = new URL(window.location.href).searchParams.get("track");
    let remembered = null;
    try {
      remembered = localStorage.getItem("rg-player-current-track");
    } catch {
      // The first catalog entry is the stable fallback.
    }
    const trackId = requested || remembered;
    const requestedIndex = state.catalog.tracks.findIndex((track) => track.id === trackId);
    applyTrack(requestedIndex >= 0 ? requestedIndex : 0, { updateUrl: Boolean(requested) });
    document.documentElement.dataset.ready = "true";
    render();
  } catch (error) {
    setStatus(error?.message || "Visual room unavailable");
    document.documentElement.dataset.ready = "true";
  }
}

initialize();
