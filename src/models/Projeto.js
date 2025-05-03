const db = require('../config/database');

class Projeto {
  static async getAll() {
    const sql = `SELECT p.*, c.nome as cliente_nome 
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                ORDER BY p.data_inicio DESC`;
    try {
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
      throw err;
    }
  }

  static async getById(id) {
    const sql = `SELECT p.*, c.nome as cliente_nome, c.contato as cliente_contato, c.endereco as cliente_endereco
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.id = ?`;
    try {
      return await db.promiseGet(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar projeto ID ${id}:`, err);
      throw err;
    }
  }

  static async create(projeto) {
    const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido } = projeto;
    const sql = `INSERT INTO projetos (nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    try {
      const result = await db.promiseRun(sql, [nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido ? 1 : 0]);
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
      return await db.promiseRun(sql, [nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
        data_fim_real, valor_receber, deslocamento_incluido ? 1 : 0, status, id]);
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
      return await db.promiseAll(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar gastos do projeto ID ${id}:`, err);
      throw err;
    }
  }

  static async getTrabalhos(id) {
    const sql = `SELECT t.*, f.nome as funcionario_nome 
                FROM trabalhos t 
                JOIN funcionarios f ON t.funcionario_id = f.id
                WHERE t.projeto_id = ?
                ORDER BY t.data DESC`;
    
    try {
      return await db.promiseAll(sql, [id]);
    } catch (err) {
      console.error(`Erro ao buscar trabalhos do projeto ID ${id}:`, err);
      throw err;
    }
  }

  static async registrarGasto(gasto) {
    const { projeto_id, categoria, descricao, valor, data, comprovante_url } = gasto;
    const sql = `INSERT INTO gastos 
                (projeto_id, categoria, descricao, valor, data, comprovante_url)
                VALUES (?, ?, ?, ?, ?, ?)`;
    
    try {
      const result = await db.promiseRun(sql, [projeto_id, categoria, descricao, valor, data, comprovante_url]);
      return result.lastID;
    } catch (err) {
      console.error('Erro ao registrar gasto:', err);
      throw err;
    }
  }

  static async calcularLucratividade(id) {
    const sql = `SELECT 
                  p.nome, p.valor_receber,
                  (SELECT SUM(valor) FROM gastos WHERE projeto_id = ?) as total_gastos,
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
    
    try {
      return await db.promiseGet(sql, [id, id, id]);
    } catch (err) {
      console.error(`Erro ao calcular lucratividade do projeto ID ${id}:`, err);
      throw err;
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
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos em andamento:', err);
      return []; // Retornar array vazio para evitar quebrar a interface
    }
  }

  static async getProjetosConcluidos() {
    const sql = `SELECT p.*, c.nome as cliente_nome,
                JULIANDAY(p.data_fim_real) - JULIANDAY(p.data_inicio) as dias_duracao,
                JULIANDAY(p.data_fim_prevista) - JULIANDAY(p.data_inicio) as dias_previstos
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.status = 'concluido'
                ORDER BY p.data_fim_real DESC`;
    
    try {
      return await db.promiseAll(sql, []);
    } catch (err) {
      console.error('Erro ao buscar projetos concluídos:', err);
      return []; // Retornar array vazio para evitar quebrar a interface
    }
  }
}

module.exports = Projeto;