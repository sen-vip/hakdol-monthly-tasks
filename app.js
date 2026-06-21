const CONFIG = window.HAKDOL_SUPABASE_CONFIG || { url: "", anonKey: "" };
const HAS_SUPABASE = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);
const supabaseClient = HAS_SUPABASE ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey) : null;

const baseTasks = (window.HAKDOL_TASKS || []).map(t => ({ ...t, isCustom: false }));
const LOCAL_STATE_KEY = "hakdol-monthly-tasks-local-states-v1";
const today = new Date();
const currentMonth = today.getMonth() + 1;
const periodOrder = ["월초", "월중", "중순", "월말", "수시", "기타"];


const categorySortOrder = [
  "예산", "급여", "세입", "지출", "계약",
  "물품", "물품재산", "시설", "환경위생",
  "기록물", "민방위", "보험", "발전기금",
  "산업안전보건", "안전보건", "학운위", "인사",
  "교직원교육", "법정교육", "교육통계",
  "에너지", "보안", "공유재산", "기타"
];

function categorySortIndex(name = "") {
  const normalized = String(name || "").replace(/\s+/g, "").trim();
  const index = categorySortOrder.findIndex(item => item.replace(/\s+/g, "") === normalized);
  return index === -1 ? 999 : index;
}

const categoryColorMap = {
  "예산": "budget",
  "세입": "income",
  "지출": "expense",
  "급여": "payroll",
  "시설": "facility",
  "계약": "contract",
  "물품": "goods",
  "물품재산": "assets",
  "공유재산": "property",
  "환경위생": "environment",
  "인사": "hr",
  "기록물": "records",
  "문서": "records",
  "문서관리": "records",
  "학운위": "committee",
  "발전기금": "fund",
  "산업안전보건": "safety",
  "안전보건": "safety",
  "안전": "safety",
  "민방위": "civil",
  "보험": "insurance",
  "교직원교육": "training",
  "법정교육": "training",
  "교육통계": "stats",
  "에너지": "energy",
  "보안": "security",
  "기타": "etc"
};

function categoryClass(category = "") {
  const normalized = String(category).replace(/\s+/g, "").replace(/\?/g, "");
  if (normalized.includes(",")) return "mixed";
  if (normalized.includes("예산") && normalized.includes("학운위")) return "committee";
  return categoryColorMap[normalized] || "etc";
}

function periodClass(period = "") {
  const normalized = String(period || "").replace(/\s+/g, "");
  if (normalized.includes("월초")) return "early";
  if (normalized.includes("중순")) return "middle";
  if (normalized.includes("월말")) return "late";
  if (normalized.includes("월중")) return "month";
  if (normalized.includes("수시") || normalized.includes("학교")) return "anytime";
  if (normalized.includes("날짜")) return "date";
  return "etc";
}

const whenOptions = [
  { key: "monthly", label: "월중 업무", hint: "월초·월중·중순·월말" },
  { key: "quarter", label: "분기/연간", hint: "날짜지정·기타" },
  { key: "anytime", label: "수시", hint: "학교별 확인" },
];

function getWhenType(task) {
  const group = String(task.periodGroup || task.period || "");
  if (group.includes("수시") || group.includes("학교")) return "anytime";
  if (group.includes("날짜") || group.includes("기타")) return "quarter";
  return "monthly";
}


const state = {
  user: null,
  selectedMonth: currentMonth,
  query: "",
  categories: [],
  period: "",
  whenType: "",
  stateFilter: "",
  submissionFilter: "",
  taskStates: {},
  customTasks: [],
  allMode: false,
  detailFiltersOpen: false,
  showYearBoard: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  authBox: $("authBox"), authHint: $("authHint"), loginOpenBtn: $("loginOpenBtn"), configNotice: $("configNotice"),
  heroTitle: $("heroTitle"), heroMonthTitle: $("heroMonthTitle"), heroSummary: $("heroSummary"), statsGrid: $("statsGrid"), yearBoard: $("yearBoard"), scrollMonthLabel: $("scrollMonthLabel"), toTopBtn: $("toTopBtn"),
  monthFilter: $("monthFilter"), categoryFilter: $("categoryFilter"), periodFilter: $("periodFilter"), stateFilter: $("stateFilter"), searchInput: $("searchInput"),
  detailFilterToggle: $("detailFilterToggle"), detailFilters: $("detailFilters"), selectorBoard: $("selectorBoard"),
  resetFiltersBtn: $("resetFiltersBtn"), taskList: $("taskList"), taskListTitle: $("taskListTitle"), taskListMeta: $("taskListMeta"),
  detailModal: $("detailModal"), detailBody: $("detailBody"), loginModal: $("loginModal"), loginForm: $("loginForm"), signupBtn: $("signupBtn"),
  emailInput: $("emailInput"), passwordInput: $("passwordInput"), addTaskBtn: $("addTaskBtn"), customTaskModal: $("customTaskModal"),
  customTaskForm: $("customTaskForm"), customMonth: $("customMonth"), customPeriod: $("customPeriod"), customCategory: $("customCategory"), customTitle: $("customTitle"), customDesc: $("customDesc"), customMemo: $("customMemo"), toast: $("toast")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function normalizeText(value = "") {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function trimTrailingMeta(title = "") {
  let text = String(title).trim();
  let prev = "";
  while (text !== prev) {
    prev = text;
    text = text
      .replace(/\([^)]*\)\s*$/, "")
      .replace(/（[^）]*）\s*$/, "")
      .replace(/\[[^\]]*\]\s*$/, "")
      .replace(/[.·,:;]+\s*$/, "")
      .trim();
  }
  return text;
}

function isSubmissionTask(task) {
  const department = String(task.department || "").trim();
  if (!department) return false;
  const normalizedTitle = trimTrailingMeta(task.title).replace(/\s+/g, "");
  return /(제출|신청|협조)$/.test(normalizedTitle);
}

function getAllTasks() {
  return [...baseTasks, ...state.customTasks];
}

function getTaskState(taskId) {
  return state.taskStates[taskId] || { done: false, important: false, skipped: false, memo: "" };
}

function loadLocalTaskStates() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_error) {
    return {};
  }
}

function saveLocalTaskStates() {
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state.taskStates || {}));
  } catch (_error) {
    // 저장 공간 제한 등은 조용히 무시합니다.
  }
}

function requireLogin() {
  if (state.user) return true;
  openModal("loginModal");
  toast(HAS_SUPABASE ? "로그인하면 저장할 수 있어요." : "Supabase 연결 후 로그인 저장을 사용할 수 있어요.");
  return false;
}

function getMonthTasks(month) {
  return getAllTasks().filter(t => t.month === month);
}

function matchesSubmissionFilter(task) {
  if (state.submissionFilter === "only") return isSubmissionTask(task);
  if (state.submissionFilter === "exclude") return !isSubmissionTask(task);
  return true;
}

function extractPeriodDay(period = "") {
  const match = String(period).match(/(\d{1,2})\s*일?/);
  return match ? Number(match[1]) : null;
}

function taskFlowBucket(task) {
  let group = String(task.periodGroup || "").trim();
  const period = String(task.period || "").trim();
  if (period.includes("월중")) return "월중";
  if (period.includes("월초")) return "월초";
  if (period.includes("중순")) return "중순";
  if (period.includes("월말") || period === "말일" || period.includes("말까지")) return "월말";
  if (!period && (group === "수시/학교별" || group === "")) group = "월중";
  if (group === "수시/학교별") group = "수시";
  if (group === "날짜지정") {
    const day = extractPeriodDay(period);
    if (day !== null) {
      if (day <= 10) return "월초";
      if (day <= 20) return "중순";
      return "월말";
    }
    if (period.includes("초")) return "월초";
    if (period.includes("중")) return "중순";
    return "월말";
  }
  return group || "기타";
}

function taskSortScore(task) {
  const bucket = taskFlowBucket(task);
  const base = { "월초": 0, "월중": 70, "중순": 100, "월말": 200, "수시": 300, "기타": 400 }[bucket] ?? 400;
  const day = extractPeriodDay(task.period || "");
  let offset = 50;
  if (day !== null) offset = day;
  else if (bucket === "월초") offset = 3;
  else if (bucket === "중순") offset = 15;
  else if (bucket === "월말") offset = 29;
  else if (bucket === "월중") offset = 10;
  else if (bucket === "수시") offset = 0;
  return base + offset;
}

function getFilteredTasks() {
  const q = normalizeText(state.query);
  return getAllTasks().filter(task => {
    if (!state.allMode && task.month !== state.selectedMonth) return false;
    if (state.whenType && getWhenType(task) !== state.whenType) return false;
    if (state.categories.length && !state.categories.includes(task.category)) return false;
    if (state.period && taskFlowBucket(task) !== state.period) return false;
    if (!matchesSubmissionFilter(task)) return false;
    if (q) {
      const hay = normalizeText([task.title, task.category, task.department, task.law, task.description, task.note, task.period].join(" "));
      if (!hay.includes(q)) return false;
    }
    const st = getTaskState(task.id);
    if (state.stateFilter === "done" && !st.done) return false;
    if (state.stateFilter === "undone" && (st.done || st.skipped)) return false;
    if (state.stateFilter === "important" && !st.important) return false;
    if (state.stateFilter === "skipped" && !st.skipped) return false;
    return true;
  });
}

function completionFor(month) {
  const tasks = getMonthTasks(month);
  const actionable = tasks.filter(t => !getTaskState(t.id).skipped);
  const done = actionable.filter(t => getTaskState(t.id).done).length;
  return { total: tasks.length, actionable: actionable.length, done, left: Math.max(actionable.length - done, 0), rate: actionable.length ? Math.round(done / actionable.length * 100) : 0 };
}

function topCategories(month) {
  const counts = new Map();
  getMonthTasks(month).forEach(t => counts.set(t.category, (counts.get(t.category) || 0) + 1));
  return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([name]) => name);
}

function renderAuth() {
  if (!HAS_SUPABASE) els.configNotice.hidden = false;
  if (state.user) {
    const email = state.user.email || "로그인 사용자";
    els.authBox.innerHTML = `<span>내 체크 저장 중 · ${escapeHtml(email)}</span><button class="ghost" id="logoutBtn">로그아웃</button>`;
    $("logoutBtn").addEventListener("click", logout);
  } else {
    els.authBox.innerHTML = `<span>로그인 없이도 볼 수 있어요 · 로그인하면 저장됩니다</span><button class="primary" id="loginOpenBtn">로그인</button>`;
    $("loginOpenBtn").addEventListener("click", () => openModal("loginModal"));
  }
}

function renderFilterOptions() {
  els.monthFilter.innerHTML = `<option value="">전체</option>` + Array.from({ length: 12 }, (_, i) => `<option value="${i+1}">${i+1}월</option>`).join("");
  els.monthFilter.value = state.allMode ? "" : String(state.selectedMonth);
  const categories = [...new Set(getAllTasks().map(t => t.category).filter(Boolean))].sort((a,b) => categorySortIndex(a) - categorySortIndex(b) || a.localeCompare(b, "ko"));
  els.categoryFilter.innerHTML = `<option value="">전체</option>` + categories.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  els.categoryFilter.value = state.categories[0] || "";
  els.periodFilter.value = state.period;
  els.stateFilter.value = state.stateFilter;
  els.customMonth.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i+1}">${i+1}월</option>`).join("");
  els.customMonth.value = state.selectedMonth;
}

function getDashboardBaseTasks() {
  const q = normalizeText(state.query);
  return (state.allMode ? getAllTasks() : getMonthTasks(state.selectedMonth)).filter(task => {
    if (state.categories.length && !state.categories.includes(task.category)) return false;
    if (q) {
      const hay = normalizeText([task.title, task.category, task.department, task.law, task.description, task.note, task.period].join(" "));
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderHeroAndStats() {
  const tasks = getFilteredTasks();
  const base = getDashboardBaseTasks();
  const visibleBase = base.filter(task => matchesSubmissionFilter(task));
  const actionable = visibleBase.filter(t => !getTaskState(t.id).skipped);
  const undone = actionable.filter(t => !getTaskState(t.id).done).length;
  const done = actionable.filter(t => getTaskState(t.id).done).length;
  const rate = actionable.length ? Math.round(done / actionable.length * 100) : 0;
  const submitCount = base.filter(isSubmissionTask).length;
  const early = base.filter(t => taskFlowBucket(t) === "월초").length;
  const monthMiddle = base.filter(t => taskFlowBucket(t) === "월중").length;
  const middle = base.filter(t => taskFlowBucket(t) === "중순").length;
  const late = base.filter(t => taskFlowBucket(t) === "월말").length;
  const undoneValue = state.user ? `${undone}건` : "-";
  const undoneDesc = state.user ? "완료·해당없음 제외" : "로그인 후 확인";

  els.heroTitle.textContent = state.allMode ? "전체 업무판" : `${state.selectedMonth}월 업무판`;
  els.heroMonthTitle.textContent = state.allMode ? "전체업무 보기" : `${state.selectedMonth}월 필수업무`;
  els.heroSummary.textContent = state.allMode
    ? `조건에 맞는 업무 ${tasks.length}건 표시 중 · 월별 업무 흐름을 전체로 확인합니다.`
    : `업무 ${visibleBase.length}건 · 제출업무 ${submitCount}건 · 완료율 ${rate}%`;

  const cards = [
    { key: "all", label: "전체 업무", value: `${base.length}건`, desc: state.allMode ? "등록된 전체 기준" : `${state.selectedMonth}월 기준` },
    { key: "submission", label: "제출업무", value: `${submitCount}건`, desc: "안내부서 제출 필요" },
    { key: "undone", label: "미완료", value: undoneValue, desc: undoneDesc },
    { key: "flow", label: "업무 흐름", value: `월초 ${early} · 월중 ${monthMiddle} · 중순 ${middle} · 월말 ${late}`, desc: "월 흐름순 정렬" }
  ];
  els.statsGrid.innerHTML = cards.map(card => `<button type="button" class="stat-card stat-button" data-stat-action="${card.key}"><small>${card.label}</small><strong>${card.value}</strong><small>${card.desc}</small></button>`).join("");
}

function getSelectorBaseTasks() {
  const q = normalizeText(state.query);
  return getAllTasks().filter(task => {
    if (!state.allMode && task.month !== state.selectedMonth) return false;
    if (q) {
      const hay = normalizeText([task.title, task.category, task.department, task.law, task.description, task.note, task.period].join(" "));
      if (!hay.includes(q)) return false;
    }
    const st = getTaskState(task.id);
    if (state.stateFilter === "done" && !st.done) return false;
    if (state.stateFilter === "undone" && (st.done || st.skipped)) return false;
    if (state.stateFilter === "important" && !st.important) return false;
    if (state.stateFilter === "skipped" && !st.skipped) return false;
    return true;
  });
}

function renderSelectorBoard() {
  if (!els.selectorBoard) return;

  const q = normalizeText(state.query);
  const base = getAllTasks().filter(task => {
    if (!matchesSubmissionFilter(task)) return false;
    if (q) {
      const hay = normalizeText([task.title, task.category, task.department, task.law, task.description, task.note, task.period].join(" "));
      if (!hay.includes(q)) return false;
    }
    const st = getTaskState(task.id);
    if (state.stateFilter === "done" && !st.done) return false;
    if (state.stateFilter === "undone" && (st.done || st.skipped)) return false;
    if (state.stateFilter === "important" && !st.important) return false;
    if (state.stateFilter === "skipped" && !st.skipped) return false;
    return true;
  });

  const monthBase = state.categories.length ? base.filter(t => state.categories.includes(t.category)) : base;
  const monthCounts = new Map();
  monthBase.forEach(t => monthCounts.set(t.month, (monthCounts.get(t.month) || 0) + 1));

  const categoryBase = state.allMode ? base : base.filter(t => t.month === state.selectedMonth);
  const categoryCounts = new Map();
  categoryBase.forEach(t => categoryCounts.set(t.category || "기타", (categoryCounts.get(t.category || "기타") || 0) + 1));
  const sortedCategories = [...categoryCounts.entries()].sort((a, b) => categorySortIndex(a[0]) - categorySortIndex(b[0]) || a[0].localeCompare(b[0], "ko"));
  const categoryTotal = categoryBase.length;

  els.selectorBoard.innerHTML = `
    <article class="selector-panel month-panel">
      <div class="selector-head">
        <strong>1. 월 달력</strong>
      </div>
      <button type="button" class="selector-total ${state.allMode ? "active" : ""}" data-select-group="month" data-select-value="">
        <span>전체</span><b>${monthBase.length}</b>
      </button>
      <div class="selector-divider"></div>
      <div class="month-calendar" role="list" aria-label="월 선택">
        ${Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const active = !state.allMode && state.selectedMonth === month;
          return `<button type="button" class="month-pill ${active ? "active" : ""} ${month === currentMonth ? "is-current" : ""}" data-select-group="month" data-select-value="${month}"><span>${month}월</span><b>${monthCounts.get(month) || 0}</b></button>`;
        }).join("")}
      </div>
    </article>
    <article class="selector-panel wide">
      <div class="selector-head">
        <strong>2. 어떤 업무분장?</strong>
      </div>
      <button type="button" class="selector-total ${state.categories.length ? "" : "active"}" data-select-group="category" data-select-value="">
        <span>전체</span><b>${categoryTotal}</b>
      </button>
      <div class="selector-divider"></div>
      <div class="selector-options">
        ${sortedCategories.map(([name, count]) => `<button type="button" class="select-pill category-pill cat-${categoryClass(name)} ${state.categories.includes(name) ? "active" : ""}" data-select-group="category" data-select-value="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><b>${count}</b></button>`).join("")}
      </div>
    </article>`;

  els.selectorBoard.querySelectorAll("[data-select-group]").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.selectGroup;
      const value = btn.dataset.selectValue || "";
      if (group === "month") {
        state.allMode = !value;
        if (value) state.selectedMonth = Number(value);
        state.showYearBoard = false;
        state.period = "";
        state.whenType = "";
      }
      if (group === "category") {
        if (!value) {
          state.categories = [];
        } else if (state.categories.includes(value)) {
          state.categories = state.categories.filter(item => item !== value);
        } else {
          state.categories = [...state.categories, value];
        }
      }
      render();
    });
  });
}

function renderYearBoard() {
  if (!state.showYearBoard) {
    els.yearBoard.hidden = true;
    els.yearBoard.innerHTML = "";
    return;
  }
  els.yearBoard.hidden = false;
  const counts = Array.from({ length: 12 }, (_, i) => ({ month: i+1, stats: completionFor(i+1) }));
  const max = Math.max(...counts.map(x => x.stats.total));
  els.yearBoard.innerHTML = counts.map(({ month, stats }) => {
    const cats = topCategories(month);
    const active = !state.allMode && month === state.selectedMonth ? " active" : "";
    const hot = stats.total >= Math.max(15, Math.floor(max * 0.75));
    const doneChip = state.user ? `<span class="chip done">완료율 ${stats.rate}%</span>` : "";
    return `<button class="month-card${active}${hot ? " hot-month" : ""}" data-month="${month}">
      <h3>${month}월</h3>
      <p>업무 ${stats.total}건${state.user ? ` · 남은 ${stats.left}건` : ""}</p>
      <div class="chips">${cats.map(c => `<span class="chip category cat-${categoryClass(c)}">${escapeHtml(c)}</span>`).join("")}${hot ? `<span class="chip hot">🔥 업무 집중월</span>` : ""}${doneChip}</div>
    </button>`;
  }).join("");
  document.querySelectorAll(".month-card").forEach(btn => btn.addEventListener("click", () => {
    state.selectedMonth = Number(btn.dataset.month);
    state.allMode = false;
    els.monthFilter.value = String(state.selectedMonth);
    state.showYearBoard = false;
    render();
    scrollToTaskListStart();
  }));
}

function renderTaskList() {
  const tasks = getFilteredTasks();
  els.taskListTitle.textContent = state.allMode ? "전체 필수업무" : `${state.selectedMonth}월 필수업무`;
  els.taskListMeta.textContent = `표시 ${tasks.length}건`;
  if (!tasks.length) {
    els.taskList.innerHTML = `<div class="empty">조건에 맞는 업무가 없습니다.</div>`;
    return;
  }
  const groups = new Map();
  tasks.sort((a,b) => (a.month - b.month) || (taskSortScore(a) - taskSortScore(b)) || a.title.localeCompare(b.title, "ko"));
  tasks.forEach(t => {
    const key = `${t.month}월`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });
  els.taskList.innerHTML = [...groups.entries()].map(([group, list]) => `<article class="period-group month-group">
    <div class="period-title month-title"><h3>${escapeHtml(group)}</h3><span class="chip">${list.length}건</span></div>
    ${list.map(taskCard).join("")}
  </article>`).join("");
  bindTaskButtons();
}

function taskCard(task) {
  const st = getTaskState(task.id);
  const flowGroup = taskFlowBucket(task);
  const cls = ["task-card", `period-${periodClass(flowGroup)}`, st.done ? "done" : "", st.skipped ? "skipped" : ""].join(" ");
  const sourceChip = task.isCustom ? `<span class="chip important">우리 학교 업무</span>` : "";
  const facts = [
    task.department ? `<span>${escapeHtml(task.department)}</span>` : "",
    task.law ? `<span>${escapeHtml(task.law)}</span>` : "",
    task.note ? `<span>참고: ${escapeHtml(task.note)}</span>` : ""
  ].filter(Boolean).join("");
  const statusChips = `${st.done ? `<span class="chip done">완료</span>` : `<span class="chip status">미완료</span>`}${st.important ? `<span class="chip important">중요</span>` : ""}${st.skipped ? `<span class="chip skipped">해당없음</span>` : ""}`;
  return `<div class="${cls}" data-task-id="${task.id}">
    <div class="task-when">
      <input class="task-check" type="checkbox" data-toggle="done" ${st.done ? "checked" : ""} aria-label="완료 체크" />
      <div>
        <strong>${escapeHtml(task.period || task.periodGroup || `${task.month}월`)}</strong>
      </div>
    </div>
    <div class="task-category-col">
      <span class="chip category cat-${categoryClass(task.category)}">${escapeHtml(task.category)}</span>
      ${sourceChip}
    </div>
    <div class="task-main">
      <p class="task-title">${escapeHtml(task.title)}</p>
      ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ""}
      ${facts ? `<div class="task-facts">${facts}</div>` : ""}
      <input class="card-memo" data-memo type="text" value="${escapeHtml(st.memo || "")}" placeholder="로그인 후 내 메모 추가" ${state.user ? "" : "readonly aria-disabled=\"true\""} />
    </div>
    <div class="task-actions">
      <div class="chips task-state-chips">${statusChips}</div>
      <button class="icon-btn ${st.important ? "active" : ""}" data-toggle="important" title="중요 표시">☆</button>
      <button class="icon-btn ${st.skipped ? "active" : ""}" data-toggle="skipped" title="해당없음">—</button>
      <button class="ghost action-detail" data-action="detail">상세</button>
    </div>
  </div>`;
}

function bindTaskButtons() {
  document.querySelectorAll("[data-task-id]").forEach(card => {
    const id = card.dataset.taskId;
    card.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const key = btn.dataset.toggle;
        if (!state.user && key === "important") { ev.preventDefault(); requireLogin(); return; }
        toggleState(id, key, btn.checked);
      });
    });
    const memo = card.querySelector("[data-memo]");
    memo?.addEventListener("focus", () => {
      if (!state.user) requireLogin();
    });
    memo?.addEventListener("blur", () => {
      if (!state.user) return;
      updateMemo(id, memo.value);
    });
    const detail = card.querySelector('[data-action="detail"]');
    detail?.addEventListener("click", () => openDetail(id));
  });
}

function openDetail(taskId) {
  const task = getAllTasks().find(t => t.id === taskId);
  if (!task) return;
  const st = getTaskState(task.id);
  els.detailBody.innerHTML = `<p class="eyebrow">${escapeHtml(task.source || "기본업무")}</p>
    <h2 id="detailTitle">${escapeHtml(task.title)}</h2>
    <div class="chips"><span class="chip category cat-${categoryClass(task.category)}">${escapeHtml(task.category)}</span><span class="chip period period-${periodClass(taskFlowBucket(task))}">${escapeHtml(task.month)}월 · ${escapeHtml(task.period || task.periodGroup)}</span>${st.done ? `<span class="chip done">완료</span>` : ""}${st.important ? `<span class="chip important">중요</span>` : ""}${st.skipped ? `<span class="chip skipped">해당없음</span>` : ""}</div>
    <dl class="detail-grid">
      <dt>월</dt><dd>${escapeHtml(task.monthLabel || `${task.month}월`)}</dd>
      <dt>대략적 일정</dt><dd>${escapeHtml(task.period || "-")}</dd>
      <dt>업무분류</dt><dd>${escapeHtml(task.category || "-")}</dd>
      <dt>안내부서</dt><dd>${escapeHtml(task.department || "-")}</dd>
      <dt>근거 법령</dt><dd>${escapeHtml(task.law || "-")}</dd>
      <dt>간략내용</dt><dd>${escapeHtml(task.description || "-")}</dd>
      <dt>비고</dt><dd>${escapeHtml(task.note || "-")}</dd>
    </dl>
    <hr />
    <label class="stack-form">내 메모<textarea id="detailMemo" rows="5" placeholder="민감정보는 입력하지 마세요." ${state.user ? "" : "disabled"}>${escapeHtml(st.memo || "")}</textarea></label>
    <p class="safety-note">이 앱은 월별 업무 체크 및 개인 메모 저장용입니다. 학생·교직원 개인정보, 급여 세부자료, 계좌번호, 민원 내용 등 민감정보는 입력하지 마세요.</p>
    <div class="button-row"><button class="primary" id="saveMemoBtn">메모 저장</button>${task.isCustom ? `<button class="ghost" id="deleteCustomBtn">우리 학교 업무 삭제</button>` : ""}</div>`;
  openModal("detailModal");
  $("saveMemoBtn").addEventListener("click", () => {
    if (!requireLogin()) return;
    updateMemo(task.id, $("detailMemo").value);
  });
  $("deleteCustomBtn")?.addEventListener("click", () => deleteCustomTask(task.id));
}

function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }

function updateQuickFilters() {
  const buttons = document.querySelectorAll("[data-quick]");
  buttons.forEach(btn => {
    const key = btn.dataset.quick;
    const active = key === "all"
      ? !state.period && !state.stateFilter
      : key === state.period || key === state.stateFilter;
    btn.classList.toggle("active", active);
  });
  els.detailFilters.hidden = !state.detailFiltersOpen;
  els.detailFilterToggle.setAttribute("aria-expanded", String(state.detailFiltersOpen));
  els.detailFilterToggle.textContent = state.detailFiltersOpen ? "상세 필터 닫기" : "상세 필터";
}

function renderSubmissionFilters() {
  document.querySelectorAll("[data-submission-filter]").forEach(btn => {
    const value = btn.dataset.submissionFilter || "";
    btn.classList.toggle("active", value === state.submissionFilter);
  });
}

function renderScrollStatus() {
  return;
}

function updateToTopButton() {
  if (!els.toTopBtn) return;
  els.toTopBtn.classList.toggle("show", window.scrollY > 420);
}

function scrollToTaskListStart() {
  const target = document.querySelector(".period-group") || document.getElementById("taskList") || document.getElementById("taskSectionHead");
  if (!target) return;
  const topbar = document.querySelector(".topbar")?.offsetHeight || 0;
  const monthHeaderOffset = 16;
  const offset = topbar + monthHeaderOffset;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
}

function applyQuickFilter(key) {
  if (key === "all") {
    state.period = "";
    state.stateFilter = "";
  } else if (["월초", "중순", "월말"].includes(key)) {
    state.period = state.period === key ? "" : key;
    state.stateFilter = "";
  } else {
    state.stateFilter = state.stateFilter === key ? "" : key;
    state.period = "";
  }
  if (["undone", "important"].includes(key) && !state.user) openModal("loginModal");
  render();
}

document.addEventListener("click", (ev) => {
  const close = ev.target?.dataset?.close;
  if (close) closeModal(close);
  const action = ev.target?.dataset?.action;
  if (action === "go-today") { state.selectedMonth = currentMonth; state.allMode = false; state.showYearBoard = false; resetSoftFilters(); render(); }
  if (action === "go-year") { state.showYearBoard = true; render(); document.getElementById("yearBoard").scrollIntoView({ block: "start" }); }
  if (action === "show-all") { state.allMode = true; state.showYearBoard = false; els.monthFilter.value = ""; render(); }
  if (action === "print") window.print();
  const statAction = ev.target?.closest?.("[data-stat-action]")?.dataset?.statAction;
  if (statAction) {
    if (statAction === "all") {
      state.submissionFilter = "";
      state.stateFilter = "";
      state.period = "";
      state.whenType = "";
    }
    if (statAction === "submission") {
      state.submissionFilter = "only";
      state.stateFilter = "";
    }
    if (statAction === "undone") {
      if (!state.user) { openModal("loginModal"); toast("로그인하면 미완료 업무를 확인할 수 있어요."); return; }
      state.stateFilter = "undone";
      state.submissionFilter = "";
    }
    if (statAction === "flow") {
      state.submissionFilter = "";
      state.stateFilter = "";
      state.period = "";
      state.whenType = "";
    }
    render();
    setTimeout(scrollToTaskListStart, 0);
  }
});

function resetSoftFilters() {
  state.query = ""; state.categories = []; state.period = ""; state.whenType = ""; state.stateFilter = ""; state.submissionFilter = "";
  els.searchInput.value = "";
}

els.searchInput.addEventListener("input", e => { state.query = e.target.value; render(); });
document.querySelectorAll("[data-submission-filter]").forEach(btn => btn.addEventListener("click", () => { state.submissionFilter = btn.dataset.submissionFilter || ""; render(); }));
els.monthFilter.addEventListener("change", e => { state.allMode = !e.target.value; if (e.target.value) state.selectedMonth = Number(e.target.value); render(); });
els.categoryFilter.addEventListener("change", e => { state.categories = e.target.value ? [e.target.value] : []; render(); });
els.periodFilter.addEventListener("change", e => { state.period = e.target.value; state.whenType = ""; render(); });
els.stateFilter.addEventListener("change", e => { state.stateFilter = e.target.value; if (!state.user && e.target.value) openModal("loginModal"); render(); });
els.resetFiltersBtn.addEventListener("click", () => { state.allMode = false; state.showYearBoard = false; state.selectedMonth = currentMonth; resetSoftFilters(); render(); });
els.detailFilterToggle.addEventListener("click", () => { state.detailFiltersOpen = !state.detailFiltersOpen; render(); });
document.querySelectorAll("[data-quick]").forEach(btn => btn.addEventListener("click", () => applyQuickFilter(btn.dataset.quick)));
els.addTaskBtn.addEventListener("click", () => { if (requireLogin()) openModal("customTaskModal"); });

async function toggleState(taskId, key, checkedValue) {
  const current = getTaskState(taskId);
  const value = key === "done" ? Boolean(checkedValue) : !current[key];
  const next = { ...current, [key]: value };
  if (key === "skipped" && value) next.done = false;
  if (key === "done" && value) next.skipped = false;
  state.taskStates[taskId] = next;
  render();
  await saveTaskState(taskId, next);
}

async function updateMemo(taskId, memo) {
  const next = { ...getTaskState(taskId), memo };
  state.taskStates[taskId] = next;
  render();
  await saveTaskState(taskId, next);
  toast("메모를 저장했어요.");
}

async function saveTaskState(taskId, data) {
  if (!state.user || !HAS_SUPABASE) {
    state.taskStates[taskId] = { ...getTaskState(taskId), ...data, memo: getTaskState(taskId).memo || "" };
    saveLocalTaskStates();
    return;
  }
  const payload = {
    user_id: state.user.id,
    task_id: taskId,
    done: Boolean(data.done),
    important: Boolean(data.important),
    skipped: Boolean(data.skipped),
    memo: data.memo || "",
    updated_at: new Date().toISOString()
  };
  const { error } = await supabaseClient.from("user_task_states").upsert(payload, { onConflict: "user_id,task_id" });
  if (error) toast(`저장 오류: ${error.message}`);
}

async function loadUserData() {
  state.taskStates = {};
  state.customTasks = [];
  if (!state.user || !HAS_SUPABASE) {
    state.taskStates = loadLocalTaskStates();
    return;
  }
  const { data: states, error: stateError } = await supabaseClient.from("user_task_states").select("task_id,done,important,skipped,memo,updated_at").eq("user_id", state.user.id);
  if (stateError) toast(`개인 체크 불러오기 오류: ${stateError.message}`);
  (states || []).forEach(row => { state.taskStates[row.task_id] = { done: row.done, important: row.important, skipped: row.skipped, memo: row.memo || "" }; });

  const { data: customs, error: customError } = await supabaseClient.from("custom_tasks").select("*").eq("user_id", state.user.id).order("month", { ascending: true });
  if (customError) toast(`우리 학교 업무 불러오기 오류: ${customError.message}`);
  state.customTasks = (customs || []).map(row => ({
    id: row.custom_task_id,
    month: row.month,
    monthLabel: `${row.month}월`,
    period: row.period || "",
    periodGroup: groupPeriod(row.period),
    category: row.category || "우리 학교 업무",
    title: row.title,
    department: "",
    law: "",
    description: row.description || "",
    note: row.memo || "",
    source: "우리 학교 추가업무",
    isCustom: true
  }));
}

function groupPeriod(period) {
  const p = String(period || "").trim();
  if (!p) return "월중";
  if (p.includes("월초") || p === "초" || p.includes("초까지") || p.includes("초경")) return "월초";
  if (p.includes("월중")) return "월중";
  if (p.includes("중순") || p === "중" || p.includes("중 ")) return "중순";
  if (p.includes("월말") || p === "말" || p.includes("말일") || p.includes("말까지")) return "월말";
  if (["까지","일","경"].some(x => p.includes(x))) return "날짜지정";
  if (p.includes("수시") || p.includes("학교")) return "수시";
  return "기타";
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!HAS_SUPABASE) { toast("supabase-config.js 설정이 필요합니다."); return; }
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { toast(error.message); return; }
  state.user = data.user;
  closeModal("loginModal");
  await loadUserData();
  render();
  toast("로그인했어요.");
});

els.signupBtn.addEventListener("click", async () => {
  if (!HAS_SUPABASE) { toast("supabase-config.js 설정이 필요합니다."); return; }
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  if (!email || password.length < 6) { toast("이메일과 6자 이상 비밀번호를 입력하세요."); return; }
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) { toast(error.message); return; }
  toast("회원가입 메일을 확인하세요.");
});

async function logout() {
  if (HAS_SUPABASE) await supabaseClient.auth.signOut();
  state.user = null; state.taskStates = loadLocalTaskStates(); state.customTasks = [];
  render(); toast("로그아웃했어요.");
}

els.customTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireLogin()) return;
  const task = {
    custom_task_id: `custom-${crypto.randomUUID()}`,
    user_id: state.user.id,
    month: Number(els.customMonth.value),
    period: els.customPeriod.value.trim(),
    category: els.customCategory.value.trim(),
    title: els.customTitle.value.trim(),
    description: els.customDesc.value.trim(),
    memo: els.customMemo.value.trim(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (!task.title || !task.category) return;
  if (HAS_SUPABASE) {
    const { error } = await supabaseClient.from("custom_tasks").insert(task);
    if (error) { toast(`저장 오류: ${error.message}`); return; }
  }
  els.customTaskForm.reset(); closeModal("customTaskModal"); await loadUserData(); render(); toast("우리 학교 업무를 추가했어요.");
});

async function deleteCustomTask(taskId) {
  if (!state.user) return;
  if (!confirm("이 우리 학교 업무를 삭제할까요?")) return;
  if (HAS_SUPABASE) {
    const { error } = await supabaseClient.from("custom_tasks").delete().eq("user_id", state.user.id).eq("custom_task_id", taskId);
    if (error) { toast(`삭제 오류: ${error.message}`); return; }
  }
  closeModal("detailModal"); await loadUserData(); render(); toast("삭제했어요.");
}

function render() {
  renderAuth();
  renderFilterOptions();
  renderHeroAndStats();
  renderSelectorBoard();
  renderYearBoard();
  renderTaskList();
  updateQuickFilters();
  renderSubmissionFilters();
  renderScrollStatus();
  updateToTopButton();
}

window.addEventListener("scroll", updateToTopButton, { passive: true });

async function init() {
  if (HAS_SUPABASE) {
    const { data } = await supabaseClient.auth.getSession();
    state.user = data.session?.user || null;
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.user = session?.user || null;
      await loadUserData();
      render();
    });
    await loadUserData();
  }
  render();
}

init();
