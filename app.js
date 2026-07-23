// app.js

let audioCtx;
let audioElement;
const videoElement = document.getElementById("videoElement");
const videoContainer = document.getElementById("videoContainer");
let trackList = [];
window.trackList = trackList;
let currentTrackIndex = -1;
let cassetteDsp;
let cassetteEnabled = false;
let wowFlutterAmount = 0.25;
let wowFlutterInterval = null;

let audioSource = null;
let videoSource = null;

const cassetteUI = new CassetteUI();

// DOM references
const dropZone = document.getElementById("dropZone");
const trackListEl = document.getElementById("trackList");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const timeLabel = document.getElementById("timeLabel");

const cassetteDspToggle = document.getElementById("cassetteDspToggle");
const settingsToggle = document.getElementById("settingsToggle");
const settingsOverlay = document.getElementById("settingsOverlay");
const settingsCloseX = document.getElementById("settingsCloseX");

const hissSlider = document.getElementById("hissSlider");
const saturationSlider = document.getElementById("saturationSlider");
const wowFlutterSlider = document.getElementById("wowFlutterSlider");
const softBassSlider = document.getElementById("softBassSlider");
const toneSlider = document.getElementById("toneSlider");

const settings2DSPCheckbox = document.getElementById("settings2DSP");
const settings3DSPCheckbox = document.getElementById("settings3DSP");

const settings2HighBassSlider = document.getElementById("settings2HighBassSlider");
const settings2PresenceSlider = document.getElementById("settings2PresenceSlider");

const settings3LowBassSlider = document.getElementById("settings3LowBassSlider");
const settings3PunchSlider = document.getElementById("settings3PunchSlider");
const settings3BodyBoostSlider = document.getElementById("settings3BodyBoostSlider");

const folderInput = document.getElementById("folderInput");

const settingsDownloadBottom = document.getElementById("settingsDownloadBottom");
const settingsLoadOpen = document.getElementById("settingsLoadOpen");

const settingsLoadOverlay = document.getElementById("settingsLoadOverlay");
const settingsLoadCloseX = document.getElementById("settingsLoadCloseX");
const settingsDSPList = document.getElementById("settingsDSPList");
const loadSettingsBtn = document.getElementById("loadSettingsBtn");

let dspDSPs = [];
let defaultDspLoaded = false;

// Prevent browser opening files in new tab on drag/drop
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// ------------------------------------------------------------
// INIT AUDIO + DSP + UI
// ------------------------------------------------------------
function initAudio() {

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (!audioElement) {
    audioElement = new Audio();
    audioElement.crossOrigin = "anonymous";
  }

  if (videoElement) {
    videoElement.crossOrigin = "anonymous";
  }

  if (!audioSource) {
    audioSource = audioCtx.createMediaElementSource(audioElement);
  }

  if (!videoSource && videoElement) {
    videoSource = audioCtx.createMediaElementSource(videoElement);
  }

  if (!cassetteDsp) {
    cassetteDsp = new CassetteDSP(audioCtx);
  }

  try { cassetteDsp.output.disconnect(); } catch (e) {}
  cassetteDsp.output.connect(audioCtx.destination);

  cassetteUI.setControlHandlers({
    onPlayPause: togglePlayPause,
    onPrevHoldStart: () => startSeekHold("prev"),
    onPrevHoldEnd: stopSeekHold,
    onNextHoldStart: () => startSeekHold("next"),
    onNextHoldEnd: stopSeekHold,
  });

  audioElement.addEventListener("timeupdate", onTimeUpdate);
  audioElement.addEventListener("ended", onTrackEnded);

  if (videoElement) {
    videoElement.addEventListener("timeupdate", onTimeUpdate);
    videoElement.addEventListener("ended", onTrackEnded);
  }

  // Subtitle DOM + settings
  if (window.CassetteSubtitle && videoContainer) {
    CassetteSubtitle.initSubtitleDOM(videoContainer);
    CassetteSubtitle.loadSubtitleSettings();
    // Caption defaults can also be preloaded here if you want:
    // CassetteSubtitle.loadCaptionDefaults("Caption/Caption.json");
  }

  loadDefaultDspSettings();

  console.log("Audio + DSP initialized.");
}

// ------------------------------------------------------------
// SUBTITLE MODAL CONTROL
// ------------------------------------------------------------
function openSubtitleOverlay() {
  const overlay = document.getElementById("cassetteSubtitleOverlay");
  overlay.style.display = "flex"; // modal mode
}

function closeSubtitleOverlay() {
  const overlay = document.getElementById("cassetteSubtitleOverlay");
  overlay.style.display = "none";
}

document.getElementById("subtitleOverlayClose").onclick = closeSubtitleOverlay;


// ------------------------------------------------------------
// DEFAULT DSP LOAD
// ------------------------------------------------------------
async function loadDefaultDspSettings() {
  if (defaultDspLoaded || !cassetteDsp) return;

  try {
    const res = await fetch("Cassette DSP/cassette.dsp.json");
    if (!res.ok) return;

    const DSP = await res.json();

    const base = DSP.baseParams || cassetteDsp.baseParams;
    const settings2 = DSP.settings2Params || cassetteDsp.settings2Params;
    const settings3 = DSP.settings3Params || cassetteDsp.settings3Params;

    cassetteDsp.baseParams = base;
    cassetteDsp.settings2Params = settings2;
    cassetteDsp.settings3Params = settings3;

    cassetteDsp.settings2Enabled = DSP.settings2Enabled;
    cassetteDsp.settings3Enabled = DSP.settings3Enabled;

    settings2DSPCheckbox.checked = DSP.settings2Enabled;
    settings3DSPCheckbox.checked = DSP.settings3Enabled;

    hissSlider.value = base.hiss;
    saturationSlider.value = base.saturation;
    wowFlutterSlider.value = base.wowFlutter;
    softBassSlider.value = base.softBass;
    toneSlider.value = base.tone;

    settings2HighBassSlider.value = settings2.highBass;
    settings2PresenceSlider.value = settings2.presence;

    settings3LowBassSlider.value = settings3.lowBass;
    settings3PunchSlider.value = settings3.punch;
    settings3BodyBoostSlider.value = settings3.bodyBoost;

    cassetteDsp.updateBase(base);
    cassetteDsp.applysettings2DSP(settings2DSPCheckbox.checked);
    cassetteDsp.applysettings3DSP(settings3DSPCheckbox.checked);

    if (cassetteEnabled) startWowFlutter();

    defaultDspLoaded = true;

  } catch (e) {
    console.warn("Default DSP file not found or failed to load:", e);
  }
}

// ------------------------------------------------------------
// HELPERS FOR CURRENT TRACK / MEDIA
// ------------------------------------------------------------
function getActiveTrack() {
  if (currentTrackIndex < 0 || currentTrackIndex >= trackList.length) return null;
  return trackList[currentTrackIndex];
}

function getActiveMedia() {
  const track = getActiveTrack();
  if (!track) return audioElement;
  return track.isVideo && videoElement ? videoElement : audioElement;
}

// ------------------------------------------------------------
// TIME + PROGRESS
// ------------------------------------------------------------
function onTimeUpdate() {
  const media = getActiveMedia();
  if (!media) return;

  const currentTrackTime = media.currentTime;
  const totalTapeLength = getTotalDuration();
  const globalTapePosition =
    getElapsedBeforeCurrentTrack() + currentTrackTime;

  cassetteUI.setTotalTapeLength(totalTapeLength);
  cassetteUI.setGlobalTapePosition(globalTapePosition);

  updateProgressUI();

  const track = getActiveTrack();
  if (track && track.isVideo && window.CassetteSubtitle) {
    CassetteSubtitle.updateSubtitleTime(media.currentTime);
  }
}

function onTrackEnded() {
  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  if (currentTrackIndex < trackList.length - 1) {
    currentTrackIndex++;
    playCurrentTrack();

    const globalTapePosition = getElapsedBeforeCurrentTrack();
    cassetteUI.setGlobalTapePosition(globalTapePosition);

    if (window.updateLyricsOnTrackChange) {
      window.updateLyricsOnTrackChange();
    }

  } else {
    const media = getActiveMedia();
    if (media) {
      media.pause();
      media.currentTime = 0;
    }

    cassetteUI.setPlaying(false);

    if (playIcon && pauseIcon) {
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }

    if (window.CassetteSubtitle) {
      CassetteSubtitle.updateSubtitleTime(0);
      CassetteSubtitle.clearSubtitles && CassetteSubtitle.clearSubtitles();
    }
  }
}

function getTotalDuration() {
  return trackList.reduce((sum, t) => sum + (t.duration || 0), 0);
}

function getElapsedBeforeCurrentTrack() {
  let sum = 0;
  for (let i = 0; i < currentTrackIndex; i++) {
    sum += trackList[i].duration || 0;
  }
  return sum;
}

// ------------------------------------------------------------
// PROGRESS UI
// ------------------------------------------------------------
function updateProgressUI() {
  const total = getTotalDuration();
  const media = getActiveMedia();
  const globalTime = getElapsedBeforeCurrentTrack() + (media?.currentTime || 0);
  const progress = total > 0 ? globalTime / total : 0;

  progressFill.style.width = `${progress * 100}%`;

  const currentTrackDuration = trackList[currentTrackIndex]?.duration || 0;
  const currentTrackTime = media?.currentTime || 0;

  timeLabel.textContent =
    `${formatTime(currentTrackTime)} / ${formatTime(currentTrackDuration)}`;
}

function formatTime(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// FOLDER LOAD (SETLIST.TXT + MEDIA IN SAME FOLDER)
// ------------------------------------------------------------
dropZone.addEventListener("click", () => {
  folderInput.click();
});

folderInput.addEventListener("change", async (e) => {
  initAudio();
  const allFiles = Array.from(e.target.files);
  await loadFromSetlist(allFiles);
});

// Drag & drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

// ------------------------------------------------------------
// DROP ZONE IMPORT (SETLIST.TXT + MEDIA)
// ------------------------------------------------------------
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  initAudio();

  const allFiles = Array.from(e.dataTransfer.files);
  await loadFromSetlist(allFiles);
});

// ------------------------------------------------------------
// LOAD FROM SETLIST.TXT (MEDIA ONLY, SRT/VTT AS SUBTITLE METADATA)
// ------------------------------------------------------------
async function loadFromSetlist(allFiles) {
  trackList = [];
  currentTrackIndex = -1;

  cassetteUI.setTotalTapeLength(0);
  cassetteUI.setGlobalTapePosition(0);
  cassetteUI.setPlaying(false);

  progressFill.style.width = "0%";
  timeLabel.textContent = "00:00 / 00:00";

  let totalTapeLength = 0;

  const setlistFile = allFiles.find(f => f.name.toLowerCase() === "setlist.txt");
  if (!setlistFile) {
    console.warn("setlist.txt not found in dropped/selected folder.");
    return;
  }

  const setlistText = await fileToText(setlistFile);
  const lines = setlistText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

  const fileMap = {};
  allFiles.forEach(f => {
    fileMap[f.name] = f;
  });

  const vttMap = {};
  const srtMap = {};

  lines.forEach(line => {
    const name = line.trim();
    const extMatch = name.match(/\.(srt|vtt)$/i);
    if (!extMatch) return;

    const ext = extMatch[1].toLowerCase();
    const base = name.replace(/\.(srt|vtt)$/i, "");

    if (ext === "vtt") {
      if (!vttMap[base]) vttMap[base] = [];
      if (fileMap[name]) vttMap[base].push(fileMap[name]);
    } else {
      if (!srtMap[base]) srtMap[base] = [];
      if (fileMap[name]) srtMap[base].push(fileMap[name]);
    }
  });

  for (const line of lines) {
    const name = line.trim();
    const extMatch = name.match(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg|srt|vtt)$/i);
    if (!extMatch) continue;

    const ext = extMatch[1].toLowerCase();

    if (ext === "srt" || ext === "vtt") {
      continue;
    }

    if (!fileMap[name]) continue;

    const file = fileMap[name];
    const url = URL.createObjectURL(file);
    const duration = await getFileDuration(url);

    const cleanName = name.replace(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i, "");
    const isVideo = !!name.match(/\.(mp4|webm|ogg)$/i);

    let subtitleVTT = null;
    let subtitleSRTs = [];

    const vttEntry = vttMap[cleanName];
    if (vttEntry && vttEntry.length > 0) {
      subtitleVTT = URL.createObjectURL(vttEntry[0]);
    }

    const srtEntry = srtMap[cleanName];
    if (srtEntry && srtEntry.length > 0) {
      subtitleSRTs = srtEntry.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f)
      }));
    }

    trackList.push({
      name: cleanName,
      url,
      duration,
      isVideo,
      subtitleVTT,
      subtitleSRTs
    });

    totalTapeLength += duration;
  }

  cassetteUI.setTotalTapeLength(totalTapeLength);

  renderTrackList();

  // Hook track menus (Lyrics / Related / Subtitle / Fullscreen)
  if (window.attachTrackMenus) {
    window.attachTrackMenus();
  }

  // Load default caption settings for subtitles
  if (window.CassetteSubtitle) {
    CassetteSubtitle.loadCaptionDefaults &&
      CassetteSubtitle.loadCaptionDefaults("Caption/Caption.json");
  }

  if (trackList.length > 0) {
    currentTrackIndex = 0;
    playCurrentTrack();
  }
}

function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function getFileDuration(url) {
  return new Promise((resolve) => {
    let temp;
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
      temp = document.createElement("video");
    } else {
      temp = new Audio();
    }
    temp.src = url;
    temp.addEventListener("loadedmetadata", () => {
      resolve(temp.duration || 0);
    });
    temp.addEventListener("error", () => {
      resolve(0);
    });
  });
}

// ------------------------------------------------------------
// TRACK LIST (FINAL UPDATED VERSION)
// ------------------------------------------------------------
function renderTrackList() {

  // expose globally for cassette.setlist.ui.js
  window.trackList = trackList;

  // clear UI
  trackListEl.innerHTML = "";

  // sort by leading number
  trackList.sort((a, b) => {
    const numA = extractLeadingNumber(a.name);
    const numB = extractLeadingNumber(b.name);

    if (numA !== null && numB !== null) return numA - numB;
    if (numA !== null) return -1;
    if (numB !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  // render only MEDIA tracks (skip SRT/VTT)
  trackList.forEach((track, index) => {

    // skip non‑media entries (safety)
    if (!track.url.match(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i)) return;

    const li = document.createElement("li");
    li.dataset.index = index;

    // display name
    li.textContent = track.name;

    // highlight active track
    if (index === currentTrackIndex) {
      li.classList.add("active");
    }

    // click → play track
    li.onclick = () => {
      currentTrackIndex = index;
      playCurrentTrack();

      if (window.updateLyricsOnTrackChange) {
        window.updateLyricsOnTrackChange();
      }

      updateTrackActiveState();
    };

    trackListEl.appendChild(li);
  });

  // update tape length
  cassetteUI.setTotalTapeLength(getTotalDuration());

  // attach "..." menu dots (Lyrics / Related / Subtitle / Fullscreen)
  if (window.attachTrackMenus) {
    window.attachTrackMenus();
  }
}


function extractLeadingNumber(name) {
  const match = name.match(/^\s*(\d+)\s*[-.]?\s*/);
  return match ? parseInt(match[1], 10) : null;
}

function updateTrackActiveState() {
  Array.from(trackListEl.children).forEach((li, idx) => {
    li.classList.toggle("active", idx === currentTrackIndex);
  });
}

// ------------------------------------------------------------
// PLAYBACK
// ------------------------------------------------------------
function playCurrentTrack() {
  if (!audioElement || currentTrackIndex < 0 || currentTrackIndex >= trackList.length) return;

  const track = trackList[currentTrackIndex];
  const media = track.isVideo ? videoElement : audioElement;

  if (videoContainer) {
    if (track.isVideo) {
      videoContainer.style.display = "block";
      videoElement.style.display = "block";
      cassetteCaptionOverlay.style.display = "flex";
    } else {
      videoContainer.style.display = "none";
      videoElement.style.display = "none";
      cassetteCaptionOverlay.style.display = "none";
    }
  }

  try { audioSource.disconnect(); } catch (e) {}
  try { videoSource && videoSource.disconnect(); } catch (e) {}

  const sourceNode = track.isVideo ? videoSource : audioSource;

  if (cassetteEnabled) {
    sourceNode.connect(cassetteDsp.input);

    try { cassetteDsp.output.disconnect(); } catch (e) {}
    cassetteDsp.output.connect(audioCtx.destination);

  } else {
    sourceNode.connect(audioCtx.destination);
  }

  media.src = track.url;
  media.currentTime = 0;

  const elapsed = getElapsedBeforeCurrentTrack();
  cassetteUI.setGlobalTapePosition(elapsed);

  if (window.CassetteSubtitle) {
    if (track.isVideo) {
      CassetteSubtitle.applyCaptionDefaults && CassetteSubtitle.applyCaptionDefaults();
      CassetteSubtitle.updateSubtitleTime(0);
    } else {
      CassetteSubtitle.clearSubtitles && CassetteSubtitle.clearSubtitles();
    }
  }

  media.play();

  cassetteUI.setPlaying(true);
  cassetteUI.direction = "forward";

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  if (playIcon && pauseIcon) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }

  renderTrackList();
}


// ------------------------------------------------------------
// Play / pause toggle
// ------------------------------------------------------------
function togglePlayPause() {
  const media = getActiveMedia();
  if (!media) return;

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  if (media.paused) {
    media.play();
    cassetteUI.setPlaying(true);
    cassetteUI.direction = "forward";

    if (playIcon && pauseIcon) {
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    }
  } else {
    media.pause();
    cassetteUI.setPlaying(false);

    if (playIcon && pauseIcon) {
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  }
}

// ------------------------------------------------------------
// SEEK HOLD (Rewind / Fast‑Forward)
// ------------------------------------------------------------
let seekHoldDirection = null;
let seekHoldTimer = null;

function startSeekHold(direction) {
  const media = getActiveMedia();
  if (!media || trackList.length === 0) return;

  seekHoldDirection = direction;

  cassetteUI.direction = (direction === "prev") ? "rewind" : "fastforward";
  cassetteUI.setPlaying(true);

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  if (playIcon && pauseIcon) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }

  seekHoldTimer = setInterval(() => {
    const step = 4.0;
    let currentMedia = getActiveMedia();

    if (direction === "prev") {
      currentMedia.currentTime = Math.max(currentMedia.currentTime - step, 0);

      if (currentMedia.currentTime <= 0 && currentTrackIndex > 0) {
        currentTrackIndex--;

        const prevTrack = trackList[currentTrackIndex];
        currentMedia = prevTrack.isVideo && videoElement ? videoElement : audioElement;
        currentMedia.src = prevTrack.url;

        const prevDur = prevTrack.duration || 0;
        currentMedia.currentTime = Math.max(prevDur - 0.1, 0);

        if (window.CassetteSubtitle) {
          if (prevTrack.isVideo) {
            CassetteSubtitle.loadSubtitles(prevTrack);
            CassetteSubtitle.applyCaptionDefaults && CassetteSubtitle.applyCaptionDefaults();
            CassetteSubtitle.updateSubtitleTime(currentMedia.currentTime);
          } else {
            CassetteSubtitle.clearSubtitles && CassetteSubtitle.clearSubtitles();
          }
        }

        currentMedia.play();

        renderTrackList();
      }

    } else if (direction === "next") {
      const track = getActiveTrack();
      const maxDur = track?.duration || currentMedia.duration || 0;

      currentMedia.currentTime = Math.min(currentMedia.currentTime + step, maxDur);

      if (currentMedia.currentTime >= maxDur && currentTrackIndex < trackList.length - 1) {
        currentTrackIndex++;

        const nextTrack = trackList[currentTrackIndex];
        currentMedia = nextTrack.isVideo && videoElement ? videoElement : audioElement;
        currentMedia.src = nextTrack.url;

        currentMedia.currentTime = 0;

        if (window.CassetteSubtitle) {
          if (nextTrack.isVideo) {
            CassetteSubtitle.loadSubtitles(nextTrack);
            CassetteSubtitle.applyCaptionDefaults && CassetteSubtitle.applyCaptionDefaults();
            CassetteSubtitle.updateSubtitleTime(0);
          } else {
            CassetteSubtitle.clearSubtitles && CassetteSubtitle.clearSubtitles();
          }
        }

        currentMedia.play();

        renderTrackList();
      }
    }

    onTimeUpdate();

  }, 60);
}

// ------------------------------------------------------------
// STOP SEEK HOLD (Rewind / Fast‑Forward Release)
// ------------------------------------------------------------
function stopSeekHold() {
  if (seekHoldTimer) {
    clearInterval(seekHoldTimer);
    seekHoldTimer = null;
  }

  seekHoldDirection = null;

  const media = getActiveMedia();

  if (media && !media.paused) {
    cassetteUI.direction = "forward";
    cassetteUI.setPlaying(true);
  } else {
    cassetteUI.setPlaying(false);
  }

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");

  if (playIcon && pauseIcon) {
    if (media && !media.paused) {
      playIcon.style.display = "none";
      pauseIcon.style.display = "block";
    } else {
      playIcon.style.display = "block";
      pauseIcon.style.display = "none";
    }
  }

  renderTrackList();

  if (window.CassetteSubtitle && media) {
    CassetteSubtitle.updateSubtitleTime(media.currentTime);
  }
}

// ------------------------------------------------------------
// PROGRESS BAR CLICK (FINAL, NO RELOAD SUBTITLES)
// ------------------------------------------------------------
progressBar.addEventListener("click", (e) => {
  if (!audioElement || trackList.length === 0) return;

  const rect = progressBar.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const total = getTotalDuration();
  const targetGlobal = ratio * total;

  let accumulated = 0;
  let targetIndex = 0;
  for (let i = 0; i < trackList.length; i++) {
    const d = trackList[i].duration || 0;
    if (targetGlobal < accumulated + d) {
      targetIndex = i;
      break;
    }
    accumulated += d;
  }

  currentTrackIndex = targetIndex;
  const track = trackList[currentTrackIndex];
  const media = track.isVideo && videoElement ? videoElement : audioElement;

  media.src = track.url;
  media.currentTime = targetGlobal - accumulated;

  // ⭐ Only refresh subtitles, do NOT reload them here
  if (window.CassetteSubtitle && track.isVideo) {
    lastSubtitleTime = -1;
    CassetteSubtitle.updateSubtitleTime(media.currentTime);
  } else if (window.CassetteSubtitle && !track.isVideo) {
    CassetteSubtitle.clearSubtitles && CassetteSubtitle.clearSubtitles();
  }

  media.play();
  cassetteUI.direction = "forward";
  cassetteUI.setPlaying(true);
  updateTrackActiveState();

  const playIcon = document.getElementById("playIcon");
  const pauseIcon = document.getElementById("pauseIcon");
  if (playIcon && pauseIcon) {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }
});

// ------------------------------------------------------------
// DSP TOGGLE
// ------------------------------------------------------------
cassetteDspToggle.addEventListener("click", () => {

  if (!audioCtx) initAudio();

  cassetteEnabled = !cassetteEnabled;
  cassetteDspToggle.classList.toggle("on", cassetteEnabled);
  cassetteDspToggle.textContent = "Cassette DSP";

  cassetteDsp.setEnabled(cassetteEnabled);

  try { audioSource.disconnect(); } catch (e) {}
  try { videoSource && videoSource.disconnect(); } catch (e) {}

  const track = trackList[currentTrackIndex];
  const sourceNode = (track && track.isVideo) ? videoSource : audioSource;

  if (cassetteEnabled) {
    sourceNode.connect(cassetteDsp.input);
    cassetteDsp.output.connect(audioCtx.destination);
    startWowFlutter();
  } else {
    sourceNode.connect(audioCtx.destination);
    stopWowFlutter();
  }
});

// ------------------------------------------------------------
// WOW & FLUTTER
// ------------------------------------------------------------
function startWowFlutter() {
  stopWowFlutter();
  wowFlutterAmount = parseFloat(wowFlutterSlider.value) || 0.25;

  wowFlutterInterval = setInterval(() => {
    const media = getActiveMedia();
    if (!media) return;

    const t = Date.now() / 1000;

    const mod =
      Math.sin(t * 0.9) * wowFlutterAmount * 0.015 +
      Math.sin(t * 3.5) * wowFlutterAmount * 0.005;

    media.playbackRate = 1 + mod;
  }, 40);
}

function stopWowFlutter() {
  if (wowFlutterInterval) {
    clearInterval(wowFlutterInterval);
    wowFlutterInterval = null;
  }
  const media = getActiveMedia();
  if (media) media.playbackRate = 1.0;
}

// ------------------------------------------------------------
// SETTINGS OVERLAY
// ------------------------------------------------------------
settingsToggle.addEventListener("click", () => {
  settingsOverlay.classList.remove("hidden");
});

settingsCloseX.addEventListener("click", () => {
  settingsOverlay.classList.add("hidden");
});

// ------------------------------------------------------------
// BASE DSP SLIDERS
// ------------------------------------------------------------
[
  hissSlider,
  saturationSlider,
  softBassSlider,
  toneSlider
].forEach((slider) => {
  slider.addEventListener("input", () => {
    if (!cassetteDsp) return;
    cassetteDsp.updateBase({
      hiss: parseFloat(hissSlider.value),
      saturation: parseFloat(saturationSlider.value),
      softBass: parseFloat(softBassSlider.value),
      tone: parseFloat(toneSlider.value),
      wowFlutter: parseFloat(wowFlutterSlider.value),
    });
    if (cassetteEnabled) startWowFlutter();
  });
});

wowFlutterSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.updateBase({
    hiss: parseFloat(hissSlider.value),
    saturation: parseFloat(saturationSlider.value),
    softBass: parseFloat(softBassSlider.value),
    tone: parseFloat(toneSlider.value),
    wowFlutter: parseFloat(wowFlutterSlider.value),
  });
  if (cassetteEnabled) startWowFlutter();
});

// ------------------------------------------------------------
// settings2 DSP — checkbox + sliders
// ------------------------------------------------------------
settings2DSPCheckbox.addEventListener("change", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings2Params.highBass = parseFloat(settings2HighBassSlider.value);
  cassetteDsp.settings2Params.presence = parseFloat(settings2PresenceSlider.value);
  cassetteDsp.applysettings2DSP(settings2DSPCheckbox.checked);
});

settings2HighBassSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings2Params.highBass = parseFloat(settings2HighBassSlider.value);
  cassetteDsp.applysettings2DSP(settings2DSPCheckbox.checked);
});

settings2PresenceSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings2Params.presence = parseFloat(settings2PresenceSlider.value);
  cassetteDsp.applysettings2DSP(settings2DSPCheckbox.checked);
});

// ------------------------------------------------------------
// settings3 DSP — checkbox + sliders
// ------------------------------------------------------------
settings3DSPCheckbox.addEventListener("change", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings3Params.lowBass = parseFloat(settings3LowBassSlider.value);
  cassetteDsp.settings3Params.punch = parseFloat(settings3PunchSlider.value);
  cassetteDsp.settings3Params.bodyBoost = parseFloat(settings3BodyBoostSlider.value);
  cassetteDsp.applysettings3DSP(settings3DSPCheckbox.checked);
});

settings3LowBassSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings3Params.lowBass = parseFloat(settings3LowBassSlider.value);
  cassetteDsp.applysettings3DSP(settings3DSPCheckbox.checked);
});

settings3PunchSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings3Params.punch = parseFloat(settings3PunchSlider.value);
  cassetteDsp.applysettings3DSP(settings3DSPCheckbox.checked);
});

settings3BodyBoostSlider.addEventListener("input", () => {
  if (!cassetteDsp) return;
  cassetteDsp.settings3Params.bodyBoost = parseFloat(settings3BodyBoostSlider.value);
  cassetteDsp.applysettings3DSP(settings3DSPCheckbox.checked);
});

// ------------------------------------------------------------
// SETTINGS → DOWNLOAD JSON
// ------------------------------------------------------------
function getCurrentDspSettings() {
  if (!cassetteDsp) return null;

  return {
    baseParams: cassetteDsp.baseParams,
    settings2Params: cassetteDsp.settings2Params,
    settings3Params: cassetteDsp.settings3Params,

    settings2Enabled: cassetteDsp.settings2Enabled,
    settings3Enabled: cassetteDsp.settings3Enabled
  };
}

function downloadSettingsJson() {
  const settings = getCurrentDspSettings();
  if (!settings) return;

  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cassette.dsp.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

settingsDownloadBottom.addEventListener("click", downloadSettingsJson);

// ------------------------------------------------------------
// SETTINGS LOAD OVERLAY (DSP LIST)
// ------------------------------------------------------------
settingsLoadOpen.addEventListener("click", () => {
  settingsLoadOverlay.classList.remove("hidden");
  loadDSPList();
});

settingsLoadCloseX.addEventListener("click", () => {
  settingsLoadOverlay.classList.add("hidden");
});

async function loadDSPList() {
  try {
    const res = await fetch("Cassette DSP/cassette.dsp.settings.json");
    dspDSPs = await res.json();

    settingsDSPList.innerHTML = "";
    dspDSPs.forEach((entry, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = entry.name || `DSP ${idx + 1}`;
      settingsDSPList.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load cassette.dsp.settings.json", e);
  }
}

settingsDSPList.addEventListener("change", () => {
  const idx = parseInt(settingsDSPList.value, 10);
  const entry = dspDSPs[idx];
  if (!entry || !cassetteDsp) return;

  const DSP = entry.DSP || entry.data || entry;

  const base = DSP.baseParams || cassetteDsp.baseParams;
  const settings2 = DSP.settings2Params || cassetteDsp.settings2Params;
  const settings3 = DSP.settings3Params || cassetteDsp.settings3Params;

  const settings2Enabled = DSP.settings2Enabled ?? false;
  const settings3Enabled = DSP.settings3Enabled ?? false;

  cassetteDsp.baseParams = base;
  cassetteDsp.settings2Params = settings2;
  cassetteDsp.settings3Params = settings3;

  cassetteDsp.settings2Enabled = settings2Enabled;
  cassetteDsp.settings3Enabled = settings3Enabled;

  hissSlider.value = base.hiss;
  saturationSlider.value = base.saturation;
  wowFlutterSlider.value = base.wowFlutter;
  softBassSlider.value = base.softBass;
  toneSlider.value = base.tone;

  settings2HighBassSlider.value = settings2.highBass;
  settings2PresenceSlider.value = settings2.presence;

  settings3LowBassSlider.value = settings3.lowBass;
  settings3PunchSlider.value = settings3.punch;
  settings3BodyBoostSlider.value = settings3.bodyBoost;

  settings2DSPCheckbox.checked = settings2Enabled;
  settings3DSPCheckbox.checked = settings3Enabled;

  cassetteDsp.updateBase(base);
  cassetteDsp.applysettings2DSP(settings2Enabled);
  cassetteDsp.applysettings3DSP(settings3Enabled);

  if (cassetteEnabled) startWowFlutter();
});

// ------------------------------------------------------------
// INIT ON FIRST INTERACTION
// ------------------------------------------------------------
document.addEventListener("click", initAudio, { once: true });