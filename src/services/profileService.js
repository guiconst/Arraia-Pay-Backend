const { supabaseAdmin } = require('../config/supabase');

/**
 * Busca o perfil de um usuário pelo ID.
 */
async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') return null; // não existe ainda
  if (error) throw new Error('Erro ao buscar perfil: ' + error.message);
  return data;
}

/**
 * Cria o perfil inicial de um usuário recém-registrado.
 * Chamado pelo webhook de Auth do Supabase ou diretamente após registro.
 */
async function createProfile(userId, metadata = {}) {
  // Verifica se já existe (idempotente)
  const existing = await getProfile(userId);
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({
      id:                userId,
      full_name:         metadata.full_name  || '',
      birth_date:        metadata.birth_date || null,
      balance:           0,
      corns:             0,
      has_hat:           false,
      hat_equipped:      false,
      last_temp_c:       null,
      last_weather_code: null,
      last_weather_city: null,
    })
    .select()
    .single();

  if (error) throw new Error('Erro ao criar perfil: ' + error.message);
  return data;
}

/**
 * Atualiza campos do perfil de um usuário.
 * Sempre adiciona updated_at automaticamente.
 */
async function updateProfile(userId, fields) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error('Erro ao atualizar perfil: ' + error.message);
  return data;
}

/**
 * Retorna o saldo atual de um usuário (leitura isolada para uso interno).
 */
async function getBalance(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('balance, corns')
    .eq('id', userId)
    .single();

  if (error) throw new Error('Erro ao buscar saldo: ' + error.message);
  return { balance: data.balance ?? 0, corns: data.corns ?? 0 };
}

module.exports = { getProfile, createProfile, updateProfile, getBalance };
