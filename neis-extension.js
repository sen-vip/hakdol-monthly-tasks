/* hakdol-monthly-tasks NEIS calendar extension
 * A plan: GitHub Pages only + user-provided NEIS API key + localStorage.
 * v2.3: Vercel server mode + diagnostics + yearly schedule cache + real calendar grid.
 */
(function () {
  'use strict';

  const SETTINGS_KEY = 'hakdolNeisSettings';
  const RANGE_MODE = 'calendar-year'; // later: 'school-year'
  const API_MODE = 'server';
  const SERVER_API_BASE = 'https://hakdol-neis-api.vercel.app';

  const EDUCATION_OFFICES = [
    { code: 'B10', name: '서울특별시교육청' },
    { code: 'C10', name: '부산광역시교육청' },
    { code: 'D10', name: '대구광역시교육청' },
    { code: 'E10', name: '인천광역시교육청' },
    { code: 'F10', name: '광주광역시교육청' },
    { code: 'G10', name: '대전광역시교육청' },
    { code: 'H10', name: '울산광역시교육청' },
    { code: 'I10', name: '세종특별자치시교육청' },
    { code: 'J10', name: '경기도교육청' },
    { code: 'K10', name: '강원특별자치도교육청' },
    { code: 'M10', name: '충청북도교육청' },
    { code: 'N10', name: '충청남도교육청' },
    { code: 'P10', name: '전북특별자치도교육청' },
    { code: 'Q10', name: '전라남도교육청' },
    { code: 'R10', name: '경상북도교육청' },
    { code: 'S10', name: '경상남도교육청' },
    { code: 'T10', name: '제주특별자치도교육청' }
  ];

  const SCHEDULE_RULES = [
    {
      id: 'field-trip',
      keywords: ['현장체험', '체험학습', '수학여행', '수련활동', '숙박형', '야영', '캠프'],
      title: '현장체험학습 관련 확인',
      priority: 'high',
      tasks: ['차량 계약 및 배차 확인', '여행자보험 또는 관련 보험 확인', '안전계획 및 가정통신문 확인', '출발 전 점검표 확인', '인솔자 및 비상연락망 확인'],
      tools: [
        { name: '버스 콕검', url: 'https://sen-vip.github.io/bus-kockgum/' },
        { name: '공문핏', url: 'https://sen-vip.github.io/gongmun-fit/' }
      ]
    },
    {
      id: 'ceremony',
      keywords: ['입학식', '졸업식', '개학식', '방학식', '종업식', '시업식'],
      title: '학교 행사 관련 확인',
      priority: 'medium',
      tasks: ['방송장비 및 마이크 확인', '강당 또는 행사장 좌석 배치 확인', '현수막, 안내문, 식순 자료 확인', '내빈 안내 및 주차 동선 확인', '행사 물품 구입 필요 여부 확인'],
      tools: [
        { name: '공문핏', url: 'https://sen-vip.github.io/gongmun-fit/' }
      ]
    },
    {
      id: 'open-class',
      keywords: ['공개수업', '교육과정설명회', '학부모총회', '학교설명회', '학부모'],
      title: '학부모 행사 관련 확인',
      priority: 'medium',
      tasks: ['안내문 및 배부자료 확인', '방송장비, 빔프로젝터, 마이크 확인', '주차 및 출입 안내 확인', '다과 또는 물품 구입 필요 여부 확인'],
      tools: [
        { name: '공문핏', url: 'https://sen-vip.github.io/gongmun-fit/' }
      ]
    },
    {
      id: 'exam',
      keywords: ['시험', '평가', '고사', '지필평가'],
      title: '시험·평가 기간 확인',
      priority: 'medium',
      tasks: ['방송 및 종소리 운영 확인', '시험지 보관 및 보안 관련 사항 확인', '인쇄실 사용 일정 확인', '급식 시간 변경 여부 확인'],
      tools: [{ name: '공문핏', url: 'https://sen-vip.github.io/gongmun-fit/' }]
    },
    {
      id: 'vacation',
      keywords: ['방학', '여름방학', '겨울방학'],
      title: '방학 전후 행정실 확인',
      priority: 'high',
      tasks: ['방학 중 공사 및 시설점검 일정 확인', '급식 중단 및 재개 일정 확인', '당직 및 근무조 편성 확인', '공공요금, 자동이체, 계약 만료일 확인', '개학 전 시설 상태 확인'],
      tools: [
        { name: '연간계약보드', url: 'https://sen-vip.github.io/annual-contract-board/' },
        { name: '행정실 루틴집', url: 'https://sen-vip.github.io/hakdol-routine/' }
      ]
    },
    {
      id: 'sports-festival',
      keywords: ['체육대회', '운동회', '축제', '학예회', '발표회'],
      title: '대규모 행사 운영 확인',
      priority: 'medium',
      tasks: ['천막·음향·방송장비 확인', '안전요원 및 보건실 지원 확인', '행사 물품 구입 여부 확인', '쓰레기 처리 및 사후 정리 계획 확인'],
      tools: [
        { name: '공문핏', url: 'https://sen-vip.github.io/gongmun-fit/' }
      ]
    }
  ];

  const today = new Date();
  const state = {
    settings: loadSettings(),
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    schools: [],
    selectedDate: formatIsoDate(today),
    activeTab: 'all'
  };

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function saveSettings(settings) {
    state.settings = { ...state.settings, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }

  function clearSettings() {
    localStorage.removeItem(SETTINGS_KEY);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('hakdolNeisSchedules_')) localStorage.removeItem(key);
    });
    state.settings = {};
    state.schools = [];
    state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
    renderAll();
    toast('학교 설정과 저장된 학사일정을 초기화했어요.');
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatIsoDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function ymd(date) {
    return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  }

  function toIsoDate(yyyymmdd) {
    const raw = String(yyyymmdd || '').replace(/\D/g, '');
    if (raw.length !== 8) return '';
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }

  function dateTextFromYmd(yyyymmdd) {
    const raw = String(yyyymmdd || '').replace(/\D/g, '');
    if (raw.length !== 8) return '-';
    return `${Number(raw.slice(4, 6))}. ${Number(raw.slice(6, 8))}.`;
  }

  function dateTextFromIso(iso) {
    const parts = String(iso || '').split('-');
    if (parts.length !== 3) return '-';
    return `${Number(parts[1])}. ${Number(parts[2])}.`;
  }

  function weekdayText(iso) {
    const date = new Date(`${iso}T00:00:00`);
    return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] || '';
  }

  function getOfficeName(code) {
    return EDUCATION_OFFICES.find((item) => item.code === code)?.name || '';
  }

  function apiUrl(path, params) {
    const query = new URLSearchParams({ Type: 'json', ...params });
    return `https://open.neis.go.kr/hub/${path}?${query.toString()}`;
  }

  function serverUrl(path, params) {
    const base = SERVER_API_BASE.replace(/\/$/, '');
    const query = new URLSearchParams(params);
    return `${base}/api/${path}?${query.toString()}`;
  }

  function parseNeisError(json, rootName) {
    const head = json?.[rootName]?.[0]?.head;
    const result = Array.isArray(head) ? head.find((item) => item.RESULT)?.RESULT : null;
    if (result?.CODE && result.CODE !== 'INFO-000') return result.MESSAGE || result.CODE;
    if (json?.RESULT?.CODE && json.RESULT.CODE !== 'INFO-000') return json.RESULT.MESSAGE || json.RESULT.CODE;
    return '';
  }

  async function fetchJson(url) {
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch (error) {
      throw new Error(`백엔드에 연결하지 못했어요. 주소/CORS/네트워크를 확인해주세요. (${error.message || error})`);
    }

    let json = null;
    const text = await response.text();
    try { json = text ? JSON.parse(text) : null; }
    catch { json = null; }

    if (!response.ok) {
      const message = json?.error || text || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return json || {};
  }

  async function searchSchools({ apiKey, officeCode, schoolName }) {
    if (API_MODE === 'server') {
      const json = await fetchJson(serverUrl('schools', { officeCode, schoolName }));
      if (json.error) throw new Error(json.error);
      return json.schools || [];
    }

    const url = apiUrl('schoolInfo', {
      KEY: apiKey,
      pIndex: '1',
      pSize: '20',
      ATPT_OFCDC_SC_CODE: officeCode,
      SCHUL_NM: schoolName
    });
    const json = await fetchJson(url);
    const error = parseNeisError(json, 'schoolInfo');
    if (error) throw new Error(error);
    const rows = json?.schoolInfo?.[1]?.row || [];
    return rows.map((row) => ({
      officeCode: row.ATPT_OFCDC_SC_CODE,
      officeName: row.ATPT_OFCDC_SC_NM || getOfficeName(row.ATPT_OFCDC_SC_CODE),
      schoolCode: row.SD_SCHUL_CODE,
      schoolName: row.SCHUL_NM,
      schoolKind: row.SCHUL_KND_SC_NM || '',
      address: row.ORG_RDNMA || row.ORG_RDNDA || '',
      homepage: row.HMPG_ADRES || ''
    }));
  }

  function scheduleRangeForYear(year) {
    if (RANGE_MODE === 'school-year') {
      return {
        from: new Date(year, 2, 1),
        to: new Date(year + 1, 1, 28)
      };
    }
    return {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31)
    };
  }

  async function fetchSchoolScheduleYear({ apiKey, officeCode, schoolCode, year }) {
    if (API_MODE === 'server') {
      const json = await fetchJson(serverUrl('schedules', { officeCode, schoolCode, year }));
      if (json.error) throw new Error(json.error);
      return (json.schedules || []).map((item) => ({ ...item, raw: item }));
    }

    const range = scheduleRangeForYear(year);
    const url = apiUrl('SchoolSchedule', {
      KEY: apiKey,
      pIndex: '1',
      pSize: '1000',
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      AA_FROM_YMD: ymd(range.from),
      AA_TO_YMD: ymd(range.to)
    });
    const json = await fetchJson(url);
    const error = parseNeisError(json, 'SchoolSchedule');
    if (error && !/자료가 존재하지 않습니다/.test(error)) throw new Error(error);
    const rows = json?.SchoolSchedule?.[1]?.row || [];
    return rows.map((row) => ({
      date: toIsoDate(row.AA_YMD),
      ymd: String(row.AA_YMD || ''),
      dateText: dateTextFromYmd(row.AA_YMD),
      eventName: row.EVENT_NM || '',
      eventContent: row.EVENT_CNTNT || '',
      gradeText: gradeText(row),
      raw: row
    })).filter((item) => item.date).sort((a, b) => a.date.localeCompare(b.date));
  }

  function gradeText(row) {
    const checks = [
      ['ONE_GRADE_EVENT_YN', '1학년'],
      ['TW_GRADE_EVENT_YN', '2학년'],
      ['THREE_GRADE_EVENT_YN', '3학년'],
      ['FR_GRADE_EVENT_YN', '4학년'],
      ['FIV_GRADE_EVENT_YN', '5학년'],
      ['SIX_GRADE_EVENT_YN', '6학년']
    ];
    return checks.filter(([key]) => String(row?.[key] || '').toUpperCase() === 'Y').map(([, label]) => label).join(', ');
  }

  function scheduleCacheKey(year = state.year, settings = state.settings) {
    if (!settings.officeCode || !settings.schoolCode) return '';
    return `hakdolNeisSchedules_${year}_${settings.officeCode}_${settings.schoolCode}`;
  }

  function loadYearCache(year = state.year) {
    const key = scheduleCacheKey(year);
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  }

  function saveYearCache(year, schedules) {
    const s = state.settings;
    const key = scheduleCacheKey(year, s);
    if (!key) return;
    const payload = {
      year,
      rangeMode: RANGE_MODE,
      officeCode: s.officeCode,
      schoolCode: s.schoolCode,
      schoolName: s.schoolName,
      fetchedAt: new Date().toISOString(),
      schedules
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }

  function getYearSchedules(year = state.year) {
    return loadYearCache(year)?.schedules || [];
  }

  function getMonthSchedules(year = state.year, month = state.month) {
    return getYearSchedules(year).filter((item) => {
      const [y, m] = String(item.date).split('-').map(Number);
      return y === Number(year) && m === Number(month);
    });
  }

  function getSchedulesByDate(iso) {
    return getYearSchedules(state.year).filter((item) => item.date === iso);
  }

  function recommendationsFor(schedule) {
    const text = `${schedule.eventName || ''} ${schedule.eventContent || ''}`.replace(/\s+/g, '');
    if (!text) return [];
    return SCHEDULE_RULES.filter((rule) => rule.keywords.some((kw) => text.includes(kw.replace(/\s+/g, ''))));
  }

  function recommendationsForSchedules(schedules) {
    const map = new Map();
    schedules.forEach((schedule) => {
      recommendationsFor(schedule).forEach((rule) => {
        if (!map.has(rule.id)) map.set(rule.id, { ...rule, schedules: [], tasks: [...rule.tasks], tools: [...rule.tools] });
        map.get(rule.id).schedules.push(schedule);
      });
    });
    return [...map.values()].sort((a, b) => {
      const aw = a.priority === 'high' ? 0 : 1;
      const bw = b.priority === 'high' ? 0 : 1;
      return aw - bw;
    });
  }

  function uniqueTasks(rules) {
    return [...new Set(rules.flatMap((rule) => rule.tasks))];
  }

  function uniqueTools(rules) {
    const map = new Map();
    rules.flatMap((rule) => rule.tools).forEach((tool) => {
      if (tool.name !== '품샷') map.set(tool.name, tool);
    });
    return [...map.values()];
  }

  function getCurrentMonthTasks() {
    const source = Array.isArray(window.HAKDOL_TASKS) ? window.HAKDOL_TASKS : [];
    return source.filter((task) => Number(task.month) === Number(state.month));
  }

  function linkedMonthlyTasks() {
    const schedulesText = getMonthSchedules().map((item) => `${item.eventName} ${item.eventContent}`).join(' ');
    const tasks = getCurrentMonthTasks();
    return tasks.filter((task) => {
      const candidates = [task.title, task.description, task.note, task.category, ...(task.keywords || [])].filter(Boolean);
      return candidates.some((value) => {
        const words = String(value).split(/[\s,·/()\[\]-]+/).filter((w) => w.length >= 2);
        return words.some((word) => schedulesText.includes(word));
      });
    }).slice(0, 8);
  }

  function injectPanel() {
    if (document.getElementById('neisExtensionPanel')) return;
    const shell = document.querySelector('.app-shell') || document.querySelector('main') || document.body;
    const panel = document.createElement('section');
    panel.id = 'neisExtensionPanel';
    panel.className = 'neis-panel no-print';
    panel.innerHTML = `
      <div class="neis-head">
        <div>
          <p class="neis-eyebrow">NEIS Connected Board</p>
          <h2>우리 학교 학사일정 연결</h2>
          <p>나이스 1년 학사일정을 한 번에 불러와 월별 필수업무와 연결해 보여줍니다.</p>
        </div>
        <div class="neis-saved" id="neisSavedSchool">학교 설정 전</div>
      </div>
      <div class="neis-settings-card">
        <div class="neis-grid">
          <label>시도교육청<select id="neisOfficeSelect"></select></label>
          <label>학교명<input id="neisSchoolName" type="text" placeholder="예: 한국초등학교"></label>
          <input id="neisApiKey" type="hidden" value="">
        </div>
        <div class="neis-actions">
          <button class="primary" id="neisSearchBtn" type="button">학교 찾기</button>

          <button class="ghost" id="neisClearBtn" type="button">설정 초기화</button>
        </div>
        <p class="neis-help">학교 정보와 불러온 학사일정은 이 브라우저에만 저장됩니다. 일반 사용자는 나이스 API 인증키를 입력하지 않아도 됩니다.</p>
        <div id="neisSchoolResults" class="neis-results" hidden></div>
      </div>
      <div class="neis-calendar-card">
        <div class="neis-calendar-top">
          <div>
            <h3 id="neisCalendarTitle">우리 학교 학사일정 달력</h3>
            <p id="neisCalendarMeta">학교를 설정하고 1년 학사일정을 불러오세요.</p>
            <p id="neisCacheMeta" class="neis-cache-meta"></p>
          </div>
          <div class="neis-month-controls">
            <button class="ghost" id="neisPrevMonth" type="button">← 이전달</button>
            <button class="primary" id="neisLoadSchedule" type="button">1년 학사일정 불러오기</button>
            <button class="ghost" id="neisNextMonth" type="button">다음달 →</button>
          </div>
        </div>
        <div class="neis-tabs" role="tablist">
          <button data-neis-tab="all" class="active" type="button">전체보기</button>
          <button data-neis-tab="calendar" type="button">나이스 달력</button>
          <button data-neis-tab="recommend" type="button">추천업무</button>
          <button data-neis-tab="monthly" type="button">월별업무 연결</button>
        </div>
        <div id="neisCalendarBody" class="neis-calendar-body"></div>
      </div>
    `;
    const before = document.querySelector('.toolbar') || document.querySelector('#statsGrid') || shell.firstElementChild?.nextElementSibling;
    if (before && before.parentNode) before.parentNode.insertBefore(panel, before);
    else shell.prepend(panel);
  }

  function bindEvents() {
    document.getElementById('neisSearchBtn')?.addEventListener('click', onSearchSchools);
    document.getElementById('neisSchoolName')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); onSearchSchools(); }
    });
    document.getElementById('neisSaveKeyBtn')?.addEventListener('click', onSaveKey);
    document.getElementById('neisClearBtn')?.addEventListener('click', clearSettings);
    document.getElementById('neisLoadSchedule')?.addEventListener('click', onLoadYearSchedule);
    document.getElementById('neisPrevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('neisNextMonth')?.addEventListener('click', () => changeMonth(1));
    document.querySelectorAll('[data-neis-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeTab = btn.dataset.neisTab;
        renderCalendar();
      });
    });
  }

  function renderAll() {
    renderSettings();
    renderCalendar();
  }

  function renderSettings() {
    const office = document.getElementById('neisOfficeSelect');
    if (!office) return;
    office.innerHTML = EDUCATION_OFFICES.map((item) => `<option value="${esc(item.code)}">${esc(item.name)}</option>`).join('');
    office.value = state.settings.officeCode || 'B10';
    const schoolNameInput = document.getElementById('neisSchoolName');
    const apiKeyInput = document.getElementById('neisApiKey');
    if (schoolNameInput) schoolNameInput.value = state.settings.schoolName || '';
    if (apiKeyInput) apiKeyInput.value = state.settings.apiKey || '';
    const saved = document.getElementById('neisSavedSchool');
    if (!saved) return;
    if (state.settings.schoolCode) {
      saved.innerHTML = `<strong>${esc(state.settings.schoolName)}</strong><span>${esc(state.settings.officeName || getOfficeName(state.settings.officeCode))} · ${esc(state.settings.schoolCode)}</span>`;
    } else {
      saved.textContent = '학교 설정 전';
    }
  }

  function renderCalendar() {
    document.querySelectorAll('[data-neis-tab]').forEach((btn) => btn.classList.toggle('active', btn.dataset.neisTab === state.activeTab));
    const title = document.getElementById('neisCalendarTitle');
    const meta = document.getElementById('neisCalendarMeta');
    const cacheMeta = document.getElementById('neisCacheMeta');
    const body = document.getElementById('neisCalendarBody');
    const loadBtn = document.getElementById('neisLoadSchedule');
    if (!body || !title || !meta) return;

    const monthSchedules = getMonthSchedules();
    const yearCache = loadYearCache();
    const recCount = recommendationsForSchedules(monthSchedules).length;
    const school = state.settings.schoolName ? `${state.settings.officeName || getOfficeName(state.settings.officeCode)} · ${state.settings.schoolName}` : '학교 설정 전';

    title.textContent = `${state.year}년 ${state.month}월 우리 학교 학사일정 달력`;
    meta.textContent = `${school} · 이번 달 학사일정 ${monthSchedules.length}건 · 추천업무 ${recCount}종`;
    if (cacheMeta) cacheMeta.textContent = cacheStatusText(yearCache);
    if (loadBtn) loadBtn.textContent = yearCache ? '학사일정 새로고침' : '1년 학사일정 불러오기';

    const sections = [];
    if (state.activeTab === 'all' || state.activeTab === 'calendar') sections.push(renderCalendarSection());
    if (state.activeTab === 'all' || state.activeTab === 'recommend') sections.push(renderRecommendSection());
    if (state.activeTab === 'all' || state.activeTab === 'monthly') sections.push(renderMonthlyLinkSection());
    body.innerHTML = sections.join('');
    bindCalendarDayEvents(body);
  }

  function cacheStatusText(cache) {
    if (!state.settings.schoolCode) return '우리 학교를 먼저 설정해주세요.';
    if (!cache) return `${state.year}년 학사일정을 아직 불러오지 않았어요. 1년 학사일정을 먼저 불러와주세요.`;
    return `${cache.year}년 학사일정 ${cache.schedules?.length || 0}건 저장됨 · 마지막 업데이트 ${formatDateTime(cache.fetchedAt)}`;
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function renderCalendarSection() {
    const cache = loadYearCache();
    if (!cache) {
      return `<div class="neis-empty"><strong>불러온 학사일정이 없어요.</strong><span>학교 설정 후 [1년 학사일정 불러오기]를 눌러주세요. 한 번 불러오면 월을 바꿔도 자동으로 표시됩니다.</span></div>`;
    }
    const selectedSchedules = getSchedulesByDate(state.selectedDate);
    const selectedRules = recommendationsForSchedules(selectedSchedules);
    return `<div class="neis-section">
      <div class="neis-section-head"><h4>📅 나이스 달력</h4><span>${esc(state.year)}년 ${esc(state.month)}월</span></div>
      ${renderMonthGrid()}
      ${renderSelectedDatePanel(selectedSchedules, selectedRules)}
    </div>`;
  }

  function renderMonthGrid() {
    const first = new Date(state.year, state.month - 1, 1);
    const last = new Date(state.year, state.month, 0);
    const startOffset = first.getDay();
    const totalDays = last.getDate();
    const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
    const monthSchedules = getMonthSchedules();
    const byDate = new Map();
    monthSchedules.forEach((item) => {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date).push(item);
    });

    const cells = [];
    for (let i = 0; i < totalCells; i += 1) {
      const day = i - startOffset + 1;
      if (day < 1 || day > totalDays) {
        cells.push('<div class="neis-day is-empty" aria-hidden="true"></div>');
        continue;
      }
      const iso = `${state.year}-${pad2(state.month)}-${pad2(day)}`;
      const schedules = byDate.get(iso) || [];
      const rules = recommendationsForSchedules(schedules);
      const taskCount = uniqueTasks(rules).length;
      const isToday = iso === formatIsoDate(new Date());
      const isSelected = iso === state.selectedDate;
      const events = schedules.slice(0, 2).map((s) => `<span class="neis-event-dot">${esc(s.eventName || '학사일정')}</span>`).join('');
      const more = schedules.length > 2 ? `<span class="neis-more">+${schedules.length - 2}개 더</span>` : '';
      const recBadge = taskCount ? `<span class="neis-rec-badge">추천 ${taskCount}</span>` : '';
      cells.push(`<button class="neis-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${schedules.length ? 'has-event' : ''}" type="button" data-date="${esc(iso)}">
        <span class="neis-day-number">${day}</span>
        <span class="neis-day-events">${events}${more}</span>
        ${recBadge}
      </button>`);
    }

    return `<div class="neis-calendar-grid" aria-label="${state.year}년 ${state.month}월 학사일정 달력">
      ${['일', '월', '화', '수', '목', '금', '토'].map((d) => `<div class="neis-weekday">${d}</div>`).join('')}
      ${cells.join('')}
    </div>`;
  }

  function renderSelectedDatePanel(schedules, rules) {
    const taskList = uniqueTasks(rules);
    const tools = uniqueTools(rules);
    const dateLabel = `${dateTextFromIso(state.selectedDate)} ${weekdayText(state.selectedDate)}요일`;
    if (!schedules.length) {
      return `<aside class="neis-detail-panel">
        <h4>${esc(dateLabel)}</h4>
        <div class="neis-empty small"><strong>선택한 날짜에 등록된 나이스 학사일정이 없어요.</strong><span>월별 필수업무는 아래 목록에서 확인할 수 있어요.</span></div>
      </aside>`;
    }
    return `<aside class="neis-detail-panel">
      <h4>${esc(dateLabel)}</h4>
      <div class="neis-detail-block">
        <strong>나이스 학사일정</strong>
        <ul>${schedules.map((item) => `<li>${esc(item.eventName || '학사일정')}${item.eventContent ? `<p>${esc(item.eventContent)}</p>` : ''}${item.gradeText ? `<span>${esc(item.gradeText)}</span>` : ''}</li>`).join('')}</ul>
      </div>
      <div class="neis-detail-block">
        <strong>추천 확인</strong>
        ${taskList.length ? `<ul>${taskList.map((task) => `<li>${esc(task)}</li>`).join('')}</ul>` : '<p>자동 추천된 업무가 없어요.</p>'}
      </div>
      ${tools.length ? `<div class="neis-detail-block"><strong>연결 도구</strong><div class="neis-tool-row">${tools.map((tool) => `<a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)}</a>`).join('')}</div></div>` : ''}
    </aside>`;
  }

  function bindCalendarDayEvents(scope) {
    scope.querySelectorAll('[data-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedDate = btn.dataset.date;
        renderCalendar();
      });
    });
  }

  function renderRecommendSection() {
    const monthSchedules = getMonthSchedules();
    const recs = recommendationsForSchedules(monthSchedules);
    if (!loadYearCache()) {
      return `<div class="neis-empty"><strong>추천업무를 표시하려면 학사일정이 필요해요.</strong><span>1년 학사일정을 먼저 불러와주세요.</span></div>`;
    }
    if (!recs.length) {
      return `<div class="neis-empty"><strong>이번 달 자동 추천된 업무가 없어요.</strong><span>학사일정명에 따라 현장체험학습, 방학, 행사, 시험 관련 업무가 표시됩니다.</span></div>`;
    }
    return `<div class="neis-section"><h4>🧭 일정 기반 추천업무</h4><div class="neis-recommend-grid">${recs.map((rule) => `<article class="neis-recommend-card ${rule.priority === 'high' ? 'is-high' : ''}">
      <div class="neis-rec-head"><strong>${esc(rule.title)}</strong><span>${rule.priority === 'high' ? '중요' : '확인'}</span></div>
      <p class="neis-linked-events">연결 일정: ${rule.schedules.map((s) => `${s.dateText} ${s.eventName}`).map(esc).join(' · ')}</p>
      <ul>${rule.tasks.map((task) => `<li>${esc(task)}</li>`).join('')}</ul>
      <div class="neis-tool-row">${uniqueTools([rule]).map((tool) => `<a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)}</a>`).join('')}</div>
    </article>`).join('')}</div></div>`;
  }

  function renderMonthlyLinkSection() {
    const linked = linkedMonthlyTasks();
    const monthTasks = getCurrentMonthTasks();
    if (!monthTasks.length) {
      return `<div class="neis-empty"><strong>현재 월별업무 데이터와 연결할 수 없어요.</strong><span>기존 앱의 HAKDOL_TASKS 데이터가 있으면 자동으로 연결됩니다.</span></div>`;
    }
    const list = linked.length ? linked : monthTasks.slice(0, 6);
    const lead = linked.length ? '나이스 일정과 연결된 월별업무' : '이번 달 월별 필수업무';
    return `<div class="neis-section"><h4>🗂️ ${esc(lead)}</h4><div class="neis-monthly-list">${list.map((task) => `<article class="neis-monthly-card">
      <span class="neis-chip">${esc(task.period || task.periodGroup || '월중')}</span>
      <span class="neis-chip soft">${esc(task.category || '업무')}</span>
      ${linked.includes(task) ? `<span class="neis-chip hot">이번 달 실제 일정 있음</span>` : ''}
      <strong>${esc(task.title || '월별업무')}</strong>
      <p>${esc(task.description || task.note || '상세 내용은 기존 월별업무 카드에서 확인하세요.')}</p>
    </article>`).join('')}</div></div>`;
  }

  async function onSearchSchools() {
    const apiKey = document.getElementById('neisApiKey')?.value.trim();
    const officeCode = document.getElementById('neisOfficeSelect')?.value;
    const schoolName = document.getElementById('neisSchoolName')?.value.trim();
    if (API_MODE === 'client' && !apiKey) return toast('나이스 API 인증키를 먼저 입력해주세요.');
    if (!schoolName) return toast('학교명을 입력해주세요.');
    saveSettings({ apiKey: API_MODE === 'client' ? apiKey : '', officeCode, officeName: getOfficeName(officeCode) });
    setBusy('neisSearchBtn', true, '검색 중');
    try {
      state.schools = await searchSchools({ apiKey, officeCode, schoolName });
      renderSchoolResults();
      if (!state.schools.length) toast('검색 결과가 없어요. 학교명을 조금 줄여서 다시 검색해보세요.');
    } catch (error) {
      renderSchoolResults(String(error.message || error));
      toast(`학교 검색 실패: ${error.message || error}`);
    } finally {
      setBusy('neisSearchBtn', false, '학교 찾기');
    }
  }

  function renderSchoolResults(errorMessage = '') {
    const box = document.getElementById('neisSchoolResults');
    if (!box) return;
    box.hidden = false;
    if (errorMessage) {
      box.innerHTML = `<div class="neis-empty small">${esc(errorMessage)}</div>`;
      return;
    }
    if (!state.schools.length) {
      box.innerHTML = `<div class="neis-empty small">검색 결과가 없어요. 학교명을 조금 줄여서 다시 검색해보세요.</div>`;
      return;
    }
    box.innerHTML = state.schools.map((school, index) => `<div class="neis-school-result">
      <div><strong>${esc(school.schoolName)}</strong><span>${esc(school.schoolKind)} · ${esc(school.address || '-')} · ${esc(school.schoolCode)}</span></div>
      <button type="button" class="ghost" data-school-index="${index}">선택</button>
    </div>`).join('');
    box.querySelectorAll('[data-school-index]').forEach((btn) => btn.addEventListener('click', () => selectSchool(Number(btn.dataset.schoolIndex))));
  }

  function selectSchool(index) {
    const school = state.schools[index];
    if (!school) return;
    const apiKey = API_MODE === 'client' ? (document.getElementById('neisApiKey')?.value.trim() || state.settings.apiKey || '') : '';
    saveSettings({ apiKey, ...school });
    const results = document.getElementById('neisSchoolResults');
    if (results) results.hidden = true;
    renderAll();
    toast(`${school.schoolName}을 저장했어요.`);
  }

  function onSaveKey() {
    const apiKey = document.getElementById('neisApiKey')?.value.trim();
    const officeCode = document.getElementById('neisOfficeSelect')?.value;
    if (!apiKey) return toast('나이스 API 인증키를 먼저 입력해주세요.');
    saveSettings({ apiKey, officeCode, officeName: getOfficeName(officeCode) });
    renderAll();
    toast('나이스 API 인증키를 저장했어요.');
  }

  async function onLoadYearSchedule() {
    const s = state.settings;
    if (API_MODE === 'client' && !s.apiKey) return toast('나이스 API 인증키를 먼저 입력해주세요.');
    if (!s.schoolCode || !s.officeCode) return toast('우리 학교를 먼저 선택해주세요.');
    setBusy('neisLoadSchedule', true, '불러오는 중');
    try {
      const items = await fetchSchoolScheduleYear({ apiKey: s.apiKey, officeCode: s.officeCode, schoolCode: s.schoolCode, year: state.year });
      saveYearCache(state.year, items);
      state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
      renderCalendar();
      toast(items.length ? `${state.year}년 학사일정 ${items.length}건을 저장했어요. 이제 월을 바꿔도 자동으로 표시됩니다.` : `${state.year}년 등록된 학사일정이 없어요.`);
    } catch (error) {
      toast(String(error.message || error || '나이스 API 호출에 실패했어요.'));
    } finally {
      setBusy('neisLoadSchedule', false, loadYearCache() ? '학사일정 새로고침' : '1년 학사일정 불러오기');
    }
  }

  function changeMonth(delta) {
    const next = new Date(state.year, state.month - 1 + delta, 1);
    state.year = next.getFullYear();
    state.month = next.getMonth() + 1;
    state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
    renderCalendar();
  }

  function setBusy(id, busy, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = text;
  }

  function toast(message) {
    const existing = document.querySelector('.toast') || document.getElementById('toast');
    if (existing) {
      existing.textContent = message;
      existing.classList.add('show');
      setTimeout(() => existing.classList.remove('show'), 2600);
      return;
    }
    const node = document.createElement('div');
    node.className = 'neis-toast';
    node.textContent = message;
    document.body.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 250); }, 2600);
  }

  function addGithubLinkIfMissing() {
    const has = [...document.querySelectorAll('a')].some((a) => /github\.com\/sen-vip\/hakdol-monthly-tasks/.test(a.href));
    if (has) return;
    const nav = document.querySelector('.topnav') || document.querySelector('.topbar') || document.body;
    const a = document.createElement('a');
    a.href = 'https://github.com/sen-vip/hakdol-monthly-tasks';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'ghost nav-link neis-github-link';
    a.textContent = 'GitHub';
    nav.appendChild(a);
  }

  function init() {
    injectPanel();
    bindEvents();
    renderAll();
    addGithubLinkIfMissing();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
