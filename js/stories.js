/**
 * MOVE PÉ - Stories do Instagram v1.0
 * Gera stories profissionais para divulgar produtos
 * Canvas: 1080×1920 (formato Instagram Story)
 */

const STORY_W = 1080;
const STORY_H = 1920;
const PREVIEW_W = 320; // largura do canvas no browser

// ---- CONFIGURAÇÃO DOS TEMPLATES ----
const TEMPLATES = [
  {
    id: 'destaque',
    label: 'Destaque',
    emoji: '⭐',
    gradient: ['#1a1a2e', '#16213e'],
    accentTop: true,
    showDesconto: false,
  },
  {
    id: 'promocao',
    label: 'Promoção',
    emoji: '🔥',
    gradient: ['#c0392b', '#922b21'],
    accentTop: false,
    showDesconto: true,
  },
  {
    id: 'novidade',
    label: 'Novidade',
    emoji: '✨',
    gradient: ['#1a3a1a', '#0d260d'],
    accentTop: true,
    showDesconto: false,
  },
  {
    id: 'liquidacao',
    label: 'Liquidação',
    emoji: '💥',
    gradient: ['#1a0a00', '#3d1200'],
    accentTop: false,
    showDesconto: true,
  },
];

// ---- PALETAS DE COR ----
const PALETAS = [
  { cor: '#6366f1', label: 'Roxo' },
  { cor: '#ec4899', label: 'Rosa' },
  { cor: '#f59e0b', label: 'Âmbar' },
  { cor: '#10b981', label: 'Verde' },
  { cor: '#3b82f6', label: 'Azul' },
  { cor: '#ef4444', label: 'Vermelho' },
  { cor: '#ffffff', label: 'Branco' },
  { cor: '#f8fafc', label: 'Off-white' },
];

// ---- ESTADO ----
let _templateAtual = TEMPLATES[0];
let _corAtual = PALETAS[0].cor;

const Stories = {

  init: () => {
    Utils.renderNav('stories.html');

    // Montar canvas
    const canvas = document.getElementById('storyCanvas');
    const scale = PREVIEW_W / STORY_W;
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    canvas.style.width = PREVIEW_W + 'px';
    canvas.style.height = Math.round(STORY_H * scale) + 'px';

    // Renderizar template selector
    Stories._renderTemplateGrid();

    // Renderizar paletas
    Stories._renderColorChips();

    // Preencher produtos
    Stories._popularProdutos();

    // Preencher rodapé com WhatsApp das configurações
    const tel = DB.Config.get('whatsapp', '');
    const loja = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    const insta = DB.Config.get('instagram', '');
    let rodapeDefault = tel ? Utils.telefone(tel) : '';
    if (insta) rodapeDefault += (rodapeDefault ? ' · ' : '') + '@' + insta.replace('@', '');
    document.getElementById('inputRodape').value = rodapeDefault || '@movepecalcados';
    document.getElementById('inputCta').value = 'Venha conferir! 🔥 Parcelas no cartão!';

    Stories.renderPreview();
  },

  _renderTemplateGrid: () => {
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = TEMPLATES.map(t => `
      <div class="template-card ${t.id === _templateAtual.id ? 'ativo' : ''}"
           onclick="Stories.selecionarTemplate('${t.id}')">
        <div class="tc-thumb" style="background:linear-gradient(160deg,${t.gradient[0]},${t.gradient[1]})">
          <span>${t.emoji}</span>
        </div>
        <div class="tc-label">${t.label}</div>
      </div>`).join('');
  },

  _renderColorChips: () => {
    const cont = document.getElementById('colorChips');
    cont.innerHTML = PALETAS.map(p => `
      <div class="color-chip ${p.cor === _corAtual ? 'ativo' : ''}"
           style="background:${p.cor};border-color:${p.cor === _corAtual ? 'var(--primary)' : 'transparent'}"
           title="${p.label}"
           onclick="Stories.selecionarCor('${p.cor}')"></div>`).join('');
  },

  _popularProdutos: () => {
    const sel = document.getElementById('selectProduto');
    const prods = DB.Produtos.listarAtivos().sort((a, b) => a.nome.localeCompare(b.nome));
    sel.innerHTML = '<option value="">— Digitar manualmente —</option>' +
      prods.map(p => {
        const total = DB.Produtos.estoqueTotal(p);
        return `<option value="${p.id}" data-preco="${p.precoVenda}">${p.nome}${p.marca ? ' · ' + p.marca : ''} — ${Utils.moeda(p.precoVenda)} (${total} un)</option>`;
      }).join('');
  },

  selecionarTemplate: (id) => {
    _templateAtual = TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
    Stories._renderTemplateGrid();
    // Mostrar/ocultar seção desconto
    document.getElementById('secaoDesconto').style.display = _templateAtual.showDesconto ? '' : 'none';
    Stories.renderPreview();
  },

  selecionarCor: (cor) => {
    _corAtual = cor;
    Stories._renderColorChips();
    Stories.renderPreview();
  },

  onProdutoChange: () => {
    const sel = document.getElementById('selectProduto');
    const opt = sel.options[sel.selectedIndex];
    if (!opt.value) return;

    const prod = DB.Produtos.buscar(opt.value);
    if (!prod) return;

    document.getElementById('inputTitulo').value = prod.nome;

    // Montar subtítulo com tamanhos disponíveis
    const variacoes = prod.variacoes || {};
    const tams = Object.keys(variacoes)
      .filter(k => variacoes[k] > 0)
      .map(k => k.split('||')[0])
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .sort((a, b) => parseFloat(a) - parseFloat(b));
    if (tams.length > 0) {
      document.getElementById('inputSub').value = `Tamanhos disponíveis: ${tams.join(', ')}`;
    }

    document.getElementById('inputPreco').value = prod.precoVenda || '';
    document.getElementById('inputPrecoOriginal').value = '';

    Stories.renderPreview();
  },

  limparProduto: () => {
    document.getElementById('selectProduto').value = '';
    document.getElementById('inputTitulo').value = '';
    document.getElementById('inputSub').value = '';
    document.getElementById('inputPreco').value = '';
    document.getElementById('inputPrecoOriginal').value = '';
    Stories.renderPreview();
  },

  // ---- CANVAS ----
  renderPreview: () => {
    const canvas = document.getElementById('storyCanvas');
    const ctx = canvas.getContext('2d');
    Stories._desenhar(ctx);
  },

  _val: (id) => (document.getElementById(id)?.value || '').trim(),

  _desenhar: (ctx) => {
    const t = _templateAtual;
    const W = STORY_W;
    const H = STORY_H;

    // --- FUNDO ---
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    grad.addColorStop(0, t.gradient[0]);
    grad.addColorStop(1, t.gradient[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // --- ACENTO GEOMÉTRICO ---
    Stories._desenharAcento(ctx, W, H, t);

    // --- LOGOTIPO ---
    Stories._desenharLogo(ctx, W, H);

    // --- CONTEÚDO CENTRAL ---
    Stories._desenharConteudo(ctx, W, H, t);

    // --- RODAPÉ ---
    Stories._desenharRodape(ctx, W, H);
  },

  _desenharAcento: (ctx, W, H, t) => {
    ctx.save();
    ctx.globalAlpha = 0.12;

    // Círculo grande decorativo
    ctx.beginPath();
    ctx.arc(W * 0.85, t.accentTop ? H * 0.15 : H * 0.85, W * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = _corAtual;
    ctx.fill();

    // Círculo médio
    ctx.beginPath();
    ctx.arc(W * 0.1, t.accentTop ? H * 0.35 : H * 0.65, W * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = _corAtual;
    ctx.fill();

    ctx.globalAlpha = 1;

    // Linha de cor vibrante no topo
    ctx.fillStyle = _corAtual;
    ctx.fillRect(0, 0, W, 12);

    ctx.restore();
  },

  _desenharLogo: (ctx, W, H) => {
    const loja = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');
    ctx.save();

    // Badge do logo
    const badgeY = 80;
    const badgeH = 90;
    const badgePad = 60;
    const txtW = Stories._medirTexto(ctx, loja, 'bold 48px Arial') + badgePad * 2;
    const badgeX = (W - txtW) / 2;

    ctx.fillStyle = _corAtual;
    ctx.globalAlpha = 0.15;
    Stories._roundRect(ctx, badgeX, badgeY, txtW, badgeH, 16);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = _corAtual;
    ctx.lineWidth = 3;
    Stories._roundRect(ctx, badgeX, badgeY, txtW, badgeH, 16);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText(loja, W / 2, badgeY + 58);

    ctx.restore();
  },

  _desenharConteudo: (ctx, W, H, t) => {
    const titulo = Stories._val('inputTitulo') || 'Nome do Produto';
    const sub = Stories._val('inputSub');
    const precoFinal = parseFloat(Stories._val('inputPreco')) || 0;
    const precoOriginal = parseFloat(Stories._val('inputPrecoOriginal')) || 0;
    const descPct = parseInt(Stories._val('inputDescPct')) || 0;
    const cta = Stories._val('inputCta') || 'Venha conferir!';

    ctx.save();

    const centerY = H * 0.45;

    // ---- TEMPLATE-SPECIFIC BADGE ----
    if (t.id === 'promocao' || t.id === 'liquidacao') {
      const pct = descPct || (precoOriginal > precoFinal && precoFinal > 0
        ? Math.round((1 - precoFinal / precoOriginal) * 100)
        : 0);

      if (pct > 0) {
        // Círculo grande de desconto
        const cx = W / 2;
        const cy = H * 0.28;
        const r = 220;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = _corAtual;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 140px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pct + '%', cx, cy - 20);

        ctx.font = 'bold 64px Arial, sans-serif';
        ctx.fillText('OFF', cx, cy + 80);
      } else {
        // Banner de liquidação
        Stories._desenharBannerLiquidacao(ctx, W, H, t);
      }
    } else if (t.id === 'novidade') {
      // Badge "NOVIDADE"
      Stories._desenharBadgeNovidade(ctx, W, H);
    } else {
      // Destaque: ícone de produto estilizado
      Stories._desenharIconeProduto(ctx, W, H);
    }

    // ---- TÍTULO ----
    const tituloY = H * 0.58;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    Stories._wrapText(ctx, titulo, W / 2, tituloY, W - 120, 92);
    ctx.shadowBlur = 0;

    // ---- SUBTÍTULO ----
    if (sub) {
      const subLines = Stories._calcWrapLines(ctx, sub, W - 160, 'bold 44px Arial, sans-serif');
      const subY = tituloY + 95 * Math.ceil(titulo.length / 20) + 20;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 44px Arial, sans-serif';
      subLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, subY + i * 54);
      });
    }

    // ---- PREÇO ----
    if (precoFinal > 0) {
      const precoY = H * 0.77;

      if (precoOriginal > 0 && precoOriginal > precoFinal) {
        // Preço riscado
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '500 54px Arial, sans-serif';
        ctx.textAlign = 'center';
        const deStr = 'De: ' + Utils.moeda(precoOriginal);
        ctx.fillText(deStr, W / 2, precoY - 60);
        // Linha riscada
        const deMedida = ctx.measureText(deStr);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.moveTo(W / 2 - deMedida.width / 2, precoY - 72);
        ctx.lineTo(W / 2 + deMedida.width / 2, precoY - 72);
        ctx.stroke();
      }

      // Badge de preço principal
      const precoStr = 'Por: ' + Utils.moeda(precoFinal);
      ctx.font = 'bold 72px Arial, sans-serif';
      const pW = ctx.measureText(precoStr).width + 80;
      const pH = 100;
      const pX = (W - pW) / 2;
      const pYBox = precoY - 10;

      ctx.fillStyle = _corAtual;
      ctx.globalAlpha = 0.9;
      Stories._roundRect(ctx, pX, pYBox, pW, pH, 50);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#ffffff';
      ctx.fillText(precoStr, W / 2, pYBox + 70);
    }

    // ---- CTA ----
    const ctaY = H * 0.875;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 15;
    ctx.fillText(cta, W / 2, ctaY);
    ctx.shadowBlur = 0;

    ctx.restore();
  },

  _desenharBannerLiquidacao: (ctx, W, H) => {
    ctx.save();
    const by = H * 0.22;
    ctx.fillStyle = _corAtual;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, by, W, 180);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LIQUIDAÇÃO', W / 2, by + 140);
    ctx.restore();
  },

  _desenharBadgeNovidade: (ctx, W, H) => {
    ctx.save();
    const by = H * 0.2;

    // Estrelas decorativas
    [
      [W * 0.15, by + 80, 30],
      [W * 0.82, by + 40, 22],
      [W * 0.72, by + 130, 16],
    ].forEach(([x, y, s]) => {
      ctx.fillStyle = _corAtual;
      ctx.globalAlpha = 0.8;
      ctx.font = `bold ${s * 2}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('✦', x, y + s);
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = _corAtual;
    ctx.globalAlpha = 0.2;
    Stories._roundRect(ctx, W * 0.1, by, W * 0.8, 160, 80);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = _corAtual;
    ctx.lineWidth = 4;
    Stories._roundRect(ctx, W * 0.1, by, W * 0.8, 160, 80);
    ctx.stroke();

    ctx.fillStyle = _corAtual;
    ctx.font = 'bold 84px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨ CHEGOU NOVIDADE!', W / 2, by + 112);
    ctx.restore();
  },

  _desenharIconeProduto: (ctx, W, H) => {
    ctx.save();
    const cx = W / 2;
    const cy = H * 0.28;
    const r = 200;

    // Círculo fundo
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = _corAtual;
    ctx.globalAlpha = 0.15;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = _corAtual;
    ctx.lineWidth = 6;
    ctx.stroke();

    // Emoji de calçado
    ctx.font = '200px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('👟', cx, cy + 80);

    ctx.restore();
  },

  _desenharRodape: (ctx, W, H) => {
    const rodape = Stories._val('inputRodape');
    if (!rodape) return;
    ctx.save();

    // Faixa de rodapé
    const faixaH = 100;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - faixaH - 20, W, faixaH + 20);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rodape, W / 2, H - 40);

    ctx.restore();
  },

  // ---- HELPERS DE CANVAS ----
  _roundRect: (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  },

  _medirTexto: (ctx, txt, font) => {
    ctx.save();
    ctx.font = font;
    const w = ctx.measureText(txt).width;
    ctx.restore();
    return w;
  },

  _calcWrapLines: (ctx, txt, maxW, font) => {
    ctx.save();
    ctx.font = font;
    const words = txt.split(' ');
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  },

  _wrapText: (ctx, txt, x, y, maxW, lineH) => {
    const words = txt.split(' ');
    let line = '';
    let currentY = y;
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineH;
      } else {
        line = test;
      }
    });
    ctx.fillText(line, x, currentY);
  },

  // ---- AÇÕES ----
  download: () => {
    const canvas = document.getElementById('storyCanvas');
    const titulo = Stories._val('inputTitulo') || 'story';
    const nome = titulo.toLowerCase().replace(/[^a-z0-9]/gi, '_').substring(0, 30);
    const link = document.createElement('a');
    link.download = `movePe_story_${nome}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    Utils.toast('Story baixado com sucesso!', 'success');
  },

  copiarTexto: () => {
    const titulo = Stories._val('inputTitulo');
    const sub = Stories._val('inputSub');
    const precoFinal = parseFloat(Stories._val('inputPreco')) || 0;
    const precoOriginal = parseFloat(Stories._val('inputPrecoOriginal')) || 0;
    const cta = Stories._val('inputCta');
    const rodape = Stories._val('inputRodape');
    const loja = DB.Config.get('nomeLoja', 'MOVE PÉ CALÇADOS');

    let txt = `${loja}\n\n`;
    if (titulo) txt += `👟 ${titulo}\n`;
    if (sub) txt += `${sub}\n`;
    if (precoOriginal > 0 && precoOriginal > precoFinal) {
      txt += `\nDe: ${Utils.moeda(precoOriginal)}\n`;
    }
    if (precoFinal > 0) txt += `Por: ${Utils.moeda(precoFinal)}\n`;
    if (cta) txt += `\n${cta}\n`;
    if (rodape) txt += `\n📍 ${rodape}`;

    // Hashtags baseadas no produto
    txt += `\n\n#movepecalcados #calcados #tenis #moda #promocao`;

    navigator.clipboard.writeText(txt).then(() => {
      const el = document.getElementById('legendaCopiada');
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2500);
    }).catch(() => {
      Utils.toast('Não foi possível copiar. Tente manualmente.', 'error');
    });
  },
};

document.addEventListener('DOMContentLoaded', Stories.init);
