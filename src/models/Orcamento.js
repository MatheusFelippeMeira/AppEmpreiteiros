const db = require('../config/database');

class Orcamento {
  static async getAll() {
    const sql = `
      SELECT o.*, c.nome as cliente_nome, p.nome as projeto_nome
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      LEFT JOIN projetos p ON o.projeto_id = p.id
      ORDER BY o.data_criacao DESC
    `;
    return db.promiseAll(sql, []);
  }

  static async getById(id) {
    const sql = `
      SELECT o.*, c.nome as cliente_nome, p.nome as projeto_nome
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      LEFT JOIN projetos p ON o.projeto_id = p.id
      WHERE o.id = ?
    `;
    return db.promiseGet(sql, [id]);
  }

  static async create(orcamento) {
    const { cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status } = orcamento;
    const sql = `
      INSERT INTO orcamentos 
        (cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return db.promiseRun(
      sql, 
      [cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status || 'pendente']
    );
  }

  static async update(id, orcamento) {
    const { cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status } = orcamento;
    const sql = `
      UPDATE orcamentos SET
        cliente_id = ?,
        projeto_id = ?,
        titulo = ?,
        descricao = ?,
        valor_total = ?,
        tipo_obra = ?,
        localidade = ?,
        status = ?,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    return db.promiseRun(
      sql, 
      [cliente_id, projeto_id, titulo, descricao, valor_total, tipo_obra, localidade, status, id]
    );
  }

  static async delete(id) {
    const sql = `DELETE FROM orcamentos WHERE id = ?`;
    return db.promiseRun(sql, [id]);
  }

  // Métodos específicos para orçamentos
  static async getByClienteId(clienteId) {
    const sql = `
      SELECT o.*, p.nome as projeto_nome
      FROM orcamentos o
      LEFT JOIN projetos p ON o.projeto_id = p.id
      WHERE o.cliente_id = ?
      ORDER BY o.data_criacao DESC
    `;
    return db.promiseAll(sql, [clienteId]);
  }

  static async getByProjetoId(projetoId) {
    const sql = `
      SELECT o.*, c.nome as cliente_nome
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      WHERE o.projeto_id = ?
      ORDER BY o.data_criacao DESC
    `;
    return db.promiseAll(sql, [projetoId]);
  }
}

module.exports = Orcamento;