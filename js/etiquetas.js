/**
 * MOVE PÉ — Etiquetas com Código de Barras
 * Impressão para impressora Argox (ou qualquer térmica)
 */

let _produtoAtivo = null;
let _varSelecionadas = {}; // { chave: qtd }
let _todosProdutos = [];

const Etiquetas = {

  init: () => {
    Utils.renderNav('etiquetas.html');
    _todosProdutos = DB.Produtos.listar().filter(p => p.ativo !== false);
    Etiquetas.renderLista(_todosProdutos);
  },

  // ---- GERAR CÓDIGO DE BARRAS DA VARIAÇÃO ----
  // Usa o codigoBarras do produto como base, acrescenta o tamanho
  // Formato: se produto tem EAN/código → usa direto
  //          senão → gera a partir do ID + tamanho (Code128)
  gerarCodigo: (produto, varChave) => {
    const [tam] = varChave.split('||');
    // Se produto tem código de barras manual definido, usa + tamanho
    if (produto.codigoBarras) {
      return (produto.codigoBarras + tam).replace(/[^A-Za-z0-9]/g, '').substring(0, 20);
    }
    // Gera automaticamente: ID curto + tamanho
    const idCurto = produto.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 8);
    return (idCurto + tam.replace(/\D/g, '')).substring(0, 20);
  },

  // ---- LISTA DE PRODUTOS ----
  renderLista: (prods) => {
    const cont = document.getElementById('listaProdutos');
    if (!prods.length) {
      cont.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">Nenhum produto encontrado</div>';
      return;
    }
    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ');
    cont.innerHTML = prods.map(p => {
      const vars = Object.keys(p.variacoes || {}).length;
      const ativo = _produtoAtivo && _produtoAtivo.id === p.id;
      return `
        <div class="prod-etiq-item ${ativo ? 'ativo' : ''}" onclick="Etiquetas.selecionarProduto('${p.id}')">
          ${p.foto
            ? `<img src="${p.foto}" class="prod-etiq-foto">`
            : `<div class="prod-etiq-foto" style="display:flex;align-items:center;justify-content:center;font-size:20px">👟</div>`}
          <div style="flex:1;min-width:0">
            <div class="prod-etiq-nome">${p.nome}</div>
            <div class="prod-etiq-sub">${p.marca || ''} · ${vars} variação(ões) · ${Utils.moeda(p.precoVenda)}</div>
          </div>
        </div>`;
    }).join('');
  },

  filtrar: (termo) => {
    if (!termo.trim()) { Etiquetas.renderLista(_todosProdutos); return; }
    const t = termo.toLowerCase();
    const filtrados = _todosProdutos.filter(p =>
      (p.nome || '').toLowerCase().includes(t) ||
      (p.sku || '').toLowerCase().includes(t) ||
      (p.codigoBarras || '').includes(t) ||
      (p.marca || '').toLowerCase().includes(t)
    );
    Etiquetas.renderLista(filtrados);
  },

  // ---- SELECIONAR PRODUTO ----
  selecionarProduto: (id) => {
    _produtoAtivo = DB.Produtos.buscar(id);
    if (!_produtoAtivo) return;
    _varSelecionadas = {};

    document.getElementById('cardVariacoes').style.display = '';
    document.getElementById('varTitulo').textContent = `Variações — ${_produtoAtivo.nome}`;

    // Marca automaticamente as que têm estoque
    const vars = _produtoAtivo.variacoes || {};
    Object.entries(vars).forEach(([chave, estoque]) => {
      if (estoque > 0) _varSelecionadas[chave] = 1;
    });

    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
    Etiquetas.renderLista(_todosProdutos.filter(p => {
      const t = document.getElementById('inputBuscaProd').value.toLowerCase();
      return !t || (p.nome || '').toLowerCase().includes(t) || (p.marca || '').toLowerCase().includes(t);
    }));
  },

  renderVariacoes: () => {
    const vars = _produtoAtivo.variacoes || {};
    const grid = document.getElementById('varGrid');
    grid.innerHTML = Object.entries(vars).sort(([a], [b]) => {
      const [ta] = a.split('||'); const [tb] = b.split('||');
      return (parseFloat(ta) || 0) - (parseFloat(tb) || 0);
    }).map(([chave, estoque]) => {
      const [tam, cor] = chave.split('||');
      const label = cor && cor !== 'undefined' ? `${tam} — ${cor}` : `Tam. ${tam}`;
      const sel = !!_varSelecionadas[chave];
      const qtd = _varSelecionadas[chave] || 1;
      return `
        <div class="var-chip-etiq ${sel ? 'sel' : ''}" id="varchip_${btoa(chave).replace(/[^a-z0-9]/gi,'')}"
             onclick="Etiquetas.toggleVar('${chave.replace(/'/g, "\\'")}')">
          <span>${label}</span>
          <span style="font-size:11px;color:var(--text-muted)">(est: ${estoque})</span>
          ${sel ? `<input type="number" value="${qtd}" min="1" max="999"
            onclick="event.stopPropagation()"
            onchange="Etiquetas.setQtd('${chave.replace(/'/g, "\\'")}', this.value)"
            style="width:44px">` : ''}
        </div>`;
    }).join('');
  },

  toggleVar: (chave) => {
    if (_varSelecionadas[chave]) {
      delete _varSelecionadas[chave];
    } else {
      _varSelecionadas[chave] = 1;
    }
    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
  },

  setQtd: (chave, val) => {
    _varSelecionadas[chave] = Math.max(1, parseInt(val) || 1);
    Etiquetas.renderPreview();
  },

  selecionarTodos: () => {
    Object.keys(_produtoAtivo.variacoes || {}).forEach(k => {
      if (!_varSelecionadas[k]) _varSelecionadas[k] = 1;
    });
    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
  },

  selecionarComEstoque: () => {
    _varSelecionadas = {};
    Object.entries(_produtoAtivo.variacoes || {}).forEach(([k, v]) => {
      if (v > 0) _varSelecionadas[k] = 1;
    });
    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
  },

  limparTodos: () => {
    _varSelecionadas = {};
    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
  },

  aplicarQtdPadrao: () => {
    const qtd = parseInt(document.getElementById('inputQtdPadrao').value) || 1;
    Object.keys(_varSelecionadas).forEach(k => { _varSelecionadas[k] = qtd; });
    Etiquetas.renderVariacoes();
    Etiquetas.renderPreview();
  },

  // ---- RENDER PREVIEW ----
  renderPreview: () => {
    const wrap = document.getElementById('previewWrap');
    const tamanho = document.getElementById('selTamanho').value;
    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ').toUpperCase();

    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      wrap.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;width:100%">Selecione as variações para ver o preview</div>';
      document.getElementById('totalEtiquetas').textContent = '';
      return;
    }

    let totalEtiq = 0;
    const etiquetas = [];

    Object.entries(_varSelecionadas).forEach(([chave, qtd]) => {
      const [tam, cor] = chave.split('||');
      const varLabel = cor && cor !== 'undefined' ? `Tam ${tam} · ${cor}` : `Tam ${tam}`;
      const codigo = Etiquetas.gerarCodigo(_produtoAtivo, chave);

      for (let i = 0; i < qtd; i++) {
        totalEtiq++;
        const uid = `bc_${totalEtiq}_${Date.now()}`;
        etiquetas.push({ uid, tam, cor, varLabel, codigo, qtd });
      }
    });

    document.getElementById('totalEtiquetas').textContent = `${totalEtiq} etiqueta(s)`;

    wrap.innerHTML = etiquetas.map(e => `
      <div class="etiq sz-${tamanho}">
        <div class="etiq-loja">${nomeLoja}</div>
        <div class="etiq-nome">${_produtoAtivo.nome}</div>
        <div class="etiq-var">${e.varLabel}</div>
        <div class="etiq-preco">${Utils.moeda(_produtoAtivo.precoVenda)}</div>
        <div class="etiq-bc">
          <svg id="${e.uid}"></svg>
        </div>
        <div class="etiq-bc-num">${e.codigo}</div>
      </div>`).join('');

    // Gera os barcodes
    const sz = { '40x25': 35, '50x30': 42, '60x40': 55, '80x40': 70 };
    const w = sz[tamanho] || 55;

    etiquetas.forEach(e => {
      try {
        JsBarcode(`#${e.uid}`, e.codigo, {
          format: 'CODE128',
          width: 1.2,
          height: w,
          displayValue: false,
          margin: 0,
        });
      } catch(err) {
        document.getElementById(e.uid).outerHTML = `<span style="font-size:9px;color:red">Código inválido</span>`;
      }
    });
  },

  // ---- IMPRIMIR ----
  imprimir: () => {
    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      Utils.toast('Selecione um produto e as variações', 'error');
      return;
    }
    window.print();
  },

};

document.addEventListener('DOMContentLoaded', Etiquetas.init);
