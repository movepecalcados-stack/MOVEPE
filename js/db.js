/**
 * MOVE PÉ - Camada de Dados v3.0
 * Usa localStorage como banco de dados local + Firebase Firestore para sincronização.
 */

const DB = (() => {
  const P = 'movePe_';

  const _get = (col) => {
    try { return JSON.parse(localStorage.getItem(P + col) || '[]'); }
    catch (e) { return []; }
  };

  const _set = (col, data) => {
    try { localStorage.setItem(P + col, JSON.stringify(data)); return true; }
    catch (e) { console.error('Erro ao salvar:', e); return false; }
  };

  const genId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // ---- SYNC (Firebase Firestore) ----
  let _fbApp = null;
  let _fbDb = null;
  let _fbReady = false;
  let _onReadyCallbacks = [];
  let _collectionsLoaded = {};

  const COLS = ['produtos', 'clientes', 'vendas', 'crediario', 'caixa', 'fluxo', 'despesas'];

  const Sync = {

    isConfigured: () => {
      try {
        const cfg = JSON.parse(localStorage.getItem('movePe_fb_config') || '{}');
        return !!(cfg && cfg.apiKey);
      } catch (e) {
        return false;
      }
    },

    init: () => {
      if (!Sync.isConfigured()) return;

      try {
        const cfg = JSON.parse(localStorage.getItem('movePe_fb_config') || '{}');

        if (typeof firebase === 'undefined') {
          console.warn('Firebase SDK não carregado');
          return;
        }

        // Inicializa Firebase apenas uma vez
        if (!firebase.apps || firebase.apps.length === 0) {
          _fbApp = firebase.initializeApp(cfg);
        } else {
          _fbApp = firebase.apps[0];
        }

        _fbDb = firebase.firestore();

        Sync.updateStatus('syncing');
        Sync._setupListeners();
      } catch (e) {
        console.error('Erro ao inicializar Firebase:', e);
        Sync.updateStatus('error');
      }
    },

    _setupListeners: () => {
      if (!_fbDb) return;

      COLS.forEach(col => {
        _collectionsLoaded[col] = false;
        try {
          _fbDb.collection('movePe_' + col).onSnapshot((snap) => {
            const docs = snap.docs.map(d => d.data());
            const local = _get(col);

            // Se Firestore veio vazio mas localStorage tem dados, envia local → Firestore
            if (docs.length === 0 && local.length > 0 && !_fbReady) {
              local.forEach(item => {
                if (item && item.id) {
                  _fbDb.collection('movePe_' + col).doc(item.id).set(item).catch(e => console.error(e));
                }
              });
              // Mantém localStorage como está (não apaga)
            } else {
              _set(col, docs);
            }

            const wasReady = _fbReady;

            // Marca esta coleção como carregada
            _collectionsLoaded[col] = true;

            // Verifica se todas as coleções foram carregadas
            const allLoaded = COLS.every(c => _collectionsLoaded[c]);
            if (allLoaded && !_fbReady) {
              _fbReady = true;
              Sync.updateStatus('synced');
              _onReadyCallbacks.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
              _onReadyCallbacks = [];
              // Avisa todos os módulos para re-renderizar com dados do Firebase
              document.dispatchEvent(new CustomEvent('movePe-sync', { detail: { col: 'all' } }));
            }

            // Em updates subsequentes (não primeiro carregamento), avisa outros módulos
            if (wasReady && !snap.metadata.hasPendingWrites) {
              Sync.updateStatus('synced');
              document.dispatchEvent(new CustomEvent('movePe-sync', { detail: { col } }));
            }
          }, (err) => {
            console.error('Erro no listener Firestore [' + col + ']:', err);
            Sync.updateStatus('error');
          });
        } catch (e) {
          console.error('Erro ao configurar listener [' + col + ']:', e);
        }
      });
    },

    save: (col, item) => {
      if (!_fbDb || !item || !item.id) return;
      try {
        Sync.updateStatus('syncing');
        _fbDb.collection('movePe_' + col).doc(item.id).set(item)
          .then(() => Sync.updateStatus('synced'))
          .catch((e) => {
            console.error('Erro ao salvar no Firestore:', e);
            Sync.updateStatus('error');
          });
      } catch (e) {
        console.error('Erro ao chamar save no Firestore:', e);
        Sync.updateStatus('error');
      }
    },

    delete: (col, id) => {
      if (!_fbDb || !id) return;
      try {
        Sync.updateStatus('syncing');
        _fbDb.collection('movePe_' + col).doc(id).delete()
          .then(() => Sync.updateStatus('synced'))
          .catch((e) => {
            console.error('Erro ao deletar no Firestore:', e);
            Sync.updateStatus('error');
          });
      } catch (e) {
        console.error('Erro ao chamar delete no Firestore:', e);
        Sync.updateStatus('error');
      }
    },

    syncAll: () => {
      if (!_fbDb) return;
      Sync.updateStatus('syncing');
      const promises = [];
      COLS.forEach(col => {
        const lista = _get(col);
        lista.forEach(item => {
          if (item && item.id) {
            promises.push(
              _fbDb.collection('movePe_' + col).doc(item.id).set(item)
            );
          }
        });
      });
      // Sincroniza config também
      try {
        const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
        if (Object.keys(cfg).length > 0) {
          promises.push(_fbDb.collection('movePe_config').doc('main').set(cfg));
        }
      } catch (e) {}

      Promise.all(promises)
        .then(() => Sync.updateStatus('synced'))
        .catch((e) => {
          console.error('Erro no syncAll:', e);
          Sync.updateStatus('error');
        });
    },

    updateStatus: (status) => {
      const el = document.getElementById('syncStatus');
      if (!el) return;
      if (!Sync.isConfigured()) { el.textContent = ''; return; }
      if (status === 'syncing') {
        el.innerHTML = '<span style="color:var(--text-muted)">🔄 Sincronizando...</span>';
      } else if (status === 'synced') {
        el.innerHTML = '<span style="color:var(--success)">☁️ Sincronizado</span>';
      } else if (status === 'error') {
        el.innerHTML = '<span style="color:var(--danger)">⚠️ Erro de sync</span>';
      }
    }
  };

  const onReady = (cb) => {
    if (_fbReady || !Sync.isConfigured()) {
      cb();
    } else {
      _onReadyCallbacks.push(cb);
    }
  };

  // ---- PRODUTOS ----
  const Produtos = {
    listar: () => _get('produtos'),

    listarAtivos: () => _get('produtos').filter(p => p.ativo !== false),

    buscar: (id) => _get('produtos').find(p => p.id === id),

    buscarPorTexto: (texto) => {
      if (!texto || texto.trim() === '') return Produtos.listarAtivos();
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const t = norm(texto);
      return _get('produtos').filter(p =>
        p.ativo !== false && (
          norm(p.nome).includes(t) ||
          norm(p.marca).includes(t) ||
          norm(p.categoria).includes(t) ||
          norm(p.sku).includes(t) ||
          (p.codigoBarras && p.codigoBarras.includes(t))
        )
      );
    },

    salvar: (prod) => {
      const lista = _get('produtos');
      const idx = lista.findIndex(p => p.id === prod.id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...prod };
      } else {
        prod.id = genId();
        prod.criadoEm = new Date().toISOString();
        lista.push(prod);
      }
      _set('produtos', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('produtos', salvo);
      return salvo;
    },

    excluir: (id) => {
      const lista = _get('produtos').map(p => p.id === id ? { ...p, ativo: false } : p);
      _set('produtos', lista);
      const atualizado = lista.find(p => p.id === id);
      if (atualizado) Sync.save('produtos', atualizado);
    },

    // variacoes é objeto { tamanho: estoque }
    atualizarEstoque: (produtoId, tamanho, delta) => {
      const lista = _get('produtos');
      const idx = lista.findIndex(p => p.id === produtoId);
      if (idx < 0) return;
      if (!lista[idx].variacoes) lista[idx].variacoes = {};
      const atual = lista[idx].variacoes[tamanho] || 0;
      lista[idx].variacoes[tamanho] = Math.max(0, atual + delta);
      _set('produtos', lista);
      Sync.save('produtos', lista[idx]);
    },

    // Retorna estoque total (soma de todas variacoes)
    estoqueTotal: (prod) => {
      if (!prod || !prod.variacoes) return 0;
      return Object.values(prod.variacoes).reduce((s, v) => s + (parseInt(v) || 0), 0);
    }
  };

  // ---- CLIENTES ----
  const Clientes = {
    listar: () => _get('clientes'),

    buscar: (id) => _get('clientes').find(c => c.id === id),

    buscarPorTexto: (texto) => {
      if (!texto || texto.trim() === '') return _get('clientes');
      const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const t = norm(texto);
      const temNumero = /\d/.test(texto);
      return _get('clientes').filter(c => {
        try {
          return (
            norm(c.nome).includes(t) ||
            norm(c.email).includes(t) ||
            (temNumero && c.cpf && c.cpf.replace(/\D/g, '').includes(t.replace(/\D/g, ''))) ||
            (temNumero && c.telefone && c.telefone.replace(/\D/g, '').includes(t.replace(/\D/g, '')))
          );
        } catch(e) { return false; }
      });
    },

    salvar: (cli) => {
      const lista = _get('clientes');
      const idx = lista.findIndex(c => c.id === cli.id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...cli };
      } else {
        cli.id = genId();
        cli.criadoEm = new Date().toISOString();
        lista.push(cli);
      }
      _set('clientes', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('clientes', salvo);
      return salvo;
    },

    excluir: (id) => {
      _set('clientes', _get('clientes').filter(c => c.id !== id));
      Sync.delete('clientes', id);
    },

    totalGasto: (clienteId) => {
      const vendas = _get('vendas').filter(v => v.clienteId === clienteId);
      return vendas.reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
    },

    numCompras: (clienteId) => {
      return _get('vendas').filter(v => v.clienteId === clienteId).length;
    }
  };

  // ---- VENDAS ----
  const Vendas = {
    listar: () => _get('vendas'),

    buscar: (id) => _get('vendas').find(v => v.id === id),

    salvar: (venda) => {
      const lista = _get('vendas');
      const idx = lista.findIndex(v => v.id === venda.id);
      if (idx >= 0) {
        lista[idx] = venda;
      } else {
        venda.id = genId();
        venda.criadoEm = new Date().toISOString();
        lista.push(venda);
      }
      _set('vendas', lista);
      const salva = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('vendas', salva);
      return salva;
    },

    listarHoje: () => {
      // Usa data local (Brasil) para não perder vendas feitas depois das 21h
      const agora = new Date();
      const hoje = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
      const inicioHoje = new Date(hoje + 'T00:00:00').toISOString();
      const fimHoje    = new Date(hoje + 'T23:59:59').toISOString();
      return _get('vendas').filter(v => v.criadoEm && v.criadoEm >= inicioHoje && v.criadoEm <= fimHoje);
    },

    listarPorPeriodo: (inicio, fim) => {
      return _get('vendas').filter(v => {
        if (!v.criadoEm) return false;
        const d = v.criadoEm.substring(0, 10);
        return d >= inicio && d <= fim;
      });
    }
  };

  // ---- CREDIÁRIO ----
  const Crediario = {
    listar: () => _get('crediario'),

    buscar: (id) => _get('crediario').find(c => c.id === id),

    listarPorCliente: (clienteId) => _get('crediario').filter(c => c.clienteId === clienteId),

    salvar: (cred) => {
      const lista = _get('crediario');
      const idx = lista.findIndex(c => c.id === cred.id);
      if (idx >= 0) {
        lista[idx] = cred;
      } else {
        cred.id = genId();
        cred.criadoEm = new Date().toISOString();
        lista.push(cred);
      }
      _set('crediario', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('crediario', salvo);
      return salvo;
    },

    pagarParcela: (credId, parcelaIdx) => {
      const lista = _get('crediario');
      const cred = lista.find(c => c.id === credId);
      if (!cred || !cred.parcelas[parcelaIdx]) return false;
      cred.parcelas[parcelaIdx].status = 'pago';
      cred.parcelas[parcelaIdx].dataPagamento = new Date().toISOString();
      _set('crediario', lista);
      Sync.save('crediario', cred);
      return true;
    },

    // Retorna parcelas em atraso com dados do cliente
    inadimplentes: () => {
      const hoje = new Date().toISOString().substring(0, 10);
      const clientes = _get('clientes');
      const result = [];
      _get('crediario').forEach(cred => {
        cred.parcelas.forEach((p, idx) => {
          if (p.status !== 'pago' && p.vencimento < hoje) {
            const cli = clientes.find(c => c.id === cred.clienteId);
            result.push({
              credId: cred.id,
              parcelaIdx: idx,
              clienteNome: cli ? cli.nome : 'Cliente',
              vencimento: p.vencimento,
              valor: p.valor
            });
          }
        });
      });
      return result;
    },

    totalPendente: () => {
      let total = 0;
      _get('crediario').forEach(cred => {
        cred.parcelas.forEach(p => {
          if (p.status !== 'pago') total += parseFloat(p.valor) || 0;
        });
      });
      return total;
    }
  };

  // ---- CAIXA ----
  const Caixa = {
    listar: () => _get('caixa'),

    buscarAtivo: () => _get('caixa').find(c => c.status === 'aberto'),

    buscar: (id) => _get('caixa').find(c => c.id === id),

    salvar: (cx) => {
      const lista = _get('caixa');
      const idx = lista.findIndex(c => c.id === cx.id);
      if (idx >= 0) {
        lista[idx] = cx;
      } else {
        cx.id = genId();
        lista.push(cx);
      }
      _set('caixa', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('caixa', salvo);
      return salvo;
    }
  };

  // ---- FLUXO DE CAIXA ----
  const FluxoCaixa = {
    listar: () => _get('fluxo'),

    salvar: (mov) => {
      const lista = _get('fluxo');
      mov.id = genId();
      mov.data = mov.data || new Date().toISOString();
      lista.push(mov);
      _set('fluxo', lista);
      Sync.save('fluxo', mov);
      return mov;
    },

    listarPorMes: (ano, mes) => {
      const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
      return _get('fluxo').filter(m => (m.data || '').startsWith(prefix));
    },

    // Calcula entradas e saidas por mes dos últimos N meses
    resumoPorMeses: (n) => {
      const resultado = [];
      const agora = new Date();
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const ano = d.getFullYear();
        const mes = d.getMonth() + 1;
        const prefix = `${ano}-${String(mes).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const movs = _get('fluxo').filter(m => (m.data || '').startsWith(prefix));
        const vendas = _get('vendas').filter(v => (v.criadoEm || '').startsWith(prefix));
        const entradas = movs.filter(m => m.tipo === 'entrada').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0)
          + vendas.filter(v => v.formaPagamento !== 'crediario').reduce((s, v) => s + (parseFloat(v.total) || 0), 0);
        const saidas = movs.filter(m => m.tipo === 'saida').reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
        resultado.push({ label, entradas, saidas, mes: prefix });
      }
      return resultado;
    }
  };

  // ---- CONFIG ----
  const Config = {
    get: (chave, padrao = null) => {
      const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
      return cfg[chave] !== undefined ? cfg[chave] : padrao;
    },
    set: (chave, valor) => {
      const cfg = JSON.parse(localStorage.getItem(P + 'config') || '{}');
      cfg[chave] = valor;
      localStorage.setItem(P + 'config', JSON.stringify(cfg));
      if (_fbDb) {
        try {
          _fbDb.collection('movePe_config').doc('main').set(cfg)
            .catch(e => console.error('Erro ao salvar config no Firestore:', e));
        } catch (e) {}
      }
    }
  };

  // ---- DESPESAS ----
  const Despesas = {
    listar: () => _get('despesas'),

    listarPorMes: (mes) => {
      return _get('despesas').filter(d => {
        if (d.recorrente) return true; // fixas recorrentes sempre aparecem
        return (d.vencimento || '').startsWith(mes);
      });
    },

    buscar: (id) => _get('despesas').find(d => d.id === id),

    salvar: (desp) => {
      const lista = _get('despesas');
      const idx = lista.findIndex(d => d.id === desp.id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...desp };
      } else {
        desp.id = genId();
        desp.criadoEm = new Date().toISOString();
        lista.push(desp);
      }
      _set('despesas', lista);
      const salvo = idx >= 0 ? lista[idx] : lista[lista.length - 1];
      Sync.save('despesas', salvo);
      return salvo;
    },

    excluir: (id) => {
      _set('despesas', _get('despesas').filter(d => d.id !== id));
      Sync.delete('despesas', id);
    },

    marcarPago: (id) => {
      const lista = _get('despesas');
      const idx = lista.findIndex(d => d.id === id);
      if (idx < 0) return;
      lista[idx].pago = true;
      lista[idx].dataPagamento = new Date().toISOString();
      _set('despesas', lista);
      Sync.save('despesas', lista[idx]);
    },

    totalMes: (mes) => {
      return _get('despesas')
        .filter(d => d.recorrente || (d.vencimento || '').startsWith(mes))
        .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    }
  };

  // ---- BACKUP ----
  const exportar = () => {
    const agora = new Date();
    const dados = {
      versao: '2.0',
      exportadoEm: agora.toISOString(),
      produtos: _get('produtos'),
      clientes: _get('clientes'),
      vendas: _get('vendas'),
      crediario: _get('crediario'),
      caixa: _get('caixa'),
      fluxo: _get('fluxo'),
      config: JSON.parse(localStorage.getItem(P + 'config') || '{}')
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const pad = n => String(n).padStart(2, '0');
    const nomeDt = `${agora.getFullYear()}-${pad(agora.getMonth()+1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}`;
    a.download = `movePe_backup_${nomeDt}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // Registra data/hora do último backup
    localStorage.setItem(P + 'ultimo_backup', agora.toISOString());
  };

  const lerArquivoBackup = (arquivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { resolve(JSON.parse(e.target.result)); }
        catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(arquivo);
    });
  };

  const importar = (arquivo) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const dados = JSON.parse(e.target.result);
          if (dados.produtos) _set('produtos', dados.produtos);
          if (dados.clientes) _set('clientes', dados.clientes);
          if (dados.vendas) _set('vendas', dados.vendas);
          if (dados.crediario) _set('crediario', dados.crediario);
          if (dados.caixa) _set('caixa', dados.caixa);
          if (dados.fluxo) _set('fluxo', dados.fluxo);
          if (dados.config) localStorage.setItem(P + 'config', JSON.stringify(dados.config));
          Sync.syncAll();
          resolve(dados);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(arquivo);
    });
  };

  const ultimoBackup = () => localStorage.getItem(P + 'ultimo_backup') || null;

  // Inicializa Firebase ao carregar a página
  document.addEventListener('DOMContentLoaded', Sync.init);

  return { Produtos, Clientes, Vendas, Crediario, Caixa, FluxoCaixa, Despesas, Config, exportar, importar, lerArquivoBackup, ultimoBackup, genId, Sync, onReady };
})();
