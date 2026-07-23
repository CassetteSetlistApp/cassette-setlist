// cassette.setlist.ui.js

(function () {

  const trackListEl = document.getElementById("trackList");

  // floating context menu
  const menu = document.createElement("div");
  menu.className = "track-context-menu";
  menu.style.position = "absolute";
  menu.style.display = "none";
  menu.style.zIndex = "9999";

  // full menu (visibility controlled by JS)
  menu.innerHTML = `
    <div class="track-context-item" data-action="lyrics">Lyrics</div>
    <div class="track-context-item" data-action="subtitle">Subtitle</div>
    <div class="track-context-item" data-action="fullscreen">Fullscreen</div>
    <div class="track-context-item" data-action="related">Related</div>
  `;

  document.body.appendChild(menu);

  let currentMenuTrackIndex = null;

  // attach menu to each track row
  window.attachTrackMenus = function () {
    const rows = trackListEl.querySelectorAll("li");

    rows.forEach((row, index) => {

      // create dots if missing
      let dots = row.querySelector(".track-menu-dots");
      if (!dots) {
        dots = document.createElement("span");
        dots.className = "track-menu-dots";
        dots.textContent = "...";
        dots.style.marginLeft = "10px";
        dots.style.cursor = "pointer";
        dots.style.color = "#ccc";
        dots.style.fontWeight = "bold";
        dots.style.float = "right";

        row.appendChild(dots);
      }

      dots.onclick = (e) => {
        e.stopPropagation();
        currentMenuTrackIndex = index;

        const track = window.trackList[index];
        const isVideo = track && track.isVideo;

        // AUDIO: Lyrics + Related
        menu.querySelector('[data-action="lyrics"]').style.display = "block";
        menu.querySelector('[data-action="related"]').style.display = "block";

        // VIDEO: add Subtitle + Fullscreen
        menu.querySelector('[data-action="subtitle"]').style.display = isVideo ? "block" : "none";
        menu.querySelector('[data-action="fullscreen"]').style.display = isVideo ? "block" : "none";

        const rect = dots.getBoundingClientRect();
        menu.style.left = rect.right + 4 + "px";
        menu.style.top = rect.top + "px";
        menu.style.display = "block";
      };
    });
  };

  // hide menu when clicking outside
  document.addEventListener("click", () => {
    menu.style.display = "none";
  });

  // handle menu actions
menu.addEventListener("click", (e) => {
  const item = e.target.closest(".track-context-item");
  if (!item) {
    console.log("[CTX] click ignored, no .track-context-item");
    return;
  }

  const action = item.dataset.action;
  console.log("[CTX] action =", action);

  menu.style.display = "none";

  if (currentMenuTrackIndex == null) {
    console.log("[CTX] currentMenuTrackIndex is null, abort");
    return;
  }

  const track = window.trackList[currentMenuTrackIndex];
  const isVideo = track && track.isVideo;

  console.log("[CTX] track index =", currentMenuTrackIndex, "track =", track);
  console.log("[CTX] isVideo =", isVideo);

  // RELATED
  if (action === "related") {
    console.log("[CTX] RELATED clicked");
    if (window.buildRelatedPlaylistForTrack) {
      window.buildRelatedPlaylistForTrack(currentMenuTrackIndex);
    } else {
      console.log("[CTX] buildRelatedPlaylistForTrack missing");
    }
    return;
  }

  // LYRICS
  if (action === "lyrics") {
    console.log("[CTX] LYRICS clicked");
    if (window.openLyricsForTrack) {
      window.openLyricsForTrack(currentMenuTrackIndex);
    } else {
      console.log("[CTX] openLyricsForTrack missing");
    }
    return;
  }

  // VIDEO ONLY
  if (!isVideo) {
    console.log("[CTX] not a video track, ignoring subtitle/fullscreen");
    return;
  }

  // SUBTITLE
  if (action === "subtitle") {
    console.log("[CTX] SUBTITLE clicked");

    if (!window.CassetteSubtitle) {
      console.log("[CTX] CassetteSubtitle is missing");
      return;
    }

    console.log("[CTX] calling CassetteSubtitle.loadSubtitles(track)");
    CassetteSubtitle.loadSubtitles(track);

    if (CassetteSubtitle.loadSubtitleSettings) {
      console.log("[CTX] calling CassetteSubtitle.loadSubtitleSettings()");
      CassetteSubtitle.loadSubtitleSettings();
    } else {
      console.log("[CTX] loadSubtitleSettings missing");
    }

    const overlay = document.getElementById("cassetteSubtitleOverlay");
    console.log("[CTX] overlay element =", overlay);

    if (!overlay) {
      console.log("[CTX] cassetteSubtitleOverlay NOT FOUND in DOM");
      return;
    }

    // try both: direct flex + helper
    overlay.style.display = "flex";
    console.log("[CTX] overlay.style.display set to", overlay.style.display);

    if (typeof openSubtitleOverlay === "function") {
      console.log("[CTX] openSubtitleOverlay() exists, calling");
      openSubtitleOverlay();
    } else {
      console.log("[CTX] openSubtitleOverlay() not defined, using direct display");
    }

    return;
  }

  // FULLSCREEN
  if (action === "fullscreen") {
  console.log("[CTX] FULLSCREEN clicked");

  const videoContainer = document.getElementById("videoContainer");
  console.log("[CTX] videoContainer =", videoContainer);

  if (!videoContainer) {
    console.log("[CTX] videoContainer NOT FOUND");
    return;
  }

  // remove custom fullscreen class (it breaks real fullscreen)
  videoContainer.classList.remove("fs-fullscreen");

  // request fullscreen on the container
  if (videoContainer.requestFullscreen) {
    console.log("[CTX] using requestFullscreen()");
    videoContainer.requestFullscreen();
  } else if (videoContainer.webkitRequestFullscreen) {
    console.log("[CTX] using webkitRequestFullscreen()");
    videoContainer.webkitRequestFullscreen();
  } else if (videoContainer.msRequestFullscreen) {
    console.log("[CTX] using msRequestFullscreen()");
    videoContainer.msRequestFullscreen();
  } else {
    console.log("[CTX] no fullscreen API available");
  }
}

});


})();
