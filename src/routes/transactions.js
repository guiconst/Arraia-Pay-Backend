const router = require('express').Router();
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { processDeposit, getTransactions, getRecentTransactions } = require('../services/transactionService');
const { success, fail } = require('../utils/response');

router.use(authenticate);

// ============================================================
// POST /api/transactions/deposit
// Processa um depósito — cálculos e gravação feitos 100% no servidor
// ============================================================
router.post(
  '/deposit',
  [
    body('amount')
      .isFloat({ min: 10 })
      .withMessage('Valor mínimo de depósito: R$ 10,00.'),
    body('payment_method')
      .isIn(['pix', 'card'])
      .withMessage('Método de pagamento inválido. Use "pix" ou "card".'),
  ],
  validate,
  async (req, res, next) => {
    const { amount, payment_method } = req.body;

    try {
      const result = await processDeposit(req.user.id, parseFloat(amount), payment_method);

      return success(res, {
        message:     'Depósito realizado com sucesso! 🎉',
        credited:    result.credited,
        corns_earned: result.corns,
        new_balance: result.newBalance,
        new_corns:   result.newCorns,
        transaction: {
          id:          result.transaction.id,
          description: result.transaction.description,
          amount:      result.transaction.amount,
          tax:         result.transaction.tax,
          created_at:  result.transaction.created_at,
        },
      }, 201);
    } catch (err) {
      if (err.status) return fail(res, err.message, err.status, err.code || 'DEPOSIT_ERROR');
      next(err);
    }
  }
);

// ============================================================
// GET /api/transactions
// Lista histórico de transações com paginação
// ============================================================
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page deve ser inteiro positivo.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit deve ser entre 1 e 100.'),
  ],
  validate,
  async (req, res, next) => {
    const page  = parseInt(req.query.page  || '1');
    const limit = parseInt(req.query.limit || '20');

    try {
      const result = await getTransactions(req.user.id, { page, limit });
      return success(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// GET /api/transactions/recent
// Busca as últimas 3 transações (para o dashboard home)
// ============================================================
router.get('/recent', async (req, res, next) => {
  const limit = parseInt(req.query.limit || '3');
  try {
    const transactions = await getRecentTransactions(req.user.id, Math.min(limit, 10));
    return success(res, { transactions });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// GET /api/transactions/:id
// Busca uma transação específica por ID
// ============================================================
router.get('/:id', async (req, res, next) => {
  const { supabaseAdmin } = require('../config/supabase');
  try {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id) // garante que só vê as próprias
      .single();

    if (error || !data) return fail(res, 'Transação não encontrada.', 404, 'TX_NOT_FOUND');
    return success(res, { transaction: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
