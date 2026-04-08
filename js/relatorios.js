/**
 * MOVE PÉ - Módulo de Relatórios
 */

const RelatoriosPage = (() => {

  let tabAtiva = 'vendas';
  let subTabAtiva = 'diario';

  const init = () => {
    Utils.renderNav('relatorios.html');
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

  const setSubTab = (sub, btn) => {
    subTabAtiva = sub;
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');
    relGraficos();
  };

  const atalho = (periodo) => {
    const hoje = Utils.hoje();
    const el = (id) => document.getElementById(id);
    if (periodo === 'hoje') {
      el('rel-inicio').value = hoje;
      el('rel-fim').value = hoje;
    } else if (periodo === 'semana') {
      const d = new Date();
      const dow = d.getDay();
      const seg = new Date(d); seg.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      el('rel-inicio').value = seg.toISOString().substring(0, 10);
      el('rel-fim').value = hoje;
    } else if (periodo === 'mes') {
      el('rel-inicio').value = hoje.substring(0, 7) + '-01';
      el('rel-fim').value = hoje;
    } else if (periodo === 'mes_passado') {
      const d = new Date();
      const mp = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const mf = new Date(d.getFullYear(), d.getMonth(), 0);
      el('rel-inicio').value = mp.toISOString().substring(0, 10);
      el('rel-fim').value = mf.toISOString().substring(0, 10);
    }
    gerarRelatorio();
  };

  const gerarRelatorio = () => {
    const inicio = document.getElementById('rel-inicio')?.value || Utils.hoje();
    const fim = document.getElementById('rel-fim')?.value || Utils.hoje();

    if (tabAtiva === 'vendas') relVendas(inicio, fim);
    else if (tabAtiva === 'graficos') relGraficos();
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

    const cards = `
    <div class="summary-grid">
      <div class="stat-card" style="border-top:3px solid var(--primary)">
        <div class="stat-label">Total de Vendas</div>
        <div class="stat-value primary">${vendas.length}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--success)">
        <div class="stat-label">Faturamento</div>
        <div class="stat-value success">${Utils.moeda(totalGeral)}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--info)">
        <div class="stat-label">Ticket Médio</div>
        <div class="stat-value" style="color:var(--info)">${Utils.moeda(totalGeral / vendas.length)}</div>
      </div>
    </div>
    <div class="summary-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">💵 Dinheiro</div>
        <div class="stat-value" style="font-size:20px">${Utils.moeda(porForma.dinheiro)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📱 PIX</div>
        <div class="stat-value" style="font-size:20px">${Utils.moeda(porForma.pix)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💳 Cartão</div>
        <div class="stat-value" style="font-size:20px">${Utils.moeda(porForma.cartao_credito + porForma.cartao_debito)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📋 Crediário</div>
        <div class="stat-value" style="font-size:20px">${Utils.moeda(porForma.crediario)}</div>
      </div>
    </div>`;

    const tabela = `
    <div class="card">
      <div class="card-title">Detalhes das Vendas</div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Data / Hora</th><th>Itens</th><th>Formas de Pgto</th><th>Total</th>
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
      </div>
    </div>`;

    container.innerHTML = cards + tabela;
  };

  // ---- GRÁFICOS DIÁRIO / SEMANAL / MENSAL ----
  const relGraficos = () => {
    const container = document.getElementById('rel-graficos-content');
    if (!container) return;

    const todasVendas = DB.Vendas ? DB.Vendas.listarPorPeriodo('2000-01-01', Utils.hoje()) : [];
    const hoje = new Date();

    let dados = [];
    let tituloGrafico = '';
    let totalPeriodo = 0;
    let maiorDia = { label: '', v: 0 };

    if (subTabAtiva === 'diario') {
      tituloGrafico = 'Faturamento diário — últimos 7 dias';
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoje);
        d.setDate(hoje.getDate() - i);
        const ds = d.toISOString().substring(0, 10);
        const label = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        const v = todasVendas.filter(vd => vd.criadoEm && vd.criadoEm.startsWith(ds)).reduce((a, vd) => a + (parseFloat(vd.total) || 0), 0);
        dados.push({ label, v, ds });
        totalPeriodo += v;
        if (v > maiorDia.v) maiorDia = { label, v };
      }
    } else if (subTabAtiva === 'semanal') {
      tituloGrafico = 'Faturamento semanal — últimas 8 semanas';
      for (let i = 7; i >= 0; i--) {
        const inicioSem = new Date(hoje);
        const dow = hoje.getDay();
        inicioSem.setDate(hoje.getDate() - (dow === 0 ? 6 : dow - 1) - i * 7);
        const fimSem = new Date(inicioSem);
        fimSem.setDate(inicioSem.getDate() + 6);
        const iStr = inicioSem.toISOString().substring(0, 10);
        const fStr = fimSem.toISOString().substring(0, 10);
        const label = String(inicioSem.getDate()).padStart(2, '0') + '/' + String(inicioSem.getMonth() + 1).padStart(2, '0');
        const v = todasVendas.filter(vd => {
          if (!vd.criadoEm) return false;
          const d = vd.criadoEm.substring(0, 10);
          return d >= iStr && d <= fStr;
        }).reduce((a, vd) => a + (parseFloat(vd.total) || 0), 0);
        dados.push({ label, v });
        totalPeriodo += v;
        if (v > maiorDia.v) maiorDia = { label, v };
      }
    } else {
      tituloGrafico = 'Faturamento mensal — últimos 12 meses';
      const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const ano = d.getFullYear();
        const mes = d.getMonth();
        const prefixo = String(ano) + '-' + String(mes + 1).padStart(2, '0');
        const label = nomes[mes] + (i < 12 && ano !== hoje.getFullYear() ? ' ' + String(ano).slice(-2) : '');
        const v = todasVendas.filter(vd => vd.criadoEm && vd.criadoEm.startsWith(prefixo)).reduce((a, vd) => a + (parseFloat(vd.total) || 0), 0);
        dados.push({ label, v });
        totalPeriodo += v;
        if (v > maiorDia.v) maiorDia = { label, v };
      }
    }

    const ticketMedio = dados.filter(d => d.v > 0).length > 0
      ? totalPeriodo / dados.filter(d => d.v > 0).length
      : 0;

    const periodosComVenda = dados.filter(d => d.v > 0).length;

    container.innerHTML = `
      <div class="summary-grid" style="margin-bottom:16px">
        <div class="stat-card" style="border-top:3px solid var(--success)">
          <div class="stat-label">Total no período</div>
          <div class="stat-value success">${Utils.moeda(totalPeriodo)}</div>
        </div>
        <div class="stat-card" style="border-top:3px solid var(--primary)">
          <div class="stat-label">Média por ${subTabAtiva === 'diario' ? 'dia' : subTabAtiva === 'semanal' ? 'semana' : 'mês'}</div>
          <div class="stat-value primary">${Utils.moeda(ticketMedio)}</div>
        </div>
        <div class="stat-card" style="border-top:3px solid var(--info)">
          <div class="stat-label">Melhor ${subTabAtiva === 'diario' ? 'dia' : subTabAtiva === 'semanal' ? 'semana' : 'mês'}</div>
          <div class="stat-value" style="color:var(--info);font-size:20px">${maiorDia.label || '—'}</div>
          <div class="stat-sub">${Utils.moeda(maiorDia.v)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${subTabAtiva === 'diario' ? 'Dias' : subTabAtiva === 'semanal' ? 'Semanas' : 'Meses'} com venda</div>
          <div class="stat-value">${periodosComVenda}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">${tituloGrafico}</div>
        <div class="chart-container">
          <div class="chart-bars" id="grafico-relatorio"></div>
        </div>
      </div>`;

    Utils.renderGraficoBarras('grafico-relatorio', dados);
  };

  // ---- PRODUTOS MAIS VENDIDOS ----
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
        const key = item.produtoId || item.nome;
        if (!ranking[key]) {
          ranking[key] = { nome: item.nome, sku: item.sku || '', quantidade: 0, faturamento: 0 };
        }
        ranking[key].quantidade += item.quantidade;
        ranking[key].faturamento += item.precoUnitario * item.quantidade;
      });
    });

    const lista = Object.values(ranking).sort((a, b) => b.quantidade - a.quantidade);
    const medalhas = ['ouro', 'prata', 'bronze'];
    const numeros = ['1°', '2°', '3°'];

    const topHtml = lista.slice(0, 10).map((p, i) => `
      <div class="ranking-item">
        <div class="rank-pos ${medalhas[i] || ''}">${numeros[i] || (i + 1) + '°'}</div>
        <div class="rank-info">
          <div class="rank-nome">${p.nome}</div>
          <div class="rank-sub">${p.sku ? 'SKU: ' + p.sku : 'Sem SKU'}</div>
        </div>
        <div class="rank-stats">
          <div class="rank-qty">${p.quantidade} un.</div>
          <div class="rank-rev">${Utils.moeda(p.faturamento)}</div>
        </div>
      </div>`).join('');

    // Gráfico dos top 8
    const dadosGraf = lista.slice(0, 8).map(p => ({
      label: p.nome.length > 10 ? p.nome.substring(0, 10) + '…' : p.nome,
      v: p.quantidade
    }));

    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Top produtos por quantidade vendida</div>
        <div class="chart-container">
          <div class="chart-bars" id="grafico-produtos"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🏆 Ranking completo</div>
        <div style="padding:16px">${topHtml}</div>
        ${lista.length > 10 ? `<div style="padding:0 16px 16px;font-size:12px;color:var(--text-muted)">+${lista.length - 10} produtos...</div>` : ''}
      </div>`;

    Utils.renderGraficoBarras('grafico-produtos', dadosGraf);
  };

  // ---- RELATÓRIO DE ESTOQUE ----
  const relEstoque = () => {
    const produtos = DB.Produtos.listarAtivos();
    const container = document.getElementById('rel-estoque-content');
    if (!container) return;

    let totalCusto = 0, totalVenda = 0, totalItens = 0, semEstoque = 0;

    produtos.forEach(p => {
      const tot = DB.Produtos.estoqueTotal(p);
      totalItens += tot;
      totalCusto += (p.precoCusto || 0) * tot;
      totalVenda += (p.precoVenda || 0) * tot;
      if (tot === 0) semEstoque++;
    });

    const cards = `
    <div class="summary-grid" style="margin-bottom:20px">
      <div class="stat-card" style="border-top:3px solid var(--primary)">
        <div class="stat-label">Total em peças</div>
        <div class="stat-value primary">${totalItens}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--warning)">
        <div class="stat-label">Valor de Custo</div>
        <div class="stat-value warning">${Utils.moeda(totalCusto)}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--success)">
        <div class="stat-label">Valor de Venda</div>
        <div class="stat-value success">${Utils.moeda(totalVenda)}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--info)">
        <div class="stat-label">Margem Potencial</div>
        <div class="stat-value" style="color:var(--info)">${Utils.moeda(totalVenda - totalCusto)}</div>
      </div>
      <div class="stat-card" style="border-top:3px solid var(--danger)">
        <div class="stat-label">Produtos sem estoque</div>
        <div class="stat-value danger">${semEstoque}</div>
      </div>
    </div>`;

    const tabela = `
    <div class="card">
      <div class="card-title">Estoque por produto</div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Produto</th><th>Tipo</th><th>Preço Venda</th><th>Estoque Total</th><th>Valor Total</th><th>Variações</th>
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
      </div>
    </div>`;

    container.innerHTML = cards + tabela;
  };

  // ---- INADIMPLENTES ----
  const relInadimplentes = () => {
    const container = document.getElementById('rel-inadimplentes-content');
    if (!container) return;

    const hoje = Utils.hoje();
    const todos = DB.Crediario.listar();
    const inadimplentes = [];

    todos.forEach(cr => {
      const atrasadas = (cr.parcelas || []).filter(p => p.status !== 'pago' && p.vencimento < hoje);
      if (atrasadas.length) {
        const total = atrasadas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
        inadimplentes.push({ clienteNome: cr.clienteNome, parcelas: atrasadas.length, total, maiorAtraso: atrasadas[0].vencimento });
      }
    });

    const porCliente = {};
    inadimplentes.forEach(i => {
      if (!porCliente[i.clienteNome]) {
        porCliente[i.clienteNome] = { parcelas: 0, total: 0, maiorAtraso: i.maiorAtraso };
      }
      porCliente[i.clienteNome].parcelas += i.parcelas;
      porCliente[i.clienteNome].total += i.total;
      if (i.maiorAtraso < porCliente[i.clienteNome].maiorAtraso) porCliente[i.clienteNome].maiorAtraso = i.maiorAtraso;
    });

    const lista = Object.entries(porCliente).sort((a, b) => b[1].total - a[1].total);

    if (!lista.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">🎉</span><div class="empty-text">Nenhum cliente inadimplente!</div><div class="empty-sub">Todos os pagamentos estão em dia.</div></div>`;
      return;
    }

    const totalInadimplente = lista.reduce((s, [, v]) => s + v.total, 0);

    container.innerHTML = `
    <div class="stat-card" style="margin-bottom:16px;border-top:3px solid var(--danger)">
      <div class="stat-label">Total em aberto (atrasado)</div>
      <div class="stat-value danger">${Utils.moeda(totalInadimplente)}</div>
      <div class="stat-sub">${lista.length} cliente(s) com atraso</div>
    </div>
    <div class="card">
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
      </div>
    </div>`;
  };

  const bindEventos = () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });

    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) btnGerar.addEventListener('click', gerarRelatorio);

    const btnImprimir = document.getElementById('btn-imprimir-rel');
    if (btnImprimir) btnImprimir.addEventListener('click', () => window.print());
  };

  return { init, setTab, setSubTab, atalho };
})();

document.addEventListener('DOMContentLoaded', RelatoriosPage.init);
