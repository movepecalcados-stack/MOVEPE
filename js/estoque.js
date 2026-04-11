/**
 * MOVE PÉ - Estoque v2.0
 */

let _produtoEditando = null;
let _filtroTipo = '';
let _filtroTamanho = '';
let _busca = '';
let _fotoBase64 = null;
let _fotosVariacoes = {}; // { "preto": "base64...", "rosa": "base64..." }

const Estoque = {

  init: () => {
    Utils.renderNav('estoque.html');
    Utils.initModais();
    Estoque.renderStats();
    Estoque.renderProdutos();

    document.getElementById('buscaInput').addEventListener('input', (e) => {
      _busca = e.target.value;
      Estoque.renderProdutos();
    });

    document.getElementById('filtroTipo').addEventListener('change', (e) => {
      _filtroTipo = e.target.value;
      Estoque.renderProdutos();
    });

    document.getElementById('filtroTamanho').addEventListener('input', (e) => {
      _filtroTamanho = e.target.value;
      Estoque.renderProdutos();
    });

    document.getElementById('btnNovoProduto').addEventListener('click', () => {
      Estoque.abrirForm(null);
    });

    document.getElementById('formProduto').addEventListener('submit', Estoque.salvar);

    document.getElementById('btnAdicionarVariacao').addEventListener('click', Estoque.adicionarLinhaVariacao);

    document.getElementById('btnCancelar').addEventListener('click', () => {
      Utils.fecharModal('modalProduto');
    });
  },

  renderStats: () => {
    const prods = DB.Produtos.listarAtivos();
    let totalPecas = 0, valorVenda = 0, valorCusto = 0, estoqueBaixo = 0;
    prods.forEach(p => {
      const total = DB.Produtos.estoqueTotal(p);
      totalPecas += total;
      valorVenda += total * (parseFloat(p.precoVenda) || 0);
      valorCusto += total * (parseFloat(p.precoCusto) || 0);
      if (total <= (p.estoqueMinimo || 5)) estoqueBaixo++;
    });
    document.getElementById('statPecas').textContent = totalPecas;
    document.getElementById('statValorVenda').textContent = Utils.moeda(valorVenda);
    document.getElementById('statValorCusto').textContent = Utils.moeda(valorCusto);
    document.getElementById('statBaixo').textContent = estoqueBaixo;
  },

  renderProdutos: () => {
    let prods = DB.Produtos.listarAtivos();

    if (_busca.trim()) {
      prods = DB.Produtos.buscarPorTexto(_busca);
    }

    if (_filtroTipo) {
      prods = prods.filter(p => p.tipo === _filtroTipo);
    }

    if (_filtroTamanho) {
      prods = prods.filter(p => p.variacoes && Object.keys(p.variacoes).some(key => key.split('||')[0] === _filtroTamanho && p.variacoes[key] > 0));
    }

    const grid = document.getElementById('estoquegrid');
    if (prods.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Nenhum produto encontrado</div>
        <div class="empty-sub">Cadastre produtos ou ajuste os filtros</div>
      </div>`;
      return;
    }

    grid.innerHTML = prods.map(p => {
      const total = DB.Produtos.estoqueTotal(p);
      const baixo = total <= (p.estoqueMinimo || 5);
      const variacoes = p.variacoes || {};
      const fotoHtml = p.foto
        ? `<img src="${p.foto}" style="width:100%;height:130px;object-fit:cover;display:block;border-bottom:1px solid var(--border)" loading="lazy">`
        : `<div style="width:100%;height:80px;display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--bg);border-bottom:1px solid var(--border)">👟</div>`;
      const tamanhosHtml = Object.entries(variacoes)
        .sort((a, b) => {
          const pa = a[0].split('||'); const pb = b[0].split('||');
          const na = parseFloat(pa[0]); const nb = parseFloat(pb[0]);
          if (!isNaN(na) && !isNaN(nb)) return na - nb || (pa[1]||'').localeCompare(pb[1]||'');
          return a[0].localeCompare(b[0]);
        })
        .map(([key, qtd]) => {
          const [tam, cor] = key.split('||');
          const fotoChip = cor && p.fotosVariacoes && p.fotosVariacoes[cor.toLowerCase()]
            ? `<img src="${p.fotosVariacoes[cor.toLowerCase()]}" style="width:22px;height:22px;object-fit:cover;border-radius:3px;flex-shrink:0;display:block">`
            : '';
          return `
          <div class="tamanho-chip ${qtd == 0 ? 'zero' : ''}">
            ${fotoChip}
            <span class="tc-size">${tam}</span>
            ${cor ? `<span style="font-size:9px;color:var(--text-muted);display:block;line-height:1.2;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cor}</span>` : ''}
            <span class="tc-qty">${qtd}</span>
          </div>`;
        }).join('');

      return `
        <div class="estoque-card ${baixo ? 'low-stock' : ''}" style="padding:0;overflow:hidden">
          ${fotoHtml}
          <div style="padding:12px;display:flex;flex-direction:column;gap:8px;flex:1">
          <div class="estoque-card-header">
            <div>
              <div class="estoque-card-nome">${p.nome}</div>
              <div class="estoque-card-marca">${p.marca || ''} ${p.categoria ? '· ' + p.categoria : ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="badge badge-muted">${Utils.labelTipo(p.tipo)}</span>
              ${baixo ? '<span class="low-stock-tag">⚠ Baixo</span>' : ''}
            </div>
          </div>
          <div class="estoque-tamanhos">${tamanhosHtml || '<span class="text-muted fs-sm">Sem tamanhos</span>'}</div>
          <div class="estoque-precos">
            <span class="estoque-preco-venda">${Utils.moeda(p.precoVenda)}</span>
            <span class="estoque-preco-custo">Custo: ${Utils.moeda(p.precoCusto)}</span>
          </div>
          <div class="text-muted fs-sm">${p.sku ? 'SKU: ' + p.sku : ''} ${p.codigoBarras ? '· Cód: ' + p.codigoBarras : ''}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline btn-sm" onclick="Estoque.abrirForm('${p.id}')">✏️ Editar</button>
            <button class="btn btn-danger btn-sm" onclick="Estoque.excluir('${p.id}')">🗑</button>
          </div>
          </div>
        </div>`;
    }).join('');
  },

  abrirForm: (id) => {
    _produtoEditando = id ? DB.Produtos.buscar(id) : null;
    const modal = document.getElementById('modalProduto');
    const titulo = document.getElementById('modalProdutoTitulo');
    titulo.textContent = _produtoEditando ? 'Editar Produto' : 'Novo Produto';

    const f = document.getElementById('formProduto');
    f.nome.value = _produtoEditando ? _produtoEditando.nome : '';
    f.sku.value = _produtoEditando ? (_produtoEditando.sku || '') : '';
    f.codigoBarras.value = _produtoEditando ? (_produtoEditando.codigoBarras || '') : '';
    f.marca.value = _produtoEditando ? (_produtoEditando.marca || '') : '';
    f.categoria.value = _produtoEditando ? (_produtoEditando.categoria || '') : '';
    f.tipo.value = _produtoEditando ? (_produtoEditando.tipo || 'calcado_adulto') : 'calcado_adulto';
    f.precoVenda.value = _produtoEditando ? _produtoEditando.precoVenda : '';
    f.precoCusto.value = _produtoEditando ? (_produtoEditando.precoCusto || '') : '';
    f.estoqueMinimo.value = _produtoEditando ? (_produtoEditando.estoqueMinimo || 5) : 5;
    f.descricao.value = _produtoEditando ? (_produtoEditando.descricao || '') : '';

    // Fotos de variação por cor
    _fotosVariacoes = _produtoEditando ? JSON.parse(JSON.stringify(_produtoEditando.fotosVariacoes || {})) : {};

    // Foto principal
    _fotoBase64 = _produtoEditando ? (_produtoEditando.foto || null) : null;
    document.getElementById('inputFotoProduto').value = '';
    if (_fotoBase64) {
      document.getElementById('fotoPreviewImg').src = _fotoBase64;
      document.getElementById('fotoPreviewBox').style.display = 'block';
      document.getElementById('fotoUploadZone').style.display = 'none';
    } else {
      document.getElementById('fotoPreviewBox').style.display = 'none';
      document.getElementById('fotoUploadZone').style.display = 'block';
    }

    // Renderizar variacoes
    const variacoes = _produtoEditando ? (_produtoEditando.variacoes || {}) : {};
    Estoque.renderVariacoes(variacoes);

    Utils.abrirModal('modalProduto');
  },

  renderVariacoes: (variacoes) => {
    const cont = document.getElementById('variacoesCont');
    const entries = Object.entries(variacoes);
    if (entries.length === 0) {
      cont.innerHTML = '<div class="text-muted fs-sm" style="padding:8px">Nenhum tamanho adicionado</div>';
      return;
    }
    cont.innerHTML = entries
      .sort((a, b) => {
        const pa = a[0].split('||'); const pb = b[0].split('||');
        const na = parseFloat(pa[0]); const nb = parseFloat(pb[0]);
        if (!isNaN(na) && !isNaN(nb)) return na - nb || (pa[1]||'').localeCompare(pb[1]||'');
        return a[0].localeCompare(b[0]);
      })
      .map(([key, qtd]) => {
        const [tam, cor] = key.split('||');
        const fotoExist = cor ? (_fotosVariacoes[cor.toLowerCase()] || '') : '';
        const fotoBtnHtml = fotoExist
          ? `<img src="${fotoExist}" style="width:100%;height:100%;object-fit:cover">`
          : '📷';
        return `
        <div class="form-row var-row" style="margin-bottom:6px;align-items:center">
          <input class="form-control var-tam" value="${tam}" placeholder="Tamanho (ex: 38)" style="flex:1;min-width:70px">
          <input class="form-control var-cor" value="${cor || ''}" placeholder="Cor (opcional)" style="flex:2" oninput="Estoque._atualizarFotoBtn(this)">
          <button type="button" class="var-foto-btn" title="Foto desta cor" onclick="Estoque._clicarFotoVar(this)">${fotoBtnHtml}</button>
          <input type="file" accept="image/*" style="display:none" onchange="Estoque._carregarFotoVar(this)">
          <input class="form-control var-qty" type="number" min="0" value="${qtd}" placeholder="Qtd" style="flex:1;min-width:60px">
          <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.closest('.var-row').remove()" title="Remover">✕</button>
        </div>`;
      }).join('');
  },

  adicionarLinhaVariacao: () => {
    const cont = document.getElementById('variacoesCont');
    // Remove mensagem de vazio se existir
    const vazio = cont.querySelector('.text-muted');
    if (vazio) vazio.remove();

    const div = document.createElement('div');
    div.className = 'form-row var-row';
    div.style.marginBottom = '6px';
    div.style.alignItems = 'center';
    div.innerHTML = `
      <input class="form-control var-tam" placeholder="Tamanho (ex: 38)" style="flex:1;min-width:70px">
      <input class="form-control var-cor" placeholder="Cor (opcional)" style="flex:2" oninput="Estoque._atualizarFotoBtn(this)">
      <button type="button" class="var-foto-btn" title="Foto desta cor" onclick="Estoque._clicarFotoVar(this)">📷</button>
      <input type="file" accept="image/*" style="display:none" onchange="Estoque._carregarFotoVar(this)">
      <input class="form-control var-qty" type="number" min="0" value="0" placeholder="Qtd" style="flex:1;min-width:60px">
      <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.closest('.var-row').remove()" title="Remover">✕</button>`;
    cont.appendChild(div);
    div.querySelector('.var-tam').focus();
  },

  coletarVariacoes: () => {
    const variacoes = {};
    document.querySelectorAll('#variacoesCont .var-row').forEach(row => {
      const tam = row.querySelector('.var-tam').value.trim();
      const cor = row.querySelector('.var-cor').value.trim();
      const qty = parseInt(row.querySelector('.var-qty').value) || 0;
      if (tam) {
        const key = cor ? `${tam}||${cor}` : tam;
        variacoes[key] = qty;
      }
    });
    return variacoes;
  },

  coletarFotosVariacoes: () => {
    const fotos = {};
    document.querySelectorAll('#variacoesCont .var-row').forEach(row => {
      const cor = row.querySelector('.var-cor').value.trim().toLowerCase();
      const img = row.querySelector('.var-foto-btn img');
      if (cor && img && img.src && img.src.startsWith('data:')) {
        fotos[cor] = img.src;
      }
    });
    return fotos;
  },

  _clicarFotoVar: (btn) => {
    btn.nextElementSibling.click();
  },

  _carregarFotoVar: (input) => {
    const file = input.files[0];
    if (!file) return;
    const row = input.closest('.var-row');
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.80);
        const btn = row.querySelector('.var-foto-btn');
        btn.innerHTML = `<img src="${b64}" style="width:100%;height:100%;object-fit:cover">`;
        input.value = '';
        const cor = row.querySelector('.var-cor').value.trim().toLowerCase();
        if (cor) _fotosVariacoes[cor] = b64;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  _atualizarFotoBtn: (corInput) => {
    const row = corInput.closest('.var-row');
    const cor = corInput.value.trim().toLowerCase();
    const btn = row.querySelector('.var-foto-btn');
    if (cor && _fotosVariacoes[cor]) {
      btn.innerHTML = `<img src="${_fotosVariacoes[cor]}" style="width:100%;height:100%;object-fit:cover">`;
    } else if (!btn.querySelector('img')) {
      btn.innerHTML = '📷';
    }
  },

  selecionarFoto: (input) => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Comprimir: máx 900px largura, JPEG 80%
        const maxW = 900;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        _fotoBase64 = canvas.toDataURL('image/jpeg', 0.80);
        document.getElementById('fotoPreviewImg').src = _fotoBase64;
        document.getElementById('fotoPreviewBox').style.display = 'block';
        document.getElementById('fotoUploadZone').style.display = 'none';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  removerFoto: () => {
    _fotoBase64 = null;
    document.getElementById('inputFotoProduto').value = '';
    document.getElementById('fotoPreviewBox').style.display = 'none';
    document.getElementById('fotoUploadZone').style.display = 'block';
  },

  salvar: (e) => {
    e.preventDefault();
    const f = document.getElementById('formProduto');
    const variacoes = Estoque.coletarVariacoes();

    const prod = {
      id: _produtoEditando ? _produtoEditando.id : undefined,
      nome: f.nome.value.trim(),
      sku: f.sku.value.trim(),
      codigoBarras: f.codigoBarras.value.trim(),
      marca: f.marca.value.trim(),
      categoria: f.categoria.value.trim(),
      tipo: f.tipo.value,
      precoVenda: parseFloat(f.precoVenda.value) || 0,
      precoCusto: parseFloat(f.precoCusto.value) || 0,
      estoqueMinimo: parseInt(f.estoqueMinimo.value) || 5,
      descricao: f.descricao.value.trim(),
      foto: _fotoBase64,
      fotosVariacoes: Estoque.coletarFotosVariacoes(),
      variacoes,
      ativo: true
    };

    if (!prod.nome) { Utils.toast('Nome é obrigatório', 'error'); return; }
    if (!prod.precoVenda) { Utils.toast('Preço de venda é obrigatório', 'error'); return; }

    DB.Produtos.salvar(prod);
    Utils.fecharModal('modalProduto');
    Estoque.renderStats();
    Estoque.renderProdutos();
    Utils.toast(_produtoEditando ? 'Produto atualizado!' : 'Produto cadastrado!');
  },

  excluir: (id) => {
    if (!Utils.confirmar('Excluir este produto? (será inativado)')) return;
    DB.Produtos.excluir(id);
    Estoque.renderStats();
    Estoque.renderProdutos();
    Utils.toast('Produto excluído');
  }
};

document.addEventListener('DOMContentLoaded', Estoque.init);
document.addEventListener('movePe-sync', () => { Estoque.renderStats(); Estoque.renderProdutos(); });
