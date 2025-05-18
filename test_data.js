// test_data.js - Script para popular o banco de dados com dados de teste
const db = require('./src/config/database');

console.log('Iniciando inserção de dados de teste...');

// Função auxiliar para executar queries
async function run(sql, params = []) {
  return db.promiseRun(sql, params);
}

// Função auxiliar para verificar existência antes de inserir
async function insertIfNotExists(table, checkField, checkValue, sql, params = []) {
  try {
    const checkSql = `SELECT COUNT(*) as count FROM ${table} WHERE ${checkField} = ?`;
    const result = await db.promiseGet(checkSql, [checkValue]);
    
    if (!result || result.count === 0) {
      return await db.promiseRun(sql, params);
    } else {
      console.log(`Registro já existe em ${table} com ${checkField}=${checkValue}`);
      return { skipped: true };
    }
  } catch (err) {
    console.error(`Erro ao verificar/inserir em ${table}:`, err);
    throw err;
  }
}

// Função auxiliar para executar queries com múltiplos parâmetros
async function runMany(sql, paramsArray = [], checkInfo = null) {
  if (checkInfo) {
    const { table, checkFieldIndex } = checkInfo;
    return Promise.all(paramsArray.map(params => {
      return insertIfNotExists(table, checkInfo.checkField, params[checkFieldIndex], sql, params);
    }));
  } else {
    return Promise.all(paramsArray.map(params => run(sql, params)));
  }
}

// Função principal
async function insertTestData() {
  try {
    // 1. Inserir um usuário administrador
    await insertIfNotExists('users', 'email', 'admin@exemplo.com', `
      INSERT INTO users (nome, email, senha, role)
      VALUES (?, ?, ?, ?)
    `, ['Admin', 'admin@exemplo.com', '$2a$10$NrM4WZr6dQOKygYQYKcxTee/SfZ7xXhxE1MqTU6xP.fastGUIMmuy', 'admin']);
    console.log('Usuário admin verificado/criado (senha: senha123)');

    // 2. Inserir clientes
    const clientes = [
      ['João Silva', '11 98765-4321', 'joao@email.com', 'Rua das Flores, 123', 'pessoa_fisica', '123.456.789-00', 'Cliente antigo'],
      ['Maria Souza', '11 91234-5678', 'maria@email.com', 'Av. Principal, 456', 'pessoa_fisica', '987.654.321-00', 'Indicação do João'],
      ['Construtora XYZ', '11 3333-4444', 'contato@xyz.com', 'Rua Comercial, 789', 'pessoa_juridica', '12.345.678/0001-90', 'Empresa parceira']
    ];
    
    await runMany(`
      INSERT INTO clientes (nome, telefone, email, endereco, tipo, cpf_cnpj, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, clientes, { table: 'clientes', checkField: 'email', checkFieldIndex: 2 });
    console.log('Clientes verificados/inseridos');

    // 3. Inserir funcionários
    const funcionarios = [
      ['Pedro Pedreiro', '11 97777-8888', 'pedreiro', 150.00, 20.00, 2000.00, 'ativo', 'Especialista em acabamento'],
      ['Carlos Carpinteiro', '11 96666-7777', 'carpinteiro', 140.00, 18.00, 1800.00, 'ativo', 'Excelente com madeiras nobres'],
      ['Eletricista Elias', '11 95555-6666', 'eletricista', 160.00, 25.00, 1200.00, 'ativo', 'Especialista em instalações residenciais'],
      ['Paulo Pintor', '11 94444-5555', 'pintor', 130.00, 15.00, 1600.00, 'ativo', 'Trabalha com tintas especiais']
    ];
    
    await runMany(`
      INSERT INTO funcionarios (nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, status, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, funcionarios, { table: 'funcionarios', checkField: 'nome', checkFieldIndex: 0 });
    console.log('Funcionários verificados/inseridos');

    // 4. Inserir projetos
    const hoje = new Date().toISOString().split('T')[0];
    const umMesAtras = new Date();
    umMesAtras.setMonth(umMesAtras.getMonth() - 1);
    const dataInicio = umMesAtras.toISOString().split('T')[0];
    
    const doisMesesFrente = new Date();
    doisMesesFrente.setMonth(doisMesesFrente.getMonth() + 2);
    const dataFimPrevista = doisMesesFrente.toISOString().split('T')[0];
    
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
    const dataFimReal = umaSemanaAtras.toISOString().split('T')[0];
    
    // IDs dos clientes vindos do banco de dados Supabase (UUIDs)
    const clienteJoao = '102c9ebd-dc1a-44c4-ae4e-a5230f0f4524';
    const clienteMaria = 'fe239ca9-7978-4d37-99d3-223f97d53d02';
    const clienteXYZ = '2ef379d9-4a5e-410d-b035-746849cf0fae';
    
    // IDs dos funcionários vindos do banco Supabase (UUIDs)
    const funcionarioPedro = '65585e81-88b6-4888-8713-fcd84dad6cfa';
    const funcionarioCarlos = 'aae246d1-9f9f-49da-ba24-bdb446c5c581';
    const funcionarioElias = '60ec7b8b-eacd-4613-b50e-0057d8d6461a';
    const funcionarioPaulo = 'fb502971-ce5e-41f3-af0a-2f902940374a';
    
    const projetos = [
      ['Reforma Apartamento 302', clienteJoao, 'Rua das Flores, 123, Apto 302', 'reforma', 'Reforma completa de apartamento', dataInicio, dataFimPrevista, null, 25000.00, true, 'em_andamento', 'Cliente pediu atenção especial ao banheiro'],
      ['Construção Casa Jardins', clienteMaria, 'Condomínio Jardins, Lote 45', 'construcao', 'Construção de casa térrea', dataInicio, dataFimPrevista, null, 180000.00, false, 'em_andamento', 'Projeto com prazo apertado'],
      ['Pintura Comercial XYZ', clienteXYZ, 'Av. Comercial, 789, 4º andar', 'pintura', 'Pintura de escritório comercial', dataInicio, dataFimPrevista, dataFimReal, 12000.00, true, 'concluido', 'Cliente muito satisfeito']
    ];
    
    await runMany(`
      INSERT INTO projetos (nome, cliente_id, localidade, tipo, descricao, data_inicio, data_fim_prevista, data_fim_real, valor_receber, deslocamento_incluido, status, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, projetos, { table: 'projetos', checkField: 'nome', checkFieldIndex: 0 });
    console.log('Projetos verificados/inseridos');

    try {
      // Buscar projetos cadastrados para usar seus IDs
      const projetosCadastrados = await db.promiseAll('SELECT id, nome FROM projetos', []);
      console.log('Projetos cadastrados:', projetosCadastrados ? projetosCadastrados.length : 0);
      
      if (!projetosCadastrados || projetosCadastrados.length === 0) {
        console.log('Nenhum projeto encontrado para associar trabalhos.');
        return;
      }
      
      // IDs dos funcionários vindos do banco Supabase (UUIDs)
      const funcionarioPedro = '65585e81-88b6-4888-8713-fcd84dad6cfa';
      const funcionarioCarlos = 'aae246d1-9f9f-49da-ba24-bdb446c5c581';
      const funcionarioElias = '60ec7b8b-eacd-4613-b50e-0057d8d6461a';
      const funcionarioPaulo = 'fb502971-ce5e-41f3-af0a-2f902940374a';
      
      // 5. Inserir trabalhos somente se houver projetos
      if (projetosCadastrados.length > 0) {
        console.log('Inserindo trabalhos para os projetos encontrados...');
        
        // Certifique-se de que temos projetos suficientes
        const projeto1 = projetosCadastrados[0]?.id;
        const projeto2 = projetosCadastrados.length > 1 ? projetosCadastrados[1]?.id : projeto1;
        const projeto3 = projetosCadastrados.length > 2 ? projetosCadastrados[2]?.id : projeto1;
        
        const trabalhos = [
          [funcionarioPedro, projeto1, dataInicio, 5, 2, false, 0, 'Trabalho na primeira semana'],
          [funcionarioCarlos, projeto1, dataInicio, 5, 0, false, 0, 'Trabalho na primeira semana'],
          [funcionarioPedro, projeto2, hoje, 1, 0, false, 0, 'Trabalho de hoje'],
          [funcionarioElias, projeto3, dataInicio, 0, 0, true, 1200, 'Empreitada de elétrica'],
          [funcionarioPaulo, projeto3, dataInicio, 3, 0, false, 0, 'Pintura das paredes']
        ];
        
        await runMany(`
          INSERT INTO trabalhos (funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, trabalhos);
        console.log('Trabalhos verificados/inseridos');
      }
    } catch (err) {
      console.error('Erro ao inserir trabalhos, continuando com o restante:', err.message);
    }

    try {
      // 6. Inserir adiantamentos
      const adiantamentos = [
        [funcionarioPedro, 500.00, dataInicio, 'Adiantamento para compra de ferramentas'],
        [funcionarioCarlos, 300.00, hoje, 'Adiantamento salarial']
      ];
      
      await runMany(`
        INSERT INTO adiantamentos (funcionario_id, valor, data, descricao)
        VALUES (?, ?, ?, ?)
      `, adiantamentos);
      console.log('Adiantamentos verificados/inseridos');
    } catch (err) {
      console.error('Erro ao inserir adiantamentos, continuando com o restante:', err.message);
    }

    try {
      // 7. Inserir gastos (usando os IDs dos projetos que já foram criados)
      const projetosCadastrados = await db.promiseAll('SELECT id, nome FROM projetos', []);
      
      if (projetosCadastrados && projetosCadastrados.length > 0) {
        // Certifique-se de que temos projetos suficientes
        const projeto1 = projetosCadastrados[0]?.id;
        const projeto2 = projetosCadastrados.length > 1 ? projetosCadastrados[1]?.id : projeto1;
        const projeto3 = projetosCadastrados.length > 2 ? projetosCadastrados[2]?.id : projeto1;
        
        const gastos = [
          [projeto1, 'material_construcao', 'Cimento e areia', 1200.00, dataInicio, null, 'Compra na Loja ABC'],
          [projeto1, 'ferramentas', 'Aluguel de betoneira', 350.00, dataInicio, null, 'Aluguel por 3 dias'],
          [projeto2, 'material_construcao', 'Tijolos e argamassa', 3500.00, hoje, null, 'Compra na Loja XYZ'],
          [projeto3, 'material_acabamento', 'Tintas e verniz', 1800.00, dataInicio, null, 'Compra na Loja de Tintas']
        ];
        
        await runMany(`
          INSERT INTO gastos (projeto_id, categoria, descricao, valor, data, comprovante_url, observacoes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, gastos);
        console.log('Gastos verificados/inseridos');
      } else {
        console.log('Nenhum projeto encontrado para associar gastos');
      }
    } catch (err) {
      console.error('Erro ao inserir gastos, continuando com o restante:', err.message);
    }

    try {
      // 8. Inserir orçamentos
      const orcamentos = [
        [clienteJoao, 'Reforma de Cozinha', 'Troca de gabinetes e piso', 15000.00, 'reforma', 'Rua das Flores, 123', 'aprovado'],
        [clienteMaria, 'Construção de Edícula', 'Edícula com churrasqueira', 35000.00, 'construcao', 'Av. Principal, 456', 'pendente'],
        [clienteXYZ, 'Pintura de Fachada', 'Pintura externa de prédio comercial', 22000.00, 'pintura', 'Rua Comercial, 789', 'em_analise'],
        [null, 'Casa de Praia', 'Construção de casa de veraneio', 250000.00, 'construcao', 'Litoral Sul, Lote 123', 'proposta']
      ];
      
      await runMany(`
        INSERT INTO orcamentos (cliente_id, titulo, descricao, valor_estimado, tipo_obra, localidade, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, orcamentos, { table: 'orcamentos', checkField: 'titulo', checkFieldIndex: 1 });
      console.log('Orçamentos verificados/inseridos');
    } catch (err) {
      console.error('Erro ao inserir orçamentos:', err.message);
    }

    console.log('Dados de teste inseridos com sucesso!');
    
  } catch (err) {
    console.error('Erro ao inserir dados de teste:', err);
  }
}

// Executar função principal
insertTestData().then(() => {
  console.log('Script finalizado.');
  process.exit(0);
}).catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
