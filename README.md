# App Empreiteiros

Sistema de gerenciamento completo para empreiteiros e construtoras, desenvolvido para facilitar o gerenciamento de projetos, funcionários, orçamentos e relatórios.

## Funcionalidades

- Gerenciamento de projetos de construção
- Controle de funcionários e equipes
- Orçamentos e cotações
- Cronogramas de obra
- Relatórios financeiros
- Dashboard com indicadores de desempenho
- Suporte à integração com IA para análise de projetos

## Requisitos do Sistema

- Node.js >= 16.0.0
- NPM >= 8.0.0
- SQLite (integrado)

## Instalação

1. Clone este repositório:
```
git clone https://seu-repositorio/app-empreiteiros.git
cd app-empreiteiros
```

2. Instale as dependências:
```
npm install
```

3. Configure as variáveis de ambiente:
```
cp .env.example .env
```
Edite o arquivo `.env` com suas configurações.

4. Inicie o aplicativo:
```
npm start
```

Para desenvolvimento com reinicialização automática:
```
npm run dev
```

## Acesso ao Sistema

Após a inicialização, o sistema estará disponível em `http://localhost:3000`

**Credenciais padrão:**
- Email: admin@exemplo.com
- Senha: admin123

*Importante: Altere estas credenciais após o primeiro acesso!*

## Estrutura do Projeto

```
app-empreiteiros/
├── app.js                  # Ponto de entrada da aplicação
├── package.json            # Dependências do projeto
├── .env                    # Variáveis de ambiente
├── src/
│   ├── config/             # Configurações do sistema
│   ├── controllers/        # Controladores
│   ├── middlewares/        # Middlewares Express
│   ├── models/             # Modelos de dados
│   ├── public/             # Arquivos estáticos (CSS, JS, images)
│   ├── routes/             # Rotas da aplicação
│   ├── utils/              # Utilitários
│   └── views/              # Templates EJS
```

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.

## Suporte

Para suporte, envie um e-mail para suporte@seudominio.com ou abra uma issue no GitHub.