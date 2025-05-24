const db = require('../config/database');

class Relatorio {
  // Relatório de lucratividade por projeto
  static async getLucratividadePorProjeto(filtros) {
    try {
      // Verificar se as tabelas necessárias existem
      const projetosExists = await db.tableExists('projetos');
      const clientesExists = await db.tableExists('clientes');
      const gastosExists = await db.tableExists('gastos');
      const trabalhosExists = await db.tableExists('trabalhos');
      const funcionariosExists = await db.tableExists('funcionarios');
      
      if (!projetosExists || !clientesExists || !gastosExists || !trabalhosExists || !funcionariosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return [];
      }
      
      // Usar strftime em vez de JULIANDAY para maior compatibilidade
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
      if (filtros && filtros.status) {
        sql += ` AND p.status = ?`;
        params.push(filtros.status);
      }
      
      if (filtros && filtros.dataInicio && filtros.dataFim) {
        sql += ` AND p.data_inicio BETWEEN ? AND ?`;
        params.push(filtros.dataInicio, filtros.dataFim);
      }
      
      if (filtros && filtros.clienteId) {
        sql += ` AND p.cliente_id = ?`;
        params.push(filtros.clienteId);
      }
      
      sql += ` ORDER BY p.data_inicio DESC`;
      
      return await db.promiseAll(sql, params);
    } catch (err) {
      console.error('Erro ao buscar lucratividade por projeto:', err);
      return [];
    }
  }
  
  // Relatório de custos por categoria
  static async getCustosPorCategoria(filtros) {
    try {
      // Verificar se as tabelas necessárias existem
      const gastosExists = await db.tableExists('gastos');
      const projetosExists = await db.tableExists('projetos');
      
      if (!gastosExists || !projetosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return [];
      }
      
      let sql = `SELECT 
                g.categoria,
                SUM(g.valor) as total_valor,
                COUNT(*) as total_registros
              FROM gastos g
              JOIN projetos p ON g.projeto_id = p.id
              WHERE 1=1`;
      
      let params = [];
      
      // Filtros
      if (filtros && filtros.projetoId) {
        sql += ` AND g.projeto_id = ?`;
        params.push(filtros.projetoId);
      }
      
      if (filtros && filtros.dataInicio && filtros.dataFim) {
        sql += ` AND g.data BETWEEN ? AND ?`;
        params.push(filtros.dataInicio, filtros.dataFim);
      }
      
      sql += ` GROUP BY g.categoria
             ORDER BY total_valor DESC`;
      
      return await db.promiseAll(sql, params);
    } catch (err) {
      console.error('Erro ao buscar custos por categoria:', err);
      return [];
    }
  }
  
  // Relatório de pagamento de funcionários
  static async getPagamentoFuncionarios(filtros) {
    try {
      // Verificar se as tabelas necessárias existem
      const funcionariosExists = await db.tableExists('funcionarios');
      const trabalhosExists = await db.tableExists('trabalhos');
      const projetosExists = await db.tableExists('projetos');
      const adiantamentosExists = await db.tableExists('adiantamentos');
      
      if (!funcionariosExists || !trabalhosExists || !projetosExists || !adiantamentosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return [];
      }
      
      if (!filtros || !filtros.dataInicio || !filtros.dataFim) {
        console.warn('Filtros de data são obrigatórios');
        return [];
      }
      
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
                ), 0) as valor_a_receber
              FROM funcionarios f
              LEFT JOIN trabalhos t ON t.funcionario_id = f.id
              LEFT JOIN projetos p ON t.projeto_id = p.id
              WHERE t.data BETWEEN ? AND ?`;
      
      let params = [
        filtros.dataInicio, filtros.dataFim,  // Para os adiantamentos
        filtros.dataInicio, filtros.dataFim,  // Para os adiantamentos novamente
        filtros.dataInicio, filtros.dataFim   // Para o período de trabalho
      ];
      
      // Filtro por funcionário específico
      if (filtros.funcionarioId) {
        sql += ` AND f.id = ?`;
        params.push(filtros.funcionarioId);
      }
      
      sql += ` GROUP BY f.id
             ORDER BY f.nome`;
      
      return await db.promiseAll(sql, params);
    } catch (err) {
      console.error('Erro ao buscar pagamentos de funcionários:', err);
      return [];
    }
  }
  
  // Obter resumo detalhado de um projeto
  static async getResumoProjeto(projetoId) {
    try {
      // Verificar se as tabelas necessárias existem
      const projetosExists = await db.tableExists('projetos');
      const clientesExists = await db.tableExists('clientes');
      const gastosExists = await db.tableExists('gastos');
      const trabalhosExists = await db.tableExists('trabalhos');
      const funcionariosExists = await db.tableExists('funcionarios');
      
      if (!projetosExists || !clientesExists || !gastosExists || !trabalhosExists || !funcionariosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return null;
      }
      
      // Buscar informações básicas do projeto
      // Usar strftime em vez de DATEDIFF para maior compatibilidade
      const sqlProjeto = `
        SELECT 
          p.*,
          c.nome as cliente_nome,
          c.contato as cliente_contato,
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
          (strftime('%s', p.data_fim_prevista) - strftime('%s', p.data_inicio)) / 86400.0 as dias_previstos,
          CASE 
            WHEN p.data_fim_real IS NOT NULL THEN (strftime('%s', p.data_fim_real) - strftime('%s', p.data_inicio)) / 86400.0
            ELSE (strftime('%s', 'now') - strftime('%s', p.data_inicio)) / 86400.0
          END as dias_duracao
        FROM projetos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.id = ?
      `;
      
      const projeto = await db.promiseGet(sqlProjeto, [projetoId]);
      
      if (!projeto) {
        return null;
      }
      
      // Calcular lucro líquido
      projeto.lucro_liquido = projeto.valor_receber - projeto.total_gastos - projeto.custo_mao_obra;
      
      // Buscar gastos por categoria
      const sqlGastosPorCategoria = `
        SELECT 
          categoria,
          SUM(valor) as total
        FROM gastos
        WHERE projeto_id = ?
        GROUP BY categoria
        ORDER BY total DESC
      `;
      
      projeto.gastosPorCategoria = await db.promiseAll(sqlGastosPorCategoria, [projetoId]);
      
      // Buscar funcionários que trabalharam no projeto
      const sqlFuncionarios = `
        SELECT 
          f.id,
          f.nome,
          f.funcao,
          SUM(
            CASE 
              WHEN t.empreitada = 1 THEN t.valor_empreitada 
              ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
            END
          ) as valor_total,
          SUM(t.dias_trabalhados) as dias_trabalhados,
          SUM(t.horas_extras) as horas_extras
        FROM funcionarios f
        JOIN trabalhos t ON f.id = t.funcionario_id
        WHERE t.projeto_id = ?
        GROUP BY f.id
        ORDER BY valor_total DESC
      `;
      
      projeto.funcionarios = await db.promiseAll(sqlFuncionarios, [projetoId]);
      
      return projeto;
    } catch (err) {
      console.error('Erro ao buscar resumo do projeto:', err);
      return null;
    }
  }
  
  // Obter indicadores para o Dashboard
  static async getDashboardIndicadores() {
    try {
      // Verificar se as tabelas necessárias existem
      const projetosExists = await db.tableExists('projetos');
      const funcionariosExists = await db.tableExists('funcionarios');
      const gastosExists = await db.tableExists('gastos');
      const trabalhosExists = await db.tableExists('trabalhos');
      
      if (!projetosExists || !funcionariosExists || !gastosExists || !trabalhosExists) {
        console.warn('Uma ou mais tabelas necessárias não existem');
        return {
          projetos_andamento: 0,
          total_funcionarios: 0,
          receita_total: 0,
          gastos_totais: 0,
          total_mao_obra: 0
        };
      }
      
      // Consulta que retorna vários indicadores de uma vez para melhor performance
      const sql = `
        SELECT 
          (SELECT COUNT(*) FROM projetos WHERE status = 'em_andamento') as projetos_andamento,
          (SELECT COUNT(*) FROM funcionarios WHERE status = 'ativo') as total_funcionarios,
          (SELECT SUM(valor_receber) FROM projetos) as receita_total,
          (SELECT SUM(valor) FROM gastos) as gastos_totais,
          (
            SELECT SUM(
              CASE 
                WHEN t.empreitada = 1 THEN t.valor_empreitada 
                ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
              END
            )
            FROM trabalhos t
            JOIN funcionarios f ON t.funcionario_id = f.id
          ) as total_mao_obra
      `;
      
      const indicadores = await db.promiseGet(sql);
      return indicadores || {
        projetos_andamento: 0,
        total_funcionarios: 0,
        receita_total: 0,
        gastos_totais: 0,
        total_mao_obra: 0
      };
    } catch (err) {
      console.error('Erro ao buscar indicadores para o dashboard:', err);
      // Retornar valores padrão em caso de falha
      return {
        projetos_andamento: 0,
        total_funcionarios: 0,
        receita_total: 0,
        gastos_totais: 0,
        total_mao_obra: 0
      };
    }
  }
  
  // Formatar dados para exportação CSV - Lucratividade
  static formatarDadosCSVLucratividade(projetos) {
    try {
      const headers = [
        'ID', 'Nome do Projeto', 'Cliente', 'Tipo', 'Localidade',
        'Data Início', 'Data Conclusão', 'Receita (R$)', 
        'Gastos Materiais (R$)', 'Custo Mão de Obra (R$)', 'Lucro Líquido (R$)'
      ];
      
      const rows = projetos.map(p => [
        p.id,
        p.nome,
        p.cliente_nome || 'N/A',
        p.tipo,
        p.localidade,
        p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : 'N/A',
        p.data_fim_real ? new Date(p.data_fim_real).toLocaleDateString('pt-BR') : 'Em andamento',
        (p.receita || 0).toFixed(2),
        (p.gastos_materiais || 0).toFixed(2),
        (p.custo_mao_obra || 0).toFixed(2),
        (p.lucro_liquido || 0).toFixed(2)
      ]);
      
      return { headers, rows };
    } catch (err) {
      console.error('Erro ao formatar dados CSV de lucratividade:', err);
      return { headers: [], rows: [] };
    }
  }
  
  // Formatar dados para exportação CSV - Custos por Categoria
  static formatarDadosCSVCustosPorCategoria(gastos) {
    try {
      const headers = ['Categoria', 'Total (R$)', 'Quantidade de Registros'];
      
      const rows = gastos.map(g => [
        g.categoria,
        (g.total_valor || 0).toFixed(2),
        g.total_registros || 0
      ]);
      
      return { headers, rows };
    } catch (err) {
      console.error('Erro ao formatar dados CSV de custos por categoria:', err);
      return { headers: [], rows: [] };
    }
  }
  
  // Formatar dados para exportação CSV - Pagamentos de Funcionários
  static formatarDadosCSVPagamentos(pagamentos) {
    try {
      const headers = [
        'ID', 'Nome', 'Função', 'Dias Trabalhados', 'Horas Extras',
        'Total Empreitadas (R$)', 'Valor Diárias (R$)', 
        'Valor Horas Extras (R$)', 'Total Bruto (R$)',
        'Total Adiantamentos (R$)', 'Valor a Receber (R$)'
      ];
      
      const rows = pagamentos.map(p => [
        p.id,
        p.nome,
        p.funcao,
        p.total_dias || 0,
        p.total_horas_extras || 0,
        (p.total_empreitadas || 0).toFixed(2),
        (p.valor_diarias || 0).toFixed(2),
        (p.valor_horas_extras || 0).toFixed(2),
        (p.total_bruto || 0).toFixed(2),
        (p.total_adiantamentos || 0).toFixed(2),
        (p.valor_a_receber || 0).toFixed(2)
      ]);
      
      return { headers, rows };
    } catch (err) {
      console.error('Erro ao formatar dados CSV de pagamentos:', err);
      return { headers: [], rows: [] };
    }
  }
}

module.exports = Relatorio;