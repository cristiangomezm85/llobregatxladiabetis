/* Refresca cada 5 minuts el snapshot que serveix /api/public-stats, perquè
 * la pàgina /dona/ no hagi d'esperar mai el càlcul (uns segons).
 * La programació és a netlify.toml ([functions."public-stats-refresh"]). */
const { calcula, SNAPSHOT_CLAU } = require('./public-stats');
const { desarSnapshot } = require('./lib/store');

exports.handler = async function handler() {
  try {
    const dades = await calcula();
    await desarSnapshot(SNAPSHOT_CLAU, dades);
    return { statusCode: 200, body: 'ok ' + dades.inscritsPagats };
  } catch (err) {
    console.error('[public-stats-refresh]', err);
    return { statusCode: 500, body: 'error' };
  }
};
