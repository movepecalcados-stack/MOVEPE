# AUDITORIA TÉCNICA COMPLETA — MOVE PÉ PDV
**Data da auditoria:** 05/05/2026  
**Auditado por:** Claude Sonnet 4.6 (análise automatizada do código-fonte)  
**Finalidade:** Identificar bugs, riscos e lacunas para transformar em produto SaaS

---

## 1. VISÃO GERAL DO PROJETO

### Nome e propósito
**Move Pé PDV** — Sistema de Ponto de Venda (PDV) completo para loja de calçados física. Foi criado do zero para substituir o Tiny ERP, adaptado à rotina específica de uma loja de calçados (tamanhos, cores, crediário próprio, controle de caixa).

### Tipo de loja
Loja física de calçados de médio porte. Modelo de negócio: venda presencial, crediário próprio (fiado interno), sem e-commerce integrado. Faturamento histórico referência: ~R$ 166.639 em 9 meses (Jul/2025–Abr/2026).

### Funcionalidades principais (lista completa)

| Módulo | Arquivo principal | Descrição |
|---|---|---|
| PDV (Ponto de Venda) | `index.html` + `js/vendas.js` | Busca de produtos, carrinho, múltiplas formas de pagamento, cadastro rápido |
| Dashboard | `dashboard.html` + `js/dashboard.js` | KPIs do dia/mês, alertas, gráficos, saúde financeira |
| Estoque | `estoque.html` + `js/estoque.js` | Cadastro de produtos, variações cor/tamanho, galeria de fotos, estoque mínimo |
| Clientes | `clientes.html` + `js/clientes.js` | Cadastro, histórico de compras, aniversariantes |
| Crediário | `crediario.html` + `js/crediario.js` | Parcelas, juros automáticos, pagamento parcial, renegociação |
| Histórico de Vendas | `historico.html` + `js/historico.js` | Filtros por data, devoluções, trocas, impressão |
| Financeiro / DRE | `financeiro.html` + `js/financeiro.js` | DRE mensal, fluxo de caixa 30 dias, contas a pagar/receber, metas, diagnóstico, ranking de produtos |
| Caixa | `caixa.html` + `js/caixa.js` | Abertura/fechamento de caixa, sangria, reforço, histórico de fechamentos |
| WhatsApp | `whatsapp.html` + `js/whatsapp.js` | Templates de cobrança, envio via WhatsApp Web, gestão de inadimplentes |
| Relatórios | `relatorios.html` + `js/relatorios.js` | Vendas, gráficos diário/semanal/mensal, produtos mais vendidos |
| Etiquetas | `etiquetas.html` + `js/etiquetas.js` | Impressão de etiquetas (preço, vitrine 100×30mm, código de barras) |
| Configurações | `configuracoes.html` | Dados da loja, vendedores, taxas de cartão, backup, Firebase |
| Tráfego Pago | `trafego.html` + `js/trafego.js` | Controle de gastos com anúncios (Meta/Google) por semana |
| Importar Tiny | `importar.html` | Importação de produtos/vendas do Tiny ERP |
| Frete | `frete.html` + `js/frete.js` | Cálculo de frete (Correios/transportadoras) |
| Rastreio | `rastreio/index.html` | Rastreamento de encomendas (página separada) |
| Produtos | `produtos.html` + `js/produtos.js` | Gestão de catálogo (complementar ao estoque) |
| Stories | `stories.html` + `js/stories.js` | Agendamento/gestão de Stories para Instagram |

### Funcionalidades chave adicionais
- Taxa de cartão automática por bandeira/parcelamento (débito, crédito 1x/2-6x/7-12x, PIX)
- Crediário com acréscimo de 10% + juros de 0,4%/dia após 5 dias de carência
- Etiquetas de vitrine 100×30mm com preço cartão e crediário lado a lado
- Backup manual para JSON (download local)
- Sincronização Firebase Firestore em tempo real
- Aviso de backup (banner se > 7 dias sem backup)
- Comparativo de faturamento com ano anterior via histórico do Tiny ERP
- Geração de contrato de crediário para impressão
- Servidor local (`servidor.js`) para acesso via Wi-Fi na loja

### Status atual
**Em produção** — sendo usado diariamente pela Move Pé Calçados. Sistema único (single-tenant), sem ambiente de staging.

---

## 2. STACK TECNOLÓGICA

### Linguagens
- **HTML5** — estrutura de todas as páginas
- **CSS3** — estilo único em `css/style.css` (~1 arquivo, tema light)
- **JavaScript (ES6+)** — toda a lógica do front-end, sem transpilação
- **Node.js** — apenas o `servidor.js` local (não está em produção na nuvem)

### Frameworks
- **Frontend:** NENHUM (Vanilla JS puro, sem React, Vue, Angular ou similares)
- **Backend:** NENHUM (aplicação 100% client-side)
- **CSS:** Sem framework (CSS custom properties, sem Bootstrap/Tailwind)

### Banco de dados
- **Primário:** `localStorage` do navegador (limite ~5-10 MB dependendo do browser)
- **Sincronização:** Firebase Firestore (cloud, real-time listeners)
- **Versão Firebase SDK:** 9.23.0 (compat mode — SDK legado, não modular)

### Dependências (package.json completo)
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.105.2",
    "dotenv": "^17.4.2",
    "xlsx": "^0.18.5"
  }
}
```

> **Nota crítica:** `@supabase/supabase-js` e `dotenv` estão no `package.json` mas **não são usados em nenhum arquivo do sistema atual**. São resquícios de experimentos. O `xlsx` é carregado via CDN (`unpkg.com`) no browser, não via npm. As dependências npm são irrelevantes para o funcionamento da aplicação.

### Bibliotecas carregadas via CDN (usadas de fato)
- `firebase-app-compat.js` v9.23.0 — inicialização Firebase
- `firebase-firestore-compat.js` v9.23.0 — banco de dados cloud
- `xlsx` (via unpkg CDN) — importação de planilhas do Tiny ERP (carregado sob demanda)

### Serviços externos
| Serviço | Uso | Observação |
|---|---|---|
| Firebase Firestore | Banco de dados cloud / sincronização | Projeto: `pdv-move-pe` |
| GitHub Pages | Hospedagem em produção | `movepecalcados-stack.github.io/MOVEPE/` |
| WhatsApp Web | Envio de mensagens de cobrança | Abre links `wa.me/` — sem API oficial |
| CDN unpkg | Biblioteca xlsx | Carregado sob demanda na importação |

### Onde está hospedado
- **Produção:** GitHub Pages — `https://movepecalcados-stack.github.io/MOVEPE/dashboard.html`
- **Rede local:** `servidor.js` (Node.js HTTP simples, porta 8080) — para uso sem internet

---

## 3. ESTRUTURA DO PROJETO

### Árvore de diretórios
```
MovePe/
├── css/
│   └── style.css              # Único arquivo CSS (tema light, ~800 linhas)
├── js/
│   ├── db.js                  # Camada de dados: localStorage + Firebase (34 KB)
│   ├── utils.js               # Utilitários globais: formatação, UI helpers (32 KB)
│   ├── dashboard.js           # Dashboard: KPIs, gráficos, alertas (69 KB)
│   ├── vendas.js              # PDV: carrinho, venda, pagamento (88 KB)
│   ├── crediario.js           # Crediário: parcelas, juros, cobrança (83 KB)
│   ├── financeiro.js          # DRE, contas, metas, relatórios financeiros (206 KB)
│   ├── historico.js           # Histórico de vendas, filtros, devolução (24 KB)
│   ├── caixa.js               # Controle de caixa, fechamento (30 KB)
│   ├── estoque.js             # Cadastro de produtos, variações, fotos (27 KB)
│   ├── clientes.js            # Cadastro e histórico de clientes (35 KB)
│   ├── relatorios.js          # Relatórios gerenciais (19 KB)
│   ├── whatsapp.js            # Envio WhatsApp, templates de cobrança (30 KB)
│   ├── etiquetas.js           # Geração e impressão de etiquetas (25 KB)
│   ├── trafego.js             # Controle de tráfego pago (36 KB)
│   ├── frete.js               # Cálculo de frete (14 KB)
│   ├── stories.js             # Gestão de stories Instagram (17 KB)
│   └── produtos.js            # Módulo de produtos (7 KB)
├── rastreio/
│   └── index.html             # Página de rastreio de encomendas
├── caixa.html
├── clientes.html
├── configuracoes.html
├── crediario.html
├── dashboard.html             # Página inicial (após login)
├── estoque.html
├── etiquetas.html
├── financeiro.html
├── frete.html
├── historico.html
├── importar.html
├── index.html                 # PDV (ponto de venda)
├── login.html                 # Autenticação
├── produtos.html
├── relatorios.html
├── stories.html
├── trafego.html
├── whatsapp.html
├── servidor.js                # Servidor HTTP local para rede interna
├── vercel.json                # Configuração Vercel (redirect raiz)
├── package.json               # Dependências npm (mayoramente não usadas)
├── dados_tiny_historico.json  # Backup de histórico importado do Tiny ERP
├── contas_receber_tiny.json   # Contas a receber exportadas do Tiny
├── weto-cerebro.md            # Prompt/persona do atendente virtual WhatsApp
└── favicon.ico
```

### Explicação das pastas
- **`css/`** — Um único arquivo CSS global com todas as classes, variáveis CSS e componentes
- **`js/`** — Todo o JavaScript da aplicação; cada módulo é um arquivo independente, carregados como scripts no HTML respectivo
- **`rastreio/`** — Subpágina de rastreio, possivelmente para clientes externos (sem autenticação verificada)

---

## 4. BANCO DE DADOS

### Arquitetura de dados
O sistema **não tem banco de dados relacional**. Os dados são armazenados como arrays JSON no `localStorage` do navegador, com chave prefixada `movePe_`. O Firebase Firestore é usado como camada de sincronização/backup em cloud.

**Coleções Firebase = chaves localStorage:**

```
movePe_produtos        → produtos (catálogo + estoque)
movePe_clientes        → clientes
movePe_vendas          → vendas
movePe_crediario       → crediário (parcelas)
movePe_caixa           → histórico de caixas
movePe_fluxo           → fluxo de caixa (entradas/saídas manuais)
movePe_despesas        → despesas fixas e variáveis
movePe_retiradas       → retiradas do dono
movePe_grades          → grades de reposição de produtos
movePe_trafego         → gastos com tráfego pago
movePe_renda_pessoal   → renda pessoal do dono (NÃO sincroniza com Firebase)
movePe_config          → configurações do sistema
movePe_historico_tiny  → histórico importado do Tiny ERP (NÃO sincroniza)
movePe_fb_config       → credenciais Firebase (NÃO sincroniza)
movePe_senha           → senha de acesso (PLAIN TEXT, NÃO sincroniza)
movePe_ultimo_backup   → timestamp do último backup
```

### Schemas de dados

#### Produto
```json
{
  "id": "string (base36 timestamp + random)",
  "nome": "string",
  "marca": "string",
  "categoria": "string (calcado_adulto | calcado_infantil | roupa)",
  "sku": "string (opcional)",
  "codigoBarras": "string (opcional)",
  "precoVenda": "number",
  "precoCusto": "number",
  "variacoes": {
    "38||Preto": "number (estoque)",
    "39||Branco": "number"
  },
  "estoqueMinimo": "number (default 3)",
  "foto": "string (base64 | URL, opcional)",
  "fotos": ["string (base64, array de até 7)"],
  "fotosVariacoes": { "preto": "base64", "branco": "base64" },
  "ativo": "boolean (false = excluído logicamente)",
  "criadoEm": "ISO 8601 string",
  "atualizadoEm": "ISO 8601 string"
}
```

#### Cliente
```json
{
  "id": "string",
  "nome": "string",
  "cpf": "string (formatado: 000.000.000-00)",
  "telefone": "string",
  "email": "string (opcional)",
  "dataNascimento": "string YYYY-MM-DD (opcional)",
  "endereco": "string (opcional)",
  "observacoes": "string (opcional)",
  "criadoEm": "ISO 8601 string"
}
```

#### Venda
```json
{
  "id": "string",
  "clienteId": "string (opcional)",
  "clienteNome": "string (opcional)",
  "itens": [
    {
      "produtoId": "string",
      "nome": "string",
      "tamanho": "string (ex: '38||Preto')",
      "quantidade": "number",
      "precoUnitario": "number",
      "precoCusto": "number (snapshot do custo na hora da venda)"
    }
  ],
  "total": "number",
  "formaPagamento": "string (dinheiro|pix|cartao_credito|cartao_debito|crediario|multiplo)",
  "formasPagamento": [{ "forma": "string", "valor": "number" }],
  "parcelasCartao": "number (opcional)",
  "valorTaxaCartao": "number",
  "vendedor": "string (opcional)",
  "vendedorComissao": "number (percentual, opcional)",
  "observacao": "string (opcional)",
  "devolucoes": [
    {
      "tipo": "string (devolucao|troca)",
      "itens": "array",
      "valorDevolvido": "number",
      "data": "ISO 8601 string"
    }
  ],
  "criadoEm": "ISO 8601 string"
}
```

#### Crediário
```json
{
  "id": "string",
  "vendaId": "string (referência à venda)",
  "clienteId": "string",
  "clienteNome": "string",
  "total": "number (com acréscimo 10%)",
  "parcelas": [
    {
      "numero": "number",
      "vencimento": "string YYYY-MM-DD",
      "valor": "number",
      "status": "string (pendente|pago)",
      "dataPagamento": "ISO 8601 string (se pago)",
      "valorPago": "number (se pagamento parcial)"
    }
  ],
  "criadoEm": "ISO 8601 string"
}
```

#### Caixa
```json
{
  "id": "string",
  "status": "string (aberto|fechado)",
  "aberturaEm": "ISO 8601 string",
  "fechamentoEm": "ISO 8601 string (se fechado)",
  "saldoInicial": "number",
  "saldoEsperado": "number",
  "saldoContado": "number (digitado no fechamento)",
  "totalVendas": "number",
  "totalDinheiro": "number",
  "totalPix": "number",
  "totalCartaoCredito": "number",
  "totalCartaoDebito": "number",
  "totalCrediario": "number",
  "totalCrediarioRecebido": "number",
  "totalSangria": "number",
  "totalReforco": "number"
}
```

#### Despesa
```json
{
  "id": "string",
  "descricao": "string",
  "categoria": "string (fixo|variavel)",
  "valor": "number",
  "vencimento": "string YYYY-MM-DD",
  "pago": "boolean",
  "recorrente": "boolean (fixas mensais)",
  "dataPagamento": "ISO 8601 string (opcional)",
  "criadoEm": "ISO 8601 string"
}
```

#### Config (objeto único)
```json
{
  "nomeLoja": "string",
  "cnpj": "string",
  "telefone": "string",
  "nomeAtendente": "string",
  "taxasCartao": {
    "debito": "number (percentual)",
    "pix": "number",
    "credito1x": "number",
    "credito2a6": "number",
    "credito7a12": "number"
  },
  "taxaCrediario": "number (default 10)",
  "carenciaDias": "number (default 5)",
  "jurosDia": "number (default 0.004)",
  "limiteCrediario": "number (% do faturamento, default 25)",
  "metaMensal": "number",
  "vendedores": [{ "nome": "string", "comissao": "number" }]
}
```

### Relacionamentos
- `crediario.vendaId` → `vendas.id` (não é FK real — sem integridade referencial)
- `crediario.clienteId` → `clientes.id` (idem)
- `vendas.clienteId` → `clientes.id` (idem)
- `vendas.itens[].produtoId` → `produtos.id` (idem)

> **Não há integridade referencial.** Se um cliente for excluído, os crediários com seu `clienteId` continuam existindo com referência quebrada. O sistema trata isso com fallbacks (`cli ? cli.nome : 'Cliente'`).

### Quantidade de registros (estimativa baseada no histórico)
| Coleção | Estimativa |
|---|---|
| produtos | 100–300 SKUs ativos |
| clientes | 200–500 clientes |
| vendas | 1.000–1.500 registros (desde Jul/2025) |
| crediario | 200–400 entradas |
| caixa | 200–300 fechamentos |
| fluxo | 500–1.000 movimentações |
| despesas | 20–50 |
| retiradas | 50–100 |
| grades | 10–30 |

### Migrations
**Não existem migrations.** Não há versionamento de schema. A versão `3.0` está apenas no comentário do backup exportado (`"versao": "3.0"`). Mudanças de estrutura de dados são feitas diretamente no código JavaScript.

---

## 5. ARQUITETURA

### Padrão arquitetural
**Monolito frontend (SPA sem framework)**. Não segue MVC, Clean Architecture ou qualquer padrão formal. O padrão de fato é:

```
HTML (view) → JS módulo (controller + model) → DB (camada de dados localStorage/Firebase)
```

Cada página HTML carrega seus próprios scripts. Não há roteamento (cada página é um arquivo `.html` separado). Não há bundler (Webpack, Vite, etc.) — cada `<script src="">` é carregado individualmente.

### Autenticação
**Extremamente simples e insegura:**

```javascript
// Login: compara senha digitada com a salva no localStorage (PLAIN TEXT)
if (digitada === localStorage.getItem('movePe_senha')) {
  sessionStorage.setItem('movePe_auth', '1');
  location.replace('dashboard.html');
}
```

- Senha armazenada em **plain text** em `localStorage` (`movePe_senha`)
- "Token" de sessão é apenas `sessionStorage.setItem('movePe_auth', '1')` — uma string qualquer
- Proteção de rotas: cada página verifica `if(!sessionStorage.getItem('movePe_auth')) location.replace('login.html')`
- **Bypass trivial:** abrir DevTools → Console → `sessionStorage.setItem('movePe_auth','1')` → acessar qualquer página

### Controle de sessões
- Baseado em `sessionStorage` (persiste enquanto a aba/janela estiver aberta)
- Sem expiração de sessão
- Sem JWT, sem cookies, sem tokens assinados
- Sem logout por inatividade

### Separação de ambientes
**Não existe.** Há apenas produção (GitHub Pages). Testes são feitos diretamente em produção ou localmente via `servidor.js` ou abrindo o arquivo HTML diretamente no navegador.

### Multi-tenant
**Não implementado.** O sistema é single-tenant por design:
- Todos os dados ficam no `localStorage` do browser com prefixo fixo `movePe_`
- Firebase: um único projeto Firestore sem separação por cliente
- Um único arquivo de configuração Firebase (hardcoded por cliente)
- A "senha" é global (não há conceito de usuário)

---

## 6. FUNCIONALIDADES DETALHADAS

### 6.1 PDV — Ponto de Venda
**O que faz:** Interface principal de vendas. Busca produtos, monta carrinho, aplica taxas de cartão automaticamente, finaliza venda, desconta estoque, abre crediário se necessário.

**Arquivos:** `index.html`, `js/vendas.js`

**Fluxo:**
1. Operador busca produto por nome/marca/SKU
2. Seleciona tamanho/cor (chip com estoque)
3. Adiciona ao carrinho
4. Seleciona forma de pagamento (taxa de cartão calculada automaticamente)
5. Confirma venda → estoque decrementado → venda salva → crediário criado (se for crediário)

**Integrações:** DB.Vendas, DB.Produtos, DB.Crediario, DB.Caixa

**Detalhe técnico:** O módulo `vendas.js` tem 88KB e inclui dentro dele: PDV, cadastro rápido de produto, termômetro de crediário, lógica de múltiplas formas de pagamento e parcelamento.

---

### 6.2 Dashboard
**O que faz:** Visão geral em tempo real. KPIs do dia e mês, gráficos, alertas de estoque baixo, vencimentos próximos, aniversariantes, comparativo com mês anterior e ano anterior (via Tiny).

**Arquivo:** `js/dashboard.js` (69 KB, ~18 funções `render*`)

**Auto-refresh:** a cada 60 segundos via `setInterval`

**Seções renderizadas:**
- `renderStats` — vendas hoje/mês, produtos com estoque baixo
- `renderGrafico6Meses` — barras dos últimos 6 meses
- `renderGrafico7Dias` — vendas dos últimos 7 dias
- `renderTop5` — produtos mais vendidos
- `renderSaudeFinanceira` — percentual crediário, média 3 meses
- `renderFluxo30Dias` — evolução diária 30 dias
- `renderEstoqueParado` — produtos com estoque parado > 60 dias
- `renderAlertas` — alertas críticos consolidados
- `renderEstoqueBaixo` — produtos abaixo do mínimo
- `renderAniversariantes` — clientes aniversariantes do dia/semana
- `renderVencimentos7Dias` — parcelas vencendo em 7 dias
- `renderPgtoHoje` — pagamentos de crediário esperados hoje
- `renderTermometroCrediario` — % do faturamento em crediário vs. limite

---

### 6.3 Crediário
**O que faz:** Gestão completa de crediário próprio. Cria parcelas, calcula juros por atraso (0,4%/dia após 5 dias de carência), permite pagamento parcial com abatimento, renegociação, "pagar tudo".

**Arquivo:** `js/crediario.js` (83 KB)

**Fluxo de juros:**
```
diasAtraso = hoje - vencimento
diasComJuros = max(0, diasAtraso - carencia(5 dias))
juros = valor * 0.004 * diasComJuros
```

**Deduplicação de crediários:** O sistema tem lógica complexa de dedup (3 camadas) para evitar duplicatas que surgem da sincronização Firebase. Isso é um indicativo de que duplicatas ocorrem com alguma frequência.

---

### 6.4 Financeiro / DRE
**O que faz:** Demonstrativo de Resultado (DRE) mensal, fluxo de caixa, contas a pagar/receber, retiradas do dono, metas, diagnóstico financeiro, ranking de produtos, histórico do Tiny ERP.

**Arquivo:** `js/financeiro.js` (206 KB — o maior do sistema)

**Abas disponíveis:** resumo, dre, fluxo30, ranking, reposição, precificação, contas, metas, diagnóstico, tráfego, histórico

**Cálculo DRE:**
- Receita: vendas à vista (exceto crediário) + crediário recebido no mês (parcelas pagas)
- CMV: custo dos produtos vendidos (snapshot do `precoCusto` no momento da venda)
- Taxas de cartão: calculadas por forma de pagamento
- Despesas: fixas (recorrentes) + variáveis (por vencimento)
- Lucro bruto e líquido

---

### 6.5 WhatsApp Automático
**O que faz:** Gera mensagens personalizadas de cobrança para inadimplentes e parcelas vencendo. Abre diretamente no WhatsApp Web com a mensagem pré-preenchida.

**Arquivo:** `js/whatsapp.js` (30 KB)

**Templates:** Lembrete amigável, 1ª cobrança, 2ª cobrança, Aviso final (Serasa), pós-venda, aniversário

**Limitação:** Não usa a API oficial do WhatsApp Business. Abre `https://wa.me/{numero}?text={mensagem}`. Requer interação manual do usuário para enviar. Não há envio automático.

---

### 6.6 Sincronização Firebase
**O que faz:** Mantém localStorage sincronizado com Firestore via `onSnapshot` (listeners em tempo real). Permite uso do sistema em múltiplos computadores da loja com dados sincronizados.

**Estratégia de merge (conflitos):**
- Para produtos: merge inteligente baseado em timestamp e número de variações (local vence se tiver mais variações)
- Para demais coleções: Firebase sobrescreve local
- Fotos (base64) não são enviadas ao Firebase (documentos > 1MB rejeitados pelo Firestore)

**Coleções sincronizadas:** produtos, clientes, vendas, crediario, caixa, fluxo, despesas, retiradas, grades, trafego

**NÃO sincronizadas:** renda_pessoal, historico_tiny, fb_config, senha, config (config sincroniza separado)

---

## 7. BUGS CONHECIDOS E PROBLEMAS

### Bugs críticos corrigidos recentemente

**Bug 1 — Timezone: vendas de abril não apareciam (CORRIGIDO em 05/05/2026)**
- `listarPorPeriodo` usava `.substring(0, 10)` da data UTC para comparar com datas locais
- Para Brasil (UTC-3), vendas feitas após 21h local tinham data UTC do dia seguinte
- Efeito: vendas do final do dia poderiam cair em mês errado
- Correção: `listarPorPeriodo` agora usa boundaries UTC reais (`T00:00:00` e `T23:59:59`)

**Bug 2 — Timezone: botão "Mês passado" usava `.toISOString()` (CORRIGIDO em 05/05/2026)**
- `historico.js filtroPeriodo('mes_passado')` calculava `ini = d.toISOString().substring(0, 10)`
- Para UTC-3: "2026-04-01 00:00 local" → "2026-03-31T21:00Z" → `ini = "2026-03-31"` (errado!)
- Resultado: filtro pegava de 31/03 a 29/04 em vez de 01/04 a 30/04 — dia 30 de abril sumia
- Correção: substituído por formatação de data local

**Bug 3 — `'-31'` hardcoded como fim de mês (CORRIGIDO em 05/05/2026)**
- `financeiro.js`, `dashboard.js`, `vendas.js` usavam `mes + '-31'` como data final do mês
- Após correção de `listarPorPeriodo`, "2026-04-31" seria interpretado como "2026-05-01" pelo JavaScript
- Correção: adicionado `Utils.fimMes(mes)` que calcula o último dia real de cada mês

**Bug 4 — Caixa: crediário sumia nos fechamentos (CORRIGIDO em 10/04/2026)**
- Filtro do caixa usava `Utils.hoje()` mas lançamentos ≥21h caíam no dia seguinte (UTC)
- Correção: todos os filtros do caixa usam `caixa.aberturaEm` como corte

**Bug 5 — Financeiro, lista de reposição: ícone ⚠️ nunca aparecia (CORRIGIDO em 28/04/2026)**
- Campo `r.qtdVendida` não existia no objeto — correto era `r.qtd`

---

### Bugs e problemas conhecidos ainda presentes

**Bug 6 — `FluxoCaixa.resumoPorMeses` usa `.startsWith(prefix)` em data UTC**
```javascript
// js/db.js linha ~663
const vendas = _get('vendas').filter(v => (v.criadoEm || '').startsWith(prefix));
```
`v.criadoEm` é ISO UTC. Vendas feitas após 21h local com data UTC do mês seguinte serão erroneamente excluídas do mês.

**Bug 7 — `Crediario.inadimplentes()` usa `.toISOString().substring(0,10)` para "hoje"**
```javascript
// js/db.js linha ~575
const hoje = new Date().toISOString().substring(0, 10);
```
Este é UTC. Se usada entre 21h e meia-noite local, retorna data de amanhã, podendo classificar parcelas erradas como inadimplentes.

**Bug 8 — `relatorios.js atalho('semana')` usa `.toISOString()`**
```javascript
// js/relatorios.js linha ~50
el('rel-inicio').value = seg.toISOString().substring(0, 10);
```
Mesma classe de bug de timezone — início de semana pode ficar um dia deslocado.

**Bug 9 — `db.js Produtos.listarParados` usa `v.criadoEm.substring(0,10)` (UTC)**
```javascript
// js/db.js linha ~352
const dt = (v.criadoEm || '').substring(0, 10); // UTC, não local
```
A última data de venda de um produto pode ficar registrada como dia seguinte para vendas tardias.

**Bug 10 — Deduplicação de crediário é O(n²) ou pior**
A função `DB.Crediario.listar()` roda três passes de deduplicação com maps complexos toda vez que é chamada. Para 400+ crediários em localStorage (cada chamada relê e processa o array inteiro), isso pode causar travamentos perceptíveis.

**Bug 11 — `dashboard.js renderGrafico6Meses` escaneia vendas 6 vezes**
```javascript
for (let i = 5; i >= 0; i--) {
  const vendas = DB.Vendas.listarPorPeriodo(...); // lê localStorage + filtra 6x
}
```
Para 1.500+ vendas, isso significa 6 leituras e 6 iterações completas do array. Sem cache.

**Bug 12 — Fotos base64 no localStorage sem controle de tamanho**
Cada produto pode ter até 7 fotos em base64. Uma foto média JPEG de 500KB em base64 = ~700KB. Com 10 produtos e 3 fotos cada = 21MB, estourando o limite de ~5-10MB do localStorage. O sistema não avisa e simplesmente falha silenciosamente.

**Bug 13 — Firebase: fotos não sincronizam**
Produtos com fotos base64 têm as fotos removidas antes de enviar ao Firestore (documentos > 1MB são rejeitados). Ao abrir o sistema em outro computador, os produtos aparecem sem foto.

**Bug 14 — Sem limite de tentativas no login**
```javascript
// login.html
if (digitada === salva) { /* ok */ } else { /* mostra erro, limpa campo */ }
```
Não há rate limiting, lockout após N tentativas, nem captcha. Brute force trivial via script de console.

**Bug 15 — Backup só manual**
O aviso de backup aparece após 7 dias, mas é apenas um banner informativo. Não há backup automático. Se o localStorage for limpo (limpeza de dados do browser, reinstalação, troca de navegador), todos os dados locais são perdidos. A segurança real depende exclusivamente do Firestore.

---

## 8. SEGURANÇA — ANÁLISE CRÍTICA

### Como senhas são armazenadas
**CRÍTICO:** Armazenada em plain text no localStorage:
```javascript
// login.html linha 71-72
const digitada = document.getElementById('inputSenha').value;
const salva = localStorage.getItem('movePe_senha');
if (digitada === salva) { ... }
```
Qualquer pessoa com acesso físico ao computador pode abrir DevTools → Application → Local Storage → `movePe_senha` e ver a senha. Não há hashing (bcrypt, SHA-256, etc.).

### Autenticação bypassável trivialmente
```javascript
// console do browser:
sessionStorage.setItem('movePe_auth', '1')
// Agora abrir qualquer URL do sistema — acesso completo liberado
```

### Proteção contra SQL Injection
**Não se aplica** — não há banco SQL. Dados são JSON em localStorage. Porém, existe risco de "NoSQL injection" ao interpretar JSON de backups importados diretamente com `JSON.parse` sem validação de schema.

### Proteção contra XSS
**Vulnerável.** O sistema usa extensivamente `innerHTML` com dados do usuário/banco:
```javascript
// Exemplos em vários arquivos:
cont.innerHTML = vendas.map(v => `
  <div class="historico-card">
    <span>${v.clienteNome}</span>  // ← XSS se clienteNome contiver <script>
    <div>${itensDesc}</div>        // ← XSS se nome do produto contiver HTML
  </div>
`).join('');
```
Se alguém cadastrar um produto com nome `<img src=x onerror=alert(1)>` ou um cliente com nome contendo tags HTML, o código será executado. No contexto atual (single-user, local), o risco é baixo. Para SaaS com múltiplos usuários, é **crítico**.

### Proteção contra CSRF
**Não se aplica** no modelo atual — não há cookies de sessão nem formulários que fazem requests a servidor. Mas em uma migração para backend com API, CSRF precisaria ser implementado.

### Rate Limiting
**Não implementado.** Nem no login, nem em nenhuma operação.

### Variáveis sensíveis — .env ou hardcoded?
- **Credenciais Firebase:** armazenadas no `localStorage` (`movePe_fb_config`) como JSON. O usuário cola o JSON de configuração em Configurações → Firebase. Não está hardcoded no código, mas também não está em .env. Qualquer pessoa com acesso ao localStorage pode ver as credenciais Firebase (apiKey, projectId, etc.).
- **Não existe arquivo `.env`** — o sistema não tem backend, então não há servidor que leia variáveis de ambiente.

### HTTPS
**Sim, em produção.** GitHub Pages serve HTTPS por padrão. No servidor local (`servidor.js`), não há HTTPS — tráfego em plain text na rede local.

### Backups automáticos
**Não.** Apenas manual via botão no dashboard. O Firebase Firestore mantém os dados no cloud, funcionando como backup implícito, mas não há snapshots periódicos nem política de retenção configurada.

### Logs de auditoria
**Não existem.** Nenhuma ação do usuário (login, venda, exclusão, alteração) é registrada em log. Não há como saber quem fez o quê ou quando.

### LGPD — Tratamento de dados pessoais
**Inadequado para formalização:**
- Armazena CPF, telefone, email, data de nascimento de clientes
- Sem política de privacidade implementada
- Sem mecanismo de exclusão de dados pessoais a pedido do titular
- Sem consentimento explícito documentado
- Dados pessoais armazenados em localStorage (client-side, sem criptografia)
- Firebase Firestore: dados no Google Cloud, sem DPA (Data Processing Agreement) formal

---

## 9. CÓDIGO — QUALIDADE

### Testes automatizados
**Nenhum.** Zero testes unitários, de integração ou end-to-end. Sem framework de testes (Jest, Vitest, Playwright, Cypress). Qualquer alteração pode introduzir regressões sem detecção automatizada.

### Linter / Formatter
**Nenhum.** Sem ESLint, Prettier, StandardJS. Sem `.editorconfig`. A consistência de estilo depende do desenvolvedor.

### Padrões de código
O código é relativamente consistente em estilo, mas sem convenções formais. Pontos observados:
- Usa `const` e `let` (ES6+) corretamente
- Arrow functions em toda parte
- Template literals para HTML (prático mas causa XSS risks)
- Sem JSDoc ou tipagem (TypeScript)
- Mistura de padrões: IIFE (`RelatoriosPage = (() => {...})()`), objetos literais (`const Dashboard = {...}`), `const Module = {}`

### Code smells evidentes

**1. `financeiro.js` com 206KB — arquivo monolito**
O maior arquivo do sistema contém DRE, fluxo de caixa, contas a pagar, metas, diagnóstico, tráfego, ranking, histórico do Tiny, precificação — tudo em um único arquivo de mais de 5.000 linhas. Impossível manter sem reestruturação.

**2. HTML gerado via template literals contaminado com lógica de negócio**
Funções que calculam valores e renderizam HTML juntas, dificultando testes e reutilização:
```javascript
// Padrão recorrente: cálculo + renderização no mesmo bloco
return `<div>${Math.round(((totalMes - totalMp) / totalMp) * 100)}%</div>`;
```

**3. Globals implícitas**
Variáveis como `_tabAtual`, `_buscaHist`, `_dataInicio`, `_dataFim`, `_filtroStatus` são declaradas no escopo global dos arquivos (não dentro de módulos). Em uma página que carregue múltiplos módulos, isso pode causar conflitos.

**4. Lógica de deduplicação de crediário extremamente complexa**
A função `DB.Crediario.listar()` tem ~60 linhas de lógica de deduplicação (3 passes com Maps) que precisa rodar cada vez que o crediário é listado. Isso é sintoma de problema de origem (duplicatas chegando do Firebase).

**5. Código duplicado em `render()` e `imprimirRelatorio()` em historico.js**
```javascript
// Mesma lógica de filtro duplicada em duas funções (5 linhas idênticas)
if (_dataInicio) vendas = vendas.filter(...);
if (_dataFim)    vendas = vendas.filter(...);
```

### 5 arquivos mais críticos/complexos

| Arquivo | Tamanho | Complexidade | Motivo |
|---|---|---|---|
| `js/financeiro.js` | **206 KB** | Muito alta | 11 abas diferentes, DRE, relatórios, histórico — monolito |
| `js/vendas.js` | **88 KB** | Alta | PDV + múltiplas formas pagamento + crediário + cadastro rápido |
| `js/crediario.js` | **83 KB** | Alta | Juros, deduplicação, renegociação, pagamento parcial |
| `js/dashboard.js` | **69 KB** | Média-alta | 18+ funções render*, gráficos, alertas, múltiplos cálculos |
| `js/db.js` | **34 KB** | Média | Camada crítica: toda lógica de persistência + sync Firebase |

---

## 10. PERFORMANCE

### Queries N+1 conhecidas
**Sim, várias:**

1. **`financeiro.js calcularDRE`:** para cada crediário, faz `DB.Vendas.buscar(cred.vendaId)` (busca linear no array). Com 400 crediários = 400 iterações dentro de outro loop de vendas.

2. **`dashboard.js renderGrafico6Meses`:** chama `listarPorPeriodo` 6 vezes — cada chamada lê localStorage inteiro e filtra.

3. **`js/clientes.js`:** para cada cliente na lista, pode chamar `DB.Crediario.listar()` (que por si já é O(n) com dedup).

4. **`DB.Produtos.listarParados`:** lê todas as vendas dos últimos 180 dias, itera todas as variações de todos os produtos. Pode ser lento com 1.500+ vendas e 300+ produtos.

### Cache
**Não implementado.** Cada `DB.Vendas.listar()`, `DB.Crediario.listar()`, etc. lê do localStorage toda vez. Não há memoização, cache em memória, nem invalidação controlada.

### Imagens
**Não otimizadas.** Imagens são armazenadas como base64 no localStorage sem:
- Compressão antes do armazenamento
- Redimensionamento máximo
- Verificação de limite de tamanho
- Formato otimizado (WebP)

Produtos podem ter até 7 fotos cada. Uma foto de câmera de celular pode ter 3-5MB original. O sistema não limita o tamanho.

### Paginação
**Parcialmente implementada:**
- Histórico de vendas: **sem paginação** — renderiza todas as vendas do período de uma vez
- Crediário: **sem paginação** — lista todos os clientes
- Estoque: **sem paginação** — renderiza todos os produtos
- Clientes: **sem paginação** — renderiza todos
- Para os volumes atuais (1.500 vendas, 300 produtos) ainda é aceitável, mas vai degradar

---

## 11. DEPLOY E INFRAESTRUTURA

### Como o deploy é feito hoje
```bash
git add .
git commit -m "atualização"
git push
```
GitHub Pages serve automaticamente os arquivos do branch `main`. Latência de deploy: ~1-3 minutos.

### Existe CI/CD?
**Não.** Não há pipeline de CI/CD (GitHub Actions, etc.). Push direto para `main` vai para produção imediatamente. Não há verificação automática de código, testes ou build.

### Monitoramento de erros em produção
**Nenhum.** Não há Sentry, Datadog, LogRocket, Rollbar ou equivalente. Erros JavaScript são silenciosos (ou aparecem apenas no console do browser do usuário final). O único "monitoramento" é o usuário reportar que algo não funcionou.

### Ambiente de staging
**Não existe.** Toda mudança vai direto para produção.

---

## 12. ARQUIVOS-CHAVE PARA ANÁLISE

### login.html (autenticação completa)
```html
<script>
  if (sessionStorage.getItem('movePe_auth')) location.replace('dashboard.html');

  const temSenha = !!localStorage.getItem('movePe_senha');
  document.getElementById(temSenha ? 'boxEntrar' : 'boxCriar').style.display = '';

  const Login = {
    entrar: () => {
      const digitada = document.getElementById('inputSenha').value;
      const salva = localStorage.getItem('movePe_senha');
      if (digitada === salva) {
        sessionStorage.setItem('movePe_auth', '1');
        location.replace('dashboard.html');
      } else {
        document.getElementById('loginErro').style.display = '';
      }
    },
    criar: () => {
      const nova = document.getElementById('inputNova').value.trim();
      // ... validação, salva em localStorage plain text
      localStorage.setItem('movePe_senha', nova);
      sessionStorage.setItem('movePe_auth', '1');
      location.replace('dashboard.html');
    }
  };
</script>
```

### db.js — camada de dados (estrutura principal)
```javascript
const DB = (() => {
  const P = 'movePe_';
  const _get = (col) => JSON.parse(localStorage.getItem(P + col) || '[]');
  const _set = (col, data) => localStorage.setItem(P + col, JSON.stringify(data));
  const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // Firebase Sync
  const Sync = { ... }; // listeners onSnapshot, save, delete, syncAll

  // Coleções: Produtos, Clientes, Vendas, Crediario, Caixa,
  //           FluxoCaixa, Config, Despesas, Retiradas, Grades,
  //           Trafego, RendaPessoal, HistoricoTiny

  return { Produtos, Clientes, Vendas, Crediario, Caixa, FluxoCaixa,
           Despesas, Retiradas, Grades, Trafego, RendaPessoal,
           Config, HistoricoTiny, exportar, importar, lerArquivoBackup,
           ultimoBackup, genId, Sync, onReady };
})();
```

### vercel.json
```json
{
  "rewrites": [
    { "source": "/", "destination": "/dashboard.html" }
  ]
}
```

### package.json
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.105.2",
    "dotenv": "^17.4.2",
    "xlsx": "^0.18.5"
  }
}
```
*(Nenhuma dessas dependências é usada na aplicação em produção)*

### .env.example
**Não existe.** O sistema não usa variáveis de ambiente. Não há backend.

### Schema do banco
Não há arquivo de schema — ver Seção 4 deste documento.

### Arquivo de configuração principal
Não há arquivo de configuração — configurações são armazenadas em `localStorage` (`movePe_config`) e editadas via `configuracoes.html`.

---

## 13. PARA VIRAR SAAS — O QUE FALTA

### O que precisaria mudar para suportar múltiplos lojistas

**1. Backend real (obrigatório)**
Hoje não existe servidor. Para SaaS, precisaria de:
- API REST ou GraphQL (Node.js/Express, Fastify, ou BFF com Next.js)
- Autenticação por usuário (JWT, sessões server-side)
- Banco de dados real no servidor (PostgreSQL recomendado — Supabase ou Railway)
- Isolamento de dados por tenant (schema por tenant ou coluna `tenant_id` em todas as tabelas)

**2. Multi-tenancy (arquitetura de dados)**
Opção A — **Schema-per-tenant** (PostgreSQL): cada loja tem seu próprio schema. Isolamento forte, mais complexo de gerenciar.
Opção B — **Row-level security** (Supabase/PostgreSQL RLS): todas as lojas no mesmo banco, cada linha tem `loja_id`, políticas de acesso no banco. Mais simples de implementar e escalar.

**3. Autenticação robusta**
- Trocar `localStorage + sessionStorage` por JWT com refresh token
- Implementar hash de senha (bcrypt)
- Suporte a múltiplos usuários por loja (dono + vendedores com permissões diferentes)
- Opcionalmente: OAuth (Google) para facilitar onboarding

**4. Substituir localStorage por API calls**
Toda a camada `db.js` precisaria ser reescrita para fazer fetch para uma API. A lógica de negócio (cálculos, filtros) pode ser aproveitada, mas a persistência precisaria migrar.

**5. Eliminar dependência de Firebase por lojista**
Hoje cada lojista precisa criar seu próprio projeto Firebase e colar as credenciais. Para SaaS, o backend centralizado é o Firebase (ou substituto). O usuário final não precisaria saber que Firebase existe.

**6. Sistema de arquivos/imagens**
Fotos em base64 no localStorage são insustentáveis. Migrar para:
- Upload para S3, Cloudflare R2, ou Supabase Storage
- Armazenar URL da imagem no banco
- Limite de tamanho por plano

---

### O que falta para cobrar mensalidade

**1. Sistema de billing (inexistente)**
- Integração com gateway de pagamento (Stripe, Pagar.me, Asaas)
- Gestão de planos (básico, profissional, premium)
- Cobrança recorrente mensal/anual
- Faturas automáticas
- Dunning (cobrança de inadimplentes)

**2. Onboarding automatizado (inexistente)**
- Cadastro de novo lojista com e-mail + senha
- Criação automática do workspace
- Wizard de configuração inicial (nome da loja, taxas, vendedores)
- Tutorial/walkthrough

**3. Limites por plano (inexistente)**
Exemplos de limites que viabilizam tiers:
- Número máximo de produtos
- Número máximo de clientes/crediários
- Número de usuários (vendedores) por conta
- Armazenamento de fotos
- Acesso a módulos premium (Financeiro, Tráfego)
- Histórico de dados (30 dias vs. ilimitado)

**4. Painel administrativo SaaS (inexistente)**
- Gestão de clientes (lojas)
- Métricas de uso
- Gestão de faturas
- Suporte

**5. E-mail transacional (inexistente)**
- Confirmação de cadastro
- Recuperação de senha
- Faturas, alertas

---

### Riscos atuais que impediriam vender hoje

**Risco 1 — CRÍTICO: Autenticação**
Senha em plain text + bypass trivial. Um único cliente malicioso poderia comprometer os dados. Inaceitável para produto comercial.

**Risco 2 — CRÍTICO: Isolamento de dados inexistente**
Hoje é single-tenant. Se migrar para SaaS sem multi-tenancy correto, dados de um lojista podem vazar para outro.

**Risco 3 — ALTO: XSS generalizado**
O uso extensivo de `innerHTML` com dados de usuário precisa ser sanitizado antes de qualquer exposição multi-tenant.

**Risco 4 — ALTO: Dependência de localStorage**
Cada aba do browser tem seu próprio `sessionStorage`. Se o usuário abrir em aba anônima ou outro browser, não tem acesso. Os dados são vinculados ao device/browser específico. Para SaaS, os dados precisam estar no servidor.

**Risco 5 — ALTO: Sem backup automático**
O lojista pode perder todos os dados locais ao limpar o browser. Para vender um SaaS, o provedor assume responsabilidade pelos dados.

**Risco 6 — MÉDIO: Performance com volume**
Sem paginação, sem cache, sem índices — para lojas com 5.000+ vendas e 1.000+ produtos, o sistema ficará lento no browser.

**Risco 7 — MÉDIO: LGPD**
Armazenar CPF, telefone e data de nascimento de clientes sem política de privacidade, consentimento e mecanismo de exclusão é risco jurídico ao vender para outras empresas.

**Risco 8 — BAIXO: Sem SLA ou monitoramento**
Sem uptime monitoring, sem alertas, sem suporte estruturado — inaceitável para um produto pago.

---

## 14. OBSERVAÇÕES FINAIS

### Decisões técnicas controversas

**1. Vanilla JS sem framework**
Decisão pragmática para um MVP rápido. O custo: código verboso para UI reativa, renderizações completas a cada mudança de estado, dificuldade de crescer sem estrutura. Para SaaS, um framework (React, SvelteKit, Vue) daria muito mais produtividade na manutenção.

**2. localStorage como banco de dados primário**
Funcionou bem para single-tenant em uma loja física. Para SaaS, é inviável: limite de 5-10MB, dados isolados por browser, sem backups automáticos, sem acesso server-side.

**3. Firebase Firestore como sync secundário**
Boa decisão de resiliência para o produto atual. O merge inteligente de produtos (preferir local quando há mais variações) é uma solução engenhosa para conflitos. O problema é que a lógica de deduplicação de crediário é evidência de que o sync causa duplicatas com regularidade.

**4. Um arquivo CSS global (~800 linhas)**
Aceitável para este porte. Para SaaS com temas por cliente (white-label), precisaria de CSS-in-JS ou CSS custom properties mais granulares.

**5. `financeiro.js` com 206KB**
O arquivo mais problemático do sistema. Cresceu organicamente sem refatoração. Em produção, isso significa 206KB de JavaScript parseado pelo browser em cada acesso à página Financeiro. Deveria ser dividido em pelo menos 5-6 módulos menores.

**6. `weto-cerebro.md` — Plano de atendente virtual**
Existe um documento de persona para um "atendente virtual WhatsApp" chamado Weto, mas o sistema atual de WhatsApp (`whatsapp.js`) apenas gera links `wa.me/` — não há integração com IA. O documento descreve funcionalidades que **não existem** no código.

### Dívida técnica acumulada

| Item | Severidade | Esforço de correção |
|---|---|---|
| Autenticação (hash de senha, JWT) | Crítica | 2-3 dias |
| XSS (sanitização de innerHTML) | Alta | 3-5 dias |
| Multi-tenancy / backend | Alta | 2-4 semanas |
| Testes automatizados | Alta | 2-4 semanas (cobertura básica) |
| `financeiro.js` refatoração | Média | 1-2 semanas |
| Cache de dados / performance | Média | 3-5 dias |
| Paginação nas listas | Média | 3-5 dias |
| Bugs de timezone restantes (seção 7) | Baixa | 1 dia |
| LGPD compliance | Média | 1-2 semanas |
| CI/CD e testes | Alta | 3-5 dias |
| Monitoramento de erros (Sentry) | Média | 1 dia |
| Sistema de backup automático | Alta | 2-3 dias |

### Pontos fortes do sistema (para referência)
- Funcionalidades muito completas e adaptadas à realidade de loja de calçados brasileira
- UX bem pensada para uso não-técnico (lojista sem formação em TI)
- Firebase Firestore garante persistência mesmo com problemas de localStorage
- Cálculo de DRE com CMV real (snapshot do custo na hora da venda) é sofisticado
- Sistema de juros do crediário com carência é correto e configurável
- Lógica de etiquetas de vitrine é diferenciada (preço cartão + crediário lado a lado)
- Código legível e comentado razoavelmente bem

### Resumo executivo para decisão de produto

O sistema tem **funcionalidade de produto sólida** — resolveu o problema real de uma loja de calçados e tem funcionalidades que poucos SaaS do segmento oferecem (DRE real, crediário com juros, etiquetas de vitrine). O código é funcional mas não tem estrutura para escalar.

Para se tornar um SaaS vendável, o investimento mínimo necessário é:
1. **Backend** com banco de dados PostgreSQL e API (4-8 semanas)
2. **Autenticação segura** multi-usuário (1 semana)
3. **Multi-tenancy** com isolamento de dados (2-3 semanas)
4. **Billing** integrado com Stripe/Asaas (1-2 semanas)
5. **Sanitização XSS** (1 semana)

**Estimativa total para MVP SaaS mínimo comercializável:** 3-4 meses de desenvolvimento dedicado.

O código atual seria aproveitado principalmente para a **lógica de negócio** (cálculos, regras de crediário, DRE) e **UI/CSS** — que estão bem construídos. A camada de dados e autenticação precisaria ser reescrita quase completamente.

---

*Auditoria gerada automaticamente com base na análise completa do código-fonte em 05/05/2026.*  
*Todos os bugs reportados neste documento foram identificados no código sem execução — bugs adicionais podem existir.*
