/**
 * MOVE PÉ - Financeiro v3.0
 * Foco em lucro real: DRE, precificação, contas, metas
 */

let _tabAtual = 'resumo';
let _subContasAtual = 'pagar';
let _despesaEditando = null;
let _filtroOrigem = 'todas';

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
    ['resumo','dre','fluxo30','ranking','reposicao','precificacao','contas','metas','diagnostico','trafego'].forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (el) el.style.display = t === tab ? '' : 'none';
    });
    Fin.render();
  },

  setSubContas: (sub, btn) => {
    _subContasAtual = sub;
    document.querySelectorAll('.tab-btn-sub').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('contasPagar').style.display       = sub === 'pagar'       ? '' : 'none';
    document.getElementById('contasReceber').style.display     = sub === 'receber'     ? '' : 'none';
    document.getElementById('contasRetiradas').style.display   = sub === 'retiradas'   ? '' : 'none';
    document.getElementById('contasPrioridades').style.display = sub === 'prioridades' ? '' : 'none';
    document.getElementById('contasEmprestimo').style.display  = sub === 'emprestimo'  ? '' : 'none';
    const btnNova = document.getElementById('btnNovaDespesa');
    if (btnNova) btnNova.style.display = (sub === 'receber' || sub === 'prioridades' || sub === 'emprestimo') ? 'none' : 'flex';
    Fin.renderContas();
  },

  _setFiltroOrigem: (origem, btn) => {
    _filtroOrigem = origem;
    document.querySelectorAll('.filtro-origem-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    Fin._renderDespesas();
  },

  _setOrigemModal: (origem) => {
    document.getElementById('hiddenOrigem').value = origem;
    document.getElementById('btnOrigemLoja').style.background    = origem === 'loja'     ? 'var(--primary)' : '';
    document.getElementById('btnOrigemLoja').style.color         = origem === 'loja'     ? '#fff' : '';
    document.getElementById('btnOrigemPessoal').style.background = origem === 'pessoal'  ? '#8b5cf6' : '';
    document.getElementById('btnOrigemPessoal').style.color      = origem === 'pessoal'  ? '#fff' : '';
    const sel = document.querySelector('#formDespesa select[name="categoria"]');
    if (!sel) return;
    if (origem === 'pessoal') {
      sel.innerHTML = `
        <option value="moradia">🏠 Moradia (aluguel, condomínio...)</option>
        <option value="alimentacao">🍽️ Alimentação</option>
        <option value="transporte">🚗 Transporte</option>
        <option value="saude">❤️ Saúde / Remédio</option>
        <option value="educacao">📚 Educação</option>
        <option value="lazer">🎭 Lazer</option>
        <option value="outros">Outros</option>`;
    } else {
      sel.innerHTML = `
        <option value="fixo">Fixo (aluguel, salário...)</option>
        <option value="variavel">Variável (fornecedor, frete...)</option>
        <option value="imposto">Imposto / Taxa</option>
        <option value="outros">Outros</option>`;
    }
  },

  render: () => {
    if (_tabAtual === 'resumo')       Fin.renderResumo();
    if (_tabAtual === 'dre')          Fin.renderDRE();
    if (_tabAtual === 'fluxo30')      Fin.renderFluxo30();
    if (_tabAtual === 'ranking')      Fin.renderRanking();
    if (_tabAtual === 'reposicao')    Fin.renderReposicao();
    if (_tabAtual === 'precificacao') Fin.renderPrecificacao();
    if (_tabAtual === 'contas')       Fin.renderContas();
    if (_tabAtual === 'metas')        Fin.renderMetas();
    if (_tabAtual === 'diagnostico')  Fin.renderDiagnostico();
    if (_tabAtual === 'trafego')      Fin.renderTrafego();
  },

  // ---- CÁLCULOS BASE ----
  calcularDRE: (mes) => {
    const inicio = mes + '-01';
    const fim    = mes + '-31';

    const produtosCache = {};
    const getCMVVenda = (venda) => {
      if (!venda || !venda.itens) return 0;
      let c = 0;
      venda.itens.forEach(item => {
        let custo = parseFloat(item.precoCusto) || 0;
        if (!custo && item.produtoId) {
          if (!produtosCache[item.produtoId]) produtosCache[item.produtoId] = DB.Produtos.buscar(item.produtoId);
          const prod = produtosCache[item.produtoId];
          custo = prod ? (parseFloat(prod.precoCusto) || 0) : 0;
        }
        c += custo * (parseInt(item.quantidade) || 1);
      });
      return c;
    };

    // Receita de vendas à vista (exclui crediário — caixa ainda não entrou)
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim)
      .filter(v => v.formaPagamento !== 'crediario');
    const receitaVista = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    // CMV das vendas à vista
    let cmvVista = 0;
    vendas.forEach(v => { cmvVista += getCMVVenda(v); });

    // Crediário recebido no mês + CMV proporcional sobre as parcelas pagas
    let crediarioRecebido = 0;
    let cmvCrediario = 0;
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      const totalCred = parseFloat(cred.total) || 0;
      const cmvCred = cred.vendaId ? getCMVVenda(DB.Vendas.buscar(cred.vendaId)) : 0;
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' && p.dataPagamento && p.dataPagamento.startsWith(mes)) {
          const val = parseFloat(p.valor) || 0;
          crediarioRecebido += val;
          // Abate CMV proporcional: quanto dessa parcela representa do custo total da venda
          if (totalCred > 0 && cmvCred > 0) cmvCrediario += (val / totalCred) * cmvCred;
        }
      });
    });
    cmvCrediario = Math.round(cmvCrediario * 100) / 100;

    const receitaBruta  = receitaVista + crediarioRecebido; // total de caixa no mês
    const cmv           = Math.round((cmvVista + cmvCrediario) * 100) / 100;

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

    // Retiradas do dono no mês
    const totalRetiradas = DB.Retiradas.totalMes(mes);

    const lucroBruto    = receitaBruta - cmv;
    const totalDespesas = despFixas + despVariaveis + taxasCartao;
    const lucroLiquido  = lucroBruto - totalDespesas - totalRetiradas;
    const margemBruta   = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta, receitaVista, crediarioRecebido,
      cmv, cmvVista, cmvCrediario,
      lucroBruto, margemBruta,
      despFixas, despVariaveis, taxasCartao, totalDespesas,
      totalRetiradas, lucroLiquido, margemLiquida,
      outrasEntradas,
      qtdVendas: vendas.length
    };
  },

  // ---- ABA RESUMO ----
  renderResumo: () => {
    Fin.renderMetaDia();
    const mes = Fin.getMes();
    const d   = Fin.calcularDRE(mes);
    const aReceber = DB.Crediario.totalPendente();

    const subReceita = d.crediarioRecebido > 0
      ? `${d.qtdVendas} vendas à vista + ${Utils.moeda(d.crediarioRecebido)} crediário`
      : `${d.qtdVendas} vendas no mês`;
    const subCMV = d.cmvCrediario > 0
      ? `vista: ${Utils.moeda(d.cmvVista)} + crediário: ${Utils.moeda(d.cmvCrediario)}`
      : 'custo dos produtos vendidos';

    const stats = [
      { label: 'Receita do Mês', valor: d.receitaBruta, cor: 'success', sub: subReceita },
      { label: 'Custo Mercadorias (CMV)', valor: d.cmv, cor: 'danger', sub: subCMV },
      { label: 'Lucro Bruto', valor: d.lucroBruto, cor: d.lucroBruto >= 0 ? 'success' : 'danger', sub: `Margem: ${d.margemBruta.toFixed(1)}%` },
      { label: 'Despesas do Mês', valor: d.totalDespesas, cor: 'danger', sub: 'fixas + variáveis + taxas' },
      { label: 'Lucro Líquido', valor: d.lucroLiquido, cor: d.lucroLiquido >= 0 ? 'success' : 'danger', sub: `Margem: ${d.margemLiquida.toFixed(1)}%`, destaque: true },
      { label: 'A Receber (crediário)', valor: aReceber, cor: 'warning', sub: 'saldo total em aberto' },
      { label: 'Retiradas do Dono', valor: d.totalRetiradas, cor: d.totalRetiradas > 0 ? 'danger' : 'text-muted', sub: 'pró-labore e retiradas pessoais' },
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

    // Previsão de recebimento crediário
    Fin._renderPrevisaoCrediario();

    // Movimentações
    Fin._renderMovimentacoes(mes);
  },

  _renderPrevisaoCrediario: () => {
    const cont = document.getElementById('cardPrevisaoCrediario');
    if (!cont) return;

    const hoje = new Date();
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

    // Monta os próximos 3 meses (mês atual + 2)
    const meses = [0, 1, 2].map(offset => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = `${nomes[d.getMonth()]}/${d.getFullYear()}`;
      return { chave, label, offset };
    });

    // Agrupa parcelas pendentes por mês
    const dados = {};
    meses.forEach(m => { dados[m.chave] = { total: 0, parcelas: [], label: m.label, offset: m.offset }; });

    const totalGeralPendente = { total: 0, count: 0 };
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' || !p.vencimento) return;
        const mes = p.vencimento.substring(0, 7);
        const val = parseFloat(p.valor) || 0;
        if (dados[mes]) {
          dados[mes].total += val;
          dados[mes].parcelas.push({ cliente: cred.clienteNome || 'Cliente', valor: val, vencimento: p.vencimento });
        }
        totalGeralPendente.total += val;
        totalGeralPendente.count++;
      });
    });

    const totalTresMeses = meses.reduce((s, m) => s + dados[m.chave].total, 0);

    const cores = ['var(--warning)', 'var(--primary)', 'var(--success)'];
    const labels = ['Mês atual', 'Próximo mês', 'Daqui a 2 meses'];

    const blocos = meses.map((m, i) => {
      const d = dados[m.chave];
      const pcts = totalTresMeses > 0 ? Math.round((d.total / totalTresMeses) * 100) : 0;
      const cor = cores[i];
      const top5 = d.parcelas.sort((a, b) => b.valor - a.valor).slice(0, 4);
      return `
        <div style="flex:1;min-width:200px;padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card-bg)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div>
              <div style="font-size:11px;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.04em">${labels[i]}</div>
              <div style="font-weight:700;font-size:13px;color:var(--text)">${m.label}</div>
            </div>
            <div style="font-size:18px;font-weight:800;color:${d.total > 0 ? cor : 'var(--text-muted)'}">${Utils.moeda(d.total)}</div>
          </div>
          <div style="background:var(--border);border-radius:4px;height:6px;margin-bottom:8px;overflow:hidden">
            <div style="height:100%;width:${pcts}%;background:${cor};border-radius:4px;transition:width .4s"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${d.parcelas.length} parcela(s) prevista(s)</div>
          ${top5.length > 0 ? top5.map(p => `
            <div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0;border-bottom:1px solid var(--border)">
              <span style="color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${p.cliente}</span>
              <span style="font-weight:600;color:var(--text)">${Utils.moeda(p.valor)}</span>
            </div>`).join('') : '<div style="font-size:11px;color:var(--text-muted)">Nenhuma parcela</div>'}
          ${d.parcelas.length > 4 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">+${d.parcelas.length - 4} outros</div>` : ''}
        </div>`;
    }).join('');

    const alertaFuturo = totalGeralPendente.total > totalTresMeses
      ? `<div style="font-size:12px;color:var(--text-muted);padding:8px 0 0">
          ℹ️ Mais ${Utils.moeda(totalGeralPendente.total - totalTresMeses)} a receber após os próximos 3 meses
        </div>` : '';

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin:0">📅 Previsão de Recebimento — Crediário</div>
        <div style="font-size:13px;font-weight:700;color:var(--primary)">
          3 meses: ${Utils.moeda(totalTresMeses)}
          <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:4px">/ total pendente: ${Utils.moeda(totalGeralPendente.total)}</span>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">${blocos}</div>
      ${alertaFuturo}`;
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
      if (!cred.parcelas) return;
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
      ${linha('Vendas à Vista / PIX / Cartão', d.receitaVista, 'pos', `${d.qtdVendas} vendas no mês`)}
      ${d.crediarioRecebido > 0 ? linha('(+) Crediário Recebido', d.crediarioRecebido, 'pos', 'parcelas pagas no mês') : ''}
      ${d.crediarioRecebido > 0 ? linha('= Total de Caixa', d.receitaBruta, 'pos') : ''}
      ${separador('Custos')}
      ${linha('(−) CMV — Vendas à Vista', d.cmvVista, 'neg', 'custo dos produtos vendidos à vista')}
      ${d.cmvCrediario > 0 ? linha('(−) CMV — Crediário Recebido', d.cmvCrediario, 'neg', 'custo proporcional das parcelas pagas') : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:2px solid var(--border);border-top:2px solid var(--border);background:rgba(var(--success-rgb),.05);margin:8px -16px;padding:12px 16px">
        <div style="font-weight:700;font-size:15px">= LUCRO BRUTO</div>
        <div style="font-weight:800;font-size:18px;color:${d.lucroBruto >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(d.lucroBruto)} <span style="font-size:12px;font-weight:600">(${d.margemBruta.toFixed(1)}%)</span></div>
      </div>
      ${separador('Despesas Operacionais')}
      ${linha('(−) Despesas Fixas', d.despFixas, 'neg', 'aluguel, salários, energia...')}
      ${linha('(−) Despesas Variáveis', d.despVariaveis, 'neg', 'fornecedores, fretes, outros')}
      ${linha('(−) Taxas de Cartão / PIX', d.taxasCartao, 'neg', 'cobradas pela maquininha')}
      ${d.totalRetiradas > 0 ? linha('(−) Retiradas do Dono', d.totalRetiradas, 'neg', 'pró-labore e retiradas pessoais') : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:${d.lucroLiquido >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};border-radius:var(--radius-sm);margin-top:12px">
        <div style="font-weight:700;font-size:16px">= LUCRO LÍQUIDO</div>
        <div style="font-weight:800;font-size:22px;color:${d.lucroLiquido >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(d.lucroLiquido)} <span style="font-size:13px;font-weight:600">(${d.margemLiquida.toFixed(1)}%)</span></div>
      </div>`;

    // Card de alertas e observações
    const obs = [];
    if (d.cmv === 0 && d.receitaBruta > 0) obs.push('⚠️ CMV zerado — cadastre o <strong>Preço de Custo</strong> nos produtos para calcular o lucro real.');
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
      ...(divisor - 0.05 > 0 ? [{ label: '+5% margem extra', valor: custo / (divisor - 0.05), cor: 'var(--primary)' }] : []),
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

    const margemMinima = DB.Config.get('margemMinima', 25);

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

    const abaixoMinima = linhas.filter(l => l.margem < margemMinima).length;

    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px">
          <label style="font-weight:600;white-space:nowrap">Margem mínima aceitável:</label>
          <div style="display:flex;align-items:center;gap:4px">
            <input type="number" id="inputMargemMinima" value="${margemMinima}" min="0" max="100" step="1"
              style="width:68px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;font-weight:700;text-align:center">
            <span style="font-weight:600">%</span>
            <button onclick="Fin._salvarMargemMinima()" class="btn btn-primary btn-sm" style="margin-left:4px">Salvar</button>
          </div>
        </div>
        ${abaixoMinima > 0 ? `<span style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:3px 10px;font-size:12px;color:var(--danger);font-weight:600">⚠ ${abaixoMinima} produto${abaixoMinima !== 1 ? 's' : ''} abaixo de ${margemMinima}%</span>` : `<span style="color:var(--success);font-size:12px;font-weight:600">✓ Todos os produtos acima de ${margemMinima}%</span>`}
      </div>
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
              const abaixo = l.margem < margemMinima;
              const corMargem = abaixo ? 'var(--danger)' : l.margem < 35 ? 'var(--warning)' : 'var(--success)';
              const rowStyle = abaixo ? 'background:rgba(239,68,68,.04)' : '';
              return `<tr style="${rowStyle}">
                <td style="padding:9px 8px;font-weight:600;font-size:13px">
                  ${abaixo ? '<span style="color:var(--danger);margin-right:4px">🔴</span>' : ''}${l.p.nome}<br>
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400">${l.p.marca || ''}</span>
                </td>
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
        🔴 Abaixo da margem mínima (${margemMinima}%) | 🟡 25–35% atenção | 🟢 &gt; 35% saudável
      </div>`;
  },

  _salvarMargemMinima: () => {
    const val = parseInt(document.getElementById('inputMargemMinima')?.value);
    if (isNaN(val) || val < 0 || val > 100) { Utils.toast('Valor inválido (0–100)', 'error'); return; }
    DB.Config.set('margemMinima', val);
    Fin._renderTabelaMargens();
    Utils.toast(`Margem mínima definida em ${val}%`, 'success');
  },

  // ---- ABA CONTAS ----
  renderContas: () => {
    if (_subContasAtual === 'pagar')           Fin._renderDespesas();
    else if (_subContasAtual === 'receber')    Fin._renderReceber();
    else if (_subContasAtual === 'retiradas')  Fin._renderRetiradas();
    else if (_subContasAtual === 'prioridades') Fin._renderPrioridades();
    else if (_subContasAtual === 'emprestimo')  Fin._renderEmprestimo();
  },

  _renderDespesas: () => {
    const mes  = Fin.getMes();
    const hoje = Utils.hoje();
    const cont = document.getElementById('listaDespesas');

    const todasDoMes = DB.Despesas.listar().filter(d =>
      d.recorrente || (d.vencimento || '').startsWith(mes)
    ).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const despesas = _filtroOrigem === 'todas' ? todasDoMes
      : todasDoMes.filter(d => (d.origem || 'loja') === _filtroOrigem);

    const totalPendente = despesas.filter(d => !d.pago).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalPago     = despesas.filter(d => d.pago).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // Card de total geral — responde ao filtro ativo
    const todasNaoPagas = DB.Despesas.listar().filter(d => !d.pago);
    const totalLojaG    = todasNaoPagas.filter(d => (d.origem || 'loja') === 'loja').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalPessoalG = todasNaoPagas.filter(d => d.origem === 'pessoal').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalGeralG   = totalLojaG + totalPessoalG;
    const filtradas     = _filtroOrigem === 'todas' ? todasNaoPagas : todasNaoPagas.filter(d => (d.origem || 'loja') === _filtroOrigem);
    const totalFiltrado = filtradas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const totalVencido  = filtradas.filter(d => d.vencimento && d.vencimento < hoje).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const qtdVencidas   = filtradas.filter(d => d.vencimento && d.vencimento < hoje).length;
    const cardGeral     = document.getElementById('totalGeralDividas');
    if (cardGeral) {
      if (totalGeralG === 0) {
        cardGeral.innerHTML = '';
      } else if (_filtroOrigem === 'todas') {
        cardGeral.innerHTML = `
          <div style="background:var(--card-bg);border:2px solid var(--danger);border-radius:var(--radius);padding:16px 20px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">💳 Total Geral de Dívidas (todos os meses)</div>
            <div style="font-size:36px;font-weight:900;color:var(--danger);line-height:1">${Utils.moeda(totalGeralG)}</div>
            <div style="display:flex;gap:20px;margin-top:12px;flex-wrap:wrap">
              <div style="border-left:4px solid var(--primary);padding-left:12px">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">🏪 Loja</div>
                <div style="font-size:18px;font-weight:800;color:var(--primary)">${Utils.moeda(totalLojaG)}</div>
              </div>
              <div style="border-left:4px solid #8b5cf6;padding-left:12px">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">🏠 Pessoal</div>
                <div style="font-size:18px;font-weight:800;color:#8b5cf6">${Utils.moeda(totalPessoalG)}</div>
              </div>
              <div style="border-left:4px solid var(--danger);padding-left:12px">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">⚠ Vencidas${qtdVencidas > 0 ? ' (' + qtdVencidas + ')' : ''}</div>
                <div style="font-size:18px;font-weight:800;color:var(--danger)">${Utils.moeda(totalVencido)}</div>
              </div>
            </div>
          </div>`;
      } else {
        const isLoja  = _filtroOrigem === 'loja';
        const cor     = isLoja ? 'var(--primary)' : '#8b5cf6';
        const label   = isLoja ? '🏪 Dívidas da Loja' : '🏠 Dívidas Pessoais';
        const outroCor   = isLoja ? '#8b5cf6' : 'var(--primary)';
        const outroLabel = isLoja ? '🏠 Pessoal' : '🏪 Loja';
        const outroValor = isLoja ? totalPessoalG : totalLojaG;
        cardGeral.innerHTML = `
          <div style="background:var(--card-bg);border:2px solid ${cor};border-radius:var(--radius);padding:16px 20px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${label} (todos os meses)</div>
            <div style="font-size:36px;font-weight:900;color:${cor};line-height:1">${Utils.moeda(totalFiltrado)}</div>
            <div style="display:flex;gap:20px;margin-top:12px;flex-wrap:wrap">
              <div style="border-left:4px solid var(--danger);padding-left:12px">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">⚠ Vencidas</div>
                <div style="font-size:18px;font-weight:800;color:var(--danger)">${Utils.moeda(totalVencido)}</div>
              </div>
              <div style="border-left:4px solid var(--border);padding-left:12px">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">📅 A Vencer</div>
                <div style="font-size:18px;font-weight:800;color:var(--text)">${Utils.moeda(totalFiltrado - totalVencido)}</div>
              </div>
              <div style="border-left:4px solid ${outroCor};padding-left:12px;opacity:.7">
                <div style="font-size:11px;color:var(--text-muted);font-weight:600">${outroLabel} (separado)</div>
                <div style="font-size:18px;font-weight:800;color:${outroCor}">${Utils.moeda(outroValor)}</div>
              </div>
            </div>
          </div>`;
      }
    }

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
        const vencida   = !d.pago && d.vencimento && d.vencimento < hoje;
        const venceHoje = !d.pago && d.vencimento === hoje;
        const isPessoal = d.origem === 'pessoal';
        const corBorda  = isPessoal ? '#8b5cf6' : 'var(--primary)';
        const badge     = isPessoal
          ? '<span style="font-size:10px;background:rgba(139,92,246,.15);color:#8b5cf6;border-radius:4px;padding:1px 6px;font-weight:700">🏠 Pessoal</span>'
          : '<span style="font-size:10px;background:var(--primary-dim);color:var(--primary);border-radius:4px;padding:1px 6px;font-weight:700">🏪 Loja</span>';
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);border-left:4px solid ${corBorda};${d.pago ? 'opacity:.55' : ''}">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px">${d.descricao} ${badge}</div>
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
      if (!cred.parcelas) return;
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
    f.recorrente.checked = !!src.recorrente;
    Fin._setOrigemModal(src.origem || 'loja');
    f.categoria.value    = src.categoria   || (src.origem === 'pessoal' ? 'moradia' : 'fixo');
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
      origem: f.origem.value || 'loja',
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

  // ---- RENDA PESSOAL ----
  _abrirFormRendaPessoal: (id) => {
    const item = id ? DB.RendaPessoal.listar().find(r => r.id === id) : null;
    document.getElementById('rendaId').value          = id || '';
    document.getElementById('rendaTipo').value        = item?.tipo        || 'prolabore';
    document.getElementById('rendaDescricao').value   = item?.descricao   || '';
    document.getElementById('rendaValor').value       = item?.valor       || '';
    document.getElementById('modalRendaTitulo').textContent = id ? 'Editar Fonte de Renda' : 'Nova Fonte de Renda';
    if (!id) Fin._onRendaTipoChange();
    Utils.abrirModal('modalRendaPessoal');
  },

  _onRendaTipoChange: () => {
    const tipo = document.getElementById('rendaTipo')?.value;
    const desc = document.getElementById('rendaDescricao');
    if (!desc || desc.value.trim()) return;
    if (tipo === 'prolabore')       desc.value = 'Pró-labore';
    else if (tipo === 'salario_conjuge') desc.value = 'Salário esposa';
    else desc.value = '';
  },

  _salvarRendaPessoal: (event) => {
    event.preventDefault();
    const id   = document.getElementById('rendaId').value;
    const item = {
      id:        id || undefined,
      tipo:      document.getElementById('rendaTipo').value,
      descricao: document.getElementById('rendaDescricao').value.trim(),
      valor:     parseFloat(document.getElementById('rendaValor').value) || 0,
    };
    if (!item.descricao || !item.valor) { Utils.toast('Preencha todos os campos', 'error'); return; }
    DB.RendaPessoal.salvar(item);
    Utils.fecharModal('modalRendaPessoal');
    Fin._renderPrioridades();
    Utils.toast(id ? 'Renda atualizada!' : 'Renda cadastrada!', 'success');
  },

  _excluirRendaPessoal: (id) => {
    if (!Utils.confirmar('Remover esta fonte de renda?')) return;
    DB.RendaPessoal.excluir(id);
    Fin._renderPrioridades();
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

  // ---- ABA REPOSIÇÃO DE ESTOQUE ----
  renderReposicao: () => {
    const cont = document.getElementById('reposicaoConteudo');
    if (!cont) return;

    // Parâmetros
    const periodo  = document.getElementById('reposicaoPeriodo')?.value || 'mes';
    const pctExtra = parseInt(document.getElementById('reposicaoPct')?.value || 15);
    const hoje     = Utils.hoje();

    // Saldo atual
    const inputSaldo = document.getElementById('reposicaoSaldo');
    const saldoSalvo = parseFloat(DB.Config.get('fluxoSaldoInicial', '')) || 0;
    if (inputSaldo && !inputSaldo.value && saldoSalvo) inputSaldo.value = saldoSalvo;
    const saldoAtual = parseFloat(inputSaldo?.value || saldoSalvo) || 0;

    // Datas do período
    let inicio, fim = hoje, labelPeriodo;
    if (periodo === 'semana') {
      const d = new Date(hoje); d.setDate(d.getDate() - 7);
      inicio = d.toISOString().split('T')[0]; labelPeriodo = 'última semana';
    } else if (periodo === 'mes') {
      inicio = hoje.substring(0, 7) + '-01'; labelPeriodo = 'mês atual';
    } else if (periodo === 'mes_ant') {
      const d = new Date(hoje); d.setDate(1); d.setMonth(d.getMonth() - 1);
      inicio = d.toISOString().split('T')[0];
      const fimD = new Date(d); fimD.setMonth(fimD.getMonth() + 1); fimD.setDate(0);
      fim = fimD.toISOString().split('T')[0]; labelPeriodo = 'mês anterior';
    } else {
      const d = new Date(hoje); d.setDate(d.getDate() - 30);
      inicio = d.toISOString().split('T')[0]; labelPeriodo = 'últimos 30 dias';
    }

    // Vendas do período
    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim);
    const vendidos = {}; // produtoId → { qtd, cmv, nome, marca }

    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const id = item.produtoId;
        if (!id) return;
        if (!vendidos[id]) {
          const prod = DB.Produtos.buscar(id);
          vendidos[id] = {
            nome:  item.nomeSnapshot || (prod ? prod.nome  : 'Produto removido'),
            marca: prod ? (prod.marca || '') : '',
            qtd: 0, cmv: 0, precoCusto: parseFloat(prod?.precoCusto) || 0
          };
        }
        const qtd   = parseInt(item.quantidade) || 1;
        const custo = parseFloat(item.precoCusto) || vendidos[id].precoCusto;
        vendidos[id].qtd += qtd;
        vendidos[id].cmv += custo * qtd;
      });
    });

    // Enriquecer com dados de grade
    Object.entries(vendidos).forEach(([id, dados]) => {
      const prod = DB.Produtos.buscar(id);
      if (prod && prod.gradeId) {
        const grade = DB.Grades ? DB.Grades.buscar(prod.gradeId) : null;
        if (grade) dados.grade = grade;
      }
    });

    const cmvTotal = Object.values(vendidos).reduce((s, v) => s + v.cmv, 0);

    // Orçamento sugerido = CMV × (1 + % extra)
    const orcamento = cmvTotal * (1 + pctExtra / 100);

    // Verificação de caixa
    // Contas a vencer em 30 dias + crediário a receber em 30 dias
    const em30str  = (() => { const d = new Date(hoje); d.setDate(d.getDate()+30); return d.toISOString().split('T')[0]; })();
    const contasProx  = DB.Despesas.listar().filter(d => !d.pago && d.vencimento && d.vencimento >= hoje && d.vencimento <= em30str)
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const credProx = DB.Crediario.listar().reduce((s, cred) => {
      if (!cred.parcelas) return s;
      cred.parcelas.forEach(p => {
        if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= em30str)
          s += parseFloat(p.valor) || 0;
      }); return s;
    }, 0);

    // Caixa disponível = saldo + crediário a receber - contas a pagar - reserva 20%
    const reservaSeguranca = (saldoAtual + credProx) * 0.20;
    const disponivelReal   = Math.max(0, saldoAtual + credProx - contasProx - reservaSeguranca);
    const seguro           = disponivelReal >= orcamento;
    const limiteSugerido   = Math.min(orcamento, disponivelReal);

    // Lista de produtos para repor (ordenada por CMV consumido)
    const listaRepor = Object.entries(vendidos)
      .map(([id, dados]) => {
        const prod         = DB.Produtos.buscar(id);
        const estoqueAtual = prod ? DB.Produtos.estoqueTotal(prod) : 0;
        const grade        = dados.grade || null;

        let qtdRepor, custoEstim, gradeLabel = null;

        if (grade && grade.totalPares > 0) {
          // Calcular em grades completas
          const gradesNecessarias = Math.ceil(dados.qtd * (1 + pctExtra / 100) / grade.totalPares);
          qtdRepor   = gradesNecessarias * grade.totalPares;
          custoEstim = qtdRepor * dados.precoCusto;
          const tamsStr = (grade.tamanhos || []).map(t => t.tam).join(', ');
          gradeLabel = `${gradesNecessarias} grade${gradesNecessarias !== 1 ? 's' : ''} = ${qtdRepor} pares (${grade.nome}: ${tamsStr})`;
        } else {
          qtdRepor   = Math.ceil(dados.qtd * (1 + pctExtra / 100));
          custoEstim = qtdRepor * dados.precoCusto;
        }

        return { id, ...dados, estoqueAtual, qtdRepor, custoEstim, gradeLabel };
      })
      .filter(r => r.qtdRepor > 0)
      .sort((a, b) => b.cmv - a.cmv);

    const custoTotalRepor = listaRepor.reduce((s, r) => s + r.custoEstim, 0);
    const semCusto = listaRepor.every(r => r.precoCusto === 0);

    // ── RENDER ──
    const corDisp = seguro ? 'var(--success)' : 'var(--warning)';
    const emojiDisp = seguro ? '✅' : '⚠️';

    cont.innerHTML = `
      <!-- Cards resumo -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">CMV do período</div>
          <div class="stat-value">${Utils.moeda(cmvTotal)}</div>
          <div class="stat-sub">custo do que foi vendido (${labelPeriodo})</div>
        </div>
        <div class="stat-card stat-destaque">
          <div class="stat-label">Orçamento sugerido</div>
          <div class="stat-value primary">${Utils.moeda(orcamento)}</div>
          <div class="stat-sub">CMV + ${pctExtra}% de crescimento</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Disponível no caixa</div>
          <div class="stat-value" style="color:${corDisp}">${Utils.moeda(disponivelReal)}</div>
          <div class="stat-sub">após pagar contas + reserva 20%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Custo estimado da lista</div>
          <div class="stat-value ${custoTotalRepor > disponivelReal ? 'danger' : 'success'}">${Utils.moeda(custoTotalRepor)}</div>
          <div class="stat-sub">${semCusto ? 'cadastre preços de custo' : 'com base no preço de custo'}</div>
        </div>
      </div>

      <!-- Alerta de viabilidade -->
      <div style="background:${seguro ? 'rgba(34,197,94,.08)' : 'rgba(234,179,8,.08)'};border:1px solid ${seguro ? 'var(--success)' : 'rgba(234,179,8,.5)'};border-radius:var(--radius);padding:14px 18px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:22px">${emojiDisp}</span>
        <div>
          <div style="font-weight:700;margin-bottom:4px;color:${corDisp}">
            ${seguro ? 'Compra dentro da capacidade do caixa' : 'Atenção: orçamento acima do disponível'}
          </div>
          <div style="font-size:13px;color:var(--text)">
            ${seguro
              ? `Você tem <strong>${Utils.moeda(disponivelReal)}</strong> disponível e o orçamento é de <strong>${Utils.moeda(orcamento)}</strong>. Pode comprar com segurança.`
              : `Seu caixa tem <strong>${Utils.moeda(disponivelReal)}</strong> disponível (após pagar contas e reserva). Considere comprar no máximo <strong>${Utils.moeda(limiteSugerido)}</strong> agora e o restante na próxima semana.`
            }
          </div>
          ${!saldoAtual ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">⚙️ Informe seu saldo atual no campo acima para o cálculo de disponibilidade ser preciso.</div>` : ''}
        </div>
      </div>

      <!-- Lista de produtos para repor -->
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
        Lista de Reposição — ${listaRepor.length} produto(s)
      </div>
      ${listaRepor.length === 0 ? `<div class="card"><div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-title">Nenhuma venda no período</div></div></div>` : `
      <div class="card" style="padding:0">
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:8px;font-size:12px;font-weight:700;color:var(--text-muted)">
          <span>Produto</span>
          <span style="text-align:right">Vendido</span>
          <span style="text-align:right">Estoque atual</span>
          <span style="text-align:right">Repor (+${pctExtra}%) / Grades</span>
          <span style="text-align:right">Custo estimado</span>
        </div>
        ${listaRepor.map(r => {
          const estoqueOk  = r.estoqueAtual >= r.qtdRepor;
          const estoqueBaixo = r.estoqueAtual < r.qtdVendida * 0.3;
          return `
          <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:8px;align-items:center">
            <div>
              <div style="font-weight:600;font-size:13px">${r.nome}</div>
              ${r.marca ? `<div style="font-size:11px;color:var(--text-muted)">${r.marca}</div>` : ''}
            </div>
            <div style="text-align:right;font-size:13px">${r.qtd} un</div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:${estoqueBaixo ? 'var(--danger)' : estoqueOk ? 'var(--success)' : 'var(--warning)'}">
              ${r.estoqueAtual} un${estoqueBaixo ? ' ⚠️' : ''}
            </div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:var(--primary)">
              ${r.gradeLabel
                ? `<span title="${r.gradeLabel}" style="cursor:help">${r.gradeLabel.split('=')[0].trim()}</span>
                   <div style="font-size:11px;color:var(--text-muted);font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${r.gradeLabel.split('=').slice(1).join('=').trim()}</div>`
                : `${r.qtdRepor} un`}
            </div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:${r.precoCusto > 0 ? 'var(--text)' : 'var(--text-muted)'}">
              ${r.precoCusto > 0 ? Utils.moeda(r.custoEstim) : '— sem custo'}
            </div>
          </div>`;
        }).join('')}
        <div style="padding:10px 16px;background:var(--bg);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <span style="font-size:13px;color:var(--text-muted)">
            ${semCusto ? '⚙️ Cadastre o preço de custo nos produtos para ver o custo estimado' : `${listaRepor.filter(r=>r.precoCusto>0).length} de ${listaRepor.length} produtos com custo cadastrado`}
          </span>
          <span style="font-weight:800;font-size:15px">Total estimado: <span style="color:${custoTotalRepor > disponivelReal ? 'var(--danger)' : 'var(--success)'}">${Utils.moeda(custoTotalRepor)}</span></span>
        </div>
      </div>`}

      <!-- Dica de uso -->
      <div style="margin-top:12px;padding:12px 16px;background:rgba(99,102,241,.07);border-radius:var(--radius-sm);font-size:13px;color:var(--text-muted);line-height:1.6">
        💡 <strong>Como usar:</strong> A lista mostra tudo que foi vendido no período.
        A coluna <em>Repor</em> sugere a quantidade considerando o crescimento de ${pctExtra}%.
        Priorize os produtos com estoque baixo (⚠️) e maior CMV consumido.
        O orçamento é seguro quando o caixa disponível cobre a compra com reserva de 20%.
      </div>`;
  },

  // ---- ABA RANKING DE PRODUTOS ----
  renderRanking: () => {
    const cont = document.getElementById('rankingConteudo');
    if (!cont) return;

    const periodo = document.getElementById('rankingPeriodo')?.value || 'mes';
    const hoje    = Utils.hoje();
    let inicio, fim = hoje;

    if (periodo === 'mes') {
      inicio = hoje.substring(0, 7) + '-01';
    } else if (periodo === '3m') {
      const d = new Date(hoje); d.setMonth(d.getMonth() - 3);
      inicio = d.toISOString().split('T')[0];
    } else if (periodo === '6m') {
      const d = new Date(hoje); d.setMonth(d.getMonth() - 6);
      inicio = d.toISOString().split('T')[0];
    } else {
      inicio = hoje.substring(0, 4) + '-01-01';
    }

    const vendas = DB.Vendas.listarPorPeriodo(inicio, fim);
    const ranking = {};

    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const id = item.produtoId || 'desconhecido';
        if (!ranking[id]) {
          const prod = DB.Produtos.buscar(id);
          ranking[id] = {
            nome: item.nomeSnapshot || (prod ? prod.nome : 'Produto removido'),
            marca: prod ? (prod.marca || '') : '',
            qtd: 0, receita: 0, custo: 0
          };
        }
        const qtd   = parseInt(item.quantidade) || 1;
        const preco = parseFloat(item.precoUnitario) || parseFloat(item.precoVenda) || 0;
        const custo = parseFloat(item.precoCusto) || 0;
        ranking[id].qtd     += qtd;
        ranking[id].receita += preco * qtd;
        ranking[id].custo   += custo * qtd;
      });
    });

    const lista = Object.values(ranking)
      .map(r => ({ ...r, lucro: r.receita - r.custo, margem: r.receita > 0 ? ((r.receita - r.custo) / r.receita) * 100 : 0 }))
      .sort((a, b) => b.lucro - a.lucro);

    if (!lista.length) {
      cont.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">Nenhuma venda no período</div></div></div>`;
      return;
    }

    const totalReceita = lista.reduce((s, r) => s + r.receita, 0);
    const totalLucro   = lista.reduce((s, r) => s + r.lucro, 0);
    const totalQtd     = lista.reduce((s, r) => s + r.qtd, 0);
    const maxLucro     = lista[0].lucro;

    cont.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-label">Total vendido</div><div class="stat-value success">${Utils.moeda(totalReceita)}</div><div class="stat-sub">${totalQtd} peças</div></div>
        <div class="stat-card"><div class="stat-label">Lucro total gerado</div><div class="stat-value ${totalLucro >= 0 ? 'success' : 'danger'}">${Utils.moeda(totalLucro)}</div><div class="stat-sub">${totalReceita > 0 ? ((totalLucro/totalReceita)*100).toFixed(1) : 0}% de margem</div></div>
        <div class="stat-card"><div class="stat-label">Produtos diferentes</div><div class="stat-value">${lista.length}</div><div class="stat-sub">vendidos no período</div></div>
      </div>
      <div class="card" style="padding:0">
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:700;font-size:13px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:8px;color:var(--text-muted)">
          <span>Produto</span><span style="text-align:right">Receita</span><span style="text-align:right">Lucro</span><span style="text-align:right">Margem</span><span style="text-align:right">Qtd</span>
        </div>
        ${lista.map((r, i) => {
          const barW = maxLucro > 0 ? Math.max(0, (r.lucro / maxLucro) * 100) : 0;
          const corMargem = r.margem < 20 ? 'var(--danger)' : r.margem < 35 ? 'var(--warning)' : 'var(--success)';
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
          return `
            <div style="padding:10px 16px;border-bottom:1px solid var(--border)">
              <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 80px;gap:8px;align-items:center;margin-bottom:4px">
                <div><span style="font-size:14px;margin-right:4px">${medal}</span><strong style="font-size:13px">${r.nome}</strong>${r.marca ? `<span style="font-size:11px;color:var(--text-muted);margin-left:4px">${r.marca}</span>` : ''}</div>
                <div style="text-align:right;font-size:13px">${Utils.moeda(r.receita)}</div>
                <div style="text-align:right;font-weight:700;font-size:13px;color:${r.lucro >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(r.lucro)}</div>
                <div style="text-align:right;font-weight:700;font-size:13px;color:${corMargem}">${r.margem.toFixed(1)}%</div>
                <div style="text-align:right;font-size:13px;color:var(--text-muted)">${r.qtd} un</div>
              </div>
              <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                <div style="height:100%;width:${barW}%;background:${r.lucro >= 0 ? 'var(--success)' : 'var(--danger)'};border-radius:2px"></div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding:4px">
        💡 Margem: 🔴 &lt;20% | 🟡 20–35% | 🟢 &gt;35% — Produtos sem custo cadastrado aparecem com margem zerada.
      </div>`;
  },

  // ---- RETIRADAS DO DONO ----
  _retiradasEditando: null,

  _renderRetiradas: () => {
    const mes  = Fin.getMes();
    const cont = document.getElementById('listaRetiradas');
    const lista = DB.Retiradas.listarPorMes(mes).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const total = lista.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
    const proLabore = DB.Config.get('proLabore', 0);
    const limiteRetirada = DB.Config.get('limiteRetirada', 0);
    const limiteUltrapassado = limiteRetirada > 0 && total > limiteRetirada;

    // Verifica se já existe pró-labore lançado este mês
    const jaTemProLabore = proLabore > 0 && lista.some(r =>
      (r.descricao || '').toLowerCase().includes('pró-labore') || (r.descricao || '').toLowerCase().includes('pro-labore')
    );

    const bannerProLabore = proLabore > 0 && !jaTemProLabore ? `
      <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.3);border-radius:var(--radius-sm);padding:10px 14px;margin:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px">💡 Pró-labore de <strong>${Utils.moeda(proLabore)}</strong> ainda não registrado em ${mes.substring(5, 7)}/${mes.substring(0, 4)}</div>
        <button class="btn btn-primary btn-sm" onclick="Fin._registrarProLabore()">Registrar agora</button>
      </div>` : '';

    const bannerLimite = limiteUltrapassado ? `
      <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35);border-radius:var(--radius-sm);padding:10px 14px;margin:0 16px 12px;font-size:13px;color:var(--danger);font-weight:600">
        🚨 Limite de retirada mensal ultrapassado! Definido: ${Utils.moeda(limiteRetirada)} · Retirado: ${Utils.moeda(total)}
      </div>` : '';

    const configRetiradas = `
      <div style="padding:10px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <div style="display:flex;align-items:center;gap:6px;font-size:13px">
          <label style="font-weight:600;white-space:nowrap">Pró-labore/mês:</label>
          <input type="number" id="inputProLabore" value="${proLabore || ''}" min="0" step="0.01"
            placeholder="R$ 0,00"
            style="width:100px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">
          <button onclick="Fin._salvarConfigRetiradas()" class="btn btn-outline btn-sm">Salvar</button>
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:13px">
          <label style="font-weight:600;white-space:nowrap">Limite mensal:</label>
          <input type="number" id="inputLimiteRetirada" value="${limiteRetirada || ''}" min="0" step="0.01"
            placeholder="Sem limite"
            style="width:100px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px">
        </div>
      </div>`;

    const acoes = `
      <div style="padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span style="font-size:13px">Total retirado no mês: <strong style="color:${limiteUltrapassado ? 'var(--danger)' : 'var(--danger)'}">${Utils.moeda(total)}</strong>${limiteRetirada > 0 ? ` <span style="color:var(--text-muted)">/ limite ${Utils.moeda(limiteRetirada)}</span>` : ''}</span>
        <button class="btn btn-primary btn-sm" onclick="Fin.abrirFormRetirada()">+ Nova Retirada</button>
      </div>`;

    if (!lista.length) {
      cont.innerHTML = configRetiradas + acoes + bannerProLabore + `<div class="empty-state" style="padding:32px"><div class="empty-icon">💸</div><div class="empty-title">Nenhuma retirada em ${mes}</div><div class="empty-sub">Registre suas retiradas pessoais para ter controle financeiro real</div></div>`;
      return;
    }

    cont.innerHTML = configRetiradas + acoes + bannerProLabore + bannerLimite + lista.map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${r.descricao || 'Retirada'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${Utils.data(r.data)}</div>
        </div>
        <div style="font-weight:800;font-size:16px;color:var(--danger)">− ${Utils.moeda(r.valor)}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="Fin.abrirFormRetirada('${r.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="Fin.excluirRetirada('${r.id}')">🗑</button>
        </div>
      </div>`).join('');
  },

  _salvarConfigRetiradas: () => {
    const pl = parseFloat(document.getElementById('inputProLabore')?.value) || 0;
    const lm = parseFloat(document.getElementById('inputLimiteRetirada')?.value) || 0;
    DB.Config.set('proLabore', pl);
    DB.Config.set('limiteRetirada', lm);
    Fin._renderRetiradas();
    Utils.toast('Configuração salva!', 'success');
  },

  _registrarProLabore: () => {
    const proLabore = DB.Config.get('proLabore', 0);
    if (!proLabore) return;
    DB.Retiradas.salvar({
      data: Utils.hoje(),
      valor: proLabore,
      descricao: 'Pró-labore'
    });
    Fin._renderRetiradas();
    Utils.toast(`Pró-labore de ${Utils.moeda(proLabore)} registrado!`, 'success');
  },

  abrirFormRetirada: (id) => {
    Fin._retiradasEditando = id ? DB.Retiradas.listar().find(r => r.id === id) : null;
    document.getElementById('modalRetiradaTitulo').textContent = Fin._retiradasEditando ? 'Editar Retirada' : 'Nova Retirada';
    const f = document.getElementById('formRetirada');
    const src = Fin._retiradasEditando || {};
    f.data.value      = src.data      || Utils.hoje();
    f.valor.value     = src.valor     || '';
    f.descricao.value = src.descricao || 'Pró-labore';
    Utils.abrirModal('modalRetirada');
  },

  salvarRetirada: (e) => {
    e.preventDefault();
    const f = document.getElementById('formRetirada');
    DB.Retiradas.salvar({
      id: Fin._retiradasEditando?.id,
      data: f.data.value,
      valor: parseFloat(f.valor.value) || 0,
      descricao: f.descricao.value.trim() || 'Retirada'
    });
    Utils.fecharModal('modalRetirada');
    Fin._renderRetiradas();
    Utils.toast('Retirada salva!', 'success');
  },

  excluirRetirada: (id) => {
    if (!Utils.confirmar('Excluir esta retirada?')) return;
    DB.Retiradas.excluir(id);
    Fin._renderRetiradas();
    Utils.toast('Retirada excluída');
  },

  // ---- PAINEL DE PRIORIDADES (Consultor Financeiro) ----
  _renderPrioridades: () => {
    const cont = document.getElementById('painelPrioridades');
    if (!cont) return;

    const hoje = Utils.hoje();
    const mes  = Utils.hoje().substring(0, 7);
    const saldoSalvo = parseFloat(DB.Config.get('fluxoSaldoInicial', 0)) || 0;

    const todas       = DB.Despesas.listar().filter(d => !d.pago);
    const lojaDesp    = todas.filter(d => (d.origem || 'loja') === 'loja');
    const pessoalDesp = todas.filter(d => d.origem === 'pessoal');
    const totalLoja    = lojaDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalPessoal = pessoalDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalGeral   = totalLoja + totalPessoal;
    const lojaVencidas    = lojaDesp.filter(d => d.vencimento && d.vencimento < hoje);
    const pessoalVencidas = pessoalDesp.filter(d => d.vencimento && d.vencimento < hoje);
    const totalLojaVencida    = lojaVencidas.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalPessoalVencida = pessoalVencidas.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);

    const meses3 = [];
    for (let m = 0; m < 3; m++) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - m);
      meses3.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
    }
    const receitaMedia = meses3.reduce((s, m) => s + Fin.calcularDRE(m).receitaBruta, 0) / 3;

    // Render static shell (summary cards + input) — always fresh so paid debts update totals
    cont.innerHTML = `
      <!-- SITUAÇÃO GERAL -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px">
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;border-left:4px solid var(--primary)">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">🏪 Dívidas da Loja</div>
          <div style="font-size:22px;font-weight:900;color:${totalLojaVencida>0?'var(--danger)':'var(--text)'}">${Utils.moeda(totalLoja)}</div>
          ${totalLojaVencida>0?`<div style="font-size:12px;color:var(--danger);font-weight:700">${lojaVencidas.length} vencida(s): ${Utils.moeda(totalLojaVencida)}</div>`:'<div style="font-size:12px;color:var(--text-muted)">Nenhuma vencida ✓</div>'}
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;border-left:4px solid #8b5cf6">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">🏠 Dívidas Pessoais</div>
          <div style="font-size:22px;font-weight:900;color:${totalPessoalVencida>0?'var(--danger)':'var(--text)'}">${Utils.moeda(totalPessoal)}</div>
          ${totalPessoalVencida>0?`<div style="font-size:12px;color:var(--danger);font-weight:700">${pessoalVencidas.length} vencida(s): ${Utils.moeda(totalPessoalVencida)}</div>`:'<div style="font-size:12px;color:var(--text-muted)">Nenhuma vencida ✓</div>'}
        </div>
        <div style="background:var(--card-bg);border:2px solid var(--danger);border-radius:var(--radius);padding:14px 16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">💳 Total Geral</div>
          <div style="font-size:22px;font-weight:900;color:var(--danger)">${Utils.moeda(totalGeral)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${receitaMedia>0?(totalGeral/receitaMedia*100).toFixed(0)+'% do faturamento médio':'registre vendas para ver %'}</div>
        </div>
        ${receitaMedia>0?`<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">📈 Receita média</div>
          <div style="font-size:22px;font-weight:900;color:var(--success)">${Utils.moeda(receitaMedia)}</div>
          <div style="font-size:12px;color:var(--text-muted)">média últimos 3 meses</div>
        </div>`:''}
      </div>

      <!-- SALDO DISPONÍVEL — input rendered once, results updated by _calcPrioridadesResultados -->
      <div class="card" style="margin-bottom:16px;border-color:var(--primary)">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div class="card-title" style="margin-bottom:4px">💰 Quanto você tem disponível agora?</div>
            <div style="font-size:13px;color:var(--text-muted)">Informe o saldo em caixa + banco para ver o que consegue pagar.</div>
          </div>
          <input type="number" id="inputSaldoPrioridade" class="form-control" placeholder="R$ 0,00" step="0.01"
            style="max-width:200px;font-size:20px;font-weight:700;text-align:center"
            value="${saldoSalvo||''}"
            oninput="DB.Config.set('fluxoSaldoInicial',this.value);Fin._calcPrioridadesResultados()">
        </div>
        <div id="priorSaldoFeedback"></div>
      </div>

      <div id="priorResultados"></div>`;

    Fin._calcPrioridadesResultados();
  },

  _calcPrioridadesResultados: () => {
    const feedbackEl = document.getElementById('priorSaldoFeedback');
    const resultEl   = document.getElementById('priorResultados');
    if (!feedbackEl || !resultEl) return;

    const saldoSalvo = parseFloat(document.getElementById('inputSaldoPrioridade')?.value || 0) || 0;
    const hoje = Utils.hoje();
    const mes  = Utils.hoje().substring(0, 7);

    const todas       = DB.Despesas.listar().filter(d => !d.pago);
    const lojaDesp    = todas.filter(d => (d.origem || 'loja') === 'loja');
    const pessoalDesp = todas.filter(d => d.origem === 'pessoal');
    const totalLoja    = lojaDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalPessoal = pessoalDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalGeral   = totalLoja + totalPessoal;

    const meses3 = [];
    for (let m = 0; m < 3; m++) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - m);
      meses3.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
    }
    const receitaMedia = meses3.reduce((s, m) => s + Fin.calcularDRE(m).receitaBruta, 0) / 3;
    const dreAtual     = Fin.calcularDRE(mes);

    const em30 = (() => { const dt = new Date(hoje); dt.setDate(dt.getDate()+30); return dt.toISOString().split('T')[0]; })();
    const crediarioReceber = DB.Crediario.listar().reduce((s, c) => {
      if (!c.parcelas) return s;
      c.parcelas.forEach(p => { if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= em30) s += parseFloat(p.valor)||0; });
      return s;
    }, 0);
    const crediarioVencido = DB.Crediario.listar().reduce((s, c) => {
      if (!c.parcelas) return s;
      c.parcelas.forEach(p => { if (p.status !== 'pago' && p.vencimento && p.vencimento < hoje) s += parseFloat(p.valor)||0; });
      return s;
    }, 0);

    const getPriorityReason = (d, dias) => {
      const desc = (d.descricao || '').toLowerCase();
      if (dias < 0) {
        const n = Math.abs(dias);
        if (desc.includes('aluguel')) return `Atrasada há ${n} dia(s) — risco de rescisão contratual`;
        if (desc.includes('energia') || desc.includes('luz') || desc.includes('água') || desc.includes('agua')) return `Atrasada há ${n} dia(s) — risco de corte do serviço`;
        if (desc.includes('salário') || desc.includes('salario') || desc.includes('folha')) return `Atrasada há ${n} dia(s) — obrigação trabalhista, gera multa`;
        if (d.categoria === 'imposto') return `Atrasada há ${n} dia(s) — multa e juros da Receita`;
        return `Atrasada há ${n} dia(s) — cada dia acumula juros e multa`;
      }
      if (dias === 0) return 'Vence hoje — pague antes de qualquer outra coisa';
      if (dias <= 3) {
        if (desc.includes('energia') || desc.includes('luz')) return 'Vence em breve — corte de energia paralisa a loja';
        if (desc.includes('aluguel')) return 'Vence em breve — priorize para não atrasar';
        return `Vence em ${dias} dia(s) — muito urgente`;
      }
      if (dias <= 7) return `Vence em ${dias} dia(s) — programe o pagamento esta semana`;
      if (dias <= 30) return `Vence em ${dias} dia(s) — planeje para esse mês`;
      return dias === 999 ? 'Sem data definida — planeje quando possível' : `Vence em ${dias} dia(s) — sem urgência imediata`;
    };

    const comPrioridade = todas.map(d => {
      const diasAteVenc = d.vencimento
        ? Math.ceil((new Date(d.vencimento + 'T00:00:00') - new Date(hoje + 'T00:00:00')) / 86400000)
        : 999;
      let score = 0;
      if (diasAteVenc < -30)      score = 230;
      else if (diasAteVenc < -7)  score = 185;
      else if (diasAteVenc < 0)   score = 155 + Math.abs(diasAteVenc) * 2;
      else if (diasAteVenc === 0) score = 130;
      else if (diasAteVenc <= 3)  score = 100;
      else if (diasAteVenc <= 7)  score = 75;
      else if (diasAteVenc <= 15) score = 50;
      else if (diasAteVenc <= 30) score = 30;
      else                        score = 10;
      const desc = (d.descricao || '').toLowerCase();
      if (desc.includes('energia') || desc.includes('luz') || desc.includes('água') || desc.includes('agua')) score += 40;
      else if (desc.includes('aluguel')) score += 35;
      else if (desc.includes('salário') || desc.includes('salario') || desc.includes('folha')) score += 38;
      else if (d.categoria === 'imposto') score += 30;
      else if (d.categoria === 'fixo' || d.recorrente) score += 20;
      if (d.origem === 'pessoal') {
        if (d.categoria === 'moradia')     score += 28;
        else if (d.categoria === 'saude') score += 25;
        else if (d.categoria === 'alimentacao') score += 20;
      } else {
        score += 10;
      }
      return { ...d, score, diasAteVenc, reason: getPriorityReason(d, diasAteVenc) };
    }).sort((a, b) => b.score - a.score);

    const grupos = {
      critico: comPrioridade.filter(d => d.diasAteVenc < 0),
      urgente: comPrioridade.filter(d => d.diasAteVenc >= 0 && d.diasAteVenc <= 7),
      proximo: comPrioridade.filter(d => d.diasAteVenc > 7 && d.diasAteVenc <= 30),
      planej:  comPrioridade.filter(d => d.diasAteVenc > 30 || d.diasAteVenc === 999),
    };

    let saldoRestante = saldoSalvo;
    const pagaveis = new Set();
    for (const d of comPrioridade) {
      const v = parseFloat(d.valor) || 0;
      if (saldoRestante >= v) { saldoRestante -= v; pagaveis.add(d.id); }
    }
    const valorPagaveis = comPrioridade.filter(d => pagaveis.has(d.id)).reduce((s,d)=>s+(parseFloat(d.valor)||0),0);

    // Atualiza feedback do saldo
    feedbackEl.innerHTML = saldoSalvo > 0 ? `
      <div style="margin-top:12px;padding:10px 14px;background:${pagaveis.size===comPrioridade.length?'rgba(34,197,94,.1)':'rgba(234,179,8,.1)'};border-radius:var(--radius-sm);font-size:13px">
        ${pagaveis.size===comPrioridade.length
          ?`✅ Com <strong>${Utils.moeda(saldoSalvo)}</strong> você consegue pagar <strong>TODAS</strong> as ${comPrioridade.length} contas pendentes!`
          :`⚠️ Com <strong>${Utils.moeda(saldoSalvo)}</strong> você consegue pagar <strong>${pagaveis.size}</strong> de <strong>${comPrioridade.length}</strong> contas seguindo a ordem do consultor. Saldo sobrando: <strong>${Utils.moeda(saldoRestante)}</strong>.`}
      </div>` : '';

    // Dicas do consultor
    const dicas = [];
    const pctDivida = receitaMedia > 0 ? (totalGeral / receitaMedia) * 100 : 0;
    if (grupos.critico.length > 0) {
      const totalCrit = grupos.critico.reduce((s,d)=>s+(parseFloat(d.valor)||0),0);
      dicas.push({ urg: 'danger', icon: '🚨', txt: `Você tem <strong>${grupos.critico.length} conta(s) vencida(s)</strong> somando <strong>${Utils.moeda(totalCrit)}</strong>. Cada dia que passa acumula multa. Regularize agora antes de pagar qualquer outra coisa.` });
    }
    if (crediarioVencido > 0)
      dicas.push({ urg: 'warning', icon: '💰', txt: `Há <strong>${Utils.moeda(crediarioVencido)}</strong> de crediário vencido a receber. Ligue para esses clientes hoje — esse dinheiro já é seu e pode ajudar a quitar dívidas.` });
    if (crediarioReceber > 0)
      dicas.push({ urg: 'info', icon: '📅', txt: `Nos próximos 30 dias você vai receber <strong>${Utils.moeda(crediarioReceber)}</strong> de crediários. Use isso para planejar o pagamento das contas que vencem nesse período.` });
    if (pctDivida > 100 && receitaMedia > 0)
      dicas.push({ urg: 'danger', icon: '⚠️', txt: `Suas dívidas (<strong>${Utils.moeda(totalGeral)}</strong>) representam <strong>${pctDivida.toFixed(0)}%</strong> do faturamento médio. Esse nível de endividamento precisa de ação urgente — considere renegociar os maiores valores.` });
    if (totalPessoal > receitaMedia * 0.4 && receitaMedia > 0)
      dicas.push({ urg: 'warning', icon: '🏠', txt: `Despesas pessoais de <strong>${Utils.moeda(totalPessoal)}</strong> representam <strong>${((totalPessoal/receitaMedia)*100).toFixed(0)}%</strong> do faturamento. Tente manter abaixo de 30% para não sufocar o negócio.` });
    if (saldoSalvo > 0 && pagaveis.size < comPrioridade.length && comPrioridade.length > 0)
      dicas.push({ urg: 'info', icon: '💡', txt: `Com <strong>${Utils.moeda(saldoSalvo)}</strong> você consegue pagar <strong>${pagaveis.size}</strong> de <strong>${comPrioridade.length}</strong> contas (as mais urgentes primeiro). Ainda faltam <strong>${Utils.moeda(totalGeral - valorPagaveis)}</strong> para quitar tudo.` });
    if (dreAtual.margemLiquida > 0 && dreAtual.margemLiquida < 10 && dreAtual.receitaBruta > 0)
      dicas.push({ urg: 'warning', icon: '📉', txt: `Sua margem líquida está em <strong>${dreAtual.margemLiquida.toFixed(1)}%</strong> este mês. Com margem tão baixa, qualquer imprevisto vira prejuízo. Revise os preços ou corte despesas desnecessárias.` });
    if (dicas.length === 0 && todas.length === 0)
      dicas.push({ urg: 'success', icon: '🎉', txt: 'Nenhuma dívida pendente! Suas finanças estão em dia.' });

    const corDica = { danger:'var(--danger)', warning:'var(--warning)', success:'var(--success)', info:'var(--primary)' };
    const bgDica  = { danger:'rgba(239,68,68,.08)', warning:'rgba(234,179,8,.08)', success:'rgba(34,197,94,.08)', info:'rgba(249,115,22,.08)' };

    const renderGrupo = (items, titulo, cor, bg, instrucao) => {
      if (items.length === 0) return '';
      const total = items.reduce((s,d)=>s+(parseFloat(d.valor)||0),0);
      return `
        <div style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:${bg};border-radius:var(--radius-sm) var(--radius-sm) 0 0;border-left:4px solid ${cor};border-top:1px solid ${cor};border-right:1px solid ${cor}">
            <div>
              <span style="font-weight:800;color:${cor};font-size:14px">${titulo}</span>
              <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${items.length} conta(s)</span>
            </div>
            <div style="text-align:right">
              <div style="font-weight:900;font-size:16px;color:${cor}">${Utils.moeda(total)}</div>
              <div style="font-size:11px;color:var(--text-muted)">${instrucao}</div>
            </div>
          </div>
          <div style="border:1px solid ${cor};border-top:none;border-radius:0 0 var(--radius-sm) var(--radius-sm);overflow:hidden">
            ${items.map(d => {
              const isPessoal = d.origem === 'pessoal';
              const corBorda  = isPessoal ? '#8b5cf6' : 'var(--primary)';
              const badge = isPessoal
                ? `<span style="font-size:10px;background:rgba(139,92,246,.15);color:#8b5cf6;border-radius:4px;padding:1px 6px;font-weight:700">🏠 Pessoal</span>`
                : `<span style="font-size:10px;background:var(--primary-dim);color:var(--primary);border-radius:4px;padding:1px 6px;font-weight:700">🏪 Loja</span>`;
              const cabeSaldo = pagaveis.has(d.id);
              const numGlobal = comPrioridade.indexOf(d) + 1;
              return `
              <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);border-left:4px solid ${corBorda};${cabeSaldo?'background:'+bg:'background:var(--card-bg)'}">
                <div style="font-size:15px;font-weight:900;color:var(--text-muted);width:22px;flex-shrink:0;text-align:center;margin-top:2px">${numGlobal}</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    ${d.descricao} ${badge}
                    ${cabeSaldo?'<span style="font-size:10px;background:rgba(34,197,94,.15);color:var(--success);border-radius:4px;padding:1px 6px;font-weight:700">✓ cabe no saldo</span>':''}
                  </div>
                  <div style="font-size:12px;color:${cor};margin-top:3px;font-weight:500">↳ ${d.reason}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:800;font-size:16px;color:${cor}">${Utils.moeda(d.valor)}</div>
                  <button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:11px;padding:2px 8px" onclick="Fin.pagarDespesa('${d.id}')">✅ Pagar</button>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    };

    // ── Renda Pessoal ──────────────────────────────────────────────────────
    const rendas       = DB.RendaPessoal.listar();
    const totalRenda   = DB.RendaPessoal.totalMensal();
    const saldoLivre   = totalRenda - totalPessoal;
    const tipoLabel    = { prolabore: '💼 Pró-labore', salario_conjuge: '👩 Cônjuge', outro: '💰 Outra renda' };
    const pctFolga     = totalRenda > 0 ? (saldoLivre / totalRenda) * 100 : 0;

    const rendaCard = `
      <div class="card" style="margin-bottom:16px;border-left:4px solid #10b981">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${rendas.length?'14px':'8px'}">
          <div class="card-title" style="margin:0">💼 Renda Mensal Pessoal</div>
          <button onclick="Fin._abrirFormRendaPessoal(null)" class="btn btn-sm btn-primary" style="font-size:12px">+ Adicionar</button>
        </div>
        ${rendas.length === 0 ? `
        <div style="text-align:center;padding:20px 0 12px;color:var(--text-muted);font-size:13px">
          Cadastre seu pró-labore e a renda do cônjuge para ver o balanço pessoal do mês.
        </div>` : `
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
          ${rendas.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg);border-radius:var(--radius-sm)">
            <div>
              <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:2px">${tipoLabel[r.tipo] || '💰 Renda'}</div>
              <div style="font-weight:600;font-size:14px">${r.descricao}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-weight:800;font-size:17px;color:#10b981">${Utils.moeda(r.valor)}<span style="font-size:11px;font-weight:500;color:var(--text-muted)">/mês</span></span>
              <button onclick="Fin._abrirFormRendaPessoal('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:3px 5px;border-radius:4px" title="Editar">✏️</button>
              <button onclick="Fin._excluirRendaPessoal('${r.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:3px 5px;border-radius:4px" title="Excluir">🗑️</button>
            </div>
          </div>`).join('')}
        </div>
        <div style="border-top:2px dashed var(--border);padding-top:12px">
          <div style="display:flex;flex-direction:column;gap:4px">
            ${Fin._linhaAnalise('Total a receber por mês', Utils.moeda(totalRenda), 'success')}
            ${Fin._linhaAnalise('Despesas pessoais pendentes', '− ' + Utils.moeda(totalPessoal), 'danger')}
            <div style="height:1px;background:var(--border);margin:2px 0"></div>
            ${Fin._linhaAnalise('Saldo pessoal livre', Utils.moeda(saldoLivre), saldoLivre >= 0 ? 'success' : 'danger', true)}
          </div>
          <div style="margin-top:10px;padding:10px 14px;background:${saldoLivre < 0 ? 'rgba(239,68,68,.1)' : pctFolga < 15 ? 'rgba(234,179,8,.1)' : 'rgba(16,185,129,.08)'};border-radius:var(--radius-sm);font-size:13px;border-left:3px solid ${saldoLivre < 0 ? 'var(--danger)' : pctFolga < 15 ? 'var(--warning)' : '#10b981'}">
            ${saldoLivre < 0
              ? `🔴 Suas despesas pessoais superam a renda em <strong>${Utils.moeda(Math.abs(saldoLivre))}</strong>. Isso pressiona diretamente o caixa da loja.`
              : pctFolga < 15
              ? `⚠️ A folga é pequena — só <strong>${pctFolga.toFixed(0)}%</strong> da renda fica livre. Tente manter ao menos 20% de reserva pessoal.`
              : `✅ Sobram <strong>${Utils.moeda(saldoLivre)}</strong> após as despesas pessoais (${pctFolga.toFixed(0)}% da renda fica livre).`}
          </div>
        </div>`}
      </div>`;

    // ── Inadimplentes para cobrar ──────────────────────────────────────────
    const inadimplentes = DB.Crediario.inadimplentes();
    const porCliente = {};
    inadimplentes.forEach(p => {
      if (!porCliente[p.clienteId]) {
        const cli = DB.Clientes.buscar(p.clienteId);
        porCliente[p.clienteId] = { nome: p.clienteNome, valor: 0, qtd: 0, tel: (cli?.telefone || '').replace(/\D/g,'') };
      }
      porCliente[p.clienteId].valor += parseFloat(p.valor) || 0;
      porCliente[p.clienteId].qtd++;
    });
    const topInad = Object.values(porCliente).sort((a,b) => b.valor - a.valor).slice(0, 6);
    const totalInad = Object.values(porCliente).reduce((s,c) => s + c.valor, 0);

    const cobrarCard = topInad.length === 0 ? '' : `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--danger)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="card-title" style="margin:0">📞 Cobrar Agora — ${Utils.moeda(totalInad)} em atraso</div>
          <span style="font-size:12px;color:var(--text-muted)">Esse dinheiro já é seu. Ligue hoje.</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${topInad.map(c => {
            const msg = encodeURIComponent(`Olá, ${c.nome.split(' ')[0]}! 😊 Passando para avisar que você tem ${c.qtd} parcela(s) em atraso no crediário da Move Pé, totalizando ${Utils.moeda(c.valor)}. Podemos resolver isso? 🙏`);
            const waLink = c.tel ? `https://wa.me/55${c.tel}?text=${msg}` : '';
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(239,68,68,.05);border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,.15)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:14px">${c.nome}</div>
                <div style="font-size:12px;color:var(--text-muted)">${c.qtd} parcela(s) vencida(s)</div>
              </div>
              <div style="font-weight:900;font-size:16px;color:var(--danger);white-space:nowrap">${Utils.moeda(c.valor)}</div>
              ${waLink ? `<a href="${waLink}" target="_blank" style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">💬 WhatsApp</a>` : ''}
            </div>`;
          }).join('')}
        </div>
        ${Object.keys(porCliente).length > 6 ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;text-align:center">+${Object.keys(porCliente).length - 6} outros inadimplentes — veja todos no Crediário</div>` : ''}
      </div>`;

    // ── Produtos parados para liquidar ────────────────────────────────────
    const parados = DB.Produtos.listarParados(60).filter(p => DB.Produtos.estoqueTotal(p) > 0).slice(0, 5);
    const capitalParado = parados.reduce((s,p) => s + (p.capitalPreso || 0), 0);

    const liquidarCard = parados.length === 0 ? '' : `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--warning)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="card-title" style="margin:0">🏷 Liquidar para liberar caixa — ${Utils.moeda(capitalParado)} parado</div>
          <span style="font-size:12px;color:var(--text-muted)">Dê desconto e gire antes de comprar mais</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${parados.map(p => {
            const qtd = DB.Produtos.estoqueTotal(p);
            const precoSug = Math.round(p.precoCusto * 1.1 * 100) / 100; // 10% acima do custo
            const pctDesc = p.precoVenda > 0 ? Math.round((1 - precoSug/p.precoVenda)*100) : 0;
            const diasMsg = p.diasSemVenda >= 999 ? 'Nunca vendido' : `${p.diasSemVenda} dias parado`;
            return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(234,179,8,.05);border-radius:var(--radius-sm);border:1px solid rgba(234,179,8,.2)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:13px">${p.nome}</div>
                <div style="font-size:12px;color:var(--text-muted)">${qtd} peça(s) · ${diasMsg}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:11px;color:var(--text-muted)">Venda por</div>
                <div style="font-weight:900;color:var(--warning);font-size:15px">${Utils.moeda(precoSug)}</div>
                <div style="font-size:11px;color:var(--success)">${pctDesc > 0 ? `desconto de ${pctDesc}%` : 'sem desconto'}</div>
              </div>
              <a href="estoque.html?editar=${p.id}" class="btn btn-outline btn-sm" style="white-space:nowrap;flex-shrink:0">✏️ Editar</a>
            </div>`;
          }).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:8px">
          💡 Preço sugerido = custo + 10% (mínimo para não perder dinheiro). Ajuste conforme necessário.
        </div>
      </div>`;

    // ── Quando posso comprar? ─────────────────────────────────────────────
    const contasProx30 = todas.filter(d => d.vencimento && d.vencimento >= hoje && d.vencimento <= em30);
    const totalContasProx30 = contasProx30.reduce((s,d) => s + (parseFloat(d.valor)||0), 0);
    const totalVencidas = grupos.critico.reduce((s,d) => s + (parseFloat(d.valor)||0), 0);
    const necessarioParaPagar = totalVencidas + totalContasProx30;
    const reservaSeguranca = Math.round(totalContasProx30 * 0.3); // 30% das contas do mês como reserva
    const totalNecessario = necessarioParaPagar + reservaSeguranca;
    const entradasEsperadas = saldoSalvo + crediarioReceber;
    const disponivelCompra = Math.max(0, entradasEsperadas - totalNecessario);
    const podeComprar = disponivelCompra > 0;
    const faltaParaComprar = Math.max(0, totalNecessario - entradasEsperadas);

    const comprarCard = `
      <div class="card" style="margin-bottom:16px;border-left:4px solid ${podeComprar ? 'var(--success)' : 'var(--danger)'}">
        <div class="card-title" style="margin-bottom:14px">🛒 Quando posso comprar estoque?</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">Saldo + crediário</div>
            <div style="font-weight:800;font-size:16px;color:var(--success)">${Utils.moeda(entradasEsperadas)}</div>
            <div style="font-size:11px;color:var(--text-muted)">o que vai entrar</div>
          </div>
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">Contas a pagar</div>
            <div style="font-weight:800;font-size:16px;color:var(--danger)">${Utils.moeda(necessarioParaPagar)}</div>
            <div style="font-size:11px;color:var(--text-muted)">vencidas + próx 30 dias</div>
          </div>
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">Reserva de segurança</div>
            <div style="font-weight:800;font-size:16px;color:var(--warning)">${Utils.moeda(reservaSeguranca)}</div>
            <div style="font-size:11px;color:var(--text-muted)">30% das contas do mês</div>
          </div>
          <div style="background:${podeComprar?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};border:2px solid ${podeComprar?'var(--success)':'var(--danger)'};border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">Disponível p/ compra</div>
            <div style="font-weight:900;font-size:18px;color:${podeComprar?'var(--success)':'var(--danger)'}">${Utils.moeda(disponivelCompra)}</div>
            <div style="font-size:11px;font-weight:700;color:${podeComprar?'var(--success)':'var(--danger)'}">${podeComprar ? '✅ pode comprar' : '🔴 não compre agora'}</div>
          </div>
        </div>
        <div style="padding:12px 14px;background:${podeComprar?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)'};border-radius:var(--radius-sm);font-size:13px;line-height:1.6">
          ${podeComprar
            ? `✅ <strong>Você tem ${Utils.moeda(disponivelCompra)} disponível para reposição</strong> após pagar todas as contas e manter uma reserva de segurança. Compre apenas produtos que já comprovaram que vendem — foque nos mais rápidos.`
            : `🔴 <strong>Não compre estoque agora.</strong> Ainda faltam ${Utils.moeda(faltaParaComprar)} para cobrir todas as contas e ter uma reserva mínima. Primeiro: ${totalVencidas > 0 ? 'quite as contas vencidas, ' : ''}receba o crediário em atraso (${Utils.moeda(crediarioVencido)}) e gire o estoque parado com promoções.`}
        </div>
        ${!podeComprar && crediarioVencido > 0 ? `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(99,102,241,.08);border-radius:var(--radius-sm);font-size:13px;border-left:3px solid var(--primary)">
          💡 <strong>Ação mais rápida:</strong> Se você cobrar <strong>${Utils.moeda(crediarioVencido)}</strong> de crediário vencido, o disponível para compra muda para <strong style="color:${(entradasEsperadas + crediarioVencido - totalNecessario) > 0 ? 'var(--success)' : 'var(--warning)'}">${Utils.moeda(Math.max(0, entradasEsperadas + crediarioVencido - totalNecessario))}</strong>.
        </div>` : ''}
      </div>`;

    resultEl.innerHTML = `
      ${rendaCard}
      ${cobrarCard}
      ${dicas.length?`
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:12px">🧠 O que o consultor recomenda</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${dicas.map(d=>`
            <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:${bgDica[d.urg]};border-radius:var(--radius-sm);border-left:3px solid ${corDica[d.urg]}">
              <span style="font-size:18px;flex-shrink:0">${d.icon}</span>
              <span style="font-size:13px;line-height:1.6">${d.txt}</span>
            </div>`).join('')}
        </div>
      </div>`:''}
      ${comprarCard}
      ${liquidarCard}
      ${comPrioridade.length===0
        ?`<div class="card"><div class="empty-state" style="padding:32px"><div class="empty-icon">🎉</div><div class="empty-title">Nenhuma dívida pendente!</div><div class="empty-sub">Parabéns, você está em dia.</div></div></div>`
        :`<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
            📋 Plano de Pagamento — ${comPrioridade.length} conta(s) na ordem do consultor
          </div>
          ${renderGrupo(grupos.critico,'🔴 PAGUE AGORA — Contas Vencidas','var(--danger)','rgba(239,68,68,.05)','pague imediatamente')}
          ${renderGrupo(grupos.urgente,'🟠 ESTA SEMANA — Vence em até 7 dias','#f97316','rgba(249,115,22,.05)','programe esta semana')}
          ${renderGrupo(grupos.proximo,'🟡 ESSE MÊS — Vence em até 30 dias','var(--warning)','rgba(234,179,8,.05)','planeje com antecedência')}
          ${renderGrupo(grupos.planej,'🟢 PODE PLANEJAR — Mais de 30 dias','var(--success)','rgba(34,197,94,.05)','sem urgência imediata')}`
      }`;
  },

  // ---- SIMULADOR DE EMPRÉSTIMO ----
  _calcPMT: (pv, i, n) => {
    if (!n || n <= 0) return 0;
    if (i === 0) return pv / n;
    return pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  },

  _renderEmprestimo: () => {
    const cont = document.getElementById('painelEmprestimo');
    if (!cont) return;

    // Render the form shell only ONCE — avoids destroying focused inputs on each keystroke
    if (!document.getElementById('empValor')) {
      const cfg = JSON.parse(localStorage.getItem('movePe_emprestimo_sim') || '{}');
      cont.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:16px">💳 Simulador de Empréstimo</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Valor do empréstimo (R$)</label>
              <input type="number" class="form-control" id="empValor" placeholder="0" step="100" min="0"
                value="${cfg.valor||''}"
                oninput="Fin._salvarSimEmp();Fin._calcEmpResultados()"
                style="font-size:18px;font-weight:700;text-align:center">
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Taxa de juros (% ao mês)</label>
              <input type="number" class="form-control" id="empTaxa" placeholder="Ex: 2" step="0.1" min="0"
                value="${cfg.taxaMes||''}"
                oninput="Fin._salvarSimEmp();Fin._calcEmpResultados()"
                style="font-size:18px;font-weight:700;text-align:center">
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Número de parcelas</label>
              <input type="number" class="form-control" id="empParcelas" placeholder="12" step="1" min="1" max="120"
                value="${cfg.parcelas||12}"
                oninput="Fin._salvarSimEmp();Fin._calcEmpResultados()"
                style="font-size:18px;font-weight:700;text-align:center">
            </div>
          </div>
          <div id="empResumoCalc"></div>
        </div>
        <div id="empResultados"></div>`;
    }
    Fin._calcEmpResultados();
  },

  _calcEmpResultados: () => {
    const resumoEl = document.getElementById('empResumoCalc');
    const resultEl = document.getElementById('empResultados');
    if (!resumoEl || !resultEl) return;

    const valor    = parseFloat(document.getElementById('empValor')?.value   || 0);
    const taxaMes  = parseFloat(document.getElementById('empTaxa')?.value    || 0);
    const parcelas = parseInt(document.getElementById('empParcelas')?.value  || 12);

    const hoje = Utils.hoje();
    const mes  = Utils.hoje().substring(0, 7);
    const i    = taxaMes / 100;
    const pmt  = valor > 0 && parcelas > 0 ? Fin._calcPMT(valor, i, parcelas) : 0;
    const totalPago      = pmt * parcelas;
    const totalJuros     = totalPago - valor;
    const cetAnual       = taxaMes > 0 ? ((Math.pow(1 + i, 12) - 1) * 100) : 0;
    const jurosSimplesTotal = valor * (taxaMes / 100) * parcelas;

    // Dados financeiros reais
    const meses3 = [];
    for (let m = 0; m < 3; m++) {
      const dt = new Date(); dt.setMonth(dt.getMonth() - m);
      meses3.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
    }
    const receitaMedia = meses3.reduce((s, m) => s + Fin.calcularDRE(m).receitaBruta, 0) / 3;
    const dreAtual     = Fin.calcularDRE(mes);

    // Dívidas completas (loja + pessoal)
    const todasDesp        = DB.Despesas.listar().filter(d => !d.pago);
    const lojaDesp         = todasDesp.filter(d => (d.origem || 'loja') === 'loja');
    const pessoalDesp      = todasDesp.filter(d => d.origem === 'pessoal');
    const totalLojaDesp    = lojaDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalPessoalDesp = pessoalDesp.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalDesp        = totalLojaDesp + totalPessoalDesp;
    const vencidas         = todasDesp.filter(d => d.vencimento && d.vencimento < hoje);
    const totalVencido     = vencidas.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);

    // Cenário A: quitar dívidas em ordem de prioridade
    const despOrdenadas = [...todasDesp].map(d => {
      const dias = d.vencimento ? Math.ceil((new Date(d.vencimento+'T00:00:00')-new Date(hoje+'T00:00:00'))/86400000) : 999;
      let sc = dias < 0 ? 150+Math.abs(dias) : dias <= 7 ? 90 : dias <= 30 ? 60 : 20;
      if (d.categoria === 'fixo' || d.recorrente) sc += 20;
      return { ...d, sc, dias };
    }).sort((a, b) => b.sc - a.sc);

    let saldoLoan = valor;
    const quitadas = [];
    for (const d of despOrdenadas) {
      const v = parseFloat(d.valor) || 0;
      if (saldoLoan >= v) { saldoLoan -= v; quitadas.push(d); }
    }
    const totalQuitado    = quitadas.reduce((s, d) => s + (parseFloat(d.valor)||0), 0);
    const totalNaoQuitado = totalDesp - totalQuitado;
    const vencidasQuitadas = quitadas.filter(d => d.vencimento && d.vencimento < hoje);
    const economiaMultas  = vencidasQuitadas.reduce((s, d) => s + (parseFloat(d.valor)||0)*0.02*parcelas, 0);

    // Cenário B: investir na loja
    const margemBruta     = dreAtual.margemBruta || 35;
    const retornoEstoque  = valor * (margemBruta / 100);
    const lucroEmpLiquido = retornoEstoque - totalJuros;

    // Viabilidade de caixa — usa lucro líquido médio real (CMV + despesas + retiradas já descontados)
    const lucroMedio  = meses3.reduce((s, m) => s + Fin.calcularDRE(m).lucroLiquido, 0) / 3;
    const sobraComEmp = lucroMedio - pmt;
    const pctParcela  = receitaMedia > 0 ? (pmt / receitaMedia) * 100 : 0;
    const pctLucro    = lucroMedio > 0 ? (pmt / lucroMedio) * 100 : 0;

    // Estoque parado
    const estoqueParado = DB.Produtos.listarParados(60).reduce((s, p) => s + p.capitalPreso, 0);

    // Veredicto final
    let veredicto = null;
    if (pmt > 0) {
      if (lucroMedio <= 0 && receitaMedia > 0) {
        veredicto = { icon: '🔴', label: 'NÃO RECOMENDADO', cor: 'var(--danger)', bg: 'rgba(239,68,68,.1)',
          texto: `A loja está operando sem lucro nos últimos meses. Tomar um empréstimo agora aumentaria as dívidas sem que o negócio gere caixa suficiente para pagar. Primeiro é preciso aumentar o lucro.` };
      } else if (sobraComEmp < 0) {
        veredicto = { icon: '🔴', label: 'NÃO RECOMENDADO', cor: 'var(--danger)', bg: 'rgba(239,68,68,.1)',
          texto: `A parcela de <strong>${Utils.moeda(pmt)}/mês</strong> é maior que o lucro médio da loja (${Utils.moeda(lucroMedio)}). Você ficaria <strong>${Utils.moeda(Math.abs(sobraComEmp))} no vermelho</strong> todo mês — esse empréstimo criaria mais dívida.` };
      } else if (totalVencido > 0 && valor >= totalVencido * 0.7 && pctLucro <= 80) {
        veredicto = { icon: '✅', label: 'PODE COMPENSAR — Para quitar vencidas', cor: 'var(--success)', bg: 'rgba(34,197,94,.1)',
          texto: `Você tem <strong>${Utils.moeda(totalVencido)}</strong> em dívidas vencidas. O custo dos juros do empréstimo (${Utils.moeda(totalJuros)}) tende a ser menor que as multas acumulando nas vencidas. <strong>A parcela cabe no lucro — priorize quitar as vencidas primeiro.</strong>` };
      } else if (pctLucro <= 40 && dreAtual.margemLiquida >= 10 && totalVencido === 0) {
        veredicto = { icon: '✅', label: 'VIÁVEL — Condições favoráveis', cor: 'var(--success)', bg: 'rgba(34,197,94,.1)',
          texto: `A parcela representa <strong>${pctLucro.toFixed(0)}%</strong> do lucro líquido médio e ainda sobrariam <strong>${Utils.moeda(sobraComEmp)}/mês</strong>. Com as dívidas em dia e margem positiva, o empréstimo é administrável.` };
      } else if (pctLucro > 80) {
        veredicto = { icon: '⚠️', label: 'MUITO ARRISCADO', cor: 'var(--warning)', bg: 'rgba(234,179,8,.1)',
          texto: `A parcela consome <strong>${pctLucro.toFixed(0)}%</strong> do lucro líquido. Qualquer mês com vendas abaixo do normal e você não conseguirá pagar. Negocie um prazo maior ou valor menor.` };
      } else {
        veredicto = { icon: '⚠️', label: 'ATENÇÃO — Avalie com cuidado', cor: 'var(--warning)', bg: 'rgba(234,179,8,.1)',
          texto: `Sobraria <strong>${Utils.moeda(sobraComEmp)}/mês</strong> após a parcela — possível, mas sem folga. ${totalVencido > 0 ? 'Regularize as dívidas vencidas antes de pegar o empréstimo, se possível.' : 'Mantenha uma reserva de emergência.'}` };
      }
    }

    // ── Atualiza resumo dentro do card de inputs ──────────────────────────
    resumoEl.innerHTML = pmt > 0 ? `
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px">
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Parcela mensal</div>
            <div style="font-size:26px;font-weight:900;color:var(--primary)">${Utils.moeda(pmt)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Total a pagar</div>
            <div style="font-size:26px;font-weight:900;color:var(--text)">${Utils.moeda(totalPago)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:rgba(239,68,68,.08);border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Total de juros</div>
            <div style="font-size:26px;font-weight:900;color:var(--danger)">${Utils.moeda(totalJuros)}</div>
          </div>
          <div style="text-align:center;padding:12px;background:var(--bg);border-radius:var(--radius-sm)">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">% do faturamento</div>
            <div style="font-size:26px;font-weight:900;color:${pctParcela>35?'var(--danger)':pctParcela>20?'var(--warning)':'var(--success)'}">
              ${receitaMedia>0?pctParcela.toFixed(1)+'%':'—'}
            </div>
          </div>
        </div>
        <!-- Explicação dos juros -->
        <div style="padding:12px 14px;background:rgba(59,130,246,.08);border-radius:var(--radius-sm);border-left:3px solid #3b82f6;font-size:13px;line-height:1.6">
          <strong>ℹ️ Por que o total de juros parece menor do que ${taxaMes}% × ${parcelas} meses?</strong><br>
          Juros simples seria: ${Utils.moeda(jurosSimplesTotal)} (${(taxaMes*parcelas).toFixed(0)}% do valor). Porém o banco usa a <strong>Tabela Price</strong>: a cada parcela você amortiza parte do saldo — então o mês seguinte você paga juros sobre um valor menor. Por isso os juros reais (${Utils.moeda(totalJuros)}) são menores que o cálculo simples.<br>
          <span style="font-size:12px;color:var(--text-muted)">CET anual equivalente: <strong>${cetAnual.toFixed(1)}%</strong> ao ano</span>
        </div>
      </div>` : `
      <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:14px;margin-top:12px">
        Preencha os campos acima para calcular.
      </div>`;

    // ── Atualiza o bloco de análise completa ─────────────────────────────
    if (valor <= 0) {
      resultEl.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:12px">💳</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:8px">Preencha o simulador acima</div>
          <div style="font-size:13px">Informe o valor, a taxa e o número de parcelas para ver a análise completa com dois cenários: quitar dívidas ou investir na loja.</div>
        </div>`;
      return;
    }

    resultEl.innerHTML = `
      <!-- SITUAÇÃO ATUAL DAS DÍVIDAS -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:12px">📊 Situação Atual das Suas Dívidas</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:${estoqueParado>500?'12px':'0'}">
          <div style="padding:12px;background:var(--bg);border-radius:var(--radius-sm);border-left:4px solid var(--primary)">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">🏪 Loja</div>
            <div style="font-size:20px;font-weight:900">${Utils.moeda(totalLojaDesp)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${lojaDesp.length} conta(s)</div>
          </div>
          <div style="padding:12px;background:var(--bg);border-radius:var(--radius-sm);border-left:4px solid #8b5cf6">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">🏠 Pessoal</div>
            <div style="font-size:20px;font-weight:900">${Utils.moeda(totalPessoalDesp)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${pessoalDesp.length} conta(s)</div>
          </div>
          <div style="padding:12px;background:${totalVencido>0?'rgba(239,68,68,.08)':'var(--bg)'};border-radius:var(--radius-sm);border-left:4px solid ${totalVencido>0?'var(--danger)':'var(--border)'}">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">⚠️ Vencidas</div>
            <div style="font-size:20px;font-weight:900;color:${totalVencido>0?'var(--danger)':'var(--text-muted)'}">${Utils.moeda(totalVencido)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${vencidas.length} conta(s)</div>
          </div>
          <div style="padding:12px;background:rgba(239,68,68,.05);border-radius:var(--radius-sm);border:2px solid var(--danger)">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase">💳 TOTAL</div>
            <div style="font-size:20px;font-weight:900;color:var(--danger)">${Utils.moeda(totalDesp)}</div>
            <div style="font-size:11px;color:var(--text-muted)">loja + pessoal</div>
          </div>
        </div>
        ${estoqueParado>500?`
        <div style="padding:10px 14px;background:rgba(234,179,8,.1);border-radius:var(--radius-sm);font-size:13px;border-left:3px solid var(--warning)">
          💡 <strong>Antes de pedir empréstimo:</strong> você tem <strong>${Utils.moeda(estoqueParado)}</strong> em estoque parado há mais de 60 dias. Vender com promoção pode gerar caixa imediato sem custo de juros.
        </div>`:''}
      </div>

      <!-- CENÁRIO A: QUITAR DÍVIDAS -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--danger)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <span style="font-size:20px">🧹</span>
          <div class="card-title" style="margin:0">Cenário A — Usar para QUITAR DÍVIDAS</div>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
          Com <strong>${Utils.moeda(valor)}</strong>, seguindo a ordem de prioridade do consultor, você quitaria ${quitadas.length} de ${despOrdenadas.length} conta(s):
        </div>
        ${quitadas.length > 0 ? `
        <div style="background:rgba(34,197,94,.06);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;border:1px solid rgba(34,197,94,.3)">
          <div style="font-size:12px;font-weight:700;color:var(--success);margin-bottom:8px">✅ Contas quitadas — ${Utils.moeda(totalQuitado)}</div>
          ${quitadas.map(d=>`
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px dashed var(--border)">
              <span>${d.descricao}
                <span style="font-size:10px;margin-left:4px;color:${d.origem==='pessoal'?'#8b5cf6':'var(--primary)'}">${d.origem==='pessoal'?'🏠':'🏪'}</span>
                ${d.vencimento&&d.vencimento<hoje?'<span style="color:var(--danger);font-size:10px;font-weight:700;margin-left:4px">VENCIDA</span>':''}
              </span>
              <strong>${Utils.moeda(d.valor)}</strong>
            </div>`).join('')}
        </div>` : ''}
        ${totalNaoQuitado > 0 ? `
        <div style="background:rgba(239,68,68,.06);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px;font-size:13px;border-left:3px solid var(--danger)">
          ⚠️ Ainda restariam <strong>${Utils.moeda(totalNaoQuitado)}</strong> em dívidas não cobertas pelo empréstimo.
        </div>` : `
        <div style="background:rgba(34,197,94,.08);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--success)">
          ✅ O empréstimo cobre TODAS as dívidas e ainda sobram ${Utils.moeda(valor-totalDesp)} de capital de giro!
        </div>`}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Custo do empréstimo (juros)</div>
            <div style="font-size:18px;font-weight:900;color:var(--danger)">${Utils.moeda(totalJuros)}</div>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Economia estimada (evitar multas)</div>
            <div style="font-size:18px;font-weight:900;color:${economiaMultas>0?'var(--success)':'var(--text-muted)'}">
              ${economiaMultas>0?Utils.moeda(economiaMultas):'Sem vencidas'}
            </div>
          </div>
        </div>
        <div style="margin-top:10px;padding:10px 14px;background:${economiaMultas>totalJuros||totalVencido>totalJuros?'rgba(34,197,94,.1)':'rgba(234,179,8,.1)'};border-radius:var(--radius-sm);font-size:13px;font-weight:600;border-left:3px solid ${economiaMultas>totalJuros||totalVencido>totalJuros?'var(--success)':'var(--warning)'}">
          ${totalVencido===0?'ℹ️ Nenhuma dívida vencida no momento — o benefício de quitar é menor nesse cenário.':economiaMultas>totalJuros?'✅ As multas das vencidas provavelmente superam o custo do empréstimo — pode compensar!':'⚠️ Analise se o custo do empréstimo (juros) não supera a economia de quitar as dívidas agora.'}
        </div>
      </div>

      <!-- CENÁRIO B: INVESTIR -->
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--success)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <span style="font-size:20px">🚀</span>
          <div class="card-title" style="margin:0">Cenário B — Usar para INVESTIR na Loja</div>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">
          Se investir <strong>${Utils.moeda(valor)}</strong> em estoque com a margem bruta atual da loja:
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px">
          <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Margem bruta atual</div>
            <div style="font-size:18px;font-weight:900;color:var(--primary)">${margemBruta.toFixed(1)}%</div>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Retorno estimado</div>
            <div style="font-size:18px;font-weight:900;color:var(--success)">+${Utils.moeda(retornoEstoque)}</div>
          </div>
          <div style="padding:10px;background:rgba(239,68,68,.08);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Custo dos juros</div>
            <div style="font-size:18px;font-weight:900;color:var(--danger)">−${Utils.moeda(totalJuros)}</div>
          </div>
          <div style="padding:10px;background:${lucroEmpLiquido>=0?'rgba(34,197,94,.08)':'rgba(239,68,68,.08)'};border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:700">Lucro líquido estimado</div>
            <div style="font-size:18px;font-weight:900;color:${lucroEmpLiquido>=0?'var(--success)':'var(--danger)'}">
              ${lucroEmpLiquido>=0?'+':''}${Utils.moeda(lucroEmpLiquido)}
            </div>
          </div>
        </div>
        <div style="padding:10px 14px;background:${totalVencido>0?'rgba(239,68,68,.1)':lucroEmpLiquido>=0?'rgba(34,197,94,.1)':'rgba(234,179,8,.1)'};border-radius:var(--radius-sm);font-size:13px;font-weight:600;border-left:3px solid ${totalVencido>0?'var(--danger)':lucroEmpLiquido>=0?'var(--success)':'var(--warning)'}">
          ${totalVencido>0
            ?'🔴 Você tem dívidas vencidas. Investir antes de regularizar o que está em atraso é muito arriscado — priorize quitar as vencidas primeiro.'
            :lucroEmpLiquido>=0
              ?'✅ O retorno estimado supera o custo do empréstimo. Se o estoque girar bem, pode ser um bom investimento.'
              :'⚠️ Com a margem atual, o custo do empréstimo supera o retorno estimado. Invista somente se tiver certeza de giro rápido.'}
        </div>
      </div>

      <!-- VIABILIDADE DE CAIXA -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:4px">💰 Consegue pagar as parcelas mensalmente?</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Baseado na média dos últimos 3 meses da loja (CMV + todas as despesas já descontados)</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${Fin._linhaAnalise('Faturamento médio (3 meses)', receitaMedia>0?Utils.moeda(receitaMedia):'sem dados', '')}
          ${Fin._linhaAnalise('CMV + despesas + retiradas (média)', receitaMedia>0?'− '+Utils.moeda(receitaMedia-lucroMedio):'—', 'danger')}
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${Fin._linhaAnalise('Lucro líquido médio', receitaMedia>0?Utils.moeda(lucroMedio):'sem dados de vendas', lucroMedio>=0?'success':'danger')}
          ${Fin._linhaAnalise('Parcela do empréstimo', '− '+Utils.moeda(pmt), 'danger')}
          <div style="height:1px;background:var(--border);margin:2px 0"></div>
          ${Fin._linhaAnalise('Sobra após pagar parcela', Utils.moeda(sobraComEmp), sobraComEmp>=0?'success':'danger', true)}
        </div>
        ${lucroMedio <= 0 && receitaMedia > 0 ? `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(239,68,68,.1);border-radius:var(--radius-sm);font-size:13px;border-left:3px solid var(--danger)">
          🔴 <strong>Atenção:</strong> a loja está operando sem lucro nos últimos meses. Tomar um empréstimo agora aumentaria as dívidas sem que o negócio consiga pagar.
        </div>` : sobraComEmp < 0 ? `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(239,68,68,.1);border-radius:var(--radius-sm);font-size:13px;border-left:3px solid var(--danger)">
          🔴 <strong>Atenção:</strong> a parcela de ${Utils.moeda(pmt)} é maior que o lucro médio da loja. Você precisaria de renda extra para pagar esse empréstimo todo mês.
        </div>` : pctLucro > 60 ? `
        <div style="margin-top:10px;padding:10px 14px;background:rgba(234,179,8,.1);border-radius:var(--radius-sm);font-size:13px;border-left:3px solid var(--warning)">
          ⚠️ A parcela consome <strong>${pctLucro.toFixed(0)}%</strong> do lucro líquido médio. Qualquer mês de venda abaixo do normal pode deixar o caixa no vermelho.
        </div>` : ''}
      </div>

      <!-- VEREDICTO FINAL -->
      ${veredicto?`
      <div style="background:${veredicto.bg};border:2px solid ${veredicto.cor};border-radius:var(--radius);padding:16px 20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:28px">${veredicto.icon}</span>
          <span style="font-size:18px;font-weight:900;color:${veredicto.cor}">${veredicto.label}</span>
        </div>
        <div style="font-size:14px;line-height:1.7">${veredicto.texto}</div>
      </div>`:''}

      <!-- REGISTRAR -->
      <div class="card" style="background:rgba(139,92,246,.05);border-color:#8b5cf6">
        <div class="card-title" style="color:#8b5cf6;margin-bottom:12px">✅ Decidiu pegar? Registre as parcelas automaticamente</div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;min-width:220px;flex:1">
            <label class="form-label">Descrição (nome do empréstimo)</label>
            <input type="text" id="empDescricao" class="form-control" placeholder="Ex: Empréstimo Banco do Brasil">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Data da 1ª parcela</label>
            <input type="date" id="empPrimeiraParcela" class="form-control">
          </div>
          <button class="btn btn-primary" onclick="Fin._registrarEmprestimo()" style="background:#8b5cf6;border-color:#8b5cf6;white-space:nowrap">
            ✅ Registrar ${parcelas} parcela(s) de ${Utils.moeda(pmt)}
          </button>
        </div>
      </div>`;
  },


  _linhaAnalise: (label, valor, cor, destaque = false) => {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:${destaque ? '10px 12px' : '7px 12px'};background:${destaque ? 'var(--bg)' : 'transparent'};border-radius:var(--radius-sm)">
      <span style="font-size:${destaque ? '14px' : '13px'};font-weight:${destaque ? '700' : '400'}">${label}</span>
      <span style="font-size:${destaque ? '18px' : '14px'};font-weight:${destaque ? '900' : '700'};color:${cor ? 'var(--' + cor + ')' : 'var(--text)'}">${valor}</span>
    </div>`;
  },

  _salvarSimEmp: () => {
    const cfg = {
      valor:    document.getElementById('empValor')?.value    || '',
      taxaMes:  document.getElementById('empTaxa')?.value     || '',
      parcelas: document.getElementById('empParcelas')?.value || 12,
      descricao:       document.getElementById('empDescricao')?.value       || '',
      primeiraParcela: document.getElementById('empPrimeiraParcela')?.value || '',
    };
    localStorage.setItem('movePe_emprestimo_sim', JSON.stringify(cfg));
  },

  _registrarEmprestimo: () => {
    Fin._salvarSimEmp();
    const cfg      = JSON.parse(localStorage.getItem('movePe_emprestimo_sim') || '{}');
    const valor    = parseFloat(cfg.valor    || 0);
    const taxaMes  = parseFloat(cfg.taxaMes  || 0);
    const n        = parseInt(cfg.parcelas   || 12);
    const descricao      = document.getElementById('empDescricao')?.value?.trim() || 'Empréstimo';
    const primeiraParcela = document.getElementById('empPrimeiraParcela')?.value;
    if (!valor || !n) { Utils.toast('Preencha o valor e número de parcelas', 'error'); return; }
    if (!primeiraParcela) { Utils.toast('Informe a data da 1ª parcela', 'error'); return; }
    if (!Utils.confirmar(`Registrar ${n} parcelas de ${Utils.moeda(Fin._calcPMT(valor, taxaMes/100, n))} em Contas → A Pagar?`)) return;

    const pmt = Fin._calcPMT(valor, taxaMes / 100, n);
    const base = new Date(primeiraParcela + 'T00:00:00');
    for (let k = 0; k < n; k++) {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + k);
      const vencStr = `${venc.getFullYear()}-${String(venc.getMonth()+1).padStart(2,'0')}-${String(venc.getDate()).padStart(2,'0')}`;
      DB.Despesas.salvar({
        descricao: `${descricao} — Parcela ${k+1}/${n}`,
        valor: parseFloat(pmt.toFixed(2)),
        vencimento: vencStr,
        categoria: 'variavel',
        origem: 'loja',
        recorrente: false,
        pago: false,
      });
    }
    Utils.toast(`${n} parcelas registradas em Contas → A Pagar!`, 'success');
    Fin.setSubContas('pagar', document.querySelector('.tab-btn-sub'));
  },

  // ---- COMPRA PARCELADA ----
  abrirFormCompraParcelada: () => {
    document.getElementById('formCompraParcelada').reset();
    document.getElementById('previewParcelasCompra').textContent = '';
    const f = document.getElementById('formCompraParcelada');
    f.primeiraParcela.value = Utils.hoje();
    Utils.abrirModal('modalCompraParcelada');
  },

  previewParcelasCompra: () => {
    const f = document.getElementById('formCompraParcelada');
    const total    = parseFloat(f.valorTotal?.value) || 0;
    const parcelas = parseInt(f.parcelas?.value) || 1;
    const prev     = document.getElementById('previewParcelasCompra');
    if (!total || !prev) return;
    const vlrParcela = total / parcelas;
    prev.textContent = `${parcelas}x de ${Utils.moeda(vlrParcela)} = ${Utils.moeda(total)}`;
  },

  salvarCompraParcelada: (e) => {
    e.preventDefault();
    const f = document.getElementById('formCompraParcelada');
    const fornecedor = f.fornecedor.value.trim();
    const descricao  = f.descricao.value.trim();
    const total      = parseFloat(f.valorTotal.value) || 0;
    const nParcelas  = parseInt(f.parcelas.value) || 1;
    const primeira   = f.primeiraParcela.value;

    if (!total || !primeira) return;

    const vlrParcela = total / nParcelas;
    for (let i = 0; i < nParcelas; i++) {
      const venc = new Date(primeira + 'T12:00:00');
      venc.setMonth(venc.getMonth() + i);
      const vencStr = venc.toISOString().split('T')[0];
      DB.Despesas.salvar({
        descricao: `${fornecedor} — ${descricao} (${i+1}/${nParcelas})`,
        valor: vlrParcela,
        vencimento: vencStr,
        categoria: 'fornecedor',
        recorrente: false,
        pago: false
      });
    }
    Utils.fecharModal('modalCompraParcelada');
    Fin._renderDespesas();
    Utils.toast(`${nParcelas} parcela(s) criadas para ${fornecedor}!`, 'success');
  },

  // ---- FLUXO DE CAIXA 30 DIAS ----
  renderFluxo30: () => {
    const cont = document.getElementById('fluxo30Conteudo');
    if (!cont) return;

    // Saldo inicial
    const inputEl = document.getElementById('inputSaldoAtual');
    const saldoSalvo = parseFloat(DB.Config.get('fluxoSaldoInicial', '')) || 0;
    if (inputEl && !inputEl.value && saldoSalvo) inputEl.value = saldoSalvo;
    const saldoInicial = parseFloat(inputEl ? inputEl.value : saldoSalvo) || 0;

    // Datas
    const hoje = Utils.hoje();
    const dataFim = new Date(hoje);
    dataFim.setDate(dataFim.getDate() + 30);
    const dataFimStr = dataFim.toISOString().split('T')[0];

    // ── Calcular projeção de vendas diária (últimos 60 dias) ──
    const d60inicio = new Date(hoje); d60inicio.setDate(d60inicio.getDate() - 60);
    const d60str = d60inicio.toISOString().split('T')[0];
    const vendasRecentes = DB.Vendas.listarPorPeriodo(d60str, hoje)
      .filter(v => v.formaPagamento !== 'crediario');
    const totalVendas60 = vendasRecentes.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    // Dias úteis nos últimos 60 dias
    let diasUteis60 = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      if (d.getDay() !== 0) diasUteis60++;
    }
    const mediaDiariaVendas = diasUteis60 > 0 ? totalVendas60 / diasUteis60 : 0;

    // ── Montar eventos para cada dia ──
    const diasMap = {}; // { 'YYYY-MM-DD': { entradas: [], saidas: [] } }
    const adicionarDia = (data) => {
      if (!diasMap[data]) diasMap[data] = { entradas: [], saidas: [] };
    };

    // Despesas a pagar (com vencimento nos próximos 30 dias)
    DB.Despesas.listar()
      .filter(d => !d.pago && d.vencimento && d.vencimento >= hoje && d.vencimento <= dataFimStr)
      .forEach(d => {
        adicionarDia(d.vencimento);
        diasMap[d.vencimento].saidas.push({ desc: d.descricao, valor: parseFloat(d.valor) || 0, tipo: 'conta' });
      });

    // Crediário a receber
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      cred.parcelas.forEach(p => {
        if (p.status !== 'pago' && p.vencimento && p.vencimento >= hoje && p.vencimento <= dataFimStr) {
          adicionarDia(p.vencimento);
          diasMap[p.vencimento].entradas.push({
            desc: `Crediário — ${cred.clienteNome || 'Cliente'} Parc.${p.numero}`,
            valor: parseFloat(p.valor) || 0, tipo: 'crediario'
          });
        }
      });
    });

    // Projeção de vendas — cada dia útil dos próximos 30 dias
    if (mediaDiariaVendas > 0) {
      for (let i = 0; i <= 30; i++) {
        const d = new Date(hoje); d.setDate(d.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        if (d.getDay() !== 0) { // não domingo
          adicionarDia(ds);
          diasMap[ds].entradas.push({ desc: 'Vendas (projeção)', valor: mediaDiariaVendas, tipo: 'venda', projecao: true });
        }
      }
    }

    // Ordenar datas
    const datas = Object.keys(diasMap).sort();

    // Calcular saldo corrente
    let saldoCorrente = saldoInicial;
    let saldoMinimo = saldoInicial;
    let dataSaldoMinimo = hoje;
    let primeiroNegativo = null;
    let totalEntradasPrev = 0, totalSaidasPrev = 0;

    const diasProcessados = datas.map(data => {
      const dia = diasMap[data];
      const entradasDia = dia.entradas.reduce((s, e) => s + e.valor, 0);
      const saidasDia   = dia.saidas.reduce((s, e) => s + e.valor, 0);
      saldoCorrente += entradasDia - saidasDia;

      // Só conta previsto (não projeção de vendas) para totais
      const entradasCertas = dia.entradas.filter(e => !e.projecao).reduce((s, e) => s + e.valor, 0);
      totalEntradasPrev += entradasCertas;
      totalSaidasPrev   += saidasDia;

      if (saldoCorrente < saldoMinimo) { saldoMinimo = saldoCorrente; dataSaldoMinimo = data; }
      if (!primeiroNegativo && saldoCorrente < 0) primeiroNegativo = { data, saldo: saldoCorrente };

      return { data, dia, entradasDia, saidasDia, saldoApos: saldoCorrente };
    });

    const saldoFinal = saldoCorrente;
    const semEventos  = datas.length === 0;
    const diasUteis30 = diasProcessados.filter(d => new Date(d.data).getDay() !== 0).length;

    // ── RENDERIZAR ──
    const fmtData = (ds) => {
      const [a, m2, d2] = ds.split('-');
      const dt = new Date(parseInt(a), parseInt(m2)-1, parseInt(d2));
      return dt.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
    };

    // Cards resumo
    const corFinal = saldoFinal >= 0 ? 'var(--success)' : 'var(--danger)';
    const emojiFinal = saldoFinal >= 0 ? '✅' : '⚠️';

    const cardResumo = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">
        <div class="stat-card">
          <div class="stat-label">Saldo inicial</div>
          <div class="stat-value">${Utils.moeda(saldoInicial)}</div>
          <div class="stat-sub">caixa + banco hoje</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Contas a receber</div>
          <div class="stat-value success">${Utils.moeda(totalEntradasPrev)}</div>
          <div class="stat-sub">crediários confirmados</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Contas a pagar</div>
          <div class="stat-value danger">${Utils.moeda(totalSaidasPrev)}</div>
          <div class="stat-sub">despesas com vencimento</div>
        </div>
        ${mediaDiariaVendas > 0 ? `
        <div class="stat-card">
          <div class="stat-label">Vendas projetadas</div>
          <div class="stat-value">${Utils.moeda(mediaDiariaVendas * diasUteis30)}</div>
          <div class="stat-sub">${Utils.moeda(mediaDiariaVendas)}/dia (média 60d)</div>
        </div>` : ''}
        <div class="stat-card stat-destaque">
          <div class="stat-label">Saldo projetado em 30d</div>
          <div class="stat-value" style="color:${corFinal}">${emojiFinal} ${Utils.moeda(saldoFinal)}</div>
          <div class="stat-sub">${saldoFinal >= 0 ? 'situação favorável' : 'atenção: saldo negativo'}</div>
        </div>
      </div>`;

    // Alerta de saldo negativo
    let alertaNegativo = '';
    if (primeiroNegativo) {
      alertaNegativo = `
        <div style="background:rgba(239,68,68,.1);border:1px solid var(--danger);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start">
          <span style="font-size:22px">🚨</span>
          <div>
            <div style="font-weight:700;color:var(--danger);margin-bottom:4px">Alerta: saldo negativo previsto</div>
            <div style="font-size:13px;color:var(--text)">Em <strong>${fmtData(primeiroNegativo.data)}</strong> o saldo pode chegar a <strong style="color:var(--danger)">${Utils.moeda(primeiroNegativo.saldo)}</strong>. Verifique se há uma conta grande vencendo ou se as vendas do período serão suficientes.</div>
          </div>
        </div>`;
    }

    // Aviso sem dados
    let avisoSemDados = '';
    if (!mediaDiariaVendas && totalEntradasPrev === 0 && totalSaidasPrev === 0) {
      avisoSemDados = `
        <div style="background:rgba(99,102,241,.08);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;font-size:13px;color:var(--text-muted)">
          💡 Cadastre suas <strong style="color:var(--text)">despesas com vencimento</strong> na aba Contas e registre crediários para que o fluxo mostre os compromissos reais.
        </div>`;
    }

    // Timeline dia a dia (agrupa dias sem eventos de contas/crediário como "dias de venda")
    const timelinesHtml = diasProcessados
      .filter(dp => dp.dia.saidas.length > 0 || dp.dia.entradas.filter(e => !e.projecao).length > 0)
      .map(dp => {
        const { data, dia, entradasDia, saidasDia, saldoApos } = dp;
        const saldoCor = saldoApos >= 0 ? 'var(--success)' : 'var(--danger)';
        const entCertas = dia.entradas.filter(e => !e.projecao);
        const temVendaProj = dia.entradas.some(e => e.projecao);

        return `
          <div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:var(--bg);border-bottom:1px solid var(--border)">
              <div style="font-weight:700;font-size:14px">${fmtData(data)}</div>
              <div style="font-size:13px;font-weight:800;color:${saldoCor}">Saldo: ${Utils.moeda(saldoApos)}</div>
            </div>
            <div style="padding:8px 14px">
              ${entCertas.map(e => `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:3px 0">
                  <span style="color:var(--success)">⬆️ ${e.desc}</span>
                  <span style="font-weight:700;color:var(--success)">+${Utils.moeda(e.valor)}</span>
                </div>`).join('')}
              ${dia.saidas.map(e => `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:3px 0">
                  <span style="color:var(--danger)">⬇️ ${e.desc}</span>
                  <span style="font-weight:700;color:var(--danger)">−${Utils.moeda(e.valor)}</span>
                </div>`).join('')}
              ${temVendaProj ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">+ ${Utils.moeda(mediaDiariaVendas)} em vendas projetadas (média)</div>` : ''}
            </div>
          </div>`;
      }).join('');

    const semTimeline = timelinesHtml === '' ? `
      <div style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px">
        Nenhuma conta com vencimento ou crediário nos próximos 30 dias.
      </div>` : '';

    cont.innerHTML = cardResumo + alertaNegativo + avisoSemDados + `
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
        Compromissos e recebimentos previstos
      </div>
      ${timelinesHtml}${semTimeline}
      ${mediaDiariaVendas > 0 ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;padding:8px;background:var(--bg);border-radius:var(--radius-sm)">📈 Vendas projetadas com base na média dos últimos 60 dias (${Utils.moeda(mediaDiariaVendas)}/dia útil). O valor real pode variar.</div>` : ''}`;
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
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ABA TRÁFEGO PAGO
  // ─────────────────────────────────────────────────────────────────────────

  // Retorna a segunda-feira da semana que contém a data informada (YYYY-MM-DD)
  _inicioSemana: (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dia = d.getDay(); // 0=Dom
    const diff = dia === 0 ? -6 : 1 - dia;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  },

  // Retorna label legível para a semana: "Semana atual", "Semana passada", "DD/MM–DD/MM"
  _labelSemana: (seg, isAtual, isAnterior) => {
    if (isAtual)    return 'Semana atual';
    if (isAnterior) return 'Semana passada';
    const d1 = new Date(seg + 'T00:00:00');
    const d2 = new Date(seg + 'T00:00:00'); d2.setDate(d2.getDate() + 6);
    return `${d1.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })} – ${d2.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}`;
  },

  renderTrafego: () => {
    const cont = document.getElementById('trafegoConteudo');
    if (!cont) return;

    const hoje = Utils.hoje();

    // Restaurar % salvo
    const pctSalvo = parseInt(DB.Config.get('trafegoPct', 5)) || 5;
    const sliderEl = document.getElementById('trafegoPct');
    const labelEl  = document.getElementById('trafegoPctLabel');
    if (sliderEl && sliderEl.value != pctSalvo) {
      sliderEl.value = pctSalvo;
      if (labelEl) labelEl.textContent = pctSalvo + '%';
    }
    const pct = sliderEl ? parseInt(sliderEl.value) : pctSalvo;

    const segAtual   = Fin._inicioSemana(hoje);
    const segAnterior = (() => { const d = new Date(segAtual + 'T00:00:00'); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; })();

    // Montar dados das últimas 8 semanas (da mais antiga à atual)
    const semanas = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(segAtual + 'T00:00:00');
      d.setDate(d.getDate() - i * 7);
      const seg = d.toISOString().split('T')[0];
      const fim = (() => { const f = new Date(seg + 'T00:00:00'); f.setDate(f.getDate()+6); return f.toISOString().split('T')[0]; })();

      const vendas  = DB.Vendas.listarPorPeriodo(seg, fim);
      const receita = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
      const cmv     = vendas.reduce((s, v) => s + (v.itens || []).reduce((sc, item) =>
        sc + (parseFloat(item.precoCusto) || 0) * (parseInt(item.quantidade) || 1), 0), 0);
      const lucroBruto = receita - cmv;
      const investido  = DB.Trafego.totalSemana(seg);
      const entradas   = DB.Trafego.listarSemana(seg);

      semanas.push({ seg, fim, receita, cmv, lucroBruto, investido, entradas,
        isAtual: seg === segAtual, isAnterior: seg === segAnterior });
    }

    // Média de receita e lucro bruto das últimas 4 semanas completas (excluindo atual)
    const passadas = semanas.filter(s => !s.isAtual && s.receita > 0).slice(-4);
    const mediaReceita     = passadas.length ? passadas.reduce((s, w) => s + w.receita, 0)     / passadas.length : 0;
    const mediaLucroBruto  = passadas.length ? passadas.reduce((s, w) => s + w.lucroBruto, 0)  / passadas.length : 0;

    const orcamento    = Math.round(mediaReceita * pct / 100 * 100) / 100;
    const semanaAtual  = semanas.find(s => s.isAtual);
    const investidoSem = semanaAtual ? semanaAtual.investido : 0;
    const disponivel   = Math.max(0, orcamento - investidoSem);
    const pctUsado     = orcamento > 0 ? Math.min(100, (investidoSem / orcamento) * 100) : 0;

    // Alerta de segurança: orçamento vs lucro bruto médio
    const pctDaLucro = mediaLucroBruto > 0 ? (orcamento / mediaLucroBruto) * 100 : 0;
    let alertaHtml = '';
    if (mediaReceita === 0) {
      alertaHtml = `<div style="padding:14px 18px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.3);border-radius:var(--radius);margin-bottom:20px;font-size:13px">
        ℹ️ <strong>Sem vendas registradas nas últimas 4 semanas.</strong> Registre algumas vendas para o sistema calcular seu orçamento de tráfego automaticamente.
      </div>`;
    } else if (pctDaLucro > 60) {
      alertaHtml = `<div style="padding:14px 18px;background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:var(--radius);margin-bottom:20px;font-size:13px">
        ⚠️ <strong>Orçamento alto em relação ao lucro bruto.</strong> Investir ${Utils.moeda(orcamento)}/semana representaria ${pctDaLucro.toFixed(0)}% do seu lucro bruto médio (${Utils.moeda(mediaLucroBruto)}). Considere começar com um % menor.
      </div>`;
    } else if (pctDaLucro > 35) {
      alertaHtml = `<div style="padding:14px 18px;background:rgba(234,179,8,.08);border:1px solid rgba(234,179,8,.5);border-radius:var(--radius);margin-bottom:20px;font-size:13px">
        💡 <strong>Orçamento moderado.</strong> ${Utils.moeda(orcamento)}/semana = ${pctDaLucro.toFixed(0)}% do lucro bruto. Viável se as campanhas trouxerem retorno. Monitore os resultados.
      </div>`;
    } else if (orcamento > 0) {
      alertaHtml = `<div style="padding:14px 18px;background:rgba(34,197,94,.08);border:1px solid var(--success);border-radius:var(--radius);margin-bottom:20px;font-size:13px">
        ✅ <strong>Orçamento seguro.</strong> ${Utils.moeda(orcamento)}/semana = ${pctDaLucro.toFixed(0)}% do lucro bruto médio. Você pode investir com tranquilidade.
      </div>`;
    }

    // Barra de progresso da semana atual
    const corBarra = pctUsado >= 100 ? 'var(--danger)' : pctUsado >= 80 ? 'var(--warning)' : 'var(--primary)';
    const statusSem = pctUsado >= 100 ? '🔴 Orçamento esgotado' : pctUsado >= 80 ? '🟡 Quase no limite' : '🟢 Dentro do orçamento';

    const cardSemanaHtml = orcamento > 0 ? `
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Esta semana</div>
            <div style="font-size:32px;font-weight:900;color:${disponivel > 0 ? 'var(--primary)' : 'var(--danger)'};line-height:1.1;margin-top:4px">
              ${Utils.moeda(disponivel)}
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">disponível para investir</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;color:var(--text-muted)">Já investido</div>
            <div style="font-size:22px;font-weight:800;color:var(--text)">${Utils.moeda(investidoSem)}</div>
            <div style="font-size:13px;color:var(--text-muted)">de ${Utils.moeda(orcamento)} orçados</div>
          </div>
        </div>
        <div style="background:var(--border);border-radius:99px;height:10px;overflow:hidden;margin-bottom:8px">
          <div style="height:100%;width:${pctUsado}%;background:${corBarra};border-radius:99px;transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted)">
          <span>${statusSem}</span>
          <span>${pctUsado.toFixed(0)}% usado</span>
        </div>
        ${semanaAtual && semanaAtual.entradas.length > 0 ? `
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">LANÇAMENTOS DESTA SEMANA</div>
          ${semanaAtual.entradas.map(e => {
            const plat = { meta:'Meta/Instagram', google:'Google Ads', tiktok:'TikTok Ads', outro:'Outro' }[e.plataforma] || e.plataforma;
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
              <div>
                <span style="font-weight:600">${plat}</span>
                ${e.obs ? `<span style="color:var(--text-muted)"> · ${e.obs}</span>` : ''}
                <div style="font-size:11px;color:var(--text-muted)">${Utils.data(e.data)}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span style="font-weight:800;color:var(--danger)">${Utils.moeda(e.valor)}</span>
                <button class="btn btn-danger btn-sm btn-icon" onclick="Fin.excluirTrafego('${e.id}')" title="Excluir">🗑</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>` : '';

    // Cards de contexto
    const cardsContexto = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Faturamento médio semanal</div>
          <div class="stat-value">${Utils.moeda(mediaReceita)}</div>
          <div class="stat-sub">média das últimas ${passadas.length} semanas</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lucro bruto médio semanal</div>
          <div class="stat-value success">${Utils.moeda(mediaLucroBruto)}</div>
          <div class="stat-sub">receita – custo dos produtos</div>
        </div>
        <div class="stat-card stat-destaque">
          <div class="stat-label">Orçamento semanal (${pct}%)</div>
          <div class="stat-value primary">${Utils.moeda(orcamento)}</div>
          <div class="stat-sub">${pct}% do faturamento médio</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total investido (8 semanas)</div>
          <div class="stat-value">${Utils.moeda(semanas.reduce((s, w) => s + w.investido, 0))}</div>
          <div class="stat-sub">histórico de tráfego pago</div>
        </div>
      </div>`;

    // Histórico semanal
    const semanasComDados = semanas.filter(s => s.receita > 0 || s.investido > 0);
    const historicoHtml = semanasComDados.length === 0 ? '' : `
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
        Histórico — Últimas Semanas
      </div>
      <div class="card" style="padding:0">
        <div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text-muted)">
          <span>Semana</span>
          <span style="text-align:right">Faturamento</span>
          <span style="text-align:right">Lucro bruto</span>
          <span style="text-align:right">Investido</span>
          <span style="text-align:right">% do fat.</span>
        </div>
        ${[...semanasComDados].reverse().map(s => {
          const label = Fin._labelSemana(s.seg, s.isAtual, s.isAnterior);
          const pctInv = s.receita > 0 ? (s.investido / s.receita * 100).toFixed(1) : '—';
          const dentroOrcamento = s.investido <= (s.receita * pct / 100) + 0.01;
          return `<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);align-items:center;${s.isAtual ? 'background:rgba(99,102,241,.04)' : ''}">
            <div style="font-weight:${s.isAtual ? '700' : '400'};font-size:13px">${label}</div>
            <div style="text-align:right;font-size:13px">${s.receita > 0 ? Utils.moeda(s.receita) : '<span style="color:var(--text-muted)">—</span>'}</div>
            <div style="text-align:right;font-size:13px;color:var(--success)">${s.lucroBruto > 0 ? Utils.moeda(s.lucroBruto) : '<span style="color:var(--text-muted)">—</span>'}</div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:${s.investido > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${s.investido > 0 ? Utils.moeda(s.investido) : '—'}</div>
            <div style="text-align:right;font-size:13px;font-weight:700;color:${s.investido === 0 ? 'var(--text-muted)' : dentroOrcamento ? 'var(--success)' : 'var(--danger)'}">
              ${pctInv !== '—' && s.investido > 0 ? pctInv + '%' : '—'}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    cont.innerHTML = alertaHtml + cardSemanaHtml + cardsContexto + historicoHtml;
  },

  abrirFormTrafego: () => {
    document.getElementById('formTrafego').reset();
    document.getElementById('trafegoData').value = Utils.hoje();
    Utils.abrirModal('modalTrafego');
  },

  salvarTrafego: (e) => {
    e.preventDefault();
    const f = document.getElementById('formTrafego');
    const data = f.data.value;
    const semana = Fin._inicioSemana(data);
    DB.Trafego.salvar({
      data,
      semana,
      plataforma: f.plataforma.value,
      valor: parseFloat(f.valor.value) || 0,
      obs: f.obs.value.trim()
    });
    Utils.fecharModal('modalTrafego');
    Fin.renderTrafego();
    Utils.toast('Investimento registrado!', 'success');
  },

  excluirTrafego: (id) => {
    if (!Utils.confirmar('Excluir este lançamento?')) return;
    DB.Trafego.excluir(id);
    Fin.renderTrafego();
    Utils.toast('Lançamento excluído');
  },

};

document.addEventListener('DOMContentLoaded', Fin.init);
document.addEventListener('movePe-sync', () => Fin.render());
