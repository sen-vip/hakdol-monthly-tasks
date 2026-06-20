const CONFIG = window.HAKDOL_SUPABASE_CONFIG || { url: "", anonKey: "" };
const HAS_SUPABASE = Boolean(CONFIG.url && CONFIG.anonKey && window.supabase);
const supabaseClient = HAS_SUPABASE ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey) : null;

const baseTasks = (window.HAKDOL_TASKS || []).map(t => ({ ...t, isCustom: false }));
const today = new Date();
const currentMonth = today.getMonth() + 1;
const periodOrder = ["월초", "중순", "월말", "날짜지정", "수시/학교별", "기타"];

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
  if (normalized.includes("수시") || normalized.includes("학교")) return "anytime";
  if (normalized.includes("날짜")) return "date";
  return "etc";
}


const state = {
  user: null,
  selectedMonth: currentMonth,
  query: "",
  category: "",
  period: "",
  stateFilter: "",
  taskStates: {},
  customTasks: [],
  allMode: false,
  detailFiltersOpen: false,
  showYearBoard: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  authBox: $("authBox"), authHint: $("authHint"), loginOpenBtn: $("loginOpenBtn"), configNotice: $("configNotice"),
  heroTitle: $("heroTitle"), heroMonthTitle: $("heroMonthTitle"), heroSummary: $("heroSummary"), statsGrid: $("statsGrid"), yearBoard: $("yearBoard"),
  monthFilter: $("monthFilter"), categoryFilter: $("categoryFilter"), periodFilter: $("periodFilter"), stateFilter: $("stateFilter"), searchInput: $("searchInput"),
  detailFilterToggle: $("detailFilterToggle"), detailFilters: $("detailFilters"),
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

function getAllTasks() {
  return [...baseTasks, ...state.customTasks];
}

function getTaskState(taskId) {
  return state.taskStates[taskId] || { done: false, important: false, skipped: false, memo: "" };
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

function getFilteredTasks() {
  const q = normalizeText(state.query);
  return getAllTasks().filter(task => {
    if (!state.allMode && task.month !== state.selectedMonth) return false;
    if (state.category && task.category !== state.category) return false;
    if (state.period && task.periodGroup !== state.period) return false;
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
  const categories = [...new Set(getAllTasks().map(t => t.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, "ko"));
  els.categoryFilter.innerHTML = `<option value="">전체</option>` + categories.map(c => `<option>${escapeHtml(c)}</option>`).join("");
  els.categoryFilter.value = state.category;
  els.periodFilter.value = state.period;
  els.stateFilter.value = state.stateFilter;
  els.customMonth.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i+1}">${i+1}월</option>`).join("");
  els.customMonth.value = state.selectedMonth;
}

function renderHeroAndStats() {
  const monthLabel = state.allMode ? "전체업무" : `${state.selectedMonth}월`;
  const tasks = getFilteredTasks();
  const base = state.allMode ? getAllTasks() : getMonthTasks(state.selectedMonth);
  const actionable = base.filter(t => !getTaskState(t.id).skipped);
  const undone = actionable.filter(t => !getTaskState(t.id).done).length;
  const early = base.filter(t => t.periodGroup === "월초").length;
  const important = base.filter(t => getTaskState(t.id).important).length;
  const done = actionable.filter(t => getTaskState(t.id).done).length;
  const rate = actionable.length ? Math.round(done / actionable.length * 100) : 0;

  els.heroTitle.textContent = state.allMode ? "전체 업무판" : `${state.selectedMonth}월 업무판`;
  els.heroMonthTitle.textContent = state.allMode ? "전체업무 보기" : `${state.selectedMonth}월 필수업무`;
  els.heroSummary.textContent = state.allMode
    ? `조건에 맞는 업무 ${tasks.length}건 표시 중 · 월별 업무 흐름을 전체로 확인합니다.`
    : `업무 ${base.length}건 · 미완료 ${undone}건 · 완료율 ${rate}%`;

  els.statsGrid.innerHTML = [
    ["전체 업무", `${base.length}건`, state.allMode ? "등록된 전체 기준" : `${state.selectedMonth}월 기준`],
    ["미완료", `${undone}건`, "완료·해당없음 제외"],
    ["월초 업무", `${early}건`, "먼저 챙길 일"],
    ["중요 표시", `${important}건`, state.user ? "내가 표시한 업무" : "로그인 후 저장"]
  ].map(([label, value, desc]) => `<article class="stat-card"><small>${label}</small><strong>${value}</strong><small>${desc}</small></article>`).join("");
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
    document.getElementById("taskSectionHead").scrollIntoView({ block: "start" });
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
  tasks.sort((a,b) => (a.month - b.month) || (periodOrder.indexOf(a.periodGroup) - periodOrder.indexOf(b.periodGroup)) || a.title.localeCompare(b.title, "ko"));
  tasks.forEach(t => {
    const key = state.allMode ? `${t.month}월 · ${t.periodGroup}` : t.periodGroup;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });
  els.taskList.innerHTML = [...groups.entries()].map(([group, list]) => `<article class="period-group">
    <div class="period-title"><h3>${escapeHtml(group)}</h3><span class="chip">${list.length}건</span></div>
    ${list.map(taskCard).join("")}
  </article>`).join("");
  bindTaskButtons();
}

function taskCard(task) {
  const st = getTaskState(task.id);
  const cls = ["task-card", st.done ? "done" : "", st.skipped ? "skipped" : ""].join(" ");
  const sourceChip = task.isCustom ? `<span class="chip important">우리 학교 업무</span>` : "";
  return `<div class="${cls}" data-task-id="${task.id}">
    <input class="task-check" type="checkbox" data-toggle="done" ${st.done ? "checked" : ""} aria-label="완료 체크" />
    <div class="task-main">
      <div class="chips"><span class="chip period period-${periodClass(task.periodGroup)}">${escapeHtml(task.period || task.periodGroup)}</span><span class="chip category cat-${categoryClass(task.category)}">${escapeHtml(task.category)}</span>${sourceChip}${st.done ? `<span class="chip done">완료</span>` : `<span class="chip status">미완료</span>`}${st.important ? `<span class="chip important">중요</span>` : ""}${st.skipped ? `<span class="chip skipped">해당없음</span>` : ""}</div>
      <p class="task-title">${escapeHtml(task.title)}</p>
      <p class="task-desc">${escapeHtml(task.description || task.department || task.law || "상세보기에서 관련 정보를 확인하세요.")}</p>
    </div>
    <div class="task-actions">
      <button class="icon-btn ${st.important ? "active" : ""}" data-toggle="important" title="중요 표시">☆</button>
      <button class="icon-btn ${st.skipped ? "active" : ""}" data-toggle="skipped" title="해당없음">—</button>
      <button class="ghost" data-action="detail">상세</button>
    </div>
  </div>`;
}

function bindTaskButtons() {
  document.querySelectorAll("[data-task-id]").forEach(card => {
    const id = card.dataset.taskId;
    card.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", (ev) => {
        const key = btn.dataset.toggle;
        if (!requireLogin()) { ev.preventDefault(); return; }
        toggleState(id, key, btn.checked);
      });
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
    <div class="chips"><span class="chip category cat-${categoryClass(task.category)}">${escapeHtml(task.category)}</span><span class="chip period period-${periodClass(task.periodGroup)}">${escapeHtml(task.month)}월 · ${escapeHtml(task.period || task.periodGroup)}</span>${st.done ? `<span class="chip done">완료</span>` : ""}${st.important ? `<span class="chip important">중요</span>` : ""}${st.skipped ? `<span class="chip skipped">해당없음</span>` : ""}</div>
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
});

function resetSoftFilters() {
  state.query = ""; state.category = ""; state.period = ""; state.stateFilter = "";
  els.searchInput.value = "";
}

els.searchInput.addEventListener("input", e => { state.query = e.target.value; render(); });
els.monthFilter.addEventListener("change", e => { state.allMode = !e.target.value; if (e.target.value) state.selectedMonth = Number(e.target.value); render(); });
els.categoryFilter.addEventListener("change", e => { state.category = e.target.value; render(); });
els.periodFilter.addEventListener("change", e => { state.period = e.target.value; render(); });
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
  if (!state.user || !HAS_SUPABASE) return;
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
  if (!state.user || !HAS_SUPABASE) return;
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
  if (!p) return "수시/학교별";
  if (p.includes("월초") || p === "초" || p.includes("초까지") || p.includes("초경")) return "월초";
  if (p.includes("중순") || p === "중" || p.includes("중 ")) return "중순";
  if (p.includes("월말") || p === "말" || p.includes("말일") || p.includes("말까지")) return "월말";
  if (["까지","일","경"].some(x => p.includes(x))) return "날짜지정";
  if (p.includes("수시") || p.includes("학교")) return "수시/학교별";
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
  state.user = null; state.taskStates = {}; state.customTasks = [];
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
  renderYearBoard();
  renderTaskList();
  updateQuickFilters();
}

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
