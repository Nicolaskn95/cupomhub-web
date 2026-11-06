# CupomHub - Front-end

Aplicacao web para gerenciamento de notas fiscais (NFC-e), com foco em organizacao de gastos por categoria, visualizacao de indicadores e apoio ao controle financeiro pessoal.

O front-end consome uma API dedicada para autenticacao, cadastro/processamento de notas fiscais e manutencao de categorias/prefixos de classificacao.

## Tecnologias utilizadas

### Front-end (`cupomhub-web`)

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Chart.js + react-chartjs-2 (graficos e dashboards)
- `@yudiel/react-qr-scanner` + `html5-qrcode` (leitura de QR Code de cupons)
- Lucide React (icones)

### Back-end (`cupomhub`)

- NestJS 11
- TypeScript
- MongoDB com Mongoose
- JWT + Passport (autenticacao/autorizacao)
- Class Validator / Class Transformer (validacao de DTOs)
- Bcrypt (hash de senha)
- Axios + Cheerio (suporte ao processamento/coleta de dados de nota fiscal)

## Como o projeto funciona

- O usuario faz login/cadastro e recebe autenticacao via token JWT.
- O front-end envia requisicoes para a API (por padrao em `http://localhost:3001`).
- As notas fiscais podem ser processadas e listadas para analise.
- Produtos e estabelecimentos sao organizados e apresentados em dashboards.
- Categorias e prefixos ajudam a classificar os itens automaticamente.
- A base de dados MongoDB persiste usuarios, notas, produtos e configuracoes de categorizacao.

## Principais modulos da API

- `auth`: login, cadastro, perfil e alteracao de senha.
- `notas-fiscais`: processamento, listagens e dados para dashboard.
- `categorias`: gerenciamento de categorias e prefixos para classificacao.

## Configuracao e execucao local

### 1) Back-end

No repositorio `cupomhub`:

```bash
yarn install
yarn dev
```

Configure as variaveis de ambiente necessarias no back-end (principalmente `MONGODB_URI` e `JWT_SECRET`).

### 2) Front-end

No repositorio `cupomhub-web`:

```bash
yarn install
yarn dev
```

Opcionalmente, defina:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Com tudo em execucao:

- Front-end: [http://localhost:3000](http://localhost:3000)
- Back-end: [http://localhost:3001](http://localhost:3001)
