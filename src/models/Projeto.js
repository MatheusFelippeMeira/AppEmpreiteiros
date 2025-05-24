const db = require('../config/database');

class Projeto {
  static async getAll() {
    const sql = `SELECT p.*, c.nome as cliente_nome 
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                ORDER BY p.data_inicio DESC`;
    try {
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('projetos');
      if (!tableExists) {
        console.warn('Tabela projetos não existe');
        return [];
      }
      
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
      return []; // Retornar array vazio em vez de lançar erro
    }
  }

  static async getById(id) {
    const sql = `SELECT p.*, c.nome as cliente_nome, c.contato as cliente_contato, c.endereco as cliente_endereco
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.id = ?`;
    try {
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('projetos');
      if (!tableExists) {
        console.warn('Tabela projetos não existe');
        return null;
      }
      
      return await db.promiseGet(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar projeto ID ${id}:`, err);
      return null; // Retornar null em vez de lançar erro
    }
  }

  static async create(projeto) {
    const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido } = projeto;
    const sql = `INSERT INTO projetos (nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    try {
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('projetos');
      if (!tableExists) {
        throw new Error('Tabela projetos não existe');
      }
      
      const result = await db.promiseRun(sql, [
        nome, 
        cliente_id || null, 
        localidade || '', 
        tipo || '', 
        data_inicio, 
        data_fim_prevista || null, 
        valor_receber || 0, 
        deslocamento_incluido ? 1 : 0,
        'em_andamento'
      ]);
      return result.lastID;
    } catch (err) {
      console.error('Erro ao criar projeto:', err);
      throw err;
    }
  }

  static async update(id, projeto) {
    const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
            data_fim_real, valor_receber, deslocamento_incluido, status } = projeto;
    const sql = `UPDATE projetos SET 
                nome = ?, 
                cliente_id = ?,
                localidade = ?, 
                tipo = ?,
                data_inicio = ?,
                data_fim_prevista = ?,
                data_fim_real = ?,
                valor_receber = ?,
                deslocamento_incluido = ?,
                status = ?,
                data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?`;
    
    try {
      return await db.promiseRun(sql, [
        nome, 
        cliente_id || null, 
        localidade || '', 
        tipo || '', 
        data_inicio, 
        data_fim_prevista || null, 
        data_fim_real || null, 
        valor_receber || 0, 
        deslocamento_incluido ? 1 : 0, 
        status || 'em_andamento', 
        id
      ]);
    } catch (err) {
      console.error(`Erro ao atualizar projeto ID ${id}:`, err);
      throw err;
    }
  }

  static async delete(id) {
    const sql = `DELETE FROM projetos WHERE id = ?`;
    try {
      return await db.promiseRun(sql, [id]);
    } catch (err) {
      console.error(`Erro ao excluir projeto ID ${id}:`, err);
      throw err;
    }
  }

  // Métodos específicos para projetos
  static async getGastos(id) {
    const sql = `SELECT * FROM gastos WHERE projeto_id = ? ORDER BY data DESC`;
    try {
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('gastos');
      if (!tableExists) {
        console.warn('Tabela gastos não existe');
        return [];
      }
      
      return await db.promiseAll(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar gastos do projeto ID ${id}:`, err);
      return []; // Retornar array vazio em vez de lançar erro
    }
  }

  static async getTrabalhos(id) {
    const sql = `SELECT t.*, f.nome as funcionario_nome 
                FROM trabalhos t 
                JOIN funcionarios f ON t.funcionario_id = f.id
                WHERE t.projeto_id = ?
                ORDER BY t.data DESC`;
    
    try {
      // Verificar se as tabelas existem
      const trabalhosExists = await db.tableExists('trabalhos');
      const funcionariosExists = await db.tableExists('funcionarios');
      
      if (!trabalhosExists || !funcionariosExists) {
        console.warn('Tabela trabalhos ou funcionarios não existe');
        return [];
      }
      
      return await db.promiseAll(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar trabalhos do projeto ID ${id}:`, err);
      return []; // Retornar array vazio em vez de lançar erro
    }
  }

  static async registrarGasto(gasto) {
    const { projeto_id, categoria, descricao, valor, data, comprovante_url } = gasto;
    const sql = `INSERT INTO gastos 
                (projeto_id, categoria, descricao, valor, data, comprovante_url)
                VALUES (?, ?, ?, ?, ?, ?)`;
    
    try {
      // Verificar se a tabela existe
      const tableExists = await db.tableExists('gastos');
      if (!tableExists) {
        throw new Error('Tabela gastos não existe');
      }
      
      const result = await db.promiseRun(sql, [
        projeto_id, 
        categoria || 'outros', 
        descricao || '', 
        valor || 0, 
        data, 
        comprovante_url || null
      ]);
      return result.lastID;
    } catch (err) {
      console.error('Erro ao registrar gasto:', err);
      throw err;
    }
  }

  static async calcularLucratividade(id) {
    try {
      // Verificar se as tabelas existem
      const projetosExists = await db.tableExists('projetos');
      const gastosExists = await db.tableExists('gastos');
      const trabalhosExists = await db.tableExists('trabalhos');
      const funcionariosExists = await db.tableExists('funcionarios');
      
      if (!projetosExists || !gastosExists || !trabalhosExists || !funcionariosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return {
          nome: '',
          valor_receber: 0,
          total_gastos: 0,
          custo_mao_obra: 0
        };
      }
      
      const sql = `SELECT 
                  p.nome, p.valor_receber,
                  COALESCE((SELECT SUM(valor) FROM gastos WHERE projeto_id = ?), 0) as total_gastos,
                  COALESCE((
                    SELECT SUM(
                      CASE 
                        WHEN t.empreitada = 1 THEN t.valor_empreitada 
                        ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                      END
                    )
                    FROM trabalhos t
                    JOIN funcionarios f ON t.funcionario_id = f.id
                    WHERE t.projeto_id = ?
                  ), 0) as custo_mao_obra
                FROM projetos p
                WHERE p.id = ?`;
      
      const result = await db.promiseGet(sql, [id, id, id]);
      return result || {
        nome: '',
        valor_receber: 0,
        total_gastos: 0,
        custo_mao_obra: 0
      };
    } catch (err) {
      console.error(`Erro ao calcular lucratividade do projeto ID ${id}:`, err);
      return {
        nome: '',
        valor_receber: 0,
        total_gastos: 0,
        custo_mao_obra: 0
      };
    }
  }

  static async getProjetosAndamento() {
    const sql = `SELECT p.*, c.nome as cliente_nome,
                (SELECT COUNT(*) FROM trabalhos WHERE projeto_id = p.id) as total_dias_trabalhados
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.status = 'em_andamento'
                ORDER BY p.data_inicio DESC`;
    
    try {
      // Verificar se as tabelas existem
      const projetosExists = await db.tableExists('projetos');
      const clientesExists = await db.tableExists('clientes');
      
      if (!projetosExists || !clientesExists) {
        console.warn('Tabela projetos ou clientes não existe');
        return [];
      }
      
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos em andamento:', err);
      return []; // Retornar array vazio para evitar quebrar a interface
    }
  }

  static async getProjetosConcluidos() {
    try {
      // Verificar se as tabelas existem
      const projetosExists = await db.tableExists('projetos');
      const clientesExists = await db.tableExists('clientes');
      
      if (!projetosExists || !clientesExists) {
        console.warn('Tabela projetos ou clientes não existe');
        return [];
      }
      
      // Usar strftime em vez de JULIANDAY para maior compatibilidade
      const sql = `SELECT p.*, c.nome as cliente_nome,
                  (strftime('%s', p.data_fim_real) - strftime('%s', p.data_inicio)) / 86400.0 as dias_duracao,
                  (strftime('%s', p.data_fim_prevista) - strftime('%s', p.data_inicio)) / 86400.0 as dias_previstos
                  FROM projetos p 
                  LEFT JOIN clientes c ON p.cliente_id = c.id 
                  WHERE p.status = 'concluido'
                  ORDER BY p.data_fim_real DESC`;
      
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos concluídos:', err);
      return []; // Retornar array vazio para evitar quebrar a interface
    }
  }
}

module.exports = Projeto;