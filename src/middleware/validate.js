const { validationResult } = require('express-validator');

/**
 * Verifica os resultados de validação do express-validator.
 * Se houver erros, retorna 422 com a lista de problemas.
 * Caso contrário, passa para o próximo middleware.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Dados inválidos.',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = { validate };
