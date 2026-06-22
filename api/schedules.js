const { handleOptions, sendJson, required, fetchNeis, neisErrorMessage, toIsoDate, dateTextFromYmd, gradeText } = require('./_utils');

function pad2(value) {
  return String(value).padStart(2, '0');
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    const { officeCode, schoolCode, year } = req.query || {};
    if (!required(officeCode) || !required(schoolCode) || !required(year)) {
      return sendJson(res, 200, {
        ok: true,
        endpoint: 'schedules',
        message: 'officeCode, schoolCode, year를 붙여 호출하면 학사일정이 반환됩니다.',
        example: '/api/schedules?officeCode=B10&schoolCode=7010536&year=2026'
      });
    }

    const from = `${year}0101`;
    const to = `${year}1231`;
    const json = await fetchNeis('SchoolSchedule', {
      pIndex: '1',
      pSize: '1000',
      ATPT_OFCDC_SC_CODE: officeCode,
      SD_SCHUL_CODE: schoolCode,
      AA_FROM_YMD: from,
      AA_TO_YMD: to
    });

    const error = neisErrorMessage(json, 'SchoolSchedule');
    if (error && !/자료가 존재하지 않습니다/.test(error)) throw new Error(error);

    const rows = json?.SchoolSchedule?.[1]?.row || [];
    const schedules = rows.map((row) => ({
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

    sendJson(res, 200, { ok: true, schedules });
  } catch (error) {
    sendJson(res, error.status || 500, { ok: false, error: error.message || '학사일정 조회 실패', detail: error.detail || '' });
  }
};
