/**
 * MOVE PÉ - Financeiro v2.0
 */

const Financeiro = {

  init: () => {
    Utils.renderNav('financeiro.html');
    Financeiro.render();

    const mesInput = document.getElementById('inputMesComissao');
    mesInput.value = Utils.hoje().substring(0, 7);
    mesInput.addEventListener('change', () => Financeiro.renderComissoes());

    document.getElementById('inputMesTaxas').value = Utils.hoje().substring(0, 7);
  },

  render: () => {
    Financeiro.renderStats();
    Financeiro.renderGrafico6Meses();
    Financeiro.renderComissoes();
    Financeiro.renderTaxasCartao();
    Financeiro.renderMovimentacoes();
  },

  renderComissoes: () => {
    const vendedores = DB.Config.get('vendedores', []);
    const card = document.getElementById('cardComissoes');
    if (vendedores.length === 0) { card.style.display = 'none'; return; }
    card.style.display = '';

    const mes = document.getElementById('inputMesComissao').value || Utils.hoje().substring(0, 7);
    const vendas = DB.Vendas.listar().filter(v => (v.criadoEm || '').startsWith(mes));

    // Agrupar vendas por vendedor
    const porVendedor = {};
    vendedores.forEach(v => { porVendedor[v.nome] = { nome: v.nome, comissao: v.comissao, qtd: 0, total: 0 }; });

    vendas.forEach(v => {
      if (v.vendedorNome && porVendedor[v.vendedorNome]) {
        porVendedor[v.vendedorNome].qtd++;
        porVendedor[v.vendedorNome].total += parseFloat(v.total) || 0;
      }
    });

    const linhas = Object.values(porVendedor);
    const totalGeralComissao = linhas.reduce((s, l) => s + (l.total * l.comissao / 100), 0);

    const cont = document.getElementById('comissoesConteudo');
    if (linhas.every(l => l.qtd === 0)) {
      cont.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center">Nenhuma venda com vendedor em ${mes.split('-').reverse().join('/')}</div>`;
      return;
    }

    cont.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th style="text-align:center">Comissão</th>
              <th style="text-align:right">Qtd Vendas</th>
              <th style="text-align:right">Total Vendido</th>
              <th style="text-align:right">Comissão (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${linhas.map(l => {
              const comissaoVal = l.total * l.comissao / 100;
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 8px;font-weight:600">${l.nome}</td>
                <td style="padding:10px 8px;text-align:center"><span class="badge badge-primary">${l.comissao}%</span></td>
                <td style="padding:10px 8px;text-align:right">${l.qtd}</td>
                <td style="padding:10px 8px;text-align:right">${Utils.moeda(l.total)}</td>
                <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--success)">${Utils.moeda(comissaoVal)}</td>
              </tr>`;
            }).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td colspan="4" style="padding:10px 8px;text-align:right">Total de comissões:</td>
              <td style="padding:10px 8px;text-align:right;color:var(--success);font-size:16px">${Utils.moeda(totalGeralComissao)}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  },

  imprimirComissoes: () => {
    const vendedores = DB.Config.get('vendedores', []);
    if (vendedores.length === 0) return;
    const mes = document.getElementById('inputMesComissao').value || Utils.hoje().substring(0, 7);
    const vendas = DB.Vendas.listar().filter(v => (v.criadoEm || '').startsWith(mes));

    const porVendedor = {};
    vendedores.forEach(v => { porVendedor[v.nome] = { nome: v.nome, comissao: v.comissao, qtd: 0, total: 0 }; });
    vendas.forEach(v => {
      if (v.vendedorNome && porVendedor[v.vendedorNome]) {
        porVendedor[v.vendedorNome].qtd++;
        porVendedor[v.vendedorNome].total += parseFloat(v.total) || 0;
      }
    });

    const linhas = Object.values(porVendedor);
    const totalGeralComissao = linhas.reduce((s, l) => s + (l.total * l.comissao / 100), 0);
    const [ano, m] = mes.split('-');
    const nomeMes = new Date(parseInt(ano), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const texto = [
      '========================================',
      '       MOVE PÉ — COMISSÕES              ',
      `       ${nomeMes.toUpperCase()}`,
      '========================================',
      ...linhas.map(l => [
        `Vendedor: ${l.nome}`,
        `  Comissão: ${l.comissao}%`,
        `  Vendas: ${l.qtd} | Total: ${Utils.moeda(l.total)}`,
        `  Comissão R$: ${Utils.moeda(l.total * l.comissao / 100)}`,
        ''
      ].join('\n')),
      '----------------------------------------',
      `TOTAL COMISSÕES: ${Utils.moeda(totalGeralComissao)}`,
      '========================================'
    ].join('\n');

    Utils.imprimirComprovante(texto);
  },

  calcularTotais: () => {
    const hoje = Utils.hoje();
    const mesAtual = hoje.substring(0, 7);
    const inicioMes = mesAtual + '-01';

    // Entradas do mês (vendas + reforços)
    const vendasMes = DB.Vendas.listarPorPeriodo(inicioMes, hoje)
      .filter(v => v.formaPagamento !== 'crediario');
    const totalVendasMes = vendasMes.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    const fluxoMes = DB.FluxoCaixa.listar().filter(f => (f.data || '').startsWith(mesAtual));
    const entradasExtra = fluxoMes.filter(f => f.tipo === 'entrada' && f.categoria !== 'venda')
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
    const saidasMes = fluxoMes.filter(f => f.tipo === 'saida')
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

    const totalEntradas = totalVendasMes + entradasExtra;
    const saldo = totalEntradas - saidasMes;

    // Crediário pendente
    const aReceber = DB.Crediario.totalPendente();

    return { totalEntradas, saidasMes, saldo, aReceber };
  },

  renderStats: () => {
    const { totalEntradas, saidasMes, saldo, aReceber } = Financeiro.calcularTotais();

    document.getElementById('statEntradas').textContent = Utils.moeda(totalEntradas);
    document.getElementById('statSaidas').textContent = Utils.moeda(saidasMes);
    document.getElementById('statSaldo').textContent = Utils.moeda(saldo);
    document.getElementById('statAReceber').textContent = Utils.moeda(aReceber);
    document.getElementById('statSaldo').className = 'stat-value ' + (saldo >= 0 ? 'success' : 'danger');

    // Taxas do mês
    const mesAtual = Utils.hoje().substring(0, 7);
    const vendasMes = DB.Vendas.listarPorPeriodo(mesAtual + '-01', Utils.hoje());
    const totalTaxas = vendasMes.reduce((s, v) => s + (parseFloat(v.valorTaxaCartao) || 0), 0);
    const receitaLiquida = totalEntradas - totalTaxas;
    document.getElementById('statTaxasCartao').textContent = Utils.moeda(totalTaxas);
    document.getElementById('statTaxasSub').textContent = totalTaxas > 0 ? 'em taxas este mês' : 'sem taxas registradas';
    document.getElementById('statReceitaLiquida').textContent = Utils.moeda(receitaLiquida);
    document.getElementById('statReceitaLiquida').className = 'stat-value ' + (receitaLiquida >= 0 ? 'success' : 'danger');
  },

  renderTaxasCartao: () => {
    const cont = document.getElementById('taxasConteudo');
    const mes = document.getElementById('inputMesTaxas').value || Utils.hoje().substring(0, 7);
    const vendas = DB.Vendas.listarPorPeriodo(mes + '-01', mes + '-31');

    const grupos = {
      cartao_debito:  { label: '💳 Débito',       qtd: 0, bruto: 0, taxa: 0 },
      cartao_credito: { label: '💳 Crédito',       qtd: 0, bruto: 0, taxa: 0 },
      pix:            { label: '📱 PIX',            qtd: 0, bruto: 0, taxa: 0 },
    };

    vendas.forEach(v => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        v.formasPagamento.forEach(f => {
          if (grupos[f.forma]) {
            grupos[f.forma].qtd++;
            grupos[f.forma].bruto += parseFloat(f.valor) || 0;
            grupos[f.forma].taxa  += parseFloat(f.valorTaxa) || 0;
          }
        });
      } else if (grupos[v.formaPagamento]) {
        grupos[v.formaPagamento].qtd++;
        grupos[v.formaPagamento].bruto += parseFloat(v.total) || 0;
        grupos[v.formaPagamento].taxa  += parseFloat(v.valorTaxaCartao) || 0;
      }
    });

    const totalBruto = Object.values(grupos).reduce((s, g) => s + g.bruto, 0);
    const totalTaxa  = Object.values(grupos).reduce((s, g) => s + g.taxa,  0);
    const totalLiq   = totalBruto - totalTaxa;

    const temDados = Object.values(grupos).some(g => g.qtd > 0);
    const [ano, m] = mes.split('-');
    const nomeMes = new Date(parseInt(ano), parseInt(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (!temDados) {
      cont.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center">Nenhuma venda com cartão/PIX em ${nomeMes}</div>`;
      return;
    }

    cont.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Forma</th>
              <th style="text-align:right">Qtd</th>
              <th style="text-align:right">Bruto recebido</th>
              <th style="text-align:right">Taxa estimada</th>
              <th style="text-align:right">Líquido</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(grupos).filter(([,g]) => g.qtd > 0).map(([, g]) => `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:10px 8px;font-weight:600">${g.label}</td>
                <td style="padding:10px 8px;text-align:right">${g.qtd}</td>
                <td style="padding:10px 8px;text-align:right">${Utils.moeda(g.bruto)}</td>
                <td style="padding:10px 8px;text-align:right;color:var(--danger);font-weight:600">− ${Utils.moeda(g.taxa)}</td>
                <td style="padding:10px 8px;text-align:right;font-weight:700;color:var(--success)">${Utils.moeda(g.bruto - g.taxa)}</td>
              </tr>`).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:700;background:var(--card-bg)">
              <td style="padding:10px 8px">Total</td>
              <td style="padding:10px 8px;text-align:right">${Object.values(grupos).reduce((s,g)=>s+g.qtd,0)}</td>
              <td style="padding:10px 8px;text-align:right">${Utils.moeda(totalBruto)}</td>
              <td style="padding:10px 8px;text-align:right;color:var(--danger)">− ${Utils.moeda(totalTaxa)}</td>
              <td style="padding:10px 8px;text-align:right;font-size:15px;color:var(--success)">${Utils.moeda(totalLiq)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${totalTaxa === 0 ? '<div class="text-muted fs-sm" style="margin-top:8px;padding:0 4px">⚠️ Taxas zeradas — configure as taxas da maquininha em <a href="configuracoes.html">Configurações</a>.</div>' : ''}`;
  },

  renderGrafico6Meses: () => {
    const resumo = DB.FluxoCaixa.resumoPorMeses(6);
    const dados = resumo.map(r => ({
      label: r.label,
      v1: r.entradas,
      v2: r.saidas
    }));
    Utils.renderGraficoBarras('grafico6Meses', dados, { dual: true });

    // Legenda
    document.getElementById('graficoLegenda').innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)">
        <span style="width:12px;height:12px;background:var(--success);border-radius:2px;display:inline-block"></span> Entradas
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)">
        <span style="width:12px;height:12px;background:var(--info);border-radius:2px;display:inline-block"></span> Saídas
      </span>`;
  },

  renderMovimentacoes: () => {
    // Combinar vendas e fluxo de caixa
    const movs = [];

    // Vendas (entradas)
    DB.Vendas.listar().forEach(v => {
      if (v.formaPagamento !== 'crediario') {
        movs.push({
          tipo: 'entrada',
          descricao: `Venda #${(v.id || '').substring(0, 8).toUpperCase()}${v.clienteNome ? ' - ' + v.clienteNome : ''}`,
          valor: v.total,
          data: v.criadoEm,
          categoria: 'venda'
        });
      }
    });

    // Crediário recebido
    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach((p, idx) => {
        if (p.status === 'pago' && p.dataPagamento) {
          movs.push({
            tipo: 'entrada',
            descricao: `Crediário - ${cred.clienteNome} - Parcela ${p.numero}/${cred.parcelas.length}`,
            valor: p.valor,
            data: p.dataPagamento,
            categoria: 'crediario'
          });
        }
      });
    });

    // Fluxo de caixa (sangrias, reforços, etc)
    DB.FluxoCaixa.listar().forEach(f => {
      if (f.categoria !== 'venda' && f.categoria !== 'crediario') {
        movs.push(f);
      }
    });

    // Ordenar do mais recente
    movs.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    const cont = document.getElementById('movimentacoesCont');
    if (movs.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💵</div>
        <div class="empty-title">Nenhuma movimentação</div>
        <div class="empty-sub">As movimentações aparecerão aqui automaticamente</div>
      </div>`;
      return;
    }

    cont.innerHTML = movs.slice(0, 50).map(m => {
      const icon = m.tipo === 'entrada' ? '⬆️' : '⬇️';
      return `
        <div class="financeiro-mov-item">
          <div class="financeiro-tipo-icon ${m.tipo}">${icon}</div>
          <div class="financeiro-mov-info">
            <div class="financeiro-mov-desc">${m.descricao || ''}</div>
            <div class="financeiro-mov-det">${Utils.dataHora(m.data)} · ${m.categoria || ''}</div>
          </div>
          <div class="financeiro-mov-val ${m.tipo}">
            ${m.tipo === 'entrada' ? '+' : '-'} ${Utils.moeda(m.valor)}
          </div>
        </div>`;
    }).join('');
  }
};

document.addEventListener('DOMContentLoaded', Financeiro.init);
document.addEventListener('movePe-sync', () => Financeiro.render());
