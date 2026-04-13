/**
 * MOVE PÉ - Estoque v2.0
 */

let _produtoEditando = null;
let _filtroTipo = '';
let _filtroTamanho = '';
let _busca = '';
let _fotosGaleria = [];      // até 7 fotos; índice 0 = principal
let _fotosVariacoes = {};   // { "rosa": "base64..." } — foto atribuída a cada cor

const Estoque = {

  init: () => {
    Utils.renderNav('estoque.html');
    Utils.initModais();
    Estoque.renderStats();
    Estoque.renderProdutos();

    // Abre edição direta via URL: estoque.html?editar=ID
    const urlParams = new URLSearchParams(window.location.search);
    const editarId = urlParams.get('editar');
    if (editarId) {
      setTimeout(() => Estoque.abrirForm(editarId), 300);
      history.replaceState(null, '', 'estoque.html');
    }

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

    document.getElementById('btnAdicionarVariacao').addEventListener('click', () => Estoque.adicionarLinhaVariacao());

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

    // Galeria de fotos (até 7)
    if (_produtoEditando) {
      if (Array.isArray(_produtoEditando.fotos) && _produtoEditando.fotos.length > 0) {
        _fotosGaleria = [..._produtoEditando.fotos];
      } else if (_produtoEditando.foto) {
        _fotosGaleria = [_produtoEditando.foto];
      } else {
        _fotosGaleria = [];
      }
    } else {
      _fotosGaleria = [];
    }
    document.getElementById('inputFotoGaleria').value = '';
    Estoque.renderGaleria();

    // Renderizar variacoes
    const variacoes = _produtoEditando ? (_produtoEditando.variacoes || {}) : {};
    Estoque.renderVariacoes(variacoes);

    Utils.abrirModal('modalProduto');
  },

  renderVariacoes: (variacoes) => {
    const cont = document.getElementById('variacoesCont');
    cont.innerHTML = '';
    const entries = Object.entries(variacoes);
    if (entries.length === 0) {
      cont.innerHTML = '<div class="text-muted fs-sm" style="padding:8px 0">Nenhum tamanho adicionado — use os botões acima ou clique em "+ Tamanho"</div>';
      return;
    }
    entries
      .sort((a, b) => {
        const pa = a[0].split('||'); const pb = b[0].split('||');
        const na = parseFloat(pa[0]); const nb = parseFloat(pb[0]);
        if (!isNaN(na) && !isNaN(nb)) return na - nb || (pa[1]||'').localeCompare(pb[1]||'');
        return a[0].localeCompare(b[0]);
      })
      .forEach(([key, qtd]) => {
        const [tam, cor] = key.split('||');
        Estoque.adicionarLinhaVariacao(tam, cor || '', qtd);
      });
  },

  adicionarLinhaVariacao: (tam = '', cor = '', qtd = 0) => {
    const cont = document.getElementById('variacoesCont');
    const vazio = cont.querySelector('.text-muted');
    if (vazio) vazio.remove();

    const fotoBtnHtml = cor && _fotosVariacoes[cor.toLowerCase()]
      ? `<img src="${_fotosVariacoes[cor.toLowerCase()]}" style="width:100%;height:100%;object-fit:cover">`
      : '📷';

    const div = document.createElement('div');
    div.className = 'var-row';
    div.innerHTML = `
      <input class="form-control var-tam" value="${tam}" placeholder="Ex: 38">
      <input class="form-control var-cor" value="${cor}" placeholder="Cor (opcional)" oninput="Estoque._atualizarFotoBtn(this)">
      <button type="button" class="var-foto-btn" title="Selecionar foto da galeria" onclick="Estoque._clicarFotoVar(this)">${fotoBtnHtml}</button>
      <input class="form-control var-qty" type="number" min="0" value="${qtd}" placeholder="Qtd">
      <button type="button" class="btn btn-outline btn-icon btn-sm" onclick="Estoque.duplicarLinha(this)" title="Duplicar esta linha" style="font-size:14px">⧉</button>
      <button type="button" class="btn btn-danger btn-icon btn-sm" onclick="this.closest('.var-row').remove()" title="Remover">✕</button>`;
    cont.appendChild(div);
    if (!tam) div.querySelector('.var-tam').focus();
    return div;
  },

  duplicarLinha: (btn) => {
    const row = btn.closest('.var-row');
    const tam = row.querySelector('.var-tam').value;
    const cor = row.querySelector('.var-cor').value;
    const qtd = parseInt(row.querySelector('.var-qty').value) || 0;
    const novaRow = Estoque.adicionarLinhaVariacao(tam, cor, qtd);
    novaRow.querySelector('.var-tam').focus();
    novaRow.querySelector('.var-tam').select();
  },

  presetSerie: (lista) => {
    const cor = document.getElementById('serieCor').value.trim();
    const qtd = parseInt(document.getElementById('serieQtd').value) || 1;
    const tamanhos = lista.split(',');
    tamanhos.forEach(tam => Estoque.adicionarLinhaVariacao(tam.trim(), cor, qtd));
    Utils.toast(`${tamanhos.length} tamanhos adicionados`);
  },

  gerarSerie: () => {
    const from = document.getElementById('serieFrom').value.trim();
    const to   = document.getElementById('serieTo').value.trim();
    const cor  = document.getElementById('serieCor').value.trim();
    const qtd  = parseInt(document.getElementById('serieQtd').value) || 1;

    if (!from) { Utils.toast('Informe o tamanho inicial', 'error'); return; }

    const nFrom = parseFloat(from.replace(',', '.'));
    const nTo   = parseFloat(to.replace(',', '.'));
    let tamanhos = [];

    if (!isNaN(nFrom) && !isNaN(nTo) && to) {
      for (let n = nFrom; n <= nTo + 0.001; n++) {
        tamanhos.push(String(Math.round(n)));
      }
    } else if (to) {
      tamanhos = [from, to];
    } else {
      tamanhos = [from];
    }

    tamanhos.forEach(tam => Estoque.adicionarLinhaVariacao(tam, cor, qtd));
    document.getElementById('serieFrom').value = '';
    document.getElementById('serieTo').value = '';
    Utils.toast(`${tamanhos.length} tamanho(s) adicionado(s)`);
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

  // ── Galeria de fotos ─────────────────────────────────────────
  renderGaleria: () => {
    const el = document.getElementById('fotoGaleria');
    if (!el) return;
    let html = '';
    _fotosGaleria.forEach((foto, idx) => {
      const label = idx === 0 ? 'Principal' : `Foto ${idx + 1}`;
      html += `
        <div class="foto-slot tem-foto" onclick="document.getElementById('inputFotoGaleria').dataset.slot='${idx}';document.getElementById('inputFotoGaleria').click()" title="Trocar foto">
          <img src="${foto}">
          <div class="foto-slot-badge">${label}</div>
          <button type="button" class="foto-slot-x" onclick="event.stopPropagation();Estoque.removerFotoGaleria(${idx})" title="Remover">✕</button>
        </div>`;
    });
    if (_fotosGaleria.length < 7) {
      const label = _fotosGaleria.length === 0 ? 'Principal' : `Foto ${_fotosGaleria.length + 1}`;
      html += `
        <div class="foto-slot" onclick="document.getElementById('inputFotoGaleria').dataset.slot='new';document.getElementById('inputFotoGaleria').click()" title="Adicionar foto">
          <div>📷</div>
          <div style="font-size:9px;margin-top:3px;color:var(--text-muted);font-weight:600">${label}</div>
        </div>`;
    }
    el.innerHTML = html;
  },

  adicionarFotoGaleria: (input) => {
    const file = input.files[0];
    if (!file) return;
    const slot = input.dataset.slot;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.80);
        if (slot === 'new') {
          if (_fotosGaleria.length < 7) _fotosGaleria.push(b64);
        } else {
          _fotosGaleria[parseInt(slot)] = b64;
        }
        input.value = '';
        Estoque.renderGaleria();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  removerFotoGaleria: (idx) => {
    _fotosGaleria.splice(idx, 1);
    Estoque.renderGaleria();
  },

  // ── Picker de foto para variações ────────────────────────────
  _clicarFotoVar: (btn) => {
    if (_fotosGaleria.length === 0) {
      Utils.toast('Adicione fotos na galeria primeiro', 'warning');
      return;
    }
    // Remove picker existente
    const old = document.getElementById('fotoPicker');
    if (old) { old.remove(); return; }

    const popup = document.createElement('div');
    popup.id = 'fotoPicker';
    popup.className = 'foto-picker-popup';
    popup.innerHTML = '<div class="foto-picker-titulo">Escolha uma foto</div>';

    _fotosGaleria.forEach((foto, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'foto-picker-thumb';
      thumb.title = idx === 0 ? 'Principal' : `Foto ${idx + 1}`;
      thumb.innerHTML = `<img src="${foto}">`;
      thumb.onclick = () => {
        Estoque._selecionarFotoGaleria(btn.closest('.var-row'), idx);
        popup.remove();
      };
      popup.appendChild(thumb);
    });

    document.body.appendChild(popup);

    // Posicionar próximo ao botão
    const rect = btn.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left;
    if (left + 310 > window.innerWidth - 12) left = window.innerWidth - 322;
    if (top  + 160 > window.innerHeight)     top  = rect.top - 166;
    popup.style.top  = top  + 'px';
    popup.style.left = left + 'px';

    // Fechar ao clicar fora
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popup.contains(e.target) && e.target !== btn) {
          popup.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 10);
  },

  _selecionarFotoGaleria: (rowEl, idx) => {
    const foto = _fotosGaleria[idx];
    if (!foto || !rowEl) return;
    const btn = rowEl.querySelector('.var-foto-btn');
    btn.innerHTML = `<img src="${foto}" style="width:100%;height:100%;object-fit:cover">`;
    const cor = rowEl.querySelector('.var-cor').value.trim().toLowerCase();
    if (cor) _fotosVariacoes[cor] = foto;
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
      foto: _fotosGaleria[0] || null,
      fotos: [..._fotosGaleria],
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
    const semTamanhos = Object.keys(variacoes).length === 0;
    if (semTamanhos) {
      Utils.toast((_produtoEditando ? 'Produto atualizado' : 'Produto cadastrado') + ' — sem tamanhos. Adicione tamanhos para controlar estoque.', 'warning');
    } else {
      Utils.toast(_produtoEditando ? 'Produto atualizado!' : 'Produto cadastrado!');
    }
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
