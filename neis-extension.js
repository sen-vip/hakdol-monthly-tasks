/* hakdol-monthly-tasks NEIS calendar extension
 * A plan: GitHub Pages only + user-provided NEIS API key + localStorage.
 * v2.5: Supabase 로그인 저장 + 이메일 인증/학교설정/직접일정 동기화.
 */
(function () {
  'use strict';

  const SETTINGS_KEY = 'hakdolNeisSettings';
  const MANUAL_EVENTS_KEY = 'hakdolNeisManualEvents_v1';
  const RANGE_MODE = 'calendar-year'; // later: 'school-year'
  const API_MODE = 'server';
  const SERVER_API_BASE = 'https://hakdol-monthly-tasks.vercel.app';
  const TIMETABLE_PAGE_SIZE = 300;
  const TIMETABLE_MAX_PAGES_PER_DAY = 4;
  const TIMETABLE_CACHE_TTL = 1000 * 60 * 60 * 24;

  const TIMETABLE_EVENT_KEYWORDS = [
    '수련활동', '수련회', '체험학습', '현장체험학습', '수학여행', '진로체험', '직업체험',
    '봉사활동', '창의적체험활동', '창체', '자율활동', '동아리', '스포츠클럽',
    '행사', '축제', '학급행사', '학교행사', '운동회', '체육대회', '학예회', '발표회'
  ];

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
    activeTab: 'all',
    timetableLoading: false,
    authUser: null,
    manualEvents: loadManualEvents()
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


  function getSupabaseClient() {
    if (window.HAKDOL_SUPABASE_CLIENT) return window.HAKDOL_SUPABASE_CLIENT;
    const config = window.HAKDOL_SUPABASE_CONFIG || {};
    if (!window.supabase || !config.url || !config.anonKey) return null;
    window.HAKDOL_SUPABASE_CLIENT = window.supabase.createClient(config.url, config.anonKey);
    return window.HAKDOL_SUPABASE_CLIENT;
  }

  async function refreshAuthUser() {
    const client = getSupabaseClient();
    if (!client) {
      state.authUser = null;
      return null;
    }
    const { data } = await client.auth.getUser();
    state.authUser = data?.user || null;
    return state.authUser;
  }

  function schoolToRemotePayload(school) {
    if (!state.authUser) return null;
    return {
      user_id: state.authUser.id,
      office_code: school.officeCode || '',
      office_name: school.officeName || getOfficeName(school.officeCode) || '',
      school_code: school.schoolCode || '',
      school_name: school.schoolName || '',
      school_level: school.schoolKind || school.schoolLevel || '',
      school_address: school.address || school.schoolAddress || '',
      updated_at: new Date().toISOString()
    };
  }

  function remoteSchoolToLocal(row) {
    return {
      officeCode: row.office_code || '',
      officeName: row.office_name || getOfficeName(row.office_code) || '',
      schoolCode: row.school_code || '',
      schoolName: row.school_name || '',
      schoolKind: row.school_level || '',
      address: row.school_address || ''
    };
  }

  async function saveSettingsToSupabase(settings = state.settings) {
    const client = getSupabaseClient();
    if (!client || !state.authUser || !settings.schoolCode) return;
    const payload = schoolToRemotePayload(settings);
    const { error } = await client.from('user_school_settings').upsert(payload, { onConflict: 'user_id' });
    if (error) toast(`학교 설정 계정 저장 오류: ${error.message}`);
  }

  async function loadSettingsFromSupabase() {
    const client = getSupabaseClient();
    if (!client || !state.authUser) return false;
    const { data, error } = await client
      .from('user_school_settings')
      .select('*')
      .eq('user_id', state.authUser.id)
      .maybeSingle();
    if (error) {
      toast(`학교 설정 불러오기 오류: ${error.message}`);
      return false;
    }
    if (data?.school_code) {
      state.settings = { ...state.settings, ...remoteSchoolToLocal(data) };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      return true;
    }
    if (state.settings?.schoolCode) {
      await saveSettingsToSupabase(state.settings);
      toast('브라우저에 저장된 학교 설정을 계정에 저장했어요.');
      return true;
    }
    return false;
  }

  async function deleteSchoolSettingFromSupabase() {
    const client = getSupabaseClient();
    if (!client || !state.authUser) return;
    await client.from('user_school_settings').delete().eq('user_id', state.authUser.id);
  }

  function loadManualEvents() {
    try {
      const rows = JSON.parse(localStorage.getItem(MANUAL_EVENTS_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function saveManualEvents(events) {
    state.manualEvents = Array.isArray(events) ? events : [];
    localStorage.setItem(MANUAL_EVENTS_KEY, JSON.stringify(state.manualEvents));
  }

  function makeManualEvent(row) {
    return {
      id: row.id,
      date: row.date,
      ymd: String(row.date || '').replace(/\D/g, ''),
      dateText: dateTextFromIso(row.date),
      eventName: row.title || '직접 추가 일정',
      eventContent: row.memo || '내가 직접 추가한 우리 학교 일정입니다.',
      source: '직접추가',
      sourceType: 'manual',
      raw: row
    };
  }

  function getManualMonthEvents(year = state.year, month = state.month) {
    return (state.manualEvents || [])
      .filter((row) => {
        const [y, m] = String(row.date || '').split('-').map(Number);
        return y === Number(year) && m === Number(month);
      })
      .map(makeManualEvent);
  }

  function remoteManualToLocal(row) {
    return {
      id: row.id,
      date: row.date,
      title: row.title,
      memo: row.memo || '',
      source: row.source || '직접추가',
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || ''
    };
  }

  async function loadManualEventsFromSupabase() {
    const client = getSupabaseClient();
    if (!client || !state.authUser) {
      state.manualEvents = loadManualEvents();
      return state.manualEvents;
    }

    const { data, error } = await client
      .from('user_manual_events')
      .select('id,date,title,memo,source,created_at,updated_at')
      .eq('user_id', state.authUser.id)
      .order('date', { ascending: true });

    if (error) {
      toast(`직접 추가 일정 불러오기 오류: ${error.message}`);
      state.manualEvents = loadManualEvents();
      return state.manualEvents;
    }

    const remote = (data || []).map(remoteManualToLocal);
    const local = loadManualEvents();
    if (!remote.length && local.length) {
      await migrateLocalManualEventsToSupabase(local);
      return state.manualEvents;
    }

    saveManualEvents(remote);
    return state.manualEvents;
  }

  async function migrateLocalManualEventsToSupabase(localEvents = loadManualEvents()) {
    const client = getSupabaseClient();
    if (!client || !state.authUser || !localEvents.length) return;
    const unique = [];
    const seen = new Set();
    localEvents.forEach((row) => {
      const key = `${row.date || ''}_${String(row.title || '').replace(/\s+/g, '')}`;
      if (row.date && row.title && !seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    });
    if (!unique.length) return;
    const payload = unique.map((row) => ({
      user_id: state.authUser.id,
      date: row.date,
      title: row.title,
      memo: row.memo || '',
      source: '직접추가',
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    const { data, error } = await client
      .from('user_manual_events')
      .insert(payload)
      .select('id,date,title,memo,source,created_at,updated_at');
    if (error) {
      toast(`브라우저 일정 계정 저장 오류: ${error.message}`);
      return;
    }
    saveManualEvents((data || []).map(remoteManualToLocal));
    toast('브라우저에 저장된 직접 추가 일정을 계정에 저장했어요.');
  }

  async function addManualEvent(date, title, memo = '') {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) return false;
    const row = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      title: cleanTitle,
      memo: String(memo || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const client = getSupabaseClient();
    if (client && state.authUser) {
      const { data, error } = await client
        .from('user_manual_events')
        .insert({
          user_id: state.authUser.id,
          date: row.date,
          title: row.title,
          memo: row.memo,
          source: '직접추가',
          created_at: row.createdAt,
          updated_at: row.updatedAt
        })
        .select('id,date,title,memo,source,created_at,updated_at')
        .single();
      if (error) {
        toast(`일정 계정 저장 오류: ${error.message}`);
        return false;
      }
      row.id = data.id;
    }

    saveManualEvents([...(state.manualEvents || loadManualEvents()), row]);
    return true;
  }

  async function deleteManualEvent(id) {
    const client = getSupabaseClient();
    if (client && state.authUser) {
      const { error } = await client
        .from('user_manual_events')
        .delete()
        .eq('user_id', state.authUser.id)
        .eq('id', id);
      if (error) {
        toast(`일정 삭제 오류: ${error.message}`);
        return false;
      }
    }
    saveManualEvents((state.manualEvents || loadManualEvents()).filter((row) => row.id !== id));
    return true;
  }

  function trimTrailingMeta(title = '') {
    let text = String(title || '').trim();
    let prev = '';
    while (text !== prev) {
      prev = text;
      text = text
        .replace(/\([^)]*\)\s*$/, '')
        .replace(/（[^）]*）\s*$/, '')
        .replace(/\[[^\]]*\]\s*$/, '')
        .replace(/[.·,:;]+\s*$/, '')
        .trim();
    }
    return text;
  }

  function isSubmissionTask(task) {
    const department = String(task.department || '').trim();
    if (!department) return false;
    const normalizedTitle = trimTrailingMeta(task.title).replace(/\s+/g, '');
    return /(조사|신청|제출|협조)$/.test(normalizedTitle);
  }


  async function clearSettings() {
    const message = state.authUser
      ? '학교 설정을 초기화할까요? 직접 추가한 일정은 유지됩니다.'
      : '학교 설정을 초기화할까요? 직접 추가한 일정은 유지됩니다.';
    if (!confirm(message)) return;
    await deleteSchoolSettingFromSupabase();
    localStorage.removeItem(SETTINGS_KEY);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('hakdolNeisSchedules_') || key.startsWith('hakdolNeisTimetables_')) localStorage.removeItem(key);
    });
    state.settings = {};
    state.schools = [];
    state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
    renderAll();
    toast('학교 설정과 저장된 학사일정을 초기화했어요. 직접 추가 일정은 유지했어요.');
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
      source: '학사일정',
      sourceType: 'schedule',
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


  function timetableRootName(schoolKind = state.settings.schoolKind || '') {
    const text = String(schoolKind || '').replace(/\s+/g, '');
    if (text.includes('초등')) return 'elsTimetable';
    if (text.includes('중학')) return 'misTimetable';
    return 'hisTimetable';
  }

  function schoolLevelText(schoolKind = state.settings.schoolKind || '') {
    const root = timetableRootName(schoolKind);
    if (root === 'elsTimetable') return '초등학교 시간표';
    if (root === 'misTimetable') return '중학교 시간표';
    return '고등학교 시간표';
  }

  function daysInMonth(year, month) {
    const last = new Date(year, month, 0).getDate();
    return Array.from({ length: last }, (_, idx) => `${year}${pad2(month)}${pad2(idx + 1)}`);
  }

  function isEventLikeLesson(content = '') {
    const compact = String(content || '').replace(/\s+/g, '');
    return Boolean(compact) && TIMETABLE_EVENT_KEYWORDS.some((keyword) => compact.includes(keyword.replace(/\s+/g, '')));
  }

  function normalizeLessonTitle(content = '') {
    return String(content || '시간표 감지 일정').replace(/\s+/g, ' ').trim();
  }

  function gradeLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.endsWith('학년') ? raw : `${raw}학년`;
  }

  function classLabel(grade, className) {
    const g = String(grade || '').trim();
    const c = String(className || '').trim();
    if (g && c) return `${g}-${c}`;
    return c || g || '';
  }

  function formatGrades(grades = []) {
    const clean = [...new Set(grades.map((g) => String(g || '').trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
    if (!clean.length) return '';
    return clean.map((g) => gradeLabel(g)).join(', ');
  }

  function timetableCacheKey(year = state.year, month = state.month, settings = state.settings) {
    if (!settings.officeCode || !settings.schoolCode) return '';
    return `hakdolNeisTimetables_${year}_${pad2(month)}_${settings.officeCode}_${settings.schoolCode}`;
  }

  function loadTimetableCache(year = state.year, month = state.month) {
    const key = timetableCacheKey(year, month);
    if (!key) return null;
    try {
      const cache = JSON.parse(localStorage.getItem(key) || 'null');
      if (!cache) return null;
      if (Date.now() - new Date(cache.fetchedAt || 0).getTime() > TIMETABLE_CACHE_TTL) return null;
      return cache;
    } catch { return null; }
  }

  function saveTimetableCache(year, month, events) {
    const s = state.settings;
    const key = timetableCacheKey(year, month, s);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify({
      year,
      month,
      officeCode: s.officeCode,
      schoolCode: s.schoolCode,
      schoolName: s.schoolName,
      schoolKind: s.schoolKind || '',
      fetchedAt: new Date().toISOString(),
      events
    }));
  }

  async function fetchTimetableRows({ apiKey, officeCode, schoolCode, schoolKind, year, month }) {
    const rootName = timetableRootName(schoolKind);
    if (API_MODE === 'server') {
      const params = {
        officeCode,
        schoolCode,
        schoolKind: schoolKind || '',
        rootName,
        year,
        month,
        pageSize: String(TIMETABLE_PAGE_SIZE)
      };
      const paths = ['timetables', 'timetable'];
      let lastError = null;
      for (const path of paths) {
        try {
          const json = await fetchJson(serverUrl(path, params));
          if (json.error) throw new Error(json.error);
          return json.rows || json.timetables || json.events || [];
        } catch (error) {
          lastError = error;
        }
      }
      console.warn('[Hakdol NEIS] 서버 시간표 API 호출 실패. 백엔드에 /api/timetables 엔드포인트가 필요합니다.', lastError);
      return [];
    }

    const rows = [];
    for (const allTiYmd of daysInMonth(year, month)) {
      for (let page = 1; page <= TIMETABLE_MAX_PAGES_PER_DAY; page += 1) {
        const url = apiUrl(rootName, {
          KEY: apiKey,
          pIndex: String(page),
          pSize: String(TIMETABLE_PAGE_SIZE),
          ATPT_OFCDC_SC_CODE: officeCode,
          SD_SCHUL_CODE: schoolCode,
          AY: String(year),
          ALL_TI_YMD: allTiYmd
        });
        const json = await fetchJson(url);
        const error = parseNeisError(json, rootName);
        if (error && !/자료가 존재하지 않습니다/.test(error)) throw new Error(error);
        const pageRows = json?.[rootName]?.[1]?.row || [];
        rows.push(...pageRows);
        if (pageRows.length < TIMETABLE_PAGE_SIZE) break;
      }
    }
    return rows;
  }

  function extractTimetableEvents(rows = []) {
    const rawEvents = rows
      .filter((row) => isEventLikeLesson(row.ITRT_CNTNT || row.itrtCntnt || row.content))
      .map((row) => {
        const dateRaw = row.ALL_TI_YMD || row.allTiYmd || row.date || '';
        const date = toIsoDate(dateRaw);
        const title = normalizeLessonTitle(row.ITRT_CNTNT || row.itrtCntnt || row.content);
        const grade = row.GRADE || row.grade || '';
        const className = row.CLASS_NM || row.className || row.classNm || '';
        return {
          date,
          ymd: String(dateRaw || '').replace(/\D/g, ''),
          dateText: dateTextFromYmd(dateRaw),
          eventName: title,
          eventContent: '시간표 수업내용에서 자동 감지된 참고 일정입니다.',
          gradeText: gradeLabel(grade),
          source: '시간표',
          sourceType: 'timetable',
          grade: String(grade || '').trim(),
          className: String(className || '').trim(),
          period: String(row.PERIO || row.period || '').trim(),
          raw: row
        };
      })
      .filter((item) => item.date && item.eventName);

    return mergeTimetableEvents(rawEvents);
  }

  function mergeTimetableEvents(events = []) {
    const map = new Map();
    events.forEach((event) => {
      const key = `${event.date}_${event.eventName.replace(/\s+/g, '')}`;
      if (!map.has(key)) {
        map.set(key, {
          ...event,
          grades: new Set(),
          classes: [],
          periods: new Set()
        });
      }
      const merged = map.get(key);
      if (event.grade) merged.grades.add(event.grade);
      const cls = classLabel(event.grade, event.className);
      if (cls) merged.classes.push(cls);
      if (event.period) merged.periods.add(event.period);
    });

    return Array.from(map.values()).map((event) => {
      const grades = Array.from(event.grades).sort((a, b) => Number(a) - Number(b));
      const classes = [...new Set(event.classes)].sort((a, b) => a.localeCompare(b, 'ko-KR', { numeric: true }));
      const periods = Array.from(event.periods).sort((a, b) => Number(a) - Number(b));
      const gradeTextValue = formatGrades(grades);
      return {
        ...event,
        grades,
        classes,
        periods,
        gradeText: gradeTextValue,
        eventName: gradeTextValue ? `${gradeTextValue} ${event.eventName}` : event.eventName
      };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.eventName.localeCompare(b.eventName, 'ko-KR'));
  }

  async function fetchTimetableMonthEvents({ apiKey, officeCode, schoolCode, schoolKind, year, month, force = false }) {
    if (!force) {
      const cached = loadTimetableCache(year, month);
      if (cached) return cached.events || [];
    }
    const rows = await fetchTimetableRows({ apiKey, officeCode, schoolCode, schoolKind, year, month });
    const events = extractTimetableEvents(rows);
    saveTimetableCache(year, month, events);
    return events;
  }

  async function ensureTimetableMonthLoaded({ force = false } = {}) {
    const s = state.settings;
    if (!s.schoolCode || !s.officeCode || state.timetableLoading) return;
    if (!force && loadTimetableCache(state.year, state.month)) return;
    state.timetableLoading = true;
    renderCalendar();
    try {
      const events = await fetchTimetableMonthEvents({
        apiKey: s.apiKey,
        officeCode: s.officeCode,
        schoolCode: s.schoolCode,
        schoolKind: s.schoolKind,
        year: state.year,
        month: state.month,
        force
      });
      console.info(`[Hakdol NEIS] ${state.year}-${pad2(state.month)} 시간표 감지 일정 ${events.length}건`);
    } catch (error) {
      console.warn('[Hakdol NEIS] 시간표 일정 불러오기 실패', error);
    } finally {
      state.timetableLoading = false;
      renderCalendar();
    }
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

  function getBaseYearSchedules(year = state.year) {
    return (loadYearCache(year)?.schedules || []).map((item) => ({ source: '학사일정', sourceType: 'schedule', ...item }));
  }

  function getTimetableMonthEvents(year = state.year, month = state.month) {
    return loadTimetableCache(year, month)?.events || [];
  }

  function getYearSchedules(year = state.year) {
    const base = getBaseYearSchedules(year);
    const timetable = getTimetableMonthEvents(year, state.month);
    const manual = getManualMonthEvents(year, state.month);
    return [...base, ...timetable, ...manual].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.eventName).localeCompare(String(b.eventName), 'ko-KR'));
  }

  function getMonthSchedules(year = state.year, month = state.month) {
    const base = getBaseYearSchedules(year).filter((item) => {
      const [y, m] = String(item.date).split('-').map(Number);
      return y === Number(year) && m === Number(month);
    });
    const timetable = getTimetableMonthEvents(year, month);
    const manual = getManualMonthEvents(year, month);
    return [...base, ...timetable, ...manual].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.eventName).localeCompare(String(b.eventName), 'ko-KR'));
  }

  function getSchedulesByDate(iso) {
    return getMonthSchedules(state.year, state.month).filter((item) => item.date === iso);
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
    return source.filter((task) => Number(task.month) === Number(state.month) && !isSubmissionTask(task));
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
          <p>나이스 학사일정에 시간표 속 체험·수련활동까지 보완해 월별 필수업무와 연결합니다.</p>
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
        <p class="neis-help"><span id="neisStorageHelp">학교 정보와 직접 추가 일정은 이 브라우저에만 저장됩니다. 로그인하면 다른 PC에서도 이어서 사용할 수 있어요.</span> 시간표 일정은 수업내용 키워드로 자동 감지한 참고 일정입니다.</p>
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
            <button class="primary" id="neisLoadSchedule" type="button">학사+시간표 불러오기</button>
            <button class="ghost" id="neisNextMonth" type="button">다음달 →</button>
          </div>
        </div>
        <div class="neis-tabs" role="tablist">
          <button data-neis-tab="all" class="active" type="button">전체보기</button>
          <button data-neis-tab="calendar" type="button">통합 달력</button>
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
    document.getElementById('neisClearBtn')?.addEventListener('click', () => clearSettings());
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
    const storageHelp = document.getElementById('neisStorageHelp');
    if (storageHelp) {
      storageHelp.textContent = state.authUser
        ? '학교 정보와 직접 추가 일정이 계정에 저장됩니다.'
        : '학교 정보와 직접 추가 일정은 이 브라우저에만 저장됩니다. 로그인하면 다른 PC에서도 이어서 사용할 수 있어요.';
    }
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

    title.textContent = `${state.year}년 ${state.month}월 우리 학교 통합 일정 달력`;
    meta.textContent = `${school} · 이번 달 통합일정 ${monthSchedules.length}건 · 추천업무 ${recCount}종`;
    if (cacheMeta) cacheMeta.textContent = cacheStatusText(yearCache);
    if (loadBtn) loadBtn.textContent = yearCache ? '학사+시간표 새로고침' : '학사+시간표 불러오기';

    const sections = [];
    if (state.activeTab === 'all' || state.activeTab === 'calendar') sections.push(renderCalendarSection());
    if (state.activeTab === 'all' || state.activeTab === 'recommend') sections.push(renderRecommendSection());
    if (state.activeTab === 'all' || state.activeTab === 'monthly') sections.push(renderMonthlyLinkSection());
    body.innerHTML = sections.join('');
    bindCalendarDayEvents(body);
  }

  function cacheStatusText(cache) {
    if (!state.settings.schoolCode) return '우리 학교를 먼저 설정해주세요.';
    const timetableCache = loadTimetableCache(state.year, state.month);
    const timetableText = state.timetableLoading
      ? '시간표 감지 일정 불러오는 중'
      : (timetableCache ? `시간표 감지 ${timetableCache.events?.length || 0}건` : '시간표 감지 일정 미저장');
    const manualText = `직접추가 ${getManualMonthEvents(state.year, state.month).length}건`;
    if (!cache) return `${state.year}년 학사일정 미저장 · ${manualText} · 직접 추가 일정은 바로 사용할 수 있어요.`;
    return `${cache.year}년 학사일정 ${cache.schedules?.length || 0}건 · ${timetableText} · ${manualText} · 마지막 업데이트 ${formatDateTime(cache.fetchedAt)}`;
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function renderCalendarSection() {
    const cache = loadYearCache();
    const selectedSchedules = getSchedulesByDate(state.selectedDate);
    const selectedRules = recommendationsForSchedules(selectedSchedules);
    const cacheNotice = cache ? '' : `<div class="neis-empty small neis-calendar-notice"><strong>나이스 일정은 아직 불러오지 않았어요.</strong><span>학교 설정 후 [학사+시간표 불러오기]를 누르거나, 아래 달력에서 우리 학교 일정을 직접 추가할 수 있어요.</span></div>`;
    return `<div class="neis-section">
      <div class="neis-section-head"><h4>📅 우리 학교 통합 달력</h4><span>${esc(state.year)}년 ${esc(state.month)}월</span></div>
      <div class="neis-calendar-legend"><span class="neis-source-badge schedule">학사일정</span><span class="neis-source-badge timetable">시간표 감지</span><span class="neis-source-badge manual">직접추가</span><em>${esc(schoolLevelText())} 수업내용 감지 + 우리 학교 직접 일정</em></div>
      ${cacheNotice}
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
      const events = schedules.slice(0, 2).map((s) => `<span class="neis-event-dot ${s.sourceType === 'timetable' ? 'is-timetable' : (s.sourceType === 'manual' ? 'is-manual' : 'is-schedule')}">${esc(s.eventName || '일정')}</span>`).join('');
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



  function renderScheduleListItem(item) {
    const badgeClass = item.sourceType === 'timetable' ? 'timetable' : (item.sourceType === 'manual' ? 'manual' : 'schedule');
    const deleteButton = item.sourceType === 'manual' && item.id ? `<button type="button" class="neis-delete-manual" data-delete-manual="${esc(item.id)}" title="직접 추가 일정 삭제">삭제</button>` : '';
    return `<li><span class="neis-source-badge ${badgeClass}">${esc(item.source || '학사일정')}</span> ${esc(item.eventName || '일정')}${deleteButton}${item.eventContent ? `<p>${esc(item.eventContent)}</p>` : ''}${item.gradeText && item.sourceType !== 'timetable' ? `<span>${esc(item.gradeText)}</span>` : ''}${item.sourceType === 'timetable' && item.classes?.length ? `<p>${esc(item.classes.slice(0, 12).join(', '))}${item.classes.length > 12 ? ` 외 ${item.classes.length - 12}개 반` : ''}</p>` : ''}</li>`;
  }

  function renderManualEventForm() {
    return `<form class="neis-manual-form" data-manual-form>
      <strong>우리 학교 일정 직접 추가</strong>
      <div class="neis-manual-row">
        <input name="manualTitle" required maxlength="60" placeholder="예: 1학년 현장체험학습, 수련활동" />
        <button type="submit" class="primary">추가</button>
      </div>
      <input name="manualMemo" maxlength="120" placeholder="메모 선택 입력: 장소, 학년, 준비사항 등" />
      <small>나이스에 없는 일정도 이 브라우저에 저장해서 달력에 같이 표시합니다.</small>
    </form>`;
  }

  function renderSelectedDatePanel(schedules, rules) {
    const taskList = uniqueTasks(rules);
    const tools = uniqueTools(rules);
    const dateLabel = `${dateTextFromIso(state.selectedDate)} ${weekdayText(state.selectedDate)}요일`;
    if (!schedules.length) {
      return `<aside class="neis-detail-panel">
        <h4>${esc(dateLabel)}</h4>
        <div class="neis-empty small"><strong>선택한 날짜에 등록된 일정이 없어요.</strong><span>아래에서 우리 학교 일정을 직접 추가할 수 있어요.</span></div>
        ${renderManualEventForm()}
      </aside>`;
    }
    return `<aside class="neis-detail-panel">
      <h4>${esc(dateLabel)}</h4>
      <div class="neis-detail-block">
        <strong>나이스 통합 일정</strong>
        <ul>${schedules.map(renderScheduleListItem).join('')}</ul>
      </div>
      ${renderManualEventForm()}
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
    scope.querySelectorAll('[data-manual-form]').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = form.elements.manualTitle?.value || '';
        const memo = form.elements.manualMemo?.value || '';
        const saved = await addManualEvent(state.selectedDate, title, memo);
        if (!saved) return toast('일정명을 입력해주세요.');
        toast(state.authUser ? '우리 학교 일정을 계정에 저장했어요.' : '우리 학교 일정을 이 브라우저에 추가했어요.');
        renderCalendar();
      });
    });
    scope.querySelectorAll('[data-delete-manual]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await deleteManualEvent(btn.dataset.deleteManual);
        if (!ok) return;
        toast('직접 추가한 일정을 삭제했어요.');
        renderCalendar();
      });
    });
  }

  function renderRecommendSection() {
    const monthSchedules = getMonthSchedules();
    const recs = recommendationsForSchedules(monthSchedules);
    if (!loadYearCache()) {
      return `<div class="neis-empty"><strong>추천업무를 표시하려면 나이스 일정이 필요해요.</strong><span>학사+시간표 일정을 먼저 불러와주세요.</span></div>`;
    }
    if (!recs.length) {
      return `<div class="neis-empty"><strong>이번 달 자동 추천된 업무가 없어요.</strong><span>학사일정과 시간표 감지 일정에 따라 현장체험학습, 방학, 행사, 시험 관련 업무가 표시됩니다.</span></div>`;
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
    const lead = linked.length ? '나이스 일정과 연결된 업무' : '이번 달 챙길 업무';
    return `<div class="neis-section neis-monthly-section"><div class="neis-section-head compact"><h4>🗂️ ${esc(lead)}</h4><span>제출성 업무 제외</span></div><div class="neis-monthly-list">${list.map((task) => {
      const desc = task.description || task.note || '';
      return `<article class="neis-monthly-card">
        <div class="neis-monthly-meta">
          <span class="neis-chip">${esc(task.period || task.periodGroup || '월중')}</span>
          <span class="neis-chip soft">${esc(task.category || '업무')}</span>
          ${linked.includes(task) ? `<span class="neis-chip hot">실제 일정 있음</span>` : ''}
        </div>
        <strong>${esc(task.title || '월별업무')}</strong>
        ${desc ? `<p>${esc(desc)}</p>` : ''}
      </article>`;
    }).join('')}</div></div>`;
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

  async function selectSchool(index) {
    const school = state.schools[index];
    if (!school) return;
    const apiKey = API_MODE === 'client' ? (document.getElementById('neisApiKey')?.value.trim() || state.settings.apiKey || '') : '';
    saveSettings({ apiKey, ...school });
    await saveSettingsToSupabase(state.settings);
    const results = document.getElementById('neisSchoolResults');
    if (results) results.hidden = true;
    renderAll();
    toast(state.authUser ? `${school.schoolName}을 계정에 저장했어요.` : `${school.schoolName}을 이 브라우저에 저장했어요.`);
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
    setBusy('neisLoadSchedule', true, '일정 불러오는 중');
    try {
      const items = await fetchSchoolScheduleYear({ apiKey: s.apiKey, officeCode: s.officeCode, schoolCode: s.schoolCode, year: state.year });
      saveYearCache(state.year, items);
      const timetableEvents = await fetchTimetableMonthEvents({
        apiKey: s.apiKey,
        officeCode: s.officeCode,
        schoolCode: s.schoolCode,
        schoolKind: s.schoolKind,
        year: state.year,
        month: state.month,
        force: true
      });
      state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
      renderCalendar();
      toast(`학사일정 ${items.length}건, 시간표 감지 일정 ${timetableEvents.length}건을 저장했어요.`);
    } catch (error) {
      toast(String(error.message || error || '나이스 API 호출에 실패했어요.'));
    } finally {
      setBusy('neisLoadSchedule', false, loadYearCache() ? '학사+시간표 새로고침' : '학사+시간표 불러오기');
    }
  }

  function changeMonth(delta) {
    const next = new Date(state.year, state.month - 1 + delta, 1);
    state.year = next.getFullYear();
    state.month = next.getMonth() + 1;
    state.selectedDate = `${state.year}-${pad2(state.month)}-01`;
    renderCalendar();
    if (loadYearCache()) ensureTimetableMonthLoaded();
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
    return;
  }

  async function hydrateAccountData() {
    await refreshAuthUser();
    if (state.authUser) {
      await loadSettingsFromSupabase();
      await loadManualEventsFromSupabase();
    } else {
      state.manualEvents = loadManualEvents();
    }
  }

  async function init() {
    injectPanel();
    bindEvents();
    await hydrateAccountData();
    renderAll();
    if (loadYearCache()) ensureTimetableMonthLoaded();
    const client = getSupabaseClient();
    if (client) {
      client.auth.onAuthStateChange(async (_event, session) => {
        state.authUser = session?.user || null;
        await hydrateAccountData();
        renderAll();
      });
    }
    window.addEventListener('hakdol-auth-changed', async (event) => {
      state.authUser = event.detail?.user || null;
      await hydrateAccountData();
      renderAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
