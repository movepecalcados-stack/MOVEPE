/**
 * MOVE PÉ - Utilitários v2.0
 */

const Utils = {

  // ---- FORMATAÇÃO ----
  moeda: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),

  num: (v) => parseFloat(('' + v).replace(',', '.')) || 0,

  data: (iso) => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString('pt-BR');
  },

  dataHora: (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR');
  },

  hoje: () => new Date().toISOString().substring(0, 10),

  hojeFormatado: () => {
    return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  },

  cpf: (v) => {
    const n = (v || '').replace(/\D/g, '');
    if (n.length !== 11) return v || '';
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },

  telefone: (v) => {
    const n = (v || '').replace(/\D/g, '');
    if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return v || '';
  },

  adicionarMeses: (dataStr, meses) => {
    const d = new Date(dataStr + 'T12:00:00');
    d.setMonth(d.getMonth() + meses);
    return d.toISOString().substring(0, 10);
  },

  statusParcela: (vencimento, status) => {
    if (status === 'pago') return 'pago';
    const hoje = Utils.hoje();
    if (vencimento < hoje) return 'atrasado';
    return 'pendente';
  },

  labelTipo: (tipo) => {
    const map = {
      calcado_adulto: 'Calçado Adulto',
      calcado_infantil: 'Calçado Infantil',
      roupa: 'Roupa'
    };
    return map[tipo] || tipo || '';
  },

  // Retorna a taxa (%) configurada para a forma de pagamento + parcelas
  calcularTaxaCartao: (formaPagamento, parcelas = 1) => {
    const t = DB.Config.get('taxasCartao', {});
    if (formaPagamento === 'cartao_debito')  return parseFloat(t.debito) || 0;
    if (formaPagamento === 'pix')            return parseFloat(t.pix) || 0;
    if (formaPagamento === 'cartao_credito') {
      const p = parseInt(parcelas) || 1;
      if (p <= 1) return parseFloat(t.credito1x)   || 0;
      if (p <= 6) return parseFloat(t.credito2a6)  || 0;
      return           parseFloat(t.credito7a12) || 0;
    }
    return 0;
  },

  // Retorna {taxaPct, valorTaxa, valorLiquido} dado valor + forma + parcelas
  infoTaxa: (valor, formaPagamento, parcelas = 1) => {
    const taxaPct = Utils.calcularTaxaCartao(formaPagamento, parcelas);
    const valorTaxa = taxaPct > 0 ? Math.round(valor * taxaPct / 100 * 100) / 100 : 0;
    return { taxaPct, valorTaxa, valorLiquido: valor - valorTaxa };
  },

  labelFormaPagamento: (forma) => {
    const map = {
      dinheiro: 'Dinheiro',
      cartao_credito: 'Cartão Crédito',
      cartao_debito: 'Cartão Débito',
      pix: 'PIX',
      crediario: 'Crediário'
    };
    return map[forma] || forma || '';
  },

  // ---- CEP ----
  buscarCep: async (cep) => {
    const c = cep.replace(/\D/g, '');
    if (c.length !== 8) return null;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data.erro) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  // ---- NOTIFICAÇÕES ----
  toast: (msg, tipo = 'success') => {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `toast toast-${tipo}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => t.classList.add('show'));
    });
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 350);
    }, 3000);
  },

  // ---- MODAIS ----
  abrirModal: (id) => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
  },

  fecharModal: (id) => {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; document.body.style.overflow = ''; }
  },

  initModais: () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    });
  },

  // ---- NAVEGAÇÃO ----
  renderNav: (paginaAtiva) => {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const links = [
      ['dashboard.html', '🏠', 'Dashboard'],
      ['index.html', '🛒', 'PDV'],
      ['caixa.html', '💰', 'Caixa'],
      ['historico.html', '🕐', 'Histórico'],
      ['clientes.html', '👥', 'Clientes'],
      ['crediario.html', '💳', 'Crediário'],
      ['estoque.html', '📦', 'Estoque'],
      ['financeiro.html', '💵', 'Financeiro'],
      ['relatorios.html', '📊', 'Relatórios'],
      ['whatsapp.html', '💬', 'WhatsApp Auto'],
      ['importar.html', '📥', 'Importar'],
      ['configuracoes.html', '⚙️', 'Configurações'],
    ];
    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-nome">MOVE PÉ</div>
        <span class="logo-sub">Gestão de Loja</span>
      </div>
      <ul class="nav-lista">
        ${links.map(([href, icon, label]) => `
          <li>
            <a href="${href}" class="nav-link ${paginaAtiva === href ? 'ativo' : ''}">
              <span class="nav-icon">${icon}</span>
              <span>${label}</span>
            </a>
          </li>
        `).join('')}
      </ul>
      <div style="padding:12px 16px;border-top:1px solid var(--border);margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span id="syncStatus" style="font-size:12px;color:var(--text-muted)"></span>
        ${localStorage.getItem('movePe_senha') ? `<button onclick="Utils.sair()" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 8px;font-size:11px;color:var(--text-muted);cursor:pointer" title="Sair">🔒 Sair</button>` : ''}
      </div>
    `;
    // Atualiza badges e painel de vencimentos
    setTimeout(() => {
      Utils.atualizarBadgeCrediario();
      Utils.atualizarBadgeEstoque();
      Utils.atualizarBadgeAniversarios();
      Utils.verificarVencimentos();
      Utils.avisoAniversariantesHoje();
    }, 600);

    // Recarrega badge quando Firebase sincronizar
    document.removeEventListener('movePe-sync', Utils._onSyncNav);
    document.addEventListener('movePe-sync', Utils._onSyncNav);
  },

  atualizarBadgeCrediario: () => {
    const hoje = Utils.hoje();
    const em3dias = new Date();
    em3dias.setDate(em3dias.getDate() + 3);
    const ate3dias = em3dias.toISOString().substring(0, 10);

    let count = 0;
    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach(p => {
        if (p.status !== 'pago' && p.vencimento >= hoje && p.vencimento <= ate3dias) count++;
      });
      cred.parcelas.forEach(p => {
        if (p.status !== 'pago' && p.vencimento < hoje) count++;
      });
    });

    const link = document.querySelector('a[href="crediario.html"]');
    if (!link) return;
    const badge = link.querySelector('.nav-badge');
    if (count > 0) {
      if (!badge) {
        const b = document.createElement('span');
        b.className = 'nav-badge';
        b.style.cssText = 'background:var(--danger);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 6px;margin-left:auto';
        b.textContent = count;
        link.style.display = 'flex';
        link.style.justifyContent = 'space-between';
        link.appendChild(b);
      } else {
        badge.textContent = count;
      }
    } else if (badge) {
      badge.remove();
    }
  },

  verificarVencimentos: () => {
    const hoje = Utils.hoje();
    const em3dias = new Date();
    em3dias.setDate(em3dias.getDate() + 3);
    const ate3dias = em3dias.toISOString().substring(0, 10);

    const atrasadas = [], hoje_ = [], proximas = [];

    DB.Crediario.listar().forEach(cred => {
      cred.parcelas.forEach((p, idx) => {
        if (p.status === 'pago') return;
        const item = {
          clienteNome: cred.clienteNome,
          valor: p.valor,
          vencimento: p.vencimento,
          numero: p.numero || (idx + 1),
          total: cred.parcelas.length
        };
        if (p.vencimento < hoje) atrasadas.push(item);
        else if (p.vencimento === hoje) hoje_.push(item);
        else if (p.vencimento <= ate3dias) proximas.push(item);
      });
    });

    if (atrasadas.length === 0 && hoje_.length === 0 && proximas.length === 0) return;

    // Cria painel de notificação
    const existente = document.getElementById('painelVencimentos');
    if (existente) existente.remove();

    const painel = document.createElement('div');
    painel.id = 'painelVencimentos';
    painel.style.cssText = `
      position:fixed;bottom:20px;right:20px;width:320px;max-height:420px;
      background:var(--card-bg);border:1px solid var(--border);border-radius:12px;
      box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:9999;overflow:hidden;
      display:flex;flex-direction:column;
    `;

    const renderGrupo = (lista, titulo, cor) => {
      if (!lista.length) return '';
      return `
        <div style="padding:6px 0 2px">
          <div style="font-size:11px;font-weight:700;color:${cor};padding:0 14px;margin-bottom:4px">${titulo}</div>
          ${lista.map(i => `
            <div style="display:flex;justify-content:space-between;padding:5px 14px;font-size:12px;border-bottom:1px solid var(--border)">
              <span style="color:var(--text)">${i.clienteNome} <span style="color:var(--text-muted)">${i.numero}/${i.total}</span></span>
              <span style="font-weight:600;color:${cor}">${Utils.moeda(i.valor)}</span>
            </div>`).join('')}
        </div>`;
    };

    painel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--border)">
        <span style="font-weight:700;font-size:13px">🔔 Vencimentos</span>
        <button onclick="document.getElementById('painelVencimentos').remove()"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1">
        ${renderGrupo(atrasadas, `🔴 Em atraso (${atrasadas.length})`, 'var(--danger)')}
        ${renderGrupo(hoje_, `🟡 Vencem hoje (${hoje_.length})`, 'var(--warning)')}
        ${renderGrupo(proximas, `🟢 Próximos 3 dias (${proximas.length})`, 'var(--success)')}
      </div>
      <div style="padding:10px 14px;border-top:1px solid var(--border)">
        <a href="crediario.html" style="color:var(--primary);font-size:12px;font-weight:600;text-decoration:none">
          Ver todos no Crediário →
        </a>
      </div>`;

    document.body.appendChild(painel);
  },

  atualizarBadgeEstoque: () => {
    const prods = DB.Produtos.listarAtivos();
    const count = prods.filter(p => DB.Produtos.estoqueTotal(p) <= (p.estoqueMinimo || 5)).length;
    const link = document.querySelector('a[href="estoque.html"]');
    if (!link) return;
    const badge = link.querySelector('.nav-badge-estoque');
    if (count > 0) {
      if (!badge) {
        const b = document.createElement('span');
        b.className = 'nav-badge-estoque';
        b.style.cssText = 'background:var(--warning);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 6px;margin-left:auto';
        b.textContent = count;
        link.style.display = 'flex';
        link.style.justifyContent = 'space-between';
        link.appendChild(b);
      } else {
        badge.textContent = count;
      }
    } else if (badge) {
      badge.remove();
    }
  },

  atualizarBadgeAniversarios: () => {
    const hoje = new Date();
    const mesHoje = hoje.getMonth() + 1;
    const diaHoje = hoje.getDate();
    const count = DB.Clientes.listar().filter(c => {
      if (!c.dataNascimento) return false;
      const [, mes, dia] = c.dataNascimento.split('-').map(Number);
      return mes === mesHoje && dia === diaHoje;
    }).length;

    const link = document.querySelector('a[href="clientes.html"]');
    if (!link) return;
    const badge = link.querySelector('.nav-badge-aniv');
    if (count > 0) {
      if (!badge) {
        const b = document.createElement('span');
        b.className = 'nav-badge-aniv';
        b.style.cssText = 'background:var(--primary);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 6px;margin-left:auto';
        b.textContent = '🎂 ' + count;
        link.style.display = 'flex';
        link.style.justifyContent = 'space-between';
        link.appendChild(b);
      } else {
        badge.textContent = '🎂 ' + count;
      }
    } else if (badge) {
      badge.remove();
    }
  },

  avisoAniversariantesHoje: () => {
    const hoje = new Date();
    const mesHoje = hoje.getMonth() + 1;
    const diaHoje = hoje.getDate();
    const aniv = DB.Clientes.listar().filter(c => {
      if (!c.dataNascimento) return false;
      const [, mes, dia] = c.dataNascimento.split('-').map(Number);
      return mes === mesHoje && dia === diaHoje;
    });
    if (aniv.length === 0) return;
    const nomes = aniv.slice(0, 2).map(c => c.nome.split(' ')[0]).join(', ');
    const extra = aniv.length > 2 ? ` e mais ${aniv.length - 2}` : '';
    Utils.toast(`🎂 Aniversário hoje: ${nomes}${extra}!`, 'success');
  },

  sair: () => {
    sessionStorage.removeItem('movePe_auth');
    location.replace('login.html');
  },

  _onSyncNav: () => {
    Utils.atualizarBadgeCrediario();
    Utils.atualizarBadgeEstoque();
    Utils.atualizarBadgeAniversarios();
  },

  // ---- RECIBOS ----
  gerarComprovante: (venda) => {
    const cliente = venda.clienteId ? DB.Clientes.buscar(venda.clienteId) : null;
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const now = new Date(venda.criadoEm || new Date());
    const dataStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    let itens = '';
    (venda.itens || []).forEach(item => {
      const nome = (item.nome || '').substring(0, 22).padEnd(22);
      const tamParts = item.tamanhoLabel ? [item.tamanhoLabel, item.cor].filter(Boolean) : (item.tamanho ? [item.tamanho.split('||')[0], item.tamanho.split('||')[1]].filter(Boolean) : []);
      const tam = tamParts.length ? `Tam ${tamParts.join(' ')}` : '';
      const qty = `${item.quantidade || 1}x`;
      const val = Utils.moeda(item.total || item.precoVenda * item.quantidade);
      itens += `${nome} ${tam}\n`;
      itens += `  ${qty.padEnd(10)} ${val.padStart(14)}\n`;
    });

    const caixaAtivo = DB.Caixa.buscarAtivo();
    const operador = caixaAtivo ? (caixaAtivo.operador || '') : '';

    const descontoLinha = venda.desconto && venda.desconto.calculado > 0
      ? `Desconto: ${venda.desconto.tipo === 'pct' ? venda.desconto.valor + '%' : ''} - ${Utils.moeda(venda.desconto.calculado).padStart(16)}\n`
      : '';

    return `
${linhaH}
          MOVE PÉ CALÇADOS
${linhaH}
Data: ${dataStr}
ID: ${(venda.id || '').toUpperCase().substring(0, 8)}
${operador ? `Operador: ${operador}` : ''}
${linhaL}
ITEM                       QTD        VALOR
${linhaL}
${itens}${linhaL}
${descontoLinha}                   TOTAL: ${Utils.moeda(venda.total).padStart(12)}
${linhaL}
${venda.formasPagamento && venda.formasPagamento.length > 0
  ? venda.formasPagamento.map(f => `${Utils.labelFormaPagamento(f.forma).padEnd(20)} ${Utils.moeda(f.valor).padStart(12)}`).join('\n')
  : `Forma: ${Utils.labelFormaPagamento(venda.formaPagamento)}`}
${venda.valorPago ? `Pago:  ${Utils.moeda(venda.valorPago).padStart(21)}` : ''}
${venda.troco ? `Troco: ${Utils.moeda(venda.troco).padStart(21)}` : ''}
${linhaL}
${cliente ? `Cliente: ${cliente.nome}` : ''}
${linhaH}
    Obrigado pela preferência!
       Volte sempre! MOVE PÉ
${linhaH}
`.trim();
  },

  gerarTextoWhatsApp: (venda) => {
    const cliente = venda.clienteId ? DB.Clientes.buscar(venda.clienteId) : null;
    const now = new Date(venda.criadoEm || new Date());
    const dataStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const id = (venda.id || '').toUpperCase().substring(0, 8);

    let msg = `✅ *MOVE PÉ CALÇADOS*\n`;
    if (cliente) msg += `Olá, *${cliente.nome.split(' ')[0]}*! Obrigado pela compra! 😊\n`;
    else msg += `Obrigado pela sua compra! 😊\n`;
    msg += `\n📋 *Comprovante #${id}*\n`;
    msg += `Data: ${dataStr}\n`;
    msg += `\n🛍️ *Itens:*\n`;
    (venda.itens || []).forEach(item => {
      const nome = item.nome || item.produtoNome || '—';
      const tamParts2 = item.tamanhoLabel ? [item.tamanhoLabel, item.cor].filter(Boolean) : (item.tamanho ? [item.tamanho.split('||')[0], item.tamanho.split('||')[1]].filter(Boolean) : []);
      const tam = tamParts2.length ? ` · Tam ${tamParts2.join(' ')}` : '';
      const qtd = item.quantidade || 1;
      const val = Utils.moeda((item.precoUnitario || item.preco || 0) * qtd);
      msg += `• ${nome}${tam} (${qtd}x) — ${val}\n`;
    });
    if (venda.desconto && venda.desconto.calculado > 0) {
      msg += `\n🏷️ Desconto: -${Utils.moeda(venda.desconto.calculado)}\n`;
    }
    msg += `\n💰 *Total: ${Utils.moeda(venda.total)}*\n`;
    if (venda.formasPagamento && venda.formasPagamento.length > 0) {
      msg += venda.formasPagamento.map(f => `${Utils.labelFormaPagamento(f.forma)}: ${Utils.moeda(f.valor)}`).join('\n') + '\n';
    } else {
      msg += `Pagamento: ${Utils.labelFormaPagamento(venda.formaPagamento)}\n`;
    }
    if (venda.troco > 0) msg += `Troco: ${Utils.moeda(venda.troco)}\n`;
    msg += `\nDúvidas? Estamos à disposição!`;
    return msg;
  },

  gerarComprovanteParcela: (installment) => {
    const linhaH = '='.repeat(40);
    const linhaL = '-'.repeat(40);
    const now = new Date();
    const dataStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `
${linhaH}
     COMPROVANTE DE PAGAMENTO
          MOVE PÉ CALÇADOS
${linhaH}
Data: ${dataStr}
${linhaL}
Cliente:  ${installment.clienteNome || ''}
Parcela:  ${installment.numero || ''}
Vencto:   ${Utils.data(installment.vencimento)}
${linhaL}
VALOR PAGO:    ${Utils.moeda(installment.valor).padStart(18)}
${linhaL}
Crediário ID: ${(installment.credId || '').substring(0, 8).toUpperCase()}
${linhaH}
    Obrigado pelo pagamento!
         MOVE PÉ CALÇADOS
${linhaH}
`.trim();
  },

  imprimirComprovante: (texto) => {
    const win = window.open('', '_blank', 'width=460,height=720');
    if (!win) {
      Utils.toast('Popup bloqueado! Permita popups neste site para imprimir.', 'error');
      return;
    }
    const esc = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante — MOVE PÉ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: bold;
      line-height: 1.1;
      color: #000;
      background: #fff;
      padding: 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      font-weight: bold;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .btn-imp {
      display: block;
      width: 100%;
      margin-bottom: 16px;
      padding: 12px;
      background: #111;
      color: #fff;
      font-size: 15px;
      font-weight: bold;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-imp:hover { background: #333; }
    @media print {
      .btn-imp { display: none !important; }
      body { padding: 1px; font-size: 11px; }
      pre { font-size: 11px; }
    }
  </style>
</head>
<body>
  <button class="btn-imp" onclick="window.print()">🖨️ Imprimir Comprovante</button>
  <pre>${esc}</pre>
</body>
</html>`);
    win.document.close();
  },

  imprimirHtml: (html, titulo = 'MOVE PÉ') => {
    const win = window.open('', '_blank', 'width=700,height=600');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; color: #000; }
    h1, h2, h3 { font-size: 14px; text-align: center; margin-bottom: 4px; }
    .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    td, th { padding: 3px 6px; font-size: 11px; }
    th { border-bottom: 1px solid #000; font-weight: bold; text-align: left; }
    .total { font-weight: bold; font-size: 14px; text-align: right; margin-top: 8px; }
    .center { text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>${html}</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  },

  // ---- HELPERS ----
  confirmar: (msg) => confirm(msg),

  somar: (arr, campo) => arr.reduce((s, i) => s + (parseFloat(i[campo]) || 0), 0),

  mascaraCpf: (input) => {
    let v = input.value.replace(/\D/g, '').substr(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = v;
  },

  mascaraTel: (input) => {
    let v = input.value.replace(/\D/g, '').substr(0, 11);
    if (v.length > 10) {
      v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (v.length > 6) {
      v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (v.length > 2) {
      v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    input.value = v;
  },

  mascaraCep: (input) => {
    let v = input.value.replace(/\D/g, '').substr(0, 8);
    if (v.length > 5) v = v.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = v;
  },

  verificarCaixa: () => {
    return !!DB.Caixa.buscarAtivo();
  },

  // Gera gráfico de barras puro CSS/JS
  renderGraficoBarras: (containerId, dados, opts = {}) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const max = Math.max(...dados.map(d => opts.dual ? Math.max(d.v1 || 0, d.v2 || 0) : (d.v || 0)), 1);
    el.innerHTML = dados.map(d => {
      if (opts.dual) {
        const h1 = Math.round((d.v1 / max) * 100);
        const h2 = Math.round((d.v2 / max) * 100);
        return `
          <div class="chart-bar-wrap">
            <div class="chart-bar-inner">
              <div class="chart-bar success-bar" style="height:${h1}%" title="${Utils.moeda(d.v1)}"></div>
              <div class="chart-bar secondary" style="height:${h2}%" title="${Utils.moeda(d.v2)}"></div>
            </div>
            <div class="chart-label">${d.label}</div>
          </div>`;
      }
      const h = Math.round((d.v / max) * 100);
      return `
        <div class="chart-bar-wrap">
          <div class="chart-bar-inner">
            <div class="chart-bar" style="height:${h}%" title="${Utils.moeda(d.v)}"></div>
          </div>
          <div class="chart-label">${d.label}</div>
          <div class="chart-value">${Utils.moeda(d.v)}</div>
        </div>`;
    }).join('');
  }
};
