const router = require('express').Router();
const { body } = require('express-validator');
const { supabaseAdmin, supabaseAnon } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createProfile } = require('../services/profileService');
const { success, fail } = require('../utils/response');

// ============================================================
// POST /api/auth/register
// Cria conta no Supabase Auth + perfil na tabela profiles
// ============================================================
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Nome é obrigatório.')
      .isLength({ max: 120 }).withMessage('Nome muito longo.'),
    body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),
    body('birth_date').optional()
      .isDate({ format: 'YYYY-MM-DD' }).withMessage('Data inválida.'),
  ],
  validate,
  async (req, res, next) => {
    const { name, email, password, birth_date } = req.body;

    try {
      // Cria usuário no Supabase Auth
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: name, birth_date: birth_date || null },
      });

      if (error) {
        // Traduz erros comuns do Supabase para PT-BR
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          return fail(res, 'Este e-mail já possui uma conta.', 409, 'EMAIL_IN_USE');
        }
        return fail(res, error.message, 400, 'AUTH_ERROR');
      }

      // Cria perfil na tabela profiles
      await createProfile(data.user.id, { full_name: name, birth_date });

      return success(res, {
        message: 'Conta criada! Verifique seu e-mail para confirmar o cadastro.',
        userId: data.user.id,
      }, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/login
// Autentica usuário e retorna access_token + refresh_token
// ============================================================
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.'),
    body('password').notEmpty().withMessage('Senha obrigatória.'),
  ],
  validate,
  async (req, res, next) => {
    const { email, password } = req.body;

    try {
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

      if (error) {
        const erros = {
          'Invalid login credentials':  'E-mail ou senha incorretos.',
          'Email not confirmed':         'Confirme seu e-mail antes de entrar.',
          'Too many requests':           'Muitas tentativas. Aguarde e tente novamente.',
        };
        return fail(res, erros[error.message] || error.message, 401, 'LOGIN_FAILED');
      }

      return success(res, {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
        user: {
          id:    data.user.id,
          email: data.user.email,
          name:  data.user.user_metadata?.full_name || null,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/logout
// Invalida a sessão do usuário
// ============================================================
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    // admin.signOut invalida o JWT no Supabase (requer service key)
    await supabaseAdmin.auth.admin.signOut(req.token);
    return success(res, { message: 'Logout realizado com sucesso.' });
  } catch (err) {
    // Mesmo que falhe, retorna sucesso — o frontend já descartou o token
    return success(res, { message: 'Logout realizado.' });
  }
});

// ============================================================
// POST /api/auth/forgot-password
// Envia e-mail de recuperação de senha
// ============================================================
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.')],
  validate,
  async (req, res, next) => {
    const { email } = req.body;
    try {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: (process.env.FRONTEND_URL || 'http://localhost:3000') + '/?reset=true',
      });

      // Não revela se o e-mail existe ou não (segurança)
      if (error) console.warn('[ForgotPassword] Supabase error:', error.message);

      return success(res, {
        message: 'Se este e-mail estiver cadastrado, você receberá um link em breve.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /api/auth/refresh
// Renova o access_token usando o refresh_token
// ============================================================
router.post(
  '/refresh',
  [body('refresh_token').notEmpty().withMessage('refresh_token obrigatório.')],
  validate,
  async (req, res, next) => {
    const { refresh_token } = req.body;
    try {
      const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token });
      if (error) return fail(res, 'Sessão expirada. Faça login novamente.', 401, 'SESSION_EXPIRED');

      return success(res, {
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in:    data.session.expires_in,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// GET /api/auth/me
// Retorna dados do usuário autenticado
// ============================================================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { getProfile } = require('../services/profileService');
    const profile = await getProfile(req.user.id);

    return success(res, {
      user: {
        id:         req.user.id,
        email:      req.user.email,
        name:       profile?.full_name || req.user.user_metadata?.full_name || null,
        birth_date: profile?.birth_date || null,
        balance:    profile?.balance ?? 0,
        corns:      profile?.corns ?? 0,
        has_hat:    profile?.has_hat ?? false,
        hat_equipped: profile?.hat_equipped ?? false,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
