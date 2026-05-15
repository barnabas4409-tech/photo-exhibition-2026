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
    const lines = csv.split('\n');
    const result = [];

    for (let i = CONFIG.HEADER_ROWS; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = splitCSVLine(line);
        const name     = stripQuotes(cols[CONFIG.COL_NAME]      || '');
        const date     = stripQuotes(cols[CONFIG.COL_DATE]       || '');
        const place    = stripQuotes(cols[CONFIG.COL_PLACE]      || '');
        const rawUrl   = stripQuotes(cols[CONFIG.COL_IMAGE_URL]  || '');
        const story    = stripQuotes(cols[CONFIG.COL_STORY]      || '');
        const imageUrl = normalizeDriveUrl(rawUrl);

        if (!imageUrl) continue;

        result.push({ name, date, place, imageUrl, story });
    }

    return result;
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

    // 이미 직접 URL 형식이면 그대로 사용
    if (url.includes('drive.google.com/uc')) return url;

    // Google Drive 공유 링크 → 직접 이미지 URL
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) {
        return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    }

    // 그 외 외부 URL은 그대로 사용
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
            <div class="card-img-wrap">
                <img
                    src="${escapeHtml(item.imageUrl)}"
                    alt="${escapeHtml(item.name || '')}의 사진"
                    loading="lazy"
                >
            </div>
            ${hasBody ? `
            <div class="card-body">
                <p class="card-meta">${[item.date, item.place].filter(Boolean).map(escapeHtml).join(' · ')}</p>
                ${item.name  ? `<p class="card-name">${escapeHtml(item.name)}</p>` : ''}
                ${item.story ? `<p class="card-story">${escapeHtml(item.story)}</p>` : ''}
            </div>` : ''}
        `;

        // 이미지 로드 실패 시 카드 숨기기
        card.querySelector('img').addEventListener('error', () => {
            card.style.display = 'none';
        });

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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
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
document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', showPrev);
document.getElementById('lb-next').addEventListener('click', showNext);

document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeLightbox();
});

document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  showPrev();
    if (e.key === 'ArrowRight') showNext();
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
        items = await fetchData();
        loadingEl.classList.add('hidden');

        if (items.length === 0) {
            errorText.textContent = '아직 등록된 사진이 없습니다.';
            errorEl.classList.remove('hidden');
            return;
        }

        renderGallery(items);
        initSearch();

    } catch (err) {
        console.error('[사진전] 데이터 로드 실패:', err);
        loadingEl.classList.add('hidden');
        errorText.textContent =
            '사진을 불러오는 데 문제가 발생했습니다. ' +
            '구글 시트가 "웹에 게시"되었는지 확인해주세요.';
        errorEl.classList.remove('hidden');
    }
}

init();
