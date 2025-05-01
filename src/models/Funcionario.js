const db = require('../config/database');

class Funcionario {
  static getAll(callback) {
    const sql = `SELECT * FROM funcionarios ORDER BY nome`;
    db.all(sql, [], callback);
  }

  static getById(id, callback) {
    const sql = `SELECT * FROM funcionarios WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static create(funcionario, callback) {
    const { nome, funcao, valor_diaria, valor_hora_extra, valor_empreitada } = funcionario;
    const sql = `INSERT INTO funcionarios (nome, funcao, valor_diaria, valor_hora_extra, valor_empreitada)
                VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [nome, funcao, valor_diaria, valor_hora_extra, valor_empreitada], function(err) {
      callback(err, this.lastID);
    });
  }

  static update(id, funcionario, callback) {
    const { nome, funcao, valor_diaria, valor_hora_extra, valor_empreitada } = funcionario;
    const sql = `UPDATE funcionarios SET 
                nome = ?, 
                funcao = ?, 
                valor_diaria = ?, 
                valor_hora_extra = ?, 
                valor_empreitada = ?,
                data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?`;
    
    db.run(sql, [nome, funcao, valor_diaria, valor_hora_extra, valor_empreitada, id], callback);
  }

  static delete(id, callback) {
    const sql = `DELETE FROM funcionarios WHERE id = ?`;
    db.run(sql, [id], callback);
  }

  // Métodos específicos para funcionários
  static getTrabalhos(id, callback) {
    const sql = `SELECT t.*, p.nome as projeto_nome 
                FROM trabalhos t 
                JOIN projetos p ON t.projeto_id = p.id
                WHERE t.funcionario_id = ?
                ORDER BY t.data DESC`;
    
    db.all(sql, [id], callback);
  }

  static getAdiantamentos(id, callback) {
    const sql = `SELECT * FROM adiantamentos WHERE funcionario_id = ? ORDER BY data DESC`;
    db.all(sql, [id], callback);
  }

  static registrarDiasTrabalhados(dados, callback) {
    const { funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada } = dados;
    const sql = `INSERT INTO trabalhos 
                (funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada ? 1 : 0, valor_empreitada], function(err) {
      callback(err, this.lastID);
    });
  }

  static registrarAdiantamento(dados, callback) {
    const { funcionario_id, valor, data, descricao } = dados;
    const sql = `INSERT INTO adiantamentos 
                (funcionario_id, valor, data, descricao)
                VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [funcionario_id, valor, data, descricao], function(err) {
      callback(err, this.lastID);
    });
  }

  static calcularPagamentoPeriodo(id, dataInicio, dataFim, callback) {
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
    
    db.get(sql, [id, dataInicio, dataFim, dataInicio, dataFim, id], callback);
  }
}

module.exports = Funcionario;