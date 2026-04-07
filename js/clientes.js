/**
 * MOVE PÉ - Clientes v2.0
 */

let _clienteEditando = null;
let _buscaCliente = '';
let _comprasCache = [];

const ClientesModule = {

  init: () => {
    Utils.renderNav('clientes.html');
    Utils.initModais();
    ClientesModule.renderLista();

    document.getElementById('buscaInput').addEventListener('input', (e) => {
      _buscaCliente = e.target.value;
      ClientesModule.renderLista();
    });
    document.getElementById('buscaInput').addEventListener('keyup', (e) => {
      _buscaCliente = e.target.value;
      ClientesModule.renderLista();
    });

    document.getElementById('btnNovoCliente').addEventListener('click', () => {
      ClientesModule.abrirForm(null);
    });

    document.getElementById('formCliente').addEventListener('submit', ClientesModule.salvar);

    document.getElementById('btnCancelar').addEventListener('click', () => {
      Utils.fecharModal('modalCliente');
    });

    // CEP auto-fill
    document.getElementById('inputCep').addEventListener('input', (e) => {
      Utils.mascaraCep(e.target);
      const cep = e.target.value.replace(/\D/g, '');
      if (cep.length === 8) ClientesModule.buscarCep(cep);
    });

    document.getElementById('inputCpf').addEventListener('input', (e) => Utils.mascaraCpf(e.target));
    document.getElementById('inputTelefone').addEventListener('input', (e) => Utils.mascaraTel(e.target));
  },

  buscarCep: async (cep) => {
    document.getElementById('cepStatus').textContent = 'Buscando...';
    const data = await Utils.buscarCep(cep);
    if (data) {
      document.getElementById('inputRua').value = data.logradouro || '';
      document.getElementById('inputBairro').value = data.bairro || '';
      document.getElementById('inputCidade').value = data.localidade || '';
      document.getElementById('inputEstado').value = data.uf || '';
      document.getElementById('cepStatus').textContent = '';
      document.getElementById('inputNumero').focus();
    } else {
      document.getElementById('cepStatus').textContent = 'CEP não encontrado';
    }
  },

  buscar: (valor) => {
    _buscaCliente = valor || '';
    ClientesModule.renderLista();
  },

  renderLista: () => {
    const todos = DB.Clientes.listar();
    const termo = _buscaCliente.trim();
    const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const t = norm(termo);
    const clientes = termo
      ? todos.filter(c => {
          try {
            const temNumero = /\d/.test(termo);
            return norm(c.nome).includes(t) ||
              norm(c.email).includes(t) ||
              (temNumero && c.cpf && c.cpf.replace(/\D/g,'').includes(t.replace(/\D/g,''))) ||
              (temNumero && c.telefone && c.telefone.replace(/\D/g,'').includes(t.replace(/\D/g,'')));
          } catch(e) { return false; }
        })
      : todos;

    const cont = document.getElementById('clientesLista');

    if (clientes.length === 0) {
      cont.innerHTML = `<div class="empty-state">
        <div class="empty-icon">👥</div>
        <div class="empty-title">Nenhum cliente encontrado</div>
        <div class="empty-sub">Cadastre clientes para começar</div>
      </div>`;
      return;
    }

    cont.innerHTML = clientes.map(c => {
      const inicial = (c.nome || 'C').charAt(0).toUpperCase();
      const totalGasto = DB.Clientes.totalGasto(c.id);
      const numCompras = DB.Clientes.numCompras(c.id);
      const det = [c.cpf ? Utils.cpf(c.cpf) : '', c.telefone ? Utils.telefone(c.telefone) : ''].filter(Boolean).join(' · ');
      const end = c.endereco ? [c.endereco.cidade, c.endereco.estado].filter(Boolean).join('/') : '';
      return `
        <div class="cliente-card" onclick="ClientesModule.abrirForm('${c.id}')">
          <div class="cliente-avatar">${inicial}</div>
          <div class="cliente-info">
            <div class="cliente-nome">${c.nome}</div>
            <div class="cliente-det">${det}${end ? ' · ' + end : ''}</div>
          </div>
          <div class="cliente-stats">
            <div class="cliente-total">${Utils.moeda(totalGasto)}</div>
            <div class="cliente-compras">${numCompras} compra${numCompras !== 1 ? 's' : ''}</div>
            <div style="margin-top:6px">
              <button class="btn btn-danger btn-sm" onclick="ClientesModule.excluir('${c.id}',event)">🗑</button>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  trocarAba: (aba) => {
    const form = document.getElementById('formCliente');
    const painel = document.getElementById('painelCompras');
    const btnDados = document.getElementById('abaDados');
    const btnCompras = document.getElementById('abaCompras');
    if (aba === 'dados') {
      form.style.display = '';
      painel.style.display = 'none';
      btnDados.style.borderBottomColor = 'var(--primary)';
      btnDados.style.color = 'var(--primary)';
      btnDados.style.fontWeight = '600';
      btnCompras.style.borderBottomColor = 'transparent';
      btnCompras.style.color = 'var(--text-muted)';
      btnCompras.style.fontWeight = '';
    } else {
      form.style.display = 'none';
      painel.style.display = '';
      btnDados.style.borderBottomColor = 'transparent';
      btnDados.style.color = 'var(--text-muted)';
      btnDados.style.fontWeight = '';
      btnCompras.style.borderBottomColor = 'var(--primary)';
      btnCompras.style.color = 'var(--primary)';
      btnCompras.style.fontWeight = '600';
      if (_clienteEditando) ClientesModule.renderCompras(_clienteEditando.id);
    }
  },

  renderCompras: (clienteId) => {
    const cliente = DB.Clientes.buscar(clienteId);
    const todasVendas = DB.Vendas.listar().filter(v => v.clienteId === clienteId);
    const crediarios = DB.Crediario.listar().filter(c => c.clienteId === clienteId);

    // Combina vendas e crediários em uma lista de compras
    const compras = [];

    todasVendas.forEach(v => {
      const credVinc = crediarios.find(c => c.vendaId === v.id);
      compras.push({
        tipo: credVinc ? 'crediario' : 'venda',
        data: v.criadoEm,
        total: v.total,
        formaPagamento: v.formaPagamento,
        formasPagamento: v.formasPagamento || null,
        itens: v.itens || [],
        vendaId: v.id,
        credId: credVinc ? credVinc.id : null,
        devolucoes: v.devolucoes || []
      });
    });

    // Crediários sem venda vinculada
    crediarios.filter(c => !c.vendaId).forEach(c => {
      compras.push({
        tipo: 'crediario',
        data: c.criadoEm,
        total: c.total,
        formaPagamento: 'crediario',
        formasPagamento: null,
        itens: c.itens || [],
        credId: c.id,
        devolucoes: []
      });
    });

    compras.sort((a, b) => new Date(b.data) - new Date(a.data));
    _comprasCache = compras;

    const cont = document.getElementById('listaComprasCliente');

    if (compras.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛍️</div>
          <div class="empty-title">Nenhuma compra registrada</div>
          <div class="empty-sub">As compras aparecerão aqui</div>
        </div>
        ${ClientesModule._botoesAcaoCliente(cliente)}`;
      return;
    }

    // --- STATS ---
    const totalGasto = compras.reduce((s, c) => s + (parseFloat(c.total) || 0), 0);
    const ticketMedio = totalGasto / compras.length;
    const saldoDevedor = crediarios.reduce((s, cred) => {
      const obj = DB.Crediario.buscar(cred.id);
      if (!obj) return s;
      return s + obj.parcelas.filter(p => p.status !== 'pago').reduce((ps, p) => ps + (parseFloat(p.valor) || 0), 0);
    }, 0);
    const totalDevolvido = compras.reduce((s, c) =>
      s + (c.devolucoes || []).reduce((ds, d) => ds + (parseFloat(d.valorDevolvido) || 0), 0), 0);

    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">COMPRAS</div>
          <div style="font-size:18px;font-weight:700;color:var(--primary)">${compras.length}</div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">TOTAL GASTO</div>
          <div style="font-size:15px;font-weight:700;color:var(--success)">${Utils.moeda(totalGasto)}</div>
        </div>
        <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:4px">TICKET MÉDIO</div>
          <div style="font-size:15px;font-weight:700">${Utils.moeda(ticketMedio)}</div>
        </div>
        ${saldoDevedor > 0 ? `
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:#856404;font-weight:600;margin-bottom:4px">CREDIÁRIO PENDENTE</div>
          <div style="font-size:15px;font-weight:700;color:#856404">${Utils.moeda(saldoDevedor)}</div>
        </div>` : ''}
        ${totalDevolvido > 0 ? `
        <div style="background:#f8d7da;border:1px solid #dc3545;border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--danger);font-weight:600;margin-bottom:4px">DEVOLVIDO</div>
          <div style="font-size:15px;font-weight:700;color:var(--danger)">${Utils.moeda(totalDevolvido)}</div>
        </div>` : ''}
      </div>`;

    const formaLabel = { dinheiro: '💵 Dinheiro', cartao_debito: '💳 Débito', cartao_credito: '💳 Crédito', crediario: '📋 Crediário', pix: '⚡ Pix' };

    const cardsHtml = compras.map((c, idx) => {
      const num = String(compras.length - idx).padStart(2, '0');
      const credObj = c.credId ? DB.Crediario.buscar(c.credId) : null;

      // Forma de pagamento (split ou simples)
      let formaExibida = '';
      if (c.formasPagamento && c.formasPagamento.length > 0) {
        formaExibida = c.formasPagamento.map(f => formaLabel[f.forma] || f.forma).join(' + ');
      } else {
        formaExibida = formaLabel[c.formaPagamento] || c.formaPagamento || '';
      }

      const itensHtml = c.itens && c.itens.length > 0
        ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600">PRODUTOS</div>
            ${c.itens.map(item => `
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:var(--text-muted)">
                <span>${item.nome || item.produtoNome || '—'}${item.tamanho ? ' · Tam. ' + item.tamanho : ''} × ${item.quantidade || 1}</span>
                <span>${Utils.moeda((item.precoUnitario || item.preco || 0) * (item.quantidade || 1))}</span>
              </div>`).join('')}
          </div>`
        : '';

      const parcelasHtml = credObj && credObj.parcelas
        ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600">PARCELAS</div>
            ${credObj.parcelas.map((p, i) => {
              const st = Utils.statusParcela(p.vencimento, p.status);
              const cor = st === 'pago' ? 'var(--success)' : st === 'atrasado' ? 'var(--danger)' : 'var(--warning)';
              return `<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0">
                <span style="color:var(--text-muted)">${p.numero || i+1}ª · ${Utils.data(p.vencimento)}</span>
                <span style="color:${cor};font-weight:600">${Utils.moeda(p.valor)} · ${st === 'pago' ? '✅ Pago' : st === 'atrasado' ? '🔴 Atrasado' : '⏳ Pendente'}</span>
              </div>`;
            }).join('')}
          </div>`
        : '';

      // Devoluções/trocas na compra
      const devHtml = c.devolucoes && c.devolucoes.length > 0
        ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="font-size:11px;color:var(--danger);margin-bottom:6px;font-weight:600">DEVOLUÇÕES / TROCAS</div>
            ${c.devolucoes.map(d => {
              const tipoLabel = d.tipo === 'troca' ? '🔄 Troca' : '↩️ Devolução';
              const qtdItens = (d.itens || []).reduce((s, i) => s + (i.qtd || 0), 0);
              const formaRmb = { dinheiro: 'Dinheiro', pix: 'PIX', credito_loja: 'Crédito na loja', vale_troca: 'Vale-troca' }[d.formaReembolso] || d.formaReembolso || '';
              return `<div style="font-size:12px;padding:4px 0;color:var(--danger)">
                ${tipoLabel} · ${Utils.data(d.data)} · ${qtdItens} item(s)${d.valorDevolvido ? ' · ' + Utils.moeda(d.valorDevolvido) : ''}${formaRmb ? ' · ' + formaRmb : ''}
              </div>`;
            }).join('')}
          </div>`
        : '';

      return `
        <div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px;background:var(--card-bg)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-weight:700;font-size:15px;color:var(--primary)">Compra ${num}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${Utils.data(c.data)} · ${formaExibida}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-weight:700;font-size:16px">${Utils.moeda(c.total)}</div>
              <button class="btn btn-outline btn-sm" onclick="ClientesModule.imprimirCompra(${idx}, '${clienteId}')">🖨️</button>
            </div>
          </div>
          ${itensHtml}
          ${parcelasHtml}
          ${devHtml}
        </div>`;
    }).join('');

    cont.innerHTML = statsHtml + cardsHtml + ClientesModule._botoesAcaoCliente(cliente);
  },

  _botoesAcaoCliente: (cliente) => {
    if (!cliente) return '';
    const tel = (cliente.telefone || '').replace(/\D/g, '');
    const whatsappHtml = tel
      ? `<a href="https://wa.me/55${tel}" target="_blank" class="btn btn-outline" style="text-decoration:none">💬 WhatsApp</a>`
      : '';
    return `
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="ClientesModule.venderParaCliente('${cliente.id}')">🛒 Nova Venda</button>
        ${whatsappHtml}
      </div>`;
  },

  venderParaCliente: (clienteId) => {
    localStorage.setItem('movePe_pdv_cliente', clienteId);
    location.href = 'index.html';
  },

  imprimirCompra: (idx, clienteId) => {
    const c = _comprasCache[idx];
    if (!c) return;
    const cliente = DB.Clientes.buscar(clienteId);
    const nomeCliente = cliente ? cliente.nome : 'Cliente';
    const num = String(_comprasCache.length - idx).padStart(2, '0');
    const formaLabel = { dinheiro: 'Dinheiro', cartao_debito: 'Cartão Débito', cartao_credito: 'Cartão Crédito', crediario: 'Crediário', pix: 'Pix' };
    const credObj = c.credId ? DB.Crediario.buscar(c.credId) : null;

    const linhas = [
      '================================',
      '       MOVE PÉ CALÇADOS         ',
      '================================',
      `CLIENTE: ${nomeCliente}`,
      `COMPRA Nº ${num}`,
      `DATA: ${Utils.data(c.data)}`,
      `PAGAMENTO: ${formaLabel[c.formaPagamento] || c.formaPagamento}`,
      '--------------------------------',
    ];

    if (c.itens && c.itens.length > 0) {
      linhas.push('PRODUTOS:');
      c.itens.forEach(item => {
        const nome = item.nome || item.produtoNome || '—';
        const tam = item.tamanho ? ` Tam.${item.tamanho}` : '';
        const qtd = item.quantidade || 1;
        const preco = item.precoUnitario || item.preco || 0;
        linhas.push(`  ${nome}${tam}`);
        linhas.push(`  ${qtd}x ${Utils.moeda(preco)} = ${Utils.moeda(preco * qtd)}`);
      });
      linhas.push('--------------------------------');
    }

    linhas.push(`TOTAL: ${Utils.moeda(c.total)}`);

    if (credObj) {
      linhas.push('--------------------------------');
      linhas.push('PARCELAS:');
      credObj.parcelas.forEach((p, i) => {
        const st = { pago: 'PAGO', atrasado: 'ATRASADO', pendente: 'PENDENTE' }[Utils.statusParcela(p.vencimento, p.status)];
        linhas.push(`  ${p.numero || i+1}ª - ${Utils.data(p.vencimento)} - ${Utils.moeda(p.valor)} [${st}]`);
      });
    }

    linhas.push('================================');
    linhas.push('   Obrigado pela preferência!   ');
    linhas.push('================================');

    Utils.imprimirComprovante(linhas.join('\n'));
  },

  abrirForm: (id) => {
    _clienteEditando = id ? DB.Clientes.buscar(id) : null;
    const c = _clienteEditando;
    document.getElementById('modalClienteTitulo').textContent = c ? 'Editar Cliente' : 'Novo Cliente';
    document.getElementById('cepStatus').textContent = '';

    const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };

    set('inputNome', c ? c.nome : '');
    set('inputCpf', c ? c.cpf : '');
    set('inputRg', c ? c.rg : '');
    set('inputTelefone', c ? c.telefone : '');
    set('inputEmail', c ? c.email : '');
    set('inputNascimento', c ? c.dataNascimento : '');
    set('inputProfissao', c ? c.profissao : '');
    set('inputLimiteCredito', c ? c.limiteCredito : '');

    const end = c && c.endereco ? c.endereco : {};
    set('inputCep', end.cep || '');
    set('inputRua', end.rua || '');
    set('inputNumero', end.numero || '');
    set('inputComplemento', end.complemento || '');
    set('inputBairro', end.bairro || '');
    set('inputCidade', end.cidade || '');
    set('inputEstado', end.estado || '');

    // Aba Compras só disponível para clientes existentes
    const btnCompras = document.getElementById('abaCompras');
    btnCompras.disabled = !id;
    btnCompras.style.opacity = id ? '1' : '0.4';

    // Sempre abre na aba Dados
    ClientesModule.trocarAba('dados');

    Utils.abrirModal('modalCliente');
    setTimeout(() => document.getElementById('inputNome').focus(), 100);
  },

  salvar: (e) => {
    e.preventDefault();
    const get = (id) => document.getElementById(id).value.trim();

    const cli = {
      id: _clienteEditando ? _clienteEditando.id : undefined,
      nome: get('inputNome'),
      cpf: get('inputCpf'),
      rg: get('inputRg'),
      telefone: get('inputTelefone'),
      email: get('inputEmail'),
      dataNascimento: get('inputNascimento'),
      profissao: get('inputProfissao'),
      limiteCredito: parseFloat(get('inputLimiteCredito')) || 0,
      endereco: {
        cep: get('inputCep'),
        rua: get('inputRua'),
        numero: get('inputNumero'),
        complemento: get('inputComplemento'),
        bairro: get('inputBairro'),
        cidade: get('inputCidade'),
        estado: get('inputEstado')
      }
    };

    if (!cli.nome) { Utils.toast('Nome é obrigatório', 'error'); return; }

    DB.Clientes.salvar(cli);
    Utils.fecharModal('modalCliente');
    ClientesModule.renderLista();
    Utils.toast(_clienteEditando ? 'Cliente atualizado!' : 'Cliente cadastrado!');
  },

  excluir: (id, e) => {
    if (e) e.stopPropagation();
    if (!Utils.confirmar('Excluir este cliente?')) return;
    DB.Clientes.excluir(id);
    ClientesModule.renderLista();
    Utils.toast('Cliente excluído');
  }
};

document.addEventListener('DOMContentLoaded', ClientesModule.init);
document.addEventListener('movePe-sync', () => ClientesModule.renderLista());
