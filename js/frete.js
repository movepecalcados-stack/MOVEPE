/**
 * MOVE PÉ — Frete & Envio
 * Simulação via Melhor Envio + Nota de Envio para impressão
 */

let _clienteSelecionado = null;
let _servicoSelecionado = null;
let _produtosPedido = [];

const Frete = {

  init: () => {
    Utils.renderNav('frete.html');
    Frete._renderProdutos();
  },

  // ---- BUSCAR CLIENTE ----
  buscarCliente: (termo) => {
    const lista = document.getElementById('listaClientes');
    if (!termo || termo.length < 2) { lista.style.display = 'none'; return; }

    const clientes = DB.Clientes.listar().filter(c => {
      const t = termo.toLowerCase();
      return (c.nome || '').toLowerCase().includes(t) ||
             (c.telefone || '').includes(termo);
    }).slice(0, 8);

    if (!clientes.length) { lista.style.display = 'none'; return; }

    lista.style.display = 'block';
    lista.innerHTML = clientes.map(c => {
      const end = c.endereco;
      const cidade = end ? `${end.cidade || ''}${end.estado ? '/' + end.estado : ''}` : '';
      return `
        <div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px"
             onmouseover="this.style.background='var(--input-bg)'"
             onmouseout="this.style.background=''"
             onclick="Frete.selecionarCliente('${c.id}')">
          <strong>${c.nome}</strong>
          ${cidade ? `<span style="color:var(--text-muted);margin-left:8px">${cidade}</span>` : ''}
          ${!end || !end.cep ? '<span style="color:var(--danger);font-size:11px;margin-left:6px">sem endereço</span>' : ''}
        </div>`;
    }).join('');
  },

  selecionarCliente: (id) => {
    _clienteSelecionado = DB.Clientes.buscar(id);
    document.getElementById('listaClientes').style.display = 'none';
    document.getElementById('inputBuscarCliente').value = _clienteSelecionado.nome;

    const end = _clienteSelecionado.endereco || {};
    const endFormatado = [
      end.rua ? `${end.rua}${end.numero ? ', ' + end.numero : ''}` : '',
      end.complemento || '',
      end.bairro || '',
      end.cidade && end.estado ? `${end.cidade} — ${end.estado}` : (end.cidade || end.estado || ''),
      end.cep ? `CEP: ${Utils.cep ? Utils.cep(end.cep) : end.cep}` : '',
    ].filter(Boolean).join('\n');

    document.getElementById('destinoBox').innerHTML = `
      <div class="destino-nome">${_clienteSelecionado.nome}</div>
      ${_clienteSelecionado.telefone ? `<div>📱 ${Utils.telefone(_clienteSelecionado.telefone)}</div>` : ''}
      <div style="margin-top:4px;white-space:pre-line;font-size:12px;color:var(--text-muted)">${endFormatado || 'Endereço não cadastrado'}</div>
      ${!end.cep ? '<div style="color:var(--danger);font-size:12px;margin-top:6px">⚠️ CEP não cadastrado — preencha abaixo para calcular</div>' : ''}
      <button class="btn btn-outline btn-sm" style="margin-top:8px;font-size:11px" onclick="Frete.limparCliente()">Trocar cliente</button>`;

    document.getElementById('clienteSelecionado').style.display = 'block';

    // Preenche o formulário manual com os dados do cliente
    if (end.cep) {
      document.getElementById('inputDestCep').value = end.cep;
      document.getElementById('inputDestNome').value = _clienteSelecionado.nome;
      document.getElementById('inputDestRua').value = end.rua || '';
      document.getElementById('inputDestNumero').value = end.numero || '';
      document.getElementById('inputDestBairro').value = end.bairro || '';
      document.getElementById('inputDestCidade').value = end.cidade || '';
      document.getElementById('inputDestEstado').value = end.estado || '';
    }
  },

  limparCliente: () => {
    _clienteSelecionado = null;
    document.getElementById('clienteSelecionado').style.display = 'none';
    document.getElementById('inputBuscarCliente').value = '';
    ['inputDestCep','inputDestNome','inputDestRua','inputDestNumero','inputDestBairro','inputDestCidade','inputDestEstado']
      .forEach(id => { document.getElementById(id).value = ''; });
  },

  // ---- CEP ----
  mascaraCep: (el) => {
    let v = el.value.replace(/\D/g, '');
    if (v.length > 5) v = v.substring(0,5) + '-' + v.substring(5,8);
    el.value = v;
  },

  buscarCepDest: async () => {
    const cep = document.getElementById('inputDestCep').value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    const data = await Utils.buscarCep(cep);
    if (!data) return;
    document.getElementById('inputDestRua').value = data.logradouro || '';
    document.getElementById('inputDestBairro').value = data.bairro || '';
    document.getElementById('inputDestCidade').value = data.localidade || '';
    document.getElementById('inputDestEstado').value = data.uf || '';
  },

  // ---- CALCULAR FRETE ----
  calcular: async () => {
    const cepDestino = document.getElementById('inputDestCep').value.replace(/\D/g, '');
    const cepOrigem = (DB.Config.get('cepLoja', '') || '').replace(/\D/g, '');

    if (!cepOrigem) {
      Utils.toast('Configure o CEP da loja em Configurações primeiro!', 'error');
      return;
    }
    if (cepDestino.length !== 8) {
      Utils.toast('Informe o CEP de destino', 'error');
      return;
    }

    const peso       = parseFloat(document.getElementById('inputPeso').value) || 1;
    const altura     = parseInt(document.getElementById('inputAltura').value) || 14;
    const largura    = parseInt(document.getElementById('inputLargura').value) || 22;
    const comprimento= parseInt(document.getElementById('inputComprimento').value) || 32;
    const valorDeclarado = parseFloat(document.getElementById('inputValorDeclarado').value) || 0;

    const serverUrl = DB.Config.get('wetoServerUrl', '');
    if (!serverUrl) {
      Utils.toast('Configure a URL do servidor Weto nas Configurações', 'error');
      return;
    }

    const btn = document.querySelector('button[onclick="Frete.calcular()"]');
    btn.disabled = true;
    btn.textContent = '⏳ Calculando...';

    try {
      const resp = await fetch(`${serverUrl}/frete/calcular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cepOrigem,
          cepDestino,
          peso,
          altura,
          largura,
          comprimento,
          valorDeclarado,
        }),
      });

      if (!resp.ok) throw new Error(`Erro ${resp.status}`);
      const resultado = await resp.json();

      if (resultado.erro) throw new Error(resultado.erro);

      Frete._renderServicos(resultado.servicos || []);
      document.getElementById('cardResultado').style.display = '';
      document.getElementById('cardVazio').style.display = 'none';

    } catch (e) {
      Utils.toast('Erro ao calcular: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔍 Calcular Frete';
    }
  },

  // ---- RENDERIZAR SERVIÇOS ----
  _renderServicos: (servicos) => {
    _servicoSelecionado = null;
    const container = document.getElementById('listaServicos');

    if (!servicos.length) {
      container.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">Nenhuma opção de frete disponível para esse CEP</div>';
      document.getElementById('acoesFrete').style.display = 'none';
      return;
    }

    // Ordena por preço
    servicos.sort((a, b) => a.price - b.price);

    container.innerHTML = servicos.map((s, idx) => {
      const preco = parseFloat(s.price) === 0 ? 'GRÁTIS' : `R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')}`;
      const prazo = s.delivery_time === 1 ? '1 dia útil' : `${s.delivery_time} dias úteis`;
      const tagGratis = parseFloat(s.price) === 0 ? '<span class="tag-gratis">GRÁTIS</span>' : '';
      const tagRapido = s.delivery_time <= 2 ? '<span class="tag-rapido">⚡ Rápido</span>' : '';

      return `
        <div class="servico-card" id="servico_${idx}" onclick="Frete.selecionarServico(${idx}, ${JSON.stringify(s).replace(/"/g, '&quot;')})">
          <div class="servico-info">
            <div class="servico-nome">${s.name} ${tagGratis}${tagRapido}</div>
            <div class="servico-prazo">🕐 Prazo: ${prazo} · ${s.company?.name || ''}</div>
          </div>
          <div class="servico-preco">${preco}</div>
        </div>`;
    }).join('');

    document.getElementById('acoesFrete').style.display = 'flex';
  },

  selecionarServico: (idx, servico) => {
    _servicoSelecionado = servico;
    document.querySelectorAll('.servico-card').forEach(c => c.classList.remove('selecionado'));
    document.getElementById('servico_' + idx)?.classList.add('selecionado');
  },

  // ---- PRODUTOS DO PEDIDO ----
  adicionarProduto: () => {
    const nome  = document.getElementById('inputProdNome').value.trim();
    const qtd   = parseInt(document.getElementById('inputProdQtd').value) || 1;
    const valor = parseFloat(document.getElementById('inputProdValor').value) || 0;
    if (!nome) { Utils.toast('Informe o nome do produto', 'error'); return; }
    _produtosPedido.push({ nome, qtd, valor });
    document.getElementById('inputProdNome').value = '';
    document.getElementById('inputProdQtd').value = '1';
    document.getElementById('inputProdValor').value = '';
    Frete._renderProdutos();
  },

  removerProduto: (idx) => {
    _produtosPedido.splice(idx, 1);
    Frete._renderProdutos();
  },

  _renderProdutos: () => {
    const container = document.getElementById('listaProdutosPedido');
    if (!_produtosPedido.length) {
      container.innerHTML = '<div class="text-muted fs-sm" style="padding:8px 0">Nenhum produto adicionado</div>';
      return;
    }
    container.innerHTML = _produtosPedido.map((p, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
        <div style="flex:1">${p.qtd}x ${p.nome}</div>
        <div style="font-weight:600">R$ ${(p.qtd * p.valor).toFixed(2).replace('.', ',')}</div>
        <button onclick="Frete.removerProduto(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px">✕</button>
      </div>`).join('');
  },

  // ---- ABRIR MELHOR ENVIO ----
  abrirMelhorEnvio: () => {
    window.open('https://melhorenvio.com.br', '_blank');
  },

  // ---- IMPRIMIR NOTA DE ENVIO ----
  imprimirNota: () => {
    const nome   = document.getElementById('inputDestNome').value || (_clienteSelecionado?.nome || '');
    const cep    = document.getElementById('inputDestCep').value;
    const rua    = document.getElementById('inputDestRua').value;
    const numero = document.getElementById('inputDestNumero').value;
    const bairro = document.getElementById('inputDestBairro').value;
    const cidade = document.getElementById('inputDestCidade').value;
    const estado = document.getElementById('inputDestEstado').value;
    const tel    = _clienteSelecionado?.telefone || '';

    if (!nome || !cep) {
      Utils.toast('Preencha o destinatário e o CEP', 'error');
      return;
    }

    const nomeLoja  = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const telLoja   = DB.Config.get('whatsapp', '') || DB.Config.get('telefone', '');
    const cepLoja   = DB.Config.get('cepLoja', '');
    const endLoja   = DB.Config.get('enderecoLoja', '');

    const totalProdutos = _produtosPedido.reduce((s, p) => s + p.qtd * p.valor, 0);
    const frete = _servicoSelecionado ? parseFloat(_servicoSelecionado.price) : 0;
    const totalGeral = totalProdutos + frete;

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const horaHoje = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const produtosHtml = _produtosPedido.length
      ? _produtosPedido.map(p => `
          <div class="nota-linha">
            <span>${p.qtd}x ${p.nome}</span>
            <span>R$ ${(p.qtd * p.valor).toFixed(2).replace('.', ',')}</span>
          </div>`).join('')
      : '<div style="color:#888;font-size:12px">Nenhum produto informado</div>';

    const freteHtml = _servicoSelecionado
      ? `<div class="nota-linha"><span>Frete (${_servicoSelecionado.name})</span><span>R$ ${frete.toFixed(2).replace('.', ',')}</span></div>`
      : '';

    const nota = document.getElementById('notaImpressao');
    nota.style.display = 'block';
    nota.innerHTML = `
      <div class="nota-header">
        <div>
          <div class="nota-loja">${nomeLoja}</div>
          <div class="nota-subtitulo">NOTA DE ENVIO</div>
          ${endLoja ? `<div class="nota-subtitulo">${endLoja}</div>` : ''}
          ${cepLoja ? `<div class="nota-subtitulo">CEP: ${cepLoja}</div>` : ''}
          ${telLoja ? `<div class="nota-subtitulo">Tel: ${Utils.telefone(telLoja)}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:12px;color:#555">
          <div><strong>Data:</strong> ${dataHoje} às ${horaHoje}</div>
        </div>
      </div>

      <div class="nota-secao">
        <div class="nota-secao-titulo">Destinatário</div>
        <div style="font-size:14px;line-height:1.8">
          <strong>${nome}</strong><br>
          ${tel ? `Tel: ${Utils.telefone(tel)}<br>` : ''}
          ${rua}${numero ? ', ' + numero : ''}<br>
          ${bairro ? bairro + '<br>' : ''}
          ${cidade}${estado ? ' — ' + estado : ''}<br>
          CEP: ${cep}
        </div>
      </div>

      ${_servicoSelecionado ? `
      <div class="nota-secao">
        <div class="nota-secao-titulo">Serviço de Entrega</div>
        <div style="font-size:13px">
          <strong>${_servicoSelecionado.company?.name || ''} — ${_servicoSelecionado.name}</strong><br>
          Prazo: ${_servicoSelecionado.delivery_time} dia(s) útil(is)<br>
          Valor: R$ ${frete.toFixed(2).replace('.', ',')}
        </div>
      </div>` : ''}

      ${_produtosPedido.length ? `
      <div class="nota-secao">
        <div class="nota-secao-titulo">Produtos</div>
        ${produtosHtml}
        ${freteHtml}
        <div class="nota-total nota-linha">
          <span>TOTAL</span>
          <span>R$ ${totalGeral.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>` : ''}

      <div class="nota-rodape">
        Obrigado pela preferência! • ${nomeLoja}
        ${telLoja ? ' • ' + Utils.telefone(telLoja) : ''}
      </div>

      <!-- ETIQUETA DE ENDEREÇO -->
      <div class="nota-etiqueta">
        <div class="nota-etiqueta-titulo">✂️ Etiqueta — recorte e cole na embalagem</div>
        <div class="nota-etiqueta-dest">
          DE: ${nomeLoja}${cepLoja ? ' · CEP ' + cepLoja : ''}<br><br>
          PARA: ${nome}<br>
          ${rua}${numero ? ', ' + numero : ''}${bairro ? ' — ' + bairro : ''}<br>
          ${cidade}${estado ? '/' + estado : ''} · CEP ${cep}
        </div>
      </div>
    `;

    window.print();
    setTimeout(() => { nota.style.display = 'none'; }, 1000);
  },

};

document.addEventListener('DOMContentLoaded', Frete.init);
