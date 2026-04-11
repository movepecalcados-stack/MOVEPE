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
    Etiquetas.carregarConfig();
  },

  // ---- GERAR CÓDIGO DE BARRAS DA VARIAÇÃO ----
  // Usa o codigoBarras do produto como base, acrescenta o tamanho
  // Formato: se produto tem EAN/código → usa direto
  //          senão → gera a partir do ID + tamanho (Code128)
  // Hash de 2 chars para a variação (tamanho + cor) — único por combinação, código curto
  _hashVar: (tam, cor) => {
    const s = (tam + (cor && cor !== 'undefined' && cor !== 'null' ? cor : ''))
      .replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) % 1296;
    const c = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return c[Math.floor(h / 36)] + c[h % 36];
  },

  gerarCodigo: (produto, varChave) => {
    const [tam, cor] = varChave.split('||');
    const vh = Etiquetas._hashVar(tam, cor);
    // ID curto do produto (6 chars) + hash da variação (2 chars) = 8 chars total
    // Curto = barras largas = leitura confiável em qualquer scanner
    const idCurto = produto.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase().substring(0, 6);
    return idCurto + vh;
  },

  // ---- LISTA DE PRODUTOS ----
  renderLista: (prods) => {
    const cont = document.getElementById('listaProdutos');
    if (!prods.length) {
      cont.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">Nenhum produto encontrado</div>';
      return;
    }
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
      if (estoque > 0) _varSelecionadas[chave] = estoque;
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
      const fotoVar = cor && _produtoAtivo.fotosVariacoes && _produtoAtivo.fotosVariacoes[cor.toLowerCase()]
        ? `<img src="${_produtoAtivo.fotosVariacoes[cor.toLowerCase()]}" style="width:30px;height:30px;object-fit:cover;border-radius:4px;flex-shrink:0">`
        : '';
      return `
        <div class="var-chip-etiq ${sel ? 'sel' : ''}" id="varchip_${chave.replace(/[^a-z0-9]/gi,'_')}"
             onclick="Etiquetas.toggleVar('${chave.replace(/'/g, "\\'")}')">
          ${fotoVar}
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
      if (v > 0) _varSelecionadas[k] = v;
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

  // ---- SALVAR / CARREGAR CONFIGURAÇÃO ----
  salvarConfig: () => {
    localStorage.setItem('movePe_etiqConfig', JSON.stringify(Etiquetas._cfg()));
    Utils.toast('Configuração salva!', 'success');
  },

  carregarConfig: () => {
    const raw = localStorage.getItem('movePe_etiqConfig');
    if (!raw) return;
    try {
      const cfg = JSON.parse(raw);
      const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
      const chk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };
      set('cfgPageW',   cfg.pageW);
      set('cfgW',       cfg.w);
      set('cfgH',       cfg.h);
      set('cfgGap',     cfg.gap);
      set('cfgMarginL', cfg.marginL);
      set('cfgMarginR', cfg.marginR);
      set('cfgBcH',     cfg.bcH);
      set('cfgBcW',     cfg.bcW);
      set('cfgBcX',     cfg.bcX);
      chk('cfgShowLoja',   cfg.showLoja);
      chk('cfgShowNome',   cfg.showNome);
      chk('cfgShowPreco',  cfg.showPreco);
      chk('cfgShowVar',    cfg.showVar);
      chk('cfgShowCodNum', cfg.showCodNum);
    } catch(e) { /* ignora se corrompido */ }
  },

  resetConfig: () => {
    localStorage.removeItem('movePe_etiqConfig');
    // Restaura valores padrão
    document.getElementById('cfgPageW').value   = 100;
    document.getElementById('cfgW').value       = 44;
    document.getElementById('cfgH').value       = 25;
    document.getElementById('cfgGap').value     = 0.3;
    document.getElementById('cfgMarginL').value = 0;
    document.getElementById('cfgMarginR').value = 0;
    document.getElementById('cfgBcH').value     = 9;
    document.getElementById('cfgBcW').value     = 40;
    document.getElementById('cfgBcX').value     = 0;
    document.getElementById('cfgShowLoja').checked   = true;
    document.getElementById('cfgShowNome').checked   = true;
    document.getElementById('cfgShowPreco').checked  = true;
    document.getElementById('cfgShowVar').checked    = true;
    document.getElementById('cfgShowCodNum').checked = true;
    Etiquetas.renderPreview();
    Utils.toast('Configuração restaurada ao padrão', 'info');
  },

  // ---- PRESET → preenche campos ----
  aplicarPreset: () => {
    const presets = {
      '55x25': { pageW: 100, w: 44, h: 25, gap: 0.3, marginL: 0, marginR: 0, bcH: 9,  bcW: 40, bcX: 0 },
      '50x25': { pageW: 100, w: 39, h: 25, gap: 0.3, marginL: 0, marginR: 0, bcH: 9,  bcW: 35, bcX: 0 },
      '40x25': { pageW: 100, w: 29, h: 25, gap: 0.3, marginL: 0, marginR: 0, bcH: 9,  bcW: 25, bcX: 0 },
      '50x30': { pageW: 100, w: 39, h: 30, gap: 0.3, marginL: 0, marginR: 0, bcH: 11, bcW: 35, bcX: 0 },
      '60x40': { pageW: 120, w: 49, h: 40, gap: 0.3, marginL: 0, marginR: 0, bcH: 15, bcW: 45, bcX: 0 },
      '80x40': { pageW: 160, w: 69, h: 40, gap: 0.3, marginL: 0, marginR: 0, bcH: 15, bcW: 65, bcX: 0 },
    };
    const val = document.getElementById('selTamanho').value;
    const p = presets[val] || presets['55x25'];
    document.getElementById('cfgPageW').value  = p.pageW;
    document.getElementById('cfgW').value      = p.w;
    document.getElementById('cfgH').value      = p.h;
    document.getElementById('cfgGap').value    = p.gap;
    document.getElementById('cfgMarginL').value = p.marginL;
    document.getElementById('cfgMarginR').value = p.marginR;
    document.getElementById('cfgBcH').value    = p.bcH;
    document.getElementById('cfgBcW').value    = p.bcW;
    document.getElementById('cfgBcX').value    = p.bcX;
    Etiquetas.renderPreview();
  },

  // Lê os campos de configuração atuais
  _cfg: () => {
    const pf = (id, def) => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? def : v; };
    const ck = (id) => document.getElementById(id)?.checked ?? true;
    return {
    pageW:      pf('cfgPageW', 100),
    w:          pf('cfgW',     44),
    h:          pf('cfgH',     25),
    gap:        pf('cfgGap',   0.3),
    marginL:    pf('cfgMarginL', 0),
    marginR:    pf('cfgMarginR', 0),
    bcH:        pf('cfgBcH',   9),
    bcW:        pf('cfgBcW',   40),
    bcX:        pf('cfgBcX',   0),
    showLoja:   ck('cfgShowLoja'),
    showNome:   ck('cfgShowNome'),
    showPreco:  ck('cfgShowPreco'),
    showVar:    ck('cfgShowVar'),
    showCodNum: ck('cfgShowCodNum'),
    cols: 2,
  };},

  // ---- RENDER PREVIEW ----
  renderPreview: () => {
    const wrap = document.getElementById('previewWrap');
    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ').toUpperCase();

    if (!_produtoAtivo || !Object.keys(_varSelecionadas).length) {
      wrap.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;width:100%">Selecione as variações para ver o preview</div>';
      document.getElementById('totalEtiquetas').textContent = '';
      return;
    }

    const d = Etiquetas._cfg();
    // Escala visual: 1mm ≈ 3.78px × 1.5 para preview maior
    const PX = 3.78 * 1.5;
    const pxW = Math.round(d.w * PX);
    const pxH = Math.round(d.h * PX);
    const bcHeightPx = Math.round(d.bcH * PX);

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
      <div class="etiq" style="width:${pxW}px;height:${pxH}px">
        ${d.showLoja  ? `<div class="etiq-loja">${nomeLoja}</div>` : ''}
        ${d.showNome  ? `<div class="etiq-nome">${_produtoAtivo.nome}</div>` : ''}
        ${d.showVar   ? `<div class="etiq-var">${e.varLabel}</div>` : ''}
        ${d.showPreco ? `<div class="etiq-preco">${Utils.moeda(_produtoAtivo.precoVenda)}</div>` : ''}
        <div class="etiq-bc" style="height:${bcHeightPx}px;width:${Math.round(d.bcW*PX)}px;margin-left:${Math.round(((d.w-d.bcW)/2+d.bcX)*PX)}px">
          <svg id="${e.uid}" style="width:100%;height:100%"></svg>
        </div>
        ${d.showCodNum ? `<div class="etiq-bc-num">${e.codigo}</div>` : ''}
      </div>`).join('');

    const w = bcHeightPx;

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

    const d = Etiquetas._cfg();
    const pageW = d.pageW; // largura real do papel (ex: 100mm)

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

    // Cria PDF com página de tamanho exato igual ao papel físico
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [d.h, pageW] });

    // Função que desenha uma etiqueta no PDF a partir de (x, y)
    const desenharEtiqueta = (x, y, etiq) => {
      const pad = 2;            // padding interno (mm) em cada lado
      const innerW = d.w - pad * 2;  // largura útil dentro da coluna
      const xL = x + pad;       // margem interna esquerda
      const xR = x + d.w - pad; // margem interna direita
      const xC = x + d.w / 2;   // centro da coluna

      // Gera barcode em canvas
      const canvas = document.createElement('canvas');
      try {
        JsBarcode(canvas, etiq.codigo, {
          format: 'CODE128', width: 1.5, height: 40,
          displayValue: false, margin: 0,
        });
      } catch(e) { /* código inválido */ }

      // Linha 1: nome da loja (esq) + preço (dir) — cada um limitado à metade da coluna
      const halfW = innerW / 2 - 1;
      let curY = y + 3.5;
      if (d.showLoja || d.showPreco) {
        doc.setFont('helvetica', 'bold');
        if (d.showLoja && d.showPreco) {
          // Ambos: loja à esquerda, preço à direita, sem ultrapassar o centro
          doc.setFontSize(5);
          doc.setTextColor(80, 80, 80);
          doc.text(nomeLoja, xL, curY, { maxWidth: halfW });
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(preco, xR, curY, { align: 'right', maxWidth: halfW });
        } else if (d.showLoja) {
          // Só loja: centralizado
          doc.setFontSize(5);
          doc.setTextColor(80, 80, 80);
          doc.text(nomeLoja, xC, curY, { align: 'center', maxWidth: innerW });
        } else {
          // Só preço: centralizado
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          doc.text(preco, xC, curY, { align: 'center', maxWidth: innerW });
        }
        curY += 4;
      }

      // Linha 2: nome do produto — centralizado
      if (d.showNome) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(nomeProd, xC, curY, { align: 'center', maxWidth: innerW });
        curY += 3;
      }

      // Barcode — centralizado na coluna + ajuste fino
      if (canvas.width > 0) {
        const bcXpos = x + (d.w - d.bcW) / 2 + d.bcX;
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', bcXpos, curY, d.bcW, d.bcH);
        curY += d.bcH + 1;
      }

      // Última linha: variação + código
      const lastY = y + d.h - 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(60, 60, 60);
      if (d.showVar && d.showCodNum) {
        doc.text(etiq.varLabel, xL, lastY, { maxWidth: halfW });
        doc.text(etiq.codigo,   xR, lastY, { align: 'right', maxWidth: halfW });
      } else if (d.showVar) {
        doc.text(etiq.varLabel, xC, lastY, { align: 'center', maxWidth: innerW });
      } else if (d.showCodNum) {
        doc.text(etiq.codigo,   xC, lastY, { align: 'center', maxWidth: innerW });
      }
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
