/* Music Room Core Logic */

let playlistAudio = null;
let isPlaylistPlaying = false;
let currentTrackIndex = 0;
let repeatMode = 0;
let isShuffle = false;
let isPlaylistInitialized = false;
let isProgressDragging = false;

window.isPlaylistPlaying = isPlaylistPlaying;
window.currentTrackIndex = currentTrackIndex;

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + String(secs).padStart(2, '0');
}

function updateWindowState() {
    window.isPlaylistPlaying = isPlaylistPlaying;
    window.currentTrackIndex = currentTrackIndex;
}

function setPlayIcons(isPlaying) {
    const lpBtn = document.getElementById('p-play-btn');
    if (lpBtn) {
        lpBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    }
}

function syncMusicDisplay(track) {
    void track;
}

function syncLPPlayer(track) {
    const pTitle = document.getElementById('p-title');
    const pArtist = document.getElementById('p-artist');
    const lpLabel = document.getElementById('lp-label-img');

    if (pTitle) pTitle.innerText = track.title || '';
    if (pArtist) pArtist.innerText = track.artist || '';

    if (lpLabel && track.cover) {
        lpLabel.src = track.cover;
        if (typeof window.extractPointColor === 'function' && typeof window.updateVinylColor === 'function') {
            window.extractPointColor(track.cover, window.updateVinylColor);
        }
    }

    syncMusicDisplay(track);
}

function syncPlaylistActive() {
    const totalTracks = Array.isArray(playlistData) ? playlistData.length : 0;
    document.querySelectorAll('.lp-pl-item').forEach((el) => {
        const idx = parseInt(el.getAttribute('data-track-index') || '-1', 10);
        const baseStackZ = Math.max(1, idx + 1);
        el.style.setProperty('--stack-z', String(baseStackZ));
        el.style.setProperty('--stack-hover-z', String(totalTracks + 20));
        el.style.setProperty('--stack-active-z', String(totalTracks + 10));

        if (idx === currentTrackIndex) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function syncLPSlidingState() {
    const lpPlayer = document.getElementById('lp-player');
    if (!lpPlayer) return;

    if (isPlaylistPlaying) {
        lpPlayer.classList.add('playing');
        lpPlayer.classList.add('sliding');
    } else {
        lpPlayer.classList.remove('playing');
        lpPlayer.classList.remove('sliding');
    }
}

function syncAllUI() {
    if (!Array.isArray(playlistData) || !playlistData[currentTrackIndex]) return;
    const track = playlistData[currentTrackIndex];
    syncLPPlayer(track);
    syncPlaylistActive();
    setPlayIcons(isPlaylistPlaying);
    syncLPSlidingState();
    updatePhoneProgress();
}

function resumeAudioContext() {
    if (window.SoundwaveAudio && typeof window.SoundwaveAudio.resumeContext === 'function') {
        return window.SoundwaveAudio.resumeContext().catch(() => {});
    }
    return Promise.resolve();
}

function playCurrentSource() {
    if (!playlistAudio) return;

    resumeAudioContext().finally(() => {
        const playPromise = playlistAudio.play();
        if (playPromise && typeof playPromise.then === 'function') {
            playPromise.then(() => {
                isPlaylistPlaying = true;
                updateWindowState();
                syncAllUI();
            }).catch((error) => {
                console.warn('Playback prevented:', error);
                isPlaylistPlaying = false;
                updateWindowState();
                syncAllUI();
            });
        }
    });
}

function loadTrack(index) {
    if (!Array.isArray(playlistData) || index < 0 || index >= playlistData.length) return;

    const track = playlistData[index];
    if (!track || !track.audio || !playlistAudio) return;

    currentTrackIndex = index;
    updateWindowState();

    playlistAudio.src = encodeURI(track.audio);
    playlistAudio.load();

    if (window.soundwaveInstance && typeof window.soundwaveInstance.setTrackUrl === 'function') {
        window.soundwaveInstance.setTrackUrl(track.audio);
    }

    syncAllUI();
    playCurrentSource();
}

function prevTrack() {
    if (!Array.isArray(playlistData) || playlistData.length === 0) return;
    let nextIndex = currentTrackIndex - 1;
    if (nextIndex < 0) nextIndex = playlistData.length - 1;
    loadTrack(nextIndex);
}

function nextTrack() {
    if (!Array.isArray(playlistData) || playlistData.length === 0) return;

    if (isShuffle) {
        let nextIndex = Math.floor(Math.random() * playlistData.length);
        if (playlistData.length > 1 && nextIndex === currentTrackIndex) {
            nextIndex = (nextIndex + 1) % playlistData.length;
        }
        loadTrack(nextIndex);
        return;
    }

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlistData.length) nextIndex = 0;
    loadTrack(nextIndex);
}

function togglePlaylistAudio() {
    if (!playlistAudio) return;

    if (isPlaylistPlaying) {
        playlistAudio.pause();
        isPlaylistPlaying = false;
        updateWindowState();
        syncAllUI();
        return;
    }

    if (!playlistAudio.getAttribute('src') && Array.isArray(playlistData) && playlistData.length > 0) {
        loadTrack(0);
        return;
    }

    playCurrentSource();
}

function updatePhoneProgress() {
    const progressBar = document.getElementById('phone-progress');
    const progressHandle = document.getElementById('phone-progress-handle');
    const curTimeEl = document.getElementById('phone-current-time');
    const totTimeEl = document.getElementById('phone-total-time');

    if (!playlistAudio || !Number.isFinite(playlistAudio.duration) || playlistAudio.duration <= 0) {
        if (progressBar) progressBar.style.width = '0%';
        if (progressHandle) progressHandle.style.left = '0%';
        if (curTimeEl) curTimeEl.textContent = '0:00';
        if (totTimeEl) totTimeEl.textContent = '0:00';
        return;
    }

    const pct = (playlistAudio.currentTime / playlistAudio.duration) * 100;
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressHandle) progressHandle.style.left = pct + '%';
    if (curTimeEl) curTimeEl.textContent = formatTime(playlistAudio.currentTime);
    if (totTimeEl) totTimeEl.textContent = formatTime(playlistAudio.duration);
}

function seekPlaylistAudio(clientX) {
    const bar = document.getElementById('phone-progress-bar');
    if (!bar || !playlistAudio || !Number.isFinite(playlistAudio.duration) || playlistAudio.duration <= 0) return;

    const rect = bar.getBoundingClientRect();
    const x = (typeof clientX === 'number') ? clientX - rect.left : 0;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    playlistAudio.currentTime = percent * playlistAudio.duration;
}

function getPointerClientX(event) {
    if (event && typeof event.clientX === 'number') return event.clientX;
    return null;
}

function stopProgressDrag() {
    if (!isProgressDragging) return;
    isProgressDragging = false;

    const bar = document.getElementById('phone-progress-bar');
    if (bar) bar.classList.remove('dragging');
}

function handleProgressDragMove(event) {
    if (!isProgressDragging) return;

    const clientX = getPointerClientX(event);
    if (typeof clientX !== 'number') return;

    event.preventDefault();
    seekPlaylistAudio(clientX);
    updatePhoneProgress();
}

function startProgressDrag(event) {
    const clientX = getPointerClientX(event);
    if (typeof clientX !== 'number') return;

    const bar = document.getElementById('phone-progress-bar');
    isProgressDragging = true;
    if (bar) bar.classList.add('dragging');

    event.preventDefault();
    seekPlaylistAudio(clientX);
    updatePhoneProgress();
}

function setupProgressBarInteractions() {
    const bar = document.getElementById('phone-progress-bar');
    if (!bar || bar.dataset.dragReady === '1') return;

    bar.dataset.dragReady = '1';
    bar.addEventListener('pointerdown', startProgressDrag);
    window.addEventListener('pointermove', handleProgressDragMove);
    window.addEventListener('pointerup', stopProgressDrag);
    window.addEventListener('pointercancel', stopProgressDrag);
}

function getRepeatButton() {
    return document.querySelector('.lp-controls button[onclick*="toggleRepeat"]');
}

function syncRepeatButton() {
    const btn = getRepeatButton();
    if (!btn) return;

    btn.classList.remove('active');
    btn.classList.remove('repeat-one');
    btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';

    if (repeatMode === 1) {
        btn.classList.add('active');
    } else if (repeatMode === 2) {
        btn.classList.add('active');
        btn.classList.add('repeat-one');
    }
}

function initSoundwaveForMovies() {
    if (typeof Soundwave === 'undefined' || !playlistAudio) return;
    const container = document.getElementById('lp-soundwave');
    if (!container) return;

    if (window.soundwaveInstance && typeof window.soundwaveInstance.destroy === 'function') {
        window.soundwaveInstance.destroy();
        window.soundwaveInstance = null;
    }

    const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1200px)').matches;
    const isSmallMobile = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 440px)').matches;
    const innerRadius = isDesktop ? 132 : (isSmallMobile ? 75 : 85);

    window.soundwaveInstance = Soundwave.create(container, playlistAudio, {
        mode: 'realtime',
        style: {
            layout: 'ring',
            ringStyle: 'spectrum',
            ringCenter: [0.5, 0.5],
            spectrumNumPoints: 100,
            spectrumWaveAmp: 0.1,
            glowBlur: 18,
            spectrumRotationOffset: (22.5 * Math.PI / 180),
            spectrumInnerRadius: innerRadius,
            ripple: false,
            colors: {
                spectrumFillBlue: 'rgba(255, 255, 255, 0.95)',
                spectrumFillGold: 'rgba(255, 255, 255, 0.95)',
                spectrumGlow: 'rgba(255, 255, 255, 0.8)'
            }
        }
    });

    const track = Array.isArray(playlistData) ? playlistData[currentTrackIndex] : null;
    if (track && track.audio && window.soundwaveInstance && typeof window.soundwaveInstance.setTrackUrl === 'function') {
        window.soundwaveInstance.setTrackUrl(track.audio);
    }
}

function renderPlaylistItems() {
    const listContainer = document.getElementById('lp-playlist-list');
    if (!listContainer || !Array.isArray(playlistData)) return;

    listContainer.innerHTML = '';
    const totalTracks = playlistData.length;
    playlistData.forEach((track, i) => {
        const item = document.createElement('div');
        item.className = 'lp-pl-item';
        item.setAttribute('data-track-index', i);
        item.style.setProperty('--stack-z', String(Math.max(1, i + 1)));
        item.style.setProperty('--stack-hover-z', String(totalTracks + 20));
        item.style.setProperty('--stack-active-z', String(totalTracks + 10));
        item.onclick = () => loadTrack(i);

        const thumbImg = document.createElement('img');
        thumbImg.className = 'lp-pl-thumb';
        thumbImg.src = track.cover || 'covers/earth_johan.png';
        thumbImg.alt = track.title ? track.title + ' thumbnail' : 'playlist thumbnail';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'lp-pl-text';

        const metaDiv = document.createElement('div');
        metaDiv.className = 'lp-pl-meta';

        const numberSpan = document.createElement('span');
        numberSpan.className = 'lp-pl-num';
        numberSpan.innerText = String(i + 1).padStart(2, '0');

        const titleDiv = document.createElement('div');
        titleDiv.className = 'lp-pl-title';
        titleDiv.innerText = track.title || '';

        const artistDiv = document.createElement('div');
        artistDiv.className = 'lp-pl-artist';
        artistDiv.innerText = track.artist || '';

        metaDiv.appendChild(numberSpan);
        metaDiv.appendChild(titleDiv);
        infoDiv.appendChild(metaDiv);
        infoDiv.appendChild(artistDiv);
        item.appendChild(thumbImg);
        item.appendChild(infoDiv);
        listContainer.appendChild(item);
    });
}

function initPlaylist() {
    if (isPlaylistInitialized) return;
    isPlaylistInitialized = true;

    playlistAudio = document.getElementById('tv-audio-player');
    if (!playlistAudio) {
        console.error('Audio element #tv-audio-player not found!');
        return;
    }

    playlistAudio.addEventListener('timeupdate', updatePhoneProgress);
    playlistAudio.addEventListener('loadedmetadata', updatePhoneProgress);
    playlistAudio.addEventListener('ended', () => {
        if (repeatMode === 2) {
            playlistAudio.currentTime = 0;
            playCurrentSource();
            return;
        }
        if (repeatMode === 1) {
            nextTrack();
            return;
        }
        if (currentTrackIndex < playlistData.length - 1) {
            nextTrack();
            return;
        }
        isPlaylistPlaying = false;
        updateWindowState();
        syncAllUI();
    });
    playlistAudio.addEventListener('play', () => {
        isPlaylistPlaying = true;
        updateWindowState();
        syncAllUI();
    });
    playlistAudio.addEventListener('pause', () => {
        isPlaylistPlaying = false;
        updateWindowState();
        syncAllUI();
    });

    renderPlaylistItems();
    initSoundwaveForMovies();
    setupProgressBarInteractions();

    if (Array.isArray(playlistData) && playlistData.length > 0) {
        const firstTrack = playlistData[0];
        playlistAudio.src = encodeURI(firstTrack.audio);
        playlistAudio.load();
        syncLPPlayer(firstTrack);
        syncPlaylistActive();
        updatePhoneProgress();
    }

    syncRepeatButton();
}

window.initPlaylist = initPlaylist;
window.prevTrack = prevTrack;
window.nextTrack = nextTrack;
window.togglePlaylistAudio = togglePlaylistAudio;
window.seekPlaylistAudio = seekPlaylistAudio;
window.toggleRepeat = function () {
    repeatMode = (repeatMode + 1) % 3;
    syncRepeatButton();
};

window.toggleShuffle = function () {
    isShuffle = !isShuffle;
    const btn = document.querySelector('.lp-ctrl-side i.fa-shuffle')?.parentElement;
    if (!btn) return;

    if (isShuffle) btn.classList.add('active');
    else btn.classList.remove('active');
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPlaylist);
} else {
    initPlaylist();
}
