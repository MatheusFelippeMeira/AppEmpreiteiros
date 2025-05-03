/**
 * Script para popular o banco de dados Supabase com dados de exemplo
 * 
 * Este script insere dados de teste em todas as tabelas do sistema
 * Útil para desenvolvimento e testes após limpar o banco
 * 
 * Para executar:
 * 1. Certifique-se de que as variáveis de ambiente DATABASE_URL estão configuradas
 * 2. Execute: node seed_database.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

// Carregar variáveis de ambiente
dotenv.config();

// Data atual para uso nos registros
const hoje = new Date().toISOString().split('T')[0];
const umMesAtras = new Date();
umMesAtras.setMonth(umMesAtras.getMonth() - 1);
const dataUmMesAtras = umMesAtras.toISOString().split('T')[0];

const umMesFuturo = new Date();
umMesFuturo.setMonth(umMesFuturo.getMonth() + 1);
const dataUmMesFuturo = umMesFuturo.toISOString().split('T')[0];

// Dados de exemplo para alimentar o banco
const dadosExemplo = {
  // Funcionários para inserir
  funcionarios: [
    { nome: 'João Silva', contato: '11988887777', funcao: 'Pedreiro', valor_diaria: 150.00, valor_hora_extra: 25.00 },
    { nome: 'Maria Oliveira', contato: '11977776666', funcao: 'Pintora', valor_diaria: 140.00, valor_hora_extra: 20.00 },
    { nome: 'Pedro Santos', contato: '11966665555', funcao: 'Eletricista', valor_diaria: 180.00, valor_hora_extra: 30.00 },
    { nome: 'Ana Souza', contato: '11955554444', funcao: 'Ajudante', valor_diaria: 100.00, valor_hora_extra: 15.00 },
    { nome: 'Carlos Ferreira', contato: '11944443333', funcao: 'Encanador', valor_diaria: 160.00, valor_hora_extra: 25.00 },
  ],

  // Clientes para inserir
  clientes: [
    { nome: 'Marcos Pereira', contato: 'marcos@email.com', telefone: '11933332222', tipo: 'pessoa_fisica', cpf_cnpj: '123.456.789-00' },
    { nome: 'Construções XYZ Ltda', contato: 'contato@xyz.com', telefone: '1133334444', tipo: 'pessoa_juridica', cpf_cnpj: '12.345.678/0001-90' },
    { nome: 'Júlia Mendes', contato: 'julia@email.com', telefone: '11922221111', tipo: 'pessoa_fisica', cpf_cnpj: '987.654.321-00' },
    { nome: 'Lojas ABC S.A.', contato: 'obras@abclojas.com', telefone: '1144445555', tipo: 'pessoa_juridica', cpf_cnpj: '98.765.432/0001-10' },
  ],

  // Projetos para inserir (serão vinculados aos clientes acima)
  projetos: [
    { nome: 'Reforma Residencial', cliente_index: 0, localidade: 'São Paulo - SP', tipo: 'reforma', data_inicio: dataUmMesAtras, data_fim_prevista: dataUmMesFuturo, valor_receber: 15000.00 },
    { nome: 'Construção de Loja', cliente_index: 1, localidade: 'Guarulhos - SP', tipo: 'construcao', data_inicio: dataUmMesAtras, data_fim_prevista: dataUmMesFuturo, valor_receber: 120000.00 },
    { nome: 'Reparos Elétricos', cliente_index: 2, localidade: 'São Paulo - SP', tipo: 'reparo', data_inicio: hoje, data_fim_prevista: dataUmMesFuturo, valor_receber: 3500.00 },
    { nome: 'Pintura Comercial', cliente_index: 3, localidade: 'Osasco - SP', tipo: 'reforma', data_inicio: dataUmMesAtras, data_fim_prevista: hoje, valor_receber: 8000.00, status: 'concluido' },
  ],

  // Orçamentos para inserir
  orcamentos: [
    { cliente_index: 0, titulo: 'Ampliação de Cozinha', tipo_obra: 'reforma', localidade: 'São Paulo - SP', valor_estimado: 25000.00 },
    { cliente_index: 1, titulo: 'Construção de Estacionamento', tipo_obra: 'construcao', localidade: 'São Bernardo - SP', valor_estimado: 45000.00 },
    { cliente_index: 3, titulo: 'Reforma de Banheiros', tipo_obra: 'reforma', localidade: 'Osasco - SP', valor_estimado: 18000.00 },
  ],

  // Usuários adicionais
  usuarios: [
    { nome: 'Usuário Padrão', email: 'usuario@exemplo.com', senha: 'user123', perfil: 'usuario' },
    { nome: 'Gerente', email: 'gerente@exemplo.com', senha: 'gerente123', perfil: 'gerente' },
  ]
};

// Função principal
async function popularBancoDados() {
  console.log('🌱 Iniciando inserção de dados de exemplo...');

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

    // Iniciar uma transação
    await pool.query('BEGIN');
    
    try {
      // Inserir funcionários
      console.log('👷 Inserindo funcionários...');
      const funcionariosIds = [];
      for (const func of dadosExemplo.funcionarios) {
        const result = await pool.query(`
          INSERT INTO funcionarios (nome, contato, funcao, valor_diaria, valor_hora_extra)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [func.nome, func.contato, func.funcao, func.valor_diaria, func.valor_hora_extra]);
        
        funcionariosIds.push(result.rows[0].id);
      }
      console.log(`  ✓ ${funcionariosIds.length} funcionários inseridos`);

      // Inserir clientes
      console.log('👥 Inserindo clientes...');
      const clientesIds = [];
      for (const cliente of dadosExemplo.clientes) {
        const result = await pool.query(`
          INSERT INTO clientes (nome, contato, telefone, tipo, cpf_cnpj)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [cliente.nome, cliente.contato, cliente.telefone, cliente.tipo, cliente.cpf_cnpj]);
        
        clientesIds.push(result.rows[0].id);
      }
      console.log(`  ✓ ${clientesIds.length} clientes inseridos`);

      // Inserir projetos
      console.log('🏗️ Inserindo projetos...');
      const projetosIds = [];
      for (const projeto of dadosExemplo.projetos) {
        const clienteId = clientesIds[projeto.cliente_index];
        const status = projeto.status || 'em_andamento';
        
        const result = await pool.query(`
          INSERT INTO projetos (nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [projeto.nome, clienteId, projeto.localidade, projeto.tipo, projeto.data_inicio, projeto.data_fim_prevista, projeto.valor_receber, status]);
        
        projetosIds.push(result.rows[0].id);
      }
      console.log(`  ✓ ${projetosIds.length} projetos inseridos`);

      // Inserir orçamentos
      console.log('📝 Inserindo orçamentos...');
      for (const orcamento of dadosExemplo.orcamentos) {
        const clienteId = clientesIds[orcamento.cliente_index];
        
        await pool.query(`
          INSERT INTO orcamentos (cliente_id, titulo, tipo_obra, localidade, valor_estimado)
          VALUES ($1, $2, $3, $4, $5)
        `, [clienteId, orcamento.titulo, orcamento.tipo_obra, orcamento.localidade, orcamento.valor_estimado]);
      }
      console.log(`  ✓ ${dadosExemplo.orcamentos.length} orçamentos inseridos`);

      // Inserir registros de trabalho
      console.log('💼 Inserindo registros de trabalho...');
      for (let i = 0; i < 20; i++) {
        // Gerar data aleatória nos últimos 30 dias
        const dataRandom = new Date();
        dataRandom.setDate(dataRandom.getDate() - Math.floor(Math.random() * 30));
        const dataTrabalho = dataRandom.toISOString().split('T')[0];
        
        // Selecionar funcionário e projeto aleatório
        const funcionarioIndex = Math.floor(Math.random() * funcionariosIds.length);
        const projetoIndex = Math.floor(Math.random() * projetosIds.length);
        
        // Dados aleatórios para o trabalho
        const diasTrabalhados = Math.random() < 0.2 ? 0.5 : 1; // 20% de chance de meio dia
        const horasExtras = Math.random() < 0.3 ? Math.floor(Math.random() * 4) + 1 : 0; // 30% de chance de horas extras
        const empreitada = Math.random() < 0.2; // 20% de chance de ser empreitada
        const valorEmpreitada = empreitada ? (Math.floor(Math.random() * 10) + 1) * 100 : 0;
        
        await pool.query(`
          INSERT INTO trabalhos (funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          funcionariosIds[funcionarioIndex], 
          projetosIds[projetoIndex], 
          dataTrabalho, 
          diasTrabalhados, 
          horasExtras, 
          empreitada, 
          valorEmpreitada
        ]);
      }
      console.log(`  ✓ 20 registros de trabalho inseridos`);

      // Inserir adiantamentos
      console.log('💰 Inserindo adiantamentos...');
      for (let i = 0; i < 10; i++) {
        // Gerar data aleatória nos últimos 30 dias
        const dataRandom = new Date();
        dataRandom.setDate(dataRandom.getDate() - Math.floor(Math.random() * 30));
        const dataAdiantamento = dataRandom.toISOString().split('T')[0];
        
        // Selecionar funcionário aleatório
        const funcionarioIndex = Math.floor(Math.random() * funcionariosIds.length);
        
        // Valor aleatório entre R$ 50 e R$ 500
        const valor = (Math.floor(Math.random() * 46) + 5) * 10;
        const descricao = 'Adiantamento salarial';
        
        await pool.query(`
          INSERT INTO adiantamentos (funcionario_id, valor, data, descricao)
          VALUES ($1, $2, $3, $4)
        `, [funcionariosIds[funcionarioIndex], valor, dataAdiantamento, descricao]);
      }
      console.log(`  ✓ 10 adiantamentos inseridos`);

      // Inserir gastos
      console.log('💸 Inserindo gastos em projetos...');
      const categorias = ['material', 'ferramenta', 'transporte', 'alimentacao'];
      
      for (let i = 0; i < 15; i++) {
        // Gerar data aleatória nos últimos 30 dias
        const dataRandom = new Date();
        dataRandom.setDate(dataRandom.getDate() - Math.floor(Math.random() * 30));
        const dataGasto = dataRandom.toISOString().split('T')[0];
        
        // Selecionar projeto aleatório
        const projetoIndex = Math.floor(Math.random() * projetosIds.length);
        
        // Dados aleatórios para o gasto
        const categoria = categorias[Math.floor(Math.random() * categorias.length)];
        const valor = (Math.floor(Math.random() * 100) + 1) * 10;
        const descricoes = {
          material: ['Cimento', 'Areia', 'Tijolos', 'Tinta', 'Massa corrida'],
          ferramenta: ['Aluguel de betoneira', 'Conserto de furadeira', 'Compra de espátulas', 'Reposição de brocas'],
          transporte: ['Frete de material', 'Combustível', 'Transporte de equipe'],
          alimentacao: ['Almoço da equipe', 'Café da manhã', 'Água para equipe']
        };
        const descricao = descricoes[categoria][Math.floor(Math.random() * descricoes[categoria].length)];
        
        await pool.query(`
          INSERT INTO gastos (projeto_id, categoria, descricao, valor, data)
          VALUES ($1, $2, $3, $4, $5)
        `, [projetosIds[projetoIndex], categoria, descricao, valor, dataGasto]);
      }
      console.log(`  ✓ 15 gastos de projetos inseridos`);

      // Inserir usuários adicionais
      console.log('👤 Inserindo usuários adicionais...');
      for (const usuario of dadosExemplo.usuarios) {
        const senhaHash = await bcrypt.hash(usuario.senha, 10);
        
        await pool.query(`
          INSERT INTO usuarios (nome, email, senha, perfil)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO NOTHING
        `, [usuario.nome, usuario.email, senhaHash, usuario.perfil]);
      }
      console.log(`  ✓ ${dadosExemplo.usuarios.length} usuários adicionais inseridos`);

      // Confirmar transação
      await pool.query('COMMIT');
      
      console.log('✅ Todos os dados de exemplo foram inseridos com sucesso!');
      
      // Imprimir resumo dos dados criados
      console.log('\n📊 Resumo dos dados inseridos:');
      console.log(`  • Funcionários: ${dadosExemplo.funcionarios.length}`);
      console.log(`  • Clientes: ${dadosExemplo.clientes.length}`);
      console.log(`  • Projetos: ${dadosExemplo.projetos.length}`);
      console.log(`  • Orçamentos: ${dadosExemplo.orcamentos.length}`);
      console.log(`  • Registros de trabalho: 20`);
      console.log(`  • Adiantamentos: 10`);
      console.log(`  • Gastos de projetos: 15`);
      console.log(`  • Usuários: ${dadosExemplo.usuarios.length + 1} (incluindo o admin)`);
      
      // Imprimir credenciais de teste
      console.log('\n🔑 Credenciais para teste:');
      console.log('  • Admin: admin@exemplo.com / admin123');
      console.log('  • Usuário: usuario@exemplo.com / user123');
      console.log('  • Gerente: gerente@exemplo.com / gerente123');
    
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('❌ Erro ao inserir dados de exemplo:', err);
      throw err;
    }

  } catch (err) {
    console.error('❌ Erro ao popular o banco de dados:', err.message);
  } finally {
    // Fechar conexão
    await pool.end();
  }
}

// Executar função principal
popularBancoDados().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});