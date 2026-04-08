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

const WA = {

  init: () => {
    Utils.renderNav('whatsapp.html');
    WA._renderTemplates();
    WA._selecionarTemplate(WA_TEMPLATES[0]);
    WA._atualizarFiltroInfo();
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
    const primeiro = (cli.nome || '').split(' ')[0];
    const diasAtraso = extra.diasAtraso || 0;
    return template
      .replace(/{nome}/g, primeiro)
      .replace(/{nomeCompleto}/g, cli.nome || '')
      .replace(/{loja}/g, loja)
      .replace(/{telLoja}/g, telLoja ? Utils.telefone(telLoja) : loja)
      .replace(/{valor}/g, extra.valor ? Utils.moeda(extra.valor) : '')
      .replace(/{vencimento}/g, extra.vencimento ? Utils.data(extra.vencimento) : '')
      .replace(/{diasAtraso}/g, diasAtraso > 0 ? diasAtraso + ' dia' + (diasAtraso > 1 ? 's' : '') : '');
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
