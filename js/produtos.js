/**
 * MOVE PÉ - Módulo de Produtos
 * Gerenciamento de cadastro, estoque e variações
 */

const ProdutosPage = (() => {

  // Tamanhos disponíveis por tipo
  const TAMANHOS = {
    calcado_infantil: ['20','21','22','23','24','25','26','27','28','29','30','31','32','33'],
    calcado_adulto:   ['34','35','36','37','38','39','40','41','42','43','44'],
    roupa:            ['PP','P','M','G','GG','XGG']
  };

  let produtoEditando = null;
  let variacoesTemp = {}; // {tamanho: qtd} — mesmo formato do DB e estoque.js

  const init = () => {
    Utils.renderNav('produtos.html');
    renderLista();
    bindEventos();
    atualizarTopbar();
  };

  const atualizarTopbar = () => {
    const total = DB.Produtos.listarAtivos().length;
    const el = document.getElementById('topbar-info');
    if (el) el.textContent = `${total} produto(s) cadastrado(s)`;
  };

  const renderLista = (filtro = '') => {
    const produtos = filtro
      ? DB.Produtos.buscarPorTexto(filtro)
      : DB.Produtos.listarAtivos();

    const tbody = document.getElementById('produtos-tbody');
    const empty = document.getElementById('empty-produtos');

    if (!produtos.length) {
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');

    if (tbody) {
      tbody.innerHTML = produtos.map(p => {
        const totalEstoque = DB.Produtos.estoqueTotal(p);
        const tipoLabel = p.tipo === 'calcado' ? '👟 Calçado' : '👕 Roupa';
        const varStr = Object.entries(p.variacoes || {})
          .filter(([, q]) => q > 0)
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([tam, q]) => `${tam}(${q})`)
          .join(' ');

        return `
        <tr>
          <td><span class="badge badge-${p.tipo === 'calcado' ? 'primary' : 'secondary'}">${tipoLabel}</span></td>
          <td>
            <div class="fw-bold">${p.nome}</div>
            <div class="text-muted" style="font-size:11px">${p.sku || ''}</div>
          </td>
          <td>${Utils.moeda(p.precoVenda)}</td>
          <td class="text-muted" style="font-size:12px">${Utils.moeda(p.precoCusto || 0)}</td>
          <td>
            <span class="badge badge-${totalEstoque > 0 ? 'success' : 'danger'}">${totalEstoque} un</span>
          </td>
          <td style="font-size:11px; color:#666; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${varStr || '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-sm btn-outline" onclick="ProdutosPage.abrirModal('${p.id}')">✏️ Editar</button>
              <button class="btn btn-sm btn-outline-danger" onclick="ProdutosPage.excluir('${p.id}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  };

  const abrirModal = (id = null) => {
    produtoEditando = id;
    variacoesTemp = {};

    const titulo = document.getElementById('modal-prod-titulo');
    if (titulo) titulo.textContent = id ? 'Editar Produto' : 'Novo Produto';

    // Limpar campos
    ['nome','sku','precoVenda','precoCusto','codigoBarras'].forEach(f => {
      const el = document.getElementById('prod-' + f);
      if (el) el.value = '';
    });

    document.getElementById('prod-tipo').value = 'calcado';

    if (id) {
      const p = DB.Produtos.buscar(id);
      if (p) {
        document.getElementById('prod-nome').value = p.nome || '';
        document.getElementById('prod-sku').value = p.sku || '';
        document.getElementById('prod-precoVenda').value = p.precoVenda || '';
        document.getElementById('prod-precoCusto').value = p.precoCusto || '';
        document.getElementById('prod-codigoBarras').value = p.codigoBarras || '';
        document.getElementById('prod-tipo').value = p.tipo || 'calcado';
        // variacoes é objeto {tamanho: qtd}
        variacoesTemp = JSON.parse(JSON.stringify(p.variacoes || {}));
      }
    }

    renderTamanhos();
    Utils.abrirModal('modal-produto');
  };

  const renderTamanhos = () => {
    const tipo = document.getElementById('prod-tipo').value;
    const container = document.getElementById('tamanhos-container');
    if (!container) return;

    let grupos = [];
    if (tipo === 'calcado') {
      grupos = [
        { label: '👶 Infantil (20-33)', tamanhos: TAMANHOS.calcado_infantil },
        { label: '🧑 Adulto (34-44)', tamanhos: TAMANHOS.calcado_adulto }
      ];
    } else {
      grupos = [{ label: '👕 Tamanhos', tamanhos: TAMANHOS.roupa }];
    }

    container.innerHTML = grupos.map(g => `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:#666;margin-bottom:6px">${g.label}</div>
        <div class="variacoes-grid">
          ${g.tamanhos.map(t => {
            const qtd = variacoesTemp[t] || 0;
            return `
            <div class="variacao-row" id="vrow-${t}">
              <div class="variacao-tag">${t}</div>
              <input type="number" class="form-control" style="width:80px"
                min="0" value="${qtd}"
                onchange="ProdutosPage.setVariacao('${t}', this.value)"
                placeholder="0">
              <span style="font-size:11px;color:#999">un</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  };

  const setVariacao = (tamanho, valor) => {
    variacoesTemp[tamanho] = parseInt(valor) || 0;
  };

  const salvar = () => {
    const nome = document.getElementById('prod-nome').value.trim();
    const precoVenda = Utils.num(document.getElementById('prod-precoVenda').value);

    if (!nome) { Utils.toast('Informe o nome do produto', 'error'); return; }
    if (!precoVenda || precoVenda <= 0) { Utils.toast('Informe o preço de venda', 'error'); return; }

    const tipo = document.getElementById('prod-tipo').value;
    const tamanhosSelecionados = getTamanhosTipo(tipo);

    // Coletar variações como objeto {tamanho: qtd}
    const variacoes = {};
    tamanhosSelecionados.flat().forEach(t => {
      const input = document.querySelector(`#vrow-${t} input`);
      variacoes[t] = input ? (parseInt(input.value) || 0) : 0;
    });

    const produto = {
      id: produtoEditando || undefined,
      nome,
      sku: document.getElementById('prod-sku').value.trim(),
      precoVenda,
      precoCusto: Utils.num(document.getElementById('prod-precoCusto').value),
      codigoBarras: document.getElementById('prod-codigoBarras').value.trim(),
      tipo,
      variacoes,
      ativo: true
    };

    DB.Produtos.salvar(produto);
    Utils.toast(produtoEditando ? 'Produto atualizado!' : 'Produto cadastrado!', 'success');
    Utils.fecharModal('modal-produto');
    renderLista();
    atualizarTopbar();
  };

  const getTamanhosTipo = (tipo) => {
    if (tipo === 'calcado') return [TAMANHOS.calcado_infantil, TAMANHOS.calcado_adulto];
    return [TAMANHOS.roupa];
  };

  const excluir = (id) => {
    const p = DB.Produtos.buscar(id);
    if (!p) return;
    if (!Utils.confirmar(`Excluir "${p.nome}"? O produto será desativado.`)) return;
    DB.Produtos.excluir(id);
    Utils.toast('Produto removido', 'warning');
    renderLista();
    atualizarTopbar();
  };

  const bindEventos = () => {
    // Busca
    const busca = document.getElementById('busca-produto');
    if (busca) {
      busca.addEventListener('input', () => renderLista(busca.value));
    }

    // Tipo muda → render tamanhos
    const tipo = document.getElementById('prod-tipo');
    if (tipo) {
      tipo.addEventListener('change', renderTamanhos);
    }

    // Botão salvar
    const btnSalvar = document.getElementById('btn-salvar-produto');
    if (btnSalvar) btnSalvar.addEventListener('click', salvar);

    // Fechar modais
    Utils.initModais();
  };

  return { init, abrirModal, setVariacao, excluir, renderTamanhos, TAMANHOS };
})();

document.addEventListener('DOMContentLoaded', ProdutosPage.init);
