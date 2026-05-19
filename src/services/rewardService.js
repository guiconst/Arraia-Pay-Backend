const { supabaseAdmin } = require('../config/supabase');
const { getBalance, updateProfile } = require('./profileService');

// Catálogo de recompensas disponíveis
const REWARDS_CATALOG = [
  { id: 'chapeu',   name: 'Chapéu de Palha Digital', cost: 150, icon: '🎩', unlocks_hat: true  },
  { id: 'bandeira', name: 'Bandeirinha Festiva',      cost: 80,  icon: '🚩', unlocks_hat: false },
  { id: 'fogueira', name: 'Fogueira de Perfil',       cost: 200, icon: '🔥', unlocks_hat: false },
  { id: 'estrela',  name: 'Estrela Dourada',          cost: 100, icon: '⭐', unlocks_hat: false },
  { id: 'cacique',  name: 'Coroa do Cacique',         cost: 250, icon: '👑', unlocks_hat: false },
  { id: 'balao',    name: 'Balão Colorido',           cost: 60,  icon: '🎈', unlocks_hat: false },
];

/**
 * Retorna o catálogo de recompensas.
 */
function getCatalog() {
  return REWARDS_CATALOG;
}

/**
 * Processa a compra de uma recompensa:
 * 1. Valida se o item existe
 * 2. Lê grãos atuais do banco (não confia no cliente)
 * 3. Verifica se o usuário tem grãos suficientes
 * 4. Debita os grãos e registra a transação
 */
async function buyReward(userId, rewardId) {
  // 1. Valida item
  const reward = REWARDS_CATALOG.find(r => r.id === rewardId);
  if (!reward) {
    const err = new Error('Recompensa não encontrada.');
    err.status = 404;
    err.code = 'REWARD_NOT_FOUND';
    throw err;
  }

  // 2. Lê grãos do banco
  const current = await getBalance(userId);

  // 3. Verifica saldo de grãos
  if (current.corns < reward.cost) {
    const err = new Error(`Grãos insuficientes. Você tem ${current.corns} 🌽 e precisa de ${reward.cost}.`);
    err.status = 400;
    err.code = 'INSUFFICIENT_CORNS';
    throw err;
  }

  const newCorns = current.corns - reward.cost;

  // 4. Registra a transação de recompensa
  const { error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id:        userId,
      type:           'reward',
      amount:         0,
      payment_method: null,
      tax:            0,
      corns_earned:   -reward.cost, // negativo = gasto
      description:    `${reward.icon} ${reward.name} resgatada`,
    });

  if (txError) throw new Error('Erro ao registrar resgate: ' + txError.message);

  // 5. Atualiza perfil (grãos + desbloqueia chapéu se for o caso)
  const profileUpdate = { corns: newCorns };
  if (reward.unlocks_hat) profileUpdate.has_hat = true;

  const updatedProfile = await updateProfile(userId, profileUpdate);

  return {
    reward,
    newCorns,
    profile: updatedProfile,
  };
}

module.exports = { getCatalog, buyReward };
