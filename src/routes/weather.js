const router = require('express').Router();
const { query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { success, fail } = require('../utils/response');

// ============================================================
// GET /api/weather?lat=...&lon=...
// Proxy para Open-Meteo — oculta a chamada de geolocalização do frontend
// (reduz exposição de IP e evita bloqueio de CORS em casos extremos)
// ============================================================
router.get(
  '/',
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('lat inválido.'),
    query('lon').isFloat({ min: -180, max: 180 }).withMessage('lon inválido.'),
  ],
  validate,
  async (req, res, next) => {
    const { lat, lon } = req.query;

    try {
      const url = `https://api.open-meteo.com/v1/forecast`
        + `?latitude=${lat}&longitude=${lon}`
        + `&current_weather=true`
        + `&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Open-Meteo retornou ' + response.status);

      const data = await response.json();
      const cw   = data.current_weather;

      return success(res, {
        temp_c:       Math.round(cw.temperature),
        weather_code: cw.weathercode ?? 0,
        wind_speed:   cw.windspeed,
        is_day:       cw.is_day === 1,
      });
    } catch (err) {
      console.warn('[Weather] Falha ao buscar clima:', err.message);
      return fail(res, 'Não foi possível obter o clima.', 503, 'WEATHER_UNAVAILABLE');
    }
  }
);

// ============================================================
// GET /api/weather/by-ip
// Detecta cidade aproximada pelo IP do servidor (não do usuário)
// ============================================================
router.get('/by-ip', async (req, res, next) => {
  // Pega o IP real do usuário (respeitando proxies da Vercel)
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || '';

  try {
    const geoRes  = await fetch(`https://ipapi.co/${ip}/json/`);
    const geoData = await geoRes.json();

    if (!geoData.latitude) throw new Error('Sem coordenadas');

    return success(res, {
      lat:  geoData.latitude,
      lon:  geoData.longitude,
      city: geoData.city || null,
    });
  } catch (err) {
    // Fallback: retorna São Paulo
    return success(res, { lat: -23.5505, lon: -46.6333, city: 'São Paulo' });
  }
});

module.exports = router;
