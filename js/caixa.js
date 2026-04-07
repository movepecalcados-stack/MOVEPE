/**
 * MOVE PÉ - Caixa v2.0
 */

let _fechamentoStats = null; // dados calculados no momento de abrir o modal de fechamento

const CaixaModule = {

  init: () => {
    Utils.renderNav('caixa.html');
    Utils.initModais();
    CaixaModule.render();

    document.getElementById('btnAbrirCaixa').addEventListener('click', () => {
      document.getElementById('inputOperador').value = '';
      document.getElementById('inputSaldoInicial').value = '';
      Utils.abrirModal('modalAbrirCaixa');
      setTimeout(() => document.getElementById('inputOperador').focus(), 100);
    });

    document.getElementById('btnConfirmarAbertura').addEventListener('click', CaixaModule.abrir);
    document.getElementById('btnCancelarAbertura').addEventListener('click', () => Utils.fecharModal('modalAbrirCaixa'));
    document.getElementById('btnFecharCaixa').addEventListener('click', CaixaModule.fechar);

    document.getElementById('btnSangria').addEventListener('click', () => {
      document.getElementById('inputSangriaValor').value = '';
      document.getElementById('inputSangriaDesc').value = '';
      Utils.abrirModal('modalSangria');
    });

    document.getElementById('btnConfirmarSangria').addEventListener('click', CaixaModule.sangria);
    document.getElementById('btnCancelarSangria').addEventListener('click', () => Utils.fecharModal('modalSangria'));

    document.getElementById('btnReforco').addEventListener('click', () => {
      document.getElementById('inputReforcoValor').value = '';
      document.getElementById('inputReforcoDesc').value = '';
      Utils.abrirModal('modalReforco');
    });

    document.getElementById('btnConfirmarReforco').addEventListener('click', CaixaModule.reforco);
    document.getElementById('btnCancelarReforco').addEventListener('click', () => Utils.fecharModal('modalReforco'));
  },

  render: () => {
    const caixa = DB.Caixa.buscarAtivo();
    const statusCont = document.getElementById('caixaStatusCont');
    const acoesCont = document.getElementById('caixaAcoes');
    const historicoCont = document.getElementById('caixaHistorico');

    if (caixa) {
      const hoje = Utils.hoje();
      const vendas = DB.Vendas.listarHoje();
      const totalVendas = vendas.filter(v => v.formaPagamento !== 'crediario')
        .reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
      const totalCrediario = vendas.filter(v => v.formaPagamento === 'crediario')
        .reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

      // Soma por forma (incluindo vendas divididas)
      const somarForma = (formas) => vendas.reduce((s, v) => {
        if (v.formasPagamento && v.formasPagamento.length > 0) {
          return s + v.formasPagamento.filter(f => formas.includes(f.forma)).reduce((fs, f) => fs + (parseFloat(f.valor) || 0), 0);
        }
        return formas.includes(v.formaPagamento) ? s + (parseFloat(v.total) || 0) : s;
      }, 0);
      const totalDinheiro = somarForma(['dinheiro']);
      const totalCartao = somarForma(['cartao_credito', 'cartao_debito']);
      const totalPix = somarForma(['pix']);

      // Recebimentos de crediário hoje (pagamentos de parcelas)
      const totalRecebidoCrediario = DB.FluxoCaixa.listar()
        .filter(f => f.categoria === 'crediario' && f.data && f.data.startsWith(hoje))
        .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

      const saldoFinal = (parseFloat(caixa.saldoInicial) || 0) + totalDinheiro + totalRecebidoCrediario - (caixa.sangrias || 0) + (caixa.reforcos || 0);

      const abert = new Date(caixa.aberturaEm || Date.now());
      const abrHora = abert.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      statusCont.innerHTML = `
        <div class="caixa-status" style="border-color:var(--success)">
          <div class="caixa-status-icon">💰</div>
          <div class="caixa-status-info">
            <div class="caixa-status-label">Caixa Aberto</div>
            <div class="caixa-status-val">${caixa.operador ? 'Operador: ' + caixa.operador + ' · ' : ''}Aberto: ${abrHora}</div>
          </div>
          <span class="badge badge-success">ABERTO</span>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Saldo Inicial</div>
            <div class="stat-value">${Utils.moeda(caixa.saldoInicial)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Vendas Hoje</div>
            <div class="stat-value primary">${Utils.moeda(totalVendas)}</div>
            <div class="stat-sub">${vendas.length} venda(s)</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Dinheiro</div>
            <div class="stat-value success">${Utils.moeda(totalDinheiro)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cartão</div>
            <div class="stat-value">${Utils.moeda(totalCartao)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PIX</div>
            <div class="stat-value">${Utils.moeda(totalPix)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Vendas Crediário</div>
            <div class="stat-value warning">${Utils.moeda(totalCrediario)}</div>
            <div class="stat-sub" style="color:var(--text-muted)">a receber</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Recebido Crediário</div>
            <div class="stat-value success">${Utils.moeda(totalRecebidoCrediario)}</div>
            <div class="stat-sub" style="color:var(--text-muted)">entrou no caixa</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Sangrias</div>
            <div class="stat-value danger">- ${Utils.moeda(caixa.sangrias || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Reforços</div>
            <div class="stat-value success">+ ${Utils.moeda(caixa.reforcos || 0)}</div>
          </div>
          <div class="stat-card" style="border-color:var(--primary)">
            <div class="stat-label">Saldo em Caixa</div>
            <div class="stat-value primary">${Utils.moeda(saldoFinal)}</div>
          </div>
        </div>`;

      // Movimentações do dia
      const movDia = [];

      // Vendas de hoje
      vendas.forEach(v => {
        movDia.push({
          hora: v.criadoEm,
          tipo: 'venda',
          descricao: v.clienteNome ? `Venda — ${v.clienteNome}` : 'Venda',
          forma: Utils.labelFormaPagamento(v.formaPagamento),
          valor: parseFloat(v.total) || 0,
          entrada: v.formaPagamento !== 'crediario',
          vendaId: v.id
        });
      });

      // Recebimentos de crediário no FluxoCaixa
      DB.FluxoCaixa.listar()
        .filter(f => f.categoria === 'crediario' && f.data && f.data.startsWith(hoje))
        .forEach(f => {
          movDia.push({
            hora: f.data,
            tipo: 'crediario',
            descricao: f.descricao || 'Recebimento Crediário',
            forma: 'Crediário',
            valor: parseFloat(f.valor) || 0,
            entrada: true
          });
        });

      // Sangrias e reforços
      (caixa.movimentacoes || []).forEach(m => {
        movDia.push({
          hora: m.data,
          tipo: m.tipo,
          descricao: m.descricao || (m.tipo === 'sangria' ? 'Sangria' : 'Reforço'),
          forma: '—',
          valor: parseFloat(m.valor) || 0,
          entrada: m.tipo === 'reforco'
        });
      });

      movDia.sort((a, b) => new Date(a.hora || 0) - new Date(b.hora || 0));

      const icone = { venda: '🛒', crediario: '📋', sangria: '💸', reforco: '💰' };
      const linhasMov = movDia.length === 0
        ? `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">Nenhuma movimentação ainda hoje</td></tr>`
        : movDia.map(m => {
            const hora = m.hora ? new Date(m.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
            const cor = m.entrada ? 'var(--success)' : 'var(--danger)';
            const sinal = m.entrada ? '+' : '-';
            const btnReimprimir = m.vendaId
              ? `<button class="btn btn-outline btn-sm" onclick="CaixaModule.reimprimirVenda('${m.vendaId}')" title="Reimprimir">🖨️</button>`
              : '';
            return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 0;color:var(--text-muted);font-size:12px">${hora}</td>
                <td style="padding:8px">${icone[m.tipo] || '•'} <span style="font-size:12px">${m.descricao}</span></td>
                <td style="padding:8px;font-size:12px;color:var(--text-muted)">${m.forma}</td>
                <td style="padding:8px;text-align:right;font-weight:700;color:${cor}">${sinal} ${Utils.moeda(m.valor)}</td>
                <td style="padding:8px 0;text-align:right">${btnReimprimir}</td>
              </tr>`;
          }).join('');

      statusCont.innerHTML += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px">
          <span class="section-title">🕐 Movimentações de Hoje (${movDia.length})</span>
          <button class="btn btn-outline btn-sm" onclick="CaixaModule.imprimirDia()">🖨️ Imprimir Dia</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:60px">Hora</th>
                <th>Descrição</th>
                <th>Forma</th>
                <th style="text-align:right">Valor</th>
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody>${linhasMov}</tbody>
          </table>
        </div>`;

      acoesCont.style.display = '';
      document.getElementById('btnAbrirCaixa').style.display = 'none';
      document.getElementById('btnFecharCaixa').style.display = '';
      document.getElementById('btnSangria').style.display = '';
      document.getElementById('btnReforco').style.display = '';
    } else {
      statusCont.innerHTML = `
        <div class="caixa-status" style="border-color:var(--danger)">
          <div class="caixa-status-icon">🔒</div>
          <div class="caixa-status-info">
            <div class="caixa-status-label">Caixa Fechado</div>
            <div class="caixa-status-val">Nenhum caixa aberto</div>
          </div>
          <span class="badge badge-danger">FECHADO</span>
        </div>`;
      document.getElementById('btnAbrirCaixa').style.display = '';
      document.getElementById('btnFecharCaixa').style.display = 'none';
      document.getElementById('btnSangria').style.display = 'none';
      document.getElementById('btnReforco').style.display = 'none';
    }

    // Histórico
    const historico = DB.Caixa.listar().filter(c => c.status === 'fechado')
      .sort((a, b) => new Date(b.fechamentoEm || 0) - new Date(a.fechamentoEm || 0))
      .slice(0, 10);

    if (historico.length === 0) {
      historicoCont.innerHTML = `<div class="text-muted" style="padding:16px;text-align:center">Nenhum caixa fechado ainda</div>`;
      return;
    }

    historicoCont.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Operador</th>
              <th>Vendas</th>
              <th>Saldo Esperado</th>
              <th>Saldo Contado</th>
              <th>Diferença</th>
              <th style="width:40px"></th>
            </tr>
          </thead>
          <tbody>
            ${historico.map(c => {
              const dif = c.diferenca;
              const difCor = Math.abs(dif) < 0.01 ? 'var(--success)' : 'var(--danger)';
              const difHtml = dif !== null && dif !== undefined
                ? `<span style="color:${difCor};font-weight:700">${dif >= 0 ? '+' : ''}${Utils.moeda(dif)}</span>`
                : '<span class="text-muted">—</span>';
              return `
              <tr>
                <td>${Utils.data(c.aberturaEm)}</td>
                <td>${c.operador || '-'}</td>
                <td class="text-primary fw-bold">${Utils.moeda(c.totalVendas || 0)}</td>
                <td>${c.saldoEsperado !== undefined ? Utils.moeda(c.saldoEsperado) : '<span class="text-muted">—</span>'}</td>
                <td>${c.saldoContado !== null && c.saldoContado !== undefined ? Utils.moeda(c.saldoContado) : '<span class="text-muted">—</span>'}</td>
                <td>${difHtml}</td>
                <td><button class="btn btn-outline btn-sm" onclick="CaixaModule.imprimirFechamentoHistorico('${c.id}')" title="Reimprimir fechamento">🖨️</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  abrir: () => {
    const operador = document.getElementById('inputOperador').value.trim();
    const saldoInicial = parseFloat(document.getElementById('inputSaldoInicial').value) || 0;

    if (!operador) { Utils.toast('Nome do operador é obrigatório!', 'error'); return; }

    if (DB.Caixa.buscarAtivo()) { Utils.toast('Já existe um caixa aberto!', 'warning'); return; }

    DB.Caixa.salvar({
      operador,
      saldoInicial,
      aberturaEm: new Date().toISOString(),
      status: 'aberto',
      sangrias: 0,
      reforcos: 0,
      movimentacoes: []
    });

    Utils.fecharModal('modalAbrirCaixa');
    CaixaModule.render();
    Utils.toast(`Caixa aberto! Operador: ${operador}`, 'success');
  },

  fechar: () => {
    CaixaModule.abrirFechamento();
  },

  sangria: () => {
    const caixa = DB.Caixa.buscarAtivo();
    if (!caixa) { Utils.toast('Caixa fechado', 'error'); return; }

    const valor = parseFloat(document.getElementById('inputSangriaValor').value) || 0;
    const desc = document.getElementById('inputSangriaDesc').value.trim() || 'Sangria';

    if (valor <= 0) { Utils.toast('Informe um valor válido', 'error'); return; }

    caixa.sangrias = (caixa.sangrias || 0) + valor;
    caixa.movimentacoes = caixa.movimentacoes || [];
    caixa.movimentacoes.push({ tipo: 'sangria', valor, descricao: desc, data: new Date().toISOString() });
    DB.Caixa.salvar(caixa);

    DB.FluxoCaixa.salvar({ tipo: 'saida', descricao: desc, valor, categoria: 'sangria' });

    Utils.fecharModal('modalSangria');
    CaixaModule.render();
    Utils.toast(`Sangria de ${Utils.moeda(valor)} registrada`);
  },

  reimprimirVenda: (vendaId) => {
    const venda = DB.Vendas.buscar(vendaId);
    if (!venda) { Utils.toast('Venda não encontrada', 'error'); return; }
    Utils.imprimirComprovante(Utils.gerarComprovante(venda));
  },

  imprimirDia: () => {
    const caixa = DB.Caixa.buscarAtivo();
    if (!caixa) return;
    const hoje = Utils.hoje();
    const vendas = DB.Vendas.listarHoje();

    const somarForma = (formas) => vendas.reduce((s, v) => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        return s + v.formasPagamento.filter(f => formas.includes(f.forma)).reduce((fs, f) => fs + (parseFloat(f.valor) || 0), 0);
      }
      return formas.includes(v.formaPagamento) ? s + (parseFloat(v.total) || 0) : s;
    }, 0);
    const totalDinheiro = somarForma(['dinheiro']);
    const totalCartao = somarForma(['cartao_credito', 'cartao_debito']);
    const totalPix = somarForma(['pix']);
    const totalCrediario = somarForma(['crediario']);
    const totalVendas = totalDinheiro + totalCartao + totalPix;
    const totalRecebCrediario = DB.FluxoCaixa.listar()
      .filter(f => f.categoria === 'crediario' && f.data && f.data.startsWith(hoje))
      .reduce((s,f) => s+(parseFloat(f.valor)||0), 0);
    const saldoFinal = (parseFloat(caixa.saldoInicial)||0) + totalDinheiro + totalRecebCrediario - (caixa.sangrias||0) + (caixa.reforcos||0);

    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

    const linhasVendas = vendas.map(v => {
      const hora = new Date(v.criadoEm||0).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const nome = (v.clienteNome||'—').substring(0,18).padEnd(18);
      const forma = Utils.labelFormaPagamento(v.formaPagamento).substring(0,10).padEnd(10);
      return `  ${hora}  ${nome}  ${forma}  ${Utils.moeda(v.total).padStart(9)}`;
    }).join('\n');

    const texto = `
${linhaH}
         MOVE PÉ CALÇADOS
      FECHAMENTO DO DIA — ${hoje.split('-').reverse().join('/')}
${linhaH}
Operador: ${caixa.operador || '—'}
Impresso: ${dataStr}
${linhaL}
Saldo inicial:    ${Utils.moeda(caixa.saldoInicial).padStart(16)}
${linhaL}
VENDAS (${vendas.length}):
${linhasVendas || '  Nenhuma venda hoje'}
${linhaL}
Dinheiro:         ${Utils.moeda(totalDinheiro).padStart(16)}
Cartão:           ${Utils.moeda(totalCartao).padStart(16)}
PIX:              ${Utils.moeda(totalPix).padStart(16)}
Crediário (vendas):${Utils.moeda(totalCrediario).padStart(14)}
Receb. crediário: ${Utils.moeda(totalRecebCrediario).padStart(16)}
${linhaL}
Total entradas:   ${Utils.moeda(totalVendas + totalRecebCrediario).padStart(16)}
Sangrias:       - ${Utils.moeda(caixa.sangrias||0).padStart(16)}
Reforços:       + ${Utils.moeda(caixa.reforcos||0).padStart(16)}
${linhaL}
SALDO EM CAIXA:   ${Utils.moeda(saldoFinal).padStart(16)}
${linhaH}
`.trim();

    Utils.imprimirComprovante(texto);
  },

  reforco: () => {
    const caixa = DB.Caixa.buscarAtivo();
    if (!caixa) { Utils.toast('Caixa fechado', 'error'); return; }

    const valor = parseFloat(document.getElementById('inputReforcoValor').value) || 0;
    const desc = document.getElementById('inputReforcoDesc').value.trim() || 'Reforço';

    if (valor <= 0) { Utils.toast('Informe um valor válido', 'error'); return; }

    caixa.reforcos = (caixa.reforcos || 0) + valor;
    caixa.movimentacoes = caixa.movimentacoes || [];
    caixa.movimentacoes.push({ tipo: 'reforco', valor, descricao: desc, data: new Date().toISOString() });
    DB.Caixa.salvar(caixa);

    DB.FluxoCaixa.salvar({ tipo: 'entrada', descricao: desc, valor, categoria: 'reforco' });

    Utils.fecharModal('modalReforco');
    CaixaModule.render();
    Utils.toast(`Reforço de ${Utils.moeda(valor)} registrado`);
  },

  // ---- FECHAMENTO DE CAIXA ----

  abrirFechamento: () => {
    const caixa = DB.Caixa.buscarAtivo();
    if (!caixa) { Utils.toast('Nenhum caixa aberto', 'warning'); return; }

    const hoje = Utils.hoje();
    const vendas = DB.Vendas.listarHoje();

    const somarForma = (formas) => vendas.reduce((s, v) => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        return s + v.formasPagamento.filter(f => formas.includes(f.forma)).reduce((fs, f) => fs + (parseFloat(f.valor) || 0), 0);
      }
      return formas.includes(v.formaPagamento) ? s + (parseFloat(v.total) || 0) : s;
    }, 0);

    const totalDinheiro  = somarForma(['dinheiro']);
    const totalDebito    = somarForma(['cartao_debito']);
    const totalCredito   = somarForma(['cartao_credito']);
    const totalPix       = somarForma(['pix']);
    const totalCrediario = somarForma(['crediario']);
    const totalRecebCrediario = DB.FluxoCaixa.listar()
      .filter(f => f.categoria === 'crediario' && f.data && f.data.startsWith(hoje))
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);

    const totalVendas   = totalDinheiro + totalDebito + totalCredito + totalPix;
    const saldoEsperado = (parseFloat(caixa.saldoInicial) || 0)
      + totalDinheiro + totalRecebCrediario
      - (caixa.sangrias || 0) + (caixa.reforcos || 0);

    _fechamentoStats = {
      totalDinheiro, totalDebito, totalCredito, totalPix,
      totalCrediario, totalRecebCrediario, totalVendas, saldoEsperado,
      numVendas: vendas.length,
      sangrias: caixa.sangrias || 0,
      reforcos: caixa.reforcos || 0,
      saldoInicial: parseFloat(caixa.saldoInicial) || 0,
      operador: caixa.operador || '',
      aberturaEm: caixa.aberturaEm
    };

    const s = _fechamentoStats;
    const linhaItem = (label, valor, cor = '') =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px">
        <span style="color:var(--text-muted)">${label}</span>
        <span style="font-weight:600;${cor ? 'color:' + cor : ''}">${Utils.moeda(valor)}</span>
      </div>`;

    document.getElementById('fechamentoResumo').innerHTML = `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:4px">
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:10px;letter-spacing:.5px">
          RESUMO DO DIA — ${vendas.length} venda(s)
        </div>
        ${linhaItem('Saldo inicial', s.saldoInicial)}
        ${linhaItem('💵 Dinheiro (vendas)', s.totalDinheiro, 'var(--success)')}
        ${linhaItem('💳 Cartão Débito', s.totalDebito)}
        ${linhaItem('💳 Cartão Crédito', s.totalCredito)}
        ${linhaItem('⚡ PIX', s.totalPix)}
        ${s.totalCrediario > 0 ? linhaItem('📋 Crediário (vendas)', s.totalCrediario, 'var(--warning)') : ''}
        ${s.totalRecebCrediario > 0 ? linhaItem('📋 Recebido Crediário', s.totalRecebCrediario, 'var(--success)') : ''}
        ${s.sangrias > 0 ? linhaItem('💸 Sangrias', -s.sangrias, 'var(--danger)') : ''}
        ${s.reforcos > 0 ? linhaItem('💰 Reforços', s.reforcos, 'var(--success)') : ''}
        <div style="display:flex;justify-content:space-between;padding:10px 0 4px;margin-top:4px;border-top:2px solid var(--border)">
          <span style="font-weight:700;font-size:15px">Saldo esperado em caixa</span>
          <span style="font-weight:800;font-size:18px;color:var(--primary)">${Utils.moeda(s.saldoEsperado)}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
          (Saldo inicial + dinheiro + crediário recebido − sangrias + reforços)
        </div>
      </div>`;

    document.getElementById('inputSaldoContado').value = '';
    document.getElementById('fechamentoDiferenca').style.display = 'none';
    Utils.abrirModal('modalFechamento');
  },

  atualizarDiferenca: () => {
    if (!_fechamentoStats) return;
    const val = document.getElementById('inputSaldoContado').value;
    const el  = document.getElementById('fechamentoDiferenca');
    if (!val) { el.style.display = 'none'; return; }
    const contado  = parseFloat(val) || 0;
    const diferenca = contado - _fechamentoStats.saldoEsperado;
    const ok = Math.abs(diferenca) < 0.01;
    el.style.display = '';
    el.style.background = ok ? 'rgba(34,197,94,.12)' : diferenca > 0 ? 'rgba(59,130,246,.12)' : 'rgba(239,68,68,.12)';
    el.style.color = ok ? 'var(--success)' : diferenca > 0 ? 'var(--primary)' : 'var(--danger)';
    el.textContent = ok
      ? '✅ Caixa confere!'
      : diferenca > 0
        ? `⬆️ Sobra ${Utils.moeda(diferenca)} (a mais que o esperado)`
        : `⬇️ Falta ${Utils.moeda(-diferenca)} (a menos que o esperado)`;
  },

  imprimirFechamentoAtual: () => {
    if (!_fechamentoStats) return;
    const caixa = DB.Caixa.buscarAtivo();
    const contadoStr = document.getElementById('inputSaldoContado')?.value || '';
    const saldoContado = contadoStr ? parseFloat(contadoStr) : null;
    CaixaModule._gerarImpressaoFechamento(_fechamentoStats, caixa, saldoContado);
  },

  confirmarFechamento: () => {
    const caixa = DB.Caixa.buscarAtivo();
    if (!caixa || !_fechamentoStats) return;

    const contadoStr = document.getElementById('inputSaldoContado').value;
    const saldoContado = contadoStr ? (parseFloat(contadoStr) || null) : null;
    const diferenca = saldoContado !== null ? saldoContado - _fechamentoStats.saldoEsperado : null;

    const s = _fechamentoStats;
    caixa.status             = 'fechado';
    caixa.fechamentoEm       = new Date().toISOString();
    caixa.totalVendas        = s.totalVendas;
    caixa.totalDinheiro      = s.totalDinheiro;
    caixa.totalCartaoDebito  = s.totalDebito;
    caixa.totalCartaoCredito = s.totalCredito;
    caixa.totalPix           = s.totalPix;
    caixa.totalCrediario     = s.totalCrediario;
    caixa.totalRecebCrediario = s.totalRecebCrediario;
    caixa.saldoEsperado      = s.saldoEsperado;
    caixa.saldoContado       = saldoContado;
    caixa.diferenca          = diferenca;
    caixa.numVendas          = s.numVendas;
    DB.Caixa.salvar(caixa);

    CaixaModule._gerarImpressaoFechamento(s, caixa, saldoContado);

    Utils.fecharModal('modalFechamento');
    CaixaModule.render();
    Utils.toast('Caixa fechado com sucesso!', 'success');
    _fechamentoStats = null;
  },

  imprimirFechamentoHistorico: (caixaId) => {
    const caixa = DB.Caixa.buscar(caixaId);
    if (!caixa) { Utils.toast('Caixa não encontrado', 'error'); return; }
    // Monta stats a partir dos dados salvos
    const s = {
      totalDinheiro:       caixa.totalDinheiro || 0,
      totalDebito:         caixa.totalCartaoDebito || 0,
      totalCredito:        caixa.totalCartaoCredito || 0,
      totalPix:            caixa.totalPix || 0,
      totalCrediario:      caixa.totalCrediario || 0,
      totalRecebCrediario: caixa.totalRecebCrediario || 0,
      totalVendas:         caixa.totalVendas || 0,
      saldoEsperado:       caixa.saldoEsperado || 0,
      saldoInicial:        parseFloat(caixa.saldoInicial) || 0,
      sangrias:            caixa.sangrias || 0,
      reforcos:            caixa.reforcos || 0,
      numVendas:           caixa.numVendas || 0,
      operador:            caixa.operador || ''
    };
    CaixaModule._gerarImpressaoFechamento(s, caixa, caixa.saldoContado);
  },

  _gerarImpressaoFechamento: (s, caixa, saldoContado) => {
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataAbert = caixa ? Utils.data(caixa.aberturaEm) : Utils.hoje();

    const pad = (label, valor) => {
      const l = label.substring(0, 22).padEnd(22);
      return `${l} ${Utils.moeda(valor).padStart(16)}`;
    };

    const diferenca = saldoContado !== null && saldoContado !== undefined
      ? saldoContado - s.saldoEsperado : null;

    const linhaContado = saldoContado !== null && saldoContado !== undefined
      ? `\n${pad('Saldo contado:', saldoContado)}\n${pad('Diferença:', diferenca)}`
      : '';

    const texto = `
${linhaH}
         MOVE PÉ CALÇADOS
    FECHAMENTO DE CAIXA
${linhaH}
Operador: ${s.operador || (caixa ? caixa.operador : '') || '—'}
Data: ${dataAbert}
Impresso: ${dataStr}
${linhaL}
${pad('Saldo inicial:', s.saldoInicial)}
${linhaL}
ENTRADAS:
${pad('  💵 Dinheiro:', s.totalDinheiro)}
${pad('  💳 Cartão Débito:', s.totalDebito)}
${pad('  💳 Cartão Crédito:', s.totalCredito)}
${pad('  ⚡ PIX:', s.totalPix)}
${s.totalCrediario > 0 ? pad('  📋 Crediário (vendas):', s.totalCrediario) : ''}
${s.totalRecebCrediario > 0 ? pad('  📋 Receb. Crediário:', s.totalRecebCrediario) : ''}
${linhaL}
${pad('Total vendas (caixa):', s.totalVendas)}
${s.sangrias > 0 ? pad('(-) Sangrias:', s.sangrias) : ''}
${s.reforcos > 0 ? pad('(+) Reforços:', s.reforcos) : ''}
${linhaL}
${pad('SALDO ESPERADO:', s.saldoEsperado)}${linhaContado}
${linhaH}
  Nº de vendas: ${s.numVendas}
${linhaH}
`.trim();

    Utils.imprimirComprovante(texto);
  }
};

document.addEventListener('DOMContentLoaded', CaixaModule.init);
document.addEventListener('movePe-sync', () => CaixaModule.render());
