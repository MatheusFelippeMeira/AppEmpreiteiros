const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// URL do projeto Supabase (sem o prefixo 'db.')
const supabaseUrl = process.env.SUPABASE_URL || 'https://swrnbxuvewboetodewbi.supabase.co';
// Chave anônima ou chave de serviço do Supabase
const supabaseKey = process.env.SUPABASE_KEY;

// Verificar se as variáveis necessárias estão definidas
if (!supabaseKey) {
  console.error('⚠️ ERRO: Variável de ambiente SUPABASE_KEY não definida!');
  console.error('Por favor, configure a variável SUPABASE_KEY no arquivo .env ou no painel do Render.');
  console.error('Você pode encontrar sua chave no Supabase em: Configurações do Projeto > API > anon/public key');
}

// Criar e exportar o cliente do Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para testar a conexão
const testConnection = async () => {
  try {
    // Tentativa de consulta simples para verificar a conexão
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) throw error;
    
    console.log('✅ Conexão com Supabase API estabelecida com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar à API do Supabase:', error.message);
    return false;
  }
};

// Testar a conexão quando o arquivo é carregado
testConnection().catch(err => {
  console.error('Erro ao testar conexão com Supabase:', err.message);
});

module.exports = { supabase, testConnection };