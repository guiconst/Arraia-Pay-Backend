require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes        = require('./routes/auth');
const profileRoutes     = require('./routes/profile');
const transactionRoutes = require('./routes/transactions');
const rewardRoutes      = require('./routes/rewards');
const weatherRoutes     = require('./routes/weather');

const app  = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// SEGURANÇA — headers HTTP
// ============================================================
app.use(helmet());

// ============================================================
// CORS — só aceita requisições do frontend autorizado
// ============================================================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Adicione aqui o domínio da Vercel quando tiver:
  // 'https://arraia-pay.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requests sem origin (ex: Postman, curl) em desenvolvimento
    if (!origin && process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================
// BODY PARSING
// ============================================================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ============================================================
// RATE LIMITING — proteção contra abuso
// ============================================================
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, error: 'Muitas requisições. Tente novamente em alguns minutos.', code: 'RATE_LIMITED' },
});

// Rate limit mais agressivo para endpoints de autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { ok: false, error: 'Muitas tentativas de login. Aguarde 15 minutos.', code: 'AUTH_RATE_LIMITED' },
});

app.use(globalLimiter);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    ok:      true,
    status:  'online',
    service: 'Arraia Pay API',
    version: '1.0.0',
    time:    new Date().toISOString(),
  });
});

// ============================================================
// ROTAS DA API
// ============================================================
app.use('/api/auth',         authLimiter, authRoutes);
app.use('/api/profile',      profileRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/rewards',      rewardRoutes);
app.use('/api/weather',      weatherRoutes);

// ============================================================
// 404 + ERROR HANDLER (devem ser os últimos middlewares)
// ============================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`
  🌽 =====================================
  🎪  Arraia Pay API rodando!
  🌽 =====================================
  ➜  Local:   http://localhost:${PORT}
  ➜  Health:  http://localhost:${PORT}/health
  ➜  Env:     ${process.env.NODE_ENV || 'development'}
  =====================================
  `);
});

module.exports = app;
