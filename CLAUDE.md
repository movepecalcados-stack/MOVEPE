# CLAUDE.md — Move Pé Calçados

Este arquivo é lido automaticamente toda vez que abrimos uma conversa sobre este projeto.

---

## Quem é o usuário

- Dono da Move Pé Calçados — loja física de calçados
- Não tem conhecimento técnico de programação
- Aprende conforme usa o sistema
- Usa dois computadores: PC da loja e PC de casa
- Email: movepecalcados@gmail.com
- GitHub: movepecalcados-stack
- Sistema usado por ele e funcionárias (Francieli Moreto, Ketellyn)

---

## O projeto

Sistema PDV (ponto de venda) completo para loja de calçados, construído do zero para substituir o Tiny ERP.

**Tecnologias:** HTML/CSS/JS puro, localStorage + Firebase Firestore (sync), GitHub Pages (hospedagem)

**Deploy:**
- GitHub: github.com/movepecalcados-stack/MOVEPE
- GitHub Pages: movepecalcados-stack.github.io/MOVEPE/dashboard.html
- Para atualizar: `git add . && git commit -m "atualização" && git push`

**Firebase:**
- Projeto: pdv-move-pe
- Email: movepecalcados@gmail.com
- Em novo computador: Configurações → Firebase → colar JSON das credenciais

---

## Módulos do sistema

| Arquivo | Função |
|---|---|
| `index.html` | PDV — ponto de venda |
| `dashboard.html` | Dashboard com stats e alertas |
| `estoque.html` | Controle de estoque (cor/tamanho) |
| `clientes.html` | Cadastro de clientes |
| `crediario.html` | Crediário com parcelas e juros |
| `historico.html` | Histórico de vendas e devoluções |
| `financeiro.html` | Financeiro com taxas de cartão |
| `caixa.html` | Controle de caixa |
| `configuracoes.html` | Configurações gerais |
| `whatsapp.html` | WhatsApp automático para cobrança |
| `importar.html` | Importar dados do Tiny ERP |
| `relatorios.html` | Relatórios |
| `etiquetas.html` | Etiquetas de produtos |

---

## Regras importantes de desenvolvimento

### Git — NUNCA fazer push sem o usuário pedir
- Acumular todas as alterações da sessão
- Fazer um único push somente quando o usuário disser "pode subir" ou encerrar a sessão
- Motivo: Netlify plano gratuito tem 300 min/mês de build — pushes frequentes consomem o limite

### Código
- Sempre ler o arquivo antes de modificar
- Manter compatibilidade com dados existentes no Firebase
- Variações de produto usam chave composta: `"38||Preto"`
- Taxa de crediário padrão: +10% (configurável em `DB.Config.get('taxaCrediario', 10)`)
- Juros crediário: 0,4%/dia após 5 dias de carência

### Comunicação com o usuário
- Linguagem simples, sem jargão técnico
- Explicações curtas e diretas
- Não perguntar demais — fazer e avisar o que foi feito
- Focar no que importa para o dia a dia da loja

### Prioridades do sistema
- Crediário é crítico — dados de clientes e cobranças são prioridade máxima
- Caixa e fechamento diário são usados todo dia
- Estoque com variações cor/tamanho é central para o negócio

---

## Outros projetos do usuário

**StoryPilot** — agendamento de Instagram Stories
- Produção: https://storypilot-production.up.railway.app
- GitHub: github.com/movepecalcados-stack/storypilot
- Local: `C:\Users\MOVE PE CALÇADOS\Desktop\Stories Move Pé\story-pilot-pro-main`
- Stack: Node.js + Supabase + Railway

**Central de Agentes** — em desenvolvimento
- Arquivo: `agentes.html` (protótipo visual já criado)
- Objetivo: agentes de IA para tarefas da loja (WhatsApp, Instagram, estoque, financeiro, etc.)
