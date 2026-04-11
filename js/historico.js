/**
 * MOVE PÉ - Histórico de Vendas v2.0
 */

let _buscaHist = '';
let _dataInicio = '';
let _dataFim = '';
let _devTrocaAtual = null;
let _devTrocaNovoItem = null; // { produtoId, nome, tamanho, precoUnitario }

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
    let vendas = DB.Vendas.listar()
      .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));

    if (_dataInicio) vendas = vendas.filter(v => (v.criadoEm || '') >= _dataInicio);
    if (_dataFim) vendas = vendas.filter(v => (v.criadoEm || '').substring(0, 10) <= _dataFim);

    if (_buscaHist.trim()) {
      const t = _buscaHist.toLowerCase();
      vendas = vendas.filter(v => {
        const idMatch = (v.id || '').toLowerCase().includes(t);
        const clienteMatch = (v.clienteNome || '').toLowerCase().includes(t);
        const itemMatch = (v.itens || []).some(i => (i.nome || '').toLowerCase().includes(t));
        return idMatch || clienteMatch || itemMatch;
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
    let ini = '', fim = Utils.hoje();

    if (periodo === 'hoje') {
      ini = Utils.hoje();
    } else if (periodo === 'semana') {
      const d = new Date(hoje);
      d.setDate(d.getDate() - d.getDay());
      ini = d.toISOString().substring(0, 10);
    } else if (periodo === 'mes') {
      ini = Utils.hoje().substring(0, 7) + '-01';
    } else if (periodo === 'mes_passado') {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const df = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      ini = d.toISOString().substring(0, 10);
      fim = df.toISOString().substring(0, 10);
    }

    _dataInicio = ini;
    _dataFim = fim;
    document.getElementById('inputDataInicio').value = ini;
    document.getElementById('inputDataFim').value = fim;
    Historico.render();
  },

  imprimirRelatorio: () => {
    let vendas = DB.Vendas.listar()
      .sort((a, b) => new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0));

    if (_dataInicio) vendas = vendas.filter(v => (v.criadoEm || '') >= _dataInicio);
    if (_dataFim) vendas = vendas.filter(v => (v.criadoEm || '').substring(0, 10) <= _dataFim);
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
    vendas.forEach(v => { if (totais[v.formaPagamento] !== undefined) totais[v.formaPagamento] += parseFloat(v.total) || 0; });

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

    // Reset tipo e reembolso
    document.querySelector('input[name="devTrocaTipo"][value="devolucao"]').checked = true;
    document.getElementById('devTrocaReembolsoSecao').style.display = '';
    document.getElementById('devTrocaResumo').style.display = 'none';

    Utils.abrirModal('modalDevTroca');
  },

  devTrocaToggle: (idx) => {
    const cb = document.getElementById(`devItem${idx}`);
    const qtdInput = document.getElementById(`devQtd${idx}`);
    qtdInput.disabled = !cb.checked;
    if (cb.checked) qtdInput.focus();
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
      // Pré-busca com produto do item devolvido
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
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaLimparNovoItem: () => {
    _devTrocaNovoItem = null;
    document.getElementById('devTrocaNovoItemSel').style.display = 'none';
    Historico.devTrocaAtualizarResumo();
  },

  devTrocaAtualizarResumo: () => {
    if (!_devTrocaAtual) return;
    const venda = DB.Vendas.buscar(_devTrocaAtual.vendaId);
    const itens = venda ? venda.itens || [] : [];
    const tipo = document.querySelector('input[name="devTrocaTipo"]:checked').value;

    let totalDev = 0;
    let countItens = 0;
    itens.forEach((item, idx) => {
      const cb = document.getElementById(`devItem${idx}`);
      if (cb && cb.checked) {
        const qtd = parseInt(document.getElementById(`devQtd${idx}`).value) || 1;
        totalDev += (item.precoUnitario || 0) * qtd;
        countItens += qtd;
      }
    });

    const resumo = document.getElementById('devTrocaResumo');
    if (countItens === 0) { resumo.style.display = 'none'; return; }

    resumo.style.display = '';
    if (tipo === 'devolucao') {
      resumo.innerHTML = `<strong>${countItens} item(s)</strong> · Reembolso: <strong style="color:var(--danger)">${Utils.moeda(totalDev)}</strong>`;
    } else {
      const novoVal = _devTrocaNovoItem ? _devTrocaNovoItem.precoUnitario : 0;
      const diff = novoVal - totalDev;
      const diffHtml = novoVal > 0
        ? diff > 0
          ? ` · <span style="color:var(--danger)">Cliente paga mais: ${Utils.moeda(diff)}</span>`
          : diff < 0
            ? ` · <span style="color:var(--success)">Loja devolve: ${Utils.moeda(-diff)}</span>`
            : ` · <span style="color:var(--success)">Mesmo valor ✓</span>`
        : '';
      resumo.innerHTML = `Devolvendo: <strong>${Utils.moeda(totalDev)}</strong>${_devTrocaNovoItem ? ` → Novo: <strong>${Utils.moeda(novoVal)}</strong>${diffHtml}` : ' · <span class="text-muted">Selecione o novo item acima</span>'}`;
    }
  },

  confirmarDevTroca: () => {
    if (!_devTrocaAtual) return;
    const venda = DB.Vendas.buscar(_devTrocaAtual.vendaId);
    if (!venda) return;

    const itens = venda.itens || [];
    const tipo = document.querySelector('input[name="devTrocaTipo"]:checked').value;
    const formaReembolso = document.getElementById('devTrocaFormaReembolso').value;

    const itensDev = [];
    itens.forEach((item, idx) => {
      const cb = document.getElementById(`devItem${idx}`);
      if (cb && cb.checked) {
        const qtd = Math.min(parseInt(document.getElementById(`devQtd${idx}`).value) || 1, item.quantidade || 1);
        itensDev.push({ idx, nome: item.nome, tamanho: item.tamanho, qtd, precoUnitario: item.precoUnitario || 0 });
      }
    });

    if (itensDev.length === 0) { Utils.toast('Selecione ao menos um item', 'warning'); return; }
    if (tipo === 'troca' && !_devTrocaNovoItem) { Utils.toast('Selecione o novo produto/tamanho para troca', 'warning'); return; }

    const valorDevolvido = itensDev.reduce((s, i) => s + i.precoUnitario * i.qtd, 0);
    const valorNovoItem = tipo === 'troca' ? (_devTrocaNovoItem.precoUnitario || 0) : 0;
    const diferenca = valorNovoItem - valorDevolvido;

    // Restaurar estoque dos itens devolvidos
    itensDev.forEach(d => {
      const itemOriginal = itens[d.idx];
      if (itemOriginal && itemOriginal.produtoId) {
        DB.Produtos.atualizarEstoque(itemOriginal.produtoId, d.tamanho || '', d.qtd);
      }
    });

    // Descontar estoque do novo item (troca)
    if (tipo === 'troca' && _devTrocaNovoItem) {
      DB.Produtos.atualizarEstoque(_devTrocaNovoItem.produtoId, _devTrocaNovoItem.tamanho || '', -1);
    }

    // Registrar devolução na venda
    venda.devolucoes = venda.devolucoes || [];
    venda.devolucoes.push({
      data: new Date().toISOString(),
      tipo,
      formaReembolso: tipo === 'devolucao' ? formaReembolso : 'vale_troca',
      itens: itensDev,
      valorDevolvido
    });
    DB.Vendas.salvar(venda);

    // Registrar no fluxo de caixa
    if (tipo === 'devolucao' && formaReembolso !== 'credito_loja') {
      DB.FluxoCaixa.salvar({
        tipo: 'saida',
        descricao: `Devolução - Venda #${(venda.id || '').substring(0, 8).toUpperCase()}${venda.clienteNome ? ' - ' + venda.clienteNome : ''}`,
        valor: valorDevolvido,
        categoria: 'devolucao'
      });
    }

    Utils.fecharModal('modalDevTroca');
    Historico.render();

    // Imprimir comprovante
    Historico.imprimirDevTroca(venda, itensDev, tipo, formaReembolso, valorDevolvido, _devTrocaNovoItem, diferenca);

    Utils.toast(tipo === 'devolucao'
      ? `Devolução de ${Utils.moeda(valorDevolvido)} registrada!`
      : `Vale-troca de ${Utils.moeda(valorDevolvido)} gerado!`, 'success');
    _devTrocaAtual = null;
  },

  imprimirDevTroca: (venda, itensDev, tipo, formaReembolso, valorDevolvido, novoItem, diferenca) => {
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const agora = new Date();
    const dataStr = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const formas = { dinheiro: 'Dinheiro', pix: 'PIX', credito_loja: 'Crédito na Loja', vale_troca: 'Vale-Troca' };
    const titulo = tipo === 'devolucao' ? 'COMPROVANTE DE DEVOLUÇÃO' : 'VALE-TROCA';

    const linhasItens = itensDev.map(i =>
      `  ${i.nome}${i.tamanho ? ' Tam.'+i.tamanho.split('||').join(' ') : ''}\n  ${i.qtd}x ${Utils.moeda(i.precoUnitario)} = ${Utils.moeda(i.precoUnitario * i.qtd)}`
    ).join('\n');

    const novoItemLinha = novoItem
      ? `\nNOVO ITEM:\n  ${novoItem.nome}${novoItem.tamanho ? ' Tam.'+novoItem.tamanho.split('||').join(' ') : ''} = ${Utils.moeda(novoItem.precoUnitario)}`
      : '';

    const diferencaLinha = novoItem && diferenca !== 0
      ? `\n${diferenca > 0 ? `VALOR ADICIONAL COBRADO: ${Utils.moeda(diferenca)}` : `VALOR DEVOLVIDO AO CLIENTE: ${Utils.moeda(-diferenca)}`}`
      : '';

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
${linhasItens}
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
