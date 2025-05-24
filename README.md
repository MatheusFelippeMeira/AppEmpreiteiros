# App Empreiteiros

Sistema de gestão para empreiteiros e construtoras.

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```
   npm install
   ```
3. Inicialize o banco de dados:
   ```
   node init_database.js
   ```
4. Execute o aplicativo:
   ```
   node app.js
   ```

## Credenciais padrão

- Email: admin@exemplo.com
- Senha: admin123

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

## Estrutura do Banco de Dados

O sistema utiliza SQLite como banco de dados. As principais tabelas são:

- `usuarios`: Armazena os usuários do sistema
- `clientes`: Cadastro de clientes
- `projetos`: Projetos/obras em andamento ou concluídos
- `funcionarios`: Cadastro de funcionários
- `orcamentos`: Orçamentos gerados para clientes
- `orcamento_itens`: Itens detalhados dos orçamentos
- `gastos`: Registro de gastos por projeto
- `trabalhos`: Registro de trabalhos realizados por funcionários
- `adiantamentos`: Registro de adiantamentos para funcionários

## Solução de Problemas

Se você encontrar o erro "tabela não existe", execute o script de inicialização do banco de dados:

```
node init_database.js
```

## Licença

Este projeto é proprietário e confidencial.