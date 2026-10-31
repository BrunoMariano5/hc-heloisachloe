# HC — Heloísa Chloé · site oficial e loja virtual (protótipo)

Moda infantil premium do nascimento aos 10 anos. Primeiro protótipo funcional da loja:
navegação completa, identidade visual, catálogo demonstrativo em PT/EN/JA, carrinho,
favoritos, cadastro de clientes, cálculo de frete, checkout preparado para gateway e
área administrativa protegida.

> Produtos, imagens e preços são **demonstrativos**. Nenhum pagamento é simulado e
> nenhum pedido é criado enquanto não houver um gateway de pagamento real.

## Como rodar

Requer Node.js 20+ (sem dependências externas).

```bash
cp .env.example .env      # opcional
npm start                 # http://localhost:3000
```

- Loja: `http://localhost:3000`
- Administração: `http://localhost:3000/admin`
  - Sem `ADMIN_PASSWORD` no `.env`, uma senha forte é gerada no primeiro início e gravada em
    `data/runtime/admin-credentials.txt` (fora do git).
- `npm run reset-data` apaga os dados de execução e volta ao catálogo inicial (`data/seed`).

## Publicar no Render (gratuito)

O arquivo `render.yaml` já descreve o serviço.

1. Em [render.com](https://render.com), entre com a conta do GitHub.
2. **New → Blueprint**, escolha este repositório e confirme (**Apply**).
3. Após o deploy, o site fica em `https://hc-heloisachloe.onrender.com` (ou nome parecido).
4. Senha do painel: no serviço, aba **Environment**, variável `ADMIN_PASSWORD`. E-mail: `admin@hc.local`.

Limites do plano gratuito: o servidor dorme após ~15 min sem visitas (a primeira visita
seguinte leva ~30–50 s) e o disco é temporário — cadastros e alterações feitas no painel
voltam ao catálogo de `data/seed` quando o servidor reinicia. Para operar de verdade, use
banco de dados (ver "Próximos passos"). O site fica fora do Google enquanto
`ALLOW_INDEXING` for `false`.

## Estrutura

```
server/
  index.js            servidor HTTP: API, arquivos estáticos, HTML com SEO por rota
  config.js           configuração (.env)
  seo.js              title/description/Open Graph/hreflang/JSON-LD, sitemap.xml, robots.txt
  core/
    http.js           roteador, JSON, cookies, cabeçalhos de segurança, validação
    auth.js           senhas scrypt, sessões, limite de tentativas
    db.js             persistência (hoje JSON em data/runtime — trocar por banco real aqui)
  modules/
    catalog.js        catálogo público e coleções
    cart.js           precificação do carrinho no servidor
    shipping.js       frete (interface de transportadora + tabela de estimativa)
    payments.js       gateway (interface pronta, nenhum provedor ativo)
    orders.js         checkout e pedidos (criados só por pagamento confirmado)
    customers.js      cadastro, login, favoritos, exclusão de conta (LGPD)
    admin.js          produtos, preços, estoque, coleções, pedidos, clientes, indicadores, configurações
public/
  index.html          casca da loja (SPA com History API)
  assets/css/main.css identidade visual
  assets/js/          main (rotas), i18n, api, state (carrinho/favoritos), ui (componentes), pages/*
  locales/            pt.json, en.json, ja.json
  admin/              painel administrativo
data/seed/            catálogo, coleções e configurações iniciais
```

## Páginas

Início · Meninos · Meninas · Enxoval (com subcategorias) · Coleções (Newborn, Baby, Kids, Junior) ·
Produto · Busca · Sacola · Checkout · Minha conta · Favoritos · Sobre a HC · Contato (com FAQ).

## Segurança e dados

- Área administrativa e conta do cliente com sessões separadas (cookies `HttpOnly`, `SameSite=Strict`,
  `Secure` em produção), senhas com scrypt e limite de tentativas de login.
- API só aceita JSON (bloqueia formulários de outros sites), limite de tamanho de corpo,
  validação de todos os campos e preços sempre recalculados no servidor.
- Cabeçalhos CSP, `X-Frame-Options`, `nosniff` e bloqueio de path traversal.
- **Dados guardados do cliente: só nome, e-mail, senha (hash) e favoritos.** CPF, telefone,
  endereço e cartão não são armazenados até haver banco com criptografia, backup e política LGPD.
  O endereço do checkout é validado e repassado ao gateway, sem ser gravado.

## Próximos passos para operar de verdade

1. **Banco de dados**: reimplementar `server/core/db.js` com PostgreSQL (mesma interface).
2. **Pagamentos**: criar um adaptador em `server/modules/payments.js` (Mercado Pago, Stripe ou
   Pagar.me), usando o checkout/tokenização do provedor, e o webhook que chama `createFromPayment`.
3. **Frete**: provedor real (Correios / Melhor Envio) em `server/modules/shipping.js`.
4. **Imagens**: armazenamento de arquivos (S3/Cloudinary) para upload pelo painel e fotos reais dos produtos.
5. **Sessões**: mover para Redis/banco para rodar em mais de um servidor.
6. **Idiomas**: hoje via `?lang=`; para SEO internacional pleno, migrar para prefixos `/en/` e `/ja/`
   e moedas por região.
7. **Domínio, HTTPS, política de privacidade e termos** antes de abrir as vendas.
