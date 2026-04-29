/**
 * MOVE PÉ - WhatsApp Automático v1.0
 * Envio de mensagens personalizadas para clientes via WhatsApp Web
 */

// ---- TEMPLATES ----
const WA_TEMPLATES = [
  {
    id: 'vencendo',
    label: '📅 Lembrete Amigável',
    icon: '📅',
    filtroSugerido: 'vencendo',
    mensagem:
`Oi, {nome}! Tudo bem? 😊

Passando aqui rapidinho só pra te lembrar que sua parcela do crediário na *{loja}* vence em breve.

💰 Valor: *{valor}*
📅 Vencimento: *{vencimento}*

Se quiser já adiantar o pagamento ou tiver alguma dúvida, é só nos chamar aqui ou ligar:
📞 {telLoja}

Qualquer coisa a gente resolve junto! 😊`,
  },
  {
    id: 'cobranca',
    label: '⚠️ 1ª Cobrança',
    icon: '⚠️',
    filtroSugerido: 'inadimplentes',
    mensagem:
`Oi, {nome}! 😊

Tudo bem? Aqui é da *{loja}*, passando para dar um aviso importante.

Identificamos que há uma parcela do seu crediário em atraso:

💰 Valor: *{valor}*
📅 Venceu em: *{vencimento}* ({diasAtraso} dia(s) em atraso)

Sabemos que imprevistos acontecem, e estamos aqui para ajudar! Entre em contato com a gente para a gente encontrar a melhor forma de regularizar, tá?

📞 {telLoja}

Obrigado pela atenção! 🙏`,
  },
  {
    id: 'cobranca2',
    label: '🔔 2ª Cobrança',
    icon: '🔔',
    filtroSugerido: 'inadimplentes',
    mensagem:
`Oi, {nome}, bom dia! 😊

Aqui é da *{loja}* novamente. Percebemos que a parcela abaixo ainda está em aberto:

💰 Valor: *{valor}*
📅 Venceu em: *{vencimento}* ({diasAtraso} dia(s) em atraso)

Gostaríamos muito de resolver isso de forma tranquila, sem complicação pra nenhum dos dois lados. 🤝

⚠️ Para evitar qualquer transtorno futuro, pedimos que entre em contato o quanto antes para regularizar.

📞 {telLoja}

Estamos à disposição! 😊`,
  },
  {
    id: 'cobranca_serasa',
    label: '🚨 Aviso SPC/Serasa',
    icon: '🚨',
    filtroSugerido: 'inadimplentes',
    mensagem:
`Oi, {nome}. Aqui é da *{loja}*.

Tentamos entrar em contato antes e ainda não conseguimos resolver a parcela em aberto:

💰 Valor: *{valor}*
📅 Venceu em: *{vencimento}* ({diasAtraso} dia(s) em atraso)

Precisamos te informar que débitos não regularizados podem resultar na inclusão do seu nome nos órgãos de proteção ao crédito, como *SPC e Serasa*, o que pode dificultar compras a prazo, financiamentos e cartões no futuro.

Queremos muito evitar isso! Entre em contato *hoje* para a gente encontrar uma solução:

📞 {telLoja}

Estamos esperando seu retorno. 🙏`,
  },
  {
    id: 'aniversario',
    label: 'Aniversário 🎂',
    icon: '🎂',
    filtroSugerido: 'aniversario_hoje',
    mensagem:
`🎉 Feliz Aniversário, {nome}!

A equipe da *{loja}* deseja um dia muito especial para você! 🥳🎁

Que tal comemorar seu aniversário com um calçado novo? Venha nos visitar e ganhe uma surpresa especial! 🎀

Com carinho,
*{loja}* 👟`,
  },
  {
    id: 'promocao',
    label: 'Promoção',
    icon: '🔥',
    filtroSugerido: 'todos',
    mensagem:
`Oi, {nome}! 🔥

*PROMOÇÃO ESPECIAL* na {loja}!

Confira nossas ofertas imperdíveis com até 50% de desconto em produtos selecionados! 👟✨

🏃 Corra! Estoque limitado!

📞 {telLoja}
📍 Venha nos visitar!`,
  },
  {
    id: 'reativacao',
    label: 'Saudades! 💛',
    icon: '💛',
    filtroSugerido: 'reativacao',
    mensagem:
`Olá, {nome}! Sentimos sua falta! 💛

Faz um tempinho que você não passa na *{loja}* e gostaríamos de te ver por aqui de novo!

🆕 Chegaram muitas novidades que com certeza vão te surpreender!
👟 Novos modelos, novas cores, novos tamanhos!

Venha conferir! Te esperamos com muito carinho. 😊

📞 {telLoja}`,
  },
  {
    id: 'personalizada',
    label: 'Personalizada',
    icon: '✏️',
    filtroSugerido: 'todos',
    mensagem: '',
  },
];

// ---- ESTADO ----
let _templateAtual = WA_TEMPLATES[0];
let _listaContatos = []; // [{cliente, extra, mensagem, enviado}]
let _mostrarContatados = false;

const WA = {

  init: () => {
    Utils.renderNav('whatsapp.html');
    WA._renderTemplates();
    WA._selecionarTemplate(WA_TEMPLATES[0]);
    WA._atualizarFiltroInfo();
    WA.setTab('cobDiaria');
  },

  setTab: (tab, btn) => {
    document.querySelectorAll('.wa-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('secaoCobDiaria').style.display  = tab === 'cobDiaria' ? '' : 'none';
    document.getElementById('secaoTemplates').style.display  = tab === 'templates' ? '' : 'none';
    if (tab === 'cobDiaria') WA.renderCobDiaria();
  },

  // ---- COBRANÇA DO DIA ----

  // Histórico: { clienteId: [ { data, diasAtraso, template }, ... ] }
  _getHistorico: () => JSON.parse(localStorage.getItem('movePe_wa_historico') || '{}'),
  _setHistorico: (data) => localStorage.setItem('movePe_wa_historico', JSON.stringify(data)),

  // Quantos dias esperar antes do próximo contato
  _intervaloPorDias: (diasAtraso) => {
    if (diasAtraso <= 30) return 7;
    if (diasAtraso <= 60) return 4;
    return 2;
  },

  // Retorna { ultimoContato, proximoContato, contatadoHoje, totalContatos }
  _statusContato: (clienteId, diasAtraso) => {
    const hist = WA._getHistorico();
    const registros = hist[clienteId] || [];
    if (registros.length === 0) return { ultimoContato: null, proximoContato: null, contatadoHoje: false, totalContatos: 0 };
    const ultimo = registros[registros.length - 1];
    const hoje = Utils.hoje();
    const intervalo = WA._intervaloPorDias(diasAtraso);
    const dProximo = new Date(ultimo.data + 'T12:00:00');
    dProximo.setDate(dProximo.getDate() + intervalo);
    const proximoContato = dProximo.toISOString().substring(0, 10);
    return {
      ultimoContato: ultimo.data,
      proximoContato,
      contatadoHoje: ultimo.data === hoje,
      totalContatos: registros.length,
    };
  },

  // Deve aparecer na lista de hoje?
  _deveContatarHoje: (clienteId, diasAtraso) => {
    if (diasAtraso < 6) return false; // dentro da carência
    const s = WA._statusContato(clienteId, diasAtraso);
    if (!s.ultimoContato) return true; // nunca contatado
    const hoje = Utils.hoje();
    return s.proximoContato <= hoje;
  },

  marcarContatado: (clienteId, diasAtraso, templateId) => {
    const hist = WA._getHistorico();
    if (!hist[clienteId]) hist[clienteId] = [];
    hist[clienteId].push({ data: Utils.hoje(), diasAtraso, template: templateId || '' });
    WA._setHistorico(hist);
    WA.renderCobDiaria();
    Utils.toast('Contato registrado!', 'success');
  },

  _toggleMostrarContatados: () => {
    _mostrarContatados = !_mostrarContatados;
    WA.renderCobDiaria();
  },

  _getTemplatePorDias: (dias) => {
    if (dias <= 7)  return WA_TEMPLATES.find(t => t.id === 'vencendo')     || WA_TEMPLATES[0];
    if (dias <= 20) return WA_TEMPLATES.find(t => t.id === 'cobranca')     || WA_TEMPLATES[1];
    if (dias <= 45) return WA_TEMPLATES.find(t => t.id === 'cobranca2')    || WA_TEMPLATES[2];
    return              WA_TEMPLATES.find(t => t.id === 'cobranca_serasa') || WA_TEMPLATES[3];
  },

  _corPorDias: (dias) => {
    if (dias <= 7)  return 'var(--warning)';
    if (dias <= 20) return 'var(--danger)';
    if (dias <= 45) return '#dc2626';
    return '#7f1d1d';
  },

  _labelDias: (dias) => {
    if (dias <= 7)  return `${dias}d de atraso`;
    if (dias <= 20) return `${dias}d ⚠️`;
    if (dias <= 45) return `${dias}d 🔴`;
    return `${dias}d 🚨`;
  },

  _substituirVarsCompleto: (template, cli, extra, loja, telLoja) => {
    const primeiro = (cli.nome || '').split(' ')[0];
    const diasAtraso = extra.diasAtraso || 0;
    return template
      .replace(/{nome}/g, primeiro)
      .replace(/{nomeCompleto}/g, cli.nome || '')
      .replace(/{loja}/g, loja)
      .replace(/{telLoja}/g, telLoja ? Utils.telefone(telLoja) : loja)
      .replace(/{valor}/g, extra.valor ? Utils.moeda(extra.valor) : '')
      .replace(/{totalDevido}/g, extra.totalDevido ? Utils.moeda(extra.totalDevido) : '')
      .replace(/{qtdParcelas}/g, (extra.qtdParcelas || 1) + (extra.qtdParcelas > 1 ? ' parcelas' : ' parcela'))
      .replace(/{vencimento}/g, extra.vencimento ? Utils.data(extra.vencimento) : '')
      .replace(/{diasAtraso}/g, diasAtraso > 0 ? diasAtraso + ' dia' + (diasAtraso > 1 ? 's' : '') : '');
  },

  renderCobDiaria: () => {
    const cont = document.getElementById('secaoCobDiaria');
    if (!cont) return;

    const hoje = Utils.hoje();
    const loja   = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const telLoja = DB.Config.get('whatsapp', '') || DB.Config.get('telefone', '');

    // Agrupa parcelas em atraso por cliente
    const clientesMap = {};
    DB.Crediario.listar().forEach(cred => {
      if (!cred.parcelas) return;
      const emAtraso = cred.parcelas.filter(p => p.status !== 'pago' && p.vencimento < hoje);
      if (emAtraso.length === 0) return;
      const cli = DB.Clientes.buscar(cred.clienteId);
      if (!cli) return;
      const id = cred.clienteId;
      if (!clientesMap[id]) clientesMap[id] = { cliente: cli, parcelas: [], totalDevido: 0, diasMaxAtraso: 0 };
      emAtraso.forEach(p => {
        const dias = Math.floor((new Date(hoje) - new Date(p.vencimento + 'T12:00:00')) / 86400000);
        clientesMap[id].parcelas.push({ ...p, diasAtraso: dias });
        clientesMap[id].totalDevido += parseFloat(p.valor) || 0;
        if (dias > clientesMap[id].diasMaxAtraso) clientesMap[id].diasMaxAtraso = dias;
      });
    });

    // Enriquece com status de contato
    const todos = Object.values(clientesMap).map(item => ({
      ...item,
      status: WA._statusContato(item.cliente.id, item.diasMaxAtraso),
    })).sort((a, b) => (b.diasMaxAtraso * Math.sqrt(b.totalDevido)) - (a.diasMaxAtraso * Math.sqrt(a.totalDevido)));

    const comTel     = todos.filter(c => c.cliente.telefone);
    const semTel     = todos.filter(c => !c.cliente.telefone);
    const paraHoje   = comTel.filter(c => WA._deveContatarHoje(c.cliente.id, c.diasMaxAtraso));
    const aguardando = comTel.filter(c => !WA._deveContatarHoje(c.cliente.id, c.diasMaxAtraso));
    const jaContatadosHoje = paraHoje.filter(c => c.status.contatadoHoje);
    const pendentes  = paraHoje.filter(c => !c.status.contatadoHoje);
    const totalEmAberto = todos.reduce((s, c) => s + c.totalDevido, 0);

    const renderItem = (item, dimmed) => {
      const cli = item.cliente;
      const tel = (cli.telefone || '').replace(/\D/g, '');
      const tpl = WA._getTemplatePorDias(item.diasMaxAtraso);
      const parcelaMaisAntiga = [...item.parcelas].sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
      const mensagem = WA._substituirVarsCompleto(tpl.mensagem, cli, {
        valor: item.totalDevido,
        vencimento: parcelaMaisAntiga.vencimento,
        diasAtraso: item.diasMaxAtraso,
        totalDevido: item.totalDevido,
        qtdParcelas: item.parcelas.length,
      }, loja, telLoja);
      const link = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;
      const { ultimoContato, proximoContato, contatadoHoje, totalContatos } = item.status;
      const cor = WA._corPorDias(item.diasMaxAtraso);

      // Info de histórico
      let historicoInfo = '';
      if (contatadoHoje) {
        const intervalo = WA._intervaloPorDias(item.diasMaxAtraso);
        historicoInfo = `<span style="color:var(--success);font-weight:600">✅ Contatado hoje</span> · próximo em <strong>${intervalo} dias</strong> (${Utils.data(proximoContato)})`;
      } else if (ultimoContato) {
        historicoInfo = `Último contato: ${Utils.data(ultimoContato)} · ${totalContatos}x no total`;
      } else {
        historicoInfo = `<span style="color:var(--warning);font-weight:600">Nunca contatado</span>`;
      }

      return `
        <div style="padding:14px 16px;border-bottom:1px solid var(--border);${dimmed ? 'opacity:.5' : ''}">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-weight:700;font-size:14px">${cli.nome}</span>
                <span style="font-size:11px;font-weight:700;color:${cor};background:${cor}20;padding:2px 8px;border-radius:10px">${WA._labelDias(item.diasMaxAtraso)}</span>
              </div>
              <div style="font-size:13px;color:var(--text-muted)">
                ${item.parcelas.length} parcela(s) · <strong style="color:var(--danger)">${Utils.moeda(item.totalDevido)}</strong> · template: <em>${tpl.label}</em>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${historicoInfo}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;align-items:center;flex-shrink:0">
              ${tel
                ? `<a href="${link}" target="_blank"
                    onclick="setTimeout(()=>WA.marcarContatado('${cli.id}',${item.diasMaxAtraso},'${tpl.id}'),800)"
                    style="background:#25D366;color:#fff;border-radius:8px;padding:10px 14px;font-size:20px;text-decoration:none;display:block;line-height:1">💬</a>`
                : `<span style="font-size:11px;color:var(--danger);font-weight:600">Sem tel.</span>`}
              ${!contatadoHoje && tel
                ? `<button onclick="WA.marcarContatado('${cli.id}',${item.diasMaxAtraso},'${tpl.id}')"
                    style="font-size:10px;border:1px solid var(--border);background:none;border-radius:6px;padding:3px 8px;cursor:pointer;color:var(--text-muted)">✓ Marcar</button>`
                : ''}
            </div>
          </div>
        </div>`;
    };

    const renderItemAguardando = (item) => {
      const { proximoContato, ultimoContato, totalContatos } = item.status;
      const diasRestantes = Math.ceil((new Date(proximoContato) - new Date(hoje)) / 86400000);
      const cor = WA._corPorDias(item.diasMaxAtraso);
      return `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-weight:600;font-size:13px">${item.cliente.nome}</span>
              <span style="font-size:11px;color:${cor}">${WA._labelDias(item.diasMaxAtraso)}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
              ${Utils.moeda(item.totalDevido)} · Último contato: ${Utils.data(ultimoContato)} (${totalContatos}x)
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;font-size:12px">
            <div style="color:var(--text-muted)">Próximo contato</div>
            <div style="font-weight:700;color:var(--primary)">${Utils.data(proximoContato)}</div>
            <div style="font-size:11px;color:var(--text-muted)">em ${diasRestantes} dia(s)</div>
          </div>
        </div>`;
    };

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px">
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Total Inadimplentes</div>
          <div style="font-size:28px;font-weight:700;color:var(--danger)">${todos.length}</div>
          <div style="font-size:12px;color:var(--text-muted)">${Utils.moeda(totalEmAberto)} em aberto</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Contatar Hoje</div>
          <div style="font-size:28px;font-weight:700;color:${pendentes.length > 0 ? 'var(--warning)' : 'var(--success)'}">${pendentes.length}</div>
          <div style="font-size:12px;color:var(--text-muted)">pendentes</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Contatados Hoje</div>
          <div style="font-size:28px;font-weight:700;color:var(--success)">${jaContatadosHoje.length}</div>
          <div style="font-size:12px;color:var(--text-muted)">de ${paraHoje.length} previstos</div>
        </div>
        <div class="card" style="padding:16px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Aguardando</div>
          <div style="font-size:28px;font-weight:700;color:var(--text-muted)">${aguardando.length}</div>
          <div style="font-size:12px;color:var(--text-muted)">no prazo de espera</div>
        </div>
      </div>

      <!-- PENDENTES HOJE -->
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-weight:700;font-size:15px">📋 Contatar Hoje (${pendentes.length})</div>
            <div style="font-size:12px;color:var(--text-muted)">Nunca contatados ou que chegaram no prazo de retorno</div>
          </div>
          ${jaContatadosHoje.length > 0 ? `
            <button class="btn btn-outline btn-sm" onclick="WA._toggleMostrarContatados()">
              ${_mostrarContatados ? 'Ocultar' : 'Ver'} já contatados hoje (${jaContatadosHoje.length})
            </button>` : ''}
        </div>
        ${pendentes.length === 0 && jaContatadosHoje.length > 0 ? `
          <div style="text-align:center;padding:32px 20px">
            <div style="font-size:40px;margin-bottom:8px">🎉</div>
            <div style="font-weight:700;color:var(--success)">Cobrança do dia concluída!</div>
          </div>` : ''}
        ${pendentes.length === 0 && jaContatadosHoje.length === 0 ? `
          <div style="text-align:center;padding:32px 20px;color:var(--text-muted)">
            <div style="font-size:40px;margin-bottom:8px">✅</div>
            <div style="font-weight:600">Nenhum contato previsto para hoje</div>
          </div>` : ''}
        ${pendentes.map(item => renderItem(item, false)).join('')}
        ${_mostrarContatados && jaContatadosHoje.length > 0 ? `
          <div style="padding:8px 16px;background:var(--input-bg);font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">✅ Já contatados hoje</div>
          ${jaContatadosHoje.map(item => renderItem(item, true)).join('')}` : ''}
      </div>

      <!-- AGUARDANDO PRÓXIMO CONTATO -->
      ${aguardando.length > 0 ? `
        <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
            <div style="font-weight:700;font-size:15px">⏳ Aguardando Próximo Contato (${aguardando.length})</div>
            <div style="font-size:12px;color:var(--text-muted)">Já foram contatados — sistema calculou quando contatar de novo</div>
          </div>
          ${aguardando.map(item => renderItemAguardando(item)).join('')}
        </div>` : ''}

      <!-- SEM TELEFONE -->
      ${semTel.length > 0 ? `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:8px 16px;font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">⚠️ Sem telefone (${semTel.length})</div>
          ${semTel.map(item => `
            <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
              <div>
                <span style="font-weight:600">${item.cliente.nome}</span>
                <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${Utils.moeda(item.totalDevido)} · ${item.diasMaxAtraso}d</span>
              </div>
              <a href="clientes.html" style="font-size:12px;color:var(--primary)">Cadastrar →</a>
            </div>`).join('')}
        </div>` : ''}`;
  },

  // ---- TEMPLATES ----
  _renderTemplates: () => {
    const grid = document.getElementById('tplGrid');
    grid.innerHTML = WA_TEMPLATES.map(t => `
      <div class="tpl-card ${t.id === _templateAtual.id ? 'ativo' : ''}"
           id="tpl_${t.id}"
           onclick="WA._selecionarTemplate(WA_TEMPLATES.find(x=>x.id==='${t.id}'))">
        <div class="tpl-icon">${t.icon}</div>
        <div class="tpl-label">${t.label}</div>
      </div>`).join('');
  },

  _selecionarTemplate: (tpl) => {
    _templateAtual = tpl;
    document.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('ativo'));
    const el = document.getElementById('tpl_' + tpl.id);
    if (el) el.classList.add('ativo');

    document.getElementById('textMensagem').value = tpl.mensagem;

    // Sugerir filtro compatível
    if (tpl.filtroSugerido) {
      document.getElementById('selectFiltro').value = tpl.filtroSugerido;
      WA._atualizarFiltroInfo();
    }

    // Atualizar preview se já tem lista
    if (_listaContatos.length > 0) WA._recalcularMensagens();
  },

  inserirVar: (variavel) => {
    const ta = document.getElementById('textMensagem');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const txt = ta.value;
    ta.value = txt.substring(0, start) + variavel + txt.substring(end);
    ta.selectionStart = ta.selectionEnd = start + variavel.length;
    ta.focus();
    WA.atualizarLista();
  },

  atualizarLista: () => {
    if (_listaContatos.length > 0) WA._recalcularMensagens();
  },

  // ---- FILTROS ----
  onFiltroChange: () => {
    WA._atualizarFiltroInfo();
  },

  _atualizarFiltroInfo: () => {
    const filtro = document.getElementById('selectFiltro').value;
    const info = document.getElementById('filtroInfo');
    const descs = {
      inadimplentes: 'Clientes com pelo menos uma parcela de crediário vencida e não paga.',
      vencendo: 'Clientes com parcela vencendo nos próximos 3 dias.',
      aniversario_hoje: 'Clientes que fazem aniversário hoje.',
      aniversario_mes: 'Clientes que fazem aniversário neste mês.',
      reativacao: 'Clientes que não compram há 60 dias ou mais.',
      todos: 'Todos os clientes cadastrados com número de telefone.',
    };
    info.textContent = descs[filtro] || '';
  },

  // ---- GERAR LISTA ----
  gerarLista: () => {
    const filtro = document.getElementById('selectFiltro').value;
    const hoje = Utils.hoje();
    const mesAtual = hoje.substring(0, 7);
    const diaHoje = hoje.substring(5); // MM-DD
    const limite60 = new Date();
    limite60.setDate(limite60.getDate() - 60);
    const limite60str = limite60.toISOString().substring(0, 10);
    const em3dias = new Date();
    em3dias.setDate(em3dias.getDate() + 3);
    const ate3dias = em3dias.toISOString().substring(0, 10);

    let contatos = [];

    if (filtro === 'inadimplentes') {
      DB.Crediario.listar().forEach(cred => {
        if (!cred.parcelas) return;
        cred.parcelas.forEach((p, idx) => {
          if (p.status !== 'pago' && p.vencimento < hoje) {
            const cli = DB.Clientes.buscar(cred.clienteId);
            if (!cli || !cli.telefone) return;
            const dias = Math.floor((new Date(hoje) - new Date(p.vencimento + 'T12:00:00')) / 86400000);
            // Evitar duplicar mesmo cliente na lista (pega o mais antigo)
            const jaExiste = contatos.find(c => c.cliente.id === cli.id);
            if (!jaExiste) {
              contatos.push({
                cliente: cli,
                extra: { valor: p.valor, vencimento: p.vencimento, diasAtraso: dias }
              });
            }
          }
        });
      });

    } else if (filtro === 'vencendo') {
      DB.Crediario.listar().forEach(cred => {
        if (!cred.parcelas) return;
        cred.parcelas.forEach(p => {
          if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= ate3dias) {
            const cli = DB.Clientes.buscar(cred.clienteId);
            if (!cli || !cli.telefone) return;
            const jaExiste = contatos.find(c => c.cliente.id === cli.id);
            if (!jaExiste) {
              contatos.push({
                cliente: cli,
                extra: { valor: p.valor, vencimento: p.vencimento, diasAtraso: 0 }
              });
            }
          }
        });
      });

    } else if (filtro === 'aniversario_hoje') {
      DB.Clientes.listar().forEach(cli => {
        if (!cli.telefone || !cli.dataNascimento) return;
        // dataNascimento: YYYY-MM-DD → pega MM-DD
        const aniv = cli.dataNascimento.substring(5);
        if (aniv === diaHoje) contatos.push({ cliente: cli, extra: {} });
      });

    } else if (filtro === 'aniversario_mes') {
      const mesFiltro = hoje.substring(5, 7); // MM
      DB.Clientes.listar().forEach(cli => {
        if (!cli.telefone || !cli.dataNascimento) return;
        const mes = cli.dataNascimento.substring(5, 7);
        if (mes === mesFiltro) contatos.push({ cliente: cli, extra: {} });
      });

    } else if (filtro === 'reativacao') {
      const vendas = DB.Vendas.listar();
      DB.Clientes.listar().forEach(cli => {
        if (!cli.telefone) return;
        const ultimaVenda = vendas
          .filter(v => v.clienteId === cli.id && v.criadoEm)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
        const semCompra = !ultimaVenda || ultimaVenda.criadoEm.substring(0, 10) <= limite60str;
        if (semCompra) contatos.push({ cliente: cli, extra: {} });
      });

    } else { // todos
      DB.Clientes.listar().forEach(cli => {
        if (!cli.telefone) return;
        contatos.push({ cliente: cli, extra: {} });
      });
    }

    // Montar lista com mensagens personalizadas
    const loja = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const telLoja = DB.Config.get('whatsapp', '') || DB.Config.get('telefone', '');
    const mensagemBase = document.getElementById('textMensagem').value;

    _listaContatos = contatos.map(c => ({
      cliente: c.cliente,
      extra: c.extra,
      mensagem: WA._substituirVars(mensagemBase, c.cliente, c.extra, loja, telLoja),
      enviado: false,
    }));

    WA._renderLista();
  },

  _recalcularMensagens: () => {
    const loja = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const telLoja = DB.Config.get('whatsapp', '') || DB.Config.get('telefone', '');
    const mensagemBase = document.getElementById('textMensagem').value;
    _listaContatos.forEach(item => {
      item.mensagem = WA._substituirVars(mensagemBase, item.cliente, item.extra, loja, telLoja);
    });
    WA._renderLista();
  },

  _substituirVars: (template, cli, extra, loja, telLoja) => {
    return WA._substituirVarsCompleto(template, cli, extra, loja, telLoja);
  },

  // ---- RENDERIZAR LISTA ----
  _renderLista: () => {
    const container = document.getElementById('waLista');
    const counterTexto = document.getElementById('counterTexto');
    const progressEnvio = document.getElementById('progressEnvio');
    const btnCopiarTodos = document.getElementById('btnCopiarTodos');
    const btnMarcarTodos = document.getElementById('btnMarcarTodos');

    const total = _listaContatos.length;
    const enviados = _listaContatos.filter(i => i.enviado).length;

    if (total === 0) {
      container.innerHTML = `
        <div class="wa-empty">
          <div class="wa-empty-icon">🔍</div>
          <div class="wa-empty-title">Nenhum cliente encontrado</div>
          <div class="fs-sm">Tente outro filtro ou cadastre mais clientes com telefone</div>
        </div>`;
      counterTexto.textContent = 'Nenhum cliente encontrado para o filtro selecionado.';
      progressEnvio.style.display = 'none';
      btnCopiarTodos.style.display = 'none';
      btnMarcarTodos.style.display = 'none';
      return;
    }

    counterTexto.innerHTML = `<strong>${total}</strong> cliente(s) · <span style="color:var(--success);font-weight:600">${enviados} enviado(s)</span>`;
    progressEnvio.style.display = '';
    btnCopiarTodos.style.display = '';
    btnMarcarTodos.style.display = '';
    document.getElementById('progressFill').style.width = (total > 0 ? (enviados / total * 100) : 0) + '%';

    container.innerHTML = _listaContatos.map((item, idx) => {
      const tel = (item.cliente.telefone || '').replace(/\D/g, '');
      const link = `https://wa.me/55${tel}?text=${encodeURIComponent(item.mensagem)}`;
      const previewCurta = item.mensagem.substring(0, 120).replace(/\n/g, ' ').trim() + (item.mensagem.length > 120 ? '...' : '');

      return `
        <div class="wa-item ${item.enviado ? 'enviado' : ''}" id="waItem_${idx}">
          <div class="wa-item-info">
            <div class="wa-item-nome">${item.cliente.nome}</div>
            <div class="wa-item-tel">📱 ${Utils.telefone(item.cliente.telefone)}</div>
            <div class="wa-item-preview" onclick="WA._togglePreview(this)">${previewCurta}</div>
          </div>
          <div class="wa-btn">
            <button class="btn-wa" title="Enviar no WhatsApp"
              onclick="WA.enviar(${idx}, '${link.replace(/'/g, "\\'")}')"
              ${!tel ? 'disabled title="Sem telefone"' : ''}>
              ${item.enviado ? '✅' : '💬'}
            </button>
            <span class="badge-enviado">Enviado</span>
          </div>
        </div>`;
    }).join('');
  },

  _togglePreview: (el) => {
    el.classList.toggle('expandido');
  },

  enviar: (idx, link) => {
    window.open(link, '_blank');
    // Marcar como enviado após pequeno delay (tempo de abrir o WhatsApp)
    setTimeout(() => {
      _listaContatos[idx].enviado = true;
      WA._renderLista();
    }, 1500);
  },

  marcarTodosEnviado: () => {
    _listaContatos.forEach(i => { i.enviado = true; });
    WA._renderLista();
  },

  copiarTodos: () => {
    if (_listaContatos.length === 0) return;
    let txt = `Lista WhatsApp — ${_listaContatos.length} contatos\n`;
    txt += '='.repeat(40) + '\n\n';
    _listaContatos.forEach((item, i) => {
      const tel = (item.cliente.telefone || '').replace(/\D/g, '');
      txt += `${i + 1}. ${item.cliente.nome} — ${Utils.telefone(item.cliente.telefone)}\n`;
      txt += `   wa.me/55${tel}\n\n`;
    });
    navigator.clipboard.writeText(txt)
      .then(() => Utils.toast('Lista de contatos copiada!', 'success'))
      .catch(() => Utils.toast('Não foi possível copiar', 'error'));
  },
};

document.addEventListener('DOMContentLoaded', WA.init);
