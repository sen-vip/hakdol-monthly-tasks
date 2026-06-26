const { handleOptions, sendJson, required, fetchNeis, neisErrorMessage } = require('./_utils');

const OFFICE_NAMES = {
  B10: '서울특별시교육청', C10: '부산광역시교육청', D10: '대구광역시교육청', E10: '인천광역시교육청',
  F10: '광주광역시교육청', G10: '대전광역시교육청', H10: '울산광역시교육청', I10: '세종특별자치시교육청',
  J10: '경기도교육청', K10: '강원특별자치도교육청', M10: '충청북도교육청', N10: '충청남도교육청',
  P10: '전북특별자치도교육청', Q10: '전라남도교육청', R10: '경상북도교육청', S10: '경상남도교육청', T10: '제주특별자치도교육청'
};

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;

  try {
    const { officeCode, schoolName } = req.query || {};
    if (!required(officeCode) || !required(schoolName)) {
      return sendJson(res, 200, {
        ok: true,
        endpoint: 'schools',
        message: 'officeCode와 schoolName을 붙여 호출하면 학교 검색 결과가 반환됩니다.',
        example: '/api/schools?officeCode=B10&schoolName=학교명'
      });
    }

    const json = await fetchNeis('schoolInfo', {
      pIndex: '1',
      pSize: '20',
      ATPT_OFCDC_SC_CODE: officeCode,
      SCHUL_NM: schoolName
    });

    const error = neisErrorMessage(json, 'schoolInfo');
    if (error && !/자료가 존재하지 않습니다/.test(error)) throw new Error(error);

    const rows = json?.schoolInfo?.[1]?.row || [];
    const schools = rows.map((row) => ({
      officeCode: row.ATPT_OFCDC_SC_CODE,
      officeName: row.ATPT_OFCDC_SC_NM || OFFICE_NAMES[row.ATPT_OFCDC_SC_CODE] || '',
      schoolCode: row.SD_SCHUL_CODE,
      schoolName: row.SCHUL_NM,
      schoolKind: row.SCHUL_KND_SC_NM || '',
      address: row.ORG_RDNMA || row.ORG_RDNDA || '',
      homepage: row.HMPG_ADRES || ''
    }));

    sendJson(res, 200, { ok: true, schools });
  } catch (error) {
    sendJson(res, error.status || 500, { ok: false, error: error.message || '학교 검색 실패', detail: error.detail || '' });
  }
};
