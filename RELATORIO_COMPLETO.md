# RELATÓRIO COMPLETO — MOVE PÉ PDV
**Gerado em:** 2026-05-11  
**Sistema:** Move Pé Calçados — Gestão de Loja (PDV + Financeiro + Crediário)

---

## 1. ESTADO ATUAL

### ✅ O que está 100% funcionando

| Módulo | Arquivo | Descrição |
|--------|---------|-----------|
| PDV / Nova Venda | `index.html` + `js/vendas.js` | Busca produto, seleciona tamanho, aplica desconto/acréscimo, formas de pagamento (dinheiro, PIX, débito, crédito, crediário), impressão de recibo |
| Crediário | `crediario.html` + `js/crediario.js` | Listagem por cliente, baixa de parcelas, emissão de contrato impresso, acréscimo configurável (default 7%) |
| Histórico de Vendas | `historico.html` + `js/historico.js` | Busca, filtros de período, devolução/troca (inclui crediário como forma de pagamento da diferença, estado do produto perfeito/defeito, resumo visual antes de confirmar) |
| Clientes | `clientes.html` + `js/clientes.js` | Cadastro completo, histórico de compras, saldo devedor |
| Estoque | `estoque.html` + `js/estoque.js` | Controle por grade (tamanhos), alerta de estoque baixo |
| Financeiro | `financeiro.html` + `js/financeiro.js` | DRE, fluxo de caixa 30 dias, contas a pagar/receber, metas, precificação, tráfego pago, ranking de produtos, histórico de retiradas |
| Caixa | `caixa.html` + `js/caixa.js` | Abertura/fechamento, sangria, conferência, resumo do dia |
| Relatórios | `relatorios.html` + `js/relatorios.js` | Relatórios de vendas por período, por produto, por vendedor |
| Etiquetas | `etiquetas.html` + `js/etiquetas.js` | Geração e impressão de etiquetas de preço |
| Frete | `frete.html` + `js/frete.js` | Calculadora de frete para envios |
| Stories | `stories.html` + `js/stories.js` | Gerador de Instagram Stories (canvas 1080×1920) com templates: Destaque, Promoção, Novidade, Liquidação |
| WhatsApp | `whatsapp.html` + `js/whatsapp.js` | Templates de mensagem para cobrança de crediário, lembretes de vencimento, pós-venda; abre WhatsApp Web direto |
| Tráfego | `trafego.html` + `js/trafego.js` | Registro semanal de investimento em anúncios vs. receita gerada |
| Importação Tiny | `importar.html` | Importação de contatos e contas a receber via CSV exportado do Tiny ERP |
| Rastreio / Link | `rastreio/index.html` | Página de rastreamento de cliques (bio, story, anúncio) com registro no Firebase antes de redirecionar ao WhatsApp |
| Configurações | `configuracoes.html` | Firebase, dados da loja, vendedores/comissões, taxa crediário, senha |
| Sync Firebase | `js/db.js` | Sincronização bidirecional em tempo real com Firestore — funciona para todas as coleções |
| Backup automático | `js/db.js` | Auto-backup JSON a cada 4h enquanto o sistema está aberto; backup manual em Configurações |
| Login | `login.html` | Tela de senha com criação na primeira vez |

---

### ⚠️ O que está incompleto ou com bug conhecido

| Problema | Arquivo | Descrição | Impacto |
|----------|---------|-----------|---------|
| **6 vendas crediário sem parcelas** | DB (localStorage) | Auditoria de 09/05/2026 detectou 6 vendas com `formaPagamento='crediario'` mas sem registro em `DB.Crediario`. Total: R$ 1.517,36. | Alto — valores não aparecem no saldo devedor dos clientes |
| **Rastreio com config hardcoded** | `rastreio/index.html` | `FIREBASE_CONFIG = PLACEHOLDER_FIREBASE_CONFIG` — a config real precisa ser substituída manualmente a cada deploy. Número do WhatsApp também é hardcoded (linha 31). | Médio — rastreio pode não funcionar em deploy limpo |
| **Senha em plaintext no localStorage** | `login.html` | `localStorage.setItem('movePe_senha', nova)` — senha salva sem hash. Qualquer pessoa com acesso ao DevTools vê a senha. | Médio — acesso físico à máquina + DevTools = acesso total |
| **renda_pessoal não sincroniza** | `js/db.js` | A coleção `renda_pessoal` não está na lista `COLS` e portanto não vai para o Firestore. | Baixo — apenas dados do módulo de renda pessoal do financeiro |
| **Supabase instalado mas não usado** | `package.json`, `src/test-supabase.js` | A dependência `@supabase/supabase-js` está instalada e há um arquivo de teste de conexão, mas o Supabase não está integrado em nenhum módulo do sistema. | Nenhum — dead code, mas indica migração planejada |
| **Weto (IA WhatsApp) sem backend** | `weto-cerebro.md` | Documento de persona e fluxo do atendente virtual existe, mas não há código de bot conectado ao WhatsApp. | Nenhum atualmente — é funcionalidade futura |
| **`produtos.html` quase vazio** | `produtos.html` (499 bytes) | Parece ser apenas um redirect ou placeholder. Gestão de produtos fica em `estoque.html`. | Baixo — possível confusão de navegação |

---

### 🔲 O que foi planejado mas não implementado

- **Bot Weto no WhatsApp**: Documento completo de persona (`weto-cerebro.md`) com fluxos de atendimento, mas sem código de integração com WhatsApp API (Meta Business, Evolution API ou similar).
- **Migração para Supabase**: `src/test-supabase.js` e a dependência no `package.json` indicam que estava sendo avaliada uma migração do Firebase para Supabase PostgreSQL, mas não avançou.
- **Multi-usuário / controle de acesso por perfil**: Sistema atual tem uma única senha para todos. Sem controle por vendedor (login individual), apesar de existir cadastro de vendedores.
- **Notificações automáticas de vencimento de parcelas**: O módulo WhatsApp tem os templates de cobrança prontos, mas disparo automático (ex: cron job que envia X dias antes do vencimento) não existe.

---

## 2. STACK E ARQUITETURA

### Linguagens e tecnologias

| Camada | Tecnologia | Versão / Observação |
|--------|-----------|-------------------|
| Frontend | HTML5 + CSS3 + JavaScript vanilla | Sem framework (sem React, Vue, etc.) |
| Estilo | CSS customizado | `css/style.css` (~32 KB), design system próprio com variáveis CSS |
| Banco local | `localStorage` do navegador | ~5-10 MB de limite por origem |
| Sync cloud | Firebase Firestore | SDK v9.23.0 (modo compat) carregado via CDN |
| Servidor local | Node.js (`http` nativo) | `servidor.js` — para acesso de outros PCs na rede Wi-Fi na porta 8080 |
| Deploy web | Vercel | Hospedagem estática; rewrite `/` → `/dashboard.html` |
| Build | Nenhum | Sem bundler, sem transpiler, sem minificação — arquivos servidos direto |
| Auth | Senha em localStorage | `sessionStorage` para manter sessão ativa na aba |

### Banco de dados — estrutura das coleções

Prefixo no localStorage: `movePe_`  
Prefixo no Firestore: `movePe_` (mesmo nome)

```
movePe_produtos      → { id, nome, marca, categoria, sku, preco, custo, foto,
                         fotosVariacoes, variações[], ativo, criadoEm }
movePe_clientes      → { id, nome, telefone, cpf, endereco, criadoEm }
movePe_vendas        → { id, clienteId, clienteNome, itens[], total, formaPagamento,
                         acrescimoCrediario{pct,valor}, vendedor, criadoEm,
                         flagRevisaoAuditoria?, dataRevisaoMarcada? }
movePe_crediario     → { id, clienteId, clienteNome, vendaId, total, criadoEm,
                         parcelas[{numero, vencimento, valor, status, dataPagamento?}] }
movePe_caixa         → { id, data, valorAbertura, status, sangrias[], criadoEm }
movePe_fluxo         → { id, tipo, descricao, valor, data, categoria, criadoEm }
movePe_despesas      → { id, descricao, valor, vencimento, status, recorrente, criadoEm }
movePe_retiradas     → { id, valor, descricao, data, criadoEm }
movePe_grades        → { id, produtoId, tamanhos[], totalPares, criadoEm }
movePe_trafego       → { id, semana, plataforma, valor, cliques, conversoes, criadoEm }
movePe_renda_pessoal → { id, descricao, valor, criadoEm }  ← NÃO sincroniza Firebase
movePe_config        → { taxaCrediario, loja{nome,cnpj,tel,end}, vendedores[], fb_config... }
movePe_senha         → string (plaintext)
movePe_auth          → sessionStorage (não persiste entre fechamentos de aba)
```

### Serviços externos conectados

| Serviço | Finalidade | Status |
|---------|-----------|--------|
| **Firebase Firestore** | Sincronização em tempo real dos dados entre dispositivos | ✅ Ativo e funcionando |
| **Vercel** | Hospedagem estática do sistema na web | ✅ Ativo |
| **WhatsApp Web** (`wa.me`) | Abertura de conversa com cliente via link | ✅ Funciona (manual) |
| **Supabase** | Alternativa ao Firebase (PostgreSQL) | 🔲 Instalado, não integrado |
| **Tiny ERP** | Importação de contatos e contas a receber via CSV | ✅ Importação manual funciona |

### package.json completo

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.105.2",
    "dotenv": "^17.4.2",
    "xlsx": "^0.18.5"
  }
}
```

> **Nota:** Nenhuma dessas dependências é usada pelo sistema em produção.  
> `@supabase/supabase-js` e `dotenv` são usados apenas em `src/test-supabase.js`.  
> `xlsx` não é importado em nenhum arquivo HTML/JS do sistema.  
> O sistema não tem `scripts` no package.json — não há `npm start`, `npm build`, etc.

---

## 3. ESTRUTURA DE PASTAS

```
MovePe/
│
├── index.html                  → PDV (ponto de venda) — tela principal de vendas
├── dashboard.html              → Dashboard — métricas do dia, acesso rápido
├── login.html                  → Autenticação por senha
├── clientes.html               → Cadastro e histórico de clientes
├── crediario.html              → Gestão de crediário e parcelas
├── historico.html              → Histórico de vendas + devolução/troca
├── financeiro.html             → DRE, fluxo de caixa, contas, metas
├── estoque.html                → Controle de estoque por grade
├── etiquetas.html              → Impressão de etiquetas de preço
├── relatorios.html             → Relatórios de vendas
├── caixa.html                  → Abertura/fechamento de caixa
├── frete.html                  → Calculadora de frete
├── stories.html                → Gerador de Instagram Stories
├── whatsapp.html               → Templates de mensagem WhatsApp
├── trafego.html                → Análise de tráfego pago
├── importar.html               → Importação de dados do Tiny ERP
├── configuracoes.html          → Configurações gerais da loja
├── produtos.html               → Placeholder (gestão real em estoque.html)
│
├── auditoria_crediarios.html   → Ferramenta de auditoria de inconsistências
├── recuperar_vendas_crediario.html → Ferramenta de recuperação das 6 vendas órfãs
├── diagnostico_produtos.html   → Diagnóstico de produtos com problemas
├── diagnostico_storage.html    → Análise de uso do localStorage
├── migrar_fotos.html           → Migração de fotos base64 para URL
├── migrar_fotos_v2.html        → Versão 2 da migração de fotos
│
├── css/
│   └── style.css               → Design system completo (variáveis, componentes)
│
├── js/
│   ├── db.js                   → Camada de dados: localStorage + Firebase sync (1.157 linhas)
│   ├── utils.js                → Utilitários: formatação, modais, navegação, sidebar
│   ├── vendas.js               → Módulo de vendas/PDV
│   ├── historico.js            → Histórico + devolução/troca
│   ├── crediario.js            → Módulo de crediário
│   ├── clientes.js             → Módulo de clientes
│   ├── caixa.js                → Módulo de caixa
│   ├── financeiro.js           → Módulo financeiro (206 KB — maior arquivo)
│   ├── estoque.js              → Módulo de estoque
│   ├── etiquetas.js            → Módulo de etiquetas
│   ├── relatorios.js           → Módulo de relatórios
│   ├── stories.js              → Gerador de stories (canvas API)
│   ├── whatsapp.js             → Templates WhatsApp
│   ├── trafego.js              → Módulo de tráfego
│   ├── frete.js                → Calculadora de frete
│   └── produtos.js             → Helpers de produto (usado pelo PDV)
│
├── rastreio/
│   └── index.html              → Link de rastreio: registra origem no Firebase
│                                 e redireciona ao WhatsApp
│
├── src/
│   └── test-supabase.js        → Script de teste de conexão com Supabase (Node.js)
│
├── backups_codigo/             → Backups históricos do código (não servidos)
│   ├── 20260506/
│   ├── 20260506_solucao_a/
│   ├── 20260506_timezone/
│   ├── 20260507_compressao_fotos/
│   ├── 20260507_compressao_v2/
│   ├── 20260508_devolucao_troca/
│   └── 20260508_correcao_calculo_troca/
│
├── servidor.js                 → Servidor HTTP local (Node.js) para rede Wi-Fi
├── package.json                → Dependências Node.js (não usadas em produção)
├── vercel.json                 → Config Vercel: rewrite / → dashboard.html
├── _redirects                  → Redirect Netlify (legado): / → /dashboard.html 302
├── .gitignore                  → Ignora *.zip e weto-cerebro.md
├── .vercelignore               → Ignora servidor.js e weto-cerebro.md no deploy
├── weto-cerebro.md             → Documento de persona do bot WhatsApp Weto
├── favicon.ico
├── ARQUIVOS_CRITICOS.md        → Documentação de arquivos críticos
├── AUDITORIA_SISTEMA.md        → Relatório de auditoria do sistema
│
└── dados de importação (não versionados):
    ├── contas_receber_tiny.json
    └── dados_tiny_historico.json
```

---

## 4. VARIÁVEIS DE AMBIENTE

### Arquivo `.env` — não existe no projeto

O sistema **não usa um arquivo `.env`** em produção. As configurações sensíveis ficam:

| Onde | O quê | Observação |
|------|-------|-----------|
| `localStorage` (`movePe_fb_config`) | Credenciais do Firebase Firestore | Inseridas pela dona via tela de Configurações |
| `localStorage` (`movePe_senha`) | Senha de acesso ao sistema | Plaintext — vulnerabilidade conhecida |
| `rastreio/index.html` linha 31 | Número do WhatsApp hardcoded | `5541988423452` |

### Variáveis usadas em `src/test-supabase.js` (Node.js, nunca em produção)

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

Estas variáveis seriam carregadas via `require('dotenv').config()` de um arquivo `.env` local que **não existe** no repositório.

---

## 5. O QUE FALTA PARA A UNIFICAÇÃO

> Avaliação técnica sobre o que precisaria ser feito para integrar este módulo (PDV Move Pé)
> numa plataforma unificada com os outros 2 sistemas: **StoryPilot** (Railway) e **Weto** (bot WhatsApp).

---

### Diagnóstico atual

O sistema Move Pé PDV é uma **aplicação totalmente client-side**:
- Sem backend próprio
- Sem API REST
- Dados no `localStorage` do browser (não acessíveis por outros sistemas)
- Firebase como único "servidor" — mas via SDK client-side, sem controle de acesso granular

Os outros dois sistemas (StoryPilot no Railway, Weto como bot) são **server-side** e precisam acessar dados da loja para funcionar (estoque, clientes, crediário). Como o PDV não tem API, eles não conseguem consultar nada.

---

### O que precisa ser feito (por prioridade)

#### 🔴 CRÍTICO — sem isso nada funciona

**1. Backend com API REST**
- Criar um servidor Node.js/Express (ou Fastify) hospedado no Railway (junto com StoryPilot)
- Expor endpoints mínimos:
  ```
  GET  /api/produtos          → lista produtos ativos com estoque
  GET  /api/clientes/:id      → dados do cliente
  GET  /api/crediario/:clienteId → parcelas do cliente
  POST /api/vendas            → registrar venda (chamado pelo PDV)
  POST /api/crediario/pagar   → baixar parcela
  ```
- O PDV atual (HTML/JS) continuaria funcionando — basta redirecionar as chamadas do `db.js` para a API em vez de apenas localStorage

**2. Banco de dados centralizado**
- Migrar do Firebase Firestore para **Supabase PostgreSQL** (já está instalado no package.json, só falta integrar)
- O Supabase tem cliente JavaScript, API REST automática via PostgREST e Row Level Security
- Os dados do localStorage seriam a fonte de migração inicial (já existe `DB.exportar()`)
- Estrutura de tabelas equivale diretamente às coleções atuais

**3. Autenticação real**
- Trocar a senha em localStorage por JWT ou sessão Supabase Auth
- Importante para que o StoryPilot e o Weto possam fazer chamadas autenticadas à API da loja
- Supabase Auth resolve isso nativamente (email/senha, magic link, etc.)

---

#### 🟡 IMPORTANTE — conectar os 3 sistemas

**4. Sincronização de estoque para o Weto**
- Weto precisa consultar estoque em tempo real para responder clientes
- Com a API pronta: `GET /api/produtos?disponivel=true` retorna JSON com nome, tamanhos, preço
- Weto chama esse endpoint a cada consulta de produto

**5. Registro de vendas do Weto no PDV**
- Quando o Weto fechar uma venda (com confirmação da dona), precisa chamar `POST /api/vendas`
- Venda aparece automaticamente no histórico e desconta estoque

**6. StoryPilot com dados reais**
- Stories de "Novidade" ou "Promoção" poderiam usar fotos e preços diretamente do estoque
- Integração: StoryPilot chama `GET /api/produtos` e preenche os templates automaticamente
- Atualmente os stories são gerados manualmente — isso seria a principal evolução

---

#### 🟢 NICE TO HAVE — melhorias após unificação básica

**7. Notificações automáticas de crediário**
- Cron job no Railway: todo dia às 8h, busca parcelas vencendo em 3 dias, dispara WhatsApp via Weto
- Hoje o módulo WhatsApp tem os templates prontos — falta só o gatilho automático

**8. Dashboard unificado**
- Uma única tela mostra PDV + StoryPilot + Weto: vendas do dia, stories agendados, conversas abertas
- Possível com iframe ou microfrontends simples

**9. Logs de acesso por usuário**
- Com auth real, saber quem fez cada venda/alteração
- Hoje todos usam a mesma senha — sem rastreabilidade individual

---

### Resumo da migração em etapas

```
ETAPA 1 (1-2 semanas)
└── Criar API REST no Railway (Express + Supabase)
└── Migrar dados localStorage → Supabase via script de importação
└── Trocar DB.js para chamar API ao invés de só localStorage
└── Manter Firebase sync como fallback temporário

ETAPA 2 (1 semana)
└── Autenticação Supabase Auth
└── Weto consultando /api/produtos em tempo real
└── Weto registrando vendas via /api/vendas

ETAPA 3 (2 semanas)
└── StoryPilot puxando produtos da API para preencher templates
└── Cron de lembretes de crediário no Railway
└── Dashboard unificado básico
```

### Custo estimado de infraestrutura pós-unificação

| Serviço | Plano | Custo |
|---------|-------|-------|
| Railway (API + StoryPilot) | Starter | ~US$ 5/mês |
| Supabase (banco + auth) | Free tier | R$ 0 (até 500 MB) |
| Vercel (frontend PDV) | Hobby | R$ 0 |
| Firebase (pode ser desativado após migração) | — | R$ 0 economizados |

**Total:** ~R$ 30/mês para os 3 sistemas unificados com banco real e autenticação.

---

*Relatório gerado automaticamente com base na análise do código-fonte em 2026-05-11.*
