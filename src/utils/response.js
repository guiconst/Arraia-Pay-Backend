/**
 * Utilitários para padronizar respostas JSON da API.
 */

function success(res, data = {}, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}

function fail(res, message, status = 400, code = 'ERROR', details = null) {
  const body = { ok: false, error: message, code };
  if (details) body.details = details;
  return res.status(status).json(body);
}

module.exports = { success, fail };
