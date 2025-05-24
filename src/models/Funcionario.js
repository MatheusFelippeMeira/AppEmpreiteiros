const db = require('../config/database');

class Funcionario {
  static async getAll() {
    try {
      const sql = `SELECT * FROM funcionarios ORDER BY nome`;
      return await db.promiseAll(sql, []);
    } catch (error) {
      console.error('Erro em Funcionario.getAll:', error);
      return [];
    }
  }
  
  // Método com suporte a paginação
  static async getAllPaginated(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM funcionarios ORDER BY nome LIMIT ? OFFSET ?`;
    
    // Obter total para cálculo de páginas
    const countSql = `SELECT COUNT(*) as total FROM funcionarios`;
    
    try {
      // Verificar se a tabela existe antes de consultar
      const tableExists = await db.tableExists('funcionarios');
      if (!tableExists) {
        console.error('Tabela funcionarios não existe');
        return {
          data: [],
          total: 0,
          page: page,
          limit: limit,
          totalPages: 0,
          error: 'Tabela não encontrada'
        };
      }
      
      const [rows, countResult] = await Promise.all([
        db.promiseAll(sql, [limit, offset]),
        db.promiseGet(countSql, [])
      ]);
      
      // Tratamento para quando countResult for null
      const total = countResult ? countResult.total : 0;
      
      return {
        data: rows || [],
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Erro ao buscar funcionários paginados:', error);
      // Retornando um objeto válido mesmo em caso de erro
      return {
        data: [],
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0,
        error: error.message
      };
    }
  }

  static async getById(id) {
    try {
      const sql = `SELECT * FROM funcionarios WHERE id = ?`;
      return await db.promiseGet(sql, [id]);
    } catch (error) {
      console.error('Erro em Funcionario.getById:', error);
      return null;
    }
  }

  static async create(funcionario) {
    try {
      const { nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes } = funcionario;
      const sql = `INSERT INTO funcionarios 
                  (nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      
      return await db.promiseRun(sql, [
        nome, 
        contato || '', 
        funcao || '', 
        valor_diaria || 0, 
        valor_hora_extra || 0, 
        valor_empreitada || 0, 
        observacoes || '',
        'ativo'
      ]);
    } catch (error) {
      console.error('Erro em Funcionario.create:', error);
      throw error;
    }
  }

  static async update(id, funcionario) {
    try {
      const { nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, status, observacoes } = funcionario;
      const sql = `UPDATE funcionarios SET 
                  nome = ?, 
                  contato = ?, 
                  funcao = ?, 
                  valor_diaria = ?, 
                  valor_hora_extra = ?, 
                  valor_empreitada = ?, 
                  status = ?, 
                  observacoes = ?, 
                  data_atualizacao = CURRENT_TIMESTAMP
                  WHERE id = ?`;
      
      return await db.promiseRun(sql, [
        nome, 
        contato || '', 
        funcao || '', 
        valor_diaria || 0, 
        valor_hora_extra || 0, 
        valor_empreitada || 0, 
        status || 'ativo', 
        observacoes || '', 
        id
      ]);
    } catch (error) {
      console.error('Erro em Funcionario.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const sql = `DELETE FROM funcionarios WHERE id = ?`;
      return await db.promiseRun(sql, [id]);
    } catch (error) {
      console.error('Erro em Funcionario.delete:', error);
      throw error;
    }
  }

  // Métodos específicos para funcionários
  static async getTrabalhos(id) {
    try {
      // Verificar se a tabela trabalhos existe
      const tableExists = await db.tableExists('trabalhos');
      if (!tableExists) {
        console.warn('Tabela trabalhos não existe');
        return [];
      }
      
      const sql = `SELECT t.*, p.nome as projeto_nome 
                  FROM trabalhos t 
                  JOIN projetos p ON t.projeto_id = p.id
                  WHERE t.funcionario_id = ?
                  ORDER BY t.data DESC`;
      
      return await db.promiseAll(sql, [id]);
    } catch (error) {
      console.error('Erro em Funcionario.getTrabalhos:', error);
      return [];
    }
  }

  static async getAdiantamentos(id) {
    try {
      // Verificar se a tabela adiantamentos existe
      const tableExists = await db.tableExists('adiantamentos');
      if (!tableExists) {
        console.warn('Tabela adiantamentos não existe');
        return [];
      }
      
      const sql = `SELECT * FROM adiantamentos WHERE funcionario_id = ? ORDER BY data DESC`;
      return await db.promiseAll(sql, [id]);
    } catch (error) {
      console.error('Erro em Funcionario.getAdiantamentos:', error);
      return [];
    }
  }

  static async registrarDiasTrabalhados(dados) {
    try {
      const { funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada } = dados;
      const sql = `INSERT INTO trabalhos 
                  (funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`;
      
      return await db.promiseRun(sql, [
        funcionario_id, 
        projeto_id, 
        data, 
        dias_trabalhados || 0, 
        horas_extras || 0, 
        empreitada ? 1 : 0, 
        valor_empreitada || 0
      ]);
    } catch (error) {
      console.error('Erro em Funcionario.registrarDiasTrabalhados:', error);
      throw error;
    }
  }

  static async registrarAdiantamento(dados) {
    try {
      const { funcionario_id, valor, data, descricao } = dados;
      const sql = `INSERT INTO adiantamentos 
                  (funcionario_id, valor, data, descricao)
                  VALUES (?, ?, ?, ?)`;
      
      return await db.promiseRun(sql, [funcionario_id, valor, data, descricao || '']);
    } catch (error) {
      console.error('Erro em Funcionario.registrarAdiantamento:', error);
      throw error;
    }
  }

  static async calcularTotais(id) {
    try {
      const funcionario = await this.getById(id);
      if (!funcionario) {
        return {
          total_ganho: 0,
          total_extras: 0,
          total_adiantamentos: 0,
          saldo_atual: 0
        };
      }
      
      const trabalhos = await this.getTrabalhos(id);
      const adiantamentos = await this.getAdiantamentos(id);
      
      // Cálculos
      let totalGanho = 0;
      let totalExtras = 0;
      
      trabalhos.forEach(t => {
        if (!t.empreitada) {
          totalGanho += (t.dias_trabalhados || 0) * (funcionario.valor_diaria || 0);
          totalExtras += (t.horas_extras || 0) * (funcionario.valor_hora_extra || 0);
        }
      });
      
      const totalAdiantamentos = adiantamentos.reduce((sum, ad) => sum + (ad.valor || 0), 0);
      
      return {
        total_ganho: totalGanho,
        total_extras: totalExtras,
        total_adiantamentos: totalAdiantamentos,
        saldo_atual: totalGanho + totalExtras - totalAdiantamentos
      };
    } catch (error) {
      console.error('Erro em Funcionario.calcularTotais:', error);
      return {
        total_ganho: 0,
        total_extras: 0,
        total_adiantamentos: 0,
        saldo_atual: 0,
        error: error.message
      };
    }
  }

  static async calcularPagamentoPeriodo(id, dataInicio, dataFim) {
    try {
      // Verificar se as tabelas necessárias existem
      const funcionariosExists = await db.tableExists('funcionarios');
      const trabalhosExists = await db.tableExists('trabalhos');
      const adiantamentosExists = await db.tableExists('adiantamentos');
      
      if (!funcionariosExists || !trabalhosExists || !adiantamentosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return null;
      }
      
      const sql = `SELECT 
                    f.nome, f.funcao, f.valor_diaria, f.valor_hora_extra,
                    SUM(t.dias_trabalhados) as total_dias,
                    SUM(t.horas_extras) as total_horas_extras,
                    SUM(CASE WHEN t.empreitada = 1 THEN t.valor_empreitada ELSE 0 END) as total_empreitadas,
                    SUM(CASE WHEN t.empreitada = 0 THEN (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra) ELSE t.valor_empreitada END) as total_bruto,
                    COALESCE((SELECT SUM(valor) FROM adiantamentos WHERE funcionario_id = ? AND data BETWEEN ? AND ?), 0) as total_adiantamentos
                  FROM funcionarios f
                  LEFT JOIN trabalhos t ON f.id = t.funcionario_id AND t.data BETWEEN ? AND ?
                  WHERE f.id = ?
                  GROUP BY f.id`;
      
      return await db.promiseGet(sql, [id, dataInicio, dataFim, dataInicio, dataFim, id]);
    } catch (error) {
      console.error('Erro em Funcionario.calcularPagamentoPeriodo:', error);
      return null;
    }
  }
}

module.exports = Funcionario;