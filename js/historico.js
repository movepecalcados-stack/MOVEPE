/**
 * MOVE PÉ - Histórico de Vendas v2.0
 */

let _buscaHist = '';
let _dataInicio = '';
let _dataFim = '';
let _devTrocaAtual = null;
let _devTrocaNovoItem = null; // { produtoId, nome, tamanho, precoUnitario }
let _devTrocaEstado = 'perfeito'; // 'perfeito' | 'defeito'

const Historico = {

  init: () => {
    Utils.renderNav('historico.html');
    Utils.initModais();
    Historico.render();

    document.getElementById('buscaInput').addEventListener('input', (e) => {
      _buscaHist = e.target.value;
      Historico.render();
    });

    document.getElementById('inputDataInicio').addEventListener('change', (e) => {
      _dataInicio = e.target.value;
      Historico.render();
    });

    document.getElementById('inputDataFim').addEventListener('change', (e) => {
      _dataFim = e.target.value;
      Historico.render();
    });

    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
      _buscaHist = '';
      _dataInicio = '';
      _dataFim = '';
      document.getElementById('buscaInput').value = '';
      document.getElementById('inputDataInicio').value = '';
      document.getElementById('inputDataFim').value = '';
      Historico.render();
    });
  },

  render: () => {
    const _localDate = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    let vendas = DB.Vendas.listar()
      .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));

    if (_dataInicio) vendas = vendas.filter(v => v.criadoEm && _localDate(v.criadoEm) >= _dataInicio);
    if (_dataFim)    vendas = vendas.filter(v => v.criadoEm && _localDate(v.criadoEm) <= _dataFim);

    if (_buscaHist.trim()) {
      const t = _buscaHist.toLowerCase();
      vendas = vendas.filter(v => {
        const idMatch = (v.id || '').toLowerCase().includes(t);
        const clienteMatch = (v.clienteNome || '').toLowerCase().includes(t);
        const itemMatch = (v.itens || []).some(i => (i.nome || '').toLowerCase().includes(t));
        const obsMatch = (v.observacao || '').toLowerCase().includes(t);
        return idMatch || clienteMatch || itemMatch || obsMatch;
      });
    }

    // Stats topbar
    const total = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    document.getElementById('statTotalVendas').textContent = vendas.length + ' vendas';
    document.getElementById('statTotalFaturamento').textContent = Utils.moeda(total);

    // Resumo por forma de pagamento
    Historico.renderResumo(vendas, total);

    const cont = document.getElementById('historicoLista');
    if (vendas.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🕐</div>
        <div class="empty-title">Nenhuma venda encontrada</div>
        <div class="empty-sub">Ajuste os filtros ou realize vendas no PDV</div>
      </div>`;
      return;
    }

    cont.innerHTML = vendas.map(v => {
      const itensDesc = (v.itens || []).map(i =>
        `${i.nome}${i.tamanho ? ' (Tam ' + i.tamanho.split('||').join(' ') + ')' : ''} x${i.quantidade || 1}`
      ).join(', ');

      const formaLabel = Utils.labelFormaPagamento(v.formaPagamento, v.parcelasCartao);
      const formaBadge = {
        dinheiro: 'badge-success',
        cartao_credito: 'badge-info',
        cartao_debito: 'badge-info',
        pix: 'badge-primary',
        crediario: 'badge-warning'
      }[v.formaPagamento] || 'badge-muted';

      const devolvida = v.devolucoes && v.devolucoes.length > 0;
      const totalDevolvido = devolvida ? v.devolucoes.reduce((s, d) => s + (d.valorDevolvido || 0), 0) : 0;

      return `
        <div class="historico-card" style="${devolvida ? 'border-color:var(--warning);opacity:0.85' : ''}">
          <div class="historico-header">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="historico-id">#${(v.id || '').toUpperCase().substring(0, 8)}</span>
              <span class="badge ${formaBadge}">${formaLabel}</span>
              ${devolvida ? `<span class="badge badge-warning">🔄 Dev. ${Utils.moeda(totalDevolvido)}</span>` : ''}
              ${v.clienteNome ? `<span class="text-muted fs-sm">👤 ${v.clienteNome}</span>` : ''}
            </div>
            <div class="historico-total">${Utils.moeda(v.total)}</div>
          </div>
          <div class="historico-itens">${itensDesc || 'Sem itens'}</div>
          ${v.observacao ? `<div style="font-size:12px;color:var(--text-muted);padding:4px 0 2px;border-top:1px dashed var(--border);margin-top:4px">📝 ${v.observacao}</div>` : ''}
          <div class="historico-footer">
            <span>${Utils.dataHora(v.criadoEm)}</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-outline btn-sm" onclick="Historico.imprimirVenda('${v.id}')">🖨️ Comprovante</button>
              ${(() => { const cli = v.clienteId ? DB.Clientes.buscar(v.clienteId) : null; const tel = cli ? (cli.telefone||'').replace(/\D/g,'') : ''; return tel ? `<button class="btn btn-sm" style="background:#25D366;border-color:#25D366;color:#fff" onclick="Historico.enviarWhatsApp('${v.id}')">💬 WhatsApp</button>` : ''; })()}
              <button class="btn btn-outline btn-sm" onclick="Historico.abrirDevTroca('${v.id}')" style="color:var(--warning);border-color:var(--warning)">🔄 Dev/Troca</button>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  renderResumo: (vendas, total) => {
    const resumo = document.getElementById('resumoPeriodo');
    if (vendas.length === 0) { resumo.style.display = 'none'; return; }
    resumo.style.display = '';

    const totais = { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, crediario: 0 };
    vendas.forEach(v => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        v.formasPagamento.forEach(f => {
          if (totais[f.forma] !== undefined) totais[f.forma] += parseFloat(f.valor) || 0;
        });
      } else {
        const f = v.formaPagamento;
        if (totais[f] !== undefined) totais[f] += parseFloat(v.total) || 0;
      }
    });
    const ticketMedio = vendas.length > 0 ? total / vendas.length : 0;

    document.getElementById('resumoStats').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Dinheiro</div>
        <div class="stat-value success">${Utils.moeda(totais.dinheiro)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PIX</div>
        <div class="stat-value primary">${Utils.moeda(totais.pix)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cartão Crédito</div>
        <div class="stat-value">${Utils.moeda(totais.cartao_credito)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cartão Débito</div>
        <div class="stat-value">${Utils.moeda(totais.cartao_debito)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Crediário</div>
        <div class="stat-value warning">${Utils.moeda(totais.crediario)}</div>
      </div>
      <div class="stat-card" style="border-color:var(--primary)">
        <div class="stat-label">Ticket Médio</div>
        <div class="stat-value primary">${Utils.moeda(ticketMedio)}</div>
      </div>`;
  },

  filtroPeriodo: (periodo) => {
    const hoje = new Date();
    const fmtLocal = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let ini = '', fim = Utils.hoje();

    if (periodo === 'hoje') {
      ini = Utils.hoje();
    } else if (periodo === 'semana') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - d.getDay());
      ini = fmtLocal(d);
    } else if (periodo === 'mes') {
      ini = Utils.hoje().substring(0, 7) + '-01';
    } else if (periodo === 'mes_passado') {
      const d  = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const df = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      ini = fmtLocal(d);
      fim = fmtLocal(df);
    }

    _dataInicio = ini;
    _dataFim = fim;
    document.getElementById('inputDataInicio').value = ini;
    document.getElementById('inputDataFim').value = fim;
    Historico.render();
  },

  imprimirRelatorio: () => {
    const _localDate = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
    let vendas = DB.Vendas.listar()
      .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));

    if (_dataInicio) vendas = vendas.filter(v => v.criadoEm && _localDate(v.criadoEm) >= _dataInicio);
    if (_dataFim)    vendas = vendas.filter(v => v.criadoEm && _localDate(v.criadoEm) <= _dataFim);
    if (_buscaHist.trim()) {
      const t = _buscaHist.toLowerCase();
      vendas = vendas.filter(v =>
        (v.id || '').toLowerCase().includes(t) ||
        (v.clienteNome || '').toLowerCase().includes(t) ||
        (v.itens || []).some(i => (i.nome || '').toLowerCase().includes(t))
      );
    }

    if (vendas.length === 0) { Utils.toast('Nenhuma venda no período', 'warning'); return; }

    const total = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const totais = { dinheiro: 0, pix: 0, cartao_credito: 0, cartao_debito: 0, crediario: 0 };
    vendas.forEach(v => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        v.formasPagamento.forEach(f => { if (totais[f.forma] !== undefined) totais[f.forma] += parseFloat(f.valor) || 0; });
      } else {
        if (totais[v.formaPagamento] !== undefined) totais[v.formaPagamento] += parseFloat(v.total) || 0;
      }
    });

    const periodoStr = _dataInicio && _dataFim
      ? `${Utils.data(_dataInicio)} a ${Utils.data(_dataFim)}`
      : _dataInicio ? `A partir de ${Utils.data(_dataInicio)}`
      : _dataFim ? `Até ${Utils.data(_dataFim)}` : 'Todo o período';

    const linhas = [
      '========================================',
      '          MOVE PÉ CALÇADOS              ',
      '      RELATÓRIO DE VENDAS               ',
      '========================================',
      `Período: ${periodoStr}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '----------------------------------------',
      `Total de vendas: ${vendas.length}`,
      `Faturamento: ${Utils.moeda(total)}`,
      `Ticket médio: ${Utils.moeda(total / vendas.length)}`,
      '----------------------------------------',
      'POR FORMA DE PAGAMENTO:',
      `  Dinheiro:       ${Utils.moeda(totais.dinheiro)}`,
      `  PIX:            ${Utils.moeda(totais.pix)}`,
      `  Cartão Crédito: ${Utils.moeda(totais.cartao_credito)}`,
      `  Cartão Débito:  ${Utils.moeda(totais.cartao_debito)}`,
      `  Crediário:      ${Utils.moeda(totais.crediario)}`,
      '========================================',
      'VENDAS DO PERÍODO:',
      '----------------------------------------',
      ...vendas.map(v => [
        `${Utils.dataHora(v.criadoEm)} | #${(v.id || '').substring(0, 8).toUpperCase()}`,
        `${v.clienteNome ? 'Cliente: ' + v.clienteNome : 'Sem cliente'}`,
        `Forma: ${Utils.labelFormaPagamento(v.formaPagamento)} | Total: ${Utils.moeda(v.total)}`,
        ''
      ].join('\n')),
      '========================================'
    ].join('\n');

    Utils.imprimirComprovante(linhas);
  },

  imprimirVenda: (id) => {
    const venda = DB.Vendas.buscar(id);
    if (!venda) { Utils.toast('Venda não encontrada', 'error'); return; }
    const comp = Utils.gerarComprovante(venda);
    Utils.imprimirComprovante(comp);
  },

  enviarWhatsApp: (id) => {
    const venda = DB.Vendas.buscar(id);
    if (!venda) return;
    const cli = venda.clienteId ? DB.Clientes.buscar(venda.clienteId) : null;
    const tel = cli ? (cli.telefone || '').replace(/\D/g, '') : '';
    if (!tel) { Utils.toast('Cliente sem telefone cadastrado', 'warning'); return; }
    const texto = Utils.gerarTextoWhatsApp(venda);
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`, '_blank');
  },

  abrirDevTroca: (vendaId) => {
    const venda = DB.Vendas.buscar(vendaId);
    if (!venda) { Utils.toast('Venda não encontrada', 'error'); return; }

    _devTrocaAtual = { vendaId, itensSel: {} };

    // Info da venda
    document.getElementById('devTrocaVendaInfo').innerHTML = `
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <span style="font-weight:700">#${(venda.id || '').toUpperCase().substring(0, 8)}</span>
          ${venda.clienteNome ? `· 👤 ${venda.clienteNome}` : ''}
        </div>
        <div>${Utils.dataHora(venda.criadoEm)} · <strong>${Utils.moeda(venda.total)}</strong></div>
      </div>`;

    // Itens com checkbox e quantidade
    const itens = venda.itens || [];
    document.getElementById('devTrocaItens').innerHTML = itens.length === 0
      ? '<span class="text-muted fs-sm">Sem itens registrados nesta venda</span>'
      : itens.map((item, idx) => {
          const devolvidos = (venda.devolucoes || []).reduce((s, d) => {
            const di = (d.itens || []).find(i => i.idx === idx);
            return s + (di ? di.qtd : 0);
          }, 0);
          const disponivel = (item.quantidade || 1) - devolvidos;
          if (disponivel <= 0) return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);opacity:0.4">
              <input type="checkbox" disabled>
              <span style="flex:1;font-size:13px">${item.nome}${item.tamanho ? ' · Tam '+item.tamanho.split('||').join(' ') : ''}</span>
              <span class="badge badge-success" style="font-size:11px">Já devolvido</span>
            </div>`;
          return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border)">
              <input type="checkbox" id="devItem${idx}" onchange="Historico.devTrocaToggle(${idx})" style="width:16px;height:16px;cursor:pointer">
              <span style="flex:1;font-size:13px">${item.nome}${item.tamanho ? ' · Tam <strong>'+item.tamanho.split('||').join(' ')+'</strong>' : ''} · ${Utils.moeda(item.precoUnitario || 0)}</span>
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:11px;color:var(--text-muted)">Qtd:</span>
                <input type="number" id="devQtd${idx}" min="1" max="${disponivel}" value="1"
                  style="width:50px;height:28px;font-size:12px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--input-bg);color:var(--text)"
                  oninput="Historico.devTrocaAtualizarResumo()" disabled>
                <span style="font-size:11px;color:var(--text-muted)">(máx ${disponivel})</span>
              </div>
            </div>`;
        }).join('');

    // Reset tipo, estado e campos
    document.querySelector('input[name="devTrocaTipo"][value="devolucao"]').checked = true;
    document.querySelector('input[name="devTrocaEstado"][value="perfeito"]').checked = true;
    _devTrocaEstado = 'perfeito';
    document.getElementById('devTrocaEstadoObs').value = '';
    document.getElementById('devTrocaEstadoSecao').style.display = 'none';
    document.getElementById('devTrocaReembolsoSecao').style.display = '';
    document.getElementById('devTrocaNovoItemSecao').style.display = 'none';
    document.getElementById('devTrocaDiferencaSecao').style.display = 'none';
    document.getElementById('devTrocaCrediarioOpts').style.display = 'none';
    document.getElementById('devTrocaFormaDiferenca').value = 'dinheiro';
    document.getElementById('devTrocaCredParcelas').value = '1';
    // Vencimento padrão = hoje + 30 dias
    const _d30 = new Date(); _d30.setDate(_d30.getDate() + 30);
    document.getElementById('devTrocaCredVenc').value =
      `${_d30.getFullYear()}-${String(_d30.getMonth()+1).padStart(2,'0')}-${String(_d30.getDate()).padStart(2,'0')}`;
    document.getElementById('devTrocaResumo').style.display = 'none';

    Utils.abrirModal('modalDevTroca');
  },

  devTrocaToggle: (idx) => {
    const cb = document.getElementById(`devItem${idx}`);
    const qtdInput = document.getElementById(`devQtd${idx}`);
    qtdInput.disabled = !cb.checked;
    if (cb.checked) qtdInput.focus();
    // Mostrar seção estado se houver ao menos 1 item selecionado
    const algumSelecionado = document.querySelectorAll('[id^="devItem"]:checked').length > 0;
    document.getElementById('devTrocaEstadoSecao').style.display = algumSelecionado ? '' : 'none';
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaTipoChange: () => {
    const tipo = document.querySelector('input[name="devTrocaTipo"]:checked').value;
    document.getElementById('devTrocaReembolsoSecao').style.display = tipo === 'devolucao' ? '' : 'none';
    document.getElementById('devTrocaNovoItemSecao').style.display = tipo === 'troca' ? '' : 'none';
    if (tipo === 'troca') {
      _devTrocaNovoItem = null;
      document.getElementById('devTrocaBuscaProd').value = '';
      document.getElementById('devTrocaProdGrid').innerHTML = '';
      document.getElementById('devTrocaNovoItemSel').style.display = 'none';
      document.getElementById('devTrocaDiferencaSecao').style.display = 'none';
      document.getElementById('devTrocaCrediarioOpts').style.display = 'none';
      const venda = _devTrocaAtual ? DB.Vendas.buscar(_devTrocaAtual.vendaId) : null;
      if (venda) {
        const primeiroSel = (venda.itens || []).find((_, idx) => {
          const cb = document.getElementById(`devItem${idx}`);
          return cb && cb.checked;
        });
        if (primeiroSel) Historico.devTrocaBuscarProduto(primeiroSel.nome.split(' ')[0]);
      }
    }
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaBuscarProduto: (busca) => {
    const prods = busca.trim()
      ? DB.Produtos.buscarPorTexto(busca)
      : DB.Produtos.listarAtivos().slice(0, 6);

    document.getElementById('devTrocaProdGrid').innerHTML = prods.map(p => {
      const variacoes = p.variacoes || {};
      const tams = Object.entries(variacoes)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .map(([tam, qtd]) => `
          <button onclick="Historico.devTrocaSelecionarItem('${p.id}','${tam}')"
            class="tamanho-btn ${qtd <= 0 ? 'sem-estoque' : ''}"
            ${qtd <= 0 ? 'disabled' : ''}
            title="${qtd} em estoque">
            ${tam}
          </button>`).join('');

      return `
        <div style="padding:8px;border-bottom:1px solid var(--border);font-size:13px">
          <div style="font-weight:600;margin-bottom:4px">${p.nome} — <span style="color:var(--primary)">${Utils.moeda(p.precoVenda)}</span></div>
          ${Object.keys(variacoes).length > 0
            ? `<div class="tamanhos-grid">${tams}</div>`
            : `<button onclick="Historico.devTrocaSelecionarItem('${p.id}','')" class="btn btn-primary btn-sm">Selecionar</button>`
          }
        </div>`;
    }).join('') || '<div class="text-muted fs-sm" style="padding:8px">Nenhum produto encontrado</div>';
  },

  devTrocaSelecionarItem: (prodId, tamanho) => {
    const prod = DB.Produtos.buscar(prodId);
    if (!prod) return;
    if (tamanho && (prod.variacoes || {})[tamanho] <= 0) {
      Utils.toast('Tamanho sem estoque!', 'error'); return;
    }
    _devTrocaNovoItem = { produtoId: prodId, nome: prod.nome, tamanho, precoUnitario: prod.precoVenda };
    const label = `${prod.nome}${tamanho ? ' · Tam ' + tamanho.split('||').join(' ') : ''} · ${Utils.moeda(prod.precoVenda)}`;
    document.getElementById('devTrocaNovoItemLabel').textContent = ' ' + label;
    document.getElementById('devTrocaNovoItemSel').style.display = '';
    document.getElementById('devTrocaProdGrid').innerHTML = '';
    document.getElementById('devTrocaBuscaProd').value = '';
    document.getElementById('devTrocaDiferencaSecao').style.display = '';
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaLimparNovoItem: () => {
    _devTrocaNovoItem = null;
    document.getElementById('devTrocaNovoItemSel').style.display = 'none';
    document.getElementById('devTrocaDiferencaSecao').style.display = 'none';
    document.getElementById('devTrocaCrediarioOpts').style.display = 'none';
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaFormaChanged: () => {
    const forma = document.getElementById('devTrocaFormaDiferenca').value;
    document.getElementById('devTrocaCrediarioOpts').style.display = forma === 'crediario' ? '' : 'none';
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaAtualizarResumo: () => {
    if (!_devTrocaAtual) return;
    const venda = DB.Vendas.buscar(_devTrocaAtual.vendaId);
    const itens = venda ? venda.itens || [] : [];
    const tipo = document.querySelector('input[name="devTrocaTipo"]:checked').value;
    _devTrocaEstado = (document.querySelector('input[name="devTrocaEstado"]:checked') || {}).value || 'perfeito';

    // ── Identificação da venda original e taxa configurada ──
    const vendaFoiCrediario = venda && venda.formaPagamento === 'crediario';
    const taxa = parseFloat(DB.Config.get('taxaCrediario', 10)) || 10;
    const fator = 1 + taxa / 100;

    // totalDev = quanto o cliente REALMENTE pagou pelos itens devolvidos
    let totalDev = 0;
    let countItens = 0;
    const itensSel = [];
    itens.forEach((item, idx) => {
      const cb = document.getElementById(`devItem${idx}`);
      if (cb && cb.checked) {
        const qtd = parseInt(document.getElementById(`devQtd${idx}`).value) || 1;
        const precoBase = item.precoUnitario || 0;
        const precoEfetivo = vendaFoiCrediario ? precoBase * fator : precoBase;
        const sub = Math.round(precoEfetivo * qtd * 100) / 100;
        totalDev += sub;
        countItens += qtd;
        itensSel.push({ nome: item.nome, tamanho: item.tamanho, qtd, precoBase, precoEfetivo, sub });
      }
    });

    const resumo = document.getElementById('devTrocaResumo');
    if (countItens === 0) { resumo.style.display = 'none'; return; }

    if (tipo === 'devolucao') {
      const formaReemb = document.getElementById('devTrocaFormaReembolso').value;
      const formaLabels = { dinheiro: 'Dinheiro', pix: 'PIX', credito_loja: 'Crédito na Loja' };
      const notaCrediario = vendaFoiCrediario
        ? `<div style="font-size:11px;color:var(--warning);margin-top:2px">⚠️ Inclui ${taxa}% de acréscimo (compra original no crediário)</div>` : '';
      resumo.style.display = '';
      resumo.innerHTML = `
        <div style="font-weight:700;margin-bottom:6px">📋 RESUMO DA DEVOLUÇÃO</div>
        <div style="border-top:1px solid var(--border);padding-top:6px">
          ${itensSel.map(i => `
            <div style="display:flex;justify-content:space-between">
              <span>${i.nome}${i.tamanho ? ' · Tam '+i.tamanho.split('||').join(' ') : ''} × ${i.qtd}</span>
              <span>${Utils.moeda(i.sub)}</span>
            </div>
            ${vendaFoiCrediario ? `<div style="font-size:11px;color:var(--text-muted);text-align:right">Preço normal ${Utils.moeda(i.precoBase)} + ${taxa}% = ${Utils.moeda(i.precoEfetivo)}</div>` : ''}`).join('')}
        </div>
        <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px">
          <div style="display:flex;justify-content:space-between"><span>Estado:</span><span style="font-weight:600;color:${_devTrocaEstado === 'perfeito' ? 'var(--success)' : 'var(--danger)'}">${_devTrocaEstado === 'perfeito' ? '✅ Perfeito — volta ao estoque' : '⚠️ Defeito — NÃO volta ao estoque'}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:4px"><span>Total a reembolsar:</span><span style="color:var(--danger)">${Utils.moeda(totalDev)}</span></div>
          ${notaCrediario}
          <div style="display:flex;justify-content:space-between"><span>Forma:</span><span>${formaLabels[formaReemb] || formaReemb}</span></div>
        </div>`;
      return;
    }

    // ── Troca ──
    if (!_devTrocaNovoItem) {
      resumo.style.display = '';
      resumo.innerHTML = `Devolvendo: <strong>${Utils.moeda(totalDev)}</strong> · <span class="text-muted">Selecione o novo item acima</span>`;
      return;
    }

    const formaDif = document.getElementById('devTrocaFormaDiferenca').value;
    const precoNormalNovo = _devTrocaNovoItem.precoUnitario || 0;
    // Valor que o cliente vai pagar pelo produto novo (com ou sem 7% conforme forma)
    const valorAPagarNovo = formaDif === 'crediario'
      ? Math.round(precoNormalNovo * fator * 100) / 100
      : precoNormalNovo;
    // Diferença final = o que vai pagar pelo novo - o que já pagou pelo devolvido
    const diffFinal = Math.round((valorAPagarNovo - totalDev) * 100) / 100;

    // Acréscimo a mostrar explicitamente só quando forma = crediário E venda original NÃO foi crediário
    const acrescimoExplicito = formaDif === 'crediario' && !vendaFoiCrediario
      ? Math.round(precoNormalNovo * (taxa / 100) * 100) / 100 : 0;

    const numParc = parseInt(document.getElementById('devTrocaCredParcelas').value) || 1;
    const vencCred = document.getElementById('devTrocaCredVenc').value;

    const diffColor = diffFinal > 0 ? 'var(--danger)' : diffFinal < 0 ? 'var(--success)' : 'var(--text)';
    const diffLabel = diffFinal > 0 ? 'Total a pagar pelo cliente' : diffFinal < 0 ? 'Total a devolver ao cliente' : 'Mesmo valor ✓';

    const formaLabels2 = { dinheiro: '💵 Dinheiro', pix: '📱 PIX', cartao_credito: '💳 Cartão Crédito', cartao_debito: '💳 Cartão Débito', crediario: '📋 Crediário' };

    const estoqueDevol = _devTrocaEstado === 'perfeito'
      ? `<div style="display:flex;justify-content:space-between"><span>• ${itensSel.map(i=>i.nome).join(', ')} (devolvido):</span><span style="color:var(--success)">+${countItens} un</span></div>`
      : `<div style="display:flex;justify-content:space-between"><span>• ${itensSel.map(i=>i.nome).join(', ')} (defeito):</span><span style="color:var(--warning)">sem alteração</span></div>`;

    // Nota sobre 7% conforme os 4 casos
    let notaCrediarioHtml = '';
    if (formaDif === 'crediario' && vendaFoiCrediario) {
      notaCrediarioHtml = `<div style="font-size:11px;color:var(--warning);margin-top:4px">⚠️ ${taxa}% NÃO cobrado novamente — já estava na compra original (crediário)</div>`;
    } else if (formaDif === 'crediario' && !vendaFoiCrediario) {
      notaCrediarioHtml = `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Preço normal do novo (${Utils.moeda(precoNormalNovo)}) + ${taxa}% = ${Utils.moeda(valorAPagarNovo)}</div>`;
    } else if (formaDif !== 'crediario' && vendaFoiCrediario) {
      notaCrediarioHtml = `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">Compra original foi crediário (${taxa}% já pago). Novo item cobrado em ${formaLabels2[formaDif]||formaDif} sem acréscimo.</div>`;
    }

    const credParcsHtml = formaDif === 'crediario' && diffFinal > 0 ? `
      <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px">
        <div style="font-weight:600;margin-bottom:4px">📋 IMPACTO NO CREDIÁRIO:</div>
        <div>Adicionar ${numParc}x de ${Utils.moeda(Math.abs(diffFinal) / numParc)} vencendo a partir de ${vencCred ? Utils.data(vencCred) : '—'}</div>
      </div>` : '';

    resumo.style.display = '';
    resumo.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">📋 RESUMO DA TROCA</div>
      <div style="border-top:1px solid var(--border);padding-top:6px">
        <div style="display:flex;justify-content:space-between">
          <span>Produto devolvido:</span>
          <span>${itensSel.map(i=>`${i.nome}${i.tamanho?' · Tam '+i.tamanho.split('||').join(' '):''}`).join(' / ')} — ${Utils.moeda(totalDev)}${vendaFoiCrediario ? ` <span style="font-size:11px;color:var(--text-muted)">(c/ ${taxa}%)</span>` : ''}</span>
        </div>
        <div style="display:flex;justify-content:space-between"><span>Estado:</span><span style="color:${_devTrocaEstado==='perfeito'?'var(--success)':'var(--danger)'}">${_devTrocaEstado==='perfeito'?'✅ Perfeito':'⚠️ Defeito'}</span></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span>Produto novo:</span>
          <span>${_devTrocaNovoItem.nome}${_devTrocaNovoItem.tamanho?' · Tam '+_devTrocaNovoItem.tamanho.split('||').join(' '):''} — ${Utils.moeda(valorAPagarNovo)}${formaDif==='crediario'?` <span style="font-size:11px;color:var(--text-muted)">(c/ ${taxa}%)</span>`:''}</span>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px">
        ${acrescimoExplicito > 0 ? `
          <div style="display:flex;justify-content:space-between"><span>Preço normal do novo:</span><span>${Utils.moeda(precoNormalNovo)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Acréscimo crediário (${taxa}%):</span><span style="color:var(--warning)">+ ${Utils.moeda(acrescimoExplicito)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Valor do novo no crediário:</span><span>${Utils.moeda(valorAPagarNovo)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>Crédito do devolvido:</span><span>− ${Utils.moeda(totalDev)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:4px"><span>${diffLabel}:</span><span style="color:${diffColor}">${Utils.moeda(Math.abs(diffFinal))}</span></div>
        ${notaCrediarioHtml}
        <div style="display:flex;justify-content:space-between"><span>Forma:</span><span>${formaLabels2[formaDif] || formaDif}</span></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:6px;margin-top:6px">
        <div style="font-weight:600;margin-bottom:4px">📦 IMPACTO NO ESTOQUE:</div>
        ${estoqueDevol}
        <div style="display:flex;justify-content:space-between"><span>• ${_devTrocaNovoItem.nome}${_devTrocaNovoItem.tamanho?' Tam '+_devTrocaNovoItem.tamanho.split('||').join(' '):''} (saída):</span><span style="color:var(--danger)">−1 un</span></div>
      </div>
      ${credParcsHtml}`;
  },

  confirmarDevTroca: () => {
    if (!_devTrocaAtual) return;
    const venda = DB.Vendas.buscar(_devTrocaAtual.vendaId);
    if (!venda) return;

    const itens = venda.itens || [];
    const tipo = document.querySelector('input[name="devTrocaTipo"]:checked').value;
    const formaReembolso = document.getElementById('devTrocaFormaReembolso').value;
    const estadoProd = (document.querySelector('input[name="devTrocaEstado"]:checked') || {}).value || 'perfeito';
    const estadoObs = (document.getElementById('devTrocaEstadoObs').value || '').trim();

    const itensDev = [];
    itens.forEach((item, idx) => {
      const cb = document.getElementById(`devItem${idx}`);
      if (cb && cb.checked) {
        const qtd = Math.min(parseInt(document.getElementById(`devQtd${idx}`).value) || 1, item.quantidade || 1);
        itensDev.push({ idx, nome: item.nome, tamanho: item.tamanho, qtd, precoUnitario: item.precoUnitario || 0, produtoId: item.produtoId });
      }
    });

    if (itensDev.length === 0) { Utils.toast('Selecione ao menos um item', 'warning'); return; }
    if (tipo === 'troca' && !_devTrocaNovoItem) { Utils.toast('Selecione o novo produto/tamanho para troca', 'warning'); return; }

    // Verificar estoque do produto novo ANTES de qualquer alteração
    if (tipo === 'troca' && _devTrocaNovoItem) {
      const prodNovo = DB.Produtos.buscar(_devTrocaNovoItem.produtoId);
      const tamNovo = _devTrocaNovoItem.tamanho || '';
      const estoqueNovo = tamNovo
        ? ((prodNovo && prodNovo.variacoes) ? (prodNovo.variacoes[tamNovo] || 0) : 0)
        : DB.Produtos.estoqueTotal(prodNovo);
      if (estoqueNovo <= 0) {
        Utils.toast(`⚠️ ${_devTrocaNovoItem.nome}${tamNovo ? ' tamanho ' + tamNovo : ''} não tem em estoque. Cadastre o estoque antes de fazer a troca.`, 'error');
        console.warn('[TROCA] Bloqueado: produto novo sem estoque —', _devTrocaNovoItem);
        return;
      }
    }

    // ── Identificação da venda original (nunca cobrar 7% duas vezes) ──
    const vendaFoiCrediario = venda.formaPagamento === 'crediario';
    const taxa = parseFloat(DB.Config.get('taxaCrediario', 10)) || 10;
    const fator = 1 + taxa / 100;
    const formaDif = tipo === 'troca' ? document.getElementById('devTrocaFormaDiferenca').value : formaReembolso;

    console.log('[TROCA-CALC] Venda original foi:', vendaFoiCrediario ? 'crediário' : 'à vista');
    console.log('[TROCA-CALC] Taxa configurada:', taxa, '%');

    // valorDevolvido = quanto o cliente realmente pagou pelos itens devolvidos
    const valorDevolvido = Math.round(
      itensDev.reduce((s, i) => {
        const precoEfetivo = vendaFoiCrediario ? i.precoUnitario * fator : i.precoUnitario;
        console.log('[TROCA-CALC] Preço normal devolvido:', i.precoUnitario, '— Valor pago devolvido:', Math.round(precoEfetivo * i.qtd * 100) / 100);
        return s + precoEfetivo * i.qtd;
      }, 0) * 100) / 100;

    // Preço normal do produto novo (sem acréscimo — sempre base)
    const precoNormalNovo = tipo === 'troca' ? (_devTrocaNovoItem.precoUnitario || 0) : 0;
    // Valor que o cliente vai pagar pelo novo conforme forma de pagamento
    const valorAPagarNovo = tipo === 'troca'
      ? (formaDif === 'crediario' ? Math.round(precoNormalNovo * fator * 100) / 100 : precoNormalNovo)
      : 0;
    // Acréscimo explícito: só existe quando forma = crediário E venda original NÃO foi crediário
    const acrescimo = tipo === 'troca' && formaDif === 'crediario' && !vendaFoiCrediario
      ? Math.round(precoNormalNovo * (taxa / 100) * 100) / 100 : 0;
    // Diferença final = o que vai pagar pelo novo - o que já pagou pelo devolvido
    const diferenca = Math.round((valorAPagarNovo - valorDevolvido) * 100) / 100;

    console.log('[TROCA-CALC] Forma diferença:', formaDif);
    console.log('[TROCA-CALC] Preço normal novo:', precoNormalNovo);
    console.log('[TROCA-CALC] Valor a pagar novo:', valorAPagarNovo);
    console.log('[TROCA-CALC] Valor pago devolvido (total):', valorDevolvido);
    console.log('[TROCA-CALC] Diferença final:', diferenca, '| Acréscimo explícito:', acrescimo);
    console.log('[TROCA] Iniciando —', { tipo, estadoProd, vendaFoiCrediario, valorDevolvido, valorAPagarNovo, diferenca, formaDif });

    // 1. Estoque: produto devolvido volta ao estoque só se "perfeito"
    itensDev.forEach(d => {
      const itemOriginal = itens[d.idx];
      if (itemOriginal && itemOriginal.produtoId) {
        if (estadoProd === 'perfeito') {
          DB.Produtos.atualizarEstoque(itemOriginal.produtoId, d.tamanho || '', d.qtd);
          console.log('[TROCA] Estoque restaurado —', itemOriginal.produtoId, d.tamanho, '+' + d.qtd);
        } else {
          console.log('[TROCA] Produto com defeito — estoque NÃO restaurado —', itemOriginal.produtoId);
        }
      }
    });

    // 2. Estoque: produto novo sai
    if (tipo === 'troca' && _devTrocaNovoItem) {
      DB.Produtos.atualizarEstoque(_devTrocaNovoItem.produtoId, _devTrocaNovoItem.tamanho || '', -1);
      console.log('[TROCA] Estoque descontado —', _devTrocaNovoItem.produtoId, _devTrocaNovoItem.tamanho, '-1');
    }

    // 3. Crediário da diferença (apenas troca com forma crediário e diff positiva)
    if (tipo === 'troca' && formaDif === 'crediario' && diferenca > 0) {
      const numParc = Math.max(1, parseInt(document.getElementById('devTrocaCredParcelas').value) || 1);
      const venc1 = document.getElementById('devTrocaCredVenc').value || Utils.adicionarMeses(Utils.hoje(), 1);
      const valorParc = parseFloat((diferenca / numParc).toFixed(2));

      // Busca crediário existente da venda original
      let credExistente = null;
      if (venda.clienteId) {
        const creds = DB.Crediario.listar().filter(c => c.vendaId === venda.id);
        if (creds.length > 0) credExistente = DB.Crediario.buscar(creds[0].id);
      }

      if (credExistente) {
        // Adiciona parcelas ao crediário existente
        const baseNum = credExistente.parcelas.length;
        let soma = 0;
        for (let i = 0; i < numParc; i++) {
          const isUltima = i === numParc - 1;
          const val = isUltima ? parseFloat((diferenca - soma).toFixed(2)) : valorParc;
          soma += val;
          credExistente.parcelas.push({
            numero: baseNum + i + 1,
            vencimento: Utils.adicionarMeses(venc1, i),
            valor: val,
            status: 'pendente',
            observacao: 'Adicionada por troca'
          });
        }
        credExistente.total = (credExistente.total || 0) + diferenca;
        DB.Crediario.salvar(credExistente);
        console.log('[TROCA] Parcelas adicionadas ao crediário existente —', credExistente.id, numParc, 'parcelas');
      } else if (venda.clienteId) {
        // Cria novo crediário
        const parcelas = [];
        let soma = 0;
        for (let i = 0; i < numParc; i++) {
          const isUltima = i === numParc - 1;
          const val = isUltima ? parseFloat((diferenca - soma).toFixed(2)) : valorParc;
          soma += val;
          parcelas.push({
            numero: i + 1,
            vencimento: Utils.adicionarMeses(venc1, i),
            valor: val,
            status: 'pendente',
            observacao: 'Gerada por troca'
          });
        }
        DB.Crediario.salvar({
          clienteId: venda.clienteId,
          clienteNome: venda.clienteNome,
          vendaId: venda.id,
          total: diferenca,
          parcelas,
          origem: 'troca'
        });
        console.log('[TROCA] Novo crediário criado para diferença —', venda.clienteId, numParc, 'parcelas');
      } else {
        Utils.toast('Cliente não vinculado — diferença em crediário não foi registrada', 'warning');
        console.warn('[TROCA] Crediário não criado: venda sem clienteId');
      }
    }

    // 4. Atualizar histórico: substituir item na venda (guarda trocaDe)
    if (tipo === 'troca' && _devTrocaNovoItem) {
      itensDev.forEach(d => {
        const itemOrig = venda.itens[d.idx];
        if (!itemOrig) return;
        const trocaDe = {
          produtoId: itemOrig.produtoId,
          nome: itemOrig.nome,
          tamanho: itemOrig.tamanho,
          precoUnitario: itemOrig.precoUnitario,
          dataTroca: new Date().toISOString()
        };
        venda.itens[d.idx] = {
          ...itemOrig,
          produtoId: _devTrocaNovoItem.produtoId,
          nome: _devTrocaNovoItem.nome,
          tamanho: _devTrocaNovoItem.tamanho,
          precoUnitario: _devTrocaNovoItem.precoUnitario,
          total: _devTrocaNovoItem.precoUnitario * (itemOrig.quantidade || 1),
          trocaDe
        };
      });
      // Recalcular subtotal e total da venda
      const novoSubtotal = Math.round(venda.itens.reduce((s, i) => s + (i.total || 0), 0) * 100) / 100;
      venda.subtotal = novoSubtotal;
      if (vendaFoiCrediario) {
        // Recalcula acréscimo crediário com base no novo subtotal
        const novoAcrescimo = Math.round(novoSubtotal * (taxa / 100) * 100) / 100;
        venda.acrescimoCrediario = { pct: taxa, valor: novoAcrescimo };
        venda.total = Math.round((novoSubtotal + novoAcrescimo) * 100) / 100;
        console.log('[TROCA] AcrescimoCrediario recalculado — subtotal:', novoSubtotal, '| acrescimo:', novoAcrescimo, '| total:', venda.total);
      } else {
        venda.total = novoSubtotal;
      }
      console.log('[TROCA] Itens da venda atualizados — novo subtotal:', venda.subtotal);
    }

    // 5. Registrar devolução na venda
    venda.devolucoes = venda.devolucoes || [];
    venda.devolucoes.push({
      data: new Date().toISOString(),
      tipo,
      formaReembolso: tipo === 'devolucao' ? formaReembolso : formaDif,
      itens: itensDev,
      valorDevolvido,
      estado: estadoProd,
      observacao: estadoObs || null,
      novoItem: tipo === 'troca' ? _devTrocaNovoItem : null,
      diferenca: tipo === 'troca' ? diferenca : null
    });
    DB.Vendas.salvar(venda);
    console.log('[TROCA] Devolução registrada na venda —', venda.id);

    // 6. Registrar no fluxo de caixa
    if (tipo === 'devolucao' && formaReembolso !== 'credito_loja') {
      DB.FluxoCaixa.salvar({
        tipo: 'saida',
        descricao: `Devolução - Venda #${(venda.id || '').substring(0, 8).toUpperCase()}${venda.clienteNome ? ' - ' + venda.clienteNome : ''}`,
        valor: valorDevolvido,
        categoria: 'devolucao'
      });
    }
    if (tipo === 'troca' && diferenca < 0) {
      // Loja deve devolver dinheiro (novo mais barato que devolvido)
      DB.FluxoCaixa.salvar({
        tipo: 'saida',
        descricao: `Troca - Venda #${(venda.id || '').substring(0, 8).toUpperCase()} - devolução diferença`,
        valor: Math.abs(diferenca),
        categoria: 'devolucao'
      });
    }

    Utils.fecharModal('modalDevTroca');
    Historico.render();

    Historico.imprimirDevTroca(venda, itensDev, tipo, tipo === 'devolucao' ? formaReembolso : formaDif, valorDevolvido, _devTrocaNovoItem, diferenca, acrescimo, taxa, estadoProd);

    Utils.toast(tipo === 'devolucao'
      ? `Devolução de ${Utils.moeda(valorDevolvido)} registrada!`
      : `Troca efetuada!`, 'success');
    _devTrocaAtual = null;
    _devTrocaNovoItem = null;
  },

  imprimirDevTroca: (venda, itensDev, tipo, formaReembolso, valorDevolvido, novoItem, diferenca, acrescimo, taxa, estadoProd) => {
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const formas = { dinheiro: 'Dinheiro', pix: 'PIX', credito_loja: 'Crédito na Loja', cartao_credito: 'Cartão Crédito', cartao_debito: 'Cartão Débito', crediario: 'Crediário' };
    const titulo = tipo === 'devolucao' ? 'COMPROVANTE DE DEVOLUÇÃO' : 'COMPROVANTE DE TROCA';

    const linhasItens = itensDev.map(i =>
      `  ${i.nome}${i.tamanho ? ' Tam.'+i.tamanho.split('||').join(' ') : ''}\n  ${i.qtd}x ${Utils.moeda(i.precoUnitario)} = ${Utils.moeda(i.precoUnitario * i.qtd)}`
    ).join('\n');

    const estadoLinha = estadoProd === 'defeito' ? '\n  Estado: COM DEFEITO (não voltou ao estoque)' : '\n  Estado: Perfeito (voltou ao estoque)';

    const novoItemLinha = novoItem
      ? `\nNOVO ITEM:\n  ${novoItem.nome}${novoItem.tamanho ? ' Tam.'+novoItem.tamanho.split('||').join(' ') : ''} = ${Utils.moeda(novoItem.precoUnitario)}`
      : '';

    let diferencaLinha = '';
    if (novoItem && diferenca !== 0) {
      const diffBase = diferenca - (acrescimo || 0);
      diferencaLinha = `\nDiferença base: ${Utils.moeda(diffBase)}`;
      if (acrescimo > 0) diferencaLinha += `\nAcréscimo crediário (${taxa || 10}%): ${Utils.moeda(acrescimo)}`;
      diferencaLinha += `\n${diferenca > 0 ? `VALOR COBRADO DO CLIENTE: ${Utils.moeda(diferenca)}` : `VALOR DEVOLVIDO AO CLIENTE: ${Utils.moeda(-diferenca)}` }`;
      diferencaLinha += `\nForma: ${formas[formaReembolso] || formaReembolso}`;
    } else if (novoItem) {
      diferencaLinha = '\nMESMO VALOR — sem diferença';
    }

    const texto = `
${linhaH}
         MOVE PÉ CALÇADOS
         ${titulo}
${linhaH}
Data: ${dataStr}
Venda Orig.: #${(venda.id || '').toUpperCase().substring(0, 8)}
${venda.clienteNome ? `Cliente: ${venda.clienteNome}` : ''}
${linhaL}
ITENS DEVOLVIDOS:
${linhasItens}${estadoLinha}
${novoItemLinha}
${linhaL}
${tipo === 'devolucao'
  ? `VALOR REEMBOLSADO: ${Utils.moeda(valorDevolvido)}\nForma: ${formas[formaReembolso] || formaReembolso}`
  : `TROCA EFETUADA${diferencaLinha}\n\nAssinatura: _____________________`}
${linhaH}
    Obrigado pela preferência!
         MOVE PÉ CALÇADOS
${linhaH}
`.trim();

    Utils.imprimirComprovante(texto);
  }
};

document.addEventListener('DOMContentLoaded', Historico.init);
document.addEventListener('movePe-sync', () => Historico.render());
