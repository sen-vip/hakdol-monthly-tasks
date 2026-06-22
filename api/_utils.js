const NEIS_BASE_URL = 'https://open.neis.go.kr/hub';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleOptions(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function sendJson(res, status, payload) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(payload);
}

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function getApiKey() {
  return process.env.NEIS_API_KEY || process.env.NEIS_KEY || '';
}

function buildNeisUrl(path, params = {}) {
  const query = new URLSearchParams({
    KEY: getApiKey(),
    Type: 'json',
    ...params
  });
  return `${NEIS_BASE_URL}/${path}?${query.toString()}`;
}

async function fetchNeis(path, params = {}) {
  if (!getApiKey()) {
    const error = new Error('NEIS_API_KEY 환경변수가 설정되지 않았습니다.');
    error.status = 500;
    throw error;
  }

  const url = buildNeisUrl(path, params);
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const error = new Error(`나이스 API 호출 실패: HTTP ${response.status}`);
    error.status = response.status;
    error.detail = text.slice(0, 500);
    throw error;
  }

  return json || {};
}

function neisErrorMessage(json, rootName) {
  const head = json?.[rootName]?.[0]?.head;
  const result = Array.isArray(head) ? head.find((item) => item.RESULT)?.RESULT : null;
  if (result?.CODE && result.CODE !== 'INFO-000') return result.MESSAGE || result.CODE;
  if (json?.RESULT?.CODE && json.RESULT.CODE !== 'INFO-000') return json.RESULT.MESSAGE || json.RESULT.CODE;
  return '';
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

function gradeText(row) {
  const checks = [
    ['ONE_GRADE_EVENT_YN', '1학년'],
    ['TW_GRADE_EVENT_YN', '2학년'],
    ['THREE_GRADE_EVENT_YN', '3학년'],
    ['FR_GRADE_EVENT_YN', '4학년'],
    ['FIV_GRADE_EVENT_YN', '5학년'],
    ['SIX_GRADE_EVENT_YN', '6학년']
  ];
  return checks
    .filter(([key]) => String(row?.[key] || '').toUpperCase() === 'Y')
    .map(([, label]) => label)
    .join(', ');
}

function rootNameFromSchoolKind(schoolKind = '', fallback = 'hisTimetable') {
  const text = String(schoolKind || '').replace(/\s+/g, '');
  if (text.includes('초등')) return 'elsTimetable';
  if (text.includes('중학')) return 'misTimetable';
  if (['elsTimetable', 'misTimetable', 'hisTimetable'].includes(fallback)) return fallback;
  return 'hisTimetable';
}

module.exports = {
  setCors,
  handleOptions,
  sendJson,
  required,
  fetchNeis,
  neisErrorMessage,
  toIsoDate,
  dateTextFromYmd,
  gradeText,
  rootNameFromSchoolKind
};
