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
const visualizer = new VisualizerController();
let musicIndex = 0;
let shuffleOn = false;
let uploadProgress = { total: 0 };
let heroSearchTerm = '';
const ARCHIVE_TARGET_TOTAL_VOICES = 10080;
const MUSIC_PLAYLIST = (window.MUSIC_PLAYLIST && window.MUSIC_PLAYLIST.length)
    ? window.MUSIC_PLAYLIST
    : [
        { src: "music/Janet Suhh (자넷서)-01-Us, in Memories.mp3", title: "Us, in Memories" },
        { src: "music/LUCY-01-Light UP.mp3", title: "Light UP" },
        { src: "music/엔플라잉 (N.Flying)-01-Chance.mp3", title: "Chance" },
        { src: "music/용훈 (ONEWE)-01-이음선(TIMELORD) (Narr. 온달).mp3", title: "이음선(TIMELORD)" },
        { src: "music/하람-01-Remember the days.mp3", title: "Remember the days" },
        { title: "빛의 시작(My First Light)", artist: "수안 (퍼플키스)", src: "music/수안 (퍼플키스)-01-빛의 시작(My First Light).mp3"},
        { title: "Chance (Inst.)", artist: "엔플라잉 (N.Flying)", src: "music/엔플라잉 (N.Flying)-03-Chance (Inst.).mp3"},
        { title: "Eternal Bloom (Korean Version)", artist: "윤마치 (MRCH)", src: "music/윤마치 (MRCH)-01-Eternal Bloom (Korean Version).mp3"},
    ];
const PATCH_NOTES = (window.PATCH_NOTES && window.PATCH_NOTES.length)
    ? window.PATCH_NOTES
    : [
        {
            id: "2026-02-15",
            title: "미보유 영웅 목록: 도움 요청",
            date: "2026-02-15",
            body: [
                "대지 즈라한",
                "빛 즈라한",
                "불 즈라한",
                "물 즈라한",
                "빛 슈나이더",
                "어둠 슈나이더",
                "불 시프리에드",
                "어둠 스칼렌",
                "물 라우젤릭",
                "어둠 루인",
                "빛 로잔나",
                "대지 린",
                "빛 라샤드",
                "물 라샤드",
                "불 리카르도",
                "물 리카르도",
                "대지 오스왈드",
                "어둠 올가",
                "빛 라플라스",
                "물 라플라스",
                "대지 조슈아",
                "어둠 이카테스톨",
                "불 헬가",
                "어둠 프람",
                "어둠 크롬",
                "대지 카를 3세",
                "물 비앙카",
                "불 비앙카",
                "불 바레타",
                "대지 아슬란",
                "대지 아란",
                "물 아란",
                "",
                "위 영웅들 중 최애가 있다면 꼭 hyeya4847@gmail.com 으로 보내 주세요!",
                "확보 완료된 영웅은 혼동을 방지하기 위해 삭제합니다."
            ].join("\n")
        },
        {
            id: "2026-02-15",
            title: "02.15 개발자 노트",
            date: "2026-02-15",
            body: [
                "- 상단바 우측에 개발자 노트 추가",
                "- 오디오 비주얼라이저 추가: 인게임보다 더 있어 보이고 싶었습니다.",
                "- 일부 대사 부분 추가, 영웅 리스트업. 대사도 추가 예정.",
                "\n- [대지] 온달, [어둠] 온달 '영웅 화면' 대사 업데이트\n온달들에게 일단 너희라도 열심히 떠들어 두라고 말해 두었습니다. \n한 명은 조금 토라진 것 같기는 하지만 크게 신경 쓰일 정도는 아닙니다."
            ].join("\n")
        },
        {
            id: "2026-02-14",
            title: "02.14 개선사항",
            date: "2026-02-14",
            body: [
                "- 음악 재생바 안정성 개선",
                "- 모바일에서 진행바 숨김 처리"
            ].join("\n")
        }
    ];
function isMobile(){
    return window.matchMedia('(max-width: 900px)').matches;
}

function init() {
    renderHeroList();
    initHeroSearch();
    initMobileHeroSearchToggle();
    initHeroArrows();
    if (HERO_DATA.length > 0) {
        selectHero(HERO_DATA[0].id);
    }
    initReceiptWidget();
    setTimeout(() => {
        initMusicBar();
        initIntro();
        initUploadProgress();
        initContextGuard();
        initPatchNotes();
    }, 0);
}

// 1. Render Hero List (Left Column)
    function normalizeText(text){
        return String(text||'').toLowerCase();
    }
    function heroMatchesKeyword(hero, rawKeyword){
        if (!hero) return false;
        const keyword = normalizeText(rawKeyword.trim());
        if (!keyword) return true;
        const nameKo = normalizeText(hero.name);
        const idText = normalizeText(hero.id);
        const segments = idText.split('_');
        const matchKoPrefix = nameKo.startsWith(keyword);
        const matchEnPrefix = segments.some(seg=>seg.startsWith(keyword));
        return matchKoPrefix || matchEnPrefix;
    }
    function getFilteredHeroes(){
        const keywordRaw = heroSearchTerm;
        const keyword = normalizeText(keywordRaw.trim());
        if (!keyword) return HERO_DATA.slice();
        return HERO_DATA.filter(hero=>heroMatchesKeyword(hero, keywordRaw));
    }
    function applyHeroFilter(){
        const keywordRaw = heroSearchTerm;
        const hexes = heroListEl.querySelectorAll('.hex-container');
        hexes.forEach(el=>{
            const heroId = el.dataset.id;
            const hero = HERO_DATA.find(h=>h.id === heroId);
            const match = heroMatchesKeyword(hero, keywordRaw);
            el.style.display = match ? '' : 'none';
        });
    }
    function initHeroSearch(){
        const inputs = [
            document.getElementById('heroSearchInput'),
            document.getElementById('heroSearchInputMobile')
        ].filter(Boolean);
        if (!inputs.length) return;
        function syncAndFilter(active){
            heroSearchTerm = active.value;
            inputs.forEach(el=>{
                if (el!==active && el.value!==heroSearchTerm) el.value = heroSearchTerm;
            });
            applyHeroFilter();
        }
        inputs.forEach(input=>{
            input.addEventListener('input', ()=>{
                syncAndFilter(input);
            });
        });
    }
    function initMobileHeroSearchToggle(){
        const btn = document.getElementById('mbHeroSearch');
        const bar = document.getElementById('mbHeroSearchBar');
        const input = document.getElementById('heroSearchInputMobile');
        if (!btn || !bar || !input) return;
        function open(){
            bar.classList.add('open');
            setTimeout(()=>{
                input.focus();
            },10);
        }
        function close(){
            bar.classList.remove('open');
        }
        btn.addEventListener('click', ()=>{
            const isOpen = bar.classList.contains('open');
            if (isOpen) close(); else open();
        });
    }
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

            if (currentHero && currentHero.id === hero.id) {
                hexContainer.classList.add('active');
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
        if (!document.getElementById('uploadProgressDesktop')) {
            const d = document.createElement('div');
            d.id = 'uploadProgressDesktop';
            d.className = 'upload-progress';
            d.innerHTML = `<div class="upload-progress-text"></div><div class="upload-progress-bar"><div class="upload-progress-bar-fill"></div></div>`;
            document.body.appendChild(d);
        }
    }
    function renderUploadProgress(){
        const ui = isMobile() ? document.getElementById('mobileProgress') : document.getElementById('uploadProgressDesktop');
        if (!ui) return;
        const textEl = ui.querySelector('.upload-progress-text');
        const barFill = ui.querySelector('.upload-progress-bar-fill');
        const total = uploadProgress.total;
        const loaded = computeUploadedCount();
        const rawPct = total ? (loaded/total)*100 : 0;
        const pct = Math.round(rawPct * 100) / 100;
        const pctText = pct.toFixed(2);
        if (textEl) textEl.textContent = `data uploaded in progress … ${loaded}/${total} (${pctText}%)`;
        if (barFill) barFill.style.width = `${pct}%`;
    }
    function initUploadProgress(){
        uploadProgress.total = ARCHIVE_TARGET_TOTAL_VOICES;
        ensureFooterProgress();
        renderUploadProgress();
    }
    function initPatchNotes(){
        const btn = document.getElementById('mbPatch');
        const overlay = document.getElementById('patchModal');
        const content = document.getElementById('patchContent');
        const btnClose = document.getElementById('patchClose');
        if (!btn || !overlay || !content) return;
        function open(){
            overlay.classList.add('open');
            renderPatchList();
        }
        function close(){
            overlay.classList.remove('open');
            content.innerHTML = '';
        }
        function renderPatchList(){
            content.innerHTML = '<div class="patch-list"></div>';
            const listEl = content.querySelector('.patch-list');
            PATCH_NOTES.forEach(note=>{
                const item = document.createElement('div');
                item.className = 'patch-list-item';
                item.dataset.id = note.id;
                item.innerHTML = `
                    <div class="pli-title">${note.title}</div>
                    <div class="pli-date">${note.date||''}</div>
                `;
                item.addEventListener('click', ()=>{
                    renderPatchDetail(note);
                });
                listEl.appendChild(item);
            });
        }
        function renderPatchDetail(note){
            content.innerHTML = `
                <div class="patch-detail">
                    <div class="patch-detail-title">${note.title}</div>
                    <div class="patch-detail-body">${note.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                </div>
            `;
        }
        btn.addEventListener('click', open);
        btn.addEventListener('pointerup', open);
        btn.addEventListener('touchend', (e)=>{ e.preventDefault(); open(); }, { passive: false });
        if (btnClose) btnClose.addEventListener('click', close);
        overlay.addEventListener('click', (e)=>{
            if (e.target === overlay) close();
        });
        document.addEventListener('keydown', (e)=>{
            if (e.key === 'Escape') close();
        });
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

        bgAudio.volume = 0.25;
        audio.volume = 1;

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
        
        let entered = false;
        function enter(){
            if (entered) return;
            entered = true;

            if (!bgAudio.src && MUSIC_PLAYLIST.length){
                const cur = MUSIC_PLAYLIST[0];
                bgAudio.src = cur.src;
            }
            bgAudio.play().catch(()=>{});
            
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 800);
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
        visualizer.preloadVoices(currentHero.voices).catch(()=>{});
        
        // Auto-select first voice? (Optional, let's wait for user interaction)
         if (currentHero.voices.length > 0) {
             selectVoice(currentHero.voices[0].id);
         }
    }

    function renderVoiceList(hero) {
        const container = voiceListEl.querySelector('.voice-list-inner') || voiceListEl;
        container.innerHTML = `<div class="section-title">Voice Records | ${hero.name}</div><div class="voice-scroll"></div>`;
        const scrollEl = container.querySelector('.voice-scroll');

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
                if (!playingId || playingId !== voice.id) {
                    visualizer.playVoice(voice).then(()=>{
                        if (playingId && playingId!==voice.id) {
                            const prevItem = document.querySelector(`.voice-list-section .voice-item[data-id="${playingId}"]`);
                            if (prevItem) prevItem.classList.remove('playing');
                        }
                        playingId = voice.id;
                        voiceItem.classList.add('playing');
                    }).catch(()=>{
                        voiceItem.classList.remove('playing');
                    });
                } else {
                    visualizer.stop();
                    voiceItem.classList.remove('playing');
                    playingId = null;
                }
            });

            scrollEl.appendChild(voiceItem);
        });

        visualizer.onEnded = ()=>{
            if (playingId) {
                const prevItem = document.querySelector(`.voice-list-section .voice-item[data-id="${playingId}"]`);
                if (prevItem) prevItem.classList.remove('playing');
            }
            playingId = null;
        };
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
                    <div class="quote-meta">열심히 녹음 중입니다.<br>영웅이 조금 부끄러워 하는 것 같습니다.</div>
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
        
                <div class="char-title">
                    <span class="char-name" style="background: linear-gradient(180deg, #fff, ${accentColor}); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                        ${currentHero.name}
                    </span>
                    ${currentHero.title ? `<span class="char-title-sub" style="color:${accentColor};">${currentHero.title}</span>` : ''}
                </div>
                <div class="quote-text" style="border-left-color: ${accentColor}">
                    "${voice.transcript}"
                </div>
                <div class="quote-visualizer"><canvas></canvas></div>
                <div class="quote-meta" style="color: ${accentColor}">
                    ${voice.label} | ${currentHero.element.toUpperCase()}
                </div>
            </div>
        `;
        const canvas = transcriptEl.querySelector('.quote-visualizer canvas');
        visualizer.setAccent(accentColor);
        visualizer.attachCanvas(canvas);
        ensureFooterProgress();
        renderUploadProgress();
    }

    const RECEIPT_ELEMENT_LABELS = {
        fire: "불",
        water: "물",
        earth: "대지",
        light: "빛",
        dark: "어둠"
    };
    const RECEIPT_INGREDIENTS_RANDOM = [
        { label: "루인이 건넨 커피 ..." },
        { label: "훈련장의 온도..." },
        { label: "루인의 잔소리..." },
        { label: "기물 파손..." },
        { label: "오벨리스크의 환영..." },
        { label: "재앙의 숨결..." },
        { label: "모스레간테의 불꽃..." },
        { label: "해신의 비늘..." },
        { label: "인연의 돌...." },
        { label: "삼거리 제과점의 좋은 냄새..." },
        { label: "바네사의 음악 소리...." },
        { label: "8-16 황제가 맞은 횟수... nnnn회", unit: "회", min: 1000, max: 9999 },
        { label: "당신이 악몽에 주차한 기간... nn일", unit: "일", min: 3, max: 365 },
        { label: "카를 3세의 허세...", unit: "%", min: 100, max: 9999 },
        { label: "조슈아의 휴가신청서 반려 횟수... nn번", unit: "번", min: 3, max: 999 },
        { label: "여행자가 넘어진 횟수 .... nnn회", unit: "회", min: 10, max: 999 },
        { label: "미리안드의 차단마법 ... nnn회", unit: "회", min: 10, max: 999 },
        { label: "온달이 '가우리'라고 말한 횟수... nnnn회", unit: "회", min: 1000, max: 9999 },
        { label: "시프리에드의 잔소리..." },
        { label: "요한이 좋아하는 맥주..." },
        { label: "프라우의 메타발언... nnn회", unit: "회", min: 10, max: 999 },
        { label: "프람의 감자 포타주..." },
        { label: "정령의 기운..." },
        { label: "가시나무의 탄의 위력..." },
        { label: "나인의 흑염룡..." },
        { label: "루미에의 수다..." },
        { label: "바레타의 로열 스트레이트 플래쉬..." },
        { label: "사르디나 여관의 아침..." }
    ];
    function initReceiptWidget(){
        const root = document.getElementById('receiptWidget');
        if (!root) return;
        root.classList.add('hidden');
        const quoteEl = document.getElementById('receiptQuote');
        const heroEl = document.getElementById('receiptHeroMeta');
        const ingEl = document.getElementById('receiptIngredients');
        const serialEl = document.getElementById('receiptSerial');
        if (!quoteEl || !heroEl || !ingEl || !serialEl) return;

        const pool = buildHeroVoicePool();
        function fill(){
            const pair = pool.length ? pickRandom(pool) : null;
            if (pair && pair.hero && pair.voice) {
                quoteEl.textContent = `"${pair.voice.transcript}"`;
                const elementLabel = RECEIPT_ELEMENT_LABELS[pair.hero.element] || pair.hero.element || "";
                heroEl.textContent = elementLabel ? `${pair.hero.name} / ${elementLabel}` : pair.hero.name;
            } else {
                quoteEl.textContent = '"..."';
                heroEl.textContent = "영웅 데이터 없음";
            }
            const ingredients = pickRandomIngredients();
            ingEl.innerHTML = "";
            ingredients.forEach(item=>{
                const row = document.createElement('div');
                row.className = 'receipt-ingredient-item';
                const labelSpan = document.createElement('span');
                labelSpan.className = 'receipt-ingredient-label';
                labelSpan.textContent = cleanReceiptLabel(item.label);
                const valueSpan = document.createElement('span');
                valueSpan.className = 'receipt-ingredient-data';
                valueSpan.textContent = "· " + buildIngredientValue(item);
                row.appendChild(labelSpan);
                row.appendChild(valueSpan);
                ingEl.appendChild(row);
            });
            getGlobalReceiptVisitCount().then(count=>{
                const serial = formatSerialNumber(count);
                serialEl.textContent = `일련번호 ${serial}`;
                const barcodeEl = document.getElementById('receiptBarcode');
                if (barcodeEl) barcodeEl.textContent = `*${serial}*`;
            });
        }

        const toggleBtn = document.getElementById('receiptToggle');
        if (toggleBtn) {
            let open = false;
            function sync(){
                root.classList.toggle('hidden', !open);
                toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
            }
            toggleBtn.addEventListener('click', ()=>{
                open = !open;
                if (open) fill();
                sync();
            });
            root.addEventListener('click',(e)=>{
                if (e.target === root){
                    open = false;
                    sync();
                }
            });
            sync();
        }
    }
    function buildHeroVoicePool(){
        const pool = [];
        if (!Array.isArray(HERO_DATA)) return pool;
        HERO_DATA.forEach(hero=>{
            const voices = hero && Array.isArray(hero.voices) ? hero.voices : [];
            voices.forEach(voice=>{
                pool.push({ hero, voice });
            });
        });
        return pool;
    }
    function pickRandom(list){
        if (!Array.isArray(list) || !list.length) return null;
        const index = Math.floor(Math.random()*list.length);
        return list[index];
    }
    function pickRandomIngredients(){
        const base = { label: "충성심", fixed: "5000%" };
        const pool = RECEIPT_INGREDIENTS_RANDOM.slice();
        const selected = [];
        while (pool.length && selected.length < 4){
            const index = Math.floor(Math.random()*pool.length);
            selected.push(pool.splice(index,1)[0]);
        }
        return [base].concat(selected);
    }
    function buildIngredientValue(item){
        if (!item) return "";
        if (item.fixed) return item.fixed;
        const min = typeof item.min === "number" ? item.min : 50;
        const max = typeof item.max === "number" ? item.max : 5000;
        const value = Math.floor(Math.random()*(max-min+1))+min;
        const unit = item.unit || "%";
        return String(value)+unit;
    }
    function cleanReceiptLabel(text){
        if (typeof text !== "string") return "";
        let t = text;
        // 예시로 넣어둔 "... nnn회" 같은 패턴은 통째로 제거
        t = t.replace(/\s*\.{2,}\s*n{2,4}(회|일|번)/g, "");
        // 끝에 달린 "..." 도 제거
        t = t.replace(/\s*\.{2,}\s*$/g, "");
        t = t.replace(/\s+/g," ").trim();
        return t;
    }
    function getReceiptVisitCount(){
        const key = "loh_receipt_visit_count";
        try {
            const raw = window.localStorage.getItem(key);
            const current = raw ? parseInt(raw,10)||0 : 0;
            const next = current + 1;
            window.localStorage.setItem(key, String(next));
            return next;
        } catch (e){
            return 1;
        }
    }
    function getGlobalReceiptVisitCount(){
        if (typeof firebase !== "object" || !firebase || typeof firebase.database !== "function") {
            return Promise.resolve(1);
        }
        try {
            const db = firebase.database();
            const ref = db.ref("receiptCount");
            return new Promise(resolve=>{
                ref.transaction(currentValue=>{
                    return (currentValue || 0) + 1;
                }, (error, committed, snapshot)=>{
                    if (error || !committed || !snapshot) {
                        resolve(1);
                        return;
                    }
                    const value = snapshot.val();
                    const num = typeof value === "number" && isFinite(value) ? value : 1;
                    resolve(num);
                });
            });
        } catch (e){
            return Promise.resolve(1);
        }
    }
    function formatSerialNumber(count){
        const base = "20250214-";
        const safe = typeof count === "number" && isFinite(count) ? count : 1;
        const padded = String(safe).padStart(8,"0");
        return base + padded;
    }

    function initReceiptDownload(){
        const btn = document.getElementById('receiptDownloadBtn');
        const paper = document.querySelector('.receipt-paper');
        if (!btn || !paper) return;
        btn.addEventListener('click', ()=>{
            if (typeof html2canvas !== "function") return;
            html2canvas(paper, {
                backgroundColor: "#ffffff",
                scale: window.devicePixelRatio || 1
            }).then(canvas=>{
                canvas.toBlob(blob=>{
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'loh-entry-permit.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            });
        });
    }

init();
initReceiptDownload();
