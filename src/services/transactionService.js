const { supabaseAdmin } = require('../config/supabase');
const { getBalance, updateProfile } = require('./profileService');

const TAX_CARD  = 0.025; // 2,5% para cartão
const CORNS_PER = 10;    // 10 grãos a cada R$10 depositados

/**
 * Calcula taxas, crédito líquido e grãos para um depósito.
 */
function calcDeposit(amount, paymentMethod) {
  const isCard  = paymentMethod === 'card';
  const tax     = isCard ? parseFloat((amount * TAX_CARD).toFixed(2)) : 0;
  const credited = parseFloat((amount - tax).toFixed(2));
  const corns   = Math.floor(amount / CORNS_PER) * CORNS_PER;
  return { tax, credited, corns };
}

/**
 * Processa um depósito de forma atômica:
 * 1. Lê saldo atual do banco (não confia no valor do cliente)
 * 2. Insere a transação
 * 3. Atualiza saldo + grãos no perfil
 *
 * Retorna os dados da transação criada e o novo saldo.
 */
async function processDeposit(userId, amount, paymentMethod) {
  // 1. Valida valor mínimo
  if (!amount || amount < 10) {
    const err = new Error('Valor mínimo para depósito é R$ 10,00.');
    err.status = 400;
    err.code = 'MIN_AMOUNT';
    throw err;
  }

  // 2. Calcula tudo no servidor
  const { tax, credited, corns } = calcDeposit(amount, paymentMethod);

  // 3. Lê saldo atual do banco (fonte da verdade)
  const current = await getBalance(userId);
  const newBalance = parseFloat((current.balance + credited).toFixed(2));
  const newCorns   = current.corns + corns;

  // 4. Insere transação
  const { data: tx, error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id:        userId,
      type:           'deposit',
      amount:         credited,
      payment_method: paymentMethod,
      tax:            tax,
      corns_earned:   corns,
      description:    'Depósito via ' + (paymentMethod === 'card' ? 'Cartão' : 'PIX'),
    })
    .select()
    .single();

  if (txError) {
    const err = new Error('Erro ao registrar transação: ' + txError.message);
    err.status = 500;
    throw err;
  }

  // 5. Atualiza saldo e grãos — usa admin para garantir atomicidade
  await updateProfile(userId, { balance: newBalance, corns: newCorns });

  return {
    transaction: tx,
    credited,
    corns,
    newBalance,
    newCorns,
  };
}

/**
 * Busca as transações de um usuário com suporte a paginação.
 */
async function getTransactions(userId, { page = 1, limit = 20 } = {}) {
  const from = (page - 1) * limit;
  const to   = from + limit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error('Erro ao buscar histórico: ' + error.message);

  return {
    transactions: data,
    total:        count,
    page,
    limit,
    totalPages:   Math.ceil(count / limit),
  };
}

/**
 * Busca as últimas N transações (para o dashboard).
 */
async function getRecentTransactions(userId, limit = 3) {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('Erro ao buscar transações recentes: ' + error.message);
  return data;
}

/**
 * Conta o total de transações de um usuário.
 */
async function countTransactions(userId) {
  const { count, error } = await supabaseAdmin
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw new Error('Erro ao contar transações: ' + error.message);
  return count ?? 0;
}

module.exports = {
  processDeposit,
  getTransactions,
  getRecentTransactions,
  countTransactions,
  calcDeposit,
};
