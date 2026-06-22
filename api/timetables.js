const { handleOptions, sendJson, required, fetchNeis, neisErrorMessage, rootNameFromSchoolKind } = require('./_utils');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function daysInMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, idx) => `${y}${pad2(m)}${pad2(idx + 1)}`);
}

function clampPageSize(value) {
  const n = Number(value || 300);
  if (!Number.isFinite(n)) return 300;
  return Math.max(50, Math.min(300, Math.floor(n)));
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    const { officeCode, schoolCode, schoolKind, rootName, year, month, pageSize } = req.query || {};
    if (!required(officeCode) || !required(schoolCode) || !required(year) || !required(month)) {
      return sendJson(res, 200, {
        ok: true,
        endpoint: 'timetables',
        message: 'officeCode, schoolCode, year, month를 붙여 호출하면 해당 월 시간표 row가 반환됩니다.',
        example: '/api/timetables?officeCode=B10&schoolCode=7010536&schoolKind=고등학교&year=2026&month=6'
      });
    }

    const apiRootName = rootNameFromSchoolKind(schoolKind, rootName);
    const size = clampPageSize(pageSize);
    const rows = [];
    const maxPagesPerDay = 4;

    for (const allTiYmd of daysInMonth(year, month)) {
      for (let page = 1; page <= maxPagesPerDay; page += 1) {
        const json = await fetchNeis(apiRootName, {
          pIndex: String(page),
          pSize: String(size),
          ATPT_OFCDC_SC_CODE: officeCode,
          SD_SCHUL_CODE: schoolCode,
          AY: String(year),
          ALL_TI_YMD: allTiYmd
        });

        const error = neisErrorMessage(json, apiRootName);
        if (error && !/자료가 존재하지 않습니다/.test(error)) throw new Error(error);

        const pageRows = json?.[apiRootName]?.[1]?.row || [];
        rows.push(...pageRows);
        if (pageRows.length < size) break;
      }
    }

    sendJson(res, 200, {
      ok: true,
      rootName: apiRootName,
      year: Number(year),
      month: Number(month),
      count: rows.length,
      rows
    });
  } catch (error) {
    sendJson(res, error.status || 500, { ok: false, error: error.message || '시간표 조회 실패', detail: error.detail || '' });
  }
};
