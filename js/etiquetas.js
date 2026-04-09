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
  // Etiqueta fixa: 5,5cm x 2,5cm | 2 colunas | gap 0,5cm | margem esq 0,2cm (igual Tiny/Argox)
  renderPreview: () => {
    const wrap = document.getElementById('previewWrap');
    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ').toUpperCase();

    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      wrap.innerHTML = `<div style="grid-column:span 2;color:var(--text-muted);text-align:center;padding:40px;background:#fff;border-radius:6px">
        Selecione as variações para ver o preview</div>`;
      document.getElementById('totalEtiquetas').textContent = '';
      return;
    }

    let totalEtiq = 0;
    const etiquetas = [];

    // Ordena por tamanho numérico
    const entradasOrdenadas = Object.entries(_varSelecionadas).sort(([a], [b]) => {
      const [ta] = a.split('||'); const [tb] = b.split('||');
      return (parseFloat(ta) || 0) - (parseFloat(tb) || 0);
    });

    entradasOrdenadas.forEach(([chave, qtd]) => {
      const [tam, cor] = chave.split('||');
      const varLabel = cor && cor !== 'undefined' && cor !== 'null' ? `Tam ${tam}  ${cor}` : `Tam ${tam}`;
      const codigo = Etiquetas.gerarCodigo(_produtoAtivo, chave);

      for (let i = 0; i < qtd; i++) {
        totalEtiq++;
        const uid = `bc_${totalEtiq}_${Math.random().toString(36).substr(2,5)}`;
        etiquetas.push({ uid, tam, cor, varLabel, codigo });
      }
    });

    document.getElementById('totalEtiquetas').textContent = `${totalEtiq} etiqueta(s)`;

    // Trunca nome do produto para caber na etiqueta (5,5cm)
    const nomeExibicao = _produtoAtivo.nome.length > 28
      ? _produtoAtivo.nome.substring(0, 26) + '…'
      : _produtoAtivo.nome;

    wrap.innerHTML = etiquetas.map(e => `
      <div class="etiq">
        <div class="etiq-loja">${nomeLoja}</div>
        <div class="etiq-nome">${nomeExibicao}</div>
        <div class="etiq-row">
          <div class="etiq-var">${e.varLabel}</div>
          <div class="etiq-preco">${Utils.moeda(_produtoAtivo.precoVenda)}</div>
        </div>
        <div class="etiq-bc"><svg id="${e.uid}"></svg></div>
        <div class="etiq-bc-num">${e.codigo}</div>
      </div>`).join('');

    // Barcode: altura 22px cabe bem em 2,5cm com todo o conteúdo
    etiquetas.forEach(e => {
      try {
        JsBarcode(`#${e.uid}`, e.codigo, {
          format: 'CODE128',
          width: 1,
          height: 22,
          displayValue: false,
          margin: 0,
        });
      } catch(err) {
        const el = document.getElementById(e.uid);
        if (el) el.outerHTML = `<span style="font-size:7px;color:red">Código inválido</span>`;
      }
    });
  },

  // ---- IMPRIMIR ----
  // Abre janela limpa só com as etiquetas para evitar desalinhamento
  imprimir: () => {
    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      Utils.toast('Selecione um produto e as variações', 'error');
      return;
    }

    const labelsHtml = document.getElementById('previewWrap').innerHTML;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box;
      -webkit-print-color-adjust:exact !important;
      print-color-adjust:exact !important; }
  @page {
    size: 10.2cm 2.5cm;
    margin: 0;
  }
  body { margin:0; padding:0; background:#fff; }
  .preview-screen {
    display: grid;
    grid-template-columns: 5cm 5cm;
    column-gap: 0.2cm;
    row-gap: 0.2cm;
    padding: 0;
    margin: 0;
  }
  .etiq {
    width: 5cm;
    height: 2.5cm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5mm 1.5mm;
    background: #fff;
    color: #000;
    font-family: Arial, sans-serif;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .etiq-loja  { font-size:6pt; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#444; line-height:1.1; }
  .etiq-nome  { font-size:7pt; font-weight:700; text-align:center; line-height:1.2; width:100%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .etiq-row   { display:flex; justify-content:space-between; align-items:baseline; width:100%; }
  .etiq-var   { font-size:6.5pt; color:#333; }
  .etiq-preco { font-size:10pt; font-weight:900; }
  .etiq-bc    { line-height:0; margin:0; }
  .etiq-bc-num { font-size:5.5pt; color:#555; font-family:monospace; letter-spacing:.03em; }
</style>
</head>
<body>
<div class="preview-screen">${labelsHtml}</div>
<script>
  window.onload = function() {
    setTimeout(function() { window.print(); window.close(); }, 400);
  };
<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=600,height=400');
    win.document.open();
    win.document.write(html);
    win.document.close();
  },

};

document.addEventListener('DOMContentLoaded', Etiquetas.init);
