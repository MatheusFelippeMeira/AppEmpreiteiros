const db = require('../config/database');

class Cliente {
  static getAll(callback) {
    const sql = `SELECT * FROM clientes ORDER BY nome`;
    db.all(sql, [], callback);
  }

  static getById(id, callback) {
    const sql = `SELECT * FROM clientes WHERE id = ?`;
    db.get(sql, [id], callback);
  }

  static create(cliente, callback) {
    const { nome, contato, endereco, anotacoes } = cliente;
    const sql = `INSERT INTO clientes (nome, contato, endereco, anotacoes)
                VALUES (?, ?, ?, ?)`;
    
    db.run(sql, [nome, contato, endereco, anotacoes], function(err) {
      callback(err, this.lastID);
    });
  }

  static update(id, cliente, callback) {
    const { nome, contato, endereco, anotacoes } = cliente;
    const sql = `UPDATE clientes SET 
                nome = ?, 
                contato = ?, 
                endereco = ?, 
                anotacoes = ?,
                data_atualizacao = CURRENT_TIMESTAMP
                WHERE id = ?`;
    
    db.run(sql, [nome, contato, endereco, anotacoes, id], callback);
  }

  static delete(id, callback) {
    const sql = `DELETE FROM clientes WHERE id = ?`;
    db.run(sql, [id], callback);
  }

  // Métodos específicos para clientes
  static getProjetos(id, callback) {
    const sql = `SELECT * FROM projetos WHERE cliente_id = ? ORDER BY data_inicio DESC`;
    db.all(sql, [id], callback);
  }

  static getOrcamentos(id, callback) {
    const sql = `SELECT * FROM orcamentos WHERE cliente_id = ? ORDER BY data_criacao DESC`;
    db.all(sql, [id], callback);
  }
}

module.exports = Cliente;