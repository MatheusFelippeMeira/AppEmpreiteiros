/**
 * Script para limpar e recriar o banco de dados no Supabase
 * 
 * Este script apagará todas as tabelas existentes e recriará a estrutura completa
 * usando o arquivo supabase_schema.sql
 * 
 * Para executar:
 * 1. Certifique-se de que as variáveis de ambiente DATABASE_URL estão configuradas
 * 2. Execute: node reset_database.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const readline = require('readline');

// Carregar variáveis de ambiente
dotenv.config();

// Função para confirmar com o usuário
async function confirmarOperacao() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\x1b[31mAVISO: Este script irá APAGAR TODOS OS DADOS do seu banco de dados e recriá-lo.\nTodos os dados serão perdidos. Deseja continuar? (digite "SIM" para confirmar): \x1b[0m', (resposta) => {
      rl.close();
      resolve(resposta === 'SIM');
    });
  });
}

// Função principal
async function resetarBancoDados() {
  console.log('🔄 Iniciando processo de reset do banco de dados...');

  // Confirmação do usuário
  const confirmado = await confirmarOperacao();
  if (!confirmado) {
    console.log('❌ Operação cancelada pelo usuário.');
    return;
  }

  // Conectar ao banco de dados
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Testar conexão
    console.log('🔌 Testando conexão com o banco de dados...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão estabelecida com sucesso!');

    console.log('⚠️ Desativando restrições de chave estrangeira temporariamente...');
    await pool.query('SET session_replication_role = replica;'); // Desativa triggers e restrições FK

    // Apagar tabelas existentes
    console.log('🗑️ Apagando todas as tabelas existentes...');
    
    // Lista de tabelas para apagar na ordem correta (reversa das dependências)
    const tabelas = [
      'adiantamentos',
      'trabalhos',
      'gastos',
      'orcamentos',
      'projetos',
      'clientes',
      'funcionarios',
      'session',
      'usuarios'
    ];

    for (const tabela of tabelas) {
      try {
        await pool.query(`DROP TABLE IF EXISTS "${tabela}" CASCADE`);
        console.log(`  ✓ Tabela ${tabela} apagada`);
      } catch (err) {
        console.error(`  ✗ Erro ao apagar tabela ${tabela}:`, err.message);
      }
    }

    // Ler arquivo schema
    console.log('📝 Lendo arquivo de esquema SQL...');
    const schemaPath = path.join(__dirname, 'src/config/supabase_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Executar script SQL
    console.log('🏗️ Recriando estrutura do banco de dados...');
    await pool.query('BEGIN');
    
    try {
      // Garantir que a extensão uuid-ossp esteja ativada
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      
      // Executar script completo
      await pool.query(schemaSql);
      
      await pool.query('COMMIT');
      console.log('✅ Estrutura do banco de dados recriada com sucesso!');
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('❌ Erro ao recriar estrutura do banco de dados:', err.message);
      throw err;
    }

    // Restaurar restrições de chave estrangeira
    console.log('🔒 Restaurando restrições de chave estrangeira...');
    await pool.query('SET session_replication_role = DEFAULT;');

    // Criar usuário administrador inicial (opcional)
    console.log('👤 Criando usuário administrador padrão...');
    try {
      const bcrypt = require('bcrypt');
      const senhaHash = await bcrypt.hash('admin123', 10);
      
      await pool.query(`
        INSERT INTO usuarios (nome, email, senha, perfil) 
        VALUES ('Administrador', 'admin@exemplo.com', $1, 'admin')
        ON CONFLICT (email) DO NOTHING
      `, [senhaHash]);
      
      console.log('✅ Usuário administrador criado com sucesso!');
      console.log('   Email: admin@exemplo.com');
      console.log('   Senha: admin123');
      console.log('   ⚠️ IMPORTANTE: Altere esta senha após o primeiro login');
    } catch (err) {
      console.error('❌ Erro ao criar usuário administrador:', err.message);
    }

    console.log('🎉 Reset do banco de dados concluído com sucesso!');

  } catch (err) {
    console.error('❌ Erro durante o reset do banco de dados:', err.message);
  } finally {
    // Fechar conexão
    await pool.end();
  }
}

// Executar função principal
resetarBancoDados().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});