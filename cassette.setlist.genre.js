// cassette.setlist.genre.js

(function () {

  // shuffle helper
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ------------------------------------------------------------
  // GET GENRES FOR TRACK — uses track.bandGenre
  // ------------------------------------------------------------
  function getGenresForTrack(trackIndex) {

    const track = trackList[trackIndex];
    if (!track) return [];

    return track.bandGenre || [];
  }

  // ------------------------------------------------------------
  // COLLECT TRACKS BY GENRE — unchanged
  // ------------------------------------------------------------
  async function collectTracksByGenres(genres) {
    const bands = window.setlistData.bands || [];
    const candidates = [];

    for (const band of bands) {
      const bandGenres = band.genre || [];
      const hasMatch = bandGenres.some(g => genres.includes(g));
      if (!hasMatch) continue;

      for (const album of band.albums || []) {
        try {
          const res = await fetch(album.path + "setlist.txt");
          const text = await res.text();
          const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");

          for (const file of lines) {
            if (!file.match(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i)) continue;

            const url = album.path + file;
            const cleanName = file.replace(/\.(mp3|wav|aif|aiff|flac|mp4|webm|ogg)$/i, "");

            candidates.push({ name: cleanName, url });
          }
        } catch (e) {
          console.warn("Failed to read setlist for", album.path, e);
        }
      }
    }

    return candidates;
  }

  // ------------------------------------------------------------
  // MAIN: BUILD RELATED PLAYLIST — FULL VIDEO SUPPORT
  // ------------------------------------------------------------
  window.buildRelatedPlaylistForTrack = async function (trackIndex) {

    const genres = getGenresForTrack(trackIndex);
    if (!genres.length) {
      console.log("No genres found for track.");
      return;
    }

    const candidates = await collectTracksByGenres(genres);
    if (!candidates.length) {
      console.log("No related tracks found.");
      return;
    }

    shuffle(candidates);

    const related = [];
    let i = 0;

    while (related.length < 20 && i < candidates.length) {
      const chunkSize = [2, 3, 5][Math.floor(Math.random() * 3)];
      const chunk = candidates.slice(i, i + chunkSize);
      related.push(...chunk);
      i += chunkSize;
    }

    // reset playlist
    trackList.length = 0;
    currentTrackIndex = -1;
    trackListEl.innerHTML = "";

    cassetteUI.setTotalTapeLength(0);
    cassetteUI.setGlobalTapePosition(0);
    cassetteUI.setPlaying(false);

    progressFill.style.width = "0%";
    timeLabel.textContent = "00:00 / 00:00";

    // ------------------------------------------------------------
    // INSTANT: push tracks with FULL metadata (video + subs + lyrics)
    // ------------------------------------------------------------
    for (const item of related) {

      const file = item.url.substring(item.url.lastIndexOf("/") + 1);
      const cleanName = item.name;
      const basePath = item.url.substring(0, item.url.lastIndexOf("/") + 1);

      const isVideo = file.match(/\.(mp4|webm|ogg)$/i) ? true : false;

      // detect subtitles + lyrics
      let subtitleVTT = null;
      let subtitleSRTs = [];
      let lyricsUrl = null;

      try {
        const res = await fetch(basePath + "setlist.txt");
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");

        lines.forEach(line => {
          if (line.startsWith(cleanName)) {
            if (line.endsWith(".vtt")) subtitleVTT = basePath + line;
            if (line.endsWith(".srt")) subtitleSRTs.push({ name: line, url: basePath + line });
            if (line.endsWith(".txt")) lyricsUrl = basePath + line;
          }
        });
      } catch (e) {
        console.warn("Related: subtitle/lyrics scan failed", e);
      }

      trackList.push({
        name: cleanName,
        url: item.url,
        duration: null,
        isVideo: isVideo,
        subtitleVTT: subtitleVTT,
        subtitleSRTs: subtitleSRTs,
        lyrics: lyricsUrl,
        basePath: basePath,
        bandGenre: genres
      });
    }

    renderTrackList();

    if (trackList.length > 0) {
      currentTrackIndex = 0;
      playCurrentTrack();
    }

    // BACKGROUND duration scan
    (async () => {
      let totalTapeLength = 0;

      const durationPromises = trackList.map(async (track) => {
        try {
          const duration = await getFileDuration(track.url);
          track.duration = duration;
          totalTapeLength += duration;
          cassetteUI.setTotalTapeLength(totalTapeLength);
        } catch (e) {
          console.warn("Duration error:", track.url, e);
        }
      });

      await Promise.all(durationPromises);

      if (window.attachTrackMenus) {
        window.attachTrackMenus();
      }
    })();
  };

})();
