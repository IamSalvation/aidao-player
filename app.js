// ---------- Element refs ----------
const media = document.getElementById('media');
const playlistEl = document.getElementById('playlist');
const trackCountEl = document.getElementById('trackCount');
const searchBar = document.getElementById('searchBar');
const turntable = document.getElementById('turntable');
const vinyl = document.getElementById('vinyl');
const vinylArt = document.getElementById('vinylArt');
const posterTitle = document.getElementById('posterTitle');
const posterArtist = document.getElementById('posterArtist');
const seekBar = document.getElementById('seekBar');
const volumeBar = document.getElementById('volumeBar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const btnPlay = document.getElementById('btnPlay');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnMute = document.getElementById('btnMute');
const btnFullscreen = document.getElementById('btnFullscreen');
const btnShuffle = document.getElementById('btnShuffle');
const btnRepeat = document.getElementById('btnRepeat');
const btnSpeed = document.getElementById('btnSpeed');
const pickFolderBtn = document.getElementById('pickFolder');
const pickFilesInput = document.getElementById('pickFiles');
const subtitleContainer = document.getElementById('subtitleContainer');
const lyricsContainer = document.getElementById('lyricsContainer');
const dropOverlay = document.getElementById('dropOverlay');
const libraryStatus = document.getElementById('libraryStatus');
const visualizerCanvas = document.getElementById('visualizer');
const toast = document.getElementById('toast');
const toastArt = document.getElementById('toastArt');
const toastTitle = document.getElementById('toastTitle');
const toastArtist = document.getElementById('toastArtist');

// Settings Elements
const btnSettings = document.getElementById('btnSettings');
const settingsDrawer = document.getElementById('settingsDrawer');
const closeSettings = document.getElementById('closeSettings');
const themeSelect = document.getElementById('themeSelect');
const visualizerToggle = document.getElementById('visualizerToggle');

let toastTimeout;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|mkv|mov)$/i;
let tracks = [];
let currentIndex = -1;
let lastVolume = 1;
let isShuffle = false;
let repeatMode = 0;
let isShowingRemaining = false;
let currentSubtitles = [];
let currentLyrics = [];
let visualizerEnabled = true;

const DEFAULT_ART = 'assets/aidao_player_logo_only-removebg-preview.png';
const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><rect width="36" height="36" fill="%23333"/></svg>';

// ---------- Settings Logic ----------
function loadSettings() {
  const savedTheme = localStorage.getItem('aidao_theme') || 'vlc';
  const savedViz = localStorage.getItem('aidao_viz') !== 'false';
  
  document.body.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;
  
  visualizerEnabled = savedViz;
  visualizerToggle.checked = savedViz;
}

btnSettings.onclick = () => settingsDrawer.classList.add('open');
closeSettings.onclick = () => settingsDrawer.classList.remove('open');

themeSelect.onchange = (e) => {
  const theme = e.target.value;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('aidao_theme', theme);
};

visualizerToggle.onchange = (e) => {
  visualizerEnabled = e.target.checked;
  localStorage.setItem('aidao_viz', visualizerEnabled);
  if (!visualizerEnabled) stopVisualizer();
  else if (currentIndex >= 0 && !VIDEO_EXT.test(tracks[currentIndex].name)) startVisualizer();
};

loadSettings();

// ---------- Audio Visualizer ----------
let audioContext, analyser, sourceNode, dataArray;
let isVisualizerRunning = false;

function initVisualizer() {
  if (audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  sourceNode = audioContext.createMediaElementSource(media);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

function drawVisualizer() {
  if (!isVisualizerRunning || !visualizerEnabled) return;
  requestAnimationFrame(drawVisualizer);
  analyser.getByteFrequencyData(dataArray);
  const ctx = visualizerCanvas.getContext('2d');
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  ctx.clearRect(0, 0, width, height);
  
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 10;
  const bars = dataArray.length;
  const angleStep = (Math.PI * 2) / bars;
  
  // Get accent color from CSS variable
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  
  for (let i = 0; i < bars; i++) {
    const value = dataArray[i];
    const barHeight = (value / 255) * 40;
    if (barHeight < 2) continue;
    
    const angle = i * angleStep;
    const x1 = centerX + Math.cos(angle) * radius;
    const y1 = centerY + Math.sin(angle) * radius;
    const x2 = centerX + Math.cos(angle) * (radius + barHeight);
    const y2 = centerY + Math.sin(angle) * (radius + barHeight);
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = value / 255;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function startVisualizer() {
  if (!visualizerEnabled) return;
  if (!audioContext) initVisualizer();
  if (audioContext.state === 'suspended') audioContext.resume();
  isVisualizerRunning = true;
  drawVisualizer();
}

function stopVisualizer() {
  isVisualizerRunning = false;
  const ctx = visualizerCanvas.getContext('2d');
  ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
}

// ---------- Animation ----------
let rotation = 0;
let isSpinning = false;
let lastTime = 0;
const SPIN_SPEED = 0.06;

function animateVinyl(time) {
  if (!lastTime) lastTime = time;
  const delta = time - lastTime;
  if (isSpinning) {
    rotation = (rotation + (SPIN_SPEED * delta)) % 360;
    vinyl.style.transform = `rotate(${rotation}deg)`;
  }
  lastTime = time;
  requestAnimationFrame(animateVinyl);
}
requestAnimationFrame(animateVinyl);

// ---------- Smart Library ----------
function saveLibrary() {
  try {
    const libraryData = tracks.map(t => ({ name: t.name, title: t.title, artist: t.artist, album: t.album }));
    localStorage.setItem('aidao_library', JSON.stringify(libraryData));
    if (libraryStatus) libraryStatus.style.display = 'none'; 
  } catch (e) {}
}

function loadLibrary() {
  const saved = localStorage.getItem('aidao_library');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data && data.length > 0) {
        tracks = data.map(d => ({ ...d, file: null, art: null }));
        render();
        if (libraryStatus) {
          libraryStatus.textContent = `Restored ${tracks.length} tracks (Open folder to play)`;
          libraryStatus.style.display = 'inline-block';
        }
      }
    } catch(e) {}
  }
}
loadLibrary();

// ---------- File Loading ----------
pickFolderBtn.onclick = () => pickFilesInput.click();

pickFilesInput.onchange = async (e) => {
  // Always show the sidebar when files are loaded so the user can click them
  document.body.classList.remove('theater-mode');
  
  const files = [...e.target.files];
  if (tracks.length > 0 && tracks.some(t => !t.file)) {
    const loadedFiles = files.filter(f => AUDIO_EXT.test(f.name) || VIDEO_EXT.test(f.name));
    let matchedCount = 0;
    tracks.forEach(t => {
      const match = loadedFiles.find(f => f.name === t.name);
      if (match) {
        t.file = match; matchedCount++;
        readTags(match).then(tags => { t.art = pictureToDataUrl(tags.picture); render(); });
      }
    });
    if (matchedCount > 0) {
      if (libraryStatus) {
        libraryStatus.textContent = `Matched ${matchedCount}/${tracks.length} files!`;
        setTimeout(() => libraryStatus.style.display = 'none', 3000);
      }
      render(); return; 
    }
  }
  
  tracks = files.filter(f => AUDIO_EXT.test(f.name) || VIDEO_EXT.test(f.name)).map(f => ({ name: f.name, file: f }));
  await enrichAll();
  render();
};

// ---------- Metadata ----------
function readTags(file) {
  return new Promise((resolve) => {
    if (!AUDIO_EXT.test(file.name)) return resolve({});
    if (typeof jsmediatags === 'undefined') return resolve({});
    jsmediatags.read(file, { onSuccess: (tag) => resolve(tag.tags || {}), onError: () => resolve({}) });
  });
}

function pictureToDataUrl(picture) {
  if (!picture || !picture.data) return null;
  const bytes = new Uint8Array(picture.data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:' + picture.format + ';base64,' + btoa(binary);
}

async function enrichAll() {
  await Promise.all(tracks.map(async (t) => {
    if (!t.file) return; 
    const tags = await readTags(t.file);
    t.title = tags.title || t.name.replace(/\.[^.]+$/, '');
    t.artist = tags.artist || '';
    t.album = tags.album || '';
    t.art = pictureToDataUrl(tags.picture);
  }));
  tracks.sort((a, b) => (a.artist || a.title).localeCompare(b.artist || b.title));
  saveLibrary();
}

// ---------- Rendering ----------
function render() {
  playlistEl.innerHTML = '';
  trackCountEl.textContent = tracks.length;
  const query = searchBar.value.toLowerCase();
  
  tracks.forEach((t, i) => {
    const textToSearch = (t.title + ' ' + t.artist).toLowerCase();
    if (query && !textToSearch.includes(query)) return;

    const li = document.createElement('li');
    const art = document.createElement('img');
    art.src = t.art || PLACEHOLDER;
    art.alt = '';

    const meta = document.createElement('div');
    meta.className = 'meta';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = (VIDEO_EXT.test(t.name) ? '🎬 ' : '') + t.title;

    const artistEl = document.createElement('div');
    artistEl.className = 'artist';
    artistEl.textContent = t.artist || (VIDEO_EXT.test(t.name) ? 'Video' : 'Unknown artist');

    meta.appendChild(titleEl); meta.appendChild(artistEl);
    li.appendChild(art); li.appendChild(meta);
    
    if (i === currentIndex) li.classList.add('playing');
    li.onclick = () => play(i);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); removeTrack(t); };
    li.appendChild(delBtn);
    playlistEl.appendChild(li);
  });
}

searchBar.addEventListener('input', render);

// ---------- Delete Track ----------
function removeTrack(t) {
  const playing = tracks[currentIndex];
  const idx = tracks.indexOf(t);
  if (idx === -1) return;
  
  tracks.splice(idx, 1);
  if (t === playing) {
    media.pause();
    media.removeAttribute('src');
    media.load();
    currentIndex = -1;
    turntable.style.display = 'flex';
    media.style.display = 'none';
    posterTitle.textContent = 'No track playing';
    posterArtist.textContent = 'Open files to get started';
    subtitleContainer.innerHTML = '';
    lyricsContainer.innerHTML = '';
    stopVisualizer();
  } else {
    currentIndex = playing ? tracks.indexOf(playing) : -1;
  }
  saveLibrary();
  render();
}

// ---------- Playback ----------
function showToast(t) {
  toastArt.src = t.art || DEFAULT_ART;
  toastTitle.textContent = t.title;
  toastArtist.textContent = t.artist || 'Unknown artist';
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

async function play(i) {
  if (i < 0 || i >= tracks.length) return;
  const t = tracks[i];
  if (!t.file) {
    alert("Please click 'Open folder' and re-select your files to play this track.");
    return;
  }
  currentIndex = i;

  dropOverlay.classList.remove('active'); 
  media.pause();
  media.removeAttribute('src');
  media.src = URL.createObjectURL(t.file);
  media.playbackRate = parseFloat(btnSpeed.textContent);
  
  subtitleContainer.innerHTML = '';
  lyricsContainer.innerHTML = '';
  currentSubtitles = [];
  currentLyrics = [];

  if (t.subFile) await parseSubtitles(t.subFile);
  if (t.lyricsFile) await parseLyrics(t.lyricsFile);

  if (VIDEO_EXT.test(t.name)) {
    turntable.style.display = 'none';
    media.style.display = 'block';
    media.style.zIndex = 10;
    stopVisualizer();
  } else {
    media.style.display = 'none';
    turntable.style.display = 'flex';
    
    vinylArt.src = t.art || DEFAULT_ART;
    vinylArt.style.borderRadius = '50%';
    if (t.art) vinylArt.style.filter = 'none';
    else vinylArt.style.filter = 'drop-shadow(0 0 10px var(--accent))';

    posterTitle.textContent = t.title;
    posterArtist.textContent = t.artist || 'Unknown artist';
    
    startVisualizer();
  }
  
  media.play();
  updateMediaSession(t);
  showToast(t);
  render();
}

function playNext() {
  if (isShuffle) {
    let randomIndex = currentIndex;
    while (randomIndex === currentIndex && tracks.length > 1) {
      randomIndex = Math.floor(Math.random() * tracks.length);
    }
    play(randomIndex);
  } else {
    if (currentIndex < tracks.length - 1) play(currentIndex + 1);
    else if (repeatMode === 1) play(0);
  }
}

media.onended = () => {
  if (repeatMode === 2) {
    media.currentTime = 0;
    media.play();
  } else {
    playNext();
  }
};

// ---------- Parsers ----------
async function parseSubtitles(file) {
  const text = await file.text();
  const blocks = text.replace(/\r/g, '').split('\n\n');
  currentSubtitles = blocks.map(block => {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const timeStr = lines[1];
      const content = lines.slice(2).join('<br>');
      const [start, end] = timeStr.split(' --> ');
      return { start: timeToSeconds(start), end: timeToSeconds(end), text: content };
    }
    return null;
  }).filter(b => b);
}

function timeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const [hms, ms] = timeStr.split(',');
  const [h, m, s] = hms.split(':');
  return (+h) * 3600 + (+m) * 60 + (+s) + (ms ? +ms / 1000 : 0);
}

async function parseLyrics(file) {
  const text = await file.text();
  const lines = text.split('\n');
  currentLyrics = lines.map(line => {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) return { time: (+match[1]) * 60 + (+match[2]), text: match[3].trim() };
    return null;
  }).filter(l => l && l.text); 
  
  currentLyrics.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'lyric-line';
    div.id = 'lyric-' + i;
    div.textContent = l.text;
    lyricsContainer.appendChild(div);
  });
}

media.addEventListener('timeupdate', () => {
  const time = media.currentTime;
  if (media.duration) {
    seekBar.value = (media.currentTime / media.duration) * 1000;
    updateTimeDisplay();
  }
  if (currentSubtitles.length > 0) {
    const activeSub = currentSubtitles.find(s => time >= s.start && time <= s.end);
    subtitleContainer.innerHTML = activeSub ? `<span class="subtitle-text">${activeSub.text}</span>` : '';
  }
  if (currentLyrics.length > 0) {
    let activeIndex = -1;
    for (let i = 0; i < currentLyrics.length; i++) {
      if (time >= currentLyrics[i].time) activeIndex = i;
      else break;
    }
    const lines = lyricsContainer.children;
    for (let i = 0; i < lines.length; i++) lines[i].classList.toggle('active', i === activeIndex);
    if (activeIndex >= 0 && lines[activeIndex]) lines[activeIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

// ---------- Controls ----------
btnPlay.onclick = () => media.paused ? media.play() : media.pause();
btnPrev.onclick = () => { if (currentIndex > 0) play(currentIndex - 1); };
btnNext.onclick = playNext;

btnShuffle.onclick = () => { isShuffle = !isShuffle; btnShuffle.classList.toggle('active', isShuffle); };

btnRepeat.onclick = () => {
  repeatMode = (repeatMode + 1) % 3;
  if (repeatMode === 0) { btnRepeat.classList.remove('active'); btnRepeat.textContent = '🔁'; }
  else if (repeatMode === 1) { btnRepeat.classList.add('active'); btnRepeat.textContent = '🔁'; }
  else { btnRepeat.classList.add('active'); btnRepeat.textContent = '🔂'; }
};

btnSpeed.onclick = () => {
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  let currentSpeed = parseFloat(btnSpeed.textContent);
  let nextIdx = speeds.indexOf(currentSpeed) + 1;
  if (nextIdx >= speeds.length) nextIdx = 0;
  media.playbackRate = speeds[nextIdx];
  btnSpeed.textContent = speeds[nextIdx] + 'x';
};

durationEl.onclick = () => { isShowingRemaining = !isShowingRemaining; if (media.duration) updateTimeDisplay(); };

function updateTimeDisplay() {
  currentTimeEl.textContent = fmt(media.currentTime);
  if (isShowingRemaining) durationEl.textContent = '-' + fmt(media.duration - media.currentTime);
  else durationEl.textContent = fmt(media.duration);
}

media.addEventListener('play', () => {
  isSpinning = true;
  btnPlay.textContent = '⏸';
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  if (!VIDEO_EXT.test(tracks[currentIndex].name)) startVisualizer();
});

media.addEventListener('pause', () => {
  isSpinning = false;
  btnPlay.textContent = '▶';
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

seekBar.addEventListener('click', (e) => {
  const rect = seekBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  if (media.duration) media.currentTime = percent * media.duration;
});

seekBar.addEventListener('input', () => { if (media.duration) media.currentTime = (seekBar.value / 1000) * media.duration; });

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

volumeBar.addEventListener('input', () => { media.volume = volumeBar.value / 100; lastVolume = media.volume; });

btnMute.onclick = () => {
  if (media.volume > 0) {
    lastVolume = media.volume; media.volume = 0; volumeBar.value = 0; btnMute.textContent = '🔇';
  } else {
    media.volume = lastVolume || 1; volumeBar.value = media.volume * 100; btnMute.textContent = '🔊';
  }
};

btnFullscreen.onclick = () => {
  const el = media.parentElement;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen();
};

function updateMediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title || t.name, artist: t.artist || '', album: t.album || '',
    artwork: t.art ? [{ src: t.art, sizes: '512x512', type: 'image/jpeg' }] : [{ src: DEFAULT_ART, sizes: '512x512', type: 'image/png' }],
  });
  navigator.mediaSession.setActionHandler('play', () => media.play());
  navigator.mediaSession.setActionHandler('pause', () => media.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => { if (currentIndex > 0) play(currentIndex - 1); });
  navigator.mediaSession.setActionHandler('nexttrack', playNext);
}

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  
  if (e.ctrlKey && e.code === 'KeyF') {
    e.preventDefault();
    searchBar.focus();
    return;
  }

  if (tag === 'input' || tag === 'textarea') return;

  switch (e.code) {
    case 'Space': e.preventDefault(); media.paused ? media.play() : media.pause(); break;
    case 'ArrowLeft': e.preventDefault(); media.currentTime = Math.max(0, media.currentTime - (e.shiftKey ? 1 : 10)); break;
    case 'ArrowRight': e.preventDefault(); media.currentTime = Math.min(media.duration || 0, media.currentTime + (e.shiftKey ? 1 : 10)); break;
    case 'ArrowUp': e.preventDefault(); media.volume = Math.min(1, media.volume + (e.shiftKey ? 0.01 : 0.1)); volumeBar.value = media.volume * 100; break;
    case 'ArrowDown': e.preventDefault(); media.volume = Math.max(0, media.volume - (e.shiftKey ? 0.01 : 0.1)); volumeBar.value = media.volume * 100; break;
    case 'KeyN': playNext(); break;
    case 'KeyP': if (currentIndex > 0) play(currentIndex - 1); break;
  }
});

// ---------- Drag & Drop ----------
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault(); dragCounter++;
  if (e.dataTransfer.types.includes('Files')) dropOverlay.classList.add('active');
});
window.addEventListener('dragleave', (e) => {
  e.preventDefault(); dragCounter--;
  if (dragCounter === 0) dropOverlay.classList.remove('active');
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault(); dragCounter = 0; dropOverlay.classList.remove('active');
  
  // Always show the sidebar when files are dropped
  document.body.classList.remove('theater-mode');
  if (e.dataTransfer.items) {
    const files = [];
    const items = [...e.dataTransfer.items];
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) await traverseFileTree(entry, files);
      }
    }
    if (files.length > 0) {
      tracks = files.filter(f => AUDIO_EXT.test(f.name) || VIDEO_EXT.test(f.name)).map(f => ({ name: f.name, file: f }));
      await enrichAll(); render();
    }
  }
});

function traverseFileTree(item, files) {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file) => {
        if (AUDIO_EXT.test(file.name) || VIDEO_EXT.test(file.name) || file.name.endsWith('.srt') || file.name.endsWith('.vtt') || file.name.endsWith('.lrc')) files.push(file);
        resolve();
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async (entries) => {
        for (const entry of entries) await traverseFileTree(entry, files);
        resolve();
      });
    } else resolve();
  });
}

// ===== Phase 11: Equalizer Logic =====
const eqBass = document.getElementById('eq-bass');
const eqMid = document.getElementById('eq-mid');
const eqTreble = document.getElementById('eq-treble');
const eqBassVal = document.getElementById('eq-bass-val');
const eqMidVal = document.getElementById('eq-mid-val');
const eqTrebleVal = document.getElementById('eq-treble-val');
const eqPreset = document.getElementById('eqPreset');

let bassFilter, midFilter, trebleFilter;

// We override initVisualizer to insert the EQ filters
const originalInitVisualizer = initVisualizer;
initVisualizer = function() {
  if (audioContext) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();
  
  // Create EQ Filters
  bassFilter = audioContext.createBiquadFilter();
  bassFilter.type = 'lowshelf';
  bassFilter.frequency.value = 200;
  
  midFilter = audioContext.createBiquadFilter();
  midFilter.type = 'peaking';
  midFilter.frequency.value = 1000;
  midFilter.Q.value = 1;
  
  trebleFilter = audioContext.createBiquadFilter();
  trebleFilter.type = 'highshelf';
  trebleFilter.frequency.value = 3000;
  
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  
  // Route: Media -> Bass -> Mid -> Treble -> Analyser -> Output
  sourceNode = audioContext.createMediaElementSource(media);
  sourceNode.connect(bassFilter);
  bassFilter.connect(midFilter);
  midFilter.connect(trebleFilter);
  trebleFilter.connect(analyser);
  analyser.connect(audioContext.destination);
  
  dataArray = new Uint8Array(analyser.frequencyBinCount);
};

function updateEQ() {
  eqBassVal.textContent = eqBass.value;
  eqMidVal.textContent = eqMid.value;
  eqTrebleVal.textContent = eqTreble.value;
  
  if (bassFilter && midFilter && trebleFilter) {
    bassFilter.gain.value = parseInt(eqBass.value);
    midFilter.gain.value = parseInt(eqMid.value);
    trebleFilter.gain.value = parseInt(eqTreble.value);
  }
}

eqBass.addEventListener('input', () => { eqPreset.value = 'custom'; updateEQ(); });
eqMid.addEventListener('input', () => { eqPreset.value = 'custom'; updateEQ(); });
eqTreble.addEventListener('input', () => { eqPreset.value = 'custom'; updateEQ(); });

eqPreset.addEventListener('change', (e) => {
  const val = e.target.value;
  let b = 0, m = 0, t = 0;
  
  if (val === 'bass') { b = 10; m = 0; t = 0; }
  else if (val === 'vocal') { b = -2; m = 6; t = 2; }
  else if (val === 'rock') { b = 6; m = -2; t = 6; }
  else if (val === 'jazz') { b = 4; m = 2; t = 4; }
  else if (val === 'electronic') { b = 8; m = 2; t = 8; }
  
  eqBass.value = b; eqMid.value = m; eqTreble.value = t;
  updateEQ();
});

// ===== Phase 12: Theater Mode Logic (FIXED) =====
const btnTheater = document.getElementById('btnTheater');

btnTheater.onclick = () => {
  document.body.classList.toggle('theater-mode');
};

// We must override the existing play function safely using addEventListener 
// on the actual play button, but since play() is called from the playlist, 
// we use a wrapper function.
const originalPlayFunction = play;

window.play = async function(i) {
  if (i < 0 || i >= tracks.length) return;
  const t = tracks[i];
  
  // Force Theater Mode OFF for audio, ON for video
  if (VIDEO_EXT.test(t.name)) {
    document.body.classList.add('theater-mode');
  } else {
    document.body.classList.remove('theater-mode');
  }
  
  await originalPlayFunction(i);
};

// Because the playlist rows call 'play(i)' internally, we must ensure they 
// call the new window.play. We can do this by re-rendering the playlist.
render();



// ===== Final Polish: Danger Zone Logic =====
const clearLibraryBtn = document.getElementById('clearLibraryBtn');
const resetAppBtn = document.getElementById('resetAppBtn');

if (clearLibraryBtn) {
  clearLibraryBtn.onclick = () => {
    if (confirm("Are you sure you want to clear your saved library? You will need to re-open your files.")) {
      localStorage.removeItem('aidao_library');
      tracks = [];
      currentIndex = -1;
      render();
      location.reload(); // Reload to clear everything cleanly
    }
  };
}

if (resetAppBtn) {
  resetAppBtn.onclick = () => {
    if (confirm("Are you sure you want to RESET the app? This will clear all themes, EQ settings, and your library.")) {
      localStorage.clear();
      location.reload();
    }
  };
}

// ===== Premium SVG Icon Logic =====
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const iconVolume = document.getElementById('iconVolume');
const iconMute = document.getElementById('iconMute');

// Swap Play/Pause SVGs
media.addEventListener('play', () => {
  iconPlay.style.display = 'none';
  iconPause.style.display = 'block';
});

media.addEventListener('pause', () => {
  iconPlay.style.display = 'block';
  iconPause.style.display = 'none';
});

// Swap Volume/Mute SVGs
btnMute.onclick = () => {
  if (media.volume > 0) {
    lastVolume = media.volume;
    media.volume = 0;
    volumeBar.value = 0;
    iconVolume.style.display = 'none';
    iconMute.style.display = 'block';
  } else {
    media.volume = lastVolume || 1;
    volumeBar.value = media.volume * 100;
    iconVolume.style.display = 'block';
    iconMute.style.display = 'none';
  }
};

// ===== Splash Screen Logic =====
// Start the timer immediately, not waiting for window.load
setTimeout(() => {
  const splash = document.getElementById('splashScreen');
  if (splash) {
    splash.classList.add('hidden');
    // Remove it from the DOM entirely after the fade finishes
    setTimeout(() => splash.remove(), 800); 
  }
}, 2500);

