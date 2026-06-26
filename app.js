(() => {
  'use strict';

  const TASKS = (window.HAKDOL_TASKS || []).map((task) => ({ ...task, isCustom: false }));
  const CONFIG = window.HAKDOL_SUPABASE_CONFIG || { url: '', anonKey: '' };
  const HAS_SUPABASE = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);
  const supabaseClient = HAS_SUPABASE ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey) : null;
  const API_BASE = window.HAKDOL_API_BASE || 'https://hakdol-monthly-tasks.vercel.app';

  const STATE_KEY = 'hakdol-v25-task-states';
  const CUSTOM_KEY = 'hakdol-v25-custom-tasks';
  const SCHOOL_KEY = 'hakdolNeisSettings';
  const SCHEDULE_KEY = 'hakdol-v25-schedules';

  const today = new Date();
  const state = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    selectedDate: isoDate(today),
    view: 'all',
    category: '',
    query: '',
    taskStates: loadJson(STATE_KEY, {}),
    customTasks: loadJson(CUSTOM_KEY, []),
    school: loadJson(SCHOOL_KEY, {}),
    schedules: loadJson(SCHEDULE_KEY, {}),
    user: null
  };

  const OFFICE_LIST = [
    ['B10', '서울특별시교육청'], ['C10', '부산광역시교육청'], ['D10', '대구광역시교육청'], ['E10', '인천광역시교육청'],
    ['F10', '광주광역시교육청'], ['G10', '대전광역시교육청'], ['H10', '울산광역시교육청'], ['I10', '세종특별자치시교육청'],
    ['J10', '경기도교육청'], ['K10', '강원특별자치도교육청'], ['M10', '충청북도교육청'], ['N10', '충청남도교육청'],
    ['P10', '전북특별자치도교육청'], ['Q10', '전라남도교육청'], ['R10', '경상북도교육청'], ['S10', '경상남도교육청'], ['T10', '제주특별자치도교육청']
  ];

  const CATEGORY_ORDER = ['예산','급여','세입','지출','계약','물품','물품재산','시설','환경위생','기록물','민방위','보험','발전기금','안전보건','산업안전보건','학운위','인사','직원교육','교직원교육','법정교육','교육통계','에너지','보안','공유재산','기타'];
  const CATEGORY_CLASS = {
    '예산':'budget','급여':'payroll','세입':'income','지출':'expense','계약':'contract','물품':'goods','물품재산':'assets','공유재산':'assets','시설':'facility','환경위생':'environment','기록물':'records','민방위':'civil','보험':'etc','발전기금':'budget','안전보건':'safety','산업안전보건':'safety','학운위':'budget','인사':'hr','직원교육':'training','교직원교육':'training','법정교육':'training','교육통계':'etc','에너지':'environment','보안':'etc','기타':'etc'
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    headerSchoolName: $('headerSchoolName'), headerMonthBtn: $('headerMonthBtn'), loginBtn: $('loginBtn'), helpBtn: $('helpBtn'),
    summaryTitle: $('summaryTitle'), summaryDesc: $('summaryDesc'), summaryMetrics: $('summaryMetrics'),
    schoolToggleBtn: $('schoolToggleBtn'), schoolPanelBody: $('schoolPanelBody'), schoolSummaryTitle: $('schoolSummaryTitle'), schoolSummaryDesc: $('schoolSummaryDesc'),
    officeSelect: $('officeSelect'), schoolNameInput: $('schoolNameInput'), schoolSearchBtn: $('schoolSearchBtn'), schoolClearBtn: $('schoolClearBtn'), schoolResults: $('schoolResults'),
    prevMonthBtn: $('prevMonthBtn'), nextMonthBtn: $('nextMonthBtn'), calendarMonthBtn: $('calendarMonthBtn'), loadScheduleBtn: $('loadScheduleBtn'), todayBtn: $('todayBtn'), calendarMeta: $('calendarMeta'), calendarGrid: $('calendarGrid'),
    selectedDayPanel: $('selectedDayPanel'), viewFilterChips: $('viewFilterChips'), categoryChips: $('categoryChips'), taskSearchInput: $('taskSearchInput'), addCustomTaskBtn: $('addCustomTaskBtn'),
    taskBoardTitle: $('taskBoardTitle'), taskBoardMeta: $('taskBoardMeta'), taskList: $('taskList'),
    detailModal: $('detailModal'), detailModalBody: $('detailModalBody'), customModal: $('customModal'), customForm: $('customForm'),
    customMonth: $('customMonth'), customPeriod: $('customPeriod'), customCategory: $('customCategory'), customTaskTitle: $('customTaskTitle'), customDepartment: $('customDepartment'), customDesc: $('customDesc'),
    helpModal: $('helpModal'), toast: $('toast')
  };

  function esc(value='') { return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[ch])); }
  function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } }
  function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoDate(date) { return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`; }
  function monthLabel() { return `${state.year}년 ${state.month}월`; }
  function sameMonth(dateString) { return String(dateString || '').startsWith(`${state.year}-${pad2(state.month)}-`); }
  function dateForDay(day) { return `${state.year}-${pad2(state.month)}-${pad2(day)}`; }
  function normalize(value='') { return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function categoryLabel(category='') { return String(category).trim().replace('산업안전보건','안전보건').replace('교직원교육','직원교육'); }
  function catClass(category='') { return CATEGORY_CLASS[categoryLabel(category)] || CATEGORY_CLASS[String(category).trim()] || 'etc'; }
  function categorySort(a,b) { const ia = CATEGORY_ORDER.indexOf(a); const ib = CATEGORY_ORDER.indexOf(b); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b, 'ko'); }
  function toast(message) { els.toast.textContent = message; els.toast.classList.add('show'); setTimeout(() => els.toast.classList.remove('show'), 2200); }

  function allTasks() { return [...TASKS, ...state.customTasks]; }
  function taskState(id) { return state.taskStates[id] || { status: 'todo' }; }
  function setTaskState(id, status) { state.taskStates[id] = { status, updatedAt: new Date().toISOString() }; saveJson(STATE_KEY, state.taskStates); render(); }
  function isSubmissionTask(task) { const text = `${task.title || ''} ${task.description || ''} ${task.note || ''}`.replace(/\s+/g, ''); return /(제출|신청|조사|보고|등록|입력|자료제출|명단제출|결과제출)/.test(text) || /제출$|신청$|조사$|보고$/.test(text); }
  function taskText(task) { return normalize([task.title, task.category, task.department, task.law, task.description, task.note, task.period, task.review].join(' ')); }
  function extractDay(period='') { const match = String(period).match(/(\d{1,2})\s*일?/); return match ? Math.max(1, Math.min(28, Number(match[1]))) : null; }
  function representativeDay(task) {
    const day = extractDay(task.period); if (day) return day;
    const p = `${task.period || ''} ${task.periodGroup || ''}`.replace(/\s+/g, '');
    if (/월초|초순|초경/.test(p)) return 5;
    if (/중순|월중|중경/.test(p)) return 15;
    if (/하순|월말|말일|말경|말까지/.test(p)) return 25;
    return 15;
  }
  function sortScore(task) { return representativeDay(task) * 1000 + (CATEGORY_ORDER.indexOf(categoryLabel(task.category)) < 0 ? 999 : CATEGORY_ORDER.indexOf(categoryLabel(task.category))); }
  function monthTasks() { return allTasks().filter(t => Number(t.month) === state.month).sort((a,b) => sortScore(a) - sortScore(b) || String(a.title).localeCompare(String(b.title),'ko')); }
  function viewFiltered(tasks) { return tasks.filter((task) => state.view === 'all' || (state.view === 'submit' ? isSubmissionTask(task) : !isSubmissionTask(task))); }
  function filteredTasks() {
    return viewFiltered(monthTasks()).filter(task => {
      if (state.category && categoryLabel(task.category) !== state.category) return false;
      if (state.query && !taskText(task).includes(normalize(state.query))) return false;
      return true;
    });
  }
  function tasksForDate(iso) { return filteredTasks().filter(task => dateForDay(representativeDay(task)) === iso); }
  function scheduleForDate(iso) { return (state.schedules[`${state.year}`] || []).filter(s => s.date === iso); }
  function completionStats(tasks=monthTasks()) {
    const filtered = viewFiltered(tasks);
    const total = filtered.length;
    const na = filtered.filter(t => taskState(t.id).status === 'notApplicable').length;
    const target = Math.max(total - na, 0);
    const done = filtered.filter(t => taskState(t.id).status === 'done').length;
    const rate = target ? Math.round(done / target * 100) : 0;
    return { total, na, target, done, rate, submit: tasks.filter(isSubmissionTask).length, check: tasks.filter(t => !isSubmissionTask(t)).length };
  }

  function renderSummary() {
    const stats = completionStats();
    els.summaryTitle.textContent = `${state.month}월 업무판`;
    els.summaryDesc.textContent = '이번 달 행정실 업무를 캘린더에서 먼저 확인하고, 날짜별 상세와 업무분장 필터로 내 업무만 골라 봐요.';
    els.headerMonthBtn.textContent = monthLabel();
    els.calendarMonthBtn.textContent = monthLabel();
    const schoolName = state.school.schoolName || '학교 설정 전';
    els.headerSchoolName.textContent = schoolName;
    els.schoolSummaryTitle.textContent = state.school.schoolName ? `${state.school.schoolName} 기준` : '학교 설정 전';
    els.schoolSummaryDesc.textContent = state.school.schoolName ? `${state.school.officeName || ''} · 학사일정과 행정업무를 함께 확인해요.` : '학교를 선택하면 학사일정과 행정업무를 함께 확인할 수 있어요.';
    els.summaryMetrics.innerHTML = [
      ['업무', `${stats.total}건`], ['제출', `${stats.submit}건`], ['챙길', `${stats.check}건`], ['완료율', `${stats.rate}%`]
    ].map(([label,value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderSchoolPanel() {
    els.officeSelect.innerHTML = OFFICE_LIST.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
    els.officeSelect.value = state.school.officeCode || 'B10';
    if (!els.schoolNameInput.value) els.schoolNameInput.value = state.school.schoolName || '';
  }

  async function searchSchools() {
    const officeCode = els.officeSelect.value;
    const schoolName = els.schoolNameInput.value.trim();
    if (!schoolName) return toast('학교명을 입력해주세요.');
    els.schoolResults.hidden = false;
    els.schoolResults.innerHTML = '<div class="empty-state">학교를 찾는 중입니다...</div>';
    try {
      const url = `${API_BASE}/api/schools?officeCode=${encodeURIComponent(officeCode)}&schoolName=${encodeURIComponent(schoolName)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      const schools = json.schools || [];
      if (!schools.length) { els.schoolResults.innerHTML = '<div class="empty-state">검색 결과가 없어요. 학교명을 조금 줄여 다시 검색해보세요.</div>'; return; }
      els.schoolResults.innerHTML = schools.map((s, idx) => `<button class="school-result" type="button" data-school-index="${idx}"><span><strong>${esc(s.schoolName)}</strong><span>${esc(s.officeName || '')} · ${esc(s.schoolKind || '')} · ${esc(s.address || '')}</span></span><span>선택</span></button>`).join('');
      els.schoolResults.querySelectorAll('[data-school-index]').forEach(btn => btn.addEventListener('click', async () => {
        const s = schools[Number(btn.dataset.schoolIndex)];
        state.school = s;
        saveJson(SCHOOL_KEY, s);
        els.schoolPanelBody.hidden = true;
        els.schoolToggleBtn.setAttribute('aria-expanded', 'false');
        els.schoolResults.hidden = true;
        toast(`${s.schoolName}으로 설정했어요.`);
        render();
        await loadSchedule();
      }));
    } catch (err) {
      els.schoolResults.innerHTML = `<div class="empty-state">학교 검색 실패: ${esc(err.message || '오류')}</div>`;
    }
  }

  async function loadSchedule() {
    if (!state.school.officeCode || !state.school.schoolCode) return toast('학교를 먼저 선택해주세요.');
    els.calendarMeta.textContent = '학사일정을 불러오는 중입니다...';
    try {
      const url = `${API_BASE}/api/schedules?officeCode=${encodeURIComponent(state.school.officeCode)}&schoolCode=${encodeURIComponent(state.school.schoolCode)}&year=${state.year}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '학사일정 조회 실패');
      state.schedules[`${state.year}`] = json.schedules || [];
      saveJson(SCHEDULE_KEY, state.schedules);
      toast('학사일정을 불러왔어요.');
      render();
    } catch (err) {
      els.calendarMeta.textContent = `학사일정 불러오기 실패: ${err.message || '오류'}`;
    }
  }

  function renderCalendar() {
    els.calendarMeta.textContent = state.school.schoolName ? `${state.school.schoolName} · 날짜를 누르면 업무와 학교 일정이 아래에 표시됩니다.` : '학교 설정 전이어도 월별 행정업무는 확인할 수 있어요.';
    const first = new Date(state.year, state.month - 1, 1);
    const last = new Date(state.year, state.month, 0);
    const startBlank = first.getDay();
    const todayIso = isoDate(today);
    let html = ['일','월','화','수','목','금','토'].map(d => `<div class="weekday">${d}</div>`).join('');
    for (let i=0;i<startBlank;i++) html += '<div class="day-cell is-empty"></div>';
    for (let day=1; day<=last.getDate(); day++) {
      const iso = dateForDay(day);
      const dayTasksAll = monthTasks().filter(task => representativeDay(task) === day);
      const dayTasks = viewFiltered(dayTasksAll).filter(task => !state.category || categoryLabel(task.category) === state.category).filter(task => !state.query || taskText(task).includes(normalize(state.query)));
      const schedules = scheduleForDate(iso);
      const submit = dayTasks.filter(isSubmissionTask).length;
      const check = dayTasks.length - submit;
      const cats = [...new Set(dayTasks.slice(0, 3).map(t => categoryLabel(t.category)))];
      const badgeHtml = [
        submit ? `<span class="day-badge submit">제출 ${submit}</span>` : '',
        check ? `<span class="day-badge check">챙김 ${check}</span>` : '',
        ...cats.map(c => `<span class="day-badge cat">${esc(c)} ${dayTasks.filter(t => categoryLabel(t.category) === c).length}</span>`)
      ].filter(Boolean).join('');
      const eventHtml = schedules.slice(0, 2).map(s => `<span class="day-event">${esc(s.eventName || '일정')}</span>`).join('');
      html += `<button class="day-cell ${iso === todayIso ? 'is-today' : ''} ${iso === state.selectedDate ? 'is-selected' : ''}" type="button" data-date="${iso}"><span class="day-number">${day}</span><span class="day-badges">${badgeHtml}</span>${eventHtml}</button>`;
    }
    els.calendarGrid.innerHTML = html;
    els.calendarGrid.querySelectorAll('[data-date]').forEach(btn => btn.addEventListener('click', () => { state.selectedDate = btn.dataset.date; render(); document.getElementById('selectedDayPanel')?.scrollIntoView({behavior:'smooth', block:'nearest'}); }));
  }

  function renderSelectedDate() {
    const date = new Date(`${state.selectedDate}T00:00:00`);
    const dayLabel = `${date.getMonth()+1}월 ${date.getDate()}일 ${'일월화수목금토'[date.getDay()]}요일`;
    const tasks = tasksForDate(state.selectedDate);
    const schedules = scheduleForDate(state.selectedDate);
    const items = [];
    tasks.forEach(task => {
      const status = taskState(task.id).status || 'todo';
      items.push(`<article class="selected-card"><div><div class="selected-card__meta"><span class="kind-chip ${isSubmissionTask(task) ? 'submit' : 'check'}">${isSubmissionTask(task) ? '제출' : '챙김'}</span><span class="category-chip cat-${catClass(task.category)}">${esc(categoryLabel(task.category))}</span></div><h3>${esc(task.title)}</h3><p>${esc(task.department || task.description || '상세를 눌러 내용을 확인해요.')}</p></div><div class="selected-actions"><button class="state-btn ${status === 'done' ? 'done' : ''}" data-status="done" data-id="${esc(task.id)}" type="button">완료</button><button class="state-btn ${status === 'notApplicable' ? 'na' : ''}" data-status="notApplicable" data-id="${esc(task.id)}" type="button">해당없음</button><button class="detail-btn" data-detail="${esc(task.id)}" type="button">상세</button></div></article>`);
    });
    schedules.forEach(s => items.push(`<article class="selected-card"><div><div class="selected-card__meta"><span class="day-badge schedule">학사일정</span></div><h3>${esc(s.eventName || '학교 일정')}</h3><p>${esc(s.eventContent || s.gradeText || '학교 학사일정입니다.')}</p></div></article>`));
    els.selectedDayPanel.innerHTML = `<div class="selected-head"><div><h2>${dayLabel}</h2><p>행정업무 ${tasks.length}건 · 학교일정 ${schedules.length}건</p></div><button class="ghost-btn" id="selectedTodayBtn" type="button">오늘 보기</button></div><div class="selected-list">${items.join('') || '<div class="empty-state">이 날짜에 표시할 업무나 학교 일정이 없어요.</div>'}</div>`;
    els.selectedDayPanel.querySelector('#selectedTodayBtn')?.addEventListener('click', () => { state.selectedDate = isoDate(today); state.year = today.getFullYear(); state.month = today.getMonth() + 1; render(); });
    bindTaskActions(els.selectedDayPanel);
  }

  function renderFilters() {
    els.viewFilterChips.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
    const categories = [...new Set(monthTasks().map(t => categoryLabel(t.category)).filter(Boolean))].sort(categorySort);
    const total = viewFiltered(monthTasks()).length;
    els.categoryChips.innerHTML = `<button class="chip ${state.category === '' ? 'active' : ''}" data-category="" type="button">전체 <span class="count">${total}</span></button>` + categories.map(cat => {
      const count = viewFiltered(monthTasks()).filter(t => categoryLabel(t.category) === cat).length;
      return `<button class="chip ${state.category === cat ? 'active' : ''}" data-category="${esc(cat)}" type="button">${esc(cat)} <span class="count">${count}</span></button>`;
    }).join('');
    els.categoryChips.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => { state.category = btn.dataset.category || ''; render(); }));
  }

  function renderTaskList() {
    const tasks = filteredTasks();
    const stats = completionStats(filteredTasks());
    els.taskBoardTitle.textContent = `${state.month}월 업무 목록`;
    els.taskBoardMeta.textContent = `표시 ${tasks.length}건 · 완료 ${stats.done}건 · 해당없음 ${stats.na}건`;
    if (!tasks.length) { els.taskList.innerHTML = '<div class="empty-state">조건에 맞는 업무가 없어요.</div>'; return; }
    els.taskList.innerHTML = tasks.map(task => {
      const status = taskState(task.id).status || 'todo';
      return `<article class="task-row ${status === 'done' ? 'is-done' : ''} ${status === 'notApplicable' ? 'is-na' : ''}" data-task-row="${esc(task.id)}"><input class="task-check" type="checkbox" data-status="done" data-id="${esc(task.id)}" ${status === 'done' ? 'checked' : ''} aria-label="완료"><span class="period-chip">${esc(task.period || task.periodGroup || '월중')}</span><span class="category-chip cat-${catClass(task.category)}">${esc(categoryLabel(task.category))}</span><div class="task-main"><div class="task-title">${esc(task.title)}</div><div class="task-sub">${esc(task.department || task.description || task.note || '상세 내용 없음')}</div></div><div class="task-status"><button class="state-btn ${status === 'notApplicable' ? 'na' : ''}" data-status="notApplicable" data-id="${esc(task.id)}" type="button">해당없음</button></div><button class="detail-btn" data-detail="${esc(task.id)}" type="button">상세</button></article>`;
    }).join('');
    bindTaskActions(els.taskList);
  }

  function bindTaskActions(root) {
    root.querySelectorAll('[data-status]').forEach(el => el.addEventListener('click', (event) => {
      const id = el.dataset.id;
      const wanted = el.dataset.status;
      const current = taskState(id).status || 'todo';
      setTaskState(id, current === wanted ? 'todo' : wanted);
      event.stopPropagation();
    }));
    root.querySelectorAll('[data-detail]').forEach(btn => btn.addEventListener('click', () => openDetail(btn.dataset.detail)));
  }

  function openDetail(id) {
    const task = allTasks().find(t => t.id === id); if (!task) return;
    const status = taskState(id).status || 'todo';
    els.detailModalBody.innerHTML = `<div class="detail-kicker"><span class="kind-chip">${isSubmissionTask(task) ? '제출업무' : '챙길업무'}</span><span class="category-chip cat-${catClass(task.category)}">${esc(categoryLabel(task.category))}</span></div><h2 class="detail-title" id="detailTitle">${esc(task.title)}</h2><dl class="detail-grid"><dt>월</dt><dd>${esc(task.monthLabel || `${task.month}월`)}</dd><dt>시기</dt><dd>${esc(task.period || task.periodGroup || '-')}</dd><dt>안내부서</dt><dd>${esc(task.department || '-')}</dd><dt>근거</dt><dd>${esc(task.law || '-')}</dd></dl><section class="detail-section"><h3>무엇을 하나요?</h3><p>${esc(task.description || task.note || '관련 공문 또는 학교 상황을 확인해 처리하는 업무입니다.')}</p></section>${task.note ? `<section class="detail-section"><h3>비고</h3><p>${esc(task.note)}</p></section>` : ''}${task.review ? `<section class="detail-section"><h3>검증단 의견</h3><p>${esc(task.review)}</p></section>` : ''}<div class="modal-actions"><button class="state-btn ${status === 'done' ? 'done' : ''}" data-status="done" data-id="${esc(task.id)}" type="button">완료</button><button class="state-btn ${status === 'notApplicable' ? 'na' : ''}" data-status="notApplicable" data-id="${esc(task.id)}" type="button">해당없음</button></div>`;
    bindTaskActions(els.detailModalBody);
    openModal('detailModal');
  }

  function openModal(id) {
    document.querySelectorAll('.modal-backdrop').forEach(m => { if (m.id !== id) m.hidden = true; });
    const modal = $(id);
    if (modal) modal.hidden = false;
  }
  function closeModal(id) { const modal = $(id); if (modal) modal.hidden = true; }
  function closeAllModals() { document.querySelectorAll('.modal-backdrop').forEach(m => { m.hidden = true; }); }

  function changeMonth(delta) {
    const d = new Date(state.year, state.month - 1 + delta, 1);
    state.year = d.getFullYear(); state.month = d.getMonth() + 1;
    const selected = new Date(state.selectedDate + 'T00:00:00');
    if (selected.getFullYear() !== state.year || selected.getMonth() + 1 !== state.month) state.selectedDate = dateForDay(1);
    render();
  }

  function render() { renderSummary(); renderSchoolPanel(); renderCalendar(); renderSelectedDate(); renderFilters(); renderTaskList(); }

  function initEvents() {
    els.schoolToggleBtn.addEventListener('click', () => { const next = els.schoolPanelBody.hidden; els.schoolPanelBody.hidden = !next; els.schoolToggleBtn.setAttribute('aria-expanded', String(next)); });
    els.schoolSearchBtn.addEventListener('click', searchSchools);
    els.schoolNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchSchools(); });
    els.schoolClearBtn.addEventListener('click', () => { state.school = {}; saveJson(SCHOOL_KEY, {}); els.schoolNameInput.value = ''; render(); toast('학교 설정을 초기화했어요.'); });
    els.loadScheduleBtn.addEventListener('click', loadSchedule);
    els.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    els.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    els.todayBtn.addEventListener('click', () => { state.year = today.getFullYear(); state.month = today.getMonth() + 1; state.selectedDate = isoDate(today); render(); });
    $('goTodayBtn').addEventListener('click', () => { state.year = today.getFullYear(); state.month = today.getMonth() + 1; state.selectedDate = isoDate(today); render(); window.scrollTo({top:0, behavior:'smooth'}); });
    els.viewFilterChips.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => { state.view = btn.dataset.view; render(); }));
    els.taskSearchInput.addEventListener('input', () => { state.query = els.taskSearchInput.value; render(); });
    els.addCustomTaskBtn.addEventListener('click', () => { els.customMonth.innerHTML = Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}월</option>`).join(''); els.customMonth.value = state.month; openModal('customModal'); });
    els.customForm.addEventListener('submit', (e) => { e.preventDefault(); const m = Number(els.customMonth.value); const task = { id:`custom-${Date.now()}`, month:m, monthLabel:`${m}월`, period:els.customPeriod.value.trim(), periodGroup:'기타', category:els.customCategory.value.trim(), title:els.customTaskTitle.value.trim(), department:els.customDepartment.value.trim(), description:els.customDesc.value.trim(), law:'', note:'', review:'', source:'직접추가', isCustom:true }; state.customTasks.push(task); saveJson(CUSTOM_KEY, state.customTasks); closeModal('customModal'); els.customForm.reset(); render(); toast('우리 학교 업무를 추가했어요.'); });
    document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.hidden = true; }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });
    els.helpBtn.addEventListener('click', () => openModal('helpModal'));
    els.loginBtn.addEventListener('click', async () => {
      if (!HAS_SUPABASE) return toast('Supabase 설정 후 로그인 저장을 사용할 수 있어요.');
      const email = prompt('로그인 이메일을 입력하세요.');
      const password = email ? prompt('비밀번호를 입력하세요.') : '';
      if (!email || !password) return;
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) return toast(error.message);
      state.user = data.user;
      els.loginBtn.textContent = '로그인됨';
      toast('로그인되었습니다.');
    });
  }

  closeAllModals();
  renderSchoolPanel();
  initEvents();
  render();
})();
