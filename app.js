document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const heroListEl = document.querySelector('.hero-list');
    const voiceListEl = document.querySelector('.voice-list-section');
    const transcriptEl = document.querySelector('.transcript-section');
    
    // State
    let currentHero = null;
    let currentVoice = null;
    let playingId = null;
    const audio = new Audio();
    const bgAudio = new Audio();
    let musicIndex = 0;
    let shuffleOn = false;
    let uploadProgress = { total: 0 };
    const ARCHIVE_TARGET_HEROES = 187;
    const ARCHIVE_TARGET_VOICES_PER_HERO = 35;
    const MUSIC_PLAYLIST = (window.MUSIC_PLAYLIST && window.MUSIC_PLAYLIST.length)
        ? window.MUSIC_PLAYLIST
        : [
            { src: "music/Janet Suhh (자넷서)-01-Us, in Memories.mp3", title: "Us, in Memories" },
            { src: "music/LUCY-01-Light UP.mp3", title: "Light UP" },
            { src: "music/엔플라잉 (N.Flying)-01-Chance.mp3", title: "Chance" },
            { src: "music/용훈 (ONEWE)-01-이음선(TIMELORD) (Narr. 온달).mp3", title: "이음선(TIMELORD)" },
            { src: "music/하람-01-Remember the days.mp3", title: "Remember the days" }
        ];
    function isMobile(){
        return window.matchMedia('(max-width: 900px)').matches;
    }

    // Initialize
    init();

    function init() {
        renderHeroList();
        initHeroArrows();
        // Select first hero by default if available
        if (HERO_DATA.length > 0) {
            selectHero(HERO_DATA[0].id);
        }
        initMusicBar();
        initIntro();
        initUploadProgress();
        initContextGuard();
    }

    // 1. Render Hero List (Left Column)
    function renderHeroList() {
        heroListEl.querySelectorAll('.hex-container').forEach(el=>el.remove());

        HERO_DATA.forEach(hero => {
            const hexContainer = document.createElement('div');
            hexContainer.className = 'hex-container';
            hexContainer.dataset.id = hero.id;
            
            // Element color override (optional)
            const elStyle = ELEMENT_STYLES[hero.element];
            const glowColor = elStyle ? elStyle.color : '#89c4f4';

            const hasImage = hero.image && String(hero.image).trim().length > 0;
            hexContainer.innerHTML = `
                <div class="hex-shape">
                    ${hasImage ? `<img class="hex-img" src="${hero.image}" alt="${hero.name}">` : `<div class="hex-img" style="background: ${glowColor};"></div>`}
                </div>
            `;

            const imgEl = hexContainer.querySelector('.hex-img');
            if (imgEl && imgEl.tagName === 'IMG') {
                imgEl.addEventListener('error', () => {
                    const fallback = document.createElement('div');
                    fallback.className = 'hex-img';
                    fallback.style.background = glowColor;
                    imgEl.replaceWith(fallback);
                });
            }

            hexContainer.addEventListener('click', () => {
                selectHero(hero.id);
            });

            heroListEl.appendChild(hexContainer);
        });
    }

    function computeUploadedCount(){
        let count = 0;
        HERO_DATA.forEach(h=>{
            count += (h.voices||[]).length;
        });
        return count;
    }
    function ensureFooterProgress(){
        const bottom = document.querySelector('.bottom-footer');
        if (bottom && !document.getElementById('footerProgress')) {
            const m = document.createElement('div');
            m.id = 'footerProgress';
            m.className = 'upload-progress';
            m.innerHTML = `<div class="upload-progress-text"></div><div class="upload-progress-bar"><div class="upload-progress-bar-fill"></div></div>`;
            bottom.appendChild(m);
        }
        if (transcriptEl && !document.getElementById('uploadProgressDesktop')) {
            const d = document.createElement('div');
            d.id = 'uploadProgressDesktop';
            d.className = 'upload-progress';
            d.innerHTML = `<div class="upload-progress-text"></div><div class="upload-progress-bar"><div class="upload-progress-bar-fill"></div></div>`;
            transcriptEl.appendChild(d);
        }
    }
    function renderUploadProgress(){
        const ui = isMobile() ? document.getElementById('footerProgress') : document.getElementById('uploadProgressDesktop');
        if (!ui) return;
        const textEl = ui.querySelector('.upload-progress-text');
        const barFill = ui.querySelector('.upload-progress-bar-fill');
        const total = uploadProgress.total;
        const loaded = computeUploadedCount();
        const pct = total ? Math.round((loaded/total)*100) : 0;
        if (textEl) textEl.textContent = `data uploaded in progress … ${loaded}/${total} (${pct}%)`;
        if (barFill) barFill.style.width = `${pct}%`;
    }
    function initUploadProgress(){
        uploadProgress.total = ARCHIVE_TARGET_HEROES * ARCHIVE_TARGET_VOICES_PER_HERO;
        ensureFooterProgress();
        renderUploadProgress();
    }
    window.addEventListener('resize', renderUploadProgress);
    function initHeroArrows(){
        const left = document.querySelector('.hero-arrow-left');
        const right = document.querySelector('.hero-arrow-right');
        function scroll(by){
            heroListEl.scrollBy({ left: by, behavior: 'smooth' });
        }
        if (left) left.addEventListener('click', ()=>scroll(-160));
        if (right) right.addEventListener('click', ()=>scroll(160));
    }

    function initContextGuard(){
        document.addEventListener('contextmenu', (e)=>{
            e.preventDefault();
        });
    }
    function initMusicBar(){
        const btnPlay = document.getElementById('mbPlay');
        const btnShuffle = document.getElementById('mbShuffle');
        const btnList = document.getElementById('mbList');
        const titleEl = document.getElementById('mbTitle');
        const acc = document.getElementById('mbAccordion');
        const listBody = document.getElementById('mbListBody');
        const progressWrap = document.getElementById('mbProgressWrap');
        const progressEl = document.getElementById('mbProgress');
        const timeEl = document.getElementById('mbTime');

        bgAudio.volume = 0.35;
        audio.volume = 0.9;

        function fmtTime(s){
            if (!isFinite(s)) return '00:00';
            const m = Math.floor(s/60);
            const sec = Math.floor(s%60);
            return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
        }

        function setTitle(){
            if (!MUSIC_PLAYLIST.length) {
                titleEl.textContent = '재생할 곡을 선택하세요';
                return;
            }
            const cur = MUSIC_PLAYLIST[musicIndex];
            titleEl.textContent = cur.title || cur.src || 'Unknown';
        }
        function load(index){
            if (!MUSIC_PLAYLIST.length) return;
            musicIndex = (index+MUSIC_PLAYLIST.length)%MUSIC_PLAYLIST.length;
            const cur = MUSIC_PLAYLIST[musicIndex];
            bgAudio.src = cur.src;
            setTitle();
            highlightList();
            timeEl.textContent = '00:00 / 00:00';
            progressEl.style.width = '0%';
        }
        function play(){
            bgAudio.play().then(()=>{
                btnPlay.classList.add('playing');
            }).catch(()=>{
                btnPlay.classList.remove('playing');
            });
        }
        function pause(){
            bgAudio.pause();
            btnPlay.classList.remove('playing');
        }
        function next(){
            if (shuffleOn && MUSIC_PLAYLIST.length>1){
                let n = musicIndex;
                while(n===musicIndex) n = Math.floor(Math.random()*MUSIC_PLAYLIST.length);
                load(n);
            } else {
                load(musicIndex+1);
            }
            play();
        }
        function renderList(){
            listBody.innerHTML = '';
            MUSIC_PLAYLIST.forEach((t,i)=>{
                const item = document.createElement('div');
                item.className = 'music-item';
                item.dataset.index = String(i);
                item.innerHTML = `<div class="music-item-title">${t.title||t.src}</div>`;
                item.addEventListener('click', ()=>{
                    load(i);
                    play();
                });
                listBody.appendChild(item);
            });
            highlightList();
        }
        function highlightList(){
            document.querySelectorAll('.music-item').forEach(el=>{
                el.classList.toggle('active', Number(el.dataset.index)===musicIndex);
            });
        }

        btnPlay.addEventListener('click', ()=>{
            if (!MUSIC_PLAYLIST.length) return;
            if (!bgAudio.src) load(0);
            if (bgAudio.paused) play(); else pause();
        });
        btnShuffle.addEventListener('click', ()=>{
            shuffleOn = !shuffleOn;
            btnShuffle.classList.toggle('active', shuffleOn);
        });
        btnList.addEventListener('click', ()=>{
            acc.classList.toggle('open');
        });
        bgAudio.addEventListener('ended', next);
        bgAudio.addEventListener('timeupdate', ()=>{
            const cur = bgAudio.currentTime||0;
            const dur = bgAudio.duration||0;
            const pct = dur? (cur/dur)*100 : 0;
            progressEl.style.width = pct+'%';
            timeEl.textContent = fmtTime(cur)+' / '+fmtTime(dur);
        });
        bgAudio.addEventListener('loadedmetadata', ()=>{
            timeEl.textContent = fmtTime(0)+' / '+fmtTime(bgAudio.duration||0);
        });
        progressWrap.addEventListener('click', (e)=>{
            const rect = progressWrap.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, x/rect.width));
            if (isFinite(bgAudio.duration)) {
                bgAudio.currentTime = pct * bgAudio.duration;
            }
        });

        renderList();
        if (MUSIC_PLAYLIST.length){
            load(0);
            if (!isMobile()){
                bgAudio.play().then(()=>{
                    btnPlay.classList.add('playing');
                }).catch(()=>{
                    btnPlay.classList.remove('playing');
                });
            } else {
                btnPlay.classList.remove('playing');
            }
        } else {
            setTitle();
        }
    }
    function initIntro(){
        const overlay = document.getElementById('introOverlay');
        if (!overlay) return;
        function enter(){
            if (!bgAudio.src && MUSIC_PLAYLIST.length){
                const cur = MUSIC_PLAYLIST[0];
                bgAudio.src = cur.src;
            }
            bgAudio.play().catch(()=>{});
            overlay.remove();
        }
        overlay.addEventListener('touchstart', enter, { once: true });
        overlay.addEventListener('touchend', enter, { once: true });
        overlay.addEventListener('pointerup', enter, { once: true });
        overlay.addEventListener('click', enter, { once: true });
    }
    // 2. Select Hero & Render Voice List (Middle Column)
    function selectHero(heroId) {
        // Update Active State in Hero List
        document.querySelectorAll('.hero-list .hex-container').forEach(el => {
            el.classList.toggle('active', el.dataset.id === heroId);
        });

        // Find Hero Data
        currentHero = HERO_DATA.find(h => h.id === heroId);
        if (!currentHero) return;

        if (!audio.paused) audio.pause();
        playingId = null;
        document.querySelectorAll('.voice-list-section .voice-item.playing').forEach(el=>el.classList.remove('playing'));

        // Render Voice List
        renderVoiceList(currentHero);
        
        // Reset Transcript View
        renderTranscript(null); 
        
        // Auto-select first voice? (Optional, let's wait for user interaction)
         if (currentHero.voices.length > 0) {
             selectVoice(currentHero.voices[0].id);
         }
    }

    function renderVoiceList(hero) {
        voiceListEl.innerHTML = `<div class="section-title">Voice Records | ${hero.name}</div><div class="voice-scroll"></div>`;
        const scrollEl = voiceListEl.querySelector('.voice-scroll');

        hero.voices.forEach(voice => {
            const voiceItem = document.createElement('div');
            voiceItem.className = 'voice-item';
            voiceItem.dataset.id = voice.id;
            
            voiceItem.innerHTML = `
                <div class="play-icon">
                    <svg class="icon icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    <svg class="icon icon-pause" viewBox="0 0 24 24" style="display:none"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
                </div>
                <div class="voice-label">${voice.label}</div>
            `;

            voiceItem.addEventListener('click', () => {
                selectVoice(voice.id);
                if (voice.audio) {
                    if (audio.src !== voice.audio) audio.src = voice.audio;
                    audio.play().then(()=>{
                        if (playingId && playingId!==voice.id) {
                            const prevItem = document.querySelector(`.voice-list-section .voice-item[data-id="${playingId}"]`);
                            if (prevItem) prevItem.classList.remove('playing');
                        }
                        playingId = voice.id;
                        voiceItem.classList.add('playing');
                    }).catch(()=>{
                        voiceItem.classList.remove('playing');
                    });
                }
            });

            scrollEl.appendChild(voiceItem);
        });

        audio.addEventListener('ended', ()=>{
            if (playingId) {
                const prevItem = document.querySelector(`.voice-list-section .voice-item[data-id="${playingId}"]`);
                if (prevItem) prevItem.classList.remove('playing');
            }
            playingId = null;
        });
        audio.addEventListener('pause', ()=>{
            if (playingId) {
                const prevItem = document.querySelector(`.voice-list-section .voice-item[data-id="${playingId}"]`);
                if (prevItem) prevItem.classList.remove('playing');
            }
        });
    }

    // 3. Select Voice & Render Transcript (Right Column)
    function selectVoice(voiceId) {
        if (!currentHero) return;

        // Update Active State in Voice List
        document.querySelectorAll('.voice-list-section .voice-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === voiceId);
        });

        currentVoice = currentHero.voices.find(v => v.id === voiceId);
        renderTranscript(currentVoice);
    }

    function renderTranscript(voice) {
        if (!voice) {
            // Empty State
            transcriptEl.innerHTML = `
                <div class="quote-sheet" style="opacity:0.5; min-height: 200px; display:flex; align-items:center; justify-content:center;">
                    <div class="corner-deco c-tl"></div>
                    <div class="corner-deco c-tr"></div>
                    <div class="corner-deco c-bl"></div>
                    <div class="corner-deco c-br"></div>
                    <div class="quote-meta">Select a voice record</div>
                </div>
            `;
            renderUploadProgress();
            return;
        }

        // Element-specific accent color
        const elStyle = ELEMENT_STYLES[currentHero.element];
        const accentColor = elStyle ? elStyle.color : '#89c4f4';

        transcriptEl.innerHTML = `
            <div class="quote-sheet">
                <div class="corner-deco c-tl" style="border-color: ${accentColor}"></div>
                <div class="corner-deco c-tr" style="border-color: ${accentColor}"></div>
                <div class="corner-deco c-bl" style="border-color: ${accentColor}"></div>
                <div class="corner-deco c-br" style="border-color: ${accentColor}"></div>

                <div class="char-title" style="background: linear-gradient(180deg, #fff, ${accentColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                    ${currentHero.name}
                </div>
                <div class="quote-text" style="border-left-color: ${accentColor}">
                    "${voice.transcript}"
                </div>
                <div class="quote-meta" style="color: ${accentColor}">
                    ${voice.label} | ${currentHero.element.toUpperCase()}
                </div>
                <!-- Hidden Audio Element for Playback -->
                <!-- <audio src="${voice.audio}" autoplay></audio> --> 
            </div>
        `;
        ensureFooterProgress();
        renderUploadProgress();
    }
});
