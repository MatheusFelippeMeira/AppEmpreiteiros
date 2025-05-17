const db = require('../config/database');

class Cliente {
  static async getAll() {
    const sql = `SELECT * FROM clientes ORDER BY nome`;
    return db.promiseAll(sql, []);
  }

  static async getById(id) {
    const sql = `SELECT * FROM clientes WHERE id = ?`;
    return db.promiseGet(sql, [id]);
  }

  static async create(cliente) {
    const { nome, contato, endereco, anotacoes } = cliente;
    const sql = `INSERT INTO clientes (nome, contato, endereco, anotacoes)
                VALUES (?, ?, ?, ?)`;
    
    return db.promiseRun(sql, [nome, contato, endereco, anotacoes]);
  }

  static async update(id, cliente) {
    const { nome, contato, endereco, anotacoes } = cliente;
    const sql = `UPDATE clientes SET 
                nome = ?, 
                contato = ?, 
                endereco = ?, 
                anotacoes = ?,
                data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?`;
    
    return db.promiseRun(sql, [nome, contato, endereco, anotacoes, id]);
  }

  static async delete(id) {
    const sql = `DELETE FROM clientes WHERE id = ?`;
    return db.promiseRun(sql, [id]);
  }

  // Métodos específicos para clientes
  static async getProjetos(id) {
    const sql = `SELECT * FROM projetos WHERE cliente_id = ? ORDER BY data_inicio DESC`;
    return db.promiseAll(sql, [id]);
  }

  static async getOrcamentos(id) {
    const sql = `SELECT * FROM orcamentos WHERE cliente_id = ? ORDER BY data_criacao DESC`;
    return db.promiseAll(sql, [id]);
  }
}

module.exports = Cliente;