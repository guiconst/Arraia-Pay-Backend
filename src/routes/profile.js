const router = require('express').Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getProfile, updateProfile } = require('../services/profileService');
const { countTransactions } = require('../services/transactionService');
const { success, fail } = require('../utils/response');

// Todos os endpoints de perfil requerem autenticação
router.use(authenticate);

// ============================================================
// GET /api/profile
// Retorna perfil completo do usuário autenticado
// ============================================================
router.get('/', async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return fail(res, 'Perfil não encontrado.', 404, 'PROFILE_NOT_FOUND');

    const txCount = await countTransactions(req.user.id);

    return success(res, {
      profile: {
        id:            profile.id,
        full_name:     profile.full_name,
        email:         req.user.email,
        birth_date:    profile.birth_date,
        balance:       profile.balance ?? 0,
        corns:         profile.corns ?? 0,
        has_hat:       profile.has_hat ?? false,
        hat_equipped:  profile.hat_equipped ?? false,
        tx_count:      txCount,
        last_temp_c:       profile.last_temp_c,
        last_weather_code: profile.last_weather_code,
        last_weather_city: profile.last_weather_city,
        created_at:    profile.created_at,
        updated_at:    profile.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// PATCH /api/profile
// Atualiza dados editáveis do perfil (nome, data de nascimento)
// ============================================================
router.patch(
  '/',
  [
    body('full_name').optional().trim()
      .isLength({ min: 2, max: 120 }).withMessage('Nome deve ter entre 2 e 120 caracteres.'),
    body('birth_date').optional()
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('Data inválida. Use YYYY-MM-DD.'),
  ],
  validate,
  async (req, res, next) => {
    const { full_name, birth_date } = req.body;

    // Só aceita campos permitidos
    const allowedFields = {};
    if (full_name  !== undefined) allowedFields.full_name  = full_name;
    if (birth_date !== undefined) allowedFields.birth_date = birth_date;

    if (Object.keys(allowedFields).length === 0) {
      return fail(res, 'Nenhum campo válido para atualizar.', 400, 'NO_FIELDS');
    }

    try {
      const updated = await updateProfile(req.user.id, allowedFields);
      return success(res, { profile: updated, message: 'Perfil atualizado!' });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// PATCH /api/profile/hat
// Equipa ou remove o chapéu do perfil
// ============================================================
router.patch(
  '/hat',
  [body('equipped').isBoolean().withMessage('equipped deve ser true ou false.')],
  validate,
  async (req, res, next) => {
    try {
      const profile = await getProfile(req.user.id);
      if (!profile) return fail(res, 'Perfil não encontrado.', 404, 'PROFILE_NOT_FOUND');

      if (!profile.has_hat) {
        return fail(res, 'Você ainda não possui o Chapéu de Palha Digital. Resgate-o na loja!', 403, 'HAT_LOCKED');
      }

      const updated = await updateProfile(req.user.id, { hat_equipped: req.body.equipped });
      return success(res, {
        hat_equipped: updated.hat_equipped,
        message: req.body.equipped ? '🎩 Chapéu equipado!' : 'Chapéu removido.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// PATCH /api/profile/weather
// Salva último clima conhecido do usuário (chamado pelo frontend)
// ============================================================
router.patch(
  '/weather',
  [
    body('temp_c').isNumeric().withMessage('temp_c deve ser numérico.'),
    body('weather_code').isInt({ min: 0 }).withMessage('weather_code deve ser inteiro positivo.'),
    body('city').optional().isString().isLength({ max: 100 }),
  ],
  validate,
  async (req, res, next) => {
    const { temp_c, weather_code, city } = req.body;
    try {
      await updateProfile(req.user.id, {
        last_temp_c:       temp_c,
        last_weather_code: weather_code,
        last_weather_city: city || null,
        last_weather_at:   new Date().toISOString(),
      });
      return success(res, { message: 'Clima salvo.' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
