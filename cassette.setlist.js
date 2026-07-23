// cassette.setlist.js

const SETLIST_JSON = "Setlist/Setlist.json";
const setlistBrowser = document.getElementById("setlistBrowser");

let bandsPerPage = 10;
let currentBandPage = 0;
let setlistData = null;

window.currentSetlistPath = "";

function getRandomFallbackCover() {
  const h1 = Math.floor(Math.random() * 360);
  const s1 = Math.floor(40 + Math.random() * 50);
  const l1 = Math.floor(40 + Math.random() * 30);

  const h2 = Math.floor(Math.random() * 360);
  const s2 = Math.floor(40 + Math.random() * 50);
  const l2 = Math.floor(40 + Math.random() * 30);

  const c1 = `hsl(${h1}, ${s1}%, ${l1}%)`;
  const c2 = `hsl(${h2}, ${s2}%, ${l2}%)`;

  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#g)" />
    </svg>
  `;

  return "data:image/svg+xml;base64," + btoa(svg);
}

// ------------------------------------------------------------
// INIT — INSTANT LOAD
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initSetlist);

async function initSetlist() {
  try {
    const res = await fetch(SETLIST_JSON);
    setlistData = await res.json();

    window.setlistData = setlistData;

    renderBandPageInstant(0);
  } catch (e) {
    console.error("Failed to load Setlist.json", e);
  }
}

// ------------------------------------------------------------
// CLEAR RIGHT PANEL
// ------------------------------------------------------------
function clearBrowser() {
  setlistBrowser.innerHTML = "";
}

// ------------------------------------------------------------
// CARD BUILDER — WITH RANDOM COVER FALLBACK
// ------------------------------------------------------------
function buildCardHTML(coverSrc, titleText) {
  let finalCover = coverSrc;

  if (!coverSrc || typeof coverSrc !== "string") {
    finalCover = getRandomFallbackCover();
  }

  return `
    <div class="setlist-card">
      <div class="cover-container">
        <img src="${finalCover}" alt="${titleText}"
             onerror="this.src='${getRandomFallbackCover()}'">
      </div>
      <div class="title-container">
        <div class="setlist-card-title">${titleText}</div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// RENDER BANDS — INSTANT
// ------------------------------------------------------------
function renderBandPageInstant(pageIndex) {
  currentBandPage = pageIndex;
  clearBrowser();

  const bands = setlistData.bands || [];
  const start = pageIndex * bandsPerPage;
  const end = start + bandsPerPage;
  const pageBands = bands.slice(start, end);

  let html = `<div class="setlist-grid">`;

  pageBands.forEach(band => {
    html += buildCardHTML(band.cover, band.name);
  });

  html += `</div>`;
  html += buildPaginationHTML(bands.length);

  setlistBrowser.innerHTML = html;

  const cards = setlistBrowser.querySelectorAll(".setlist-card");
  cards.forEach((card, i) => {
    const band = pageBands[i];

    card.onclick = () => {
      loadBandTracksInstant(band);

      if (band.albums && band.albums.length > 0) {
        renderAlbumsInstant(band);
      }
    };
  });

  attachPaginationHandlers(bands.length);
}

// ------------------------------------------------------------
// PAGINATION
// ------------------------------------------------------------
function buildPaginationHTML(totalBands) {
  const totalPages = Math.ceil(totalBands / bandsPerPage);

  const disablePrev = currentBandPage === 0 ? "disabled" : "";
  const disableNext = currentBandPage === totalPages - 1 ? "disabled" : "";

  return `
    <div class="setlist-pagination">
      <button class="setlist-prev" ${disablePrev}><</button>
      <span class="setlist-page-label">${currentBandPage + 1}</span>
      <button class="setlist-next" ${disableNext}>></button>
    </div>
  `;
}

function attachPaginationHandlers(totalBands) {
  const totalPages = Math.ceil(totalBands / bandsPerPage);

  const prevBtn = setlistBrowser.querySelector(".setlist-prev");
  const nextBtn = setlistBrowser.querySelector(".setlist-next");

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentBandPage > 0) renderBandPageInstant(currentBandPage - 1);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentBandPage < totalPages - 1) renderBandPageInstant(currentBandPage + 1);
    };
  }
}

// ------------------------------------------------------------
// RENDER ALBUMS — INSTANT
// ------------------------------------------------------------
function renderAlbumsInstant(band) {
  clearBrowser();

  let html = `
    <div class="setlist-band-title">${band.name}</div>
    <div class="setlist-grid">
  `;

  band.albums.forEach(album => {
    html += buildCardHTML(album.cover, album.title);
  });

  html += `</div>`;
  html += `<button class="setlist-back-btn"><</button>`;

  setlistBrowser.innerHTML = html;

  const cards = setlistBrowser.querySelectorAll(".setlist-card");
  cards.forEach((card, i) => {
    card.onclick = () => loadAlbumTracksInstant(band.albums[i], band.genre);
  });

  const backBtn = setlistBrowser.querySelector(".setlist-back-btn");
  backBtn.onclick = () => renderBandPageInstant(currentBandPage);
}

// ------------------------------------------------------------
// LOAD BAND TRACKS — FIXED FOR EMPTY COVER
// ------------------------------------------------------------
async function loadBandTracksInstant(band) {
  let bandPath = "";

  // ⭐ If cover exists → extract folder
  if (band.cover && band.cover.includes("/")) {
    const lastSlash = band.cover.lastIndexOf("/");
    bandPath = band.cover.substring(0, lastSlash + 1);
  }

  // ⭐ If cover is empty → fallback to band folder
  if (!bandPath) {
    bandPath = `Setlist/${band.name}/`;
  }

  await loadTracksFromSetlist(bandPath, band.genre);
}

// ------------------------------------------------------------
// LOAD ALBUM TRACKS
// ------------------------------------------------------------
async function loadAlbumTracksInstant(album, bandGenre) {
  await loadTracksFromSetlist(album.path, bandGenre);
}

// ------------------------------------------------------------
// UNIVERSAL TRACK LOADER — WITH MULTI‑SUBTITLE SUPPORT
// ------------------------------------------------------------
async function loadTracksFromSetlist(basePath, currentBandGenre) {

  // ⭐ FLAG THE PATH FOR SUBTITLE.JS
  window.currentSetlistPath = basePath;

  trackList.length = 0;
  currentTrackIndex = -1;
  trackListEl.innerHTML = "";

  cassetteUI.setTotalTapeLength(0);
  cassetteUI.setGlobalTapePosition(0);
  cassetteUI.setPlaying(false);

  progressFill.style.width = "0%";
  timeLabel.textContent = "00:00 / 00:00";

  try {
    const res = await fetch(basePath + "setlist.txt");
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");

    const mediaFiles = [];
    const subtitleFiles = [];
    const lyricFiles = [];

    for (const line of lines) {
      const name = line.trim();
      if (!name) continue;

      if (name.match(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i)) {
        mediaFiles.push(name);
      } else if (name.match(/\.(srt|vtt)$/i)) {
        subtitleFiles.push(name);
      } else if (name.match(/\.txt$/i)) {
        lyricFiles.push(name);
      }
    }

    for (const file of mediaFiles) {
      const url = basePath + file;
      const cleanName = file.replace(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i, "");
      const isVideo = !!file.match(/\.(mp4|webm|ogg)$/i);

      const basePrefix = cleanName;

      // ⭐ MULTI‑SUBTITLE SUPPORT
      let vttList = [];
      let srtList = [];
      let lyricsUrl = null;

      subtitleFiles.forEach(sub => {
        const subUrl = basePath + sub;

        if (sub.startsWith(basePrefix)) {
          if (sub.endsWith(".vtt")) {
            vttList.push({ name: sub, url: subUrl });
          }
          if (sub.endsWith(".srt")) {
            srtList.push({ name: sub, url: subUrl });
          }
        }
      });

      lyricFiles.forEach(txt => {
        if (txt.startsWith(basePrefix)) {
          lyricsUrl = basePath + txt;
        }
      });

      trackList.push({
        name: cleanName,
        url,
        duration: null,
        isVideo,
        subtitleVTTs: vttList,   // ⭐ ALL VTT files
        subtitleSRTs: srtList,   // ⭐ ALL SRT files
        lyrics: lyricsUrl,
        basePath: basePath,
        setlistPath: basePath,
        bandGenre: currentBandGenre || []
      });
    }

    renderTrackList();

    if (trackList.length > 0) {
      currentTrackIndex = 0;
      playCurrentTrack();
    }

    let totalTapeLength = 0;

    for (let i = 0; i < trackList.length; i++) {
      try {
        const duration = await getFileDuration(trackList[i].url);
        trackList[i].duration = duration;
        totalTapeLength += duration;
        cassetteUI.setTotalTapeLength(totalTapeLength);
      } catch (e) {
        console.warn("Duration error:", trackList[i].url, e);
      }
    }

  } catch (e) {
    console.error("Failed to load setlist:", e);
  }
}
