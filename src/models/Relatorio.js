const db = require('../config/database');

class Relatorio {
  // Relatório de lucratividade por projeto
  static getLucratividadePorProjeto(filtros, callback) {
    let sql = `SELECT 
                p.id, p.nome, p.tipo, p.localidade, p.data_inicio, p.data_fim_real,
                c.nome as cliente_nome,
                p.valor_receber as receita,
                COALESCE((SELECT SUM(valor) FROM gastos WHERE projeto_id = p.id), 0) as gastos_materiais,
                COALESCE((
                  SELECT SUM(
                    CASE 
                      WHEN t.empreitada = 1 THEN t.valor_empreitada 
                      ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                    END
                  )
                  FROM trabalhos t
                  JOIN funcionarios f ON t.funcionario_id = f.id
                  WHERE t.projeto_id = p.id
                ), 0) as custo_mao_obra,
                p.valor_receber - COALESCE((SELECT SUM(valor) FROM gastos WHERE projeto_id = p.id), 0) - 
                COALESCE((
                  SELECT SUM(
                    CASE 
                      WHEN t.empreitada = 1 THEN t.valor_empreitada 
                      ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                    END
                  )
                  FROM trabalhos t
                  JOIN funcionarios f ON t.funcionario_id = f.id
                  WHERE t.projeto_id = p.id
                ), 0) as lucro_liquido
              FROM projetos p
              LEFT JOIN clientes c ON p.cliente_id = c.id
              WHERE 1=1`;
    
    let params = [];
    
    // Filtros
    if (filtros.status) {
      sql += ` AND p.status = ?`;
      params.push(filtros.status);
    }
    
    if (filtros.dataInicio && filtros.dataFim) {
      sql += ` AND p.data_inicio BETWEEN ? AND ?`;
      params.push(filtros.dataInicio, filtros.dataFim);
    }
    
    if (filtros.clienteId) {
      sql += ` AND p.cliente_id = ?`;
      params.push(filtros.clienteId);
    }
    
    sql += ` ORDER BY p.data_inicio DESC`;
    
    db.all(sql, params, callback);
  }
  
  // Relatório de custos por categoria
  static getCustosPorCategoria(filtros, callback) {
    let sql = `SELECT 
                g.categoria,
                SUM(g.valor) as total_valor,
                COUNT(*) as total_registros
              FROM gastos g
              JOIN projetos p ON g.projeto_id = p.id
              WHERE 1=1`;
    
    let params = [];
    
    // Filtros
    if (filtros.projetoId) {
      sql += ` AND g.projeto_id = ?`;
      params.push(filtros.projetoId);
    }
    
    if (filtros.dataInicio && filtros.dataFim) {
      sql += ` AND g.data BETWEEN ? AND ?`;
      params.push(filtros.dataInicio, filtros.dataFim);
    }
    
    sql += ` GROUP BY g.categoria
             ORDER BY total_valor DESC`;
    
    db.all(sql, params, callback);
  }
  
  // Relatório de pagamento de funcionários
  static getPagamentoFuncionarios(filtros, callback) {
    let sql = `SELECT 
                f.id, f.nome, f.funcao,
                SUM(t.dias_trabalhados) as total_dias,
                SUM(t.horas_extras) as total_horas_extras,
                SUM(CASE WHEN t.empreitada = 1 THEN t.valor_empreitada ELSE 0 END) as total_empreitadas,
                SUM(CASE WHEN t.empreitada = 0 THEN (t.dias_trabalhados * f.valor_diaria) ELSE 0 END) as valor_diarias,
                SUM(CASE WHEN t.empreitada = 0 THEN (t.horas_extras * f.valor_hora_extra) ELSE 0 END) as valor_horas_extras,
                SUM(CASE 
                  WHEN t.empreitada = 1 THEN t.valor_empreitada 
                  ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                END) as total_bruto,
                COALESCE((
                  SELECT SUM(valor) 
                  FROM adiantamentos 
                  WHERE funcionario_id = f.id
                  AND data BETWEEN ? AND ?
                ), 0) as total_adiantamentos,
                SUM(CASE 
                  WHEN t.empreitada = 1 THEN t.valor_empreitada 
                  ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                END) - COALESCE((
                  SELECT SUM(valor) 
                  FROM adiantamentos 
                  WHERE funcionario_id = f.id
                  AND data BETWEEN ? AND ?
                ), 0) as valor_a_pagar
              FROM funcionarios f
              LEFT JOIN trabalhos t ON f.id = t.funcionario_id AND t.data BETWEEN ? AND ?`;
    
    let params = [
      filtros.dataInicio, filtros.dataFim,
      filtros.dataInicio, filtros.dataFim,
      filtros.dataInicio, filtros.dataFim
    ];
    
    if (filtros.funcionarioId) {
      sql += ` WHERE f.id = ?`;
      params.push(filtros.funcionarioId);
    }
    
    sql += ` GROUP BY f.id
             ORDER BY total_bruto DESC`;
    
    db.all(sql, params, callback);
  }
  
  // Relatório de resumo por projeto
  static getResumoProjeto(id, callback) {
    const sql = `SELECT 
                  p.id, p.nome, p.tipo, p.localidade, p.status,
                  p.data_inicio, p.data_fim_prevista, p.data_fim_real,
                  c.nome as cliente_nome, c.contato as cliente_contato,
                  p.valor_receber,
                  COALESCE((SELECT SUM(valor) FROM gastos WHERE projeto_id = p.id), 0) as total_gastos,
                  COALESCE((
                    SELECT SUM(
                      CASE 
                        WHEN t.empreitada = 1 THEN t.valor_empreitada 
                        ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                      END
                    )
                    FROM trabalhos t
                    JOIN funcionarios f ON t.funcionario_id = f.id
                    WHERE t.projeto_id = p.id
                  ), 0) as custo_mao_obra,
                  p.deslocamento_incluido,
                  JULIANDAY(COALESCE(p.data_fim_real, CURRENT_DATE)) - JULIANDAY(p.data_inicio) as dias_duracao,
                  JULIANDAY(p.data_fim_prevista) - JULIANDAY(p.data_inicio) as dias_previstos
                FROM projetos p
                LEFT JOIN clientes c ON p.cliente_id = c.id
                WHERE p.id = ?`;
    
    db.get(sql, [id], (err, projeto) => {
      if (err || !projeto) {
        return callback(err, null);
      }
      
      // Obter gastos por categoria
      const sqlGastos = `SELECT categoria, SUM(valor) as total
                        FROM gastos
                        WHERE projeto_id = ?
                        GROUP BY categoria`;
      
      db.all(sqlGastos, [id], (err, gastosPorCategoria) => {
        if (err) {
          return callback(err, null);
        }
        
        // Obter dados dos funcionários
        const sqlFuncionarios = `SELECT 
                                f.nome, f.funcao,
                                SUM(t.dias_trabalhados) as dias_trabalhados,
                                SUM(t.horas_extras) as horas_extras,
                                SUM(CASE 
                                  WHEN t.empreitada = 1 THEN t.valor_empreitada 
                                  ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                                END) as valor_total
                              FROM trabalhos t
                              JOIN funcionarios f ON t.funcionario_id = f.id
                              WHERE t.projeto_id = ?
                              GROUP BY f.id
                              ORDER BY valor_total DESC`;
        
        db.all(sqlFuncionarios, [id], (err, funcionarios) => {
          if (err) {
            return callback(err, null);
          }
          
          // Retornar dados completos
          callback(null, {
            ...projeto,
            gastosPorCategoria,
            funcionarios,
            lucro_liquido: projeto.valor_receber - projeto.total_gastos - projeto.custo_mao_obra
          });
        });
      });
    });
  }
  
  // Dashboard - indicadores principais
  static getDashboardIndicadores(callback) {
    const sql = `SELECT 
                  (SELECT COUNT(*) FROM projetos WHERE status = 'em_andamento') as projetos_andamento,
                  (SELECT COUNT(*) FROM projetos WHERE status = 'concluido') as projetos_concluidos,
                  (SELECT SUM(valor_receber) FROM projetos) as receita_total,
                  (SELECT SUM(valor) FROM gastos) as gastos_totais,
                  (SELECT COUNT(*) FROM funcionarios) as total_funcionarios,
                  (SELECT 
                    SUM(CASE 
                      WHEN t.empreitada = 1 THEN t.valor_empreitada 
                      ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
                    END)
                    FROM trabalhos t
                    JOIN funcionarios f ON t.funcionario_id = f.id
                  ) as total_mao_obra`;
    
    db.get(sql, [], callback);
  }
}

module.exports = Relatorio;