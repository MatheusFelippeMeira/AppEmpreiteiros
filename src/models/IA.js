const db = require('../config/database');
const { Configuration, OpenAIApi } = require('openai');

class IA {
  static async inicializarOpenAI() {
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    return new OpenAIApi(configuration);
  }

  // Analisar desempenho de um projeto
  static async analisarProjeto(projetoId) {
    try {
      // Obter dados do projeto
      const projeto = await db.promiseGet(
        `SELECT 
          p.*, 
          c.nome as cliente_nome,
          (SELECT SUM(valor) FROM gastos WHERE projeto_id = ?) as total_gastos,
          (
            SELECT SUM(
              CASE 
                WHEN t.empreitada = 1 THEN t.valor_empreitada 
                ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
              END
            )
            FROM trabalhos t
            JOIN funcionarios f ON t.funcionario_id = f.id
            WHERE t.projeto_id = ?
          ) as custo_mao_obra,
          (strftime('%s', COALESCE(p.data_fim_real, CURRENT_DATE)) - strftime('%s', p.data_inicio)) / 86400.0 as dias_duracao,
          (strftime('%s', p.data_fim_prevista) - strftime('%s', p.data_inicio)) / 86400.0 as dias_previstos
        FROM projetos p
        LEFT JOIN clientes c ON p.cliente_id = c.id
        WHERE p.id = ?`,
        [projetoId, projetoId, projetoId]
      );

      if (!projeto) {
        return { erro: 'Projeto não encontrado' };
      }

      // Obter gastos por categoria
      const gastosPorCategoria = await db.promiseAll(
        `SELECT categoria, SUM(valor) as total
        FROM gastos
        WHERE projeto_id = ?
        GROUP BY categoria`,
        [projetoId]
      );

      // Preparar dados para análise
      const lucroLiquido = projeto.valor_receber - projeto.total_gastos - projeto.custo_mao_obra;
      const margemLucro = ((lucroLiquido / projeto.valor_receber) * 100).toFixed(2);
      const progressoTempo = projeto.status === 'concluido' 
        ? 100 
        : ((Date.now()/1000 - new Date(projeto.data_inicio).getTime()/1000) / (projeto.dias_previstos * 86400)) * 100;
      
      // Enviar para a OpenAI para análise
      const openai = await this.inicializarOpenAI();
      
      const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: "Você é um assistente especializado em análise de projetos de construção e empreitadas. Forneça insights valiosos e sugestões práticas com base nos dados financeiros e de progresso do projeto." 
          },
          { 
            role: "user", 
            content: `Analise este projeto de construção e forneça 3-5 insights importantes e recomendações:
              Nome: ${projeto.nome}
              Cliente: ${projeto.cliente_nome}
              Tipo: ${projeto.tipo}
              Status: ${projeto.status}
              Valor total do projeto: R$ ${projeto.valor_receber}
              Gastos com materiais: R$ ${projeto.total_gastos}
              Custos de mão de obra: R$ ${projeto.custo_mao_obra}
              Lucro líquido: R$ ${lucroLiquido}
              Margem de lucro: ${margemLucro}%
              Dias previstos: ${projeto.dias_previstos}
              Dias trabalhados: ${projeto.dias_duracao}
              Progresso do tempo: ${progressoTempo.toFixed(2)}%
              Gastos por categoria: ${JSON.stringify(gastosPorCategoria)}
              
              Forneça insights econômicos e práticos sobre este projeto, analisando seu desempenho financeiro, eficiência, utilização de recursos e se ela está dentro do orçamento e prazo. Inclua sugestões específicas para melhorar a lucratividade ou eficiência.`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const analise = response.data.choices[0].message.content;
      
      return {
        dadosProjeto: {
          nome: projeto.nome,
          cliente: projeto.cliente_nome,
          valor: projeto.valor_receber,
          total_gastos: projeto.total_gastos,
          custo_mao_obra: projeto.custo_mao_obra,
          lucro_liquido: lucroLiquido,
          margem_lucro: margemLucro,
          dias_previstos: projeto.dias_previstos,
          dias_duracao: projeto.dias_duracao,
          progresso_tempo: progressoTempo.toFixed(2),
          gastos_por_categoria: gastosPorCategoria
        },
        analise: analise,
      };
    } catch (error) {
      console.error('Erro ao analisar projeto com IA:', error);
      return { erro: 'Erro ao processar análise do projeto', detalhe: error.message };
    }
  }

  // Gerar orçamento com base em parâmetros
  static async gerarOrcamento(dados) {
    try {
      const { tipo_obra, localidade, tamanho, descricao } = dados;
      
      // Dados históricos de projetos similares
      const projetosSimilares = await db.promiseAll(
        `SELECT 
          p.tipo, p.localidade, p.valor_receber,
          (SELECT SUM(valor) FROM gastos WHERE projeto_id = p.id) as total_gastos,
          (
            SELECT SUM(
              CASE 
                WHEN t.empreitada = 1 THEN t.valor_empreitada 
                ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
              END
            )
            FROM trabalhos t
            JOIN funcionarios f ON t.funcionario_id = f.id
            WHERE t.projeto_id = p.id
          ) as custo_mao_obra,
          (strftime('%s', COALESCE(p.data_fim_real, CURRENT_DATE)) - strftime('%s', p.data_inicio)) / 86400.0 as dias_duracao
        FROM projetos p
        WHERE p.tipo LIKE ? AND p.status = 'concluido'
        LIMIT 5`,
        [`%${tipo_obra}%`]
      ) || [];

      // Obter preço médio por diária dos funcionários
      const dadosFuncionarios = await db.promiseGet(
        `SELECT 
          AVG(valor_diaria) as media_diaria,
          AVG(valor_hora_extra) as media_hora_extra,
          AVG(valor_empreitada) as media_empreitada
        FROM funcionarios`
      ) || { media_diaria: 0, media_hora_extra: 0, media_empreitada: 0 };

      // Enviar para OpenAI para geração de orçamento
      const openai = await this.inicializarOpenAI();
      
      const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: "Você é um especialista em orçamentos de construção civil. Com base nos dados fornecidos, crie um orçamento detalhado e preciso para um novo projeto." 
          },
          { 
            role: "user", 
            content: `Gere um orçamento detalhado para um novo projeto com as seguintes características:
              Tipo de obra: ${tipo_obra}
              Localidade: ${localidade}
              Tamanho/Escopo: ${tamanho}
              Descrição adicional: ${descricao}
              
              Dados históricos de projetos similares:
              ${JSON.stringify(projetosSimilares)}
              
              Dados médios de mão de obra:
              - Diária média: R$ ${dadosFuncionarios?.media_diaria || 'Não disponível'}
              - Hora extra média: R$ ${dadosFuncionarios?.media_hora_extra || 'Não disponível'}
              - Valor médio de empreitada: R$ ${dadosFuncionarios?.media_empreitada || 'Não disponível'}
              
              Forneça um orçamento estruturado com as seguintes seções:
              1. Resumo do projeto
              2. Estimativa de materiais (por categoria: materiais básicos, acabamento, elétrica, hidráulica etc.)
              3. Estimativa de mão de obra (número de funcionários, dias estimados)
              4. Outros custos (deslocamento, alimentação, equipamentos)
              5. Valor total sugerido para orçamento
              6. Prazo estimado para conclusão
              7. Observações importantes e recomendações
              
              Inclua valores monetários para cada item e considere uma margem de lucro entre 20-30%.`
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const orcamento = response.data.choices[0].message.content;
      
      return {
        dados: {
          tipo_obra,
          localidade,
          tamanho,
          descricao,
        },
        projetos_referencia: projetosSimilares,
        orcamento: orcamento,
      };
    } catch (error) {
      console.error('Erro ao gerar orçamento com IA:', error);
      return { erro: 'Erro ao gerar orçamento', detalhe: error.message };
    }
  }

  // Obter sugestões inteligentes para o dashboard
  static async getSugestoesDashboard() {
    try {
      // Obter indicadores do dashboard
      const indicadores = await db.promiseGet(
        `SELECT 
          (SELECT COUNT(*) FROM projetos WHERE status = 'em_andamento') as projetos_andamento,
          (SELECT COUNT(*) FROM projetos WHERE status = 'concluido') as projetos_concluidos,
          (SELECT SUM(valor_receber) FROM projetos) as receita_total,
          (SELECT SUM(valor) FROM gastos) as gastos_totais,
          (SELECT COUNT(*) FROM funcionarios) as total_funcionarios
        FROM projetos LIMIT 1`
      ) || { projetos_andamento: 0, projetos_concluidos: 0, receita_total: 0, gastos_totais: 0, total_funcionarios: 0 };

      // Projetos que estão perto do prazo final
      const projetosUrgentes = await db.promiseAll(
        `SELECT 
          p.id, p.nome, p.data_fim_prevista, 
          (strftime('%s', p.data_fim_prevista) - strftime('%s', 'now')) / 86400.0 as dias_restantes,
          (strftime('%s', 'now') - strftime('%s', p.data_inicio)) / (strftime('%s', p.data_fim_prevista) - strftime('%s', p.data_inicio)) * 100 as percentual_tempo_consumido
        FROM projetos p
        WHERE p.status = 'em_andamento'
        AND (strftime('%s', p.data_fim_prevista) - strftime('%s', 'now')) / 86400.0 < 10
        ORDER BY dias_restantes ASC
        LIMIT 3`
      ) || [];

      // Projetos com possíveis problemas de lucratividade
      const projetosComProblemas = await db.promiseAll(
        `SELECT 
          p.id, p.nome, p.valor_receber,
          (SELECT SUM(valor) FROM gastos WHERE projeto_id = p.id) as gastos,
          (
            SELECT SUM(
              CASE 
                WHEN t.empreitada = 1 THEN t.valor_empreitada 
                ELSE (t.dias_trabalhados * f.valor_diaria) + (t.horas_extras * f.valor_hora_extra)
              END
            )
            FROM trabalhos t
            JOIN funcionarios f ON t.funcionario_id = f.id
            WHERE t.projeto_id = p.id
          ) as custo_mao_obra
        FROM projetos p
        WHERE p.status = 'em_andamento'
        HAVING (gastos + custo_mao_obra) > (p.valor_receber * 0.8)
        LIMIT 3`
      ) || [];

      // Funcionários com muitos adiantamentos
      const funcionariosComAdiantamentos = await db.promiseAll(
        `SELECT 
          f.id, f.nome,
          (SELECT SUM(valor) FROM adiantamentos WHERE funcionario_id = f.id AND data > date('now', '-30 day')) as total_adiantamentos
        FROM funcionarios f
        HAVING total_adiantamentos > 0
        ORDER BY total_adiantamentos DESC
        LIMIT 3`
      ) || [];

      // Compilar todas as sugestões
      const sugestoes = [
        // Projetos urgentes
        ...projetosUrgentes.map(p => ({
          tipo: 'aviso',
          titulo: 'Prazo de projeto próximo',
          mensagem: `O projeto "${p.nome}" tem apenas ${Math.round(p.dias_restantes)} dias até o prazo final e já consumiu ${Math.round(p.percentual_tempo_consumido)}% do tempo previsto.`
        })),
        
        // Problemas de lucratividade
        ...projetosComProblemas.map(p => {
          const total = (p.gastos || 0) + (p.custo_mao_obra || 0);
          const lucro = p.valor_receber - total;
          const margemLucro = ((lucro / p.valor_receber) * 100).toFixed(1);
          
          return {
            tipo: 'alerta',
            titulo: 'Margem de lucro reduzida',
            mensagem: `O projeto "${p.nome}" está com margem de lucro de apenas ${margemLucro}%. Os gastos já totalizam R$ ${total.toFixed(2)} de um total previsto de R$ ${p.valor_receber.toFixed(2)}.`
          };
        }),
        
        // Adiantamentos
        ...funcionariosComAdiantamentos.map(f => ({
          tipo: 'informacao',
          titulo: 'Adiantamentos recentes',
          mensagem: `O funcionário ${f.nome} recebeu R$ ${f.total_adiantamentos.toFixed(2)} em adiantamentos nos últimos 30 dias.`
        }))
      ];

      return {
        indicadores,
        sugestoes,
        alertas_urgentes: projetosUrgentes.length,
        alertas_lucratividade: projetosComProblemas.length
      };
    } catch (error) {
      console.error('Erro ao gerar sugestões para o dashboard:', error);
      return { erro: 'Erro ao processar sugestões', detalhe: error.message };
    }
  }
}

module.exports = IA;