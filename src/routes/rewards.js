const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getCatalog, buyReward } = require('../services/rewardService');
const { success, fail } = require('../utils/response');

// ============================================================
// GET /api/rewards
// Lista todas as recompensas disponíveis no catálogo
// (não requer auth — catálogo é público)
// ============================================================
router.get('/', (req, res) => {
  return success(res, { rewards: getCatalog() });
});

// ============================================================
// POST /api/rewards/buy
// Resgata uma recompensa gastando grãos de milho
// ============================================================
router.post(
  '/buy',
  authenticate,
  [body('reward_id').notEmpty().withMessage('reward_id é obrigatório.')],
  validate,
  async (req, res, next) => {
    const { reward_id } = req.body;

    try {
      const result = await buyReward(req.user.id, reward_id);
      return success(res, {
        message:    `${result.reward.icon} ${result.reward.name} resgatada com sucesso!`,
        new_corns:  result.newCorns,
        reward:     result.reward,
      });
    } catch (err) {
      if (err.status) return fail(res, err.message, err.status, err.code || 'REWARD_ERROR');
      next(err);
    }
  }
);

module.exports = router;
