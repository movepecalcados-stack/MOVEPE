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
    const estoqueBaixo = prods.filter(p => DB.Produtos.estoqueTotal(p) <= (p.estoqueMinimo || 5)).length;

    const inadimplentes = DB.Crediario.inadimplentes();
    const totalInad = inadimplentes.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
    const clientesInad = [...new Set(inadimplentes.map(i => i.clienteNome))].length;

    document.getElementById('statVendasHoje').textContent = Utils.moeda(totalHoje);
    document.getElementById('statQtdHoje').textContent = vendasHoje.length + ' venda(s)';
    document.getElementById('statFaturamentoMes').textContent = Utils.moeda(totalMes);
    document.getElementById('statQtdMes').textContent = vendasMes.length + ' venda(s)';
    document.getElementById('statEstoqueBaixo').textContent = estoqueBaixo;
    document.getElementById('statInadimplentes').textContent = clientesInad;
    document.getElementById('statTotalInad').textContent = Utils.moeda(totalInad);
  },

  renderGrafico7Dias: () => {
    const dados = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
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
      .filter(p => p.totalEstoque <= (p.estoqueMinimo || 5))
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
      const minimo = p.estoqueMinimo || 5;
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

    // Crediário recebido hoje
    const credHoje = DB.FluxoCaixa.listar()
      .filter(f => f.categoria === 'crediario' && f.data && f.data.startsWith(hoje));
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
