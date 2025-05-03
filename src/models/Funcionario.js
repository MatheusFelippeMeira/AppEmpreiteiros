const db = require('../config/database');

class Funcionario {
  static async getAll() {
    const sql = `SELECT * FROM funcionarios ORDER BY nome`;
    return db.promiseAll(sql, []);
  }

  static async getById(id) {
    const sql = `SELECT * FROM funcionarios WHERE id = ?`;
    return db.promiseGet(sql, [id]);
  }

  static async create(funcionario) {
    const { nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes } = funcionario;
    const sql = `INSERT INTO funcionarios 
                (nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    return db.promiseRun(sql, [nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, observacoes]);
  }

  static async update(id, funcionario) {
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
    
    return db.promiseRun(sql, [nome, contato, funcao, valor_diaria, valor_hora_extra, valor_empreitada, status, observacoes, id]);
  }

  static async delete(id) {
    const sql = `DELETE FROM funcionarios WHERE id = ?`;
    return db.promiseRun(sql, [id]);
  }

  // Métodos específicos para funcionários
  static async getTrabalhos(id) {
    const sql = `SELECT t.*, p.nome as projeto_nome 
                FROM trabalhos t 
                JOIN projetos p ON t.projeto_id = p.id
                WHERE t.funcionario_id = ?
                ORDER BY t.data DESC`;
    
    return db.promiseAll(sql, [id]);
  }

  static async getAdiantamentos(id) {
    const sql = `SELECT * FROM adiantamentos WHERE funcionario_id = ? ORDER BY data DESC`;
    return db.promiseAll(sql, [id]);
  }

  static async registrarDiasTrabalhados(dados) {
    const { funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada } = dados;
    const sql = `INSERT INTO trabalhos 
                (funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada, valor_empreitada)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    return db.promiseRun(sql, [funcionario_id, projeto_id, data, dias_trabalhados, horas_extras, empreitada ? 1 : 0, valor_empreitada]);
  }

  static async registrarAdiantamento(dados) {
    const { funcionario_id, valor, data, descricao } = dados;
    const sql = `INSERT INTO adiantamentos 
                (funcionario_id, valor, data, descricao)
                VALUES (?, ?, ?, ?)`;
    
    return db.promiseRun(sql, [funcionario_id, valor, data, descricao]);
  }

  static async calcularTotais(id) {
    const funcionario = await this.getById(id);
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
  }

  static async calcularPagamentoPeriodo(id, dataInicio, dataFim) {
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
    
    return db.promiseGet(sql, [id, dataInicio, dataFim, dataInicio, dataFim, id]);
  }
}

module.exports = Funcionario;