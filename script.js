// ============================================================
//  설정 — 구글 시트 연결 시 이 부분만 수정하세요
// ============================================================

const CONFIG = {
    // 접수현황 탭 CSV URL
    CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB1FtRSqIlxFCrLI5wwTXxIz7HuyAYTFAz4PLwSRA-84W0gYYMy_z2XKhCsQB5I1vZxd5DC5bxoWRW/pub?gid=1047086015&single=true&output=csv',

    // 실제 시트 열 순서 (A=0, B=1 ...)
    COL_NAME:      1,   // B열: 성함
    COL_DATE:      4,   // E열: 날짜
    COL_PLACE:     5,   // F열: 장소
    COL_IMAGE_URL: 7,   // H열: 구글 드라이브 링크
    COL_STORY:     3,   // D열: 사연설명
    COL_BLOCK:     9,   // J열: 차단 여부 (X 입력 시 웹에서 숨김)

    HEADER_ROWS: 1,
};

// ============================================================
//  앱 상태
// ============================================================
let items = [];
let currentIndex = 0;

// ============================================================
//  구글 시트 데이터 가져오기
// ============================================================
async function fetchData() {
    const res = await fetch(CONFIG.CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const csv = await res.text();
    return parseCSV(csv);
}

// ============================================================
//  CSV 파싱
// ============================================================
function parseCSV(csv) {
    const rows = splitCSVIntoRows(csv);
    const result = [];

    for (let i = CONFIG.HEADER_ROWS; i < rows.length; i++) {
        const cols = splitCSVLine(rows[i]);
        const name     = stripQuotes(cols[CONFIG.COL_NAME]      || '');
        const date     = stripQuotes(cols[CONFIG.COL_DATE]       || '');
        const place    = stripQuotes(cols[CONFIG.COL_PLACE]      || '');
        const rawUrl   = stripQuotes(cols[CONFIG.COL_IMAGE_URL]  || '');
        const story    = stripQuotes(cols[CONFIG.COL_STORY]      || '');
        const imageUrl = normalizeDriveUrl(rawUrl);
        const block    = stripQuotes(cols[CONFIG.COL_BLOCK] || '');

        // 이름도 사진도 없으면 빈 행으로 간주하고 건너뜀
        if (!imageUrl && !name) continue;

        // J열에 X 입력 시 차단
        if (block.trim().toUpperCase() === 'X') continue;

        result.push({ name, date, place, imageUrl, story });
    }

    return result;
}

// 따옴표 안의 줄바꿈을 보존하며 CSV를 행으로 분리
function splitCSVIntoRows(csv) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const c = csv[i];
        if (c === '"') {
            if (inQuotes && csv[i + 1] === '"') {
                current += '""';
                i++;
            } else {
                inQuotes = !inQuotes;
                current += c;
            }
        } else if ((c === '\n' || c === '\r') && !inQuotes) {
            if (c === '\r' && csv[i + 1] === '\n') i++;
            if (current.trim()) rows.push(current);
            current = '';
        } else {
            current += c;
        }
    }
    if (current.trim()) rows.push(current);
    return rows;
}

function splitCSVLine(line) {
    const cols = [];
    let cur = '';
    let inQ = false;

    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) {
            cols.push(cur); cur = '';
        } else {
            cur += c;
        }
    }
    cols.push(cur);
    return cols;
}

function stripQuotes(s) {
    return s.replace(/^"|"$/g, '').trim();
}

// ============================================================
//  Google Drive URL 변환
//
//  지원하는 형식:
//  1) 공유 링크: https://drive.google.com/file/d/{ID}/view?...
//     → https://drive.google.com/uc?export=view&id={ID}
//
//  2) 구글 드라이브 폴더 공유에서 직접 복사한 링크도 위와 동일
//
//  주의: 드라이브 파일은 반드시 "링크가 있는 모든 사용자" 공개로
//  설정해야 웹에서 이미지로 로드됩니다.
// ============================================================
function normalizeDriveUrl(url) {
    if (!url) return '';

    // Google Drive 파일 ID 추출
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) {
        // thumbnail API: 모바일에서도 안정적으로 로드됨
        return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
    }

    return url;
}

// ============================================================
//  날짜 포맷 (예: "2026-05-10" → "2026. 5. 10.")
// ============================================================
function formatDate(dateStr) {
    if (!dateStr) return '';
    // 구글 시트가 다양한 형식으로 날짜를 내보낼 수 있으므로 그대로 표시
    return dateStr;
}

// ============================================================
//  갤러리 렌더링
// ============================================================
function renderGallery(data) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = '';

    data.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${item.name || '사진'} 크게 보기`);

        const hasBody = item.name || item.date || item.story || item.place;

        card.innerHTML = `
            ${item.imageUrl ? `
            <div class="card-img-wrap">
                <img
                    src="${escapeHtml(item.imageUrl)}"
                    alt="${escapeHtml(item.name || '')}의 사진"
                    loading="lazy"
                >
            </div>` : `<div class="card-no-img">사진 준비 중</div>`}
            ${hasBody ? `
            <div class="card-body">
                <p class="card-meta">${[item.date, item.place].filter(Boolean).map(escapeHtml).join(' · ')}</p>
                ${item.name  ? `<p class="card-name">${escapeHtml(item.name)}</p>` : ''}
                ${item.story ? `<p class="card-story">${escapeHtml(item.story)}</p>` : ''}
            </div>` : ''}
        `;

        // 이미지 로드 실패 시 이미지 영역만 교체 (카드는 유지)
        const img = card.querySelector('img');
        if (img) {
            img.addEventListener('error', () => {
                img.closest('.card-img-wrap').outerHTML =
                    '<div class="card-no-img">사진을 불러올 수 없습니다</div>';
            });
        }

        card.addEventListener('click', () => openLightbox(index));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(index);
            }
        });

        gallery.appendChild(card);
    });
}

// Fisher-Yates 셔플
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
}

// ============================================================
//  사진 선택 (디자인팀 전달용)
// ============================================================
let selected = new Set(JSON.parse(localStorage.getItem('photo-selected') || '[]'));

function toggleSelect() {
    const key = items[currentIndex].imageUrl;
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    localStorage.setItem('photo-selected', JSON.stringify([...selected]));
    updateSelectBtn();
    updateSelectedFab();
}

function updateSelectBtn() {
    const btn = document.getElementById('lb-select');
    if (!btn) return;
    const isSelected = selected.has(items[currentIndex]?.imageUrl);
    btn.textContent = isSelected ? '★ 선택됨' : '☆ 선택하기';
    btn.classList.toggle('selected', isSelected);
}

function updateSelectedFab() {
    const fab = document.getElementById('btn-selected-fab');
    const countEl = document.getElementById('selected-count');
    const n = selected.size;
    fab.classList.toggle('hidden', n === 0);
    countEl.textContent = n;
}

function showSelectedPanel() {
    const panel = document.getElementById('selected-panel');
    const list  = document.getElementById('sp-list');
    const count = document.getElementById('sp-count');

    const selectedItems = items.filter(it => selected.has(it.imageUrl));
    count.textContent = `(${selectedItems.length}개)`;

    list.innerHTML = selectedItems.map((it, i) => `
        <div class="sp-item">
            <span class="sp-item-num">${i + 1}</span>
            <div class="sp-item-info">
                <p class="sp-item-name">${escapeHtml(it.name || '(이름 없음)')}</p>
                <p class="sp-item-meta">${[it.date, it.place].filter(Boolean).map(escapeHtml).join(' · ')}</p>
                ${it.story ? `<p class="sp-item-story">${escapeHtml(it.story)}</p>` : ''}
            </div>
        </div>
    `).join('');

    panel.classList.remove('hidden');
}

function copySelectedToClipboard() {
    const selectedItems = items.filter(it => selected.has(it.imageUrl));
    const text = [
        `[선택한 사진 — 분당우리교회 창립 24주년 사진전]`,
        `총 ${selectedItems.length}개\n`,
        ...selectedItems.map((it, i) => {
            const lines = [`${i + 1}. ${it.name || '(이름 없음)'}`];
            if (it.date || it.place) lines.push(`   ${[it.date, it.place].filter(Boolean).join(' · ')}`);
            if (it.story) lines.push(`   "${it.story}"`);
            lines.push(`   🔗 ${it.imageUrl}`);
            return lines.join('\n');
        })
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy-selected');
        btn.textContent = '복사 완료! ✓';
        setTimeout(() => { btn.textContent = '클립보드 복사'; }, 2000);
    });
}

// ============================================================
//  라이트박스
// ============================================================
function openLightbox(index) {
    currentIndex = index;
    updateLightbox();
    document.getElementById('lightbox').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('lb-close').focus();
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.body.style.overflow = '';
}

function showPrev() {
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    updateLightbox();
}

function showNext() {
    currentIndex = (currentIndex + 1) % items.length;
    updateLightbox();
}

function updateLightbox() {
    const item = items[currentIndex];

    const img = document.getElementById('lb-img');
    img.src = item.imageUrl;
    img.alt = item.name ? `${item.name}의 사진` : '사진';

    const setEl = (id, text) => {
        const el = document.getElementById(id);
        el.textContent = text || '';
        el.style.display = text ? '' : 'none';
    };

    const meta = [formatDate(item.date), item.place].filter(Boolean).join(' · ');
    setEl('lb-date',  meta);
    setEl('lb-name',  item.name);
    setEl('lb-story', item.story);

    document.getElementById('lb-counter').textContent =
        `${currentIndex + 1} / ${items.length}`;

    updateSelectBtn();
}

// ============================================================
//  유튜브 음악
// ============================================================
const YOUTUBE_VIDEO_ID = 'zMYaL-dosGo';
let ytPlayer = null;
let musicPlaying = false;

// YouTube IFrame API가 준비되면 자동 호출됨
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            fs: 0,
        },
        events: {
            onStateChange: (e) => {
                // 영상 끝나면 처음부터 다시 재생 (loop 파라미터보다 끊김 없음)
                if (e.data === YT.PlayerState.ENDED) {
                    ytPlayer.seekTo(0);
                    ytPlayer.playVideo();
                }
                const btnMusic = document.getElementById('btn-music');
                musicPlaying = e.data === YT.PlayerState.PLAYING;
                btnMusic.textContent = musicPlaying ? '♫' : '♪';
                btnMusic.classList.toggle('active', musicPlaying);
            }
        }
    });
}

function toggleMusic() {
    if (!ytPlayer) return;
    if (musicPlaying) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
}

// ============================================================
//  슬라이드쇼
// ============================================================
const SLIDE_DURATION = 5000; // 5초
let slideshowTimer   = null;
let slideshowActive  = false;

function startSlideshow() {
    if (items.length === 0) return;
    // 기존 타이머 완전히 정리 후 시작
    clearTimeout(slideshowTimer);
    slideshowActive = true;

    if (document.getElementById('lightbox').classList.contains('hidden')) {
        const randomIndex = Math.floor(Math.random() * items.length);
        openLightbox(randomIndex);
    }

    document.getElementById('lb-progress-wrap').classList.add('visible');
    scheduleNext();
}

function stopSlideshow() {
    slideshowActive = false;
    clearTimeout(slideshowTimer);
    document.getElementById('lb-progress-wrap').classList.remove('visible');
    resetProgress();
}

function scheduleNext() {
    // 중복 타이머 방지: 항상 이전 것 먼저 제거
    clearTimeout(slideshowTimer);
    resetProgress();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const bar = document.getElementById('lb-progress-bar');
            bar.classList.add('animate');
            bar.style.transitionDuration = SLIDE_DURATION + 'ms';
            bar.style.width = '100%';
        });
    });

    slideshowTimer = setTimeout(() => {
        if (!slideshowActive) return;
        showNext();
        scheduleNext();
    }, SLIDE_DURATION);
}

function resetProgress() {
    const bar = document.getElementById('lb-progress-bar');
    bar.classList.remove('animate');
    bar.style.transitionDuration = '';
    bar.style.width = '0%';
}

function toggleSlideshow() {
    if (slideshowActive) {
        stopSlideshow();
    } else {
        startSlideshow();
    }
}

// ============================================================
//  검색
// ============================================================
function initSearch() {
    const input    = document.getElementById('search-input');
    const countEl  = document.getElementById('search-count');
    const gallery  = document.getElementById('gallery');

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        const cards = gallery.querySelectorAll('.card');

        // 기존 "결과 없음" 메시지 제거
        const prev = gallery.querySelector('.search-no-result');
        if (prev) prev.remove();

        let visible = 0;
        cards.forEach((card, idx) => {
            const item = items[idx];
            if (!item) return;
            const match =
                !query ||
                item.name.toLowerCase().includes(query)  ||
                item.date.toLowerCase().includes(query)  ||
                item.story.toLowerCase().includes(query);

            card.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        // 검색 결과 수 표시
        if (query) {
            countEl.textContent = `${visible}개의 사진`;
            countEl.classList.add('visible');
        } else {
            countEl.classList.remove('visible');
        }

        // 결과 없을 때
        if (query && visible === 0) {
            const msg = document.createElement('p');
            msg.className = 'search-no-result';
            msg.textContent = `"${input.value}" 에 해당하는 사진이 없습니다.`;
            gallery.appendChild(msg);
        }
    });
}

// ============================================================
//  이벤트
// ============================================================
document.getElementById('lb-close').addEventListener('click', () => {
    stopSlideshow();
    closeLightbox();
});
document.getElementById('lb-prev').addEventListener('click', () => {
    if (slideshowActive) { clearTimeout(slideshowTimer); scheduleNext(); }
    showPrev();
});
document.getElementById('lb-next').addEventListener('click', () => {
    if (slideshowActive) { clearTimeout(slideshowTimer); scheduleNext(); }
    showNext();
});

document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) { stopSlideshow(); closeLightbox(); }
});

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape')     { stopSlideshow(); closeLightbox(); }
    if (e.key === 'ArrowLeft')  { if (slideshowActive) { clearTimeout(slideshowTimer); scheduleNext(); } showPrev(); }
    if (e.key === 'ArrowRight') { if (slideshowActive) { clearTimeout(slideshowTimer); scheduleNext(); } showNext(); }
});

document.getElementById('btn-music').addEventListener('click', toggleMusic);
document.getElementById('btn-enjoy').addEventListener('click', () => {
    toggleMusic();
    startSlideshow();
});
document.getElementById('lb-select').addEventListener('click', toggleSelect);
document.getElementById('btn-selected-fab').addEventListener('click', showSelectedPanel);
document.getElementById('sp-close').addEventListener('click', () => {
    document.getElementById('selected-panel').classList.add('hidden');
});
document.getElementById('btn-copy-selected').addEventListener('click', copySelectedToClipboard);
document.getElementById('btn-clear-selected').addEventListener('click', () => {
    if (!confirm('선택을 모두 초기화할까요?')) return;
    selected.clear();
    localStorage.removeItem('photo-selected');
    updateSelectedFab();
    document.getElementById('selected-panel').classList.add('hidden');
});
document.getElementById('selected-panel').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) document.getElementById('selected-panel').classList.add('hidden');
});

// 모바일 스와이프
let touchStartX = 0;
document.getElementById('lightbox').addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });

document.getElementById('lightbox').addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) < 50) return;
    dx < 0 ? showNext() : showPrev();
}, { passive: true });

// ============================================================
//  데모 데이터 (SHEET_ID 미설정 시 미리보기용)
// ============================================================
const DEMO_ITEMS = [
    { name: '김민준', date: '2019. 4. 14.', imageUrl: 'https://picsum.photos/seed/church1/600/800', story: '처음 이 교회에 발을 디딘 날, 두근거리는 마음으로 예배당 문을 열었습니다. 그 순간이 아직도 생생합니다.' },
    { name: '이서연', date: '2021. 9. 5.',  imageUrl: 'https://picsum.photos/seed/church2/800/600', story: '청년부에서 만난 친구들과 함께한 수련회. 그 밤의 별빛과 기도가 아직도 마음속에 남아 있습니다.' },
    { name: '박도현', date: '2022. 12. 25.', imageUrl: 'https://picsum.photos/seed/church3/600/700', story: '성탄절 예배 후 온 성도가 함께 찍은 사진입니다. 이 공동체가 있어 감사합니다.' },
    { name: '최유진', date: '2023. 3. 1.',  imageUrl: 'https://picsum.photos/seed/church4/700/500', story: '봉사팀과 함께한 지역사회 나눔 행사. 작은 손길이 모여 큰 사랑이 됩니다.' },
    { name: '정하늘', date: '2020. 6. 14.', imageUrl: 'https://picsum.photos/seed/church5/500/700', story: '처음으로 세례를 받던 날. 물속에서 올라오며 새 생명을 얻은 느낌이었습니다.' },
    { name: '윤서준', date: '2024. 1. 1.',  imageUrl: 'https://picsum.photos/seed/church6/600/600', story: '새해 첫날 새벽예배. 어둠 속에서도 함께 모여 기도하는 이 공동체가 자랑스럽습니다.' },
    { name: '강지혜', date: '2021. 5. 9.',  imageUrl: 'https://picsum.photos/seed/church7/800/700', story: '어버이주일에 부모님과 함께 예배드리며 펑펑 울었던 날. 복음의 감격이 새로웠습니다.' },
    { name: '임태양', date: '2023. 8. 15.', imageUrl: 'https://picsum.photos/seed/church8/600/900', story: '여름 수련회에서 찍은 한 컷. 웃음이 넘쳤던 그 시간들이 그립습니다.' },
    { name: '한수아', date: '2022. 4. 17.', imageUrl: 'https://picsum.photos/seed/church9/700/600', story: '부활주일, 온 교회가 하나 되어 "할렐루야"를 외치던 그 순간의 감격을 잊을 수 없습니다.' },
];

// ============================================================
//  초기화
// ============================================================
async function init() {
    const loadingEl = document.getElementById('loading');
    const errorEl   = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');

    // SHEET_ID가 설정되지 않았으면 데모 모드
    if (!CONFIG.CSV_URL || CONFIG.CSV_URL.includes('YOUR_')) {
        items = DEMO_ITEMS;
        loadingEl.classList.add('hidden');
        renderGallery(items);
        initSearch();
        return;
    }

    try {
        items = shuffle(await fetchData());
        loadingEl.classList.add('hidden');

        if (items.length === 0) {
            errorText.textContent = '아직 등록된 사진이 없습니다.';
            errorEl.classList.remove('hidden');
            return;
        }

        renderGallery(items);
        initSearch();
        updateSelectedFab();

    } catch (err) {
        console.error('[사진전] 데이터 로드 실패:', err);
        loadingEl.classList.add('hidden');
        errorText.textContent =
            '사진을 불러오는 데 문제가 발생했습니다. ' +
            '구글 시트가 "웹에 게시"되었는지 확인해주세요.';
        errorEl.classList.remove('hidden');
    }
}

// 페이지 열릴 때 항상 메인화면(맨 위)에서 시작
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// 이미지 우클릭 · 드래그 저장 차단
document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
});
document.addEventListener('dragstart', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
});

init();
