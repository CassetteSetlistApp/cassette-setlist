// cassette.setlist.subtitle.js

const FONT_MAP = {
  "Serif Proportional": "Times New Roman",
  "Serif Monospace": "Courier New",
  "Sans Proportional": "Segoe UI",
  "Sans Monospace": "Consolas",
  "Classical Serif": "Georgia",
  "Handwriting": "Comic Sans MS",
  "Modern Sans": "Arial",
  "Clean Sans": "Verdana",
  "UI Sans": "Tahoma",
  "Soft Sans": "Calibri",
  "Book Serif": "Cambria",
  "Trebuchet": "Trebuchet MS",
  "Roboto": "Roboto"
};

let subtitleTracks = [];
let subtitleFiles = [];
let subtitleSettings = null;

const overlay = document.getElementById("cassetteSubtitleOverlay");
const subtitleList = document.getElementById("cassetteSubtitleList");
const subtitleSettingsContainer = document.getElementById("cassetteSubtitleSettingsContainer");

let lastSubtitleTime = -1;

/* ------------------------------------------------------------
   LOAD SETTINGS
------------------------------------------------------------ */
async function loadSubtitleSettingsInternal() {
  try {
    const saved = localStorage.getItem("Caption.json");
    if (saved) {
      subtitleSettings = JSON.parse(saved);
      return;
    }

    const res = await fetch("Caption/Caption.json");
    if (!res.ok) return;
    subtitleSettings = await res.json();
  } catch {
    subtitleSettings = null;
  }
}

function applySubtitleSettingsToTrack(track) {
  if (!subtitleSettings) return;

  const key = `subtitle${track.layer}`;
  const cfg = subtitleSettings[key];
  if (!cfg) return;

  track.color = cfg.color;
  track.size = clampFontSize(cfg.size);
  track.bgColor = cfg.bgColor;
  track.bgOpacity = cfg.bgOpacity;
  track.fontFamily = cfg.fontFamily;
  track.visible = cfg.visible;
}

/* ------------------------------------------------------------
   PARSE VTT
------------------------------------------------------------ */
async function parseVTT(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const text = await res.text();

    const pattern =
      /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\s([\s\S]*?)(?=\n\n|\r\n\r\n|$)/g;

    let cues = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      cues.push({
        start: toSeconds(match[1]),
        end: toSeconds(match[2]),
        text: match[3].trim()
      });
    }

    return cues;
  } catch {
    return [];
  }
}

function toSeconds(ts) {
  const [h, m, s] = ts.split(":");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

/* ------------------------------------------------------------
   LAYER DETECTION
------------------------------------------------------------ */
function getLayerFromFilename(name) {
  const match = name.match(/(\d+)\.vtt$/i);
  if (match) return parseInt(match[1], 10);

  let max = 0;
  subtitleTracks.forEach(t => {
    if (t.layer > max) max = t.layer;
  });
  return max + 1;
}

/* ------------------------------------------------------------
   SHOW SUBTITLE BUTTONS + NESTED PANELS
------------------------------------------------------------ */
function showVTTButtons() {
  subtitleList.innerHTML = "";
  subtitleSettingsContainer.innerHTML = "";

  subtitleFiles.sort((a, b) => {
    return getLayerFromFilename(a.name) - getLayerFromFilename(b.name);
  });

  subtitleFiles.forEach(file => {
    const clean = file.name.replace(/\.vtt$/i, "");
    const layer = getLayerFromFilename(file.name);

    const wrapper = document.createElement("div");
    wrapper.className = "subtitle-wrapper";

    const btn = document.createElement("button");
    btn.textContent = clean;
    btn.className = "subtitle-btn";

    const panel = document.createElement("div");
    panel.id = `subtitleSettingsLayer${layer}`;
    panel.className = "subtitle-settings";
    panel.style.display = "none";

    btn.onclick = async () => {
      overlay.style.display = "flex";

      let track = subtitleTracks.find(t => t.layer === layer);

      if (!track) {
        const cues = await parseVTT(file.url);

        track = {
          layer,
          file: clean,
          cues,
          color: "#ffffff",
          size: 32,
          visible: true,
          bgColor: "#000000",
          bgOpacity: 0.5,
          fontFamily: "Sans Proportional"
        };

        subtitleTracks.push(track);
        applySubtitleSettingsToTrack(track);

        createSettingsPanel(track, panel);
        panel.style.display = "block";
      } else {
        track.visible = !track.visible;
        panel.style.display = track.visible ? "block" : "none";
      }

      // ⭐ Activate this track for captions
      CassetteSubtitle.currentSubtitleTrack = track;
      updateSettingsPanelsVisibility();
      lastSubtitleTime = -1;
    };

    wrapper.appendChild(btn);
    wrapper.appendChild(panel);
    subtitleSettingsContainer.appendChild(wrapper);
  });

  const dlWrap = document.createElement("div");
  dlWrap.className = "subtitle-settings-actions";

  const dlBtn = document.createElement("button");
  dlBtn.id = "subtitleDownloadBtn";
  dlBtn.className = "settings-btn";
  dlBtn.textContent = "Download settings";

  dlWrap.appendChild(dlBtn);
  subtitleSettingsContainer.appendChild(dlWrap);

  dlBtn.onclick = downloadSubtitleSettings;
}

/* ------------------------------------------------------------
   CREATE SETTINGS PANEL (NO TITLES)
------------------------------------------------------------ */
function createSettingsPanel(track, panel) {
  panel.innerHTML = "";

  const fontSelect = document.createElement("select");
  populateFontSelect(fontSelect);
  fontSelect.value = track.fontFamily;

  const sizeSlider = document.createElement("input");
  sizeSlider.type = "range";
  sizeSlider.min = "14";
  sizeSlider.max = "72";
  sizeSlider.value = track.size;

  const colorPicker = document.createElement("input");
  colorPicker.type = "color";
  colorPicker.value = track.color;

  const bgPicker = document.createElement("input");
  bgPicker.type = "color";
  bgPicker.value = track.bgColor;

  const bgOpacitySlider = document.createElement("input");
  bgOpacitySlider.type = "range";
  bgOpacitySlider.min = "0";
  bgOpacitySlider.max = "1";
  bgOpacitySlider.step = "0.05";
  bgOpacitySlider.value = track.bgOpacity;

  fontSelect.onchange = () => track.fontFamily = fontSelect.value;
  sizeSlider.oninput = () => track.size = clampFontSize(parseInt(sizeSlider.value, 10));
  colorPicker.oninput = () => track.color = colorPicker.value;
  bgPicker.oninput = () => track.bgColor = bgPicker.value;
  bgOpacitySlider.oninput = () => track.bgOpacity = parseFloat(bgOpacitySlider.value);

  panel.appendChild(fontSelect);
  panel.appendChild(sizeSlider);
  panel.appendChild(colorPicker);
  panel.appendChild(bgPicker);
  panel.appendChild(bgOpacitySlider);
}

/* ------------------------------------------------------------
   SHOW/HIDE PANELS
------------------------------------------------------------ */
function updateSettingsPanelsVisibility() {
  subtitleTracks.forEach(track => {
    const panel = document.getElementById(`subtitleSettingsLayer${track.layer}`);
    if (!panel) return;
    panel.style.display = track.visible ? "block" : "none";
  });
}

/* ------------------------------------------------------------
   FONT SELECT
------------------------------------------------------------ */
function populateFontSelect(select) {
  if (!select) return;
  if (select.options.length) return;
  Object.keys(FONT_MAP).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });
}

function clampFontSize(size) {
  return Math.min(72, Math.max(14, size));
}

/* ------------------------------------------------------------
   GET CUE TEXT
------------------------------------------------------------ */
function getCueText(cues, time) {
  if (!cues || !cues.length) return "";

  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (time >= c.start && time <= c.end) {
      return c.text;
    }
  }

  return "";
}

/* ------------------------------------------------------------
   CAPTION ELEMENT PER LAYER (OVERLAY)
------------------------------------------------------------ */
function getOrCreateCaptionElementForLayer(layer) {
  const id = `cassetteSubtitleLayer${layer}`;
  let el = document.getElementById(id);
  if (el) return el;

  el = document.createElement("div");
  el.id = id;
  el.className = "cassetteSubtitleCaption";

  const captionOverlay = document.getElementById("cassetteCaptionOverlay");
  captionOverlay.appendChild(el);

  return el;
}

/* ------------------------------------------------------------
   UPDATE SUBTITLE ELEMENT
------------------------------------------------------------ */
function updateSubtitleElement(track) {
  const element = getOrCreateCaptionElementForLayer(track.layer);
  const text = getCueText(track.cues, lastSubtitleTime);

  if (track.visible && text.trim() !== "") {
    element.innerHTML = `<span class="subtitle-bg">${text}</span>`;
    element.style.display = "block";
  } else {
    element.innerHTML = "";
    element.style.display = "none";
  }

  element.style.fontSize = track.size + "px";
  element.style.color = track.color;
  element.style.fontFamily = FONT_MAP[track.fontFamily] || track.fontFamily;

  const bgSpan = element.querySelector(".subtitle-bg");
  if (bgSpan) {
    const rgb = hexToRgb(track.bgColor);
    bgSpan.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${track.bgOpacity})`;
  }
}

/* ------------------------------------------------------------
   UPDATE SUBTITLE TIME
------------------------------------------------------------ */
function updateSubtitleTime(t) {
  if (!subtitleTracks.length) return;

  if (Math.abs(t - lastSubtitleTime) < 0.05) return;
  lastSubtitleTime = t;

  subtitleTracks.forEach(track => {
    updateSubtitleElement(track);
  });
}

/* ------------------------------------------------------------
   HEX TO RGB
------------------------------------------------------------ */
function hexToRgb(hex) {
  const bigint = parseInt(hex.replace("#", ""), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

/* ------------------------------------------------------------
   DOWNLOAD SETTINGS
------------------------------------------------------------ */
function downloadSubtitleSettings() {
  console.log("subtitleTracks at download:", subtitleTracks);

  const data = {};

  subtitleTracks.forEach(track => {
    data[`subtitle${track.layer}`] = {
      color: track.color,
      size: track.size,
      bgColor: track.bgColor,
      bgOpacity: track.bgOpacity,
      fontFamily: track.fontFamily,
      visible: track.visible
    };
  });

  console.log("Caption data:", data);

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "Caption.json";
  a.click();

  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------
   PUBLIC API (FIRST BLOCK)
------------------------------------------------------------ */
window.CassetteSubtitle = {
  initSubtitleDOM: function () {
    subtitleTracks = [];
    subtitleFiles = [];
    lastSubtitleTime = -1;

    subtitleList.innerHTML = "";
    subtitleSettingsContainer.innerHTML = "";

    const captionOverlay = document.getElementById("cassetteCaptionOverlay");
    captionOverlay.innerHTML = "";
  },

  loadSubtitleSettings: async function () {
    await loadSubtitleSettingsInternal();
  },

  updateSubtitleTime,

  async loadSubtitles(track) {
    if (this.currentSubtitleTrack !== track) {
      this.initSubtitleDOM();
      this.currentSubtitleTrack = track;
    }

    discoverSubtitleFiles(track);

    if (subtitleFiles.length) {
      showVTTButtons();
      return;
    }

    subtitleList.innerHTML = "<div>No subtitles found.</div>";
  }
};

/* ------------------------------------------------------------
   TIMEUPDATE HOOK
------------------------------------------------------------ */
if (typeof videoElement !== "undefined" && videoElement) {
  videoElement.addEventListener("timeupdate", () => {
    CassetteSubtitle.updateSubtitleTime(videoElement.currentTime);
  });
}

/* ------------------------------------------------------------
   SUBTITLE SYSTEM — USES window.currentSetlistPath ONLY
------------------------------------------------------------ */

/* ------------------------------------------------------------
   VTT DISCOVERY — READS track.subtitleVTTs
------------------------------------------------------------ */
function discoverVTTFiles() {
  let vtts = [];

  window.trackList.forEach(t => {
    if (t.subtitleVTTs && t.subtitleVTTs.length > 0) {
      t.subtitleVTTs.forEach(v => vtts.push(v));
    }
  });

  vtts = vtts.filter(
    (file, index, self) => index === self.findIndex(f => f.url === file.url)
  );

  vtts.sort((a, b) => {
    const numA = parseInt(a.name.match(/-(\d+)\.vtt$/)?.[1] || "0", 10);
    const numB = parseInt(b.name.match(/-(\d+)\.vtt$/)?.[1] || "0", 10);
    return numA - numB;
  });

  console.log("[discoverVTTFiles] collected:", vtts);
  return vtts;
}

/* ------------------------------------------------------------
   SRT DISCOVERY — READS track.subtitleSRTs
------------------------------------------------------------ */
function discoverSRTFiles() {
  let srts = [];

  window.trackList.forEach(t => {
    if (t.subtitleSRTs && t.subtitleSRTs.length > 0) {
      t.subtitleSRTs.forEach(s => srts.push(s));
    }
  });

  srts = srts.filter(
    (file, index, self) => index === self.findIndex(f => f.url === file.url)
  );

  srts.sort((a, b) => {
    const numA = parseInt(a.name.match(/-(\d+)\.srt$/)?.[1] || "0", 10);
    const numB = parseInt(b.name.match(/-(\d+)\.srt$/)?.[1] || "0", 10);
    return numA - numB;
  });

  console.log("[discoverSRTFiles] collected:", srts);
  return srts;
}

/* ------------------------------------------------------------
   SRT → VTT CONVERSION PANEL
------------------------------------------------------------ */
function showSRTButtons() {
  overlay.style.display = "flex";

  subtitleList.innerHTML = "";
  subtitleSettingsContainer.innerHTML = "";

  const info = document.createElement("div");
  info.textContent = "Subtitle tracks (SRT → VTT download):";
  info.style.marginBottom = "10px";
  subtitleList.appendChild(info);

  subtitleFiles.forEach(file => {
    const clean = file.name.replace(/\.(srt|vtt)$/i, "");

    const btn = document.createElement("button");
    btn.textContent = clean + " (convert → vtt)";
    btn.className = "subtitle-btn";

    btn.onclick = async () => {
      try {
        const res = await fetch(file.url);
        if (!res.ok) throw new Error("Failed to fetch SRT");
        const srtText = await res.text();

        const vttText = convertSrtToVtt(srtText);

        const blob = new Blob([vttText], { type: "text/vtt" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = clean + ".vtt";
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Failed to convert SRT:", err);
        alert("Error converting SRT to VTT.");
      }
    };

    subtitleList.appendChild(btn);
  });
}

function convertSrtToVtt(srtContent) {
  let vtt = "WEBVTT\n\n";
  vtt += srtContent
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .replace(/^\d+\s*\n/gm, "");
  return vtt.trim() + "\n";
}

/* ------------------------------------------------------------
   VTT BUTTON PANEL (SIMPLE PANEL FOR DISCOVERY MODE)
------------------------------------------------------------ */
function showVTTButtonsSimple() {
  overlay.style.display = "flex";

  subtitleList.innerHTML = "";
  subtitleSettingsContainer.innerHTML = "";

  const info = document.createElement("div");
  info.textContent = "Available VTT subtitle tracks:";
  info.style.marginBottom = "10px";
  subtitleList.appendChild(info);

  subtitleFiles.forEach(file => {
    const clean = file.name.replace(/\.vtt$/i, "");

    const btn = document.createElement("button");
    btn.textContent = clean;
    btn.className = "subtitle-btn";

    btn.onclick = async () => {
      const cues = await parseVTT(file.url);

      const layer = getLayerFromFilename(file.name);
      let track = subtitleTracks.find(t => t.layer === layer);

      if (!track) {
        track = {
          layer,
          file: clean,
          cues,
          color: "#ffffff",
          size: 32,
          visible: true,
          bgColor: "#000000",
          bgOpacity: 0.5,
          fontFamily: "Sans Proportional"
        };
        subtitleTracks.push(track);
        applySubtitleSettingsToTrack(track);
      }

      CassetteSubtitle.currentSubtitleTrack = track;
      updateSettingsPanelsVisibility();
      lastSubtitleTime = -1;
    };

    subtitleList.appendChild(btn);
  });
}

/* ------------------------------------------------------------
   MAIN SUBTITLE CONTROLLER (DISCOVERY MODE)
------------------------------------------------------------ */
window.CassetteSubtitle = {
  currentSubtitleTrack: null,

  initSubtitleDOM: function () {
    subtitleTracks = [];
    subtitleFiles = [];
    lastSubtitleTime = -1;

    subtitleList.innerHTML = "";
    subtitleSettingsContainer.innerHTML = "";

    const captionOverlay = document.getElementById("cassetteCaptionOverlay");
    captionOverlay.innerHTML = "";
  },

  loadSubtitleSettings: async function () {
    await loadSubtitleSettingsInternal();
  },

  updateSubtitleTime,

  async loadSubtitles(track) {
    if (this.currentSubtitleTrack !== track) {
      this.initSubtitleDOM();
      this.currentSubtitleTrack = track;
    }

    const vtts = discoverVTTFiles();
    if (vtts.length > 0) {
      subtitleFiles = vtts;
      showVTTButtons();
      return;
    }

    const srts = discoverSRTFiles();
    if (srts.length > 0) {
      subtitleFiles = srts;
      showSRTButtons();
      return;
    }

    subtitleList.innerHTML = "<div>No subtitles found.</div>";
  }
};
