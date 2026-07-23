// lyrics.js

(function () {

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "lyricsOverlay";
  overlay.style.display = "none";

  // Inner content
  const inner = document.createElement("div");
  inner.id = "lyricsInner";

  // Close button
  const closeBtn = document.createElement("div");
  closeBtn.id = "lyricsCloseBtn";
  closeBtn.textContent = "X";

  closeBtn.onclick = () => {
    overlay.style.display = "none";
  };

  overlay.appendChild(closeBtn);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  // Track index currently showing lyrics
  let currentLyricsTrackIndex = null;

  // ------------------------------------------------------------
  // Load lyrics 
  // ------------------------------------------------------------
  async function loadLyricsForTrack(index) {
    const track = trackList[index];
    if (!track) return;

    currentLyricsTrackIndex = index;

    // Build .txt filename from audio filename
    // Example: "01 - Song.mp3" → "01 - Song.txt"
    const txtName = track.name + ".txt";

    // Lyrics file is in same folder as audio
    const folder = track.url.substring(0, track.url.lastIndexOf("/") + 1);
    const lyricsURL = folder + txtName;

    try {
      const res = await fetch(lyricsURL);
      if (!res.ok) {
        inner.textContent = "No lyrics found.";
      } else {
        const text = await res.text();
        inner.textContent = text;
      }
    } catch (e) {
      inner.textContent = "Failed to load lyrics.";
    }

    overlay.style.display = "flex";
  }

  // ------------------------------------------------------------
  // Auto-update lyrics
  // ------------------------------------------------------------
  window.updateLyricsOnTrackChange = function () {
    if (overlay.style.display === "flex" && currentLyricsTrackIndex !== null) {
      // If overlay is open → load lyrics for new track
      loadLyricsForTrack(currentTrackIndex);
    }
  };

  window.openLyricsForTrack = function (index) {
    loadLyricsForTrack(index);
  };

})();
