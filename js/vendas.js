/**
 * MOVE PÉ - PDV v2.0
 * Tamanhos inline no card, atalhos de teclado
 */

let _carrinho = [];
let _formaPagamento = '';
let _clienteSelecionado = null;
let _tamSelecionado = {}; // produtoId -> tamanho selecionado
let _desconto = { tipo: 'reais', valor: 0 }; // desconto atual
let _modoSplit = false;
let _formasSplit = []; // [{forma, valor}]

// ---- RECEBER CREDIÁRIO ----
let _rcClienteSel = null;
let _rcCredSel = null;
let _rcParcelaSel = null;
const RC_CARENCIA = 5;
const RC_JUROS_DIA = 0.004;

const rcCalcJuros = (vencimento, valor) => {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const venc = new Date(vencimento + 'T00:00:00');
  const dias = Math.floor((hoje - venc) / 86400000);
  if (dias <= 0) return { diasAtraso: 0, diasJuros: 0, juros: 0 };
  const diasJuros = Math.max(0, dias - RC_CARENCIA);
  const juros = diasJuros > 0 ? Math.round(parseFloat(valor) * RC_JUROS_DIA * diasJuros * 100) / 100 : 0;
  return { diasAtraso: dias, diasJuros, juros };
};

const PDV = {

  init: () => {
    Utils.renderNav('index.html');
    Utils.initModais();
    PDV.verificarCaixaStatus();
    PDV.renderProdutos();
    PDV.renderCarrinho();

    document.getElementById('buscaInput').addEventListener('input', (e) => {
      PDV.renderProdutos(e.target.value);
    });

    document.getElementById('btnLimparCarrinho').addEventListener('click', () => {
      if (_carrinho.length > 0 && Utils.confirmar('Limpar carrinho?')) {
        _carrinho = [];
        _tamSelecionado = {};
        PDV.renderCarrinho();
        PDV.renderProdutos(document.getElementById('buscaInput').value);
      }
    });

    document.getElementById('btnPagar').addEventListener('click', PDV.abrirPagamento);
    document.getElementById('btnConfirmarPagamento').addEventListener('click', PDV.confirmarPagamento);
    document.getElementById('btnCancelarPagamento').addEventListener('click', () => Utils.fecharModal('modalPagamento'));
    document.getElementById('btnFecharAtalhos').addEventListener('click', () => Utils.fecharModal('modalAtalhos'));
    document.getElementById('btnBuscarCliente').addEventListener('click', PDV.abrirBuscaCliente);
    document.getElementById('buscaClienteInput').addEventListener('input', (e) => PDV.buscarCliente(e.target.value));

    // Pré-selecionar cliente vindo da Ficha do Cliente
    const pdvClienteId = localStorage.getItem('movePe_pdv_cliente');
    if (pdvClienteId) {
      localStorage.removeItem('movePe_pdv_cliente');
      const cli = DB.Clientes.buscar(pdvClienteId);
      if (cli) { _clienteSelecionado = cli; PDV.atualizarClienteDisplay(); }
    }
    document.getElementById('btnRemoverCliente').addEventListener('click', () => {
      _clienteSelecionado = null;
      PDV.atualizarClienteDisplay();
    });

    // Atalhos de teclado
    document.addEventListener('keydown', PDV.atalhos);

    // Aviso de estoque crítico ao abrir o PDV (após o toast de aniversário sumir)
    setTimeout(PDV.verificarEstoqueCritico, 4000);
  },

  verificarEstoqueCritico: () => {
    const prods = DB.Produtos.listarAtivos();
    const zerados = prods.filter(p => DB.Produtos.estoqueTotal(p) === 0).length;
    const baixos = prods.filter(p => {
      const t = DB.Produtos.estoqueTotal(p);
      return t > 0 && t <= (p.estoqueMinimo || 5);
    }).length;
    if (zerados > 0) {
      Utils.toast(`⚠️ ${zerados} produto(s) com estoque zerado!`, 'error');
    } else if (baixos > 0) {
      Utils.toast(`⚠️ ${baixos} produto(s) com estoque baixo`, 'warning');
    }
  },

  atalhos: (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      if (e.key === 'F2') { e.preventDefault(); document.getElementById('buscaInput').focus(); }
      if (e.key === 'F9') { e.preventDefault(); PDV.abrirPagamento(); }
      return;
    }
    if (e.key === 'F1') { e.preventDefault(); Utils.abrirModal('modalAtalhos'); }
    if (e.key === 'F2') { e.preventDefault(); document.getElementById('buscaInput').focus(); }
    if (e.key === 'F9') { e.preventDefault(); PDV.abrirPagamento(); }
    if (e.key === 'Escape') {
      Utils.fecharModal('modalPagamento');
      Utils.fecharModal('modalAtalhos');
      Utils.fecharModal('modalClientes');
    }
  },

  verificarCaixaStatus: () => {
    const caixa = DB.Caixa.buscarAtivo();
    const statusEl = document.getElementById('caixaStatus');
    const operadorEl = document.getElementById('operadorInfo');
    if (caixa) {
      statusEl.textContent = 'Caixa Aberto';
      statusEl.className = 'topbar-badge success';
      if (caixa.operador) {
        operadorEl.textContent = `Operador: ${caixa.operador}`;
        operadorEl.style.display = '';
      }
    } else {
      statusEl.textContent = 'Caixa Fechado';
      statusEl.className = 'topbar-badge danger';
      operadorEl.style.display = 'none';
    }
  },

  renderProdutos: (busca = '') => {
    const prods = busca.trim()
      ? DB.Produtos.buscarPorTexto(busca)
      : DB.Produtos.listarAtivos();

    const grid = document.getElementById('produtosGrid');
    if (prods.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Nenhum produto encontrado</div>
      </div>`;
      return;
    }

    grid.innerHTML = prods.map(p => {
      const variacoes = p.variacoes || {};
      const total = DB.Produtos.estoqueTotal(p);
      const baixo = total <= (p.estoqueMinimo || 5);
      const tamSel = _tamSelecionado[p.id] || '';

      const tamanhosHtml = Object.entries(variacoes)
        .sort((a, b) => {
          const pa = a[0].split('||'); const pb = b[0].split('||');
          const na = parseFloat(pa[0]); const nb = parseFloat(pb[0]);
          if (!isNaN(na) && !isNaN(nb)) return na - nb || (pa[1]||'').localeCompare(pb[1]||'');
          return a[0].localeCompare(b[0]);
        })
        .map(([key, qtd]) => {
          const [tam, cor] = key.split('||');
          return `
          <button class="tamanho-btn ${qtd <= 0 ? 'sem-estoque' : ''} ${tamSel === key ? 'selecionado' : ''}"
            onclick="PDV.selecionarTamanho('${p.id}', '${key}', ${qtd})"
            ${qtd <= 0 ? 'disabled' : ''}
            title="${cor ? cor + ' · ' : ''}Estoque: ${qtd}">
            <span>${tam}</span>
            ${cor ? `<span style="font-size:9px;display:block;line-height:1.2;opacity:0.8;max-width:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cor}</span>` : ''}
          </button>`;
        }).join('');

      return `
        <div class="produto-card ${baixo ? 'low-stock' : ''}">
          <div>
            <div class="produto-nome">${p.nome}</div>
            ${p.marca ? `<div class="produto-sku">${p.marca}${p.categoria ? ' · ' + p.categoria : ''}</div>` : ''}
            ${p.sku ? `<div class="produto-sku">SKU: ${p.sku}</div>` : ''}
          </div>
          <div class="produto-preco">${Utils.moeda(p.precoVenda)}</div>
          <span class="produto-tipo-badge">${Utils.labelTipo(p.tipo)}</span>
          ${Object.keys(variacoes).length > 0 ? `
            <div>
              <div class="text-muted fs-sm" style="margin-bottom:4px">Selecione o tamanho:</div>
              <div class="tamanhos-grid">${tamanhosHtml}</div>
            </div>
          ` : ''}
          <div class="produto-card-add">
            <button class="btn btn-primary btn-sm btn-full" onclick="PDV.adicionarAoCarrinho('${p.id}')">
              + Adicionar
            </button>
          </div>
        </div>`;
    }).join('');
  },

  selecionarTamanho: (prodId, tamanho, qtd) => {
    if (qtd <= 0) return;
    _tamSelecionado[prodId] = tamanho;
    PDV.renderProdutos(document.getElementById('buscaInput').value);
  },

  adicionarAoCarrinho: (prodId) => {
    const prod = DB.Produtos.buscar(prodId);
    if (!prod) return;

    const variacoes = prod.variacoes || {};
    const temTamanhos = Object.keys(variacoes).length > 0;

    let tamanho = _tamSelecionado[prodId] || '';

    if (temTamanhos && !tamanho) {
      Utils.toast('Selecione um tamanho primeiro!', 'warning');
      return;
    }

    if (tamanho && (variacoes[tamanho] || 0) <= 0) {
      Utils.toast('Tamanho sem estoque!', 'error');
      return;
    }

    // Extrair tamanho e cor da chave composta (ex: "38||Preto")
    const [tamLabel, corLabel] = tamanho.split('||');

    // Verificar se já está no carrinho com mesma variação
    const key = prodId + '_' + tamanho;
    const existente = _carrinho.find(i => i._key === key);
    if (existente) {
      const qtdAtual = existente.quantidade;
      const estoqueDisp = tamanho ? (variacoes[tamanho] || 0) : DB.Produtos.estoqueTotal(prod);
      if (qtdAtual >= estoqueDisp) {
        Utils.toast('Estoque insuficiente!', 'error');
        return;
      }
      existente.quantidade++;
      existente.total = existente.quantidade * existente.precoUnitario;
    } else {
      _carrinho.push({
        _key: key,
        produtoId: prodId,
        nome: prod.nome,
        tamanho,
        tamanhoLabel: tamLabel,
        cor: corLabel || '',
        sku: prod.sku || '',
        precoUnitario: prod.precoVenda,
        quantidade: 1,
        total: prod.precoVenda
      });
    }

    // Limpar seleção de tamanho
    delete _tamSelecionado[prodId];

    PDV.renderCarrinho();
    PDV.renderProdutos(document.getElementById('buscaInput').value);
    const desc = tamLabel ? ` (Tam ${tamLabel}${corLabel ? ' · ' + corLabel : ''})` : '';
    Utils.toast(`${prod.nome}${desc} adicionado!`, 'success');
  },

  renderCarrinho: () => {
    const lista = document.getElementById('carrinhoLista');
    const totalEl = document.getElementById('carrinhoTotal');
    const btnPagar = document.getElementById('btnPagar');

    if (_carrinho.length === 0) {
      lista.innerHTML = `<div class="carrinho-empty">
        <div class="carrinho-empty-icon">🛒</div>
        <span>Carrinho vazio</span>
        <span style="font-size:12px">Adicione produtos</span>
      </div>`;
      document.getElementById('carrinhoSubtotal').textContent = Utils.moeda(0);
      totalEl.textContent = Utils.moeda(0);
      btnPagar.disabled = true;
      PDV.removerDesconto();
      return;
    }

    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);

    lista.innerHTML = _carrinho.map((item, idx) => `
      <div class="carrinho-item">
        <div class="carrinho-item-info">
          <div class="carrinho-item-nome">${item.nome}</div>
          <div class="carrinho-item-det">${item.tamanhoLabel ? 'Tam ' + item.tamanhoLabel + (item.cor ? ' · ' + item.cor : '') + ' · ' : ''}${Utils.moeda(item.precoUnitario)} un</div>
          <div class="carrinho-item-preco">${Utils.moeda(item.total)}</div>
        </div>
        <div class="carrinho-qtd">
          <button onclick="PDV.alterarQtd(${idx}, -1)">−</button>
          <span>${item.quantidade}</span>
          <button onclick="PDV.alterarQtd(${idx}, 1)">+</button>
        </div>
      </div>`).join('');

    document.getElementById('carrinhoSubtotal').textContent = Utils.moeda(subtotal);
    if (descontoVal > 0) {
      document.getElementById('carrinhoDescontoVal').textContent = Utils.moeda(descontoVal);
      document.getElementById('carrinhoDescontoArea').style.display = '';
    }
    totalEl.textContent = Utils.moeda(total);
    btnPagar.disabled = false;
  },

  toggleDesconto: () => {
    const area = document.getElementById('carrinhoDescontoArea');
    if (area.style.display === 'none') {
      area.style.display = '';
      setTimeout(() => document.getElementById('inputDesconto').focus(), 50);
    } else {
      PDV.removerDesconto();
    }
  },

  setTipoDesconto: (tipo) => {
    _desconto.tipo = tipo;
    document.getElementById('btnDescReais').style.background = tipo === 'reais' ? 'var(--primary)' : 'none';
    document.getElementById('btnDescReais').style.color = tipo === 'reais' ? '#fff' : 'var(--text-muted)';
    document.getElementById('btnDescPct').style.background = tipo === 'pct' ? 'var(--primary)' : 'none';
    document.getElementById('btnDescPct').style.color = tipo === 'pct' ? '#fff' : 'var(--text-muted)';
    PDV.aplicarDesconto();
  },

  aplicarDesconto: () => {
    const val = parseFloat(document.getElementById('inputDesconto').value) || 0;
    _desconto.valor = val;
    PDV.renderCarrinho();
  },

  removerDesconto: () => {
    _desconto = { tipo: 'reais', valor: 0 };
    const area = document.getElementById('carrinhoDescontoArea');
    if (area) {
      area.style.display = 'none';
      document.getElementById('inputDesconto').value = '';
      document.getElementById('carrinhoDescontoVal').textContent = 'R$ 0,00';
    }
    if (_carrinho.length > 0) PDV.renderCarrinho();
  },

  alterarQtd: (idx, delta) => {
    const item = _carrinho[idx];
    if (!item) return;
    const novaQtd = item.quantidade + delta;
    if (novaQtd <= 0) {
      _carrinho.splice(idx, 1);
    } else {
      const prod = DB.Produtos.buscar(item.produtoId);
      if (prod && item.tamanho) {
        const estDisp = (prod.variacoes || {})[item.tamanho] || 0;
        if (novaQtd > estDisp) { Utils.toast('Estoque insuficiente!', 'error'); return; }
      }
      item.quantidade = novaQtd;
      item.total = novaQtd * item.precoUnitario;
    }
    PDV.renderCarrinho();
  },

  abrirBuscaCliente: () => {
    document.getElementById('buscaClienteInput').value = '';
    document.getElementById('resultadoClientes').innerHTML = '';
    Utils.abrirModal('modalClientes');
    setTimeout(() => document.getElementById('buscaClienteInput').focus(), 100);
  },

  buscarCliente: (texto) => {
    const clientes = texto.trim() ? DB.Clientes.buscarPorTexto(texto) : DB.Clientes.listar().slice(0, 8);
    const cont = document.getElementById('resultadoClientes');
    cont.innerHTML = clientes.map(c => `
      <div class="cliente-card" style="cursor:pointer;margin-bottom:8px" onclick="PDV.selecionarCliente('${c.id}')">
        <div class="cliente-avatar">${c.nome.charAt(0).toUpperCase()}</div>
        <div class="cliente-info">
          <div class="cliente-nome">${c.nome}</div>
          <div class="cliente-det">${c.cpf ? Utils.cpf(c.cpf) : ''} ${c.telefone ? '· ' + Utils.telefone(c.telefone) : ''}</div>
        </div>
      </div>`).join('');
  },

  selecionarCliente: (id) => {
    _clienteSelecionado = DB.Clientes.buscar(id);
    Utils.fecharModal('modalClientes');
    PDV.atualizarClienteDisplay();
  },

  atualizarClienteDisplay: () => {
    const el = document.getElementById('clienteSelecionado');
    const btnRemover = document.getElementById('btnRemoverCliente');
    if (_clienteSelecionado) {
      el.textContent = `👤 ${_clienteSelecionado.nome}`;
      el.style.color = 'var(--primary)';
      btnRemover.style.display = '';
    } else {
      el.textContent = 'Sem cliente';
      el.style.color = 'var(--text-muted)';
      btnRemover.style.display = 'none';
    }
  },

  abrirPagamento: () => {
    if (_carrinho.length === 0) { Utils.toast('Carrinho vazio!', 'warning'); return; }
    if (!Utils.verificarCaixa()) { Utils.toast('Abra o caixa antes de vender!', 'error'); return; }

    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    document.getElementById('pagTotal').textContent = Utils.moeda(total);
    document.getElementById('inputValorPago').value = total.toFixed(2);
    document.getElementById('inputTroco').value = '';
    document.getElementById('inputNumeroParcelas').value = '1';
    document.getElementById('inputParcelasCartao').value = '1';
    document.getElementById('inputValorParcelaCartao').value = '';
    document.getElementById('crediarioResumo').style.display = 'none';
    document.getElementById('crediarioResumo').textContent = '';

    // Data padrão do 1º vencimento: próximo mês, mesmo dia de hoje
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('inputVencimento1').value = nextMonth.toISOString().substring(0, 10);

    _formaPagamento = '';
    document.querySelectorAll('.forma-btn').forEach(b => b.classList.remove('ativo'));
    document.getElementById('secaoCrediario').style.display = 'none';
    document.getElementById('secaoCartaoCredito').style.display = 'none';
    document.getElementById('secaoTroco').style.display = 'none';

    // Popula seletor de vendedor
    const vendedores = DB.Config.get('vendedores', []);
    const secVend = document.getElementById('secaoVendedor');
    const selVend = document.getElementById('selectVendedor');
    if (vendedores.length > 0) {
      secVend.style.display = '';
      const caixa = DB.Caixa.buscarAtivo();
      const operadorAtual = caixa ? (caixa.operador || '') : '';
      selVend.innerHTML = '<option value="">— Sem vendedor —</option>' +
        vendedores.map(v =>
          `<option value="${v.nome}" data-comissao="${v.comissao}" ${v.nome === operadorAtual ? 'selected' : ''}>${v.nome} (${v.comissao}%)</option>`
        ).join('');
    } else {
      secVend.style.display = 'none';
    }

    _modoSplit = false;
    _formasSplit = [];
    PDV.setModoSimples();
    Utils.abrirModal('modalPagamento');
  },

  setModoSimples: () => {
    _modoSplit = false;
    document.getElementById('secaoModoSimples').style.display = '';
    document.getElementById('secaoModoSplit').style.display = 'none';
    document.getElementById('btnModoSimples').className = 'btn btn-primary btn-sm';
    document.getElementById('btnModoSplit').className = 'btn btn-outline btn-sm';
  },

  setModoSplit: () => {
    _modoSplit = true;
    _formasSplit = [];
    document.getElementById('secaoModoSimples').style.display = 'none';
    document.getElementById('secaoModoSplit').style.display = '';
    document.getElementById('btnModoSimples').className = 'btn btn-outline btn-sm';
    document.getElementById('btnModoSplit').className = 'btn btn-primary btn-sm';
    // Pré-preenche o valor com o total
    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    document.getElementById('inputSplitValor').value = total.toFixed(2);
    document.getElementById('inputSplitParcelas').value = '1';
    PDV.splitFormaChange();
    PDV.renderSplitLista();
    PDV.renderSplitResumo();
  },

  splitFormaChange: () => {
    const forma = document.getElementById('selectSplitForma').value;
    const secParcelas = document.getElementById('splitSecaoParcelas');
    const secVenc = document.getElementById('splitSecaoVencimento');
    secParcelas.style.display = (forma === 'cartao_credito' || forma === 'crediario') ? '' : 'none';
    secVenc.style.display = forma === 'crediario' ? '' : 'none';
    if (forma === 'crediario' && !document.getElementById('inputSplitVencimento').value) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      document.getElementById('inputSplitVencimento').value = nextMonth.toISOString().substring(0, 10);
    }
  },

  adicionarSplit: () => {
    const forma = document.getElementById('selectSplitForma').value;
    const valor = parseFloat(document.getElementById('inputSplitValor').value) || 0;
    if (valor <= 0) { Utils.toast('Digite um valor válido', 'warning'); return; }

    if (forma === 'crediario' && !_clienteSelecionado) {
      Utils.toast('Selecione um cliente para usar crediário', 'warning'); return;
    }

    const entrada = { forma, valor: Math.round(valor * 100) / 100 };

    if (forma === 'cartao_credito') {
      entrada.parcelas = parseInt(document.getElementById('inputSplitParcelas').value) || 1;
    }
    if (forma === 'crediario') {
      entrada.parcelas = parseInt(document.getElementById('inputSplitParcelas').value) || 1;
      entrada.vencimento = document.getElementById('inputSplitVencimento').value
        || Utils.adicionarMeses(Utils.hoje(), 1);
    }

    _formasSplit.push(entrada);
    document.getElementById('inputSplitValor').value = '';
    document.getElementById('inputSplitParcelas').value = '1';

    // Sugere o restante no campo
    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    const alocado = _formasSplit.reduce((s, f) => s + f.valor, 0);
    const restante = Math.max(0, Math.round((total - alocado) * 100) / 100);
    if (restante > 0) document.getElementById('inputSplitValor').value = restante.toFixed(2);

    PDV.renderSplitLista();
    PDV.renderSplitResumo();
    document.getElementById('inputSplitValor').focus();
  },

  removerSplit: (idx) => {
    _formasSplit.splice(idx, 1);
    PDV.renderSplitLista();
    PDV.renderSplitResumo();
  },

  renderSplitLista: () => {
    const cont = document.getElementById('splitLista');
    if (_formasSplit.length === 0) { cont.innerHTML = ''; return; }
    const labels = { dinheiro: '💵 Dinheiro', pix: '📱 PIX', cartao_credito: '💳 Crédito', cartao_debito: '💳 Débito', crediario: '📋 Crediário' };
    cont.innerHTML = _formasSplit.map((f, i) => {
      let detalhe = '';
      if (f.forma === 'cartao_credito' && f.parcelas > 1) {
        detalhe = ` · ${f.parcelas}x de ${Utils.moeda(f.valor / f.parcelas)}`;
      } else if (f.forma === 'crediario' && f.parcelas) {
        detalhe = ` · ${f.parcelas}x de ${Utils.moeda(f.valor / f.parcelas)}`;
        if (f.vencimento) detalhe += ` · venc. ${Utils.data(f.vencimento)}`;
      }
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:6px;margin-bottom:4px">
          <div>
            <span style="font-weight:600">${labels[f.forma] || f.forma}</span>
            ${detalhe ? `<span style="font-size:11px;color:var(--text-muted)">${detalhe}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:var(--primary);font-weight:700">${Utils.moeda(f.valor)}</span>
            <button onclick="PDV.removerSplit(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px">✕</button>
          </div>
        </div>`;
    }).join('');
  },

  renderSplitResumo: () => {
    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    const alocado = _formasSplit.reduce((s, f) => s + f.valor, 0);
    const restante = Math.round((total - alocado) * 100) / 100;
    const ok = restante <= 0.01;
    document.getElementById('splitResumo').innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span class="text-muted">Total da venda</span><span style="font-weight:700">${Utils.moeda(total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span class="text-muted">Alocado</span><span style="color:var(--success);font-weight:700">${Utils.moeda(alocado)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid var(--border)">
        <span style="font-weight:700">Restante</span>
        <span style="font-weight:800;font-size:15px;color:${ok ? 'var(--success)' : 'var(--danger)'}">${ok ? '✅ OK' : Utils.moeda(restante)}</span>
      </div>`;
  },

  selecionarForma: (forma) => {
    _formaPagamento = forma;
    document.querySelectorAll('.forma-btn').forEach(b => {
      b.classList.toggle('ativo', b.dataset.forma === forma);
    });
    document.getElementById('secaoCrediario').style.display = forma === 'crediario' ? '' : 'none';
    document.getElementById('secaoCartaoCredito').style.display = forma === 'cartao_credito' ? '' : 'none';
    document.getElementById('secaoTroco').style.display = forma === 'dinheiro' ? '' : 'none';
    if (forma === 'crediario') PDV.atualizarParcelas();
    else document.getElementById('creditoInfo').style.display = 'none';
    if (forma === 'cartao_credito') PDV.atualizarParcelasCartao();
    PDV.atualizarTaxaInfo();
  },

  atualizarParcelas: () => {
    const total = _carrinho.reduce((s, i) => s + i.total, 0);
    const num = parseInt(document.getElementById('inputNumeroParcelas').value) || 1;
    const valorParcela = total / num;
    const venc = document.getElementById('inputVencimento1').value;
    const resumo = document.getElementById('crediarioResumo');
    let texto = `${num}x de ${Utils.moeda(valorParcela)}`;
    if (venc) texto += `  ·  1º vencimento: ${Utils.data(venc)}`;
    resumo.textContent = texto;
    resumo.style.display = '';

    // Exibir status do limite de crédito
    const info = document.getElementById('creditoInfo');
    if (_clienteSelecionado) {
      const lc = PDV._limiteCredito(_clienteSelecionado.id, total);
      if (lc.limite > 0) {
        const excede = lc.disponivel < 0;
        const cor = excede ? 'var(--danger)' : lc.disponivel < total ? 'var(--warning)' : 'var(--success)';
        info.style.display = '';
        info.innerHTML = `
          <div style="font-size:12px;padding:8px 10px;border-radius:8px;border:1px solid ${cor};background:${excede ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.04)'}">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:var(--text-muted)">Limite de crédito</span>
              <span style="font-weight:600">${Utils.moeda(lc.limite)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:var(--text-muted)">Já utilizado</span>
              <span style="color:var(--warning);font-weight:600">${Utils.moeda(lc.usado)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid var(--border)">
              <span style="font-weight:600">Disponível após compra</span>
              <span style="font-weight:700;color:${cor}">${Utils.moeda(lc.disponivel)}</span>
            </div>
            ${excede ? `<div style="color:var(--danger);font-size:11px;margin-top:4px;font-weight:600">⚠️ Limite excedido em ${Utils.moeda(-lc.disponivel)}</div>` : ''}
          </div>`;
      } else {
        info.style.display = 'none';
      }
    } else {
      info.style.display = 'none';
    }
  },

  _limiteCredito: (clienteId, novoTotal = 0) => {
    const cliente = DB.Clientes.buscar(clienteId);
    const limite = parseFloat(cliente?.limiteCredito) || 0;
    if (limite === 0) return { limite: 0, usado: 0, disponivel: 0 };
    const usado = DB.Crediario.listar()
      .filter(c => c.clienteId === clienteId)
      .reduce((s, c) => s + c.parcelas.filter(p => p.status !== 'pago').reduce((ps, p) => ps + (parseFloat(p.valor) || 0), 0), 0);
    return { limite, usado, disponivel: limite - usado - novoTotal };
  },

  atualizarParcelasCartao: () => {
    const total = _carrinho.reduce((s, i) => s + i.total, 0);
    const num = parseInt(document.getElementById('inputParcelasCartao').value) || 1;
    const valorParcela = total / num;
    document.getElementById('inputValorParcelaCartao').value = Utils.moeda(valorParcela);
    PDV.atualizarTaxaInfo();
  },

  atualizarTaxaInfo: () => {
    const secao = document.getElementById('secaoTaxaCartao');
    const forma = _formaPagamento;
    if (!forma || forma === 'dinheiro' || forma === 'crediario' || forma === 'multiplo') {
      secao.style.display = 'none';
      return;
    }
    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    const parcelas = forma === 'cartao_credito'
      ? (parseInt(document.getElementById('inputParcelasCartao').value) || 1) : 1;
    const { taxaPct, valorTaxa, valorLiquido } = Utils.infoTaxa(total, forma, parcelas);
    if (taxaPct === 0) { secao.style.display = 'none'; return; }
    secao.style.display = '';
    document.getElementById('taxaPctDisplay').textContent = taxaPct.toFixed(2).replace('.', ',');
    document.getElementById('taxaValorDisplay').textContent = Utils.moeda(valorTaxa);
    document.getElementById('taxaLiquidoDisplay').textContent = Utils.moeda(valorLiquido);
  },

  calcularTroco: () => {
    const total = _carrinho.reduce((s, i) => s + i.total, 0);
    const pago = parseFloat(document.getElementById('inputValorPago').value) || 0;
    const troco = Math.max(0, pago - total);
    document.getElementById('inputTroco').value = Utils.moeda(troco);
  },

  confirmarPagamento: () => {
    if (_modoSplit) { PDV._confirmarSplit(); return; }
    if (!_formaPagamento) { Utils.toast('Selecione a forma de pagamento!', 'warning'); return; }

    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    const valorPago = parseFloat(document.getElementById('inputValorPago').value) || total;
    const troco = Math.max(0, valorPago - total);

    if (_formaPagamento === 'crediario' && !_clienteSelecionado) {
      Utils.toast('Selecione um cliente para crediário!', 'warning');
      return;
    }

    if (_formaPagamento === 'crediario' && _clienteSelecionado) {
      const lc = PDV._limiteCredito(_clienteSelecionado.id, total);
      if (lc.limite > 0 && lc.disponivel < 0) {
        const ok = confirm(
          `⚠️ Limite de crédito excedido!\n\n` +
          `Cliente: ${_clienteSelecionado.nome}\n` +
          `Limite: ${Utils.moeda(lc.limite)}\n` +
          `Saldo em aberto: ${Utils.moeda(lc.usado)}\n` +
          `Esta compra: ${Utils.moeda(total)}\n` +
          `Excede em: ${Utils.moeda(-lc.disponivel)}\n\n` +
          `Deseja autorizar mesmo assim?`
        );
        if (!ok) return;
      }
    }

    // Calcular taxa do cartão
    const _parcSimples = _formaPagamento === 'cartao_credito'
      ? (parseInt(document.getElementById('inputParcelasCartao').value) || 1) : 1;
    const { taxaPct: _taxaPct, valorTaxa: _valorTaxa, valorLiquido: _valorLiquido } =
      Utils.infoTaxa(total, _formaPagamento, _parcSimples);

    // Montar venda
    const venda = {
      itens: _carrinho.map(i => ({ ...i })),
      subtotal,
      desconto: descontoVal > 0 ? { tipo: _desconto.tipo, valor: _desconto.valor, calculado: descontoVal } : null,
      total,
      formaPagamento: _formaPagamento,
      valorPago,
      troco,
      taxaCartao: _taxaPct,
      valorTaxaCartao: _valorTaxa,
      valorLiquido: _valorLiquido,
      clienteId: _clienteSelecionado ? _clienteSelecionado.id : null,
      clienteNome: _clienteSelecionado ? _clienteSelecionado.nome : null,
      vendedorNome: (() => {
        const sel = document.getElementById('selectVendedor');
        return sel ? sel.value || null : null;
      })(),
      vendedorComissao: (() => {
        const sel = document.getElementById('selectVendedor');
        if (!sel || !sel.value) return null;
        const opt = sel.options[sel.selectedIndex];
        return parseFloat(opt.dataset.comissao) || null;
      })(),
    };

    // Atualizar estoque
    _carrinho.forEach(item => {
      if (item.tamanho) {
        DB.Produtos.atualizarEstoque(item.produtoId, item.tamanho, -item.quantidade);
      }
    });

    // Salvar venda
    const vendaSalva = DB.Vendas.salvar(venda);

    // Crediário
    if (_formaPagamento === 'crediario') {
      const numParcelas = parseInt(document.getElementById('inputNumeroParcelas').value) || 1;
      const venc1 = document.getElementById('inputVencimento1').value || Utils.adicionarMeses(Utils.hoje(), 1);
      const valorParcela = parseFloat((total / numParcelas).toFixed(2));
      const parcelas = [];
      for (let i = 0; i < numParcelas; i++) {
        parcelas.push({
          numero: i + 1,
          vencimento: Utils.adicionarMeses(venc1, i),
          valor: valorParcela,
          status: 'pendente'
        });
      }
      DB.Crediario.salvar({
        clienteId: _clienteSelecionado.id,
        clienteNome: _clienteSelecionado.nome,
        vendaId: vendaSalva.id,
        total,
        parcelas
      });
    }

    // Registrar no fluxo de caixa
    if (_formaPagamento !== 'crediario') {
      DB.FluxoCaixa.salvar({
        tipo: 'entrada',
        descricao: `Venda #${vendaSalva.id.substring(0, 8).toUpperCase()}`,
        valor: total,
        categoria: 'venda'
      });
    }

    const clienteTel = _clienteSelecionado ? _clienteSelecionado.telefone : null;

    // Limpar
    _carrinho = [];
    _tamSelecionado = {};
    _clienteSelecionado = null;
    _formaPagamento = '';
    _desconto = { tipo: 'reais', valor: 0 };

    Utils.fecharModal('modalPagamento');
    PDV.renderCarrinho();
    PDV.atualizarClienteDisplay();
    PDV.renderProdutos(document.getElementById('buscaInput').value);
    PDV.verificarCaixaStatus();
    PDV._posVenda(vendaSalva, clienteTel);
  },

  _confirmarSplit: () => {
    if (_formasSplit.length === 0) { Utils.toast('Adicione pelo menos uma forma de pagamento', 'warning'); return; }

    const subtotal = _carrinho.reduce((s, i) => s + i.total, 0);
    const descontoVal = _desconto.tipo === 'pct'
      ? Math.round(subtotal * (_desconto.valor / 100) * 100) / 100
      : Math.min(_desconto.valor, subtotal);
    const total = Math.max(0, subtotal - descontoVal);
    const alocado = Math.round(_formasSplit.reduce((s, f) => s + f.valor, 0) * 100) / 100;

    if (Math.abs(alocado - total) > 0.05) {
      Utils.toast(`Valor alocado (${Utils.moeda(alocado)}) difere do total (${Utils.moeda(total)})`, 'warning');
      return;
    }

    const vendedorSel = document.getElementById('selectVendedor');
    const vendedorNome = vendedorSel ? vendedorSel.value || null : null;
    const vendedorComissao = vendedorSel && vendedorSel.value
      ? (parseFloat(vendedorSel.options[vendedorSel.selectedIndex].dataset.comissao) || null) : null;

    // Taxa por forma no split
    const _formasSplitComTaxa = _formasSplit.map(f => {
      const { taxaPct, valorTaxa } = Utils.infoTaxa(f.valor, f.forma, f.parcelas || 1);
      return { ...f, taxaPct, valorTaxa };
    });
    const _totalTaxaSplit = _formasSplitComTaxa.reduce((s, f) => s + (f.valorTaxa || 0), 0);

    const venda = {
      itens: _carrinho.map(i => ({ ...i })),
      subtotal,
      desconto: descontoVal > 0 ? { tipo: _desconto.tipo, valor: _desconto.valor, calculado: descontoVal } : null,
      total,
      formaPagamento: 'multiplo',
      formasPagamento: _formasSplitComTaxa,
      valorTaxaCartao: Math.round(_totalTaxaSplit * 100) / 100,
      valorLiquido: Math.round((total - _totalTaxaSplit) * 100) / 100,
      clienteId: _clienteSelecionado ? _clienteSelecionado.id : null,
      clienteNome: _clienteSelecionado ? _clienteSelecionado.nome : null,
      vendedorNome,
      vendedorComissao,
    };

    _carrinho.forEach(item => {
      if (item.tamanho) DB.Produtos.atualizarEstoque(item.produtoId, item.tamanho, -item.quantidade);
    });

    const vendaSalva = DB.Vendas.salvar(venda);

    // Gerar crediário para a parte parcelada (se houver)
    const parteCrediario = _formasSplit.filter(f => f.forma === 'crediario');
    parteCrediario.forEach(pc => {
      if (!_clienteSelecionado) return;
      const numParcelas = pc.parcelas || 1;
      const valorParcela = parseFloat((pc.valor / numParcelas).toFixed(2));
      const venc1 = pc.vencimento || Utils.adicionarMeses(Utils.hoje(), 1);
      const parcelas = [];
      for (let i = 0; i < numParcelas; i++) {
        parcelas.push({ numero: i + 1, vencimento: Utils.adicionarMeses(venc1, i), valor: valorParcela, status: 'pendente' });
      }
      DB.Crediario.salvar({
        clienteId: _clienteSelecionado.id,
        clienteNome: _clienteSelecionado.nome,
        vendaId: vendaSalva.id,
        total: pc.valor,
        parcelas
      });
    });

    // Registrar no fluxo apenas a parte que entrou no caixa (não crediário)
    const totalNaoCrediario = _formasSplit.filter(f => f.forma !== 'crediario').reduce((s, f) => s + f.valor, 0);
    if (totalNaoCrediario > 0) {
      DB.FluxoCaixa.salvar({
        tipo: 'entrada',
        descricao: `Venda #${vendaSalva.id.substring(0, 8).toUpperCase()} (pagamento dividido)`,
        valor: totalNaoCrediario,
        categoria: 'venda'
      });
    }

    const clienteTel = _clienteSelecionado ? _clienteSelecionado.telefone : null;

    _carrinho = [];
    _tamSelecionado = {};
    _clienteSelecionado = null;
    _formaPagamento = '';
    _desconto = { tipo: 'reais', valor: 0 };
    _modoSplit = false;
    _formasSplit = [];

    Utils.fecharModal('modalPagamento');
    PDV.renderCarrinho();
    PDV.atualizarClienteDisplay();
    PDV.renderProdutos(document.getElementById('buscaInput').value);
    PDV.verificarCaixaStatus();
    PDV._posVenda(vendaSalva, clienteTel);
  },

  _posVenda: (venda, telefone) => {
    const comp = Utils.gerarComprovante(venda);
    Utils.imprimirComprovante(comp);

    const resumoEl = document.getElementById('posVendaResumo');
    const btnWA = document.getElementById('btnPosVendaWhatsApp');
    const btnImprimir = document.getElementById('btnPosVendaImprimir');
    if (!resumoEl) return; // página sem o modal (ex: abertura direta)

    const nomeCliente = venda.clienteNome ? ` · ${venda.clienteNome}` : '';
    resumoEl.textContent = `${Utils.moeda(venda.total)}${nomeCliente}`;

    btnImprimir.style.display = '';
    btnImprimir.onclick = () => Utils.imprimirComprovante(comp);

    if (telefone) {
      const tel = (telefone || '').replace(/\D/g, '');
      const texto = Utils.gerarTextoWhatsApp(venda);
      btnWA.style.display = '';
      btnWA.onclick = () => window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank');
    } else {
      btnWA.style.display = 'none';
    }

    Utils.abrirModal('modalPosVenda');
  }
};

// ---- FUNÇÕES RECEBER CREDIÁRIO ----
PDV.abrirReceberCrediario = () => {
  _rcClienteSel = null; _rcCredSel = null; _rcParcelaSel = null;
  document.getElementById('rcBuscaInput').value = '';
  document.getElementById('rcResultadoClientes').innerHTML = '';
  document.getElementById('rcBuscaSecao').style.display = '';
  document.getElementById('rcParcelasSecao').style.display = 'none';
  document.getElementById('rcConfirmSecao').style.display = 'none';
  Utils.abrirModal('modalReceberCrediario');
  setTimeout(() => document.getElementById('rcBuscaInput').focus(), 200);
};

PDV.rcBuscarCliente = (termo) => {
  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const t = norm(termo);
  const temNum = /\d/.test(termo);
  if (!t || t.length < 2) { document.getElementById('rcResultadoClientes').innerHTML = ''; return; }

  const clientes = DB.Clientes.listar().filter(c => {
    try {
      return norm(c.nome).includes(t) ||
        (temNum && c.cpf && c.cpf.replace(/\D/g,'').includes(t.replace(/\D/g,'')));
    } catch(e) { return false; }
  }).slice(0, 10);

  if (clientes.length === 0) {
    document.getElementById('rcResultadoClientes').innerHTML = '<div class="text-muted fs-sm" style="padding:8px">Nenhum cliente encontrado</div>';
    return;
  }

  document.getElementById('rcResultadoClientes').innerHTML = clientes.map(c => `
    <div onclick="PDV.rcSelecionarCliente('${c.id}')"
      style="padding:10px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:6px;background:var(--card-bg)"
      onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="font-weight:600">${c.nome}</div>
      <div class="text-muted fs-sm">${c.cpf ? Utils.cpf(c.cpf) + ' · ' : ''}${c.telefone || ''}</div>
    </div>`).join('');
};

PDV.rcSelecionarCliente = (clienteId) => {
  _rcClienteSel = DB.Clientes.buscar(clienteId);
  if (!_rcClienteSel) return;

  const crediarios = DB.Crediario.listar().filter(c => c.clienteId === clienteId);
  // Busca também por nome (para importados do Tiny)
  const porNome = DB.Crediario.listar().filter(c =>
    !c.clienteId && c.clienteNome &&
    c.clienteNome.toLowerCase().trim() === _rcClienteSel.nome.toLowerCase().trim()
  );
  const todos = [...crediarios, ...porNome];

  // Coleta parcelas pendentes de todos os crediários
  const parcelas = [];
  todos.forEach(cred => {
    cred.parcelas.forEach((p, idx) => {
      if (p.status === 'pago') return;
      const { diasAtraso, diasJuros, juros } = rcCalcJuros(p.vencimento, p.valor);
      parcelas.push({
        credId: cred.id,
        parcelaIdx: idx,
        clienteNome: cred.clienteNome,
        numero: p.numero || (idx + 1),
        total: cred.parcelas.length,
        vencimento: p.vencimento,
        valor: parseFloat(p.valor) || 0,
        diasAtraso, diasJuros, juros,
        status: Utils.statusParcela(p.vencimento, p.status)
      });
    });
  });

  parcelas.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  document.getElementById('rcClienteNome').textContent = _rcClienteSel.nome;
  document.getElementById('rcClienteInfo').textContent =
    `${_rcClienteSel.cpf ? Utils.cpf(_rcClienteSel.cpf) + ' · ' : ''}${parcelas.length} parcela(s) pendente(s)`;

  if (parcelas.length === 0) {
    document.getElementById('rcParcelasList').innerHTML = `
      <div class="empty-state" style="padding:20px">
        <div class="empty-icon">✅</div>
        <div class="empty-title">Nenhuma parcela pendente</div>
        <div class="empty-sub">Este cliente está em dia!</div>
      </div>`;
  } else {
    document.getElementById('rcParcelasList').innerHTML = parcelas.map((p, i) => {
      const atrasado = p.status === 'atrasado';
      const temJuros = p.juros > 0;
      const corBorda = atrasado ? 'var(--danger)' : p.status === 'pendente' && p.diasAtraso === 0 ? 'var(--success)' : 'var(--warning)';
      return `
        <div onclick="PDV.rcSelecionarParcela(${i})" data-idx="${i}"
          style="padding:12px 14px;border-radius:10px;cursor:pointer;border:1px solid ${corBorda};margin-bottom:8px;background:var(--card-bg)"
          onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:600">Parcela ${p.numero}/${p.total}</div>
              <div class="text-muted fs-sm">Vence: ${Utils.data(p.vencimento)}
                ${atrasado ? `<span style="color:var(--danger);font-weight:600"> · ${p.diasAtraso} dias em atraso</span>` : ''}
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700;font-size:16px">${Utils.moeda(p.valor + p.juros)}</div>
              ${temJuros ? `<div style="font-size:11px;color:var(--danger)">+${Utils.moeda(p.juros)} juros</div>` : ''}
              ${!temJuros && atrasado ? `<div style="font-size:11px;color:var(--warning)">Dentro da carência</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    // guarda para acesso posterior
    PDV._rcParcelas = parcelas;
  }

  document.getElementById('rcBuscaSecao').style.display = 'none';
  document.getElementById('rcParcelasSecao').style.display = '';
};

PDV._rcParcelas = [];

PDV.rcSelecionarParcela = (i) => {
  const p = PDV._rcParcelas[i];
  if (!p) return;
  _rcParcelaSel = p;
  _rcCredSel = DB.Crediario.buscar(p.credId);

  document.getElementById('rcConfirmTitulo').textContent =
    `Parcela ${p.numero}/${p.total} — Venc. ${Utils.data(p.vencimento)}`;
  document.getElementById('rcValorOriginal').textContent = Utils.moeda(p.valor);

  const jurosBloco = document.getElementById('rcJurosBloco');
  if (p.diasJuros > 0) {
    jurosBloco.style.display = '';
    document.getElementById('rcJurosTitulo').textContent =
      `Juros (${p.diasJuros} dias × 0,4%)`;
    document.getElementById('rcJurosValor').textContent = Utils.moeda(p.juros);
    document.getElementById('rcJurosInput').value = p.juros.toFixed(2);
  } else {
    jurosBloco.style.display = 'none';
    document.getElementById('rcJurosInput').value = '0';
  }

  const total = p.valor + p.juros;
  document.getElementById('rcTotal').textContent = Utils.moeda(total);
  document.getElementById('rcRecebido').value = total.toFixed(2);
  document.getElementById('rcTrocoBloco').style.display = 'none';
  document.getElementById('rcParcelasSecao').style.display = 'none';
  document.getElementById('rcConfirmSecao').style.display = '';
  setTimeout(() => document.getElementById('rcRecebido').select(), 100);
};

PDV.rcAtualizarTotal = () => {
  if (!_rcParcelaSel) return;
  const juros = parseFloat(document.getElementById('rcJurosInput').value) || 0;
  const total = _rcParcelaSel.valor + juros;
  document.getElementById('rcTotal').textContent = Utils.moeda(total);
  document.getElementById('rcRecebido').value = total.toFixed(2);
  PDV.rcAtualizarRecebido();
};

PDV.rcAtualizarRecebido = () => {
  if (!_rcParcelaSel) return;
  const juros = parseFloat(document.getElementById('rcJurosInput')?.value) || 0;
  const total = _rcParcelaSel.valor + juros;
  const recebido = parseFloat(document.getElementById('rcRecebido').value) || 0;
  const bloco = document.getElementById('rcTrocoBloco');
  const label = document.getElementById('rcTrocoLabel');
  const diff = recebido - total;
  if (recebido <= 0) { bloco.style.display = 'none'; return; }
  bloco.style.display = '';
  if (diff > 0.009) {
    bloco.style.background = 'rgba(59,130,246,0.1)';
    bloco.style.border = '1px solid var(--primary)';
    label.style.color = 'var(--primary)';
    label.textContent = `Troco: ${Utils.moeda(diff)}`;
  } else if (diff < -0.009) {
    bloco.style.background = 'rgba(239,68,68,0.08)';
    bloco.style.border = '1px solid var(--danger)';
    label.style.color = 'var(--danger)';
    label.textContent = `Saldo restante na parcela: ${Utils.moeda(Math.abs(diff))}`;
  } else {
    bloco.style.background = 'rgba(34,197,94,0.1)';
    bloco.style.border = '1px solid var(--success)';
    label.style.color = 'var(--success)';
    label.textContent = 'Pagamento exato ✓';
  }
};

PDV.rcVoltarBusca = () => {
  document.getElementById('rcBuscaSecao').style.display = '';
  document.getElementById('rcParcelasSecao').style.display = 'none';
};

PDV.rcVoltarParcelas = () => {
  document.getElementById('rcParcelasSecao').style.display = '';
  document.getElementById('rcConfirmSecao').style.display = 'none';
};

PDV.rcConfirmarPagamento = () => {
  if (!_rcParcelaSel || !_rcCredSel) return;
  const juros = parseFloat(document.getElementById('rcJurosInput').value) || 0;
  const totalDevido = _rcParcelaSel.valor + juros;
  const recebido = parseFloat(document.getElementById('rcRecebido').value) || 0;
  const forma = document.getElementById('rcFormaPagamento').value;
  const formaLabel = { dinheiro: 'Dinheiro', pix: 'PIX', cartao_debito: 'Débito', cartao_credito: 'Crédito' }[forma] || forma;

  if (recebido <= 0) { Utils.toast('Informe o valor recebido', 'error'); return; }

  if (recebido >= totalDevido - 0.009) {
    // Pagamento completo
    DB.Crediario.pagarParcela(_rcCredSel.id, _rcParcelaSel.parcelaIdx);
    DB.FluxoCaixa.salvar({
      tipo: 'entrada',
      descricao: `Crediário (${formaLabel}) - ${_rcParcelaSel.clienteNome} - Parcela ${_rcParcelaSel.numero}/${_rcParcelaSel.total}${juros > 0 ? ' + juros' : ''}`,
      valor: totalDevido,
      categoria: 'crediario'
    });
    const troco = recebido - totalDevido;
    // Imprime comprovante
    const linhas = [
      '================================',
      '       MOVE PÉ CALÇADOS         ',
      '================================',
      `CLIENTE: ${_rcParcelaSel.clienteNome}`,
      `PARCELA: ${_rcParcelaSel.numero}/${_rcParcelaSel.total}`,
      `VENCIMENTO: ${Utils.data(_rcParcelaSel.vencimento)}`,
      `RECEBIDO EM: ${Utils.data(new Date().toISOString())}`,
      `FORMA: ${formaLabel}`,
      '--------------------------------',
      `VALOR: ${Utils.moeda(_rcParcelaSel.valor)}`,
      juros > 0 ? `JUROS: ${Utils.moeda(juros)}` : null,
      `TOTAL RECEBIDO: ${Utils.moeda(totalDevido)}`,
      troco > 0.01 ? `TROCO: ${Utils.moeda(troco)}` : null,
      '================================',
      '   Obrigado pela preferência!   ',
      '================================'
    ].filter(Boolean).join('\n');
    Utils.fecharModal('modalReceberCrediario');
    Utils.toast(troco > 0.01 ? `Parcela recebida! Troco: ${Utils.moeda(troco)}` : `Parcela recebida: ${Utils.moeda(totalDevido)}`, 'success');
    Utils.imprimirComprovante(linhas);
  } else {
    // Pagamento parcial
    const saldo = totalDevido - recebido;
    if (!confirm(`Pagamento parcial de ${Utils.moeda(recebido)}.\nSaldo restante: ${Utils.moeda(saldo)}\n\nConfirmar abatimento?`)) return;
    const lista = DB.Crediario.listar();
    const credObj = lista.find(c => c.id === _rcCredSel.id);
    credObj.parcelas[_rcParcelaSel.parcelaIdx].valor = saldo.toFixed(2);
    DB.Crediario.salvar(credObj);
    DB.FluxoCaixa.salvar({
      tipo: 'entrada',
      descricao: `Crediário (${formaLabel}) - ${_rcParcelaSel.clienteNome} - Abatimento parcela ${_rcParcelaSel.numero}/${_rcParcelaSel.total} (saldo: ${Utils.moeda(saldo)})`,
      valor: recebido,
      categoria: 'crediario'
    });
    Utils.fecharModal('modalReceberCrediario');
    Utils.toast(`Abatimento de ${Utils.moeda(recebido)} registrado. Saldo: ${Utils.moeda(saldo)}`, 'success');
  }
  _rcParcelaSel = null; _rcCredSel = null; _rcClienteSel = null;
};

document.addEventListener('DOMContentLoaded', PDV.init);
document.addEventListener('movePe-sync', (e) => {
  PDV.verificarCaixaStatus();
  if (!e.detail || e.detail.col === 'produtos') {
    const busca = document.getElementById('buscaInput');
    PDV.renderProdutos(busca ? busca.value : '');
  }
});
