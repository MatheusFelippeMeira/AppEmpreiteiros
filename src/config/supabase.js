const { createClient } = require('@supabase/supabase-js');

// Obter credenciais do ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função para testar conexão
async function testConnection() {
  try {
    console.log('Testando conexão com Supabase URL:', supabaseUrl ? 'URL configurada' : 'URL não configurada');
    console.log('Testando conexão com Supabase KEY:', supabaseKey ? 'KEY configurada' : 'KEY não configurada');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('ERRO: Credenciais do Supabase não configuradas corretamente');
      return false;
    }
    
    // Consulta simples sem usar count(*) que estava causando o erro
    const { data, error } = await supabase.from('usuarios').select('id').limit(1);
    
    if (error) {
      console.error('ERRO na conexão com Supabase:', error.message);
      console.error('Código do erro:', error.code);
      console.error('Detalhes:', error.details);
      throw error;
    }
    
    console.log('Conexão com Supabase estabelecida com sucesso. Dados:', data);
    return true;
  } catch (err) {
    console.error('Exceção ao conectar com Supabase:', err.message);
    if (err.stack) console.error('Stack:', err.stack);
    return false;
  }
}

// Adaptar interface para ser compatível com SQLite
const db = {
  promiseAll: async (sql, params) => {
    try {
      // Converter SQL para Supabase
      const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
      if (!tableName) throw new Error('Tabela não encontrada na query');
      
      console.log('promiseAll - Consultando tabela:', tableName);
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) {
        console.error('Erro na consulta Supabase:', error.message);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Erro em promiseAll:', err);
      return [];
    }
  },
  
  promiseGet: async (sql, params) => {
    try {
      const tableName = sql.match(/FROM\s+(\w+)/i)?.[1];
      const idMatch = sql.match(/WHERE\s+\w+\.id\s*=\s*\?/i);
      
      if (!tableName) throw new Error('Tabela não encontrada na query');
      
      console.log('promiseGet - Consultando tabela:', tableName);
      console.log('promiseGet - SQL original:', sql);
      console.log('promiseGet - Parâmetros:', params);
      
      if (idMatch && params.length > 0) {
        console.log('promiseGet - Buscando por ID:', params[0]);
        const { data, error } = await supabase.from(tableName).select('*').eq('id', params[0]);
        
        if (error) {
          console.error('Erro na consulta Supabase por ID:', error.message);
          throw error;
        }
        
        // Não usar single() que pode causar erro se não encontrar
        return data && data.length > 0 ? data[0] : null;
      } else {
        console.log('promiseGet - Buscando primeiro registro');
        const { data, error } = await supabase.from(tableName).select('*').limit(1);
        
        if (error) {
          console.error('Erro na consulta Supabase limit:', error.message);
          throw error;
        }
        
        return data && data.length > 0 ? data[0] : null;
      }
    } catch (err) {
      console.error('Erro em promiseGet:', err);
      return null;
    }
  },
  
  promiseRun: async (sql, params) => {
    try {
      // Identificar operação (INSERT, UPDATE, DELETE)
      if (sql.trim().toUpperCase().startsWith('INSERT')) {
        const tableName = sql.match(/INTO\s+(\w+)/i)?.[1];
        if (!tableName) throw new Error('Tabela não encontrada na query');
        
        // Extrair valores para inserção
        const values = {};
        // Simplificação: assumindo que params são os valores na ordem das colunas
        const columns = sql.match(/\(([^)]+)\)/i)?.[1].split(',').map(c => c.trim());
        
        if (columns && columns.length === params.length) {
          columns.forEach((col, i) => {
            values[col] = params[i];
          });
          
          const { data, error } = await supabase.from(tableName).insert(values).select();
          if (error) throw error;
          return { lastID: data[0].id, changes: 1 };
        }
      }
      
      // Implementação simplificada - em produção precisaria de um parser SQL mais robusto
      console.warn('Operação SQL não suportada diretamente:', sql);
      return { lastID: 0, changes: 0 };
    } catch (err) {
      console.error('Erro em promiseRun:', err);
      throw err;
    }
  },
  
  // Métodos adicionais para compatibilidade
  get: (sql, params, callback) => {
    db.promiseGet(sql, params)
      .then(row => callback(null, row))
      .catch(err => callback(err));
  },
  
  all: (sql, params, callback) => {
    db.promiseAll(sql, params)
      .then(rows => callback(null, rows))
      .catch(err => callback(err));
  },
  
  run: function(sql, params, callback) {
    db.promiseRun(sql, params)
      .then(result => {
        if (callback) callback.call({lastID: result.lastID, changes: result.changes});
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },
  
  close: () => {
    // Nada a fazer para Supabase
    console.log('Conexão com Supabase fechada');
  },
  
  tableExists: async (tableName) => {
    try {
      // Usando select('id') em vez de count(*) para evitar o erro de análise
      const { data, error } = await supabase.from(tableName).select('id').limit(1);
      return !error;
    } catch (err) {
      console.error(`Erro ao verificar existência da tabela ${tableName}:`, err);
      return false;
    }
  }
};

module.exports = { supabase, testConnection, db };