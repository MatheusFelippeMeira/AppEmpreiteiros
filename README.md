# App Empreiteiros

Sistema de gestão para empreiteiros e construtoras.

## Atualizações Recentes

### Correções no Módulo de Orçamentos

Foram realizadas as seguintes correções e melhorias:

1. **Correção da estrutura HTML** nos formulários de orçamentos
2. **Padronização do campo valor_total** em vez de valor_estimado
3. **Adição de novos campos** como tipo_obra, localidade e projeto_id
4. **Criação da página de detalhes** de orçamentos
5. **Implementação da geração de orçamentos com IA**
6. **Melhoria no tratamento de erros** e validação de dados

### Como Atualizar o Banco de Dados

Para aplicar as alterações no banco de dados, execute:

```
node update_database.js
```

Este script irá:
- Renomear a coluna valor_estimado para valor_total
- Adicionar as colunas tipo_obra, localidade e projeto_id
- Criar índices para melhorar a performance

## Funcionalidades

- Gestão de clientes
- Gestão de projetos
- Gestão de funcionários
- Geração de orçamentos
- Relatórios financeiros
- Integração com IA para análise de projetos e geração de orçamentos

## Requisitos

- Node.js 14+
- SQLite3

## Instalação

1. Clone o repositório
2. Instale as dependências: `npm install`
3. Configure o arquivo .env com base no .env.example
4. Execute o aplicativo: `node app.js`

## Licença

Este projeto é proprietário e confidencial.