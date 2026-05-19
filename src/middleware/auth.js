const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware de autenticação.
 * Valida o Bearer token JWT enviado pelo frontend (Supabase Auth).
 * Injeta req.user com os dados do usuário autenticado.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token de autenticação ausente.',
      code: 'MISSING_TOKEN',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Valida o JWT usando o cliente admin do Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Token inválido ou expirado. Faça login novamente.',
        code: 'INVALID_TOKEN',
      });
    }

    req.user  = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('[Auth] Erro ao validar token:', err.message);
    return res.status(500).json({
      error: 'Erro interno ao autenticar.',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Middleware opcional de autenticação.
 * Não bloqueia a requisição se não tiver token — apenas injeta req.user se tiver.
 */
async function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (user) { req.user = user; req.token = token; }
  } catch (_) { /* silencioso */ }
  next();
}

module.exports = { authenticate, authenticateOptional };
