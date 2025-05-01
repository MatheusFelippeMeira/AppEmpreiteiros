const db = require('../config/database');

class Projeto {
  static getAll(callback) {
    const sql = `SELECT p.*, c.nome as cliente_nome 
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                ORDER BY p.data_inicio DESC`;
    db.all(sql, [], callback);
  }

  static getById(id, callback) {
    const sql = `SELECT p.*, c.nome as cliente_nome, c.contato as cliente_contato, c.endereco as cliente_endereco
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.id = ?`;
    db.get(sql, [id], callback);
  }

  static create(projeto, callback) {
    const { nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido } = projeto;
    const sql = `INSERT INTO projetos (nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, valor_receber, deslocamento_incluido ? 1 : 0], function(err) {
      callback(err, this.lastID);
    });
  }

  static update(id, projeto, callback) {
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
    
    db.run(sql, [nome, cliente_id, localidade, tipo, data_inicio, data_fim_prevista, 
      data_fim_real, valor_receber, deslocamento_incluido ? 1 : 0, status, id], callback);
  }

  static delete(id, callback) {
    const sql = `DELETE FROM projetos WHERE id = ?`;
    db.run(sql, [id], callback);
  }

  // Métodos específicos para projetos
  static getGastos(id, callback) {
    const sql = `SELECT * FROM gastos WHERE projeto_id = ? ORDER BY data DESC`;
    db.all(sql, [id], callback);
  }

  static getTrabalhos(id, callback) {
    const sql = `SELECT t.*, f.nome as funcionario_nome 
                FROM trabalhos t 
                JOIN funcionarios f ON t.funcionario_id = f.id
                WHERE t.projeto_id = ?
                ORDER BY t.data DESC`;
    
    db.all(sql, [id], callback);
  }

  static registrarGasto(gasto, callback) {
    const { projeto_id, categoria, descricao, valor, data, comprovante_url } = gasto;
    const sql = `INSERT INTO gastos 
                (projeto_id, categoria, descricao, valor, data, comprovante_url)
                VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [projeto_id, categoria, descricao, valor, data, comprovante_url], function(err) {
      callback(err, this.lastID);
    });
  }

  static calcularLucratividade(id, callback) {
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
    
    db.get(sql, [id, id, id], callback);
  }

  static getProjetosAndamento(callback) {
    const sql = `SELECT p.*, c.nome as cliente_nome,
                (SELECT COUNT(*) FROM trabalhos WHERE projeto_id = p.id) as total_dias_trabalhados
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.status = 'em_andamento'
                ORDER BY p.data_inicio DESC`;
    
    db.all(sql, [], callback);
  }

  static getProjetosConcluidos(callback) {
    const sql = `SELECT p.*, c.nome as cliente_nome,
                JULIANDAY(p.data_fim_real) - JULIANDAY(p.data_inicio) as dias_duracao,
                JULIANDAY(p.data_fim_prevista) - JULIANDAY(p.data_inicio) as dias_previstos
                FROM projetos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.status = 'concluido'
                ORDER BY p.data_fim_real DESC`;
    
    db.all(sql, [], callback);
  }
}

module.exports = Projeto;