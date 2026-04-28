/**
 * MOVE PÉ — Tráfego & Conversões
 */

const TrafegoModule = {

  _dados: [],
  _receita: 0,

  init: () => {
    Utils.renderNav('trafego.html');
    TrafegoModule.renderSemaforo();
    TrafegoModule.renderOrcamento();
    TrafegoModule.renderSetup();
    TrafegoModule.carregarDados();
  },

  // ─── Helpers ──────────────────────────────────────────
  _getDb: () => {
    try { return firebase.app().firestore(); } catch(e) { return null; }
  },

  _diasAtras: (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0, 10);
  },

  _periodoAtual: () => parseInt(document.getElementById('filtroPeriodo')?.value || 30),

  _trackingUrl: () => (localStorage.getItem('movePe_trackingUrl') || '').replace(/\/$/, ''),

  // ─── Semáforo de Investimento ─────────────────────────
  renderSemaforo: () => {
    const cont = document.getElementById('cardSemaforo');
    if (!cont) return;

    const hoje = Utils.hoje();
    const em7  = new Date(); em7.setDate(em7.getDate() + 7);
    const ate7 = `${em7.getFullYear()}-${String(em7.getMonth()+1).padStart(2,'0')}-${String(em7.getDate()).padStart(2,'0')}`;

    // Contas vencidas + vencendo em 7 dias
    const despesas = DB.Despesas.listar().filter(d => !d.pago);
    const vencidas = despesas.filter(d => d.vencimento && d.vencimento < hoje);
    const proximas = despesas.filter(d => d.vencimento && d.vencimento >= hoje && d.vencimento <= ate7);
    const totVencidas = vencidas.reduce((s,d) => s + (parseFloat(d.valor)||0), 0);
    const totProximas = proximas.reduce((s,d) => s + (parseFloat(d.valor)||0), 0);
    const totalUrgente = totVencidas + totProximas;

    // Crediário a receber em 7 dias
    let credProx7 = 0;
    DB.Crediario.listar().forEach(c => {
      (c.parcelas||[]).forEach(p => {
        if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= ate7)
          credProx7 += parseFloat(p.valor)||0;
      });
    });

    // Inadimplência (já vencida)
    let credVencido = 0;
    DB.Crediario.listar().forEach(c => {
      (c.parcelas||[]).forEach(p => {
        if (p.status !== 'pago' && p.vencimento && p.vencimento < hoje)
          credVencido += parseFloat(p.valor)||0;
      });
    });

    // Saldo salvo no painel de prioridades
    const saldoCaixa = parseFloat(DB.Config.get('fluxoSaldoInicial', 0)) || 0;
    const orcamentoSemanal = parseFloat(DB.Config.get('orcamentoSemanalTrafego', 0)) || 0;

    // Lógica do semáforo
    const folga = saldoCaixa + credProx7 - totalUrgente;
    let sinal, cor, bgCor, bordaCor, titulo, descricao, conselho;

    if (totVencidas > 0 && folga < 0) {
      sinal = '🔴'; cor = 'var(--danger)'; bgCor = 'rgba(239,68,68,.07)'; bordaCor = 'rgba(239,68,68,.4)';
      titulo = 'Não invista em tráfego agora';
      descricao = `Você tem ${Utils.moeda(totVencidas)} em contas vencidas e o caixa está no negativo. Cada real gasto em anúncio agora é dinheiro que falta para pagar conta.`;
      conselho = `Primeiro: quite as contas vencidas e receba os ${Utils.moeda(credVencido)} de crediário em atraso. Depois volte a investir.`;
    } else if (folga < orcamentoSemanal || totalUrgente > saldoCaixa * 0.7) {
      sinal = '🟡'; cor = 'var(--warning)'; bgCor = 'rgba(234,179,8,.07)'; bordaCor = 'rgba(234,179,8,.4)';
      titulo = 'Invista com cautela esta semana';
      descricao = `O caixa está apertado. Há ${Utils.moeda(totalUrgente)} para pagar nos próximos 7 dias e a folga é pequena.`;
      conselho = `Se for investir, limite a ${Utils.moeda(Math.min(orcamentoSemanal, Math.max(0, folga * 0.3)))} esta semana — não comprometa o pagamento das contas.`;
    } else {
      sinal = '🟢'; cor = 'var(--success)'; bgCor = 'rgba(34,197,94,.07)'; bordaCor = 'rgba(34,197,94,.4)';
      titulo = 'Sinal verde — pode investir';
      descricao = `As contas da semana estão cobertas e há uma folga de ${Utils.moeda(folga)} no caixa. Bom momento para investir em tráfego.`;
      conselho = orcamentoSemanal > 0
        ? `Seu orçamento desta semana é ${Utils.moeda(orcamentoSemanal)}. Não ultrapasse para manter a saúde do caixa.`
        : 'Configure seu orçamento semanal abaixo para ter mais controle.';
    }

    cont.innerHTML = `
      <div style="background:${bgCor};border:1px solid ${bordaCor};border-radius:var(--radius);padding:16px 20px">
        <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="font-size:40px;line-height:1;flex-shrink:0">${sinal}</div>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:800;font-size:16px;color:${cor};margin-bottom:4px">${titulo}</div>
            <div style="font-size:13px;color:var(--text);margin-bottom:6px">${descricao}</div>
            <div style="font-size:12px;color:var(--text-muted);font-style:italic">${conselho}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;flex-shrink:0;min-width:160px">
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:var(--text-muted)">Saldo em caixa:</span>
              <strong>${Utils.moeda(saldoCaixa)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:var(--text-muted)">Contas 7 dias:</span>
              <strong style="color:var(--danger)">${Utils.moeda(totalUrgente)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:var(--text-muted)">Crediário 7 dias:</span>
              <strong style="color:var(--success)">${Utils.moeda(credProx7)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid var(--border);padding-top:4px;margin-top:2px">
              <span style="color:var(--text-muted)">Folga:</span>
              <strong style="color:${folga >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.moeda(folga)}</strong>
            </div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-muted);border-top:1px solid ${bordaCor};padding-top:8px">
          Saldo em caixa desatualizado? Atualize em <a href="financeiro.html" style="color:var(--primary)">Financeiro → Prioridades</a>
        </div>
      </div>`;
  },

  // ─── Orçamento Semanal + Histórico ────────────────────
  renderOrcamento: () => {
    const cont = document.getElementById('cardOrcamento');
    if (!cont) return;

    const orcamento = parseFloat(DB.Config.get('orcamentoSemanalTrafego', 0)) || 0;
    const historico = DB.Config.get('trafegoInvestimentos', []);

    // Semana atual (ISO week)
    const agora = new Date();
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - agora.getDay() + 1); // segunda-feira
    const semanaKey = inicioSemana.toISOString().slice(0, 10);
    const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6);
    const semanaLabel = `${inicioSemana.getDate().toString().padStart(2,'0')}/${(inicioSemana.getMonth()+1).toString().padStart(2,'0')} – ${fimSemana.getDate().toString().padStart(2,'0')}/${(fimSemana.getMonth()+1).toString().padStart(2,'0')}`;

    const semanaAtual = historico.find(h => h.semana === semanaKey);
    const gastoSemana = semanaAtual ? parseFloat(semanaAtual.gasto) || 0 : 0;
    const roasSemana  = semanaAtual ? parseFloat(semanaAtual.roas)  || 0 : 0;
    const pctGasto = orcamento > 0 ? Math.min(100, Math.round((gastoSemana / orcamento) * 100)) : 0;
    const corBarra = pctGasto >= 100 ? 'var(--danger)' : pctGasto >= 80 ? 'var(--warning)' : 'var(--success)';

    const ultimas5 = [...historico].reverse().slice(0, 5);

    cont.innerHTML = `
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">💰 Orçamento Semanal de Tráfego</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

          <!-- Config do orçamento -->
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">ORÇAMENTO POR SEMANA</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <input type="number" id="inputOrcTrafego" value="${orcamento||''}" min="0" step="10"
                placeholder="R$ 0,00"
                style="width:110px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:16px;font-weight:700;text-align:center">
              <button onclick="TrafegoModule.salvarOrcamento()" class="btn btn-primary btn-sm">Salvar</button>
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px">
              = ${Utils.moeda(orcamento * 4)}/mês · ${orcamento > 0 ? (orcamento / Math.max(1, parseFloat(DB.Vendas.listarPorPeriodo(Utils.hoje().substring(0,7)+'-01', Utils.hoje()).reduce((s,v)=>s+(parseFloat(v.total)||0),0)||1)) * 100).toFixed(1) + '% do faturamento atual' : 'defina um valor para ver a proporção'}
            </div>
          </div>

          <!-- Esta semana -->
          <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">ESTA SEMANA (${semanaLabel})</div>
            ${orcamento > 0 ? `
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
              <span style="font-weight:700;color:${corBarra}">${Utils.moeda(gastoSemana)}</span>
              <span style="color:var(--text-muted)">de ${Utils.moeda(orcamento)}</span>
            </div>
            <div style="background:var(--border);border-radius:4px;height:10px;overflow:hidden;margin-bottom:6px">
              <div style="height:100%;width:${pctGasto}%;background:${corBarra};border-radius:4px;transition:width .4s"></div>
            </div>
            <div style="font-size:12px;color:var(--text-muted)">${pctGasto}% utilizado${gastoSemana > 0 && roasSemana > 0 ? ` · ROAS ${roasSemana.toFixed(1)}x` : ''}</div>
            ` : '<div style="font-size:13px;color:var(--text-muted)">Defina um orçamento ao lado</div>'}
          </div>
        </div>

        <!-- Registrar investimento -->
        <div style="background:var(--bg);border-radius:var(--radius-sm);padding:14px;border:1px solid var(--border);margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:10px">REGISTRAR INVESTIMENTO DA SEMANA</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:6px;font-size:13px">
              <label style="font-weight:600;white-space:nowrap">Gasto:</label>
              <input type="number" id="inputGastoSemana" value="${gastoSemana||''}" min="0" step="0.01" placeholder="R$ 0,00"
                style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-weight:700;text-align:center"
                oninput="TrafegoModule._previewRoasOrcamento()">
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px">
              <label style="font-weight:600;white-space:nowrap">Receita gerada:</label>
              <input type="number" id="inputReceitaSemana" value="${semanaAtual?.receita||''}" min="0" step="0.01" placeholder="R$ 0,00"
                style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:14px;font-weight:700;text-align:center"
                oninput="TrafegoModule._previewRoasOrcamento()">
            </div>
            <div style="font-size:13px;font-weight:700;color:var(--primary);min-width:60px" id="previewRoasOrc"></div>
            <button onclick="TrafegoModule.salvarInvestimentoSemana()" class="btn btn-success btn-sm">✅ Salvar semana</button>
          </div>
          ${pctGasto >= 80 && orcamento > 0 ? `<div style="margin-top:8px;font-size:12px;color:${pctGasto>=100?'var(--danger)':'var(--warning)'};font-weight:600">${pctGasto>=100?'🚨 Orçamento ultrapassado! Pause os anúncios.':'⚠ Você está em '+pctGasto+'% do orçamento semanal.'}</div>` : ''}
        </div>

        <!-- Histórico -->
        ${ultimas5.length === 0 ? '' : `
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">HISTÓRICO DE INVESTIMENTOS</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="border-bottom:2px solid var(--border)">
                <th style="padding:6px 10px;text-align:left;color:var(--text-muted);font-weight:600">Semana</th>
                <th style="padding:6px 10px;text-align:right;color:var(--text-muted);font-weight:600">Gasto</th>
                <th style="padding:6px 10px;text-align:right;color:var(--text-muted);font-weight:600">Receita</th>
                <th style="padding:6px 10px;text-align:right;color:var(--text-muted);font-weight:600">ROAS</th>
                <th style="padding:6px 10px;text-align:right;color:var(--text-muted);font-weight:600">vs Meta</th>
              </tr></thead>
              <tbody>
                ${ultimas5.map(h => {
                  const g = parseFloat(h.gasto)||0;
                  const r = parseFloat(h.receita)||0;
                  const roas = g > 0 ? r/g : 0;
                  const corRoas = roas >= 5 ? 'var(--primary)' : roas >= 3 ? 'var(--success)' : roas >= 2 ? 'var(--warning)' : roas > 0 ? 'var(--danger)' : 'var(--text-muted)';
                  const vs = orcamento > 0 ? Math.round((g/orcamento)*100) : null;
                  const corVs = vs > 100 ? 'var(--danger)' : vs > 80 ? 'var(--warning)' : 'var(--success)';
                  const semStr = h.semana ? h.semana.slice(5).replace('-','/') : '—';
                  return `<tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:7px 10px">Sem. ${semStr}</td>
                    <td style="padding:7px 10px;text-align:right;font-weight:600">${Utils.moeda(g)}</td>
                    <td style="padding:7px 10px;text-align:right">${r > 0 ? Utils.moeda(r) : '—'}</td>
                    <td style="padding:7px 10px;text-align:right;font-weight:800;color:${corRoas}">${roas > 0 ? roas.toFixed(1)+'x' : '—'}</td>
                    <td style="padding:7px 10px;text-align:right;font-size:12px;color:${corVs}">${vs !== null ? vs+'%' : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`}
      </div>`;
  },

  _previewRoasOrcamento: () => {
    const g = parseFloat(document.getElementById('inputGastoSemana')?.value) || 0;
    const r = parseFloat(document.getElementById('inputReceitaSemana')?.value) || 0;
    const el = document.getElementById('previewRoasOrc');
    if (!el) return;
    if (g > 0 && r > 0) {
      const roas = r / g;
      const cor = roas >= 5 ? 'var(--primary)' : roas >= 3 ? 'var(--success)' : roas >= 2 ? 'var(--warning)' : 'var(--danger)';
      el.innerHTML = `ROAS: <span style="color:${cor}">${roas.toFixed(1)}x</span>`;
    } else {
      el.textContent = '';
    }
  },

  salvarOrcamento: () => {
    const val = parseFloat(document.getElementById('inputOrcTrafego')?.value) || 0;
    DB.Config.set('orcamentoSemanalTrafego', val);
    TrafegoModule.renderSemaforo();
    TrafegoModule.renderOrcamento();
    Utils.toast(`Orçamento semanal definido em ${Utils.moeda(val)}`, 'success');
  },

  salvarInvestimentoSemana: () => {
    const gasto   = parseFloat(document.getElementById('inputGastoSemana')?.value)   || 0;
    const receita = parseFloat(document.getElementById('inputReceitaSemana')?.value) || 0;
    if (gasto <= 0) { Utils.toast('Informe o valor gasto', 'error'); return; }

    const agora = new Date();
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - agora.getDay() + 1);
    const semanaKey = inicioSemana.toISOString().slice(0, 10);

    const historico = DB.Config.get('trafegoInvestimentos', []);
    const idx = historico.findIndex(h => h.semana === semanaKey);
    const roas = receita > 0 && gasto > 0 ? +(receita / gasto).toFixed(2) : 0;
    const entrada = { semana: semanaKey, gasto, receita, roas };
    if (idx >= 0) historico[idx] = entrada;
    else historico.push(entrada);
    historico.sort((a,b) => a.semana.localeCompare(b.semana));

    DB.Config.set('trafegoInvestimentos', historico);
    TrafegoModule.renderOrcamento();
    TrafegoModule.renderSemaforo();
    Utils.toast('Investimento da semana salvo!', 'success');
  },

  // ─── Setup ────────────────────────────────────────────
  renderSetup: () => {
    const url = TrafegoModule._trackingUrl();
    const setup = document.getElementById('setupSection');
    if (!setup) return;

    if (!url) {
      setup.innerHTML = `
        <div class="card" style="margin-bottom:20px">
          <div class="card-title" style="margin-bottom:16px">🚀 Configure o Rastreamento em 3 passos</div>

          <div class="tf-step">
            <div class="tf-step-num">1</div>
            <div>
              <div style="font-weight:600;margin-bottom:4px">Baixe a página de rastreamento</div>
              <div class="text-muted fs-sm" style="margin-bottom:8px">
                O sistema gera automaticamente um arquivo HTML com sua configuração já embutida.
              </div>
              <button class="btn btn-primary btn-sm" onclick="TrafegoModule.abrirConfig()">⬇️ Gerar e baixar página</button>
            </div>
          </div>

          <div class="tf-step">
            <div class="tf-step-num">2</div>
            <div>
              <div style="font-weight:600;margin-bottom:4px">Publique no Vercel (grátis, 2 minutos)</div>
              <div class="text-muted fs-sm">
                1. Acesse <strong>vercel.com</strong> e crie uma conta grátis com seu email<br>
                2. Clique em "Add New → Project"<br>
                3. Arraste o arquivo baixado para a tela<br>
                4. Clique em Deploy — pronto! Você receberá uma URL como <code>movepecalcados.vercel.app</code>
              </div>
            </div>
          </div>

          <div class="tf-step">
            <div class="tf-step-num">3</div>
            <div>
              <div style="font-weight:600;margin-bottom:4px">Cole a URL aqui e use os links no Instagram</div>
              <div class="text-muted fs-sm" style="margin-bottom:8px">Após o deploy, insira a URL do Vercel abaixo.</div>
              <div style="display:flex;gap:8px;align-items:center">
                <input type="text" id="urlSetupInput" class="form-control" placeholder="https://movepecalcados.vercel.app" style="max-width:340px">
                <button class="btn btn-success btn-sm" onclick="TrafegoModule.salvarUrlRapido()">Salvar</button>
              </div>
            </div>
          </div>

          <div style="margin-top:16px;padding:12px;background:rgba(59,130,246,0.08);border-radius:8px;border:1px solid var(--primary);font-size:12px;color:var(--text-muted)">
            💡 <strong>Não esqueça:</strong> depois de configurar, atualize o link na bio do Instagram e nas suas campanhas de anúncio para o novo link de rastreamento. A partir daí, cada clique é registrado automaticamente.
          </div>
        </div>`;
    } else {
      setup.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(34,197,94,0.1);border:1px solid var(--success);border-radius:8px;margin-bottom:16px;font-size:13px">
          <span style="color:var(--success);font-weight:700">✅ Rastreamento ativo</span>
          <span class="text-muted">${url}</span>
          <button class="btn btn-outline btn-sm" style="margin-left:auto" onclick="TrafegoModule.abrirConfig()">⚙️ Editar</button>
        </div>`;
    }
  },

  salvarUrlRapido: () => {
    const url = (document.getElementById('urlSetupInput')?.value || '').trim();
    if (!url) { Utils.toast('Digite a URL', 'error'); return; }
    localStorage.setItem('movePe_trackingUrl', url);
    TrafegoModule.renderSetup();
    TrafegoModule.renderLinks();
    Utils.toast('URL salva! Os links estão prontos.', 'success');
  },

  // ─── Links de rastreamento ─────────────────────────────
  renderLinks: () => {
    const url = TrafegoModule._trackingUrl();
    const card = document.getElementById('linksCard');
    const cont = document.getElementById('linksContainer');
    if (!card || !cont) return;

    if (!url) { card.style.display = 'none'; return; }
    card.style.display = '';

    const links = [
      { label: 'Bio',      o: 'bio',       desc: 'Link fixo na bio do perfil' },
      { label: 'Story',    o: 'story',     desc: 'Stories orgânicos e pagos' },
      { label: 'Anúncio',  o: 'anuncio',   desc: 'Campanhas do Meta Ads' },
      { label: 'Reels',    o: 'reels',     desc: 'Link em reels/vídeos' },
    ];

    cont.innerHTML = links.map(l => {
      const href = `${url}?o=${l.o}`;
      return `
        <div class="tf-link-row">
          <span class="tf-link-label">${l.label}</span>
          <span class="tf-link-url" title="${href}">${href}</span>
          <button class="btn btn-outline btn-sm" onclick="TrafegoModule.copiar('${href}','${l.label}')">📋 Copiar</button>
        </div>`;
    }).join('');
  },

  copiar: (texto, nome) => {
    navigator.clipboard.writeText(texto)
      .then(() => Utils.toast(`Link "${nome}" copiado!`, 'success'))
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = texto;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        Utils.toast(`Link "${nome}" copiado!`, 'success');
      });
  },

  // ─── Carregar dados do Firestore ───────────────────────
  carregarDados: () => {
    TrafegoModule.renderLinks();

    const url = TrafegoModule._trackingUrl();
    const mainContent = document.getElementById('mainContent');
    const metricsCards = document.getElementById('metricsCards');
    const statusMsg = document.getElementById('statusMsg');

    if (!url) {
      if (mainContent) mainContent.style.display = 'none';
      if (metricsCards) metricsCards.style.display = 'none';
      return;
    }

    if (statusMsg) { statusMsg.style.display = ''; statusMsg.textContent = 'Carregando dados...'; }

    // Calcula receita dos clientes Instagram no período
    const dias = TrafegoModule._periodoAtual();
    const desde = TrafegoModule._diasAtras(dias);

    const clientes = DB.Clientes.listar().filter(c =>
      c.origem && c.origem.toLowerCase().includes('instagram')
    );
    const clienteIds = new Set(clientes.map(c => c.id));

    let receitaInstagram = 0;
    DB.Vendas.listar().forEach(v => {
      const dataVenda = (v.criadoEm || '').slice(0, 10);
      if (!dataVenda || dataVenda < desde) return;
      if (clienteIds.has(v.clienteId)) {
        receitaInstagram += parseFloat(v.total) || 0;
      }
    });
    TrafegoModule._receita = receitaInstagram;

    document.getElementById('statClientes').textContent = clientes.length;
    document.getElementById('roasReceita').textContent = Utils.moeda(receitaInstagram);
    TrafegoModule.calcularRoas();

    // Busca cliques no Firebase
    const db = TrafegoModule._getDb();
    if (!db) {
      if (statusMsg) { statusMsg.style.display = ''; statusMsg.textContent = 'Firebase não configurado. Acesse Configurações para conectar.'; }
      return;
    }

    db.collection('movePe_trafego')
      .where('data', '>=', desde)
      .get()
      .then(snap => {
        TrafegoModule._dados = snap.docs.map(d => d.data());
        TrafegoModule.renderDados();
        if (statusMsg) statusMsg.style.display = 'none';
        if (mainContent) mainContent.style.display = '';
        if (metricsCards) metricsCards.style.display = '';
      })
      .catch(() => {
        if (statusMsg) { statusMsg.style.display = ''; statusMsg.textContent = 'Ainda sem dados de rastreamento. Use os links acima no Instagram para começar.'; }
        if (metricsCards) metricsCards.style.display = '';
        TrafegoModule.renderDadosVazios();
      });
  },

  renderDadosVazios: () => {
    document.getElementById('statCliques').textContent = '0';
    document.getElementById('statMedia').textContent = '0';
    document.getElementById('statRoas').textContent = '—';
  },

  renderDados: () => {
    const dados = TrafegoModule._dados;
    const dias  = TrafegoModule._periodoAtual();

    // ── Cards
    const total   = dados.length;
    const media   = (total / dias).toFixed(1);
    document.getElementById('statCliques').textContent = total;
    document.getElementById('statMedia').textContent   = media;
    TrafegoModule.calcularRoas();

    // ── Gráfico de barras diário
    const desde = TrafegoModule._diasAtras(dias);
    const porDia = {};
    dados.forEach(d => { porDia[d.data] = (porDia[d.data] || 0) + 1; });

    // Gera últimos N dias (ou últimos 14 se período for maior)
    const diasGrafico = Math.min(dias, 30);
    const datas = [];
    for (let i = diasGrafico - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      datas.push(d.toISOString().slice(0, 10));
    }

    const maxVal = Math.max(...datas.map(d => porDia[d] || 0), 1);
    const grafico = document.getElementById('graficoBarras');
    const sub = document.getElementById('graficoSub');
    if (sub) sub.textContent = `Últimos ${diasGrafico} dias — total ${total} cliques`;

    if (grafico) {
      grafico.innerHTML = `<div class="tf-bar-wrap">` +
        datas.map(d => {
          const v = porDia[d] || 0;
          const pct = Math.round((v / maxVal) * 100);
          const label = d.slice(5).replace('-', '/'); // MM/DD
          return `
            <div class="tf-bar-row">
              <span class="tf-bar-label">${label}</span>
              <div class="tf-bar-track">
                <div class="tf-bar-fill" style="width:${pct}%">
                  ${v > 0 ? `<span class="tf-bar-val">${v}</span>` : ''}
                </div>
              </div>
            </div>`;
        }).join('') + `</div>`;
    }

    // ── Por origem
    const porOrigem = {};
    dados.forEach(d => { porOrigem[d.origem || 'direto'] = (porOrigem[d.origem || 'direto'] || 0) + 1; });
    const origemOrdenada = Object.entries(porOrigem).sort((a, b) => b[1] - a[1]);
    const origemIcons = { bio: '📌', story: '📖', anuncio: '💰', reels: '🎬', direto: '🔗' };

    const origensEl = document.getElementById('origensLista');
    if (origensEl) {
      origensEl.innerHTML = origemOrdenada.map(([orig, cnt]) => {
        const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
        return `
          <div class="tf-origem-row">
            <span>${origemIcons[orig] || '📍'} <strong>${orig}</strong></span>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700">${cnt}</span>
              <span class="badge badge-warning" style="font-size:10px">${pct}%</span>
            </div>
          </div>`;
      }).join('') || '<div class="text-muted fs-sm">Sem dados no período</div>';
    }

    // ── Por horário (top 5 horas)
    const porHora = {};
    dados.forEach(d => { if (d.hora != null) porHora[d.hora] = (porHora[d.hora] || 0) + 1; });
    const maxHora = Math.max(...Object.values(porHora), 1);
    const horaOrdenada = Object.entries(porHora)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const horariosEl = document.getElementById('horarioBarras');
    if (horariosEl && horaOrdenada.length > 0) {
      horariosEl.innerHTML = `<div class="tf-bar-wrap">` +
        horaOrdenada.map(([h, v]) => {
          const pct = Math.round((v / maxHora) * 100);
          return `
            <div class="tf-bar-row">
              <span class="tf-bar-label">${h}h</span>
              <div class="tf-bar-track">
                <div class="tf-bar-fill" style="width:${pct}%;background:var(--success)">
                  <span class="tf-bar-val">${v}</span>
                </div>
              </div>
            </div>`;
        }).join('') + `</div>`;
    } else if (horariosEl) {
      horariosEl.innerHTML = '<div class="text-muted fs-sm">Sem dados</div>';
    }

    // ── Dispositivos
    const mobile   = dados.filter(d => d.dispositivo === 'mobile').length;
    const desktop  = dados.filter(d => d.dispositivo === 'desktop').length;
    const appInsta = dados.filter(d => d.via === 'app_instagram').length;
    const dispEl   = document.getElementById('dispositivosInfo');
    if (dispEl && total > 0) {
      dispEl.innerHTML = `
        <div class="stat-card" style="flex:1;min-width:140px">
          <div class="stat-label">📱 Celular</div>
          <div class="stat-value">${mobile} <span style="font-size:13px;font-weight:400">(${Math.round(mobile/total*100)}%)</span></div>
        </div>
        <div class="stat-card" style="flex:1;min-width:140px">
          <div class="stat-label">🖥️ Desktop</div>
          <div class="stat-value">${desktop} <span style="font-size:13px;font-weight:400">(${Math.round(desktop/total*100)}%)</span></div>
        </div>
        <div class="stat-card" style="flex:1;min-width:140px">
          <div class="stat-label">📸 App Instagram</div>
          <div class="stat-value success">${appInsta} <span style="font-size:13px;font-weight:400">(${Math.round(appInsta/total*100)}%)</span></div>
        </div>`;
    }
  },

  // ─── ROAS ─────────────────────────────────────────────
  calcularRoas: () => {
    const gasto   = parseFloat(document.getElementById('inputGasto')?.value) || 0;
    const receita = TrafegoModule._receita || 0;
    const roasEl  = document.getElementById('roasValor');
    const descEl  = document.getElementById('roasDesc');
    const cardEl  = document.getElementById('statRoas');

    if (!roasEl) return;

    if (gasto <= 0) {
      roasEl.textContent = '—';
      roasEl.style.color = 'var(--primary)';
      if (descEl) descEl.textContent = 'Informe o gasto acima para calcular';
      if (cardEl) cardEl.textContent = '—';
      return;
    }

    const roas = receita / gasto;
    const roasStr = roas.toFixed(2).replace('.', ',') + 'x';
    roasEl.textContent = roasStr;
    if (cardEl) cardEl.textContent = roasStr;

    let cor = 'var(--danger)';
    let msg = '⚠️ Abaixo do esperado — revise a campanha';
    if (roas >= 5)      { cor = 'var(--primary)'; msg = '🚀 Excelente! Campanha muito rentável'; }
    else if (roas >= 3) { cor = 'var(--success)'; msg = '✅ Bom retorno — campanha saudável'; }
    else if (roas >= 2) { cor = 'var(--warning)'; msg = '⚡ Razoável — há espaço para melhorar'; }

    roasEl.style.color = cor;
    if (descEl) descEl.textContent = msg;
    if (cardEl) cardEl.style.color = cor;
  },

  // ─── Config modal ──────────────────────────────────────
  abrirConfig: () => {
    const urlInput = document.getElementById('inputTrackingUrl');
    const msgInput = document.getElementById('inputWaMsg');
    if (urlInput) urlInput.value = localStorage.getItem('movePe_trackingUrl') || '';
    if (msgInput) msgInput.value = localStorage.getItem('movePe_waMensagem') || 'Oi! Vim pelo Instagram e quero ver os calçados 👟';
    Utils.abrirModal('modalTrafegoConfig');
  },

  salvarConfig: () => {
    const url = (document.getElementById('inputTrackingUrl')?.value || '').trim();
    const msg = (document.getElementById('inputWaMsg')?.value || '').trim();
    if (!url) { Utils.toast('Informe a URL', 'error'); return; }
    localStorage.setItem('movePe_trackingUrl', url);
    if (msg) localStorage.setItem('movePe_waMensagem', msg);
    Utils.fecharModal('modalTrafegoConfig');
    TrafegoModule.renderSetup();
    TrafegoModule.carregarDados();
    Utils.toast('Configuração salva!', 'success');
  },

  // ─── Gerador da página de rastreamento ────────────────
  gerarPaginaRastreamento: () => {
    const cfgStr = localStorage.getItem('movePe_fb_config');
    if (!cfgStr) {
      Utils.toast('Firebase não configurado. Vá em Configurações → Firebase primeiro.', 'error');
      return;
    }

    const waMsg  = (localStorage.getItem('movePe_waMensagem') || 'Oi! Vim pelo Instagram e quero ver os calçados 👟').replace(/'/g, "\\'");
    const numero = '5541988423452';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Move Pé Calçados</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf8f5;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:20px}
    .logo{font-size:28px;font-weight:900;color:#1a1a1a;letter-spacing:-1px}
    .sub{font-size:13px;color:#888;letter-spacing:2px;text-transform:uppercase}
    .spinner{width:36px;height:36px;border:3px solid #eee;border-top-color:#25D366;border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .msg{font-size:13px;color:#999}
  </style>
</head>
<body>
  <div class="logo">MOVE PÉ</div>
  <div class="sub">Calçados</div>
  <div class="spinner"></div>
  <div class="msg">Abrindo WhatsApp...</div>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"><\\/script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"><\\/script>
  <script>
    const FIREBASE_CONFIG = ${cfgStr};
    const WHATSAPP        = '${numero}';
    const WHATSAPP_MSG    = encodeURIComponent('${waMsg}');
    const p        = new URLSearchParams(location.search);
    const origem   = p.get('o') || p.get('origem') || 'direto';
    const campanha = p.get('c') || p.get('campanha') || '';
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const db  = firebase.firestore();
      const now = new Date();
      db.collection('movePe_trafego').add({
        origem, campanha,
        ts:          firebase.firestore.FieldValue.serverTimestamp(),
        data:        now.toISOString().slice(0, 10),
        hora:        now.getHours(),
        via:         /instagram/i.test(navigator.userAgent) ? 'app_instagram' : 'browser',
        dispositivo: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      }).catch(()=>{});
    } catch(e) {}
    setTimeout(() => { location.href = 'https://wa.me/' + WHATSAPP + '?text=' + WHATSAPP_MSG; }, 700);
  <\\/script>
</body>
</html>`;

    // Corrige as tags de script escapadas
    const htmlFinal = html.replace(/<\/script>/g, '</script>');
    const blob = new Blob([htmlFinal], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'index.html';
    a.click();
    URL.revokeObjectURL(a.href);
    Utils.toast('Arquivo baixado! Siga os passos para publicar no Vercel.', 'success');
  }
};

document.addEventListener('DOMContentLoaded', TrafegoModule.init);
