/**
 * MOVE PÉ - Crediário v2.0
 */

let _filtroStatus = 'todos';
let _buscaCred = '';
let _mensalExpandido = false;
let _pagamentoAtual = null; // { credId, parcelaIdx, valorOriginal, jurosCalc }
let _pagarTudoAtual = null; // { credId, parcelas: [{idx, numero, vencimento, valor, juros, status}], totalSemJuros, totalJuros }
let _renegociacaoAtual = null; // { credId }

const CARENCIA_DIAS = 5;
const JUROS_DIA = 0.004; // 0,4% ao dia

const calcularJuros = (vencimento, valor) => {
  if (!vencimento) return { diasAtraso: 0, diasComJuros: 0, juros: 0 };
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const venc = new Date(vencimento + 'T00:00:00');
  const diffMs = hoje - venc;
  if (diffMs <= 0) return { diasAtraso: 0, diasComJuros: 0, juros: 0 };
  const diasAtraso = Math.floor(diffMs / 86400000);
  const diasComJuros = Math.max(0, diasAtraso - CARENCIA_DIAS);
  const juros = diasComJuros > 0 ? parseFloat(valor) * JUROS_DIA * diasComJuros : 0;
  return { diasAtraso, diasComJuros, juros: Math.round(juros * 100) / 100 };
};

const CrediarioModule = {

  init: () => {
    Utils.renderNav('crediario.html');
    Utils.initModais();
    CrediarioModule.renderStats();
    CrediarioModule.renderMensal();
    CrediarioModule.renderLista();

    document.getElementById('buscaInput').addEventListener('input', (e) => {
      _buscaCred = e.target.value;
      CrediarioModule.renderLista();
    });

    document.getElementById('filtroStatus').addEventListener('change', (e) => {
      _filtroStatus = e.target.value;
      CrediarioModule.renderLista();
    });
  },

  toggleMensal: () => {
    _mensalExpandido = !_mensalExpandido;
    document.getElementById('btnToggleMensal').textContent = _mensalExpandido ? 'Recolher' : 'Expandir';
    CrediarioModule.renderMensal();
  },

  renderMensal: () => {
    const credList = DB.Crediario.listar();
    const meses = {};
    const hoje = new Date();

    credList.forEach(cred => {
      cred.parcelas.forEach(p => {
        if (!p.vencimento || p.status === 'pago') return;
        const [ano, mes] = p.vencimento.split('-');
        const chave = `${ano}-${mes}`;
        if (!meses[chave]) meses[chave] = { total: 0, parcelas: [] };
        meses[chave].total += parseFloat(p.valor) || 0;
        if (_mensalExpandido) {
          meses[chave].parcelas.push({ clienteNome: cred.clienteNome, valor: p.valor, vencimento: p.vencimento, status: Utils.statusParcela(p.vencimento, p.status) });
        }
      });
    });

    const chaves = Object.keys(meses).sort();
    if (chaves.length === 0) {
      document.getElementById('previsaoMensal').innerHTML = '<span class="text-muted fs-sm">Nenhuma parcela pendente</span>';
      return;
    }

    const nomeMes = (chave) => {
      const [ano, mes] = chave.split('-');
      const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      return `${nomes[parseInt(mes)-1]}/${ano}`;
    };

    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;

    document.getElementById('previsaoMensal').innerHTML = chaves.map(chave => {
      const m = meses[chave];
      const isAtual = chave === mesAtual;
      const isAtrasado = chave < mesAtual;
      const cor = isAtrasado ? 'var(--danger)' : isAtual ? 'var(--warning)' : 'var(--success)';
      const label = isAtrasado ? '🔴 Atrasado' : isAtual ? '🟡 Mês atual' : '🟢 Futuro';

      const detalhes = _mensalExpandido && m.parcelas.length > 0 ? `
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          ${m.parcelas.sort((a,b) => a.clienteNome.localeCompare(b.clienteNome)).map(p => `
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--text-muted)">
              <span>${p.clienteNome}</span>
              <span style="color:${p.status==='atrasado'?'var(--danger)':'var(--text)'}">${Utils.moeda(p.valor)}</span>
            </div>`).join('')}
        </div>` : '';

      return `
        <div style="display:flex;flex-direction:column;padding:10px 12px;margin-bottom:6px;border-radius:8px;background:var(--card-bg);border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:600;color:var(--text)">${nomeMes(chave)}</span>
              <span style="font-size:11px;margin-left:8px;color:${cor}">${label}</span>
            </div>
            <div style="font-weight:700;font-size:15px;color:${cor}">${Utils.moeda(m.total)}</div>
          </div>
          ${detalhes}
        </div>`;
    }).join('');
  },

  renderStats: () => {
    const credList = DB.Crediario.listar();
    const hoje = Utils.hoje();
    let totalPendente = 0, totalAtrasado = 0, qtdInadimplentes = 0, totalPago = 0;

    credList.forEach(cred => {
      cred.parcelas.forEach(p => {
        const s = Utils.statusParcela(p.vencimento, p.status);
        if (s === 'pendente' || s === 'atrasado') totalPendente += parseFloat(p.valor) || 0;
        if (s === 'atrasado') { totalAtrasado += parseFloat(p.valor) || 0; }
        if (s === 'pago') totalPago += parseFloat(p.valor) || 0;
      });
    });

    const inad = DB.Crediario.inadimplentes();
    const clientesUnicos = [...new Set(inad.map(i => i.clienteNome))];

    document.getElementById('statPendente').textContent = Utils.moeda(totalPendente);
    document.getElementById('statAtrasado').textContent = Utils.moeda(totalAtrasado);
    document.getElementById('statInadimplentes').textContent = clientesUnicos.length;
    document.getElementById('statPago').textContent = Utils.moeda(totalPago);
  },

  renderLista: () => {
    let lista = DB.Crediario.listar();
    const hoje = Utils.hoje();

    if (_buscaCred.trim()) {
      const t = _buscaCred.toLowerCase();
      lista = lista.filter(c => (c.clienteNome || '').toLowerCase().includes(t));
    }

    if (_filtroStatus !== 'todos') {
      lista = lista.filter(cred => {
        if (_filtroStatus === 'atrasado') {
          return cred.parcelas.some(p => Utils.statusParcela(p.vencimento, p.status) === 'atrasado');
        }
        if (_filtroStatus === 'pendente') {
          return cred.parcelas.some(p => p.status !== 'pago');
        }
        if (_filtroStatus === 'quitado') {
          return cred.parcelas.every(p => p.status === 'pago');
        }
        return true;
      });
    }

    const cont = document.getElementById('crediarioLista');
    if (lista.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💳</div>
        <div class="empty-title">Nenhum crediário encontrado</div>
        <div class="empty-sub">As vendas no crediário aparecerão aqui</div>
      </div>`;
      return;
    }

    // Ordenar: atrasados primeiro
    lista.sort((a, b) => {
      const aAt = a.parcelas.some(p => Utils.statusParcela(p.vencimento, p.status) === 'atrasado');
      const bAt = b.parcelas.some(p => Utils.statusParcela(p.vencimento, p.status) === 'atrasado');
      if (aAt && !bAt) return -1;
      if (!aAt && bAt) return 1;
      return new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0);
    });

    cont.innerHTML = lista.map(cred => {
      const pendentes = cred.parcelas.filter(p => p.status !== 'pago');
      const quitado = pendentes.length === 0;
      const temAtrasado = cred.parcelas.some(p => Utils.statusParcela(p.vencimento, p.status) === 'atrasado');

      // Total em aberto (com juros nas atrasadas)
      let totalEmAberto = 0;
      let totalJuros = 0;
      pendentes.forEach(p => {
        const valor = parseFloat(p.valor) || 0;
        const st = Utils.statusParcela(p.vencimento, p.status);
        if (st === 'atrasado') {
          const { juros } = calcularJuros(p.vencimento, valor);
          totalEmAberto += valor + juros;
          totalJuros += juros;
        } else {
          totalEmAberto += valor;
        }
      });

      const parcelasHtml = cred.parcelas.map((p, idx) => {
        const st = Utils.statusParcela(p.vencimento, p.status);
        const stLabel = { pago: '✅ Pago', atrasado: '🔴 Atrasado', pendente: '⏳ Pendente' }[st] || st;
        const { diasComJuros, juros } = calcularJuros(p.vencimento, p.valor);
        const valorComJuros = (parseFloat(p.valor) || 0) + juros;
        const jurosHtml = st === 'atrasado' && diasComJuros > 0
          ? `<span style="font-size:11px;color:var(--danger)" title="${diasComJuros} dias com juros"> +${Utils.moeda(juros)} juros</span>`
          : '';
        return `
          <div class="parcela-item">
            <span class="parcela-num">${p.numero || (idx+1)}/${cred.parcelas.length}</span>
            <span class="parcela-venc">${Utils.data(p.vencimento)}</span>
            <span class="parcela-val">${st === 'atrasado' && diasComJuros > 0 ? Utils.moeda(valorComJuros) : Utils.moeda(p.valor)}${jurosHtml}</span>
            <span class="badge ${st === 'pago' ? 'badge-success' : st === 'atrasado' ? 'badge-danger' : 'badge-warning'}">${stLabel}</span>
            ${st !== 'pago' ? `
              <button class="btn btn-success btn-sm" onclick="CrediarioModule.pagarParcela('${cred.id}', ${idx})">Pagar</button>
              <button class="btn btn-outline btn-sm" onclick="CrediarioModule.imprimirParcela('${cred.id}', ${idx})" title="Imprimir comprovante">🖨️</button>
            ` : `
              <button class="btn btn-outline btn-sm" onclick="CrediarioModule.imprimirParcela('${cred.id}', ${idx})" title="Reimprimir comprovante">🖨️</button>
            `}
          </div>`;
      }).join('');

      return `
        <div class="crediario-card ${temAtrasado ? 'low-stock' : ''}">
          <div class="crediario-header">
            <div>
              <div class="crediario-cliente">${cred.clienteNome || 'Cliente'}</div>
              <div class="crediario-info">
                ${Utils.data(cred.criadoEm)} · ${cred.parcelas.length} parcela(s)
              </div>
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <div style="font-size:11px;color:var(--text-muted)">Total da compra: ${Utils.moeda(cred.total)}</div>
              ${!quitado ? `
                <div style="font-size:16px;font-weight:800;color:${temAtrasado ? 'var(--danger)' : 'var(--text)'}">
                  Em aberto: ${Utils.moeda(totalEmAberto)}
                </div>
                ${totalJuros > 0 ? `<div style="font-size:11px;color:var(--danger)">⚠️ inclui ${Utils.moeda(totalJuros)} de juros</div>` : ''}
              ` : `<div style="font-size:15px;font-weight:700;color:var(--success)">✅ Quitado</div>`}
              <div style="display:flex;gap:6px;align-items:center">
                <span class="badge ${quitado ? 'badge-success' : temAtrasado ? 'badge-danger' : 'badge-warning'}">
                  ${quitado ? 'Quitado' : temAtrasado ? 'Com atraso' : pendentes.length + ' pendente(s)'}
                </span>
                <button class="btn btn-outline btn-sm" onclick="CrediarioModule.verDetalhes('${cred.id}')">🧾 Detalhes</button>
                <button class="btn btn-outline btn-sm" onclick="CrediarioModule.imprimirContrato('${cred.id}')" title="Imprimir contrato de crediário">📄 Contrato</button>
                ${!quitado && pendentes.length > 1 ? `<button class="btn btn-success btn-sm" onclick="CrediarioModule.pagarTudo('${cred.id}')" title="Pagar toda a dívida de uma vez">💰 Pagar Tudo</button>` : ''}
                ${!quitado ? `<button class="btn btn-outline btn-sm" onclick="CrediarioModule.renegociar('${cred.id}')" title="Renegociar dívida">🔄 Reneg.</button>` : ''}
                ${!quitado ? `<button class="btn btn-outline btn-sm" onclick="CrediarioModule.enviarWhatsApp('${cred.id}')" title="Enviar cobrança por WhatsApp" style="color:#25D366;border-color:#25D366">📱 WhatsApp</button>` : ''}
              </div>
            </div>
          </div>
          <div class="parcelas-lista">${parcelasHtml}</div>
        </div>`;
    }).join('');
  },

  pagarParcela: (credId, parcelaIdx) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;
    const parcela = cred.parcelas[parcelaIdx];
    if (!parcela) return;

    const st = Utils.statusParcela(parcela.vencimento, parcela.status);
    if (st === 'pago') { Utils.toast('Parcela já está paga', 'warning'); return; }

    const { diasAtraso, diasComJuros, juros } = calcularJuros(parcela.vencimento, parcela.valor);
    const valorOriginal = parseFloat(parcela.valor) || 0;

    _pagamentoAtual = { credId, parcelaIdx, valorOriginal, jurosCalc: juros };

    document.getElementById('pagCliente').textContent = cred.clienteNome || 'Cliente';
    document.getElementById('pagParcela').textContent = `${parcela.numero || (parcelaIdx+1)}/${cred.parcelas.length}`;
    document.getElementById('pagVencimento').textContent = Utils.data(parcela.vencimento);
    document.getElementById('pagValorOriginal').textContent = Utils.moeda(valorOriginal);

    const jurosBloco = document.getElementById('pagJurosBloco');
    if (diasComJuros > 0) {
      jurosBloco.style.display = '';
      document.getElementById('pagDiasAtraso').textContent = `${diasAtraso} dias (${diasComJuros} com juros)`;
      document.getElementById('pagJurosCalc').textContent = Utils.moeda(juros);
      document.getElementById('pagJurosInput').value = juros.toFixed(2);
    } else {
      jurosBloco.style.display = 'none';
    }

    const totalModal = valorOriginal + juros;
    document.getElementById('pagTotal').textContent = Utils.moeda(totalModal);
    document.getElementById('pagRecebido').value = totalModal.toFixed(2);
    document.getElementById('pagTrocoBloco').style.display = 'none';
    Utils.abrirModal('modalPagamento');
    setTimeout(() => document.getElementById('pagRecebido').select(), 100);
  },

  atualizarTotal: () => {
    if (!_pagamentoAtual) return;
    const juros = parseFloat(document.getElementById('pagJurosInput').value) || 0;
    const total = _pagamentoAtual.valorOriginal + juros;
    document.getElementById('pagTotal').textContent = Utils.moeda(total);
    document.getElementById('pagRecebido').value = total.toFixed(2);
    CrediarioModule.atualizarRecebido();
  },

  atualizarRecebido: () => {
    if (!_pagamentoAtual) return;
    const juros = parseFloat(document.getElementById('pagJurosInput')?.value) || 0;
    const total = _pagamentoAtual.valorOriginal + juros;
    const recebido = parseFloat(document.getElementById('pagRecebido').value) || 0;
    const bloco = document.getElementById('pagTrocoBloco');
    const label = document.getElementById('pagTrocoLabel');
    const diff = recebido - total;

    if (recebido <= 0) { bloco.style.display = 'none'; return; }
    bloco.style.display = '';

    if (diff > 0.009) {
      bloco.style.background = 'rgba(59,130,246,0.1)';
      bloco.style.border = '1px solid var(--primary)';
      label.style.color = 'var(--primary)';
      label.textContent = `Troco: ${Utils.moeda(diff)}`;
    } else if (diff < -0.009) {
      bloco.style.background = 'rgba(239,68,68,0.08)';
      bloco.style.border = '1px solid var(--danger)';
      label.style.color = 'var(--danger)';
      label.textContent = `Saldo restante na parcela: ${Utils.moeda(Math.abs(diff))}`;
    } else {
      bloco.style.background = 'rgba(34,197,94,0.1)';
      bloco.style.border = '1px solid var(--success)';
      label.style.color = 'var(--success)';
      label.textContent = 'Pagamento exato ✓';
    }
  },

  confirmarPagamento: () => {
    if (!_pagamentoAtual) return;
    const { credId, parcelaIdx, valorOriginal } = _pagamentoAtual;
    const juros = parseFloat(document.getElementById('pagJurosInput')?.value) || 0;
    const totalDevido = valorOriginal + juros;
    const recebido = parseFloat(document.getElementById('pagRecebido').value) || 0;

    if (recebido <= 0) { Utils.toast('Informe o valor recebido', 'error'); return; }

    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;
    const parcela = cred.parcelas[parcelaIdx];
    const parcelaNum = parcela.numero || (parcelaIdx + 1);
    const totalParcelas = cred.parcelas.length;

    if (recebido >= totalDevido - 0.009) {
      // Pagamento completo (ou com troco)
      DB.Crediario.pagarParcela(credId, parcelaIdx);
      DB.FluxoCaixa.salvar({
        tipo: 'entrada',
        descricao: `Crediário - ${cred.clienteNome} - Parcela ${parcelaNum}/${totalParcelas}${juros > 0 ? ' + juros' : ''}`,
        valor: totalDevido,
        categoria: 'crediario'
      });
      const troco = recebido - totalDevido;
      Utils.fecharModal('modalPagamento');
      CrediarioModule.imprimirParcela(credId, parcelaIdx);
      CrediarioModule.renderStats();
      CrediarioModule.renderMensal();
      CrediarioModule.renderLista();
      Utils.toast(troco > 0.01 ? `Parcela paga! Troco: ${Utils.moeda(troco)}` : 'Parcela paga!', 'success');
    } else {
      // Pagamento parcial — abate o valor pago, parcela fica com saldo restante
      const saldo = totalDevido - recebido;
      if (!confirm(`Pagamento parcial de ${Utils.moeda(recebido)}.\nSaldo restante: ${Utils.moeda(saldo)}\n\nConfirmar abatimento?`)) return;

      const lista = DB.Crediario.listar();
      const credObj = lista.find(c => c.id === credId);
      credObj.parcelas[parcelaIdx].valor = saldo.toFixed(2);
      DB.Crediario.salvar(credObj);

      DB.FluxoCaixa.salvar({
        tipo: 'entrada',
        descricao: `Crediário - ${cred.clienteNome} - Abatimento parcela ${parcelaNum}/${totalParcelas} (saldo: ${Utils.moeda(saldo)})`,
        valor: recebido,
        categoria: 'crediario'
      });

      Utils.fecharModal('modalPagamento');
      CrediarioModule.renderStats();
      CrediarioModule.renderMensal();
      CrediarioModule.renderLista();
      Utils.toast(`Abatimento de ${Utils.moeda(recebido)} registrado. Saldo restante: ${Utils.moeda(saldo)}`, 'success');
    }
    _pagamentoAtual = null;
  },

  pagarTudo: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    const pendentes = cred.parcelas
      .map((p, idx) => ({ idx, parcela: p }))
      .filter(({ parcela }) => parcela.status !== 'pago');

    if (pendentes.length === 0) { Utils.toast('Nenhuma parcela pendente', 'warning'); return; }

    let totalSemJuros = 0;
    let totalJuros = 0;
    const parcelas = pendentes.map(({ idx, parcela }) => {
      const valor = parseFloat(parcela.valor) || 0;
      const st = Utils.statusParcela(parcela.vencimento, parcela.status);
      const { juros } = st === 'atrasado' ? calcularJuros(parcela.vencimento, valor) : { juros: 0 };
      totalSemJuros += valor;
      totalJuros += juros;
      return { idx, numero: parcela.numero || (idx + 1), vencimento: parcela.vencimento, valor, juros, status: st };
    });

    _pagarTudoAtual = { credId, parcelas, totalSemJuros, totalJuros };

    document.getElementById('ptdCliente').textContent = cred.clienteNome || 'Cliente';
    document.getElementById('ptdQtdParcelas').textContent = `${parcelas.length} parcela(s) pendente(s)`;

    document.getElementById('ptdParcelasList').innerHTML = parcelas.map(p => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="color:var(--text-muted)">${p.numero}ª parcela · ${Utils.data(p.vencimento)}
          <span class="badge ${p.status === 'atrasado' ? 'badge-danger' : 'badge-warning'}" style="font-size:10px;margin-left:4px">${p.status === 'atrasado' ? 'Atrasada' : 'Pendente'}</span>
        </span>
        <span style="font-weight:600">
          ${Utils.moeda(p.valor)}${p.juros > 0 ? `<span style="color:var(--danger);font-size:11px;font-weight:400"> +${Utils.moeda(p.juros)} juros</span>` : ''}
        </span>
      </div>`).join('');

    document.getElementById('ptdSemJuros').textContent = Utils.moeda(totalSemJuros);

    const jurosBloco = document.getElementById('ptdJurosBloco');
    if (totalJuros > 0) {
      jurosBloco.style.display = '';
      document.getElementById('ptdJurosCalc').textContent = Utils.moeda(totalJuros);
      document.getElementById('ptdJurosInput').value = totalJuros.toFixed(2);
      document.getElementById('ptdIncluirJuros').checked = true;
    } else {
      jurosBloco.style.display = 'none';
    }

    CrediarioModule.atualizarTotalTudo();
    Utils.abrirModal('modalPagarTudo');
    setTimeout(() => document.getElementById('ptdRecebido').select(), 150);
  },

  atualizarTotalTudo: () => {
    if (!_pagarTudoAtual) return;
    const incluirJuros = document.getElementById('ptdIncluirJuros').checked;
    const juros = incluirJuros ? (parseFloat(document.getElementById('ptdJurosInput').value) || 0) : 0;
    const total = _pagarTudoAtual.totalSemJuros + juros;
    document.getElementById('ptdTotal').textContent = Utils.moeda(total);
    document.getElementById('ptdRecebido').value = total.toFixed(2);
    document.getElementById('ptdJurosInputWrap').style.display = incluirJuros ? '' : 'none';
    document.getElementById('ptdTrocoBloco').style.display = 'none';
  },

  atualizarTrocoTudo: () => {
    if (!_pagarTudoAtual) return;
    const incluirJuros = document.getElementById('ptdIncluirJuros').checked;
    const juros = incluirJuros ? (parseFloat(document.getElementById('ptdJurosInput').value) || 0) : 0;
    const total = _pagarTudoAtual.totalSemJuros + juros;
    const recebido = parseFloat(document.getElementById('ptdRecebido').value) || 0;
    const bloco = document.getElementById('ptdTrocoBloco');
    const label = document.getElementById('ptdTrocoLabel');
    const diff = recebido - total;

    if (recebido <= 0) { bloco.style.display = 'none'; return; }
    bloco.style.display = '';

    if (diff > 0.009) {
      bloco.style.background = 'rgba(59,130,246,0.1)';
      bloco.style.border = '1px solid var(--primary)';
      label.style.color = 'var(--primary)';
      label.textContent = `Troco: ${Utils.moeda(diff)}`;
    } else if (diff < -0.009) {
      bloco.style.background = 'rgba(239,68,68,0.08)';
      bloco.style.border = '1px solid var(--danger)';
      label.style.color = 'var(--danger)';
      label.textContent = `Valor insuficiente — faltam ${Utils.moeda(Math.abs(diff))}`;
    } else {
      bloco.style.background = 'rgba(34,197,94,0.1)';
      bloco.style.border = '1px solid var(--success)';
      label.style.color = 'var(--success)';
      label.textContent = 'Pagamento exato ✓';
    }
  },

  confirmarPagarTudo: () => {
    if (!_pagarTudoAtual) return;
    const { credId, parcelas, totalSemJuros } = _pagarTudoAtual;

    const incluirJuros = document.getElementById('ptdIncluirJuros').checked;
    const juros = incluirJuros ? (parseFloat(document.getElementById('ptdJurosInput').value) || 0) : 0;
    const totalDevido = totalSemJuros + juros;
    const recebido = parseFloat(document.getElementById('ptdRecebido').value) || 0;

    if (recebido <= 0) { Utils.toast('Informe o valor recebido', 'error'); return; }
    if (recebido < totalDevido - 0.009) {
      Utils.toast('Valor insuficiente para quitar todas as parcelas', 'error'); return;
    }

    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    const lista = DB.Crediario.listar();
    const credObj = lista.find(c => c.id === credId);
    const hoje = Utils.hoje();

    parcelas.forEach(({ idx }) => {
      credObj.parcelas[idx].status = 'pago';
      credObj.parcelas[idx].dataPagamento = hoje;
    });
    DB.Crediario.salvar(credObj);

    DB.FluxoCaixa.salvar({
      tipo: 'entrada',
      descricao: `Crediário - ${cred.clienteNome} - Quitação total (${parcelas.length} parcela(s))${juros > 0 ? ' + juros' : ''}`,
      valor: totalDevido,
      categoria: 'crediario'
    });

    const troco = recebido - totalDevido;
    Utils.fecharModal('modalPagarTudo');
    CrediarioModule.renderStats();
    CrediarioModule.renderMensal();
    CrediarioModule.renderLista();
    Utils.toast(troco > 0.01 ? `Dívida quitada! Troco: ${Utils.moeda(troco)}` : 'Dívida quitada com sucesso!', 'success');
    _pagarTudoAtual = null;
  },

  verDetalhes: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    // Busca itens: direto no crediário (importado) ou via venda vinculada
    const venda = cred.vendaId ? DB.Vendas.buscar(cred.vendaId) : null;
    const itens = cred.itens || (venda ? venda.itens : null);

    const totalPago = cred.parcelas.filter(p => p.status === 'pago').reduce((s,p) => s + (parseFloat(p.valor)||0), 0);
    const totalPendente = cred.parcelas.filter(p => p.status !== 'pago').reduce((s,p) => s + (parseFloat(p.valor)||0), 0);

    const produtosHtml = itens && itens.length > 0
      ? `<div class="card" style="margin-bottom:16px">
          <div class="card-title" style="margin-bottom:10px">👟 Produtos Comprados</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
                <th style="text-align:left;padding:6px 0">Produto</th>
                <th style="text-align:center;padding:6px">Tam.</th>
                <th style="text-align:center;padding:6px">Qtd.</th>
                <th style="text-align:right;padding:6px 0">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${itens.map(item => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:7px 0">${item.nome || item.produtoNome || '—'}</td>
                  <td style="text-align:center;padding:7px">${item.tamanho || '—'}</td>
                  <td style="text-align:center;padding:7px">${item.quantidade || 1}</td>
                  <td style="text-align:right;padding:7px 0">${Utils.moeda((item.precoUnitario || item.preco || 0) * (item.quantidade || 1))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : cred.observacao
        ? `<div class="card" style="margin-bottom:16px">
            <div class="card-title">📋 Observação</div>
            <p class="text-muted fs-sm" style="margin-top:6px">${cred.observacao}</p>
          </div>`
        : '';

    const parcelasHtml = cred.parcelas.map((p, idx) => {
      const st = Utils.statusParcela(p.vencimento, p.status);
      const { diasComJuros, juros } = calcularJuros(p.vencimento, p.valor);
      const cor = st === 'pago' ? 'var(--success)' : st === 'atrasado' ? 'var(--danger)' : 'var(--warning)';
      const label = { pago: '✅ Pago', atrasado: '🔴 Atrasado', pendente: '⏳ Pendente' }[st];
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 0;color:var(--text-muted)">${p.numero || (idx+1)}ª parcela</td>
        <td style="padding:7px;text-align:center">${Utils.data(p.vencimento)}</td>
        <td style="padding:7px;text-align:right">${Utils.moeda(p.valor)}${st==='atrasado'&&diasComJuros>0?`<br><span style="font-size:11px;color:var(--danger)">+${Utils.moeda(juros)} juros</span>`:''}</td>
        <td style="padding:7px 0;text-align:right"><span style="color:${cor};font-weight:600;font-size:12px">${label}</span></td>
        ${p.dataPagamento ? `<td style="padding:7px 0;text-align:right;font-size:11px;color:var(--text-muted)">Pago em ${Utils.data(p.dataPagamento)}</td>` : '<td></td>'}
      </tr>`;
    }).join('');

    document.getElementById('modalDetalhesConteudo').innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:18px;font-weight:700">${cred.clienteNome || 'Cliente'}</div>
            <div class="text-muted fs-sm">Compra em ${Utils.data(cred.criadoEm)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:700;color:var(--primary)">${Utils.moeda(cred.total)}</div>
            <div class="text-muted fs-sm">${cred.parcelas.length}x de ${Utils.moeda(cred.total / cred.parcelas.length)}</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div><span class="text-muted fs-sm">Pago</span><br><strong style="color:var(--success)">${Utils.moeda(totalPago)}</strong></div>
          <div><span class="text-muted fs-sm">Pendente</span><br><strong style="color:var(--warning)">${Utils.moeda(totalPendente)}</strong></div>
        </div>
      </div>
      ${produtosHtml}
      <div class="card">
        <div class="card-title" style="margin-bottom:10px">💳 Parcelas</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
              <th style="text-align:left;padding:6px 0">Parcela</th>
              <th style="text-align:center;padding:6px">Vencimento</th>
              <th style="text-align:right;padding:6px">Valor</th>
              <th style="text-align:right;padding:6px 0">Status</th>
              <th style="text-align:right;padding:6px 0">Pagamento</th>
            </tr>
          </thead>
          <tbody>${parcelasHtml}</tbody>
        </table>
      </div>`;

    document.getElementById('btnImprimirDetalhes').onclick = () => CrediarioModule.imprimirDetalhes(credId);
    Utils.abrirModal('modalDetalhes');
  },

  imprimirDetalhes: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;
    const venda = cred.vendaId ? DB.Vendas.buscar(cred.vendaId) : null;
    const itens = cred.itens || (venda ? venda.itens : []) || [];

    const linhas = [
      '================================',
      '         MOVE PÉ CALÇADOS       ',
      '================================',
      `CLIENTE: ${cred.clienteNome || 'Cliente'}`,
      `DATA DA COMPRA: ${Utils.data(cred.criadoEm)}`,
      `TOTAL: ${Utils.moeda(cred.total)}`,
      '--------------------------------',
    ];

    if (itens.length > 0) {
      linhas.push('PRODUTOS:');
      itens.forEach(i => {
        linhas.push(`  ${i.nome || i.produtoNome} ${i.tamanho ? 'Tam.'+i.tamanho : ''}`);
        linhas.push(`  ${i.quantidade||1}x ${Utils.moeda(i.precoUnitario||i.preco||0)} = ${Utils.moeda((i.precoUnitario||i.preco||0)*(i.quantidade||1))}`);
      });
      linhas.push('--------------------------------');
    }

    linhas.push('PARCELAS:');
    cred.parcelas.forEach((p, idx) => {
      const st = { pago: 'PAGO', atrasado: 'ATRASADO', pendente: 'PENDENTE' }[Utils.statusParcela(p.vencimento, p.status)] || '';
      linhas.push(`  ${p.numero||idx+1}ª - ${Utils.data(p.vencimento)} - ${Utils.moeda(p.valor)} [${st}]`);
    });
    linhas.push('================================');

    Utils.imprimirComprovante(linhas.join('\n'));
  },

  imprimirParcela: (credId, parcelaIdx) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;
    const parcela = cred.parcelas[parcelaIdx];
    if (!parcela) return;

    const comp = Utils.gerarComprovanteParcela({
      clienteNome: cred.clienteNome || 'Cliente',
      numero: `${parcela.numero}/${cred.parcelas.length}`,
      vencimento: parcela.vencimento,
      valor: parcela.valor,
      credId: cred.id
    });
    Utils.imprimirComprovante(comp);
  },

  imprimirContrato: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    const cli = DB.Clientes.buscar(cred.clienteId) || {};
    const nomeLoja  = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const cnpjLoja  = DB.Config.get('cnpj', '45.967.476/0001-34');
    const endLoja   = DB.Config.get('enderecoLoja', '');
    const telLoja   = DB.Config.get('whatsapp', '') || DB.Config.get('telefone', '');
    const cidade    = DB.Config.get('cidadeLoja', '');
    const dataContrato = Utils.data(cred.criadoEm || Utils.hoje());
    const numContrato  = cred.id.substring(0, 8).toUpperCase();

    const end = cli.endereco || {};
    const endCliente = [
      end.rua ? `${end.rua}${end.numero ? ', ' + end.numero : ''}` : '',
      end.bairro || '',
      end.cidade && end.estado ? `${end.cidade}/${end.estado}` : '',
      end.cep ? `CEP ${end.cep}` : '',
    ].filter(Boolean).join(' — ');

    const parcelasHtml = cred.parcelas.map(p => `
      <tr>
        <td style="padding:6px 8px;text-align:center;border:1px solid #ddd">${p.numero}ª</td>
        <td style="padding:6px 8px;text-align:center;border:1px solid #ddd">${Utils.data(p.vencimento)}</td>
        <td style="padding:6px 8px;text-align:right;border:1px solid #ddd;font-weight:600">${Utils.moeda(p.valor)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd"></td>
      </tr>`).join('');

    const html = `
      <html><head><meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 24px; }
        h1 { font-size: 16px; text-align: center; text-transform: uppercase; margin-bottom: 4px; }
        h2 { font-size: 13px; text-align: center; font-weight: normal; margin-bottom: 20px; color: #444; }
        .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
        .loja-nome { font-size: 18px; font-weight: 900; }
        .loja-info { font-size: 11px; color: #555; line-height: 1.6; }
        .numero-contrato { font-size: 11px; text-align: right; }
        .secao { margin-bottom: 16px; }
        .secao-titulo { font-weight: 700; font-size: 12px; text-transform: uppercase; background: #f0f0f0; padding: 4px 8px; border-left: 3px solid #000; margin-bottom: 8px; }
        .campo-linha { display: flex; gap: 24px; margin-bottom: 6px; }
        .campo { flex: 1; }
        .campo label { font-size: 10px; color: #666; display: block; text-transform: uppercase; }
        .campo span { font-weight: 600; border-bottom: 1px solid #aaa; display: block; padding-bottom: 2px; min-height: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #f0f0f0; padding: 6px 8px; border: 1px solid #ddd; text-align: center; font-size: 11px; }
        .clausulas { font-size: 11px; line-height: 1.7; color: #333; }
        .clausulas p { margin: 6px 0; }
        .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
        .assinatura-linha { border-top: 1px solid #000; padding-top: 6px; text-align: center; font-size: 11px; }
        .destaque { background: #fffbea; border: 1px solid #e5a000; border-radius: 4px; padding: 8px 12px; font-size: 12px; margin: 12px 0; }
        @media print { body { padding: 16px; } }
      </style></head><body>

      <div class="cabecalho">
        <div>
          <div class="loja-nome">${nomeLoja}</div>
          <div class="loja-info">
            CNPJ: ${cnpjLoja}${endLoja ? '<br>' + endLoja : ''}${telLoja ? '<br>Tel: ' + Utils.telefone(telLoja) : ''}
          </div>
        </div>
        <div class="numero-contrato">
          <strong>CONTRATO DE CREDIÁRIO</strong><br>
          Nº ${numContrato}<br>
          Data: ${dataContrato}
        </div>
      </div>

      <div class="secao">
        <div class="secao-titulo">Dados do Contratante (Comprador)</div>
        <div class="campo-linha">
          <div class="campo"><label>Nome completo</label><span>${cli.nome || cred.clienteNome || ''}</span></div>
          <div class="campo" style="max-width:160px"><label>CPF</label><span>${cli.cpf || ''}</span></div>
          <div class="campo" style="max-width:140px"><label>RG</label><span>${cli.rg || ''}</span></div>
        </div>
        <div class="campo-linha">
          <div class="campo"><label>Endereço completo</label><span>${endCliente}</span></div>
          <div class="campo" style="max-width:180px"><label>Telefone</label><span>${cli.telefone ? Utils.telefone(cli.telefone) : ''}</span></div>
        </div>
      </div>

      <div class="secao">
        <div class="secao-titulo">Condições de Pagamento</div>
        <div class="campo-linha">
          <div class="campo"><label>Valor total da compra</label><span style="font-size:15px;font-weight:900">${Utils.moeda(cred.total)}</span></div>
          <div class="campo"><label>Quantidade de parcelas</label><span>${cred.parcelas.length}x de ${Utils.moeda(cred.total / cred.parcelas.length)}</span></div>
          <div class="campo"><label>1ª parcela em</label><span>${Utils.data(cred.parcelas[0]?.vencimento)}</span></div>
        </div>

        <table style="margin-top:10px">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Vencimento</th>
              <th>Valor</th>
              <th>Assinatura / Rubrica do Cliente</th>
            </tr>
          </thead>
          <tbody>${parcelasHtml}</tbody>
        </table>
      </div>

      <div class="secao">
        <div class="secao-titulo">Cláusulas e Condições</div>
        <div class="clausulas">
          <p><strong>1. JUROS E ENCARGOS:</strong> Sobre os valores em atraso incidirão juros moratórios de <strong>0,4% (zero vírgula quatro por cento) ao dia</strong>, após carência de <strong>5 (cinco) dias</strong> a contar da data de vencimento de cada parcela.</p>
          <p><strong>2. MULTA:</strong> Em caso de atraso, fica estabelecida multa contratual de <strong>2% (dois por cento)</strong> sobre o valor da parcela em atraso, acrescida dos juros previstos na cláusula anterior.</p>
          <p><strong>3. RESPONSABILIDADE:</strong> O comprador declara que os produtos foram recebidos em perfeito estado e que está ciente das condições de pagamento estabelecidas neste contrato.</p>
          <p><strong>4. ANTECIPAÇÃO:</strong> O comprador poderá antecipar o pagamento de qualquer parcela sem incidência de juros sobre o valor antecipado.</p>
          <p><strong>5. INADIMPLÊNCIA:</strong> O não pagamento de qualquer parcela no prazo estipulado implicará no vencimento antecipado das demais parcelas, tornando exigível a totalidade da dívida.</p>
          <p><strong>6. FORO:</strong> Fica eleito o foro da comarca de ${cidade || 'domicílio do contratante'} para dirimir quaisquer dúvidas decorrentes deste contrato.</p>
        </div>
        <div class="destaque">
          ⚠️ <strong>ATENÇÃO:</strong> Ao assinar este contrato, o comprador declara estar ciente de todas as cláusulas acima, em especial sobre juros de <strong>0,4% ao dia</strong> após 5 dias de carência.
        </div>
      </div>

      <p style="font-size:12px;text-align:center;margin-top:8px">
        ${cidade ? cidade + ', ' : ''}${dataContrato}
      </p>

      <div class="assinaturas">
        <div>
          <div class="assinatura-linha">
            ${nomeLoja}<br>
            <span style="font-size:10px;color:#555">CNPJ: ${cnpjLoja} — Contratada</span>
          </div>
        </div>
        <div>
          <div class="assinatura-linha">
            ${cli.nome || cred.clienteNome || 'Cliente'}<br>
            <span style="font-size:10px;color:#555">CPF: ${cli.cpf || '___.___.___-__'} — Contratante</span>
          </div>
        </div>
      </div>

      <div style="margin-top:24px">
        <div class="assinatura-linha" style="max-width:300px">
          Testemunha: ____________________________<br>
          <span style="font-size:10px;color:#555">CPF: ___.___.___-__</span>
        </div>
      </div>

      <p style="font-size:10px;color:#888;text-align:center;margin-top:20px;border-top:1px solid #eee;padding-top:8px">
        Documento gerado pelo sistema ${nomeLoja} em ${new Date().toLocaleString('pt-BR')} — Contrato Nº ${numContrato}
      </p>

      <script>window.onload = () => { window.print(); }<\/script>
      </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },

  _buildInadimplenciaData: () => {
    const hoje = Utils.hoje();
    const agora = new Date(); agora.setHours(0,0,0,0);
    const map = {};

    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach(p => {
        if (p.status === 'pago' || !p.vencimento || p.vencimento >= hoje) return;
        const diasAtraso = Math.floor((agora - new Date(p.vencimento + 'T00:00:00')) / 86400000);
        const { juros } = calcularJuros(p.vencimento, p.valor);
        const valor = parseFloat(p.valor) || 0;

        if (!map[cred.id]) {
          map[cred.id] = {
            credId: cred.id,
            clienteId: cred.clienteId,
            clienteNome: cred.clienteNome || 'Cliente',
            parcelas: 0,
            valorOriginal: 0,
            juros: 0,
            maiorAtraso: 0,
            vencimentoMaisAntigo: p.vencimento
          };
        }
        const r = map[cred.id];
        r.parcelas++;
        r.valorOriginal += valor;
        r.juros += juros;
        if (diasAtraso > r.maiorAtraso) r.maiorAtraso = diasAtraso;
        if (p.vencimento < r.vencimentoMaisAntigo) r.vencimentoMaisAntigo = p.vencimento;
      });
    });

    return Object.values(map).sort((a, b) => b.maiorAtraso - a.maiorAtraso);
  },

  abrirRelatorioInadimplencia: () => {
    const dados = CrediarioModule._buildInadimplenciaData();
    const cont = document.getElementById('inadimplenciaConteudo');

    if (dados.length === 0) {
      cont.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Nenhum cliente inadimplente</div></div>`;
      Utils.abrirModal('modalInadimplencia');
      return;
    }

    const totalOriginal = dados.reduce((s, r) => s + r.valorOriginal, 0);
    const totalJuros    = dados.reduce((s, r) => s + r.juros, 0);
    const totalGeral    = totalOriginal + totalJuros;
    const maiorAtraso   = Math.max(...dados.map(r => r.maiorAtraso));

    const corAtraso = (dias) => dias > 30 ? 'var(--danger)' : dias > 15 ? 'var(--warning)' : 'var(--text)';

    const linhas = dados.map(r => {
      const total = r.valorOriginal + r.juros;
      const cliente = r.clienteId ? DB.Clientes.buscar(r.clienteId) : null;
      const fone = cliente ? (cliente.telefone || cliente.celular || '—') : '—';
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 0">
            <div style="font-weight:600">${r.clienteNome}</div>
            <div style="font-size:11px;color:var(--text-muted)">${Utils.telefone(fone)}</div>
          </td>
          <td style="padding:8px;text-align:center">${r.parcelas}</td>
          <td style="padding:8px;text-align:center;color:${corAtraso(r.maiorAtraso)};font-weight:600">${r.maiorAtraso}d</td>
          <td style="padding:8px;text-align:right">${Utils.moeda(r.valorOriginal)}</td>
          <td style="padding:8px;text-align:right;color:var(--danger)">${r.juros > 0 ? Utils.moeda(r.juros) : '—'}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:var(--primary)">${Utils.moeda(total)}</td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div class="stats-grid" style="margin-bottom:16px">
        <div class="stat-card">
          <div class="stat-label">Clientes</div>
          <div class="stat-value danger">${dados.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total em Atraso</div>
          <div class="stat-value danger">${Utils.moeda(totalOriginal)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Juros Acumulados</div>
          <div class="stat-value warning">${Utils.moeda(totalJuros)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total c/ Juros</div>
          <div class="stat-value" style="color:var(--primary)">${Utils.moeda(totalGeral)}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Maior atraso: <strong style="color:var(--danger)">${maiorAtraso} dias</strong> · Ordenado por dias de atraso</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid var(--border);color:var(--text-muted)">
              <th style="text-align:left;padding:8px 0">Cliente</th>
              <th style="text-align:center;padding:8px">Parcelas</th>
              <th style="text-align:center;padding:8px">Atraso</th>
              <th style="text-align:right;padding:8px">Original</th>
              <th style="text-align:right;padding:8px">Juros</th>
              <th style="text-align:right;padding:8px 0">Total</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td style="padding:10px 0" colspan="3">TOTAL GERAL</td>
              <td style="padding:10px;text-align:right">${Utils.moeda(totalOriginal)}</td>
              <td style="padding:10px;text-align:right;color:var(--danger)">${Utils.moeda(totalJuros)}</td>
              <td style="padding:10px 0;text-align:right;color:var(--primary);font-size:15px">${Utils.moeda(totalGeral)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    Utils.abrirModal('modalInadimplencia');
  },

  imprimirInadimplencia: () => {
    const dados = CrediarioModule._buildInadimplenciaData();
    const linhaH = '='.repeat(44);
    const linhaL = '-'.repeat(44);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const totalOriginal = dados.reduce((s, r) => s + r.valorOriginal, 0);
    const totalJuros    = dados.reduce((s, r) => s + r.juros, 0);
    const totalGeral    = totalOriginal + totalJuros;

    const linhas = dados.map(r => {
      const total = r.valorOriginal + r.juros;
      const nome = r.clienteNome.substring(0, 22).padEnd(22);
      return `${nome} ${String(r.maiorAtraso+'d').padStart(5)}  ${Utils.moeda(total).padStart(12)}`;
    }).join('\n');

    const texto = `
${linhaH}
          MOVE PÉ CALÇADOS
      RELATÓRIO DE INADIMPLÊNCIA
${linhaH}
Data: ${dataStr}
Total de clientes: ${dados.length}
${linhaL}
CLIENTE                ATRASO       TOTAL
${linhaL}
${linhas}
${linhaL}
Total original:   ${Utils.moeda(totalOriginal).padStart(18)}
Juros acumulados: ${Utils.moeda(totalJuros).padStart(18)}
TOTAL GERAL:      ${Utils.moeda(totalGeral).padStart(18)}
${linhaH}
`.trim();

    Utils.imprimirComprovante(texto);
  },

  renegociar: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    const pendentes = cred.parcelas.filter(p => p.status !== 'pago');
    if (pendentes.length === 0) { Utils.toast('Crediário já quitado', 'warning'); return; }

    _renegociacaoAtual = { credId };

    // Pré-preenche data: 30 dias a partir de hoje
    const venc1 = new Date();
    venc1.setDate(venc1.getDate() + 30);
    document.getElementById('renegVencimento').value = venc1.toISOString().substring(0, 10);
    document.getElementById('renegParcelas').value = pendentes.length;
    document.getElementById('renegIncluirJuros').checked = true;

    CrediarioModule.renegociarAtualizar();
    Utils.abrirModal('modalRenegociacao');
  },

  renegociarAtualizar: () => {
    if (!_renegociacaoAtual) return;
    const cred = DB.Crediario.buscar(_renegociacaoAtual.credId);
    if (!cred) return;

    const pendentes = cred.parcelas.filter(p => p.status !== 'pago');
    const incluirJuros = document.getElementById('renegIncluirJuros').checked;

    // Calcula total pendente (com ou sem juros)
    let totalBase = 0;
    let totalJuros = 0;
    pendentes.forEach(p => {
      totalBase += parseFloat(p.valor) || 0;
      if (incluirJuros) {
        const { juros } = calcularJuros(p.vencimento, p.valor);
        totalJuros += juros;
      }
    });
    const totalRenegociado = totalBase + totalJuros;

    // Resumo
    const pagas = cred.parcelas.filter(p => p.status === 'pago');
    document.getElementById('renegResumo').innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-weight:700;font-size:16px">${cred.clienteNome}</div>
          <div class="text-muted fs-sm">${pendentes.length} parcela(s) pendente(s) · ${pagas.length} já paga(s)</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text-muted)">Total pendente</div>
          <div style="font-weight:700;color:var(--danger);font-size:18px">${Utils.moeda(totalBase)}</div>
          ${totalJuros > 0 ? `<div style="font-size:11px;color:var(--danger)">+ ${Utils.moeda(totalJuros)} juros</div>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:10px;border-top:1px solid var(--border)">
        <span style="font-weight:600">Total a renegociar</span>
        <span style="font-weight:800;font-size:18px;color:var(--primary)">${Utils.moeda(totalRenegociado)}</span>
      </div>`;

    // Preview de novas parcelas
    const qtd = parseInt(document.getElementById('renegParcelas').value) || 1;
    const venc1Str = document.getElementById('renegVencimento').value;
    if (!venc1Str) { document.getElementById('renegPreview').innerHTML = ''; return; }

    const valorParcela = totalRenegociado / qtd;
    let rows = '';
    for (let i = 0; i < qtd; i++) {
      const venc = Utils.adicionarMeses(venc1Str, i);
      rows += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 0;color:var(--text-muted)">${i+1}ª parcela</td>
        <td style="padding:6px;text-align:center">${Utils.data(venc)}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:var(--primary)">${Utils.moeda(valorParcela)}</td>
      </tr>`;
    }

    document.getElementById('renegPreview').innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">NOVAS PARCELAS</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid var(--border);color:var(--text-muted)">
            <th style="text-align:left;padding:6px 0">Parcela</th>
            <th style="text-align:center;padding:6px">Vencimento</th>
            <th style="text-align:right;padding:6px 0">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:right;padding-top:8px;font-size:13px;color:var(--text-muted)">
        Total: <strong style="color:var(--primary)">${Utils.moeda(totalRenegociado)}</strong>
      </div>`;
  },

  renegociarConfirmar: () => {
    if (!_renegociacaoAtual) return;
    const cred = DB.Crediario.buscar(_renegociacaoAtual.credId);
    if (!cred) return;

    const qtd = parseInt(document.getElementById('renegParcelas').value) || 1;
    const venc1Str = document.getElementById('renegVencimento').value;
    if (!venc1Str) { Utils.toast('Informe o 1º vencimento', 'error'); return; }

    const pendentes = cred.parcelas.filter(p => p.status !== 'pago');
    const incluirJuros = document.getElementById('renegIncluirJuros').checked;

    let totalRenegociado = 0;
    pendentes.forEach(p => {
      totalRenegociado += parseFloat(p.valor) || 0;
      if (incluirJuros) {
        const { juros } = calcularJuros(p.vencimento, p.valor);
        totalRenegociado += juros;
      }
    });

    const valorParcela = Math.round((totalRenegociado / qtd) * 100) / 100;

    // Mantém parcelas já pagas + adiciona novas renegociadas
    const pagas = cred.parcelas.filter(p => p.status === 'pago');
    const novasParcelas = [];
    for (let i = 0; i < qtd; i++) {
      novasParcelas.push({
        numero: i + 1,
        valor: i < qtd - 1 ? valorParcela : Math.round((totalRenegociado - valorParcela * (qtd - 1)) * 100) / 100, // última parcela absorve centavos
        vencimento: Utils.adicionarMeses(venc1Str, i),
        status: 'pendente',
        renegociada: true
      });
    }

    const obs = `Renegociado em ${Utils.data(Utils.hoje())} · ${qtd}x de ${Utils.moeda(valorParcela)}${incluirJuros ? ' (com juros)' : ''}`;

    const credAtualizado = {
      ...cred,
      parcelas: [...pagas, ...novasParcelas],
      total: pagas.reduce((s,p) => s+(parseFloat(p.valor)||0), 0) + totalRenegociado,
      observacao: cred.observacao ? `${cred.observacao} | ${obs}` : obs
    };

    DB.Crediario.salvar(credAtualizado);

    Utils.fecharModal('modalRenegociacao');
    CrediarioModule.renderStats();
    CrediarioModule.renderMensal();
    CrediarioModule.renderLista();
    Utils.toast(`Dívida renegociada! ${qtd}x de ${Utils.moeda(valorParcela)}`, 'success');

    CrediarioModule.imprimirRenegociacao(credAtualizado, totalRenegociado, incluirJuros);
    _renegociacaoAtual = null;
  },

  imprimirRenegociacao: (cred, totalRenegociado, incluiuJuros) => {
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const novas = cred.parcelas.filter(p => p.renegociada);
    const linhasParcelas = novas.map(p =>
      `  ${String(p.numero).padStart(2,'0')}/${novas.length}  ${Utils.data(p.vencimento).padEnd(12)}  ${Utils.moeda(p.valor).padStart(10)}`
    ).join('\n');

    const texto = `
${linhaH}
         MOVE PÉ CALÇADOS
      ACORDO DE RENEGOCIAÇÃO
${linhaH}
Data: ${dataStr}
${linhaL}
Cliente: ${cred.clienteNome || 'Cliente'}
${linhaL}
Total renegociado: ${Utils.moeda(totalRenegociado)}
${incluiuJuros ? 'Juros incluídos no total' : 'Sem juros'}
${linhaL}
NOVAS PARCELAS:
  Nº    VENCIMENTO      VALOR
${linhasParcelas}
${linhaL}
Total: ${Utils.moeda(totalRenegociado)}
${linhaH}
  Declaro estar ciente e de acordo
     com as condições acima.

Assinatura: ___________________________

         MOVE PÉ CALÇADOS
${linhaH}
`.trim();

    Utils.imprimirComprovante(texto);
  },

  enviarWhatsApp: (credId) => {
    const cred = DB.Crediario.buscar(credId);
    if (!cred) return;

    // Busca telefone do cliente
    const cliente = cred.clienteId ? DB.Clientes.buscar(cred.clienteId) : null;
    const fone = cliente ? (cliente.telefone || cliente.celular || '') : '';
    const foneNumeros = fone.replace(/\D/g, '');

    if (!foneNumeros) {
      Utils.toast('Cliente sem telefone cadastrado', 'error');
      return;
    }

    const pendentes = cred.parcelas.filter(p => p.status !== 'pago');
    if (pendentes.length === 0) {
      Utils.toast('Crediário já está quitado', 'warning');
      return;
    }

    const hoje = Utils.hoje();
    const atrasadas = pendentes.filter(p => p.vencimento < hoje);
    const primeiroNome = (cred.clienteNome || '').split(' ')[0];
    const nomeLoja = DB.Config.get('nomeLoja', 'MOVE PÉ Calçados');
    const totalParcelas = cred.parcelas.length;

    const linhasParcelas = pendentes.map((p, idx) => {
      const { juros } = calcularJuros(p.vencimento, p.valor);
      const valor = (parseFloat(p.valor) || 0) + juros;
      const numParcela = p.numero || (idx + 1);
      const atrasada = p.vencimento < hoje;
      const status = atrasada
        ? `venceu em ${Utils.data(p.vencimento)} ⚠️`
        : `vence em ${Utils.data(p.vencimento)}`;
      return `${atrasada ? '🔴' : '🟡'} Parcela ${numParcela}/${totalParcelas} — ${status}\n    💰 ${Utils.moeda(valor)}${juros > 0 ? ' (inclui juros)' : ''}`;
    }).join('\n\n');

    const totalComJuros = pendentes.reduce((s, p) => {
      const { juros } = calcularJuros(p.vencimento, p.valor);
      return s + (parseFloat(p.valor) || 0) + juros;
    }, 0);

    let mensagem;

    if (atrasadas.length === 0) {
      // Lembrete amigável — sem atraso
      mensagem =
`Oi, ${primeiroNome}! Tudo bem? 😊

Aqui é da *${nomeLoja}*, passando só para lembrar das suas parcelas que estão chegando:

${linhasParcelas}

💳 *Total: ${Utils.moeda(totalComJuros)}*

Se precisar de algum ajuste ou tiver alguma dúvida, é só chamar a gente! 😊
📞 ${foneNumeros ? '' : ''}Estamos aqui para ajudar.`;

    } else if (atrasadas.length <= 2) {
      // 1ª ou 2ª cobrança — tom amigável mas claro
      mensagem =
`Oi, ${primeiroNome}! 😊

Aqui é da *${nomeLoja}*. Tudo bem com você?

Passando para avisar que identificamos parcelas em atraso no seu crediário:

${linhasParcelas}

💰 *Total com juros: ${Utils.moeda(totalComJuros)}*

Sabemos que imprevistos acontecem! Entre em contato com a gente para a gente encontrar a melhor forma de resolver isso juntos. 🤝

Estamos aqui para ajudar! 😊`;

    } else {
      // Cobrança com aviso de SPC/Serasa — tom firme mas respeitoso
      mensagem =
`Oi, ${primeiroNome}.

Aqui é da *${nomeLoja}*. Tentamos entrar em contato anteriormente e ainda não conseguimos resolver as parcelas em aberto:

${linhasParcelas}

💰 *Total com juros: ${Utils.moeda(totalComJuros)}*

Precisamos te informar que débitos não regularizados podem levar à inclusão do seu nome nos órgãos de proteção ao crédito, como *SPC e Serasa*, o que pode dificultar compras a prazo e financiamentos.

Queremos muito evitar isso e resolver de forma tranquila! Entre em contato *hoje* para a gente encontrar uma solução:

📞 Aguardamos seu retorno. 🙏`;
    }

    const numero = foneNumeros.length === 11 ? `55${foneNumeros}` : foneNumeros.startsWith('55') ? foneNumeros : `55${foneNumeros}`;
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  }
};

document.addEventListener('DOMContentLoaded', CrediarioModule.init);
document.addEventListener('movePe-sync', () => { CrediarioModule.renderStats(); CrediarioModule.renderMensal(); CrediarioModule.renderLista(); });
