/**
 * Middleware global de tratamento de erros.
 * Captura qualquer erro não tratado nas rotas e retorna JSON padronizado.
 */
function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor.';

  // Não vaza stack traces em produção
  const body = {
    error: message,
    code:  err.code || 'INTERNAL_ERROR',
  };

  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  console.error(`[Error ${status}] ${req.method} ${req.path} — ${message}`);
  res.status(status).json(body);
}

/**
 * Middleware para rotas não encontradas (404).
 */
function notFound(req, res) {
  res.status(404).json({
    error: `Rota não encontrada: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  });
}

module.exports = { errorHandler, notFound };
