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

  // ---- IMPRIMIR — gera PDF com jsPDF (dimensões exatas em mm) ----
  imprimir: () => {
    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      Utils.toast('Selecione um produto e as variações', 'error');
      return;
    }

    // Dimensões Tiny ERP: etiqueta 55x25mm, pitch 60mm → gap 5mm, margem esq 2mm
    const d = { w: 55, h: 25, gap: 5, marginL: 2, cols: 2 };
    const pageW = d.marginL + d.cols * d.w + (d.cols - 1) * d.gap; // 117mm

    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ').toUpperCase();
    const nomeProd = _produtoAtivo.nome.length > 28
      ? _produtoAtivo.nome.substring(0, 26) + '…'
      : _produtoAtivo.nome;
    const preco = Utils.moeda(_produtoAtivo.precoVenda);

    // Monta lista de etiquetas ordenada
    const lista = [];
    Object.entries(_varSelecionadas)
      .sort(([a], [b]) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
      .forEach(([chave, qtd]) => {
        const [tam, cor] = chave.split('||');
        const varLabel = cor && cor !== 'undefined' && cor !== 'null'
          ? `Tam ${tam} - ${cor}` : `Tam ${tam}`;
        const codigo = Etiquetas.gerarCodigo(_produtoAtivo, chave);
        for (let i = 0; i < qtd; i++) lista.push({ varLabel, codigo });
      });

    // Cria PDF com página de tamanho exato (117 x 25mm)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [d.h, pageW] });

    // Função que desenha uma etiqueta no PDF a partir de (x, y)
    const desenharEtiqueta = (x, y, etiq) => {
      // Gera barcode em canvas
      const canvas = document.createElement('canvas');
      try {
        JsBarcode(canvas, etiq.codigo, {
          format: 'CODE128', width: 2, height: 40,
          displayValue: false, margin: 0,
        });
      } catch(e) { /* código inválido */ }

      // --- Conteúdo ---
      // Nome da loja (esq) + preço (dir)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.setTextColor(80, 80, 80);
      doc.text(nomeLoja, x + 1, y + 3.5);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(preco, x + d.w - 1, y + 4, { align: 'right' });

      // Nome do produto
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(nomeProd, x + d.w / 2, y + 8, { align: 'center', maxWidth: d.w - 2 });

      // Barcode (imagem do canvas)
      if (canvas.width > 0) {
        const bcW = d.w - 4;
        const bcH = 9;
        const bcX = x + (d.w - bcW) / 2;
        const bcY = y + 10;
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', bcX, bcY, bcW, bcH);
      }

      // Variação (esq) + código (dir)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(60, 60, 60);
      doc.text(etiq.varLabel, x + 1, y + d.h - 1.5);
      doc.text(etiq.codigo,   x + d.w - 1, y + d.h - 1.5, { align: 'right' });
    };

    // Preenche páginas com 2 etiquetas por linha
    for (let i = 0; i < lista.length; i += d.cols) {
      if (i > 0) doc.addPage([d.h, pageW], 'l');
      for (let col = 0; col < d.cols; col++) {
        if (i + col < lista.length) {
          const x = d.marginL + col * (d.w + d.gap);
          desenharEtiqueta(x, 0, lista[i + col]);
        }
      }
    }

    // Abre PDF em nova aba para o usuário revisar e imprimir
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

};

document.addEventListener('DOMContentLoaded', Etiquetas.init);
