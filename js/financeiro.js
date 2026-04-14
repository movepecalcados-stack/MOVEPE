/**
 * MOVE PÉ - Financeiro v3.0
 * Foco em lucro real: DRE, precificação, contas, metas
 */

let _tabAtual = 'resumo';
let _subContasAtual = 'pagar';
let _despesaEditando = null;

const Fin = {

  init: () => {
    Utils.renderNav('financeiro.html');
    Utils.initModais();

    const hoje = Utils.hoje().substring(0, 7);
    document.getElementById('inputMesGlobal').value = hoje;
    document.getElementById('inputMesGlobal').addEventListener('change', () => Fin.render());

    Fin.render();
  },

  getMes: () => document.getElementById('inputMesGlobal').value || Utils.hoje().substring(0, 7),

  setTab: (tab, btn) => {
    _tabAtual = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    ['resumo','dre','precificacao','contas','metas','diagnostico'].forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    Fin.render();
  },

  setSubContas: (sub, btn) => {
    _subContasAtual = sub;
    document.querySelectorAll('.tab-btn-sub').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('contasPagar').style.display  = sub === 'pagar'   ? '' : 'none';
    document.getElementById('contasReceber').style.display = sub === 'receber' ? '' : 'none';
    const btnNova = document.getElementById('btnNovaDespesa');
    if (btnNova) btnNova.style.display = sub === 'pagar' ? 'flex' : 'none';
    Fin.renderContas();
  },

  render: () => {
    if (_tabAtual === 'resumo')       Fin.renderResumo();
    if (_tabAtual === 'dre')          Fin.renderDRE();
    if (_tabAtual === 'precificacao') Fin.renderPrecificacao();
    if (_tabAtual === 'contas')       Fin.renderContas();
    if (_tabAtual === 'metas')        Fin.renderMetas();
    if (_tabAtual === 'diagnostico')  Fin.renderDiagnostico();
  },

  // ---- CÁLCULOS BASE ----
  calcularDRE: (mes) => {
    const inicio = mes + '-01';
    const fim    = mes + '-31';

    // Receita bruta (vendas pagas no mês)
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim)
      .filter(v => v.formaPagamento !== 'crediario');
    const receitaBruta = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    // CMV — custo das mercadorias vendidas
    // Usa precoCusto salvo no item; se não tiver (vendas antigas), busca do produto atual
    const produtosCache = {};
    let cmv = 0;
    vendas.forEach(v => {
      if (v.itens && v.itens.length) {
        v.itens.forEach(item => {
          let custo = parseFloat(item.precoCusto) || 0;
          if (!custo && item.produtoId) {
            if (!produtosCache[item.produtoId]) {
              produtosCache[item.produtoId] = DB.Produtos.buscar(item.produtoId);
            }
            const prod = produtosCache[item.produtoId];
            custo = prod ? (parseFloat(prod.precoCusto) || 0) : 0;
          }
          const qty = parseInt(item.quantidade) || 1;
          cmv += custo * qty;
        });
      }
    });

    // Crediário recebido no mês
    let crediarioRecebido = 0;
    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' && p.dataPagamento && p.dataPagamento.startsWith(mes)) {
          crediarioRecebido += parseFloat(p.valor) || 0;
        }
      });
    });

    // Taxas de cartão
    const taxasCartao = vendas.reduce((s, v) => s + (parseFloat(v.valorTaxaCartao) || 0), 0);

    // Despesas cadastradas
    const despesas = DB.Despesas.listar().filter(d =>
      d.recorrente || (d.vencimento || '').startsWith(mes)
    );
    const despFixas = despesas.filter(d => d.categoria === 'fixo' || d.recorrente)
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const despVariaveis = despesas.filter(d => d.categoria === 'variavel' || d.categoria === 'imposto' || d.categoria === 'outros')
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // Outras entradas (reforços, etc.)
    const fluxoMes = DB.FluxoCaixa.listar().filter(f => (f.data || '').startsWith(mes));
    const outrasEntradas = fluxoMes.filter(f => f.tipo === 'entrada' && f.categoria !== 'venda')
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

    const lucroBruto   = receitaBruta - cmv;
    const totalDespesas = despFixas + despVariaveis + taxasCartao;
    const lucroLiquido = lucroBruto - totalDespesas;
    const margemBruta  = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta, cmv, lucroBruto, margemBruta,
      despFixas, despVariaveis, taxasCartao, totalDespesas,
      lucroLiquido, margemLiquida,
      crediarioRecebido, outrasEntradas,
      qtdVendas: vendas.length
    };
  },

  // ---- ABA RESUMO ----
  renderResumo: () => {
    Fin.renderMetaDia();
    const mes = Fin.getMes();
    const d   = Fin.calcularDRE(mes);
    const aReceber = DB.Crediario.totalPendente();

    const stats = [
      { label: 'Receita Bruta', valor: d.receitaBruta, cor: 'success', sub: `${d.qtdVendas} vendas` },
      { label: 'Custo Mercadorias (CMV)', valor: d.cmv, cor: 'danger', sub: 'custo dos produtos vendidos' },
      { label: 'Lucro Bruto', valor: d.lucroBruto, cor: d.lucroBruto >= 0 ? 'success' : 'danger', sub: `Margem: ${d.margemBruta.toFixed(1)}%` },
      { label: 'Despesas do Mês', valor: d.totalDespesas, cor: 'danger', sub: 'fixas + variáveis + taxas' },
      { label: 'Lucro Líquido', valor: d.lucroLiquido, cor: d.lucroLiquido >= 0 ? 'success' : 'danger', sub: `Margem: ${d.margemLiquida.toFixed(1)}%`, destaque: true },
      { label: 'A Receber (crediário)', valor: aReceber, cor: 'warning', sub: 'saldo total em aberto' },
    ];

    document.getElementById('statsResumo').innerHTML = stats.map(s => `
      <div class="stat-card ${s.destaque ? 'stat-destaque' : ''}">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value ${s.cor}">${Utils.moeda(s.valor)}</div>
        ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
      </div>`).join('');

    // Gráfico 6 meses
    const resumo = DB.FluxoCaixa.resumoPorMeses(6);
    const dados = resumo.map(r => ({ label: r.label, v1: r.entradas, v2: r.saidas }));
    Utils.renderGraficoBarras('grafico6Meses', dados, { dual: true });
    document.getElementById('graficoLegenda').innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)">
        <span style="width:12px;height:12px;background:var(--success);border-radius:2px;display:inline-block"></span> Entradas
      </span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--text-muted)">
        <span style="width:12px;height:12px;background:var(--info);border-radius:2px;display:inline-block"></span> Saídas
      </span>`;

    // Movimentações
    Fin._renderMovimentacoes(mes);
  },

  _renderMovimentacoes: (mes) => {
    const movs = [];
    const inicio = mes + '-01', fim = mes + '-31';

    DB.Vendas.listarPorPeriodo(inicio, fim).forEach(v => {
      if (v.formaPagamento !== 'crediario') {
        movs.push({ tipo: 'entrada', descricao: `Venda ${v.clienteNome ? '— ' + v.clienteNome : ''}`, valor: v.total, data: v.criadoEm, categoria: 'Venda' });
      }
    });
    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' && (p.dataPagamento || '').startsWith(mes)) {
          movs.push({ tipo: 'entrada', descricao: `Crediário — ${cred.clienteNome || ''} Parcela ${p.numero}`, valor: p.valor, data: p.dataPagamento, categoria: 'Crediário' });
        }
      });
    });
    DB.FluxoCaixa.listar().filter(f => (f.data || '').startsWith(mes) && f.categoria !== 'venda').forEach(f => movs.push(f));

    movs.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    const cont = document.getElementById('cardMovs');
    if (!movs.length) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">💵</div><div class="empty-title">Nenhuma movimentação no mês</div></div>`;
      return;
    }
    cont.innerHTML = movs.slice(0, 50).map(m => `
      <div class="financeiro-mov-item">
        <div class="financeiro-tipo-icon ${m.tipo}">${m.tipo === 'entrada' ? '⬆️' : '⬇️'}</div>
        <div class="financeiro-mov-info">
          <div class="financeiro-mov-desc">${m.descricao || ''}</div>
          <div class="financeiro-mov-det">${Utils.dataHora(m.data)} · ${m.categoria || ''}</div>
        </div>
        <div class="financeiro-mov-val ${m.tipo}">${m.tipo === 'entrada' ? '+' : '−'} ${Utils.moeda(m.valor)}</div>
      </div>`).join('');
  },

  // ---- ABA DRE ----
  renderDRE: () => {
    const mes = Fin.getMes();
    const d   = Fin.calcularDRE(mes);
    const [ano, m] = mes.split('-');
    const nomeMes = new Date(parseInt(ano), parseInt(m) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();

    const linha = (label, valor, tipo = '', sub = '') => {
      const cor = tipo === 'pos' ? 'var(--success)' : tipo === 'neg' ? 'var(--danger)' : 'var(--text)';
      const sinal = tipo === 'neg' ? '−' : tipo === 'pos' ? '' : '';
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:14px">${label}</div>
            ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
          </div>
          <div style="font-weight:700;font-size:15px;color:${cor}">${sinal} ${Utils.moeda(valor)}</div>
        </div>`;
    };

    const separador = (label) => `
      <div style="padding:8px 0 4px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-top:8px">${label}</div>`;

    document.getElementById('dreConteudo').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin:0">📋 DRE — ${nomeMes}</div>
      </div>
      ${separador('Receitas')}
      ${linha('Receita Bruta de Vendas', d.receitaBruta, 'pos', `${d.qtdVendas} vendas no mês`)}
      ${d.crediarioRecebido > 0 ? linha('(+) Crediário Recebido', d.crediarioRecebido, 'pos') : ''}
      ${separador('Custos')}
      ${linha('(−) Custo das Mercadorias Vendidas (CMV)', d.cmv, 'neg', 'custo de compra dos produtos vendidos')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:2px solid var(--border);border-top:2px solid var(--border);background:rgba(var(--success-rgb),.05);margin:8px -16px;padding:12px 16px">
        <div style="font-weight:700;font-size:15px">= LUCRO BRUTO</div>
        <div style="font-weight:800;font-size:18px;color:${d.lucroBruto >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(d.lucroBruto)} <span style="font-size:12px;font-weight:600">(${d.margemBruta.toFixed(1)}%)</span></div>
      </div>
      ${separador('Despesas Operacionais')}
      ${linha('(−) Despesas Fixas', d.despFixas, 'neg', 'aluguel, salários, energia...')}
      ${linha('(−) Despesas Variáveis', d.despVariaveis, 'neg', 'fornecedores, fretes, outros')}
      ${linha('(−) Taxas de Cartão / PIX', d.taxasCartao, 'neg', 'cobradas pela maquininha')}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:${d.lucroLiquido >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};border-radius:var(--radius-sm);margin-top:12px">
        <div style="font-weight:700;font-size:16px">= LUCRO LÍQUIDO</div>
        <div style="font-weight:800;font-size:22px;color:${d.lucroLiquido >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(d.lucroLiquido)} <span style="font-size:13px;font-weight:600">(${d.margemLiquida.toFixed(1)}%)</span></div>
      </div>`;

    // Card de alertas e observações
    const obs = [];
    if (d.cmv === 0) obs.push('⚠️ CMV zerado — cadastre o <strong>Preço de Custo</strong> nos produtos para calcular o lucro real.');
    if (d.despFixas === 0 && d.despVariaveis === 0) obs.push('⚠️ Nenhuma despesa cadastrada — vá em <strong>Contas</strong> e registre seus gastos fixos para ver o lucro real.');
    if (d.margemLiquida < 10 && d.receitaBruta > 0) obs.push('🔴 Margem líquida baixa (menos de 10%) — revise preços e despesas.');
    if (d.margemBruta > 0 && d.margemBruta < 30) obs.push('🟡 Margem bruta abaixo de 30% — considere revisar os preços de compra ou venda.');

    document.getElementById('dreMargens').innerHTML = obs.length ? `
      <div class="card-title">💡 Observações</div>
      ${obs.map(o => `<div style="padding:8px 12px;border-left:3px solid var(--warning);margin-bottom:8px;font-size:13px;border-radius:0 4px 4px 0;background:rgba(234,179,8,.08)">${o}</div>`).join('')}` :
      `<div class="card-title">✅ DRE sem alertas</div><div class="text-muted fs-sm">Todos os dados parecem preenchidos corretamente.</div>`;
  },

  // ---- ABA PRECIFICAÇÃO ----
  renderPrecificacao: () => {
    Fin.calcPreco();
    Fin._renderTabelaMargens();
  },

  calcPreco: () => {
    const custo   = parseFloat(document.getElementById('precCusto').value) || 0;
    const pDesp   = parseFloat(document.getElementById('precDesp').value) || 0;
    const pLucro  = parseFloat(document.getElementById('precLucro').value) || 0;
    const res     = document.getElementById('precResultado');

    if (!custo) {
      res.innerHTML = '<div class="text-muted fs-sm">Informe o custo do produto para calcular.</div>';
      return;
    }

    // Fórmula: Preço = Custo / (1 - %Despesas - %Lucro)
    const divisor = 1 - (pDesp / 100) - (pLucro / 100);
    if (divisor <= 0) {
      res.innerHTML = '<div style="color:var(--danger)">% de despesas + lucro não pode ser ≥ 100%</div>';
      return;
    }

    const precoIdeal   = custo / divisor;
    const precoMinimo  = custo / (1 - pDesp / 100); // cobre custo + despesas, lucro zero
    const margemBruta  = ((precoIdeal - custo) / precoIdeal) * 100;
    const lucroReais   = precoIdeal - custo - (precoIdeal * pDesp / 100);

    // Sugestões de markup
    const precos = [
      { label: 'Preço mínimo (sem lucro)', valor: precoMinimo, cor: 'var(--danger)' },
      { label: `Preço ideal (${pLucro}% lucro)`, valor: precoIdeal, cor: 'var(--success)', destaque: true },
      { label: '+5% margem extra', valor: custo / (divisor - 0.05), cor: 'var(--primary)' },
    ];

    res.innerHTML = `
      ${precos.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:8px;background:var(--bg);border:${p.destaque ? '2px solid var(--primary)' : '1px solid var(--border)'}">
          <div style="font-size:13px;font-weight:${p.destaque ? '700' : '500'}">${p.label}</div>
          <div style="font-size:${p.destaque ? '20px' : '16px'};font-weight:800;color:${p.cor}">${Utils.moeda(p.valor)}</div>
        </div>`).join('')}
      <div style="margin-top:12px;padding:10px 12px;background:rgba(99,102,241,.07);border-radius:var(--radius-sm);font-size:13px">
        <div>💰 Lucro por peça: <strong>${Utils.moeda(lucroReais)}</strong></div>
        <div>📊 Margem bruta: <strong>${margemBruta.toFixed(1)}%</strong></div>
        <div>🔢 Markup sobre custo: <strong>${(((precoIdeal / custo) - 1) * 100).toFixed(1)}%</strong></div>
      </div>`;
  },

  _renderTabelaMargens: () => {
    const produtos = DB.Produtos.listarAtivos();
    const cont = document.getElementById('tabelaMargens');
    if (!produtos.length) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px">Nenhum produto cadastrado.</div>';
      return;
    }

    const linhas = produtos
      .filter(p => p.precoVenda && p.precoCusto)
      .map(p => {
        const venda  = parseFloat(p.precoVenda) || 0;
        const custo  = parseFloat(p.precoCusto) || 0;
        const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
        const lucro  = venda - custo;
        return { p, venda, custo, margem, lucro };
      })
      .sort((a, b) => a.margem - b.margem);

    if (!linhas.length) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px">Cadastre o <strong>Preço de Custo</strong> nos produtos para ver as margens.</div>';
      return;
    }

    cont.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Produto</th>
            <th style="text-align:right">Custo</th>
            <th style="text-align:right">Venda</th>
            <th style="text-align:right">Lucro/un</th>
            <th style="text-align:right">Margem</th>
          </tr></thead>
          <tbody>
            ${linhas.map(l => {
              const corMargem = l.margem < 20 ? 'var(--danger)' : l.margem < 35 ? 'var(--warning)' : 'var(--success)';
              return `<tr>
                <td style="padding:9px 8px;font-weight:600;font-size:13px">${l.p.nome}<br><span style="font-size:11px;color:var(--text-muted);font-weight:400">${l.p.marca || ''}</span></td>
                <td style="padding:9px 8px;text-align:right;font-size:13px">${Utils.moeda(l.custo)}</td>
                <td style="padding:9px 8px;text-align:right;font-size:13px">${Utils.moeda(l.venda)}</td>
                <td style="padding:9px 8px;text-align:right;font-weight:700;font-size:13px">${Utils.moeda(l.lucro)}</td>
                <td style="padding:9px 8px;text-align:right">
                  <span style="font-weight:800;color:${corMargem};font-size:14px">${l.margem.toFixed(1)}%</span>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="text-muted fs-sm" style="padding:8px 4px">
        🔴 &lt; 20% risco | 🟡 20–35% atenção | 🟢 &gt; 35% saudável
      </div>`;
  },

  // ---- ABA CONTAS ----
  renderContas: () => {
    if (_subContasAtual === 'pagar') Fin._renderDespesas();
    else Fin._renderReceber();
  },

  _renderDespesas: () => {
    const mes      = Fin.getMes();
    const despesas = DB.Despesas.listar().filter(d =>
      d.recorrente || (d.vencimento || '').startsWith(mes)
    ).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const hoje = Utils.hoje();
    const cont = document.getElementById('listaDespesas');

    const totalPendente = despesas.filter(d => !d.pago).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalPago     = despesas.filter(d => d.pago).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    if (!despesas.length) {
      cont.innerHTML = `<div class="empty-state" style="padding:40px 20px">
        <div class="empty-icon">📅</div>
        <div class="empty-title">Nenhuma despesa cadastrada</div>
        <div class="empty-sub">Cadastre aluguel, salários, energia e outros gastos</div>
      </div>`;
      return;
    }

    cont.innerHTML = `
      <div style="display:flex;gap:16px;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);flex-wrap:wrap">
        <span style="font-size:13px">Pendente: <strong style="color:var(--danger)">${Utils.moeda(totalPendente)}</strong></span>
        <span style="font-size:13px">Pago: <strong style="color:var(--success)">${Utils.moeda(totalPago)}</strong></span>
        <span style="font-size:13px">Total: <strong>${Utils.moeda(totalPendente + totalPago)}</strong></span>
      </div>
      ${despesas.map(d => {
        const vencida  = !d.pago && d.vencimento && d.vencimento < hoje;
        const venceHoje = !d.pago && d.vencimento === hoje;
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);${d.pago ? 'opacity:.55' : ''}">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px">${d.descricao}</div>
            <div style="font-size:12px;color:var(--text-muted)">
              ${d.categoria || ''} ${d.recorrente ? '· Recorrente' : ''}
              ${d.vencimento ? '· Vence: ' + Utils.data(d.vencimento) : ''}
              ${vencida ? '<span style="color:var(--danger);font-weight:700"> ⚠ VENCIDA</span>' : ''}
              ${venceHoje ? '<span style="color:var(--warning);font-weight:700"> ⚡ VENCE HOJE</span>' : ''}
            </div>
          </div>
          <div style="font-weight:800;font-size:16px;color:${d.pago ? 'var(--success)' : vencida ? 'var(--danger)' : 'var(--text)'}">${Utils.moeda(d.valor)}</div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${!d.pago ? `<button class="btn btn-outline btn-sm" onclick="Fin.pagarDespesa('${d.id}')" title="Marcar como pago">✅</button>` : '<span style="font-size:11px;color:var(--success);font-weight:700">PAGO</span>'}
            <button class="btn btn-outline btn-sm" onclick="Fin.abrirFormDespesa('${d.id}')" title="Editar">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="Fin.excluirDespesa('${d.id}')" title="Excluir">🗑</button>
          </div>
        </div>`;
      }).join('')}`;
  },

  _renderReceber: () => {
    const hoje = Utils.hoje();
    const cont = document.getElementById('listaReceber');
    const parcelas = [];

    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach((p, idx) => {
        if (p.status !== 'pago') {
          const cli = DB.Clientes.buscar(cred.clienteId);
          parcelas.push({
            credId: cred.id, parcelaIdx: idx,
            cliente: cli ? cli.nome : cred.clienteNome || 'Cliente',
            vencimento: p.vencimento, valor: p.valor,
            numero: p.numero, total: cred.parcelas.length
          });
        }
      });
    });

    parcelas.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const totalAReceber = parcelas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

    if (!parcelas.length) {
      cont.innerHTML = `<div class="empty-state" style="padding:40px 20px">
        <div class="empty-icon">💚</div>
        <div class="empty-title">Nenhum valor a receber</div>
        <div class="empty-sub">Crediários pendentes aparecerão aqui</div>
      </div>`;
      return;
    }

    cont.innerHTML = `
      <div style="padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border)">
        <span style="font-size:13px">Total a receber: <strong style="color:var(--success)">${Utils.moeda(totalAReceber)}</strong> em ${parcelas.length} parcela(s)</span>
      </div>
      ${parcelas.map(p => {
        const vencida  = p.vencimento < hoje;
        const venceHoje = p.vencimento === hoje;
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px">${p.cliente}</div>
            <div style="font-size:12px;color:var(--text-muted)">
              Parcela ${p.numero}/${p.total} · Vence: ${Utils.data(p.vencimento)}
              ${vencida ? '<span style="color:var(--danger);font-weight:700"> ⚠ VENCIDA</span>' : ''}
              ${venceHoje ? '<span style="color:var(--warning);font-weight:700"> ⚡ VENCE HOJE</span>' : ''}
            </div>
          </div>
          <div style="font-weight:800;font-size:16px;color:${vencida ? 'var(--danger)' : 'var(--success)'}">${Utils.moeda(p.valor)}</div>
        </div>`;
      }).join('')}`;
  },

  abrirFormDespesa: (id, preenchido = null) => {
    _despesaEditando = id ? DB.Despesas.buscar(id) : null;
    document.getElementById('modalDespesaTitulo').textContent = _despesaEditando ? 'Editar Despesa' : 'Nova Despesa';
    const f = document.getElementById('formDespesa');
    const src = _despesaEditando || preenchido || {};
    f.descricao.value    = src.descricao   || '';
    f.valor.value        = src.valor       || '';
    f.vencimento.value   = src.vencimento  || '';
    f.categoria.value    = src.categoria   || 'fixo';
    f.recorrente.checked = !!src.recorrente;
    Utils.abrirModal('modalDespesa');
  },

  salvarDespesa: (e) => {
    e.preventDefault();
    const f = document.getElementById('formDespesa');
    DB.Despesas.salvar({
      id: _despesaEditando ? _despesaEditando.id : undefined,
      descricao: f.descricao.value.trim(),
      valor: parseFloat(f.valor.value) || 0,
      vencimento: f.vencimento.value || null,
      categoria: f.categoria.value,
      recorrente: f.recorrente.checked,
      pago: _despesaEditando ? (_despesaEditando.pago || false) : false
    });
    Utils.fecharModal('modalDespesa');
    Fin.renderContas();
    Utils.toast(_despesaEditando ? 'Despesa atualizada!' : 'Despesa cadastrada!');
  },

  pagarDespesa: (id) => {
    DB.Despesas.marcarPago(id);
    Fin.renderContas();
    Utils.toast('Despesa marcada como paga!', 'success');
  },

  excluirDespesa: (id) => {
    if (!Utils.confirmar('Excluir esta despesa?')) return;
    DB.Despesas.excluir(id);
    Fin.renderContas();
    Utils.toast('Despesa excluída');
  },

  // ---- ABA DIAGNÓSTICO ----
  renderDiagnostico: () => {
    const mes  = Fin.getMes();
    const d    = Fin.calcularDRE(mes);
    const hoje = Utils.hoje();
    const [ano, m] = mes.split('-').map(Number);

    // Dias úteis (seg-sab) no mês e restantes
    const diasUteisMes = Fin._diasUteis(ano, m);
    const diasUteisPassados = Fin._diasUteisAte(ano, m, parseInt(hoje.split('-')[2]));
    const diasUteisRestantes = Math.max(0, diasUteisMes - diasUteisPassados);

    // Médias
    const ticketMedio = d.qtdVendas > 0 ? d.receitaBruta / d.qtdVendas : 0;
    const mediaDiaria = diasUteisPassados > 0 ? d.receitaBruta / diasUteisPassados : 0;

    // Despesas cadastradas
    const despesas = DB.Despesas.listar().filter(dep =>
      dep.recorrente || (dep.vencimento || '').startsWith(mes)
    );
    const totalDespesasCadastradas = despesas.reduce((s, dep) => s + (parseFloat(dep.valor) || 0), 0);

    // Quanto precisa vender
    const metaFat  = DB.Config.get('metaFaturamento', 0);
    const metaLuc  = DB.Config.get('metaLucro', 0);
    const despFix  = DB.Config.get('metaDespFixas', 0) || d.despFixas || totalDespesasCadastradas;
    const margemContrib = d.receitaBruta > 0 ? d.lucroBruto / d.receitaBruta : 0.35; // assume 35% se sem dados
    const peTotal  = margemContrib > 0 ? (despFix + d.despVariaveis + d.taxasCartao) / margemContrib : 0;
    const faltaPE  = Math.max(0, peTotal - d.receitaBruta);
    const faltaMeta = Math.max(0, metaFat - d.receitaBruta);
    const vendaPorDiaPE   = diasUteisRestantes > 0 ? faltaPE   / diasUteisRestantes : 0;
    const vendaPorDiaMeta = diasUteisRestantes > 0 ? faltaMeta / diasUteisRestantes : 0;

    // Projeção do mês
    const projecao = mediaDiaria * diasUteisMes;
    const projecaoLucro = projecao > 0 && d.receitaBruta > 0
      ? (d.lucroLiquido / d.receitaBruta) * projecao : 0;

    // Score de saúde (0-100)
    let score = 50;
    if (d.margemLiquida >= 15) score += 20;
    else if (d.margemLiquida >= 8) score += 10;
    else if (d.margemLiquida < 0) score -= 25;

    if (d.receitaBruta >= peTotal && peTotal > 0) score += 15;
    else if (peTotal > 0 && d.receitaBruta >= peTotal * 0.8) score += 5;
    else if (peTotal > 0) score -= 10;

    if (metaFat > 0 && d.receitaBruta >= metaFat * 0.9) score += 15;
    else if (metaFat > 0 && d.receitaBruta < metaFat * 0.5) score -= 10;

    const despVencidas = despesas.filter(dep => !dep.pago && dep.vencimento && dep.vencimento < hoje);
    score -= despVencidas.length * 5;

    const produtosMgBaixa = DB.Produtos.listarAtivos().filter(p => {
      const v = parseFloat(p.precoVenda) || 0, c = parseFloat(p.precoCusto) || 0;
      return v > 0 && c > 0 && ((v - c) / v) < 0.2;
    });
    score -= Math.min(produtosMgBaixa.length * 3, 15);
    score = Math.max(0, Math.min(100, score));

    const scoreInfo = score >= 75
      ? { emoji: '🟢', label: 'Saudável', cor: 'var(--success)', msg: 'Suas finanças estão bem organizadas.' }
      : score >= 50
        ? { emoji: '🟡', label: 'Atenção', cor: 'var(--warning)', msg: 'Alguns pontos precisam de atenção.' }
        : { emoji: '🔴', label: 'Crítico', cor: 'var(--danger)', msg: 'Ação necessária para evitar prejuízo.' };

    // Benchmarks do setor (varejo calçados)
    const benchmarks = d.receitaBruta > 0 ? [
      {
        label: 'CMV (custo das mercadorias)',
        valor: d.cmv, pct: (d.cmv / d.receitaBruta) * 100,
        idealMin: 40, idealMax: 58,
        dica: 'Se acima de 58%: negocie melhor com fornecedores ou aumente os preços.'
      },
      {
        label: 'Despesas Fixas',
        valor: d.despFixas, pct: d.receitaBruta > 0 ? (d.despFixas / d.receitaBruta) * 100 : 0,
        idealMin: 0, idealMax: 20,
        dica: 'Se acima de 20%: analise quais fixos podem ser reduzidos.'
      },
      {
        label: 'Taxas de Cartão/PIX',
        valor: d.taxasCartao, pct: (d.taxasCartao / d.receitaBruta) * 100,
        idealMin: 0, idealMax: 4,
        dica: 'Se acima de 4%: incentive mais pagamentos em PIX (taxa zero ou menor).'
      },
      {
        label: 'Lucro Líquido',
        valor: d.lucroLiquido, pct: d.margemLiquida,
        idealMin: 10, idealMax: 100,
        dica: 'Abaixo de 10%: revise preços e corte despesas não essenciais.'
      },
    ] : [];

    // Sugestões inteligentes
    const sugestoes = [];

    if (d.cmv === 0)
      sugestoes.push({ tipo: 'info', msg: 'Cadastre o <strong>Preço de Custo</strong> nos produtos para calcular o CMV e o lucro real com precisão.' });

    if (despesas.length === 0)
      sugestoes.push({ tipo: 'info', msg: 'Cadastre suas <strong>despesas fixas</strong> (aluguel, energia, salários) na aba Contas para o diagnóstico ser preciso.' });

    if (despVencidas.length > 0)
      sugestoes.push({ tipo: 'danger', msg: `Você tem <strong>${despVencidas.length} despesa(s) vencida(s)</strong> não pagas. Regularize para evitar juros.` });

    if (d.receitaBruta > 0 && d.taxasCartao / d.receitaBruta > 0.04)
      sugestoes.push({ tipo: 'warning', msg: `Suas taxas de cartão representam <strong>${((d.taxasCartao / d.receitaBruta) * 100).toFixed(1)}%</strong> da receita. Incentive o pagamento via <strong>PIX</strong> para economizar.` });

    if (d.receitaBruta > 0 && d.despFixas / d.receitaBruta > 0.25)
      sugestoes.push({ tipo: 'warning', msg: `Despesas fixas estão em <strong>${((d.despFixas / d.receitaBruta) * 100).toFixed(1)}%</strong> da receita — acima do ideal (20%). Avalie o que pode ser reduzido ou renegociado.` });

    if (produtosMgBaixa.length > 0)
      sugestoes.push({ tipo: 'warning', msg: `<strong>${produtosMgBaixa.length} produto(s)</strong> com margem abaixo de 20%: ${produtosMgBaixa.slice(0,3).map(p => p.nome).join(', ')}. Considere reajustar os preços.` });

    if (ticketMedio > 0 && ticketMedio < 80)
      sugestoes.push({ tipo: 'tip', msg: `Ticket médio atual: <strong>${Utils.moeda(ticketMedio)}</strong>. Oferecer combos ou produtos complementares pode aumentar esse valor.` });

    if (d.margemLiquida > 0 && d.margemLiquida < 8)
      sugestoes.push({ tipo: 'danger', msg: `Margem líquida de <strong>${d.margemLiquida.toFixed(1)}%</strong> está muito baixa. Com uma margem tão apertada, qualquer imprevisto gera prejuízo.` });

    if (projecao > 0 && metaFat > 0 && projecao < metaFat * 0.85)
      sugestoes.push({ tipo: 'warning', msg: `No ritmo atual, a projeção do mês é <strong>${Utils.moeda(projecao)}</strong> — abaixo da sua meta de ${Utils.moeda(metaFat)}. Precisa acelerar as vendas.` });

    if (sugestoes.length === 0)
      sugestoes.push({ tipo: 'success', msg: '✅ Nenhum alerta crítico no momento. Continue monitorando!' });

    // Renderizar
    const corBenchmark = (pct, min, max) => {
      if (pct <= max) return 'var(--success)';
      if (pct <= max * 1.3) return 'var(--warning)';
      return 'var(--danger)';
    };
    const iconeBenchmark = (pct, min, max) => pct <= max ? '✅' : pct <= max * 1.3 ? '⚠️' : '🔴';

    const iconeSugestao = { info: '💡', warning: '⚠️', danger: '🔴', tip: '👉', success: '✅' };
    const corSugestao   = { info: 'var(--info)', warning: 'var(--warning)', danger: 'var(--danger)', tip: 'var(--primary)', success: 'var(--success)' };

    document.getElementById('diagnosticoConteudo').innerHTML = `

      <!-- SCORE -->
      <div style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:20px">
        <div style="text-align:center;min-width:100px">
          <div style="font-size:48px;line-height:1">${scoreInfo.emoji}</div>
          <div style="font-size:32px;font-weight:900;color:${scoreInfo.cor};line-height:1.2">${score}</div>
          <div style="font-size:11px;color:var(--text-muted)">/100</div>
          <div style="font-weight:700;color:${scoreInfo.cor};font-size:14px;margin-top:4px">${scoreInfo.label}</div>
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">Saúde Financeira da Loja</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">${scoreInfo.msg}</div>
          <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${score}%;background:${scoreInfo.cor};border-radius:5px;transition:width .5s"></div>
          </div>
        </div>
      </div>

      <!-- QUANTO PRECISA VENDER -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Venda/dia para equilibrar</div>
          <div class="stat-value ${vendaPorDiaPE > mediaDiaria ? 'danger' : 'success'}">${Utils.moeda(vendaPorDiaPE)}</div>
          <div class="stat-sub">${diasUteisRestantes} dia(s) útil(eis) restante(s)</div>
        </div>
        ${metaFat ? `<div class="stat-card">
          <div class="stat-label">Venda/dia para a meta</div>
          <div class="stat-value ${vendaPorDiaMeta > mediaDiaria ? 'warning' : 'success'}">${Utils.moeda(vendaPorDiaMeta)}</div>
          <div class="stat-sub">Meta: ${Utils.moeda(metaFat)}</div>
        </div>` : ''}
        <div class="stat-card">
          <div class="stat-label">Ritmo atual (média/dia)</div>
          <div class="stat-value">${Utils.moeda(mediaDiaria)}</div>
          <div class="stat-sub">${diasUteisPassados} dia(s) trabalhado(s)</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ticket médio</div>
          <div class="stat-value">${Utils.moeda(ticketMedio)}</div>
          <div class="stat-sub">${d.qtdVendas} venda(s) no mês</div>
        </div>
      </div>

      <!-- PROJEÇÃO -->
      ${mediaDiaria > 0 ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">📈 Projeção do Mês (no ritmo atual)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
          <div>
            <div style="font-size:12px;color:var(--text-muted)">Faturamento projetado</div>
            <div style="font-size:22px;font-weight:800;color:${metaFat && projecao >= metaFat ? 'var(--success)' : 'var(--warning)'}">${Utils.moeda(projecao)}</div>
            ${metaFat ? `<div style="font-size:12px;color:var(--text-muted)">${projecao >= metaFat ? '✅ Vai bater a meta!' : `⚠️ ${Utils.moeda(metaFat - projecao)} abaixo da meta`}</div>` : ''}
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted)">Lucro projetado</div>
            <div style="font-size:22px;font-weight:800;color:${projecaoLucro >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(projecaoLucro)}</div>
            ${metaLuc ? `<div style="font-size:12px;color:var(--text-muted)">${projecaoLucro >= metaLuc ? '✅ Meta de lucro atingida!' : `⚠️ ${Utils.moeda(metaLuc - projecaoLucro)} abaixo do esperado`}</div>` : ''}
          </div>
          <div>
            <div style="font-size:12px;color:var(--text-muted)">Ponto de equilíbrio</div>
            <div style="font-size:22px;font-weight:800;color:var(--primary)">${Utils.moeda(peTotal)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${d.receitaBruta >= peTotal ? '✅ Já ultrapassado!' : `⚠️ Faltam ${Utils.moeda(peTotal - d.receitaBruta)}`}</div>
          </div>
        </div>
      </div>` : ''}

      <!-- BENCHMARKS DO SETOR -->
      ${benchmarks.length > 0 ? `
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">📊 Análise de Custos — Benchmarks do Setor</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Comparativo com parâmetros ideais para varejo de calçados</div>
        ${benchmarks.map(b => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:13px;font-weight:600">${iconeBenchmark(b.pct, b.idealMin, b.idealMax)} ${b.label}</span>
              <div style="text-align:right">
                <span style="font-weight:800;font-size:14px;color:${corBenchmark(b.pct, b.idealMin, b.idealMax)}">${b.pct.toFixed(1)}%</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:4px">${Utils.moeda(b.valor)}</span>
              </div>
            </div>
            <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;position:relative">
              <div style="height:100%;width:${Math.min(b.pct, 100)}%;background:${corBenchmark(b.pct, b.idealMin, b.idealMax)};border-radius:4px"></div>
              <div style="position:absolute;top:0;left:${Math.min(b.idealMax, 100)}%;width:2px;height:100%;background:rgba(0,0,0,.3)" title="Limite ideal"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:2px">
              <span>Ideal: até ${b.idealMax}%</span>
              ${b.pct > b.idealMax ? `<span style="color:${corBenchmark(b.pct, b.idealMin, b.idealMax)}">${b.dica}</span>` : '<span style="color:var(--success)">Dentro do ideal ✓</span>'}
            </div>
          </div>`).join('')}
      </div>` : ''}

      <!-- SUGESTÕES -->
      <div class="card">
        <div class="card-title">💡 Sugestões para Melhorar o Lucro</div>
        ${sugestoes.map(s => `
          <div style="display:flex;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:8px;background:var(--bg);border-left:3px solid ${corSugestao[s.tipo]}">
            <span style="font-size:16px;flex-shrink:0">${iconeSugestao[s.tipo]}</span>
            <div style="font-size:13px;line-height:1.5">${s.msg}</div>
          </div>`).join('')}
      </div>`;
  },

  // ---- META DO DIA ----
  renderMetaDia: () => {
    const cont = document.getElementById('cardMetaDia');
    if (!cont) return;

    const mes     = Fin.getMes();
    const hoje    = Utils.hoje();
    const mesHoje = hoje.substring(0, 7);
    const [ano, m] = mes.split('-').map(Number);

    const d = Fin.calcularDRE(mes);

    // Despesas cadastradas no mês
    const despesas = DB.Despesas.listar().filter(dep =>
      dep.recorrente || (dep.vencimento || '').startsWith(mes)
    );
    const totalDesp = despesas.reduce((s, dep) => s + (parseFloat(dep.valor) || 0), 0);
    const semDespesas = totalDesp === 0;

    // Margem de contribuição real (lucro bruto / receita); assume 40% se sem dados
    const mc = d.receitaBruta > 0 ? d.lucroBruto / d.receitaBruta : 0.40;

    // Ponto de equilíbrio mensal
    const pe = mc > 0 ? (totalDesp + d.taxasCartao) / mc : 0;

    // Dias úteis e meta diária
    const diasUteis  = Fin._diasUteis(ano, m);
    const metaDiaria = diasUteis > 0 && pe > 0 ? pe / diasUteis : 0;

    // Vendido hoje (só se estiver vendo o mês atual)
    let vendidoHoje = 0;
    if (mes === mesHoje) {
      vendidoHoje = DB.Vendas.listarPorPeriodo(hoje, hoje)
        .filter(v => v.formaPagamento !== 'crediario')
        .reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    }

    // Progresso
    const pct     = metaDiaria > 0 ? Math.min((vendidoHoje / metaDiaria) * 100, 100) : 0;
    const falta   = Math.max(0, metaDiaria - vendidoHoje);
    const batida  = vendidoHoje >= metaDiaria && metaDiaria > 0;

    // Status
    let statusCor, statusMsg, statusEmoji;
    if (semDespesas) {
      statusCor = 'var(--text-muted)'; statusEmoji = '⚙️';
      statusMsg = 'Cadastre suas despesas fixas na aba <strong>Contas</strong> para calcular a meta real.';
    } else if (batida) {
      statusCor = 'var(--success)'; statusEmoji = '🎉';
      statusMsg = `Meta do dia batida! Você vendeu <strong>${Utils.moeda(vendidoHoje - metaDiaria)}</strong> a mais.`;
    } else if (pct >= 75) {
      statusCor = 'var(--warning)'; statusEmoji = '💪';
      statusMsg = `Quase lá! Faltam <strong>${Utils.moeda(falta)}</strong> para cobrir os custos de hoje.`;
    } else if (pct >= 40) {
      statusCor = 'var(--warning)'; statusEmoji = '⚠️';
      statusMsg = `Metade do caminho. Ainda faltam <strong>${Utils.moeda(falta)}</strong>.`;
    } else {
      statusCor = 'var(--danger)'; statusEmoji = '🔴';
      statusMsg = mes !== mesHoje
        ? `Neste mês o ponto de equilíbrio diário foi <strong>${Utils.moeda(metaDiaria)}</strong>.`
        : `Precisa acelerar! Faltam <strong>${Utils.moeda(falta)}</strong> para cobrir os custos de hoje.`;
    }

    const barCor = batida ? 'var(--success)' : pct >= 75 ? 'var(--warning)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';

    cont.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div style="font-size:16px;font-weight:800">🎯 Meta do Dia</div>
          <div style="font-size:12px;color:var(--text-muted)">${diasUteis} dias úteis no mês · ponto de equilíbrio: <strong style="color:var(--text)">${Utils.moeda(pe)}/mês</strong></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:16px">
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Meta do dia</div>
            <div style="font-size:28px;font-weight:900;color:var(--primary);line-height:1">${Utils.moeda(metaDiaria)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">para cobrir custos</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${mes === mesHoje ? 'Vendido hoje' : 'Receita do mês'}</div>
            <div style="font-size:28px;font-weight:900;color:${vendidoHoje >= metaDiaria && metaDiaria > 0 ? 'var(--success)' : 'var(--text)'};line-height:1">${Utils.moeda(mes === mesHoje ? vendidoHoje : d.receitaBruta)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${mes === mesHoje ? 'até agora' : d.qtdVendas + ' vendas'}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${batida ? 'Excedente' : 'Falta'}</div>
            <div style="font-size:28px;font-weight:900;color:${batida ? 'var(--success)' : 'var(--danger)'};line-height:1">${batida ? '+' : ''}${Utils.moeda(batida ? vendidoHoje - metaDiaria : falta)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${batida ? 'acima da meta' : 'para equilibrar'}</div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div style="height:14px;background:var(--border);border-radius:7px;overflow:hidden;margin-bottom:10px">
          <div style="height:100%;width:${pct}%;background:${barCor};border-radius:7px;transition:width .6s;position:relative">
            ${pct > 15 ? `<span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:#fff">${pct.toFixed(0)}%</span>` : ''}
          </div>
        </div>

        <!-- Status -->
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${statusCor}">
          <span style="font-size:18px">${statusEmoji}</span>
          <span>${statusMsg}</span>
        </div>
      </div>`;
  },

  _diasUteis: (ano, mes) => {
    let count = 0;
    const dias = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= dias; d++) {
      const dia = new Date(ano, mes - 1, d).getDay();
      if (dia !== 0) count++; // 0 = domingo
    }
    return count;
  },

  _diasUteisAte: (ano, mes, diaAtual) => {
    let count = 0;
    const ultimo = Math.min(diaAtual, new Date(ano, mes, 0).getDate());
    for (let d = 1; d <= ultimo; d++) {
      const dia = new Date(ano, mes - 1, d).getDay();
      if (dia !== 0) count++;
    }
    return count;
  },

  // ---- SCANNER DE BOLETO ----
  abrirScannerBoleto: () => {
    document.getElementById('inputCodigoBoleto').value = '';
    document.getElementById('boletoParsed').style.display = 'none';
    document.getElementById('boletoErro').style.display = 'none';
    Utils.abrirModal('modalBoleto');
    setTimeout(() => document.getElementById('inputCodigoBoleto').focus(), 200);
  },

  lerBoleto: (valor) => {
    const digits = valor.replace(/\D/g, '');
    document.getElementById('boletoParsed').style.display = 'none';
    document.getElementById('boletoErro').style.display = 'none';
    if (digits.length < 44) return;

    const parsed = Fin._parseBoleto(digits);
    if (!parsed) {
      document.getElementById('boletoErro').style.display = '';
      return;
    }

    document.getElementById('boletoNomeBanco').textContent = parsed.bankName;
    document.getElementById('boletoValor').textContent     = parsed.value > 0 ? Utils.moeda(parsed.value) : 'Não identificado';
    document.getElementById('boletoVencimento').textContent = parsed.dueDate
      ? Utils.data(parsed.dueDate)
      : parsed.tipo === 'concessionaria'
        ? 'Digite a data manualmente'
        : 'Sem vencimento fixo';
    document.getElementById('boletoParsed').style.display = '';
  },

  _parseBoleto: (digits) => {
    const BANCOS = {
      '001':'Banco do Brasil','033':'Santander','041':'Banrisul',
      '047':'Banese','070':'BRB','077':'Inter','084':'UniPrime',
      '104':'Caixa Econômica','133':'Cresol','136':'Unicred',
      '237':'Bradesco','260':'Nubank','290':'PagSeguro',
      '323':'Mercado Pago','336':'C6 Bank','341':'Itaú',
      '389':'Mercantil','422':'Safra','633':'Rendimento',
      '637':'Sofisa','748':'Sicredi','756':'Sicoob','748':'Sicredi',
    };

    const SEGMENTOS_CONC = { '1':'Energia','2':'Água/Saneamento','3':'Gás','4':'Telecom','5':'Multas','6':'Taxa Pública','9':'Outros' };

    // ---- CONCESSIONÁRIA (código de barras 44-48 dígitos começando com 8) ----
    if (digits[0] === '8') {
      const segCode   = digits[1] || '9';
      const valorReal = digits[2]; // '6' ou '7' = tem valor; '8' ou '9' = sem valor
      let valueCents  = 0;
      if (valorReal === '6' || valorReal === '7') {
        valueCents = parseInt(digits.substring(4, 15)) || 0;
      } else if (digits.length === 48) {
        valueCents = parseInt(digits.substring(4, 15)) || 0;
      }
      return {
        tipo: 'concessionaria',
        bankName: SEGMENTOS_CONC[segCode] || 'Concessionária',
        value: valueCents / 100,
        dueDate: null // data não fica no código de concessionárias
      };
    }

    // ---- BOLETO BANCÁRIO (cobrança) ----
    let bankCode, dueFactor, valueCents;

    if (digits.length === 44) {
      // Código de barras: BBB M FFFF VVVVVVVVVV [campo livre 25]
      bankCode   = digits.substring(0, 3);
      dueFactor  = parseInt(digits.substring(4, 8));
      valueCents = parseInt(digits.substring(8, 18));

    } else if (digits.length === 47) {
      // Linha digitável: BBBMC.CCCCD DDDDD.DDDDDD DDDDD.DDDDDD K FFFFVVVVVVVVVV
      // Sem pontos/espaços: 10 + 11 + 11 + 1 + 14 = 47
      bankCode   = digits.substring(0, 3);
      dueFactor  = parseInt(digits.substring(33, 37));
      valueCents = parseInt(digits.substring(37, 47));

    } else {
      return null;
    }

    if (isNaN(valueCents)) return null;

    const value = valueCents / 100;

    // Calcular vencimento: base FEBRABAN = 07/10/1997
    let dueDate = null;
    if (dueFactor > 0 && !isNaN(dueFactor)) {
      // Após o ciclo de 9999, base muda para 22/02/2025 (fator 1000)
      let base;
      if (dueFactor >= 1000 && dueFactor < 2000) {
        // Novo ciclo iniciado em 22/02/2025
        base = new Date(2025, 1, 22);
        base.setDate(base.getDate() + (dueFactor - 1000));
      } else {
        base = new Date(1997, 9, 7); // 07/10/1997
        base.setDate(base.getDate() + dueFactor);
      }
      const y = base.getFullYear();
      const m = String(base.getMonth() + 1).padStart(2, '0');
      const d = String(base.getDate()).padStart(2, '0');
      dueDate = `${y}-${m}-${d}`;
    }

    const bankName = BANCOS[bankCode] || `Banco ${bankCode}`;
    return { tipo: 'bancario', bankCode, bankName, value, dueDate };
  },

  usarDadosBoleto: () => {
    const digits = document.getElementById('inputCodigoBoleto').value.replace(/\D/g, '');
    const parsed = Fin._parseBoleto(digits);
    if (!parsed) return;
    Utils.fecharModal('modalBoleto');
    // Abre o form de despesa com os dados pré-preenchidos
    Fin.abrirFormDespesa(null, {
      valor: parsed.value,
      vencimento: parsed.dueDate || '',
      descricao: `Boleto ${parsed.bankName}`,
      categoria: 'variavel'
    });
  },

  // ---- ABA METAS ----
  renderMetas: () => {
    const metaFat  = DB.Config.get('metaFaturamento', 0);
    const metaLuc  = DB.Config.get('metaLucro', 0);
    const despFix  = DB.Config.get('metaDespFixas', 0);

    document.getElementById('metaFaturamento').value = metaFat || '';
    document.getElementById('metaLucro').value       = metaLuc || '';
    document.getElementById('metaDespFixas').value   = despFix || '';

    Fin._renderMetasResultado();
  },

  salvarMetas: () => {
    DB.Config.set('metaFaturamento', parseFloat(document.getElementById('metaFaturamento').value) || 0);
    DB.Config.set('metaLucro',       parseFloat(document.getElementById('metaLucro').value) || 0);
    DB.Config.set('metaDespFixas',   parseFloat(document.getElementById('metaDespFixas').value) || 0);
    Fin._renderMetasResultado();
  },

  _renderMetasResultado: () => {
    const mes      = Fin.getMes();
    const d        = Fin.calcularDRE(mes);
    const metaFat  = DB.Config.get('metaFaturamento', 0);
    const metaLuc  = DB.Config.get('metaLucro', 0);
    const despFix  = DB.Config.get('metaDespFixas', 0);
    const cont     = document.getElementById('metasResultado');

    if (!metaFat && !metaLuc) {
      cont.innerHTML = `<div class="card"><div class="text-muted" style="padding:16px;text-align:center">Defina suas metas ao lado para visualizar o progresso 🎯</div></div>`;
      return;
    }

    const pctFat = metaFat > 0 ? Math.min((d.receitaBruta / metaFat) * 100, 100) : 0;
    const pctLuc = metaLuc > 0 ? Math.min((d.lucroLiquido / metaLuc) * 100, 100) : 0;

    // Ponto de equilíbrio
    const margemContrib = d.receitaBruta > 0 ? (d.lucroBruto / d.receitaBruta) : 0;
    const despesasFixasTotal = despFix || d.despFixas;
    const pontoEquilibrio = margemContrib > 0 ? despesasFixasTotal / margemContrib : 0;
    const faltaFat = Math.max(0, metaFat - d.receitaBruta);
    const faltaLuc = Math.max(0, metaLuc - d.lucroLiquido);

    const barra = (pct, cor) => `
      <div style="height:12px;background:var(--border);border-radius:6px;overflow:hidden;margin:6px 0 2px">
        <div style="height:100%;width:${pct}%;background:${cor};border-radius:6px;transition:width .4s"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);text-align:right">${pct.toFixed(1)}%</div>`;

    cont.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📊 Progresso do Mês</div>

        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:14px">
            <span>🏦 Faturamento</span>
            <span><strong>${Utils.moeda(d.receitaBruta)}</strong> / ${Utils.moeda(metaFat)}</span>
          </div>
          ${barra(pctFat, pctFat >= 100 ? 'var(--success)' : 'var(--primary)')}
          ${faltaFat > 0 ? `<div style="font-size:12px;color:var(--text-muted)">Faltam ${Utils.moeda(faltaFat)} para a meta</div>` : `<div style="font-size:12px;color:var(--success);font-weight:700">✅ Meta de faturamento atingida!</div>`}
        </div>

        ${metaLuc ? `<div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:14px">
            <span>💰 Lucro Líquido</span>
            <span><strong style="color:${d.lucroLiquido >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(d.lucroLiquido)}</strong> / ${Utils.moeda(metaLuc)}</span>
          </div>
          ${barra(Math.max(0, pctLuc), pctLuc >= 100 ? 'var(--success)' : d.lucroLiquido < 0 ? 'var(--danger)' : 'var(--warning)')}
          ${faltaLuc > 0 ? `<div style="font-size:12px;color:var(--text-muted)">Faltam ${Utils.moeda(faltaLuc)} de lucro para a meta</div>` : `<div style="font-size:12px;color:var(--success);font-weight:700">✅ Meta de lucro atingida!</div>`}
        </div>` : ''}
      </div>

      ${pontoEquilibrio > 0 ? `
      <div class="card">
        <div class="card-title">⚖️ Ponto de Equilíbrio</div>
        <div style="font-size:28px;font-weight:800;color:var(--primary);margin-bottom:4px">${Utils.moeda(pontoEquilibrio)}</div>
        <div class="text-muted fs-sm" style="margin-bottom:12px">É o mínimo que precisa faturar para não ter prejuízo</div>
        ${d.receitaBruta >= pontoEquilibrio
          ? `<div style="color:var(--success);font-weight:700">✅ Você já ultrapassou o ponto de equilíbrio este mês!</div>`
          : `<div style="color:var(--danger);font-weight:700">⚠️ Ainda faltam ${Utils.moeda(pontoEquilibrio - d.receitaBruta)} para cobrir todos os custos.</div>`}
      </div>` : ''}`;
  }
};

document.addEventListener('DOMContentLoaded', Fin.init);
document.addEventListener('movePe-sync', () => Fin.render());
