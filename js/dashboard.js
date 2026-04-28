/**
 * MOVE PÉ - Dashboard v2.0
 */

const Dashboard = {

  init: () => {
    Utils.renderNav('dashboard.html');
    Dashboard.render();
    Dashboard.verificarBackup();
    // Auto-refresh a cada 60s
    setInterval(Dashboard.render, 60000);
  },

  verificarBackup: () => {
    const ultimo = DB.ultimoBackup();
    const banner = document.getElementById('backupBanner');
    const titulo = document.getElementById('backupBannerTitulo');
    if (!banner || !titulo) return;

    if (!ultimo) {
      titulo.textContent = 'Nenhum backup local realizado ainda — recomendamos baixar agora!';
      banner.style.display = 'flex';
      return;
    }

    const dias = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
    if (dias >= 7) {
      titulo.textContent = `Backup local há ${dias} dia${dias > 1 ? 's' : ''} — clique para baixar uma cópia atualizada.`;
      banner.style.display = 'flex';
    }
  },

  fazerBackup: () => {
    DB.exportar();
    document.getElementById('backupBanner').style.display = 'none';
    Utils.toast('Backup baixado com sucesso!', 'success');
  },

  render: () => {
    Dashboard.renderStats();
    Dashboard.renderStats2();
    Dashboard.renderAtalhos();
    Dashboard.renderMeta();
    Dashboard.renderTermometroCrediario();
    Dashboard.renderSaudeFinanceira();
    Dashboard.renderFluxo30Dias();
    Dashboard.renderEstoqueParado();
    Dashboard.renderGrafico6Meses();
    Dashboard.renderGrafico7Dias();
    Dashboard.renderTop5();
    Dashboard.renderAlertas();
    Dashboard.renderEstoqueBaixo();
    Dashboard.renderAniversariantes();
    Dashboard.renderPgtoHoje();
    Dashboard.renderVencimentos7Dias();
    Dashboard.renderUltimasVendas();
  },

  renderStats: () => {
    const hoje = Utils.hoje();
    const mesAtual = hoje.substring(0, 7);

    const vendasHoje = DB.Vendas.listarHoje();
    const totalHoje = vendasHoje.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    const vendasMes = DB.Vendas.listarPorPeriodo(mesAtual + '-01', hoje);
    const totalMes = vendasMes.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    const prods = DB.Produtos.listarAtivos();
    const estoqueBaixo = prods.filter(p => { const mn = p.estoqueMinimo != null ? p.estoqueMinimo : 3; return mn > 0 && DB.Produtos.estoqueTotal(p) <= mn; }).length;

    const inadimplentes = DB.Crediario.inadimplentes();
    const totalInad = inadimplentes.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
    const clientesInad = [...new Set(inadimplentes.map(i => i.clienteNome))].length;

    document.getElementById('statVendasHoje').textContent = Utils.moeda(totalHoje);
    document.getElementById('statQtdHoje').textContent = vendasHoje.length + ' venda(s)';
    document.getElementById('statFaturamentoMes').textContent = Utils.moeda(totalMes);
    document.getElementById('statQtdMes').textContent = vendasMes.length + ' venda(s)';

    // Comparação com mês passado
    const dMesPassado = new Date();
    dMesPassado.setMonth(dMesPassado.getMonth() - 1);
    const mpStr = `${dMesPassado.getFullYear()}-${String(dMesPassado.getMonth()+1).padStart(2,'0')}`;
    const diasMp = new Date(dMesPassado.getFullYear(), dMesPassado.getMonth() + 1, 0).getDate();
    const vendasMp = DB.Vendas.listarPorPeriodo(mpStr + '-01', mpStr + '-' + String(diasMp).padStart(2,'0'));
    const totalMp = vendasMp.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const elVarMes = document.getElementById('statVarMes');
    if (elVarMes) {
      if (totalMp > 0) {
        const pct = Math.round(((totalMes - totalMp) / totalMp) * 100);
        const cor = pct >= 0 ? 'var(--success)' : 'var(--danger)';
        const seta = pct >= 0 ? '▲' : '▼';
        const nomeMp = dMesPassado.toLocaleDateString('pt-BR', { month: 'long' });
        elVarMes.innerHTML = `<span style="color:${cor};font-weight:700">${seta} ${Math.abs(pct)}% vs ${nomeMp}</span>`;
      } else {
        elVarMes.textContent = '';
      }
    }
    document.getElementById('statEstoqueBaixo').textContent = estoqueBaixo;
    document.getElementById('statInadimplentes').textContent = clientesInad + ' cliente(s)';
    document.getElementById('statTotalInad').textContent = Utils.moeda(totalInad) + ' em atraso';
    const elClientesInad = document.getElementById('statClientesInad');
    if (elClientesInad) elClientesInad.textContent = clientesInad > 0 ? 'Ver Financeiro →' : '';
  },

  renderGrafico6Meses: () => {
    const cont = document.getElementById('grafico6Meses');
    if (!cont) return;

    const dadosMeses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const ano = d.getFullYear();
      const mes = d.getMonth();
      const mesStr = `${ano}-${String(mes+1).padStart(2,'0')}`;
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      const vendas = DB.Vendas.listarPorPeriodo(mesStr + '-01', mesStr + '-' + String(diasNoMes).padStart(2,'0'));
      const total = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
      const labelRaw = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      dadosMeses.push({ label: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1), v: total });
    }

    Utils.renderGraficoBarras('grafico6Meses', dadosMeses);

    // Indicador de variação
    const atual = dadosMeses[5].v;
    const passado = dadosMeses[4].v;
    const el = document.getElementById('variacaoMes6');
    if (!el) return;
    if (passado > 0) {
      const pct = Math.round(((atual - passado) / passado) * 100);
      const cor = pct >= 0 ? 'var(--success)' : 'var(--danger)';
      const seta = pct >= 0 ? '▲' : '▼';
      el.innerHTML = `<span style="color:${cor};font-weight:700">${seta} ${Math.abs(pct)}% vs mês passado</span> <span style="color:var(--text-muted);font-size:11px">(mês em andamento)</span>`;
    } else {
      el.textContent = '';
    }
  },

  renderGrafico7Dias: () => {
    const dados = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Usa data local para não deslocar o dia após 21h
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      const vendas = DB.Vendas.listarPorPeriodo(dateStr, dateStr);
      const total = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
      dados.push({ label, v: total });
    }
    Utils.renderGraficoBarras('grafico7Dias', dados);
  },

  renderTop5: () => {
    const vendas = DB.Vendas.listar();
    const contagem = {};

    vendas.forEach(v => {
      (v.itens || []).forEach(item => {
        const key = item.produtoId;
        if (!contagem[key]) {
          contagem[key] = { nome: item.nome, qtd: 0, total: 0 };
        }
        contagem[key].qtd += item.quantidade || 1;
        contagem[key].total += parseFloat(item.total) || 0;
      });
    });

    const top5 = Object.entries(contagem)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .slice(0, 5);

    const cont = document.getElementById('top5Lista');
    if (top5.length === 0) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhuma venda ainda</div>';
      return;
    }

    cont.innerHTML = top5.map(([, info], idx) => `
      <div class="top5-item">
        <div class="top5-rank">${idx + 1}</div>
        <div class="top5-info">
          <div class="top5-nome">${info.nome}</div>
          <div class="top5-det">${info.qtd} unidade(s) vendida(s)</div>
        </div>
        <div class="top5-val">${Utils.moeda(info.total)}</div>
      </div>`).join('');
  },

  renderMeta: () => {
    const meta = DB.Config.get('metaMensal', 0);
    const card = document.getElementById('cardMetaMes');
    if (!meta || meta <= 0) { card.style.display = 'none'; return; }
    card.style.display = '';

    const hoje = new Date();
    const mesAtual = Utils.hoje().substring(0, 7);
    const vendas = DB.Vendas.listarPorPeriodo(mesAtual + '-01', Utils.hoje());
    const totalMes = vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    const pct = Math.min(100, Math.round((totalMes / meta) * 100));
    const falta = Math.max(0, meta - totalMes);
    const batida = totalMes >= meta;

    // Dias do mês
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diaAtual = hoje.getDate();
    const diasPassados = diaAtual;
    const diasRestantes = diasNoMes - diaAtual;

    const mediaDiaria = diasPassados > 0 ? totalMes / diasPassados : 0;
    const mediaNecessaria = diasRestantes > 0 ? falta / diasRestantes : 0;

    // Cor da barra conforme progresso esperado
    const progressoEsperado = diaAtual / diasNoMes;
    const corBarra = batida ? 'var(--success)'
      : (pct / 100 >= progressoEsperado - 0.05) ? 'var(--primary)' : 'var(--warning)';

    document.getElementById('metaPct').textContent = pct + '%';
    document.getElementById('metaPct').style.color = batida ? 'var(--success)' : 'var(--primary)';
    document.getElementById('metaAtual').textContent = Utils.moeda(totalMes) + ' faturado';
    document.getElementById('metaAlvo').textContent = 'Meta: ' + Utils.moeda(meta);
    document.getElementById('metaBarraFill').style.width = pct + '%';
    document.getElementById('metaBarraFill').style.background = corBarra;
    document.getElementById('metaFalta').textContent = batida ? '✅ Atingida!' : Utils.moeda(falta);
    document.getElementById('metaFalta').style.color = batida ? 'var(--success)' : 'var(--danger)';
    document.getElementById('metaDiasRestantes').textContent = diasRestantes + ' dia' + (diasRestantes !== 1 ? 's' : '');
    document.getElementById('metaMediaNecessaria').textContent = diasRestantes > 0 ? Utils.moeda(mediaNecessaria) + '/dia' : '—';
    document.getElementById('metaMediaAtual').textContent = Utils.moeda(mediaDiaria) + '/dia';
    document.getElementById('metaMsgBatida').style.display = batida ? '' : 'none';
  },

  renderAniversariantes: () => {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaHoje = hoje.getDate();

    const clientes = DB.Clientes.listar().filter(c => c.dataNascimento);
    const aniversariantes = clientes
      .map(c => {
        const [ano, mes, dia] = c.dataNascimento.split('-').map(Number);
        return { ...c, _mes: mes, _dia: dia };
      })
      .filter(c => c._mes === mesAtual)
      .sort((a, b) => a._dia - b._dia);

    const cont = document.getElementById('anivLista');
    const badge = document.getElementById('anivBadge');

    if (aniversariantes.length === 0) {
      badge.style.display = 'none';
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhum aniversariante este mês</div>';
      return;
    }

    badge.style.display = '';
    badge.textContent = aniversariantes.length;

    const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' });

    cont.innerHTML = aniversariantes.slice(0, 6).map(c => {
      const isHoje = c._dia === diaHoje;
      const isFuturo = c._dia > diaHoje;
      const diasRestantes = c._dia - diaHoje;
      const anoAtual = hoje.getFullYear();
      const [anoNasc] = c.dataNascimento.split('-').map(Number);
      // Se o aniversário ainda não chegou neste ano, a idade completa é anoAtual - anoNasc - 1
      const idadeBase = anoAtual - anoNasc;
      const idade = c._dia > diaHoje ? idadeBase - 1 : idadeBase;

      let status, cor;
      if (isHoje) {
        status = '🎂 Hoje!';
        cor = 'var(--primary)';
      } else if (isFuturo) {
        status = `em ${diasRestantes} dia${diasRestantes > 1 ? 's' : ''}`;
        cor = 'var(--text-muted)';
      } else {
        status = `dia ${c._dia}`;
        cor = 'var(--text-muted)';
      }

      return `
        <div class="alert-item" style="${isHoje ? 'background:var(--primary-dim);border-radius:8px;padding:8px;' : ''}">
          <div class="alert-icon">${isHoje ? '🎉' : '🎂'}</div>
          <div class="alert-info">
            <div class="alert-nome" style="${isHoje ? 'color:var(--primary);font-weight:700' : ''}">${c.nome}</div>
            <div class="alert-det">${c.telefone ? Utils.telefone(c.telefone) + ' · ' : ''}${idade} anos</div>
          </div>
          <div style="font-size:12px;font-weight:600;color:${cor};white-space:nowrap">${status}</div>
        </div>`;
    }).join('');

    if (aniversariantes.length > 6) {
      cont.innerHTML += `<div class="text-muted fs-sm" style="padding:8px 16px">+${aniversariantes.length - 6} outros em ${nomeMes}</div>`;
    }
  },

  renderEstoqueBaixo: () => {
    const prods = DB.Produtos.listarAtivos();
    const criticos = prods
      .map(p => ({ ...p, totalEstoque: DB.Produtos.estoqueTotal(p) }))
      .filter(p => { const mn2 = p.estoqueMinimo != null ? p.estoqueMinimo : 3; return mn2 > 0 && p.totalEstoque <= mn2; })
      .sort((a, b) => a.totalEstoque - b.totalEstoque);

    const cont = document.getElementById('estoqueBaixoLista');
    const badge = document.getElementById('estoqueBaixoBadge');

    if (criticos.length === 0) {
      badge.style.display = 'none';
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Todos os produtos com estoque OK</div>';
      return;
    }

    badge.style.display = '';
    badge.textContent = criticos.length;

    cont.innerHTML = criticos.slice(0, 6).map(p => {
      const minimo = p.estoqueMinimo != null ? p.estoqueMinimo : 3;
      const pct = Math.min(100, Math.round((p.totalEstoque / minimo) * 100));
      const cor = p.totalEstoque === 0 ? 'var(--danger)' : 'var(--warning)';
      return `
        <div class="alert-item" style="flex-direction:column;align-items:flex-start;gap:4px">
          <div style="display:flex;width:100%;align-items:center;justify-content:space-between">
            <div>
              <div class="alert-nome">${p.nome}${p.marca ? ' · ' + p.marca : ''}</div>
              <div class="alert-det">Estoque: <strong style="color:${cor}">${p.totalEstoque}</strong> / mín ${minimo}</div>
            </div>
            ${p.totalEstoque === 0 ? '<span style="font-size:11px;font-weight:700;color:var(--danger);background:rgba(239,68,68,0.1);padding:2px 7px;border-radius:10px">ZERADO</span>' : ''}
          </div>
          <div style="width:100%;height:4px;background:var(--border);border-radius:2px">
            <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px;transition:width 0.4s"></div>
          </div>
        </div>`;
    }).join('');

    if (criticos.length > 6) {
      cont.innerHTML += `<div class="text-muted fs-sm" style="padding:8px 16px">+${criticos.length - 6} outros com estoque baixo</div>`;
    }
  },

  renderStats2: () => {
    const hoje = Utils.hoje();
    const vendasHoje = DB.Vendas.listarHoje();
    const totalHoje = vendasHoje.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);

    // Ticket médio
    const ticket = vendasHoje.length > 0 ? totalHoje / vendasHoje.length : 0;
    document.getElementById('statTicketMedio').textContent = Utils.moeda(ticket);
    document.getElementById('statTicketSub').textContent = vendasHoje.length > 0
      ? `média de ${vendasHoje.length} venda(s)` : 'sem vendas hoje';

    // Crediário recebido hoje (usa horário local para não perder lançamentos noturnos)
    const agora = new Date();
    const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
    const inicioHojeLocal = new Date(hojeLocal + 'T00:00:00').toISOString();
    const fimHojeLocal    = new Date(hojeLocal + 'T23:59:59').toISOString();
    const credHoje = DB.FluxoCaixa.listar()
      .filter(f => f.categoria === 'crediario' && f.data && f.data >= inicioHojeLocal && f.data <= fimHojeLocal);
    const totalCredHoje = credHoje.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
    document.getElementById('statCredHoje').textContent = Utils.moeda(totalCredHoje);
    document.getElementById('statCredQtd').textContent = credHoje.length + ' recebimento(s)';

    // Status do caixa
    const caixa = DB.Caixa.buscarAtivo();
    const elCaixaValor = document.getElementById('statCaixaValor');
    const elCaixaSub = document.getElementById('statCaixaSub');
    if (caixa) {
      elCaixaValor.textContent = 'Aberto';
      elCaixaValor.style.color = 'var(--success)';
      elCaixaSub.textContent = caixa.operador ? 'Op: ' + caixa.operador : 'Saldo: ' + Utils.moeda(caixa.saldoInicial || 0);
    } else {
      elCaixaValor.textContent = 'Fechado';
      elCaixaValor.style.color = 'var(--danger)';
      elCaixaSub.textContent = 'Nenhum caixa ativo';
    }

    // Total clientes
    document.getElementById('statTotalClientes').textContent = DB.Clientes.listar().length;
  },

  renderAtalhos: () => {
    const atalhos = [
      { href: 'index.html',          icon: '🛒', label: 'PDV',             cor: '#6366f1' },
      { href: 'caixa.html',          icon: '💰', label: 'Caixa',           cor: '#10b981' },
      { href: 'estoque.html',        icon: '📦', label: 'Estoque',         cor: '#f59e0b' },
      { href: 'clientes.html',       icon: '👥', label: 'Clientes',        cor: '#3b82f6' },
      { href: 'crediario.html',      icon: '💳', label: 'Crediário',       cor: '#ec4899' },
      { href: 'historico.html',      icon: '🕐', label: 'Histórico',       cor: '#8b5cf6' },
      { href: 'financeiro.html',     icon: '💵', label: 'Financeiro',      cor: '#14b8a6' },
      { href: 'relatorios.html',     icon: '📊', label: 'Relatórios',      cor: '#f97316' },
      { href: 'whatsapp.html',       icon: '💬', label: 'WhatsApp Auto',   cor: '#25D366' },
      { href: 'configuracoes.html',  icon: '⚙️', label: 'Configurações',   cor: '#64748b' },
    ];
    document.getElementById('atalhosGrid').innerHTML = atalhos.map(a => `
      <a href="${a.href}" style="
        display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:12px 8px;border-radius:12px;text-decoration:none;
        border:1px solid var(--border);background:var(--card-bg);
        transition:all .15s;cursor:pointer;
        " onmouseover="this.style.borderColor='${a.cor}';this.style.background='${a.cor}18'"
          onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--card-bg)'">
        <span style="font-size:24px;line-height:1">${a.icon}</span>
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-align:center;line-height:1.3">${a.label}</span>
      </a>`).join('');
  },

  renderPgtoHoje: () => {
    const cont = document.getElementById('pgtoHojeLista');
    const vendasHoje = DB.Vendas.listarHoje();

    const totais = { dinheiro: 0, pix: 0, cartao_debito: 0, cartao_credito: 0, crediario: 0 };
    const labels = {
      dinheiro:      { label: '💵 Dinheiro',    cor: '#10b981' },
      pix:           { label: '📱 PIX',          cor: '#6366f1' },
      cartao_debito: { label: '💳 Débito',       cor: '#3b82f6' },
      cartao_credito:{ label: '💳 Crédito',      cor: '#f59e0b' },
      crediario:     { label: '📋 Crediário',    cor: '#ec4899' },
    };

    vendasHoje.forEach(v => {
      if (v.formasPagamento && v.formasPagamento.length > 0) {
        v.formasPagamento.forEach(f => {
          if (totais[f.forma] !== undefined) totais[f.forma] += parseFloat(f.valor) || 0;
        });
      } else if (totais[v.formaPagamento] !== undefined) {
        totais[v.formaPagamento] += parseFloat(v.total) || 0;
      }
    });

    const totalGeral = Object.values(totais).reduce((s, v) => s + v, 0);

    if (totalGeral === 0) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhuma venda hoje</div>';
      return;
    }

    cont.innerHTML = Object.entries(totais)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([forma, valor]) => {
        const { label, cor } = labels[forma];
        const pct = Math.round((valor / totalGeral) * 100);
        return `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span style="font-weight:600">${label}</span>
              <span style="font-weight:700;color:${cor}">${Utils.moeda(valor)} <span style="color:var(--text-muted);font-weight:400">(${pct}%)</span></span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width .4s"></div>
            </div>
          </div>`;
      }).join('');
  },

  renderVencimentos7Dias: () => {
    const cont = document.getElementById('vencLista');
    const badge = document.getElementById('vencBadge');
    const hoje = Utils.hoje();
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const ate7dias = em7dias.toISOString().substring(0, 10);

    const vencendo = [];
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      cred.parcelas.forEach(p => {
        if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= ate7dias) {
          vencendo.push({
            clienteNome: cred.clienteNome,
            clienteId: cred.clienteId,
            valor: p.valor,
            vencimento: p.vencimento,
          });
        }
      });
    });

    vencendo.sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    if (vencendo.length === 0) {
      badge.style.display = 'none';
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhuma parcela vencendo em 7 dias</div>';
      return;
    }

    badge.style.display = '';
    badge.textContent = vencendo.length;

    cont.innerHTML = vencendo.slice(0, 5).map(v => {
      const dias = Math.floor((new Date(v.vencimento + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
      const isHoje = dias === 0;
      const cor = isHoje ? 'var(--danger)' : dias <= 2 ? 'var(--warning)' : 'var(--text-muted)';
      const cli = DB.Clientes.buscar(v.clienteId);
      const tel = cli ? (cli.telefone || '').replace(/\D/g, '') : '';
      const msg = encodeURIComponent(`Olá, ${v.clienteNome.split(' ')[0]}! 😊 Passando para lembrar que sua parcela de ${Utils.moeda(v.valor)} vence ${isHoje ? 'hoje' : 'em ' + dias + ' dia(s)'}. Qualquer dúvida, estamos à disposição! 🙏`);
      const waLink = tel ? `https://wa.me/55${tel}?text=${msg}` : '';

      return `
        <div class="alert-item">
          <div class="alert-icon">📅</div>
          <div class="alert-info">
            <div class="alert-nome">${v.clienteNome}</div>
            <div class="alert-det" style="color:${cor};font-weight:${isHoje ? '700' : '400'}">
              ${isHoje ? '⚠️ Vence hoje!' : 'em ' + dias + ' dia(s) · ' + Utils.data(v.vencimento)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span style="font-weight:700;font-size:13px">${Utils.moeda(v.valor)}</span>
            ${waLink ? `<a href="${waLink}" target="_blank" style="font-size:18px;line-height:1;text-decoration:none" title="Enviar WhatsApp">💬</a>` : ''}
          </div>
        </div>`;
    }).join('');

    if (vencendo.length > 5) {
      cont.innerHTML += `<div class="text-muted fs-sm" style="padding:8px 16px">+${vencendo.length - 5} outras parcelas</div>`;
    }
  },

  renderUltimasVendas: () => {
    const cont = document.getElementById('ultimasVendasLista');
    const vendas = DB.Vendas.listar()
      .filter(v => v.criadoEm)
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 7);

    if (vendas.length === 0) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhuma venda registrada</div>';
      return;
    }

    const formaLabel = { dinheiro: '💵', pix: '📱', cartao_debito: '💳', cartao_credito: '💳', crediario: '📋', multiplo: '🔀' };

    cont.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid var(--border)">
              <th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-weight:600">Data/Hora</th>
              <th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-weight:600">Cliente</th>
              <th style="text-align:left;padding:8px 10px;color:var(--text-muted);font-weight:600">Itens</th>
              <th style="text-align:center;padding:8px 10px;color:var(--text-muted);font-weight:600">Pgto</th>
              <th style="text-align:right;padding:8px 10px;color:var(--text-muted);font-weight:600">Total</th>
            </tr>
          </thead>
          <tbody>
            ${vendas.map(v => {
              const hora = new Date(v.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              const data = new Date(v.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
              const isHoje = v.criadoEm.startsWith(Utils.hoje());
              const itensDesc = (v.itens || []).slice(0, 2).map(i => i.nome).join(', ') +
                ((v.itens || []).length > 2 ? ` +${v.itens.length - 2}` : '');
              const forma = v.formaPagamento === 'multiplo' ? '🔀' : (formaLabel[v.formaPagamento] || '—');
              return `
                <tr style="border-bottom:1px solid var(--border);${isHoje ? 'background:var(--primary-dim)' : ''}">
                  <td style="padding:8px 10px;white-space:nowrap">
                    <span style="font-weight:600">${isHoje ? hora : data}</span>
                    ${isHoje ? '<span class="badge badge-primary" style="font-size:9px;margin-left:4px">Hoje</span>' : '<span style="font-size:11px;color:var(--text-muted)"> ' + hora + '</span>'}
                  </td>
                  <td style="padding:8px 10px;color:var(--text-muted)">${v.clienteNome || '—'}</td>
                  <td style="padding:8px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(v.itens||[]).map(i=>i.nome).join(', ')}">${itensDesc || '—'}</td>
                  <td style="padding:8px 10px;text-align:center;font-size:16px">${forma}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--success)">${Utils.moeda(v.total)}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  renderTermometroCrediario: () => {
    const cont = document.getElementById('cardTermometroCrediario');
    if (!cont) return;

    const mes = Utils.hoje().substring(0, 7);
    const limite = parseFloat(DB.Config.get('limiteCrediario', 25)) || 25;

    // Vendas do mês
    const vendasMes = DB.Vendas.listarPorPeriodo(mes + '-01', mes + '-31');
    const faturamentoMes = vendasMes.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const vendasCrediario = vendasMes.filter(v => v.formaPagamento === 'crediario');
    const totalCrediarioMes = vendasCrediario.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const pct = faturamentoMes > 0 ? (totalCrediarioMes / faturamentoMes) * 100 : 0;

    // Crediário em aberto (total a receber)
    const hoje = Utils.hoje();
    let totalAberto = 0, totalVencido = 0, totalProx30 = 0;
    const em30 = new Date(); em30.setDate(em30.getDate() + 30);
    const ate30 = em30.toISOString().slice(0, 10);
    DB.Crediario.listar().forEach(c => {
      (c.parcelas || []).forEach(p => {
        if (p.status === 'pago') return;
        const v = parseFloat(p.valor) || 0;
        totalAberto += v;
        if (p.vencimento && p.vencimento < hoje) totalVencido += v;
        else if (p.vencimento && p.vencimento <= ate30) totalProx30 += v;
      });
    });

    // Semáforo
    const pctLimite = limite > 0 ? (pct / limite) * 100 : 0;
    const abertoVsFat = faturamentoMes > 0 ? (totalAberto / faturamentoMes) * 100 : 0;

    let sinal, cor, bgCor, bordaCor, titulo, detalhe, orientacao;
    if (pct >= limite || abertoVsFat > 150) {
      sinal = '🔴'; cor = 'var(--danger)'; bgCor = 'rgba(239,68,68,.07)'; bordaCor = 'rgba(239,68,68,.4)';
      titulo = 'TRAVADO — Só à vista agora';
      detalhe = pct >= limite
        ? `Você já vendeu ${pct.toFixed(1)}% do mês no crediário (limite: ${limite}%).`
        : `Crediário em aberto (${Utils.moeda(totalAberto)}) já é ${abertoVsFat.toFixed(0)}% do faturamento mensal.`;
      orientacao = 'Não ofereça crediário até o mês que vem ou até receber mais parcelas. Foque em cobrar inadimplentes primeiro.';
    } else if (pct >= limite * 0.75 || abertoVsFat > 80) {
      sinal = '🟡'; cor = 'var(--warning)'; bgCor = 'rgba(234,179,8,.07)'; bordaCor = 'rgba(234,179,8,.4)';
      titulo = 'Atenção — só para clientes com histórico limpo';
      detalhe = `Você está em ${pct.toFixed(1)}% de crediário no mês (limite: ${limite}%). Restam ${Utils.moeda(faturamentoMes * (limite / 100) - totalCrediarioMes)} antes de travar.`;
      orientacao = 'Aceite crediário apenas de clientes que já pagaram em dia. Evite crediário para clientes novos ou inadimplentes.';
    } else {
      sinal = '🟢'; cor = 'var(--success)'; bgCor = 'rgba(34,197,94,.07)'; bordaCor = 'rgba(34,197,94,.4)';
      titulo = 'Sinal verde — pode oferecer crediário';
      detalhe = `Você está em ${pct.toFixed(1)}% de crediário no mês (limite: ${limite}%). Espaço restante: ${Utils.moeda(faturamentoMes * (limite / 100) - totalCrediarioMes)}.`;
      orientacao = 'Crediário sob controle. Mantenha o limite definido e verifique todo mês.';
    }

    // Barra de progresso
    const barPct = Math.min(100, pctLimite);
    const barCor = pct >= limite ? 'var(--danger)' : pct >= limite * 0.75 ? 'var(--warning)' : 'var(--success)';

    // ── Projeção futura ──────────────────────────────────────────
    // Média dos últimos 3 meses completos (faturamento e % crediário)
    const _mediaMeses = (() => {
      let somaFat = 0, somaCredPct = 0, n = 0;
      for (let i = 1; i <= 3; i++) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const vv = DB.Vendas.listarPorPeriodo(m + '-01', m + '-31');
        const fat = vv.reduce((s, v) => s + (parseFloat(v.total)||0), 0);
        if (fat > 0) {
          const cr = vv.filter(v => v.formaPagamento === 'crediario').reduce((s, v) => s + (parseFloat(v.total)||0), 0);
          somaFat += fat;
          somaCredPct += (cr / fat) * 100;
          n++;
        }
      }
      return n > 0 ? { fat: somaFat / n, pct: somaCredPct / n } : { fat: faturamentoMes || 0, pct };
    })();

    // Projeção dos 3 próximos meses
    const _projecao = (() => {
      const crediarios = DB.Crediario.listar();
      const result = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() + i, 1);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const nomeMes = d.toLocaleDateString('pt-BR', { month: 'long' });

        // Parcelas já contratadas que vencem neste mês
        let aReceber = 0;
        crediarios.forEach(c => {
          (c.parcelas || []).forEach(p => {
            if (p.status !== 'pago' && (p.vencimento || '').startsWith(m))
              aReceber += parseFloat(p.valor) || 0;
          });
        });

        // Projeção de novos crediários (baseado na média histórica)
        const fatProj = _mediaMeses.fat;
        const credProj = fatProj * (_mediaMeses.pct / 100);
        const pctProj = _mediaMeses.pct;

        result.push({ nomeMes, m, aReceber, fatProj, credProj, pctProj });
      }
      return result;
    })();

    // Gestão de clientes no crediário
    const _gestaoCrediarios = DB.Crediario.listar();
    const _saldosPorCliente = {};
    _gestaoCrediarios.forEach(c => {
      const emAberto = (c.parcelas || []).filter(p => p.status !== 'pago');
      if (emAberto.length === 0) return;
      const chave = c.clienteId || c.clienteNome;
      if (!_saldosPorCliente[chave]) _saldosPorCliente[chave] = { nome: c.clienteNome, saldo: 0, clienteId: c.clienteId };
      _saldosPorCliente[chave].saldo += emAberto.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
    });
    const _totalClientesAtivos = Object.keys(_saldosPorCliente).length;
    const _novosEsseMes = (() => {
      const vistos = new Set();
      _gestaoCrediarios.forEach(c => {
        if ((c.criadoEm || '').startsWith(mes)) vistos.add(c.clienteId || c.clienteNome);
      });
      return vistos.size;
    })();
    const _metaClientesAtivos = parseFloat(DB.Config.get('metaClientesCrediario', 20)) || 20;
    const _metaNovosClientesMes = parseFloat(DB.Config.get('metaNovosClientesMes', 3)) || 3;
    const _limiteDefaultCliente = parseFloat(DB.Config.get('limiteDefaultCliente', 200)) || 200;
    const _todosDevedores = Object.values(_saldosPorCliente).sort((a, b) => b.saldo - a.saldo);
    const _devedoresHtml = _todosDevedores.map((d, i) => {
      const cli = d.clienteId ? DB.Clientes.buscar(d.clienteId) : null;
      const lim = cli ? (parseFloat(cli.limiteCredito) || 0) : 0;
      const pctLim = lim > 0 ? Math.min(100, (d.saldo / lim) * 100) : 0;
      const corBar = pctLim >= 100 ? 'var(--danger)' : pctLim >= 75 ? 'var(--warning)' : 'var(--success)';
      const barHtml = lim > 0
        ? '<div style="background:var(--border);border-radius:3px;height:4px;overflow:hidden;margin-top:2px"><div style="height:100%;width:' + pctLim.toFixed(0) + '%;background:' + corBar + ';border-radius:3px"></div></div>'
        : '';
      const dispHtml = lim > 0
        ? '<div style="font-size:10px;color:var(--text-muted)">Lim ' + Utils.moeda(lim) + ' · Disp ' + Utils.moeda(Math.max(0, lim - d.saldo)) + '</div>'
        : '';
      const corSaldo = lim > 0 && d.saldo > lim ? 'var(--danger)' : 'var(--text)';
      return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:7px 8px;border-radius:6px;background:var(--card-bg);margin-bottom:4px">'
        + '<div style="width:18px;font-weight:700;color:var(--text-muted);flex-shrink:0;font-size:11px">' + (i + 1) + '</div>'
        + '<div style="flex:1;min-width:0"><div style="font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.nome + '</div>' + barHtml + '</div>'
        + '<div style="text-align:right;flex-shrink:0"><div style="font-weight:800;color:' + corSaldo + '">' + Utils.moeda(d.saldo) + '</div>' + dispHtml + '</div>'
        + '</div>';
    }).join('');

    cont.innerHTML = `
      <div style="background:${bgCor};border:1px solid ${bordaCor};border-radius:var(--radius);padding:16px 20px">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px">
          <div style="font-size:38px;line-height:1;flex-shrink:0">${sinal}</div>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:800;font-size:15px;color:${cor};margin-bottom:3px">Crediário: ${titulo}</div>
            <div style="font-size:13px;color:var(--text);margin-bottom:4px">${detalhe}</div>
            <div style="font-size:12px;color:var(--text-muted);font-style:italic">${orientacao}</div>
          </div>
          <div style="flex-shrink:0;text-align:right">
            <div style="font-size:28px;font-weight:900;color:${cor}">${pct.toFixed(1)}%</div>
            <div style="font-size:11px;color:var(--text-muted)">do faturamento do mês</div>
            <div style="font-size:11px;color:var(--text-muted)">limite: ${limite}%</div>
          </div>
        </div>

        <!-- Barra de progresso -->
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-bottom:4px">
            <span>0%</span>
            <span style="color:${cor};font-weight:700">${pct.toFixed(1)}% utilizado</span>
            <span style="color:var(--danger)">Limite ${limite}%</span>
          </div>
          <div style="background:var(--border);border-radius:6px;height:12px;overflow:hidden;position:relative">
            <div style="height:100%;width:${barPct}%;background:${barCor};border-radius:6px;transition:width .5s"></div>
            <div style="position:absolute;left:${Math.min(99,limite / Math.max(pct, limite) * barPct)}%;top:0;height:100%;width:2px;background:var(--danger);opacity:.6"></div>
          </div>
        </div>

        <!-- Métricas -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px">
          <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px">VENDIDO CREDIÁRIO</div>
            <div style="font-size:15px;font-weight:800;color:var(--primary)">${Utils.moeda(totalCrediarioMes)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${vendasCrediario.length} venda(s) no mês</div>
          </div>
          <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px">EM ABERTO (TOTAL)</div>
            <div style="font-size:15px;font-weight:800;color:var(--warning)">${Utils.moeda(totalAberto)}</div>
            <div style="font-size:11px;color:var(--text-muted)">ainda a receber</div>
          </div>
          <div style="background:${totalVencido > 0 ? 'rgba(239,68,68,.08)' : 'var(--card-bg)'};border:1px solid ${totalVencido > 0 ? 'rgba(239,68,68,.3)' : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px">VENCIDO (ATRASO)</div>
            <div style="font-size:15px;font-weight:800;color:${totalVencido > 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.moeda(totalVencido)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${totalVencido > 0 ? 'cobrar agora' : 'sem atraso'}</div>
          </div>
          <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px">A RECEBER 30 DIAS</div>
            <div style="font-size:15px;font-weight:800;color:var(--success)">${Utils.moeda(totalProx30)}</div>
            <div style="font-size:11px;color:var(--text-muted)">próximas parcelas</div>
          </div>
        </div>

        <!-- Histórico meses anteriores -->
        ${(() => {
          const mesesHist = [];
          const agora = new Date();
          for (let i = 1; i <= 5; i++) {
            const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
            const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const nomeMes = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            const vMes = DB.Vendas.listarPorPeriodo(m + '-01', m + '-31');
            const fat = vMes.reduce((s, v) => s + (parseFloat(v.total)||0), 0);
            const cred = vMes.filter(v => v.formaPagamento === 'crediario').reduce((s, v) => s + (parseFloat(v.total)||0), 0);
            const p = fat > 0 ? (cred / fat) * 100 : null;
            mesesHist.push({ nomeMes, fat, cred, p });
          }
          const temDados = mesesHist.some(h => h.fat > 0);
          if (!temDados) return '';
          const maxPct = Math.max(...mesesHist.map(h => h.p || 0), limite);
          return `
          <div style="border-top:1px solid ${bordaCor};padding-top:14px;margin-top:4px">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px">HISTÓRICO — MESES ANTERIORES</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${mesesHist.map(h => {
                if (h.fat === 0) return '';
                const corBar = h.p >= limite ? 'var(--danger)' : h.p >= limite * 0.75 ? 'var(--warning)' : 'var(--success)';
                const barW = Math.round((h.p / maxPct) * 100);
                const limW = Math.round((limite / maxPct) * 100);
                return `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
                  <div style="width:44px;text-align:right;color:var(--text-muted);flex-shrink:0;text-transform:capitalize">${h.nomeMes}</div>
                  <div style="flex:1;background:var(--border);border-radius:4px;height:16px;overflow:hidden;position:relative">
                    <div style="height:100%;width:${barW}%;background:${corBar};border-radius:4px"></div>
                    <div style="position:absolute;left:${limW}%;top:0;height:100%;width:2px;background:rgba(239,68,68,.5)"></div>
                  </div>
                  <div style="width:38px;font-weight:700;color:${corBar}">${h.p !== null ? h.p.toFixed(1)+'%' : '—'}</div>
                  <div style="width:70px;text-align:right;color:var(--text-muted)">${Utils.moeda(h.cred)}</div>
                </div>`;
              }).join('')}
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                A linha vermelha marca o limite de ${limite}%. Barras vermelhas = meses em que passou do limite.
              </div>
            </div>
          </div>`;
        })()}

        <!-- Projeção meses futuros -->
        <div style="border-top:1px solid ${bordaCor};padding-top:14px;margin-top:4px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px">PROJEÇÃO — PRÓXIMOS 3 MESES</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px">
            ${_projecao.map(proj => {
              const corPct = proj.pctProj >= limite ? 'var(--danger)' : proj.pctProj >= limite * 0.75 ? 'var(--warning)' : 'var(--success)';
              const sinalProj = proj.pctProj >= limite ? '🔴' : proj.pctProj >= limite * 0.75 ? '🟡' : '🟢';
              return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:capitalize;margin-bottom:6px">${proj.nomeMes} ${sinalProj}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:1px">Parcelas a receber</div>
                <div style="font-size:14px;font-weight:800;color:var(--success);margin-bottom:6px">${Utils.moeda(proj.aReceber)}</div>
                <div style="background:var(--border);border-radius:3px;height:4px;overflow:hidden;margin-bottom:6px">
                  <div style="height:100%;width:${Math.min(100,(proj.aReceber/(proj.fatProj||1))*100)}%;background:var(--success);border-radius:3px"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:1px">Crediário novo estimado</div>
                <div style="font-size:13px;font-weight:700;color:${corPct}">${Utils.moeda(proj.credProj)} <span style="font-size:11px">(${proj.pctProj.toFixed(1)}%)</span></div>
              </div>`;
            }).join('')}
          </div>
          <div style="font-size:11px;color:var(--text-muted);line-height:1.5">
            <strong>Parcelas a receber</strong>: vencimentos já contratados nos seus crediários em aberto.<br>
            <strong>Crediário estimado</strong>: projeção baseada na média dos últimos 3 meses — se você mantiver o ritmo atual.
          </div>
        </div>

        <!-- Controle de Clientes no Crediário -->
        <div style="border-top:1px solid ${bordaCor};padding-top:14px;margin-top:4px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px">CONTROLE DE CLIENTES NO CREDIÁRIO</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px">
            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">CLIENTES ATIVOS</div>
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:5px">
                <span style="font-size:22px;font-weight:900;color:${_totalClientesAtivos >= _metaClientesAtivos ? 'var(--success)' : 'var(--warning)'}">${_totalClientesAtivos}</span>
                <span style="font-size:12px;color:var(--text-muted)">/ meta ${_metaClientesAtivos}</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:3px">
                <div style="height:100%;width:${Math.min(100, (_totalClientesAtivos / Math.max(1, _metaClientesAtivos)) * 100).toFixed(0)}%;background:${_totalClientesAtivos >= _metaClientesAtivos ? 'var(--success)' : 'var(--warning)'}"></div>
              </div>
              <div style="font-size:10px;color:var(--text-muted)">${_totalClientesAtivos >= _metaClientesAtivos ? 'Meta atingida!' : 'Faltam ' + (_metaClientesAtivos - _totalClientesAtivos) + ' clientes'}</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">NOVOS ESTE MÊS</div>
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:5px">
                <span style="font-size:22px;font-weight:900;color:${_novosEsseMes >= _metaNovosClientesMes ? 'var(--success)' : 'var(--warning)'}">${_novosEsseMes}</span>
                <span style="font-size:12px;color:var(--text-muted)">/ meta ${_metaNovosClientesMes}</span>
              </div>
              <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden;margin-bottom:3px">
                <div style="height:100%;width:${Math.min(100, (_novosEsseMes / Math.max(1, _metaNovosClientesMes)) * 100).toFixed(0)}%;background:${_novosEsseMes >= _metaNovosClientesMes ? 'var(--success)' : 'var(--warning)'}"></div>
              </div>
              <div style="font-size:10px;color:var(--text-muted)">${_novosEsseMes >= _metaNovosClientesMes ? 'Meta atingida!' : 'Faltam ' + (_metaNovosClientesMes - _novosEsseMes) + ' novos'}</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">SALDO MÉDIO/CLIENTE</div>
              <div style="font-size:18px;font-weight:800;color:var(--primary);margin-bottom:3px">${_totalClientesAtivos > 0 ? Utils.moeda(totalAberto / _totalClientesAtivos) : 'R$ 0,00'}</div>
              <div style="font-size:10px;color:var(--text-muted)">média de dívida ativa por cliente</div>
            </div>
            <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">LIMITE PADRÃO (NOVOS)</div>
              <div style="font-size:18px;font-weight:800;color:var(--primary);margin-bottom:3px">${Utils.moeda(_limiteDefaultCliente)}</div>
              <div style="font-size:10px;color:var(--text-muted)">crédito inicial para novos clientes</div>
            </div>
          </div>
          ${_devedoresHtml ? `<div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted)">CLIENTES COM SALDO EM ABERTO</div>
              <div style="font-size:11px;color:var(--text-muted)">${_todosDevedores.length} cliente(s)</div>
            </div>
            <div style="max-height:280px;overflow-y:auto;padding-right:4px;border:1px solid var(--border);border-radius:8px;padding:8px">
              ${_devedoresHtml}
            </div>
          </div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;padding-top:10px;border-top:1px solid ${bordaCor}">
            <div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;margin-bottom:3px">META CLIENTES ATIVOS</div>
              <input type="number" id="inputMetaClientes" value="${_metaClientesAtivos}" min="1" max="500" step="1"
                style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;margin-bottom:3px">META NOVOS/MÊS</div>
              <input type="number" id="inputMetaNovos" value="${_metaNovosClientesMes}" min="1" max="50" step="1"
                style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;margin-bottom:3px">LIMITE PADRÃO (R$)</div>
              <input type="number" id="inputLimiteDefault" value="${_limiteDefaultCliente}" min="50" max="5000" step="50"
                style="width:80px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;text-align:center">
            </div>
            <button onclick="Dashboard.salvarMetasCrediario()" class="btn btn-primary btn-sm">Salvar metas</button>
          </div>
        </div>

        <!-- Configuração do limite -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid ${bordaCor};padding-top:12px;margin-top:14px">
          <span style="font-size:12px;color:var(--text-muted);font-weight:600">Limite de crediário:</span>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" id="inputLimiteCrediario" value="${limite}" min="5" max="70" step="5"
              style="width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-weight:700;text-align:center">
            <span style="font-size:13px;font-weight:700">%</span>
            <button onclick="Dashboard.salvarLimiteCrediario()" class="btn btn-primary btn-sm">Salvar</button>
          </div>
          <span style="font-size:12px;color:var(--text-muted)">Recomendado: 25% a 30% para compras à vista do fornecedor</span>
        </div>
      </div>`;
  },

  salvarLimiteCrediario: () => {
    const val = parseFloat(document.getElementById('inputLimiteCrediario')?.value) || 25;
    DB.Config.set('limiteCrediario', val);
    Dashboard.renderTermometroCrediario();
    Utils.toast(`Limite de crediário definido em ${val}%`, 'success');
  },

  salvarMetasCrediario: () => {
    const mca = parseFloat(document.getElementById('inputMetaClientes')?.value) || 20;
    const mnm = parseFloat(document.getElementById('inputMetaNovos')?.value) || 3;
    const ld  = parseFloat(document.getElementById('inputLimiteDefault')?.value) || 200;
    DB.Config.set('metaClientesCrediario', mca);
    DB.Config.set('metaNovosClientesMes', mnm);
    DB.Config.set('limiteDefaultCliente', ld);
    Dashboard.renderTermometroCrediario();
    Utils.toast('Metas de crediário salvas!', 'success');
  },

  renderSaudeFinanceira: () => {
    const cont = document.getElementById('cardSaudeFinanceira');
    if (!cont) return;

    const mes = Utils.hoje().substring(0, 7);

    // Faturamento do mês (vendas à vista + crediário recebido)
    const vendas = DB.Vendas.listarPorPeriodo(mes + '-01', mes + '-31');
    const receitaVista = vendas.filter(v => v.formaPagamento !== 'crediario').reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    const credRecebido = DB.FluxoCaixa.listar()
      .filter(f => f.categoria === 'crediario' && (f.data || '').startsWith(mes))
      .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
    const faturamento = receitaVista + credRecebido;

    // Despesas pagas no mês
    const despPagas = DB.Despesas.listar()
      .filter(d => d.pago && (d.dataPagamento || d.vencimento || '').startsWith(mes))
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // Retiradas do mês
    const totalRetiradas = DB.Retiradas.totalMes(mes);
    const proLabore = DB.Config.get('proLabore', 0);
    const limiteRetirada = DB.Config.get('limiteRetirada', 0);

    // Resultado estimado = faturamento - despesas - retiradas
    const resultado = faturamento - despPagas - totalRetiradas;
    const positivo = resultado >= 0;

    // Percentual de retirada sobre faturamento
    const pctRetirada = faturamento > 0 ? Math.round((totalRetiradas / faturamento) * 100) : 0;
    const limiteUltrapassado = limiteRetirada > 0 && totalRetiradas > limiteRetirada;
    const retirouMaisQueGanhou = totalRetiradas > (faturamento - despPagas) && (faturamento - despPagas) > 0;

    const nomeMes = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    cont.innerHTML = `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;border-left:4px solid ${positivo ? 'var(--success)' : 'var(--danger)'}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">${positivo ? '💚' : '🔴'}</span>
            <div>
              <div style="font-weight:800;font-size:15px">Saúde Financeira — ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</div>
              <div style="font-size:12px;color:var(--text-muted)">Separação entre dinheiro da loja e retiradas pessoais</div>
            </div>
          </div>
          <a href="financeiro.html" style="font-size:12px;color:var(--primary);font-weight:600">Ver DRE completo →</a>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">FATURAMENTO</div>
            <div style="font-size:17px;font-weight:800;color:var(--success)">${Utils.moeda(faturamento)}</div>
            <div style="font-size:11px;color:var(--text-muted)">entrou no mês</div>
          </div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">DESPESAS PAGAS</div>
            <div style="font-size:17px;font-weight:800;color:var(--warning)">${Utils.moeda(despPagas)}</div>
            <div style="font-size:11px;color:var(--text-muted)">custos da loja</div>
          </div>
          <div style="background:${limiteUltrapassado || retirouMaisQueGanhou ? 'rgba(239,68,68,.08)' : 'var(--bg)'};border:1px solid ${limiteUltrapassado || retirouMaisQueGanhou ? 'rgba(239,68,68,.4)' : 'var(--border)'};border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">RETIRADAS PESSOAIS</div>
            <div style="font-size:17px;font-weight:800;color:${limiteUltrapassado || retirouMaisQueGanhou ? 'var(--danger)' : 'var(--primary)'}">${Utils.moeda(totalRetiradas)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${pctRetirada}% do faturamento</div>
          </div>
          <div style="background:${positivo ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)'};border:1px solid ${positivo ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'};border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">RESULTADO</div>
            <div style="font-size:17px;font-weight:800;color:${positivo ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(resultado)}</div>
            <div style="font-size:11px;color:${positivo ? 'var(--success)' : 'var(--danger)'};font-weight:600">${positivo ? 'sobrou no mês' : 'negativo no mês'}</div>
          </div>
        </div>

        ${retirouMaisQueGanhou ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--danger);font-weight:600;margin-bottom:10px">
          ⚠ Você retirou mais do que a loja lucrou este mês. Isso consome o capital do negócio.
        </div>` : ''}

        ${limiteUltrapassado ? `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;color:var(--danger);font-weight:600;margin-bottom:10px">
          🚨 Limite de retirada mensal ultrapassado! Definido: ${Utils.moeda(limiteRetirada)} · Retirado: ${Utils.moeda(totalRetiradas)}
        </div>` : ''}

        <div style="font-size:12px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:10px">
          ${proLabore > 0 ? `<span>Pró-labore definido: <strong>${Utils.moeda(proLabore)}/mês</strong></span>` : '<span>💡 <a href="financeiro.html" style="color:var(--primary)">Configure seu pró-labore mensal</a> para ter controle real</span>'}
          ${limiteRetirada > 0 ? `<span>Limite de retirada: <strong>${Utils.moeda(limiteRetirada)}/mês</strong></span>` : ''}
          <a href="financeiro.html" style="color:var(--primary)">Registrar retirada →</a>
        </div>
      </div>`;
  },

  renderFluxo30Dias: () => {
    const cont = document.getElementById('cardFluxo30Dias');
    if (!cont) return;

    const hoje = Utils.hoje();
    const em30 = new Date();
    em30.setDate(em30.getDate() + 30);
    const ate30 = `${em30.getFullYear()}-${String(em30.getMonth()+1).padStart(2,'0')}-${String(em30.getDate()).padStart(2,'0')}`;

    // Entradas: parcelas de crediário a receber
    let entradas = 0;
    const parcelasProximas = [];
    DB.Crediario.listar().forEach(cred => {
      (cred.parcelas || []).forEach(p => {
        if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= ate30) {
          entradas += parseFloat(p.valor) || 0;
          parcelasProximas.push({ nome: cred.clienteNome, valor: parseFloat(p.valor) || 0, venc: p.vencimento });
        }
      });
    });

    // Saídas: despesas não pagas com vencimento nos próximos 30 dias
    let saidas = 0;
    const despesasProximas = [];
    DB.Despesas.listar().forEach(d => {
      if (!d.pago && d.vencimento && d.vencimento >= hoje && d.vencimento <= ate30) {
        saidas += parseFloat(d.valor) || 0;
        despesasProximas.push({ nome: d.descricao || d.categoria || 'Despesa', valor: parseFloat(d.valor) || 0, venc: d.vencimento });
      }
    });

    if (entradas === 0 && saidas === 0) { cont.innerHTML = ''; return; }

    const saldo = entradas - saidas;
    const positivo = saldo >= 0;
    const corSaldo = positivo ? 'var(--success)' : 'var(--danger)';
    const bgCard = positivo ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)';
    const bdCard = positivo ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)';

    // Top 3 despesas mais caras
    despesasProximas.sort((a, b) => b.valor - a.valor);
    const topDesp = despesasProximas.slice(0, 3);

    cont.innerHTML = `
      <div style="background:${bgCard};border:1px solid ${bdCard};border-radius:var(--radius);padding:16px 20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <span style="font-size:22px">💰</span>
          <div style="font-weight:800;font-size:15px">Fluxo de Caixa — Próximos 30 dias</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
          <div style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Entradas previstas</div>
            <div style="font-size:18px;font-weight:800;color:var(--success)">${Utils.moeda(entradas)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${parcelasProximas.length} parcela(s) crediário</div>
          </div>
          <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Saídas previstas</div>
            <div style="font-size:18px;font-weight:800;color:var(--danger)">${Utils.moeda(saidas)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${despesasProximas.length} conta(s) a pagar</div>
          </div>
          <div style="background:${positivo ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)'};border:1px solid ${bdCard};border-radius:var(--radius-sm);padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Saldo projetado</div>
            <div style="font-size:18px;font-weight:800;color:${corSaldo}">${positivo ? '+' : ''}${Utils.moeda(saldo)}</div>
            <div style="font-size:11px;color:${corSaldo};margin-top:2px;font-weight:600">${positivo ? '✅ Caixa positivo' : '⚠ Atenção: negativo'}</div>
          </div>
        </div>
        ${topDesp.length > 0 ? `
        <div style="border-top:1px solid var(--border);padding-top:12px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">MAIORES CONTAS A PAGAR NOS PRÓXIMOS 30 DIAS</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${topDesp.map(d => `
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
                <span>${d.nome}</span>
                <div style="display:flex;gap:12px;align-items:center">
                  <span style="color:var(--text-muted);font-size:12px">${Utils.data(d.venc)}</span>
                  <span style="font-weight:700;color:var(--danger)">${Utils.moeda(d.valor)}</span>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}
        ${!positivo ? `<div style="margin-top:12px;font-size:12px;color:var(--danger);font-weight:600;border-top:1px solid rgba(239,68,68,.2);padding-top:10px">
          ⚠ O caixa pode ficar negativo. Considere antecipar cobranças do crediário ou adiar compras não urgentes.
        </div>` : ''}
      </div>`;
  },

  renderEstoqueParado: () => {
    const cont = document.getElementById('cardEstoqueParado');
    if (!cont) return;

    const parados = DB.Produtos.listarParados(60);
    if (parados.length === 0) { cont.innerHTML = ''; return; }

    const capitalTotal = parados.reduce((s, p) => s + p.capitalPreso, 0);
    const top5 = parados.slice(0, 5);

    const labelDias = (d) => d >= 999 ? 'Nunca vendido' : `${d} dias sem vender`;

    cont.innerHTML = `
      <div style="background:rgba(234,179,8,.07);border:1px solid rgba(234,179,8,.4);border-radius:var(--radius);padding:16px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">📦</span>
            <div>
              <div style="font-weight:800;font-size:15px">Estoque Parado — ${parados.length} produto${parados.length > 1 ? 's' : ''} sem vender há +60 dias</div>
              <div style="font-size:13px;color:var(--text-muted)"><strong style="color:var(--warning)">${Utils.moeda(capitalTotal)}</strong> em capital parado que poderia estar girando</div>
            </div>
          </div>
          <a href="estoque.html?parado=1" class="btn btn-outline btn-sm" style="white-space:nowrap">Ver todos →</a>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${top5.map(p => {
            const qtd = DB.Produtos.estoqueTotal(p);
            const corDias = p.diasSemVenda >= 999 ? 'var(--danger)' : p.diasSemVenda >= 120 ? 'var(--danger)' : 'var(--warning)';
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 10px;background:var(--card);border-radius:var(--radius-sm);border:1px solid var(--border)">
              <div style="flex:1;min-width:0">
                <span style="font-weight:600;font-size:13px">${p.nome}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:6px">${p.marca || ''}</span>
              </div>
              <div style="font-size:12px;color:var(--text-muted);white-space:nowrap">${qtd} peça${qtd > 1 ? 's' : ''}</div>
              <div style="font-size:12px;font-weight:700;color:${corDias};white-space:nowrap">${labelDias(p.diasSemVenda)}</div>
              ${p.capitalPreso > 0 ? `<div style="font-size:13px;font-weight:700;white-space:nowrap">${Utils.moeda(p.capitalPreso)}</div>` : ''}
            </div>`;
          }).join('')}
          ${parados.length > 5 ? `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:4px">+${parados.length - 5} outros produtos parados</div>` : ''}
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border);padding-top:10px">
          💡 <strong>Sugestão:</strong> considere dar desconto, fazer promoção ou devolver ao fornecedor para liberar esse capital.
        </div>
      </div>`;
  },

  renderAlertas: () => {
    const inadimplentes = DB.Crediario.inadimplentes();
    const cont = document.getElementById('alertasLista');

    if (inadimplentes.length === 0) {
      cont.innerHTML = '<div class="text-muted" style="padding:16px;text-align:center">Nenhum inadimplente</div>';
      document.getElementById('alertasBadge').style.display = 'none';
      return;
    }

    document.getElementById('alertasBadge').style.display = '';
    document.getElementById('alertasBadge').textContent = inadimplentes.length;

    // Agrupar por cliente
    const porCliente = {};
    inadimplentes.forEach(i => {
      if (!porCliente[i.clienteNome]) {
        porCliente[i.clienteNome] = { total: 0, parcelas: 0 };
      }
      porCliente[i.clienteNome].total += parseFloat(i.valor) || 0;
      porCliente[i.clienteNome].parcelas++;
    });

    cont.innerHTML = Object.entries(porCliente).slice(0, 5).map(([nome, info]) => `
      <div class="alert-item">
        <div class="alert-icon">⚠️</div>
        <div class="alert-info">
          <div class="alert-nome">${nome}</div>
          <div class="alert-det">${info.parcelas} parcela(s) em atraso</div>
        </div>
        <div class="alert-val">${Utils.moeda(info.total)}</div>
      </div>`).join('');
  }
};

document.addEventListener('DOMContentLoaded', Dashboard.init);
document.addEventListener('movePe-sync', () => Dashboard.render());
