const { handleOptions, sendJson } = require('./_utils');

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  sendJson(res, 200, {
    ok: true,
    service: 'hakdol-monthly-tasks-neis-api',
    hasNeisKey: Boolean(process.env.NEIS_API_KEY),
    now: new Date().toISOString()
  });
};
