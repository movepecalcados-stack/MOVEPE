/**
 * MOVE PÉ - Módulo de Relatórios
 */

const RelatoriosPage = (() => {

  let tabAtiva = 'vendas';

  const init = () => {
    Utils.renderNav('relatorios.html');
    // Definir datas padrão (mês atual)
    const hoje = Utils.hoje();
    const inicio = hoje.substring(0, 7) + '-01';
    const el = (id) => document.getElementById(id);
    if (el('rel-inicio')) el('rel-inicio').value = inicio;
    if (el('rel-fim')) el('rel-fim').value = hoje;

    setTab('vendas');
    bindEventos();
  };

  const setTab = (tab) => {
    tabAtiva = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('ativo', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('ativo', c.id === 'tab-' + tab);
    });
    gerarRelatorio();
  };

  const gerarRelatorio = () => {
    const inicio = document.getElementById('rel-inicio')?.value || Utils.hoje();
    const fim = document.getElementById('rel-fim')?.value || Utils.hoje();

    if (tabAtiva === 'vendas') relVendas(inicio, fim);
    else if (tabAtiva === 'produtos') relProdutos(inicio, fim);
    else if (tabAtiva === 'estoque') relEstoque();
    else if (tabAtiva === 'inadimplentes') relInadimplentes();
  };

  // ---- RELATÓRIO DE VENDAS ----
  const relVendas = (inicio, fim) => {
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim);
    const container = document.getElementById('rel-vendas-content');
    if (!container) return;

    if (!vendas.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><div class="empty-text">Nenhuma venda no período</div></div>`;
      return;
    }

    let totalGeral = 0;
    const porForma = { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, crediario: 0 };

    vendas.forEach(v => {
      totalGeral += parseFloat(v.total) || 0;
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        v.formasPagamento.forEach(p => {
          if (porForma[p.forma] !== undefined) porForma[p.forma] += parseFloat(p.valor) || 0;
        });
      } else {
        const f = v.formaPagamento;
        if (porForma[f] !== undefined) porForma[f] += parseFloat(v.total) || 0;
      }
    });

    // Cards de resumo
    const cards = `
    <div class="summary-grid mb-2">
      <div class="stat-card"><div class="stat-label">Total de Vendas</div><div class="stat-value">${vendas.length}</div></div>
      <div class="stat-card"><div class="stat-label">Faturamento</div><div class="stat-value">${Utils.moeda(totalGeral)}</div></div>
      <div class="stat-card" style="border-color:#2E7D32"><div class="stat-label">Ticket Médio</div><div class="stat-value success">${Utils.moeda(totalGeral / vendas.length)}</div></div>
    </div>
    <div class="summary-grid mb-2">
      <div class="stat-card" style="border-color:#555"><div class="stat-label">💵 Dinheiro</div><div class="stat-value" style="font-size:18px">${Utils.moeda(porForma.dinheiro)}</div></div>
      <div class="stat-card" style="border-color:#555"><div class="stat-label">📱 Pix</div><div class="stat-value" style="font-size:18px">${Utils.moeda(porForma.pix)}</div></div>
      <div class="stat-card" style="border-color:#555"><div class="stat-label">💳 Cartão</div><div class="stat-value" style="font-size:18px">${Utils.moeda(porForma.cartao_credito + porForma.cartao_debito)}</div></div>
      <div class="stat-card" style="border-color:#555"><div class="stat-label">📋 Crediário</div><div class="stat-value" style="font-size:18px">${Utils.moeda(porForma.crediario)}</div></div>
    </div>`;

    // Tabela de vendas
    const tabela = `
    <div class="table-container">
      <table>
        <thead><tr>
          <th>Data/Hora</th><th>Itens</th><th>Formas de Pgto</th><th>Total</th>
        </tr></thead>
        <tbody>
          ${vendas.slice().reverse().map(v => {
            const labels = { dinheiro: '💵', pix: '📱', cartao_credito: '💳C', cartao_debito: '💳D', crediario: '📋' };
            const formas = v.formasPagamento && v.formasPagamento.length > 0
              ? v.formasPagamento.map(p => `${labels[p.forma] || '💰'} ${Utils.moeda(p.valor)}`).join(' · ')
              : `${labels[v.formaPagamento] || '💰'} ${Utils.moeda(v.total)}`;
            return `
            <tr>
              <td style="white-space:nowrap">${Utils.dataHora(v.criadoEm)}</td>
              <td>${(v.itens || []).length} item(s)</td>
              <td style="font-size:12px">${formas}</td>
              <td class="fw-bold">${Utils.moeda(v.total)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

    container.innerHTML = cards + tabela;
  };

  // ---- RELATÓRIO DE PRODUTOS MAIS VENDIDOS ----
  const relProdutos = (inicio, fim) => {
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim);
    const container = document.getElementById('rel-produtos-content');
    if (!container) return;

    if (!vendas.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📦</span><div class="empty-text">Nenhuma venda no período</div></div>`;
      return;
    }

    const ranking = {};
    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const key = item.produtoId;
        if (!ranking[key]) {
          ranking[key] = { nome: item.nome, sku: item.sku || '', quantidade: 0, faturamento: 0 };
        }
        ranking[key].quantidade += item.quantidade;
        ranking[key].faturamento += item.precoUnitario * item.quantidade;
      });
    });

    const lista = Object.values(ranking).sort((a, b) => b.quantidade - a.quantidade);

    container.innerHTML = `
    <div class="table-container">
      <table>
        <thead><tr>
          <th>#</th><th>Produto</th><th>SKU</th><th>Qtd Vendida</th><th>Faturamento</th>
        </tr></thead>
        <tbody>
          ${lista.map((p, i) => `
          <tr>
            <td><strong>${i + 1}°</strong></td>
            <td>${p.nome}</td>
            <td class="text-muted">${p.sku}</td>
            <td><span class="badge badge-primary">${p.quantidade} un</span></td>
            <td class="fw-bold">${Utils.moeda(p.faturamento)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  };

  // ---- RELATÓRIO DE ESTOQUE ----
  const relEstoque = () => {
    const produtos = DB.Produtos.listarAtivos();
    const container = document.getElementById('rel-estoque-content');
    if (!container) return;

    let totalCusto = 0, totalVenda = 0, totalItens = 0;

    produtos.forEach(p => {
      Object.values(p.variacoes || {}).forEach(qtd => {
        const q = parseInt(qtd) || 0;
        totalCusto += (p.precoCusto || 0) * q;
        totalVenda += (p.precoVenda || 0) * q;
        totalItens += q;
      });
    });

    const cards = `
    <div class="summary-grid mb-2">
      <div class="stat-card"><div class="stat-label">Total em peças</div><div class="stat-value">${totalItens}</div></div>
      <div class="stat-card" style="border-color:#e65100"><div class="stat-label">Valor de Custo</div><div class="stat-value warning">${Utils.moeda(totalCusto)}</div></div>
      <div class="stat-card" style="border-color:#2E7D32"><div class="stat-label">Valor de Venda</div><div class="stat-value success">${Utils.moeda(totalVenda)}</div></div>
      <div class="stat-card" style="border-color:#1565C0"><div class="stat-label">Margem Potencial</div><div class="stat-value">${Utils.moeda(totalVenda - totalCusto)}</div></div>
    </div>`;

    const tabela = `
    <div class="table-container">
      <table>
        <thead><tr>
          <th>Produto</th><th>Tipo</th><th>Preço Venda</th><th>Estoque Total</th><th>Valor Total (venda)</th><th>Detalhe</th>
        </tr></thead>
        <tbody>
          ${produtos.map(p => {
            const total = DB.Produtos.estoqueTotal(p);
            const varStr = Object.entries(p.variacoes || {})
              .filter(([, q]) => q > 0)
              .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
              .map(([tam, q]) => `${tam}:${q}`)
              .join(' ');
            return `
            <tr>
              <td>
                <div class="fw-bold">${p.nome}</div>
                <div class="text-muted" style="font-size:11px">${p.sku || ''}</div>
              </td>
              <td><span class="badge badge-${p.tipo === 'calcado' ? 'primary' : 'secondary'}">${p.tipo === 'calcado' ? 'Calçado' : 'Roupa'}</span></td>
              <td>${Utils.moeda(p.precoVenda)}</td>
              <td><span class="badge badge-${total > 0 ? 'success' : 'danger'}">${total} un</span></td>
              <td>${Utils.moeda(p.precoVenda * total)}</td>
              <td style="font-size:11px;color:#777">${varStr || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

    container.innerHTML = cards + tabela;
  };

  // ---- RELATÓRIO DE INADIMPLENTES ----
  const relInadimplentes = () => {
    const container = document.getElementById('rel-inadimplentes-content');
    if (!container) return;

    const hoje = Utils.hoje();
    const todos = DB.Crediario.listar();

    const inadimplentes = [];
    todos.forEach(cr => {
      const parcelasAtrasadas = (cr.parcelas || []).filter(p =>
        p.status !== 'pago' && p.vencimento < hoje
      );
      if (parcelasAtrasadas.length) {
        const total = parcelasAtrasadas.reduce((s, p) => s + p.valor, 0);
        inadimplentes.push({
          clienteNome: cr.clienteNome,
          parcelas: parcelasAtrasadas.length,
          total,
          maiorAtraso: parcelasAtrasadas[0].vencimento
        });
      }
    });

    // Agrupar por cliente
    const porCliente = {};
    inadimplentes.forEach(i => {
      if (!porCliente[i.clienteNome]) {
        porCliente[i.clienteNome] = { parcelas: 0, total: 0, maiorAtraso: i.maiorAtraso };
      }
      porCliente[i.clienteNome].parcelas += i.parcelas;
      porCliente[i.clienteNome].total += i.total;
      if (i.maiorAtraso < porCliente[i.clienteNome].maiorAtraso) {
        porCliente[i.clienteNome].maiorAtraso = i.maiorAtraso;
      }
    });

    const lista = Object.entries(porCliente).sort((a, b) => b[1].total - a[1].total);

    if (!lista.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">🎉</span><div class="empty-text">Nenhum cliente inadimplente!</div><div class="empty-sub">Todos os pagamentos estão em dia.</div></div>`;
      return;
    }

    const totalInadimplente = lista.reduce((s, [, v]) => s + v.total, 0);

    container.innerHTML = `
    <div class="stat-card mb-2" style="border-color:#c62828">
      <div class="stat-label">Total em aberto (atrasado)</div>
      <div class="stat-value danger">${Utils.moeda(totalInadimplente)}</div>
    </div>
    <div class="table-container">
      <table>
        <thead><tr>
          <th>Cliente</th><th>Parcelas Atrasadas</th><th>Vencimento mais antigo</th><th>Total em Atraso</th>
        </tr></thead>
        <tbody>
          ${lista.map(([nome, dados]) => `
          <tr>
            <td class="fw-bold">${nome}</td>
            <td><span class="badge badge-danger">${dados.parcelas}</span></td>
            <td class="text-danger">${Utils.data(dados.maiorAtraso)}</td>
            <td class="text-danger fw-bold">${Utils.moeda(dados.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  };

  const imprimir = () => {
    const conteudo = document.querySelector('.tab-content.ativo');
    if (!conteudo) return;

    const inicio = document.getElementById('rel-inicio')?.value || '';
    const fim = document.getElementById('rel-fim')?.value || '';

    Utils.imprimirHtml(`
      <h1>MOVE PÉ - Relatório</h1>
      <p class="center">Período: ${Utils.data(inicio)} a ${Utils.data(fim)}</p>
      <hr class="sep">
      ${conteudo.innerHTML}
    `, 'Relatório MOVE PÉ');
  };

  const bindEventos = () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) btnGerar.addEventListener('click', gerarRelatorio);

    const btnImprimir = document.getElementById('btn-imprimir-rel');
    if (btnImprimir) btnImprimir.addEventListener('click', imprimir);
  };

  return { init, setTab };
})();

document.addEventListener('DOMContentLoaded', RelatoriosPage.init);
