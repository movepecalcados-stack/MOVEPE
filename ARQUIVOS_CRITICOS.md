# ARQUIVOS_CRITICOS.md — Move Pé PDV
**Gerado em:** 2026-05-05  
**Propósito:** Contexto técnico completo para análise SaaS por Claude externo

---

## A) ÁRVORE COMPLETA DE DIRETÓRIOS

```
MovePe/
├── .gitignore
├── .vercelignore
├── AUDITORIA_SISTEMA.md
├── ARQUIVOS_CRITICOS.md
├── _redirects
├── _redirects.zip           (124 KB — artefato, pode ser removido)
├── caixa.html
├── clientes.html
├── configuracoes.html
├── contas_receber_tiny.json
├── crediario.html
├── dashboard.html
├── estoque.html
├── etiquetas.html
├── favicon.ico
├── financeiro.html
├── frete.html
├── historico.html
├── importar.html
├── index.html               (PDV principal)
├── login.html
├── movepe.zip.zip           (124 KB — artefato, pode ser removido)
├── package.json
├── package-lock.json
├── produtos.html
├── relatorios.html
├── servidor.js
├── stories.html
├── trafego.html
├── vercel.json
├── weto-cerebro.md
├── whatsapp.html
├── css/
│   └── style.css            (32 KB)
├── js/
│   ├── caixa.js
│   ├── clientes.js          (35 KB)
│   ├── crediario.js         (83 KB)
│   ├── dashboard.js         (69 KB)
│   ├── db.js                (34 KB — camada de dados / Firebase sync)
│   ├── estoque.js
│   ├── etiquetas.js
│   ├── financeiro.js        (206 KB — maior arquivo)
│   ├── frete.js
│   ├── historico.js         (24 KB)
│   ├── produtos.js
│   ├── relatorios.js
│   ├── stories.js
│   ├── trafego.js           (36 KB)
│   ├── utils.js             (32 KB)
│   ├── vendas.js            (88 KB)
│   └── whatsapp.js
├── rastreio/
│   └── index.html
└── dados_tiny_historico.json  (200 KB — histórico importado do ERP Tiny)
```

**Não incluídos na árvore:** `node_modules/`, `.git/`, `src/`

---

## B) CONTEÚDO COMPLETO DOS ARQUIVOS-CHAVE

---

### B1 — index.html (PDV Principal, 549 linhas)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <script>if(!sessionStorage.getItem('movePe_auth'))location.replace('login.html');</script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDV — MOVE PÉ</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <aside class="sidebar" id="sidebar"></aside>

  <div class="main">
    <div class="topbar">
      <div class="topbar-title">🛒 PDV</div>
      <div class="topbar-info">
        <span id="operadorInfo" style="display:none" class="text-muted fs-sm"></span>
        <span id="caixaStatus" class="topbar-badge">Verificando...</span>
        <span id="clienteSelecionado" style="color:var(--text-muted);font-size:13px;cursor:pointer" onclick="PDV.abrirBuscaCliente()">Sem cliente</span>
        <button id="btnRemoverCliente" onclick="" style="display:none;background:none;border:none;color:var(--danger);cursor:pointer;font-size:13px">✕</button>
        <button id="btnBuscarCliente" class="btn btn-outline btn-sm">👤 Cliente</button>
        <button class="btn btn-outline btn-sm" onclick="Utils.abrirModal('modalAtalhos')">⌨️ Atalhos</button>
        <button class="btn btn-outline btn-sm" onclick="PDV.abrirReceberCrediario()">📋 Receber Crediário</button>
      </div>
    </div>

    <div class="content" style="padding:12px">
      <div class="pdv-layout">

        <!-- PRODUTOS -->
        <div class="pdv-produtos">
          <div class="pdv-busca">
            <div style="display:flex;gap:8px;align-items:center">
              <div style="position:relative;flex:1">
                <input type="text" id="buscaInput" class="form-control" placeholder="🔍 Buscar produto por nome, marca, SKU... (F2)">
                <span id="scannerIndicator" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--success);font-weight:600">📡 Scanner</span>
              </div>
              <button class="btn btn-outline btn-sm" onclick="PDV.abrirCadastroRapido()" title="Cadastrar produto novo direto no PDV" style="white-space:nowrap;flex-shrink:0">➕ Produto Rápido</button>
            </div>
          </div>
          <div class="pdv-grid" id="produtosGrid">
            <div class="loading"><div class="spinner"></div> Carregando...</div>
          </div>
        </div>

        <!-- CARRINHO -->
        <div class="pdv-carrinho">
          <div class="carrinho-header">
            <span>🛒 Carrinho</span>
            <button id="btnLimparCarrinho" class="btn btn-ghost btn-sm" style="color:var(--danger)">🗑️ Limpar</button>
          </div>

          <div class="carrinho-lista" id="carrinhoLista">
            <div class="carrinho-empty">
              <div class="carrinho-empty-icon">🛒</div>
              <span>Carrinho vazio</span>
              <span style="font-size:12px">Adicione produtos</span>
            </div>
          </div>

          <div class="carrinho-footer">
            <!-- SUBTOTAL -->
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-muted)">
              <span>Subtotal</span>
              <span id="carrinhoSubtotal">R$ 0,00</span>
            </div>

            <!-- DESCONTO -->
            <div id="carrinhoDescontoArea" style="display:none;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="font-size:12px;color:var(--text-muted);flex:1">🏷️ Desconto</span>
                <input type="number" id="inputDesconto" min="0" step="0.01" class="form-control"
                  style="flex:1;padding:5px 8px;font-size:13px"
                  oninput="PDV.aplicarDesconto()" placeholder="0">
                <div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden">
                  <button id="btnDescReais" onclick="PDV.setTipoDesconto('reais')"
                    style="padding:4px 8px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:var(--primary);color:#fff">R$</button>
                  <button id="btnDescPct" onclick="PDV.setTipoDesconto('pct')"
                    style="padding:4px 8px;font-size:11px;font-weight:700;border:none;cursor:pointer;background:none;color:var(--text-muted)">%</button>
                </div>
                <button onclick="PDV.removerDesconto()"
                  style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:0 4px">✕</button>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:13px">
                <span style="color:var(--danger)">− Desconto</span>
                <span style="color:var(--danger);font-weight:700" id="carrinhoDescontoVal">R$ 0,00</span>
              </div>
            </div>

            <!-- ACRÉSCIMO CREDIÁRIO -->
            <div id="carrinhoAcrescimoArea" style="display:none">
              <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                <span style="color:var(--warning);font-weight:600">📋 Acréscimo crediário (<span id="carrinhoAcrescimoPct">10</span>%)</span>
                <span style="color:var(--warning);font-weight:700" id="carrinhoAcrescimoVal">R$ 0,00</span>
              </div>
            </div>

            <!-- TOTAL -->
            <div class="carrinho-total">
              <span>Total</span>
              <span class="carrinho-total-val" id="carrinhoTotal">R$ 0,00</span>
            </div>

            <!-- AÇÕES -->
            <div style="display:flex;gap:8px">
              <button id="btnAplicarDesconto" onclick="PDV.toggleDesconto()"
                class="btn btn-outline btn-sm" style="flex:1">🏷️ Desconto</button>
              <button id="btnPagar" class="btn btn-primary" style="flex:2" disabled>
                💳 Finalizar Venda (F9)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ===== MODAL PAGAMENTO ===== -->
  <div class="modal-overlay" id="modalPagamento" style="display:none">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">💳 Finalizar Venda</span>
        <button class="modal-close" id="btnCancelarPagamento">✕</button>
      </div>
      <div>
        <!-- CLIENTE VINCULADO -->
        <div id="pagClienteInfo" ...>
          <div id="pagClienteNome">Venda sem identificação</div>
          <div id="pagClienteDetalhe">Identifique o cliente para garantia e histórico de compras</div>
          <button id="btnPagIdentificar" onclick="PDV.abrirBuscaClientePagamento()">Identificar</button>
        </div>

        <div>Total a Pagar: <span id="pagTotal">R$ 0,00</span></div>

        <!-- Toggle modo simples / dividir -->
        <button id="btnModoSimples" onclick="PDV.setModoSimples()">💳 Simples</button>
        <button id="btnModoSplit" onclick="PDV.setModoSplit()">🔀 Dividir Pagamento</button>

        <!-- MODO SIMPLES: formas de pagamento -->
        <div id="secaoModoSimples">
          <button data-forma="dinheiro"       onclick="PDV.selecionarForma('dinheiro')">💵 Dinheiro</button>
          <button data-forma="pix"            onclick="PDV.selecionarForma('pix')">📱 PIX</button>
          <button data-forma="cartao_credito" onclick="PDV.selecionarForma('cartao_credito')">💳 Crédito</button>
          <button data-forma="cartao_debito"  onclick="PDV.selecionarForma('cartao_debito')">💳 Débito</button>
          <button data-forma="crediario"      onclick="PDV.selecionarForma('crediario')">📋 Crediário</button>
          <!-- Troco, parcelas cartão, parcelas crediário, taxa cartão -->
        </div>

        <!-- MODO DIVIDIR: split de pagamento entre formas -->
        <div id="secaoModoSplit" style="display:none">...</div>

        <!-- Observação da venda -->
        <textarea id="inputObservacaoVenda" placeholder="Ex: trocar se não servir..."></textarea>
      </div>
      <div class="modal-footer">
        <button onclick="Utils.fecharModal('modalPagamento')">Cancelar</button>
        <button id="btnConfirmarPagamento">✅ Confirmar Pagamento</button>
      </div>
    </div>
  </div>

  <!-- ===== MODAL CLIENTES ===== -->
  <!-- Busca + form rápido de novo cliente inline -->

  <!-- ===== MODAL PÓS-VENDA ===== -->
  <!-- Resumo, botão WhatsApp, botão imprimir -->

  <!-- ===== MODAL FOTO PRODUTO (PDV) ===== -->
  <!-- Upload + preview + salvar -->

  <!-- ===== MODAL ATALHOS ===== -->
  <!-- F1 atalhos | F2 busca | F9 pagamento | Esc fechar -->

  <!-- ===== MODAL RECEBER CREDIÁRIO ===== -->
  <!-- Busca cliente → lista parcelas → confirmação de pagamento -->

  <!-- ===== MODAL CADASTRO RÁPIDO DE PRODUTO ===== -->
  <!-- Nome, tipo, marca, preço venda, preço custo, variação (tamanho/cor/qtd) -->

  <!-- MODAL VINCULAR BARCODE -->
  <!-- Código não cadastrado → selecionar produto → vincular variação -->

  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
  <script src="js/db.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/vendas.js"></script>
</body>
</html>
```

> **Nota:** O conteúdo dos modais foi condensado acima para legibilidade. O arquivo real tem 549 linhas com todos os modais completos.

---

### B2 — login.html (Autenticação, 99 linhas — COMPLETO)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entrar — MOVE PÉ</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--bg); margin:0; }
    .login-box { background:var(--card-bg); border:1px solid var(--border); border-radius:16px; padding:40px 36px; width:100%; max-width:360px; box-shadow:0 8px 32px rgba(0,0,0,0.12); }
    .login-logo { text-align:center; margin-bottom:28px; }
    .login-logo-nome { font-size:28px; font-weight:900; color:var(--primary); letter-spacing:1px; }
    .login-logo-sub { font-size:13px; color:var(--text-muted); margin-top:2px; }
    .login-erro { display:none; color:var(--danger); font-size:13px; font-weight:600; text-align:center; margin-bottom:12px; padding:8px; background:rgba(239,68,68,0.08); border-radius:6px; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="login-logo">
      <div class="login-logo-nome">MOVE PÉ</div>
      <div class="login-logo-sub">Gestão de Loja</div>
    </div>

    <!-- Formulário: criar senha (primeira vez) -->
    <div id="boxCriar" style="display:none">
      <div style="text-align:center;margin-bottom:16px;font-size:13px;color:var(--text-muted)">
        Nenhuma senha cadastrada. Crie uma senha para proteger o sistema.
      </div>
      <div id="criarErro" class="login-erro">As senhas não coincidem.</div>
      <div class="form-group">
        <label class="form-label">Nova senha</label>
        <input type="password" id="inputNova" class="form-control" placeholder="Digite a nova senha..."
          onkeydown="if(event.key==='Enter') Login.criar()">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmar senha</label>
        <input type="password" id="inputConfirmar" class="form-control" placeholder="Repita a senha..."
          onkeydown="if(event.key==='Enter') Login.criar()">
      </div>
      <button class="btn btn-primary btn-lg btn-full" onclick="Login.criar()" style="margin-top:8px">
        🔒 Criar senha e entrar
      </button>
    </div>

    <!-- Formulário: entrar com senha existente -->
    <div id="boxEntrar" style="display:none">
      <div id="loginErro" class="login-erro">Senha incorreta. Tente novamente.</div>
      <div class="form-group">
        <label class="form-label">Senha de acesso</label>
        <input type="password" id="inputSenha" class="form-control" placeholder="Digite a senha..."
          autofocus onkeydown="if(event.key==='Enter') Login.entrar()">
      </div>
      <button class="btn btn-primary btn-lg btn-full" onclick="Login.entrar()" style="margin-top:8px">
        🔐 Entrar
      </button>
    </div>
  </div>

  <script src="js/db.js"></script>
  <script>
    // Se já está autenticado, vai direto ao dashboard
    if (sessionStorage.getItem('movePe_auth')) location.replace('dashboard.html');

    const temSenha = !!localStorage.getItem('movePe_senha');
    document.getElementById(temSenha ? 'boxEntrar' : 'boxCriar').style.display = '';
    if (!temSenha) document.getElementById('inputNova').focus();

    const Login = {
      entrar: () => {
        const digitada = document.getElementById('inputSenha').value;
        const salva = localStorage.getItem('movePe_senha');
        if (digitada === salva) {
          sessionStorage.setItem('movePe_auth', '1');
          location.replace('dashboard.html');
        } else {
          document.getElementById('loginErro').style.display = '';
          document.getElementById('inputSenha').value = '';
          document.getElementById('inputSenha').focus();
        }
      },
      criar: () => {
        const nova = document.getElementById('inputNova').value.trim();
        const confirmar = document.getElementById('inputConfirmar').value.trim();
        if (!nova) { document.getElementById('inputNova').focus(); return; }
        if (nova !== confirmar) {
          document.getElementById('criarErro').style.display = '';
          document.getElementById('inputConfirmar').value = '';
          document.getElementById('inputConfirmar').focus();
          return;
        }
        localStorage.setItem('movePe_senha', nova);
        sessionStorage.setItem('movePe_auth', '1');
        location.replace('dashboard.html');
      }
    };
  </script>
</body>
</html>
```

**Riscos de segurança identificados:**
- Senha salva em texto puro no `localStorage` (qualquer script na página pode ler)
- Sem rate limiting — brute force irrestrito
- Sem hash/salt — `localStorage.getItem('movePe_senha')` retorna a senha diretamente
- Sessão em `sessionStorage` sem expiração por tempo

---

### B3 — js/db.js (Camada de Dados, 949 linhas — COMPLETO)

```javascript
/**
 * MOVE PÉ - Camada de Dados v3.0
 * Usa localStorage como banco de dados local + Firebase Firestore para sincronização.
 */

const DB = (() => {
  const P = 'movePe_';

  const _get = (col) => {
    try { return JSON.parse(localStorage.getItem(P + col) || '[]'); }
    catch (e) { return []; }
  };

  const _set = (col, data) => {
    try { localStorage.setItem(P + col, JSON.stringify(data)); return true; }
    catch (e) { console.error('Erro ao salvar:', e); return false; }
  };

  const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // ---- SYNC (Firebase Firestore) ----
  let _fbApp = null, _fbDb = null, _fbReady = false;
  let _onReadyCallbacks = [], _collectionsLoaded = {}, _unsubscribers = [];

  const COLS = ['produtos', 'clientes', 'vendas', 'crediario', 'caixa', 'fluxo', 'despesas', 'retiradas', 'grades', 'trafego'];

  const Sync = {
    isConfigured: () => {
      try {
        const cfg = JSON.parse(localStorage.getItem('movePe_fb_config') || '{}');
        return !!(cfg && cfg.apiKey);
      } catch (e) { return false; }
    },

    init: () => {
      if (!Sync.isConfigured()) return;
      try {
        const cfg = JSON.parse(localStorage.getItem('movePe_fb_config') || '{}');
        if (typeof firebase === 'undefined') { console.warn('Firebase SDK não carregado'); return; }
        if (!firebase.apps || firebase.apps.length === 0) {
          _fbApp = firebase.initializeApp(cfg);
        } else {
          _fbApp = firebase.apps[0];
        }
        _fbDb = firebase.firestore();
        Sync.updateStatus('syncing');
        Sync._setupListeners();
      } catch (e) { console.error('Erro ao inicializar Firebase:', e); Sync.updateStatus('error'); }
    },

    _setupListeners: () => {
      if (!_fbDb) return;
      _unsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
      _unsubscribers = [];

      COLS.forEach(col => {
        _collectionsLoaded[col] = false;
        try {
          const unsub = _fbDb.collection('movePe_' + col).onSnapshot((snap) => {
            const docs = snap.docs.map(d => d.data());
            const local = _get(col);

            // Se Firestore veio vazio mas localStorage tem dados → envia local ao Firestore
            if (docs.length === 0 && local.length > 0 && !_fbReady) {
              local.forEach(item => {
                if (item && item.id) {
                  const sanitized = Sync._sanitizeForFirestore(col, item);
                  _fbDb.collection('movePe_' + col).doc(item.id).set(sanitized).catch(e => console.error(e));
                }
              });
            } else {
              // Merge inteligente para produtos (preserva foto local, prefere mais recente)
              if (col === 'produtos') {
                const merged = docs.map(fbDoc => {
                  const localDoc = local.find(l => l.id === fbDoc.id);
                  if (!localDoc) return fbDoc;
                  const localVars = Object.keys(localDoc.variacoes || {}).length;
                  const fbVars   = Object.keys(fbDoc.variacoes   || {}).length;
                  const localTime = localDoc.atualizadoEm || localDoc.criadoEm || '';
                  const fbTime    = fbDoc.atualizadoEm    || fbDoc.criadoEm    || '';
                  const localIsNewer = localTime > fbTime;
                  const fotoMerge = localDoc.foto || fbDoc.foto || '';
                  const fotosVar  = localDoc.fotosVariacoes || fbDoc.fotosVariacoes || {};
                  if (localVars > fbVars) {
                    Sync.save('produtos', localDoc);
                    return { ...fbDoc, variacoes: localDoc.variacoes, foto: fotoMerge, fotosVariacoes: fotosVar };
                  }
                  if (localIsNewer && localVars >= fbVars) {
                    Sync.save('produtos', localDoc);
                    return { ...localDoc, foto: fotoMerge, fotosVariacoes: fotosVar };
                  }
                  return { ...fbDoc, foto: fotoMerge, fotosVariacoes: fotosVar };
                });
                local.forEach(localDoc => {
                  if (localDoc && localDoc.id && !merged.find(m => m.id === localDoc.id)) {
                    merged.push(localDoc);
                    Sync.save('produtos', localDoc);
                  }
                });
                _set(col, merged);
              } else {
                _set(col, docs); // demais coleções: Firestore sobrescreve local
              }
            }

            const wasReady = _fbReady;
            _collectionsLoaded[col] = true;
            const allLoaded = COLS.every(c => _collectionsLoaded[c]);
            if (allLoaded && !_fbReady) {
              _fbReady = true;
              Sync.updateStatus('synced');
              _onReadyCallbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
              _onReadyCallbacks = [];
              document.dispatchEvent(new CustomEvent('movePe-sync', { detail: { col: 'all' } }));
            }
            if (wasReady && !snap.metadata.hasPendingWrites) {
              Sync.updateStatus('synced');
              document.dispatchEvent(new CustomEvent('movePe-sync', { detail: { col } }));
            }
          }, (err) => {
            console.error('Erro no listener Firestore [' + col + ']:', err);
            Sync.updateStatus('error');
          });
          _unsubscribers.push(unsub);
        } catch (e) { console.error('Erro ao configurar listener [' + col + ']:', e); }
      });

      window.addEventListener('beforeunload', () => {
        _unsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
      }, { once: true });
    },

    // Remove base64 antes de enviar ao Firestore (evita falha por doc > 1MB)
    _sanitizeForFirestore: (col, item) => {
      if (col !== 'produtos') return item;
      const s = { ...item };
      if (s.foto && s.foto.startsWith('data:')) delete s.foto;
      if (s.fotosVariacoes) {
        const fv = {};
        Object.entries(s.fotosVariacoes).forEach(([k, v]) => {
          if (v && !v.startsWith('data:')) fv[k] = v;
        });
        s.fotosVariacoes = fv;
      }
      return s;
    },

    save: (col, item) => {
      if (!_fbDb || !item || !item.id) return;
      try {
        const sanitized = Sync._sanitizeForFirestore(col, item);
        Sync.updateStatus('syncing');
        _fbDb.collection('movePe_' + col).doc(sanitized.id).set(sanitized)
          .then(() => Sync.updateStatus('synced'))
          .catch((e) => { console.error('Erro ao salvar no Firestore:', e); Sync.updateStatus('error'); });
      } catch (e) { console.error('Erro ao chamar save no Firestore:', e); Sync.updateStatus('error'); }
    },

    delete: (col, id) => {
      if (!_fbDb || !id) return;
      try {
        _fbDb.collection('movePe_' + col).doc(id).delete()
          .catch(e => console.error('Erro ao excluir do Firestore:', e));
      } catch(e) {}
    },

    syncAll: () => {
      if (!_fbDb) return;
      Sync.updateStatus('syncing');
      const promises = [];
      COLS.forEach(col => {
        const lista = _get(col);
        lista.forEach(item => {
          if (item && item.id) {
            const sanitized = Sync._sanitizeForFirestore(col, item);
            promises.push(_fbDb.collection('movePe_' + col).doc(sanitized.id).set(sanitized));
          }
        });
      });
      try {
        const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
        if (Object.keys(cfg).length > 0)
          promises.push(_fbDb.collection('movePe_config').doc('main').set(cfg));
      } catch (e) {}
      Promise.all(promises)
        .then(() => Sync.updateStatus('synced'))
        .catch((e) => { console.error('Erro no syncAll:', e); Sync.updateStatus('error'); });
    },

    updateStatus: (status) => {
      const el = document.getElementById('syncStatus');
      if (!el) return;
      if (!Sync.isConfigured()) { el.textContent = ''; return; }
      if (status === 'syncing') el.innerHTML = '<span style="color:var(--text-muted)">🔄 Sincronizando...</span>';
      else if (status === 'synced') el.innerHTML = '<span style="color:var(--success)">☁️ Sincronizado</span>';
      else if (status === 'error') el.innerHTML = '<span style="color:var(--danger)">⚠️ Erro de sync</span>';
    }
  };

  const onReady = (cb) => {
    if (_fbReady || !Sync.isConfigured()) cb();
    else _onReadyCallbacks.push(cb);
  };

  // ---- PRODUTOS ----
  const Produtos = {
    listar: () => _get('produtos'),
    listarAtivos: () => _get('produtos').filter(p => p.ativo !== false),
    buscar: (id) => _get('produtos').find(p => p.id === id),
    buscarPorTexto: (texto) => {
      if (!texto || texto.trim() === '') return Produtos.listarAtivos();
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const t = norm(texto);
      return _get('produtos').filter(p =>
        p.ativo !== false && (
          norm(p.nome).includes(t) || norm(p.marca).includes(t) ||
          norm(p.categoria).includes(t) || norm(p.sku).includes(t) ||
          (p.codigoBarras && p.codigoBarras.includes(t))
        )
      );
    },
    salvar: (prod) => {
      const lista = _get('produtos');
      const idx = lista.findIndex(p => p.id === prod.id);
      prod.atualizadoEm = new Date().toISOString();
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...prod }; }
      else { prod.id = genId(); prod.criadoEm = prod.atualizadoEm; lista.push(prod); }
      _set('produtos', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('produtos', salvo);
      return salvo;
    },
    excluir: (id) => {
      const lista = _get('produtos').map(p => p.id === id ? { ...p, ativo: false } : p);
      _set('produtos', lista);
      const atualizado = lista.find(p => p.id === id);
      if (atualizado) Sync.save('produtos', atualizado);
    },
    atualizarEstoque: (produtoId, tamanho, delta) => {
      const lista = _get('produtos');
      const idx = lista.findIndex(p => p.id === produtoId);
      if (idx < 0) { console.warn(`[Estoque] Produto não encontrado: ${produtoId}`); return false; }
      if (!lista[idx].variacoes) lista[idx].variacoes = {};
      const atual = lista[idx].variacoes[tamanho] || 0;
      lista[idx].variacoes[tamanho] = Math.max(0, atual + delta);
      _set('produtos', lista);
      Sync.save('produtos', lista[idx]);
      return true;
    },
    estoqueTotal: (prod) => {
      if (!prod || !prod.variacoes) return 0;
      return Object.values(prod.variacoes).reduce((s, v) => s + (parseInt(v) || 0), 0);
    },
    listarParados: (diasMinimos = 60) => {
      const hoje = Utils.hoje();
      const d180 = new Date(hoje + 'T00:00:00'); d180.setDate(d180.getDate() - 180);
      const d180str = `${d180.getFullYear()}-${String(d180.getMonth()+1).padStart(2,'0')}-${String(d180.getDate()).padStart(2,'0')}`;
      const ultimaVenda = {};
      DB.Vendas.listarPorPeriodo(d180str, hoje).forEach(v => {
        (v.itens || []).forEach(item => {
          const dt = (v.criadoEm || '').substring(0, 10); // BUG: extrai data UTC
          if (!ultimaVenda[item.produtoId] || dt > ultimaVenda[item.produtoId])
            ultimaVenda[item.produtoId] = dt;
        });
      });
      return Produtos.listarAtivos()
        .filter(p => Produtos.estoqueTotal(p) > 0)
        .map(p => {
          const ultima = ultimaVenda[p.id] || null;
          const dias = ultima
            ? Math.floor((new Date(hoje + 'T00:00:00') - new Date(ultima + 'T00:00:00')) / (1000 * 60 * 60 * 24))
            : 999;
          const capitalPreso = Produtos.estoqueTotal(p) * (parseFloat(p.precoCusto) || 0);
          return { ...p, ultimaVenda: ultima, diasSemVenda: dias, capitalPreso };
        })
        .filter(p => p.diasSemVenda >= diasMinimos)
        .sort((a, b) => b.diasSemVenda - a.diasSemVenda);
    }
  };

  // ---- CLIENTES ----
  const Clientes = {
    listar: () => _get('clientes'),
    buscar: (id) => _get('clientes').find(c => c.id === id),
    buscarPorTexto: (texto) => {
      if (!texto || texto.trim() === '') return _get('clientes');
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const t = norm(texto);
      const temNumero = /\d/.test(texto);
      return _get('clientes').filter(c => {
        try {
          return (
            norm(c.nome).includes(t) || norm(c.email).includes(t) ||
            (temNumero && c.cpf && c.cpf.replace(/\D/g, '').includes(t.replace(/\D/g, ''))) ||
            (temNumero && c.telefone && c.telefone.replace(/\D/g, '').includes(t.replace(/\D/g, '')))
          );
        } catch(e) { return false; }
      });
    },
    salvar: (cli) => {
      const lista = _get('clientes');
      const idx = lista.findIndex(c => c.id === cli.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...cli }; }
      else { cli.id = genId(); cli.criadoEm = new Date().toISOString(); lista.push(cli); }
      _set('clientes', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('clientes', salvo);
      return salvo;
    },
    excluir: (id) => {
      const temCredAberto = Crediario.listar().some(c =>
        c.clienteId === id && c.parcelas && c.parcelas.some(p => p.status !== 'pago')
      );
      if (temCredAberto) return false;
      _set('clientes', _get('clientes').filter(c => c.id !== id));
      Sync.delete('clientes', id);
      return true;
    },
    totalGasto: (clienteId) => _get('vendas').filter(v => v.clienteId === clienteId)
      .reduce((s, v) => s + (parseFloat(v.total) || 0), 0),
    numCompras: (clienteId) => _get('vendas').filter(v => v.clienteId === clienteId).length
  };

  // ---- VENDAS ----
  const Vendas = {
    listar: () => _get('vendas'),
    buscar: (id) => _get('vendas').find(v => v.id === id),
    salvar: (venda) => {
      const lista = _get('vendas');
      const idx = lista.findIndex(v => v.id === venda.id);
      if (idx >= 0) { lista[idx] = venda; }
      else { venda.id = genId(); venda.criadoEm = new Date().toISOString(); lista.push(venda); }
      _set('vendas', lista);
      const salva = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('vendas', salva);
      return salva;
    },
    listarHoje: () => {
      const agora = new Date();
      const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
      const inicioHoje = new Date(hoje + 'T00:00:00').toISOString();
      const fimHoje    = new Date(hoje + 'T23:59:59').toISOString();
      return _get('vendas').filter(v => v.criadoEm && v.criadoEm >= inicioHoje && v.criadoEm <= fimHoje);
    },
    listarPorPeriodo: (inicio, fim) => {
      const inicioISO = new Date(inicio + 'T00:00:00').toISOString();
      const fimISO    = new Date(fim   + 'T23:59:59').toISOString();
      return _get('vendas').filter(v => v.criadoEm && v.criadoEm >= inicioISO && v.criadoEm <= fimISO);
    }
  };

  // ---- CREDIÁRIO ----
  const Crediario = {
    listar: () => {
      // 3-pass dedup O(n²): remove duplicatas criadas pelo Firebase onSnapshot
      const lista = _get('crediario');
      const seenId = new Set();
      const _melhor = (existing, candidato, pagas) => {
        if (!existing) return true;
        if (pagas > existing.pagas) return true;
        if (pagas === existing.pagas && (candidato || '') > (existing.criadoEm || '')) return true;
        return false;
      };
      const melhorPorVenda = new Map();    // Dedup 1: mesmo vendaId
      const melhorPorParcelas = new Map(); // Dedup 2: parcelas idênticas completas
      const melhorPorPend = new Map();    // Dedup 3: parcelas pendentes idênticas
      lista.forEach(c => {
        if (!c.vendaId || !c.id) return;
        const pagas = (c.parcelas || []).filter(p => p.status === 'pago').length;
        if (_melhor(melhorPorVenda.get(c.vendaId), c.criadoEm, pagas))
          melhorPorVenda.set(c.vendaId, { id: c.id, pagas, criadoEm: c.criadoEm || '' });
      });
      lista.forEach(c => {
        if (!c.id || !c.clienteId || !(c.parcelas || []).length) return;
        const fp = c.clienteId + '|' + c.parcelas.map(p => `${p.vencimento}:${p.valor}`).join(',');
        const pagas = c.parcelas.filter(p => p.status === 'pago').length;
        if (_melhor(melhorPorParcelas.get(fp), c.criadoEm, pagas))
          melhorPorParcelas.set(fp, { id: c.id, pagas, criadoEm: c.criadoEm || '' });
      });
      lista.forEach(c => {
        if (!c.id || !c.clienteId || !(c.parcelas || []).length) return;
        const pend = (c.parcelas || []).filter(p => p.status !== 'pago');
        if (!pend.length) return;
        const fp = c.clienteId + '|P|' + pend.map(p => `${p.vencimento}:${p.valor}`).join(',');
        const pagas = c.parcelas.filter(p => p.status === 'pago').length;
        if (_melhor(melhorPorPend.get(fp), c.criadoEm, pagas))
          melhorPorPend.set(fp, { id: c.id, pagas, criadoEm: c.criadoEm || '' });
      });
      return lista.filter(c => {
        if (!c.id || seenId.has(c.id)) return false;
        seenId.add(c.id);
        if (c.vendaId && melhorPorVenda.get(c.vendaId)?.id !== c.id) return false;
        if (c.clienteId && (c.parcelas || []).length) {
          const fp = c.clienteId + '|' + c.parcelas.map(p => `${p.vencimento}:${p.valor}`).join(',');
          if (melhorPorParcelas.get(fp)?.id !== c.id) return false;
          const pend = c.parcelas.filter(p => p.status !== 'pago');
          if (pend.length) {
            const fpP = c.clienteId + '|P|' + pend.map(p => `${p.vencimento}:${p.valor}`).join(',');
            if (melhorPorPend.get(fpP)?.id !== c.id) return false;
          }
        }
        return true;
      });
    },
    buscar: (id) => _get('crediario').find(c => c.id === id),
    listarPorCliente: (clienteId) => _get('crediario').filter(c => c.clienteId === clienteId),
    salvar: (cred) => {
      const lista = _get('crediario');
      let idx = lista.findIndex(c => c.id === cred.id);
      if (idx < 0 && !cred.id && cred.vendaId) {
        const dupIdx = lista.findIndex(c => c.vendaId === cred.vendaId);
        if (dupIdx >= 0) { cred.id = lista[dupIdx].id; cred.criadoEm = lista[dupIdx].criadoEm; idx = dupIdx; }
      }
      if (idx >= 0) { lista[idx] = cred; }
      else { cred.id = genId(); cred.criadoEm = new Date().toISOString(); lista.push(cred); }
      _set('crediario', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('crediario', salvo);
      return salvo;
    },
    pagarParcela: (credId, parcelaIdx) => {
      const lista = _get('crediario');
      const cred = lista.find(c => c.id === credId);
      if (!cred || !cred.parcelas[parcelaIdx]) return false;
      cred.parcelas[parcelaIdx].status = 'pago';
      cred.parcelas[parcelaIdx].dataPagamento = new Date().toISOString();
      _set('crediario', lista);
      Sync.save('crediario', cred);
      return true;
    },
    inadimplentes: () => {
      // BUG: usa toISOString().substring(0,10) — "hoje" em UTC, não horário local
      const hoje = new Date().toISOString().substring(0, 10);
      const clientes = _get('clientes');
      const result = [];
      Crediario.listar().forEach(cred => {
        if (!cred.parcelas) return;
        cred.parcelas.forEach((p, idx) => {
          if (p.status !== 'pago' && p.vencimento < hoje) {
            const cli = clientes.find(c => c.id === cred.clienteId);
            result.push({ credId: cred.id, parcelaIdx: idx, clienteId: cred.clienteId,
              clienteNome: cli ? cli.nome : 'Cliente', vencimento: p.vencimento, valor: p.valor });
          }
        });
      });
      return result;
    },
    totalPendente: () => {
      let total = 0;
      Crediario.listar().forEach(cred => {
        if (!cred.parcelas) return;
        cred.parcelas.forEach(p => { if (p.status !== 'pago') total += parseFloat(p.valor) || 0; });
      });
      return total;
    }
  };

  // ---- CAIXA ----
  const Caixa = {
    listar: () => _get('caixa'),
    buscarAtivo: () => _get('caixa').find(c => c.status === 'aberto'),
    buscar: (id) => _get('caixa').find(c => c.id === id),
    salvar: (cx) => {
      const lista = _get('caixa');
      const idx = lista.findIndex(c => c.id === cx.id);
      if (idx >= 0) { lista[idx] = cx; } else { cx.id = genId(); lista.push(cx); }
      _set('caixa', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('caixa', salvo);
      return salvo;
    }
  };

  // ---- FLUXO DE CAIXA ----
  const FluxoCaixa = {
    listar: () => _get('fluxo'),
    salvar: (mov) => {
      const lista = _get('fluxo');
      mov.id = genId();
      mov.data = mov.data || new Date().toISOString();
      lista.push(mov);
      _set('fluxo', lista);
      Sync.save('fluxo', mov);
      return mov;
    },
    listarPorMes: (ano, mes) => {
      const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
      return _get('fluxo').filter(m => (m.data || '').startsWith(prefix));
    },
    resumoPorMeses: (n) => {
      // BUG: .startsWith(prefix) compara prefix 'YYYY-MM' com data ISO (UTC) → pode errar no fuso
      const resultado = [];
      const agora = new Date();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const ano = d.getFullYear();
        const mes = d.getMonth() + 1;
        const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const movs  = _get('fluxo').filter(m => (m.data || '').startsWith(prefix));
        const vendas = _get('vendas').filter(v => (v.criadoEm || '').startsWith(prefix));
        const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
        const saidas   = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
        resultado.push({ label, entradas, saidas, mes: prefix });
      }
      return resultado;
    }
  };

  // ---- CONFIG ----
  const Config = {
    get: (chave, padrao = null) => {
      const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
      return cfg[chave] !== undefined ? cfg[chave] : padrao;
    },
    set: (chave, valor) => {
      const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
      cfg[chave] = valor;
      localStorage.setItem(P + 'config', JSON.stringify(cfg));
      if (_fbDb) {
        try { _fbDb.collection('movePe_config').doc('main').set(cfg).catch(e => console.error(e)); }
        catch (e) {}
      }
    }
  };

  // ---- DESPESAS ----
  const Despesas = {
    listar: () => _get('despesas'),
    listarPorMes: (mes) => _get('despesas').filter(d => d.recorrente || (d.vencimento || '').startsWith(mes)),
    buscar: (id) => _get('despesas').find(d => d.id === id),
    salvar: (desp) => {
      const lista = _get('despesas');
      const idx = lista.findIndex(d => d.id === desp.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...desp }; }
      else { desp.id = genId(); desp.criadoEm = new Date().toISOString(); lista.push(desp); }
      _set('despesas', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('despesas', salvo);
      return salvo;
    },
    excluir: (id) => { _set('despesas', _get('despesas').filter(d => d.id !== id)); Sync.delete('despesas', id); },
    marcarPago: (id) => {
      const lista = _get('despesas');
      const idx = lista.findIndex(d => d.id === id);
      if (idx < 0) return;
      lista[idx].pago = true;
      lista[idx].dataPagamento = new Date().toISOString();
      _set('despesas', lista);
      Sync.save('despesas', lista[idx]);
    },
    totalMes: (mes) => _get('despesas')
      .filter(d => d.recorrente || (d.vencimento || '').startsWith(mes))
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
  };

  // ---- GRADES DE REPOSIÇÃO ----
  const Grades = {
    listar: () => _get('grades'),
    buscar: (id) => _get('grades').find(g => g.id === id),
    salvar: (grade) => {
      const lista = _get('grades');
      grade.totalPares = (grade.tamanhos || []).reduce((s, t) => s + (parseInt(t.qtd) || 1), 0);
      const idx = lista.findIndex(g => g.id === grade.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...grade }; }
      else { grade.id = genId(); lista.push(grade); }
      _set('grades', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('grades', salvo);
      return salvo;
    },
    excluir: (id) => { _set('grades', _get('grades').filter(g => g.id !== id)); Sync.delete('grades', id); }
  };

  // ---- RETIRADAS DO DONO ----
  const Retiradas = {
    listar: () => _get('retiradas'),
    listarPorMes: (mes) => _get('retiradas').filter(r => (r.data || '').startsWith(mes)),
    totalMes: (mes) => _get('retiradas').filter(r => (r.data || '').startsWith(mes))
      .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0),
    salvar: (ret) => {
      const lista = _get('retiradas');
      const idx = lista.findIndex(r => r.id === ret.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...ret }; }
      else { ret.id = genId(); ret.criadoEm = new Date().toISOString(); lista.push(ret); }
      _set('retiradas', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('retiradas', salvo);
      return salvo;
    },
    excluir: (id) => { _set('retiradas', _get('retiradas').filter(r => r.id !== id)); Sync.delete('retiradas', id); }
  };

  // ---- TRÁFEGO PAGO ----
  const Trafego = {
    listar: () => _get('trafego'),
    listarSemana: (semana) => _get('trafego').filter(t => t.semana === semana),
    totalSemana: (semana) => _get('trafego').filter(t => t.semana === semana)
      .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0),
    salvar: (item) => {
      const lista = _get('trafego');
      const idx = lista.findIndex(t => t.id === item.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...item }; }
      else { item.id = genId(); item.criadoEm = new Date().toISOString(); lista.push(item); }
      _set('trafego', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('trafego', salvo);
      return salvo;
    },
    excluir: (id) => { _set('trafego', _get('trafego').filter(t => t.id !== id)); Sync.delete('trafego', id); }
  };

  // ---- RENDA PESSOAL ----
  const RendaPessoal = {
    listar: () => { try { return JSON.parse(localStorage.getItem(P + 'renda_pessoal') || '[]'); } catch(e) { return []; } },
    salvar: (item) => {
      const lista = RendaPessoal.listar();
      const idx = lista.findIndex(r => r.id === item.id);
      if (idx >= 0) { lista[idx] = { ...lista[idx], ...item }; }
      else { item.id = genId(); item.criadoEm = new Date().toISOString(); lista.push(item); }
      localStorage.setItem(P + 'renda_pessoal', JSON.stringify(lista));
      return idx >= 0 ? lista[idx] : lista[lista.length - 1];
    },
    excluir: (id) => { localStorage.setItem(P + 'renda_pessoal', JSON.stringify(RendaPessoal.listar().filter(r => r.id !== id))); },
    totalMensal: () => RendaPessoal.listar().reduce((s, r) => s + (parseFloat(r.valor)||0), 0)
  };

  // ---- BACKUP ----
  const exportar = () => {
    const agora = new Date();
    const dados = {
      versao: '3.0', exportadoEm: agora.toISOString(),
      produtos: _get('produtos'), clientes: _get('clientes'), vendas: _get('vendas'),
      crediario: _get('crediario'), caixa: _get('caixa'), fluxo: _get('fluxo'),
      despesas: _get('despesas'), retiradas: _get('retiradas'), grades: _get('grades'),
      trafego: _get('trafego'), renda_pessoal: RendaPessoal.listar(),
      config: JSON.parse(localStorage.getItem(P + 'config') || '{}')
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const pad = n => String(n).padStart(2, '0');
    const nomeDt = `${agora.getFullYear()}-${pad(agora.getMonth()+1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}`;
    a.download = `movePe_backup_${nomeDt}.json`;
    a.click();
    URL.revokeObjectURL(url);
    localStorage.setItem(P + 'ultimo_backup', agora.toISOString());
  };

  const importar = (arquivo) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        if (dados.produtos) _set('produtos', dados.produtos);
        if (dados.clientes) _set('clientes', dados.clientes);
        if (dados.vendas) _set('vendas', dados.vendas);
        if (dados.crediario) _set('crediario', dados.crediario);
        if (dados.caixa) _set('caixa', dados.caixa);
        if (dados.fluxo) _set('fluxo', dados.fluxo);
        if (dados.despesas) _set('despesas', dados.despesas);
        if (dados.retiradas) _set('retiradas', dados.retiradas);
        if (dados.grades) _set('grades', dados.grades);
        if (dados.trafego) _set('trafego', dados.trafego);
        if (dados.renda_pessoal) localStorage.setItem(P + 'renda_pessoal', JSON.stringify(dados.renda_pessoal));
        if (dados.config) localStorage.setItem(P + 'config', JSON.stringify(dados.config));
        Sync.syncAll();
        resolve(dados);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(arquivo);
  });

  const ultimoBackup = () => localStorage.getItem(P + 'ultimo_backup') || null;

  const HistoricoTiny = {
    listar: () => JSON.parse(localStorage.getItem(P + 'historico_tiny') || '[]'),
    salvar: (data) => { localStorage.setItem(P + 'historico_tiny', JSON.stringify(data)); },
    limpar: () => localStorage.removeItem(P + 'historico_tiny'),
    importado: () => localStorage.getItem(P + 'historico_tiny') !== null,
  };

  document.addEventListener('DOMContentLoaded', Sync.init);

  return { Produtos, Clientes, Vendas, Crediario, Caixa, FluxoCaixa, Despesas, Retiradas,
           Grades, Trafego, RendaPessoal, Config, HistoricoTiny,
           exportar, importar, lerArquivoBackup: (arquivo) => new Promise((resolve, reject) => {
             const reader = new FileReader();
             reader.onload = (e) => { try { resolve(JSON.parse(e.target.result)); } catch (err) { reject(err); } };
             reader.onerror = reject;
             reader.readAsText(arquivo);
           }),
           ultimoBackup, genId, Sync, onReady };
})();
```

---

### B4 — js/financeiro.js (primeiras 200 linhas)

```javascript
/**
 * MOVE PÉ - Financeiro v3.0
 * Foco em lucro real: DRE, precificação, contas, metas
 */

let _tabAtual = 'resumo';
let _subContasAtual = 'pagar';
let _despesaEditando = null;
let _filtroOrigem = 'todas';

const Fin = {

  init: () => {
    Utils.renderNav('financeiro.html');
    Utils.initModais();
    const hoje = Utils.hoje().substring(0, 7);
    document.getElementById('inputMesGlobal').value = hoje;
    document.getElementById('inputMesGlobal').addEventListener('change', () => Fin.render());
    Fin.render();
  },

  getMes: () => document.getElementById('inputMesGlobal').value || Utils.hoje().substring(0, 7),

  setTab: (tab, btn) => {
    _tabAtual = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    ['resumo','dre','fluxo30','ranking','reposicao','precificacao','contas','metas','diagnostico','trafego','historico'].forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    Fin.render();
  },

  setSubContas: (sub, btn) => {
    _subContasAtual = sub;
    document.querySelectorAll('.tab-btn-sub').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('contasPagar').style.display       = sub === 'pagar'       ? '' : 'none';
    document.getElementById('contasReceber').style.display     = sub === 'receber'     ? '' : 'none';
    document.getElementById('contasRetiradas').style.display   = sub === 'retiradas'   ? '' : 'none';
    document.getElementById('contasPrioridades').style.display = sub === 'prioridades' ? '' : 'none';
    document.getElementById('contasEmprestimo').style.display  = sub === 'emprestimo'  ? '' : 'none';
    const btnNova = document.getElementById('btnNovaDespesa');
    if (btnNova) btnNova.style.display = (sub === 'receber' || sub === 'prioridades' || sub === 'emprestimo') ? 'none' : 'flex';
    Fin.renderContas();
  },

  _setFiltroOrigem: (origem, btn) => {
    _filtroOrigem = origem;
    document.querySelectorAll('.filtro-origem-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    Fin._renderDespesas();
  },

  render: () => {
    if (_tabAtual === 'resumo')       Fin.renderResumo();
    if (_tabAtual === 'dre')          Fin.renderDRE();
    if (_tabAtual === 'fluxo30')      Fin.renderFluxo30();
    if (_tabAtual === 'ranking')      Fin.renderRanking();
    if (_tabAtual === 'reposicao')    Fin.renderReposicao();
    if (_tabAtual === 'precificacao') Fin.renderPrecificacao();
    if (_tabAtual === 'contas')       Fin.renderContas();
    if (_tabAtual === 'metas')        Fin.renderMetas();
    if (_tabAtual === 'diagnostico')  Fin.renderDiagnostico();
    if (_tabAtual === 'trafego')      Fin.renderTrafego();
    if (_tabAtual === 'historico')    Fin.renderHistorico();
  },

  // ---- CÁLCULOS BASE ----
  calcularDRE: (mes) => {
    const inicio = mes + '-01';
    const fim = Utils.fimMes(mes); // CORRIGIDO: era mes + '-31' (hardcoded)

    const produtosCache = {};
    const getCMVVenda = (venda) => {
      if (!venda || !venda.itens) return 0;
      let c = 0;
      venda.itens.forEach(item => {
        let custo = parseFloat(item.precoCusto) || 0;
        if (!custo && item.produtoId) {
          if (!produtosCache[item.produtoId]) produtosCache[item.produtoId] = DB.Produtos.buscar(item.produtoId);
          const prod = produtosCache[item.produtoId];
          custo = prod ? (parseFloat(prod.precoCusto) || 0) : 0;
        }
        c += custo * (parseInt(item.quantidade) || 1);
      });
      return c;
    };

    // Receita de vendas à vista (exclui crediário — caixa ainda não entrou)
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim)
      .filter(v => v.formaPagamento !== 'crediario');
    const receitaVista = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    let cmvVista = 0;
    vendas.forEach(v => { cmvVista += getCMVVenda(v); });

    // Crediário recebido no mês + CMV proporcional
    let crediarioRecebido = 0, cmvCrediario = 0;
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      const totalCred = parseFloat(cred.total) || 0;
      const cmvCred = cred.vendaId ? getCMVVenda(DB.Vendas.buscar(cred.vendaId)) : 0;
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' && p.dataPagamento && p.dataPagamento.startsWith(mes)) {
          const val = parseFloat(p.valor) || 0;
          crediarioRecebido += val;
          if (totalCred > 0 && cmvCred > 0) cmvCrediario += (val / totalCred) * cmvCred;
        }
      });
    });
    cmvCrediario = Math.round(cmvCrediario * 100) / 100;

    const receitaBruta = receitaVista + crediarioRecebido;
    const cmv = Math.round((cmvVista + cmvCrediario) * 100) / 100;
    const taxasCartao = vendas.reduce((s, v) => s + (parseFloat(v.valorTaxaCartao) || 0), 0);

    const despesas = DB.Despesas.listar().filter(d => d.recorrente || (d.vencimento || '').startsWith(mes));
    const despFixas = despesas.filter(d => d.categoria === 'fixo' || d.recorrente)
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const despVariaveis = despesas.filter(d => d.categoria === 'variavel' || d.categoria === 'imposto' || d.categoria === 'outros')
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    const fluxoMes = DB.FluxoCaixa.listar().filter(f => (f.data || '').startsWith(mes));
    const outrasEntradas = fluxoMes.filter(f => f.tipo === 'entrada' && f.categoria !== 'venda')
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

    const totalRetiradas = DB.Retiradas.totalMes(mes);
    const lucroBruto    = receitaBruta - cmv;
    const totalDespesas = despFixas + despVariaveis + taxasCartao;
    const lucroLiquido  = lucroBruto - totalDespesas - totalRetiradas;
    const margemBruta   = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return { receitaBruta, receitaVista, crediarioRecebido, cmv, cmvVista, cmvCrediario,
             lucroBruto, margemBruta, despFixas, despVariaveis, taxasCartao, totalDespesas,
             totalRetiradas, lucroLiquido, margemLiquida, outrasEntradas, qtdVendas: vendas.length };
  },

  // ---- ABA RESUMO ----
  renderResumo: () => {
    Fin.renderMetaDia();
    const mes = Fin.getMes();
    const d   = Fin.calcularDRE(mes);
    const aReceber = DB.Crediario.totalPendente();
    // ... [continua por mais ~5800 linhas]
  }
  // [11 tabs: resumo, dre, fluxo30, ranking, reposicao, precificacao, contas, metas, diagnostico, trafego, historico]
};

document.addEventListener('DOMContentLoaded', Fin.init);
document.addEventListener('movePe-sync', () => Fin.render());
```

---

### B5 — package.json (COMPLETO)

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.105.2",
    "dotenv": "^17.4.2",
    "xlsx": "^0.18.5"
  }
}
```

> **Observação:** O package.json não tem devDependencies, scripts, nome ou versão. As dependências (@supabase, dotenv, xlsx) são usadas pelo `servidor.js` (Node.js) para importação de dados do ERP Tiny — **não pelo frontend**, que é 100% vanilla JS sem bundler.

---

### B6 — vercel.json (COMPLETO)

```json
{
  "rewrites": [
    { "source": "/", "destination": "/dashboard.html" }
  ]
}
```

---

### B7 — servidor.js (script de importação Tiny — Node.js)

Arquivo utilitário (não serve o frontend). Importa dados do ERP Tiny via API REST para o localStorage/Firebase via Supabase como bridge.

**Funções principais:**
- `buscarVendasTiny(mes)` — GET `/api/v2/vendas` com autenticação por token
- `buscarContas()` — GET contas a receber do Tiny
- `normalizarVenda(v)` — converte schema Tiny → schema Move Pé
- Exporta JSON para `dados_tiny_historico.json` (200 KB no projeto)

---

## C) 10 MAIORES ARQUIVOS DO PROJETO

| # | Arquivo | Tamanho |
|---|---------|---------|
| 1 | `js/financeiro.js` | 206.235 bytes (206 KB) |
| 2 | `dados_tiny_historico.json` | 200.606 bytes (200 KB) |
| 3 | `movepe.zip.zip` | 124.868 bytes (artefato) |
| 4 | `_redirects.zip` | 124.868 bytes (artefato) |
| 5 | `js/vendas.js` | 88.333 bytes (88 KB) |
| 6 | `js/crediario.js` | 83.596 bytes (83 KB) |
| 7 | `js/dashboard.js` | 69.703 bytes (69 KB) |
| 8 | `AUDITORIA_SISTEMA.md` | 47.113 bytes (47 KB) |
| 9 | `configuracoes.html` | 44.193 bytes (44 KB) |
| 10 | `js/trafego.js` | 36.333 bytes (36 KB) |

**Total do projeto** (excl. node_modules, .git): ~1,3 MB de código + 325 KB de artefatos removíveis

---

## D) TODAS AS CHAVES DO localStorage

### Prefixo padrão: `movePe_`

| Chave localStorage | Tipo | Descrição |
|--------------------|------|-----------|
| `movePe_produtos` | `Array<Produto>` | Catálogo completo de produtos |
| `movePe_clientes` | `Array<Cliente>` | Base de clientes |
| `movePe_vendas` | `Array<Venda>` | Histórico de vendas |
| `movePe_crediario` | `Array<Crediario>` | Contratos de crediário + parcelas |
| `movePe_caixa` | `Array<Caixa>` | Sessões de caixa (abertura/fechamento) |
| `movePe_fluxo` | `Array<FluxoMov>` | Movimentações manuais de fluxo de caixa |
| `movePe_despesas` | `Array<Despesa>` | Despesas fixas e variáveis |
| `movePe_retiradas` | `Array<Retirada>` | Retiradas do dono |
| `movePe_grades` | `Array<Grade>` | Grades de reposição de estoque |
| `movePe_trafego` | `Array<Trafego>` | Gastos com tráfego pago |
| `movePe_renda_pessoal` | `Array<RendaItem>` | Renda pessoal do proprietário |
| `movePe_config` | `Object` | Configurações gerais da loja |
| `movePe_fb_config` | `Object` | Credenciais do Firebase (apiKey, projectId etc.) |
| `movePe_senha` | `string` | **Senha em texto puro** (risco de segurança) |
| `movePe_ultimo_backup` | `string` | ISO timestamp do último backup |
| `movePe_historico_tiny` | `Array` | Histórico importado do ERP Tiny |

### Schemas detalhados

#### Produto
```json
{
  "id": "lc3k2abc12345",
  "nome": "Tênis Nike Air Max",
  "marca": "Nike",
  "categoria": "calcado_adulto",
  "sku": "NK-AM-001",
  "codigoBarras": "7891234567890",
  "precoVenda": 299.90,
  "precoCusto": 150.00,
  "variacoes": { "38": 3, "39": 5, "40": 2, "41": 0 },
  "foto": "data:image/jpeg;base64,...",
  "fotosVariacoes": { "38": "data:image/jpeg;base64,..." },
  "ativo": true,
  "criadoEm": "2026-01-15T14:30:00.000Z",
  "atualizadoEm": "2026-04-10T09:15:00.000Z"
}
```

#### Cliente
```json
{
  "id": "lc3k2def67890",
  "nome": "João Silva",
  "telefone": "(81) 99999-0000",
  "cpf": "123.456.789-00",
  "email": "joao@email.com",
  "endereco": "Rua das Flores, 123",
  "criadoEm": "2026-02-01T10:00:00.000Z"
}
```

#### Venda
```json
{
  "id": "lc3k2ghi11111",
  "clienteId": "lc3k2def67890",
  "clienteNome": "João Silva",
  "itens": [
    {
      "produtoId": "lc3k2abc12345",
      "nome": "Tênis Nike Air Max",
      "tamanho": "39",
      "quantidade": 1,
      "precoUnitario": 299.90,
      "precoCusto": 150.00,
      "subtotal": 299.90
    }
  ],
  "subtotal": 299.90,
  "desconto": 0,
  "total": 299.90,
  "formaPagamento": "pix",
  "parcelas": 1,
  "valorTaxaCartao": 0,
  "observacao": "",
  "vendedorId": null,
  "criadoEm": "2026-04-15T18:30:00.000Z"
}
```

#### Crediário
```json
{
  "id": "lc3k2jkl22222",
  "vendaId": "lc3k2ghi33333",
  "clienteId": "lc3k2def67890",
  "clienteNome": "João Silva",
  "total": 330.00,
  "acrescimo": 10,
  "parcelas": [
    {
      "numero": 1,
      "valor": 110.00,
      "vencimento": "2026-05-01",
      "status": "pago",
      "dataPagamento": "2026-05-01T14:00:00.000Z",
      "formaPagamento": "dinheiro"
    },
    {
      "numero": 2,
      "valor": 110.00,
      "vencimento": "2026-06-01",
      "status": "pendente",
      "dataPagamento": null
    },
    {
      "numero": 3,
      "valor": 110.00,
      "vencimento": "2026-07-01",
      "status": "pendente",
      "dataPagamento": null
    }
  ],
  "criadoEm": "2026-04-10T11:00:00.000Z"
}
```

#### Caixa (sessão)
```json
{
  "id": "lc3k2mno44444",
  "abertoEm": "2026-05-05T08:00:00.000Z",
  "fechadoEm": null,
  "status": "aberto",
  "saldoInicial": 200.00,
  "saldoFinal": null,
  "operador": "Weto"
}
```

#### Despesa
```json
{
  "id": "lc3k2pqr55555",
  "descricao": "Aluguel da loja",
  "valor": 2500.00,
  "categoria": "fixo",
  "origem": "loja",
  "vencimento": "2026-05-10",
  "pago": false,
  "recorrente": true,
  "criadoEm": "2026-01-01T00:00:00.000Z"
}
```

#### Retirada
```json
{
  "id": "lc3k2stu66666",
  "valor": 1500.00,
  "descricao": "Retirada mensal do dono",
  "data": "2026-05-05T10:00:00.000Z",
  "criadoEm": "2026-05-05T10:00:00.000Z"
}
```

#### Config
```json
{
  "nomeLoja": "Move Pé Calçados",
  "whatsapp": "5581999990000",
  "acrescimoCrediario": 10,
  "taxaCartaoCredito": 3.5,
  "taxaCartaoDebito": 1.5,
  "taxaPixManual": 0,
  "metaMensal": 15000,
  "vendedoresAtivos": ["Weto", "Funcionário 2"],
  "temaEscuro": false,
  "alertaEstoqueBaixo": 2
}
```

#### Firebase Config (movePe_fb_config)
```json
{
  "apiKey": "AIza...",
  "authDomain": "projeto.firebaseapp.com",
  "projectId": "projeto",
  "storageBucket": "projeto.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcdef"
}
```

> **Risco crítico:** As credenciais do Firebase ficam expostas no localStorage do navegador, acessíveis a qualquer script na página. Sem regras de segurança do Firestore configuradas, qualquer pessoa com as credenciais pode ler/escrever todos os dados.

---

## E) CONFIRMAÇÃO FINAL

| Item | Valor |
|------|-------|
| **Caminho — AUDITORIA_SISTEMA.md** | `C:\Users\MOVE PE CALÇADOS\MovePe\AUDITORIA_SISTEMA.md` |
| **Linhas — AUDITORIA_SISTEMA.md** | 1.039 linhas |
| **Caminho — ARQUIVOS_CRITICOS.md** | `C:\Users\MOVE PE CALÇADOS\MovePe\ARQUIVOS_CRITICOS.md` |
| **Produção (GitHub Pages)** | `https://movepecalcados-stack.github.io/MOVEPE/` |
| **Stack** | HTML/CSS/JS puro + Firebase Firestore + GitHub Pages |
| **Banco de dados** | localStorage (primário) + Firestore (sync) |
| **Autenticação** | Senha em localStorage (texto puro) + sessionStorage flag |
