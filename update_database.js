const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

// Função para executar as atualizações do banco de dados
async function updateDatabase() {
  try {
    console.log('Iniciando atualização do banco de dados...');
    
    // Verificar se a coluna valor_estimado existe
    const tableInfo = await db.promiseAll("PRAGMA table_info(orcamentos)");
    const colunas = tableInfo.map(col => col.name);
    
    // Executar as alterações necessárias
    if (colunas.includes('valor_estimado') && !colunas.includes('valor_total')) {
      console.log('Renomeando coluna valor_estimado para valor_total...');
      await db.promiseRun("ALTER TABLE orcamentos RENAME COLUMN valor_estimado TO valor_total");
    }
    
    // Adicionar coluna tipo_obra se não existir
    if (!colunas.includes('tipo_obra')) {
      console.log('Adicionando coluna tipo_obra...');
      await db.promiseRun("ALTER TABLE orcamentos ADD COLUMN tipo_obra TEXT");
    }
    
    // Adicionar coluna localidade se não existir
    if (!colunas.includes('localidade')) {
      console.log('Adicionando coluna localidade...');
      await db.promiseRun("ALTER TABLE orcamentos ADD COLUMN localidade TEXT");
    }
    
    // Adicionar coluna projeto_id se não existir
    if (!colunas.includes('projeto_id')) {
      console.log('Adicionando coluna projeto_id...');
      await db.promiseRun("ALTER TABLE orcamentos ADD COLUMN projeto_id INTEGER REFERENCES projetos(id)");
    }
    
    // Adicionar coluna margem_lucro se não existir
    if (!colunas.includes('margem_lucro')) {
      console.log('Adicionando coluna margem_lucro...');
      await db.promiseRun("ALTER TABLE orcamentos ADD COLUMN margem_lucro REAL DEFAULT 20");
    }
    
    // Verificar se a tabela orcamento_itens existe
    const tables = await db.promiseAll("SELECT name FROM sqlite_master WHERE type='table' AND name='orcamento_itens'");
    if (tables.length === 0) {
      console.log('Criando tabela orcamento_itens...');
      await db.promiseRun(`
        CREATE TABLE IF NOT EXISTS orcamento_itens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          orcamento_id INTEGER NOT NULL,
          tipo TEXT NOT NULL,
          descricao TEXT NOT NULL,
          quantidade INTEGER DEFAULT 1,
          valor_unitario REAL NOT NULL,
          FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE
        )
      `);
    }
    
    // Criar índices para melhorar performance
    console.log('Criando índices...');
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente ON orcamentos(cliente_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamentos_projeto ON orcamentos(projeto_id)");
    await db.promiseRun("CREATE INDEX IF NOT EXISTS idx_orcamento_itens ON orcamento_itens(orcamento_id)");
    
    console.log('Atualização do banco de dados concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar o banco de dados:', error);
  } finally {
    db.close();
  }
}

// Executar a atualização
updateDatabase();