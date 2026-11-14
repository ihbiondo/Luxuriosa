(function (global) {
  "use strict";

  const FORMATS = {
    story: { width: 1080, height: 1920, label: "Story / Status", filename: "story" },
    square: { width: 1080, height: 1080, label: "Feed quadrado", filename: "feed" }
  };

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/);
    let line = "";
    let lineCount = 0;
    for (let i = 0; i < words.length; i += 1) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        y += lineHeight;
        lineCount += 1;
        line = words[i];
        if (lineCount >= maxLines - 1) break;
      } else {
        line = test;
      }
    }
    if (lineCount < maxLines && line) ctx.fillText(line, x, y);
  }

  function drawDecor(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#10090d");
    gradient.addColorStop(0.48, "#2a101d");
    gradient.addColorStop(1, "#090809");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.22;
    const glow = ctx.createRadialGradient(width * 0.83, height * 0.25, 10, width * 0.83, height * 0.25, width * 0.7);
    glow.addColorStop(0, "#a02b55");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(212,175,124,.24)";
    ctx.lineWidth = 2;
    [0.12, 0.2, 0.29].forEach(function (factor) {
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.42, width * factor, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.fillStyle = "rgba(212,175,124,.5)";
    [[0.12,0.13],[0.84,0.18],[0.18,0.66],[0.8,0.76],[0.72,0.52],[0.27,0.39]].forEach(function (point) {
      ctx.beginPath();
      ctx.arc(width * point[0], height * point[1], 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function draw(sign, canvas, formatName) {
    const format = FORMATS[formatName] || FORMATS.story;
    canvas.width = format.width;
    canvas.height = format.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu preparar a imagem.");

    const w = format.width;
    const h = format.height;
    const story = formatName === "story";
    const centerX = w / 2;
    drawDecor(ctx, w, h);

    const top = story ? 210 : 105;
    const contentWidth = story ? 820 : 850;
    const side = (w - contentWidth) / 2;

    ctx.textAlign = "center";
    ctx.fillStyle = "#d4af7c";
    ctx.font = "700 27px Montserrat, Arial, sans-serif";
    ctx.fillText("L U X U R I O S A", centerX, top);
    ctx.font = "600 17px Montserrat, Arial, sans-serif";
    ctx.fillStyle = "rgba(248,239,241,.68)";
    ctx.fillText("EXPERIÊNCIAS  ·  ASTROLOGIA", centerX, top + 42);

    const glyphY = story ? 720 : 390;
    const glyphSize = story ? 310 : 230;
    ctx.save();
    ctx.strokeStyle = "rgba(212,175,124,.64)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, glyphY - glyphSize * 0.35, glyphSize * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#f3b5cc";
    ctx.font = "400 " + glyphSize + "px Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(sign.glyph, centerX, glyphY - glyphSize * 0.35);
    ctx.restore();

    const titleY = story ? 1125 : 640;
    ctx.fillStyle = "#d4af7c";
    ctx.font = "700 24px Montserrat, Arial, sans-serif";
    ctx.fillText("SEU SIGNO SOLAR", centerX, titleY);
    ctx.fillStyle = "#fff4f6";
    ctx.font = "400 " + (story ? 104 : 82) + "px 'Playfair Display', Georgia, serif";
    ctx.fillText(sign.name, centerX, titleY + (story ? 128 : 100));

    ctx.fillStyle = "#f1a5bd";
    ctx.font = "italic " + (story ? 34 : 27) + "px Georgia, serif";
    wrapText(ctx, sign.archetype, centerX, titleY + (story ? 220 : 172), contentWidth, story ? 47 : 38, 2);

    const tagY = titleY + (story ? 360 : 282);
    const tags = [sign.element, sign.modality, sign.period.shortLabel];
    const tagWidth = story ? 230 : 210;
    const gap = 16;
    const total = tags.length * tagWidth + (tags.length - 1) * gap;
    let x = centerX - total / 2;
    tags.forEach(function (tag) {
      ctx.fillStyle = "rgba(212,175,124,.11)";
      ctx.strokeStyle = "rgba(212,175,124,.55)";
      ctx.lineWidth = 2;
      roundedRect(ctx, x, tagY - 38, tagWidth, 68, 34);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#f5dfc0";
      ctx.font = "600 " + (story ? 20 : 17) + "px Montserrat, Arial, sans-serif";
      ctx.fillText(tag, x + tagWidth / 2, tagY + 5);
      x += tagWidth + gap;
    });

    const quoteY = tagY + (story ? 190 : 140);
    ctx.fillStyle = "#f8eff1";
    ctx.font = "400 " + (story ? 31 : 26) + "px 'Playfair Display', Georgia, serif";
    wrapText(ctx, sign.shareLine || sign.profile.overview, centerX, quoteY, contentWidth, story ? 48 : 39, story ? 4 : 3);

    const footerY = story ? h - 180 : h - 100;
    ctx.strokeStyle = "rgba(212,175,124,.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(side, footerY - 72);
    ctx.lineTo(w - side, footerY - 72);
    ctx.stroke();
    ctx.fillStyle = "#d4af7c";
    ctx.font = "700 23px Montserrat, Arial, sans-serif";
    ctx.fillText("DESCUBRA O SEU", centerX, footerY - 18);
    ctx.fillStyle = "#f8eff1";
    ctx.font = "500 24px Montserrat, Arial, sans-serif";
    ctx.fillText("luxuriosa.com.br", centerX, footerY + 28);
    ctx.fillStyle = "rgba(248,239,241,.5)";
    ctx.font = "400 15px Montserrat, Arial, sans-serif";
    ctx.fillText("Uma experiência de curiosidade e autoconhecimento", centerX, footerY + 75);
  }

  function makeBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível gerar o arquivo da imagem."));
      }, "image/png");
    });
  }

  function mount(config) {
    const canvas = document.getElementById(config.canvasId);
    const storyButton = document.getElementById(config.storyButtonId);
    const squareButton = document.getElementById(config.squareButtonId);
    const downloadButton = document.getElementById(config.downloadButtonId);
    const shareButton = document.getElementById(config.shareButtonId);
    const whatsAppLink = document.getElementById(config.whatsAppLinkId);
    const status = document.getElementById(config.statusId);
    if (!canvas || !storyButton || !squareButton || !downloadButton || !shareButton || !whatsAppLink || !status) return null;

    let sign = null;
    let format = "story";
    let blob = null;
    let rendered = false;

    function setStatus(message) {
      status.textContent = message;
    }

    function updateActions() {
      downloadButton.disabled = !rendered;
      shareButton.disabled = !rendered;
      const url = window.location.href.split("#")[0];
      const message = sign ? "Olha o perfil simbólico de " + sign.name + " nesta experiência da Luxuriosa: " + url : url;
      whatsAppLink.href = "https://wa.me/?text=" + encodeURIComponent(message);
    }

    async function render() {
      if (!sign) return;
      try {
        draw(sign, canvas, format);
        blob = await makeBlob(canvas);
        rendered = true;
        updateActions();
        setStatus(FORMATS[format].label + " pronta. A arte é criada no seu dispositivo.");
      } catch (error) {
        rendered = false;
        updateActions();
        setStatus(error.message || "Não foi possível montar a arte neste navegador.");
      }
    }

    function setSign(nextSign) {
      sign = nextSign;
      rendered = false;
      blob = null;
      updateActions();
      render();
    }

    storyButton.addEventListener("click", function () {
      format = "story";
      storyButton.setAttribute("aria-pressed", "true");
      squareButton.setAttribute("aria-pressed", "false");
      render();
    });
    squareButton.addEventListener("click", function () {
      format = "square";
      squareButton.setAttribute("aria-pressed", "true");
      storyButton.setAttribute("aria-pressed", "false");
      render();
    });

    downloadButton.addEventListener("click", async function () {
      if (!rendered || !blob || !sign) return;
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = "luxuriosa-" + sign.id + "-" + FORMATS[format].filename + ".png";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
      setStatus("Imagem baixada. Você já pode publicar no Story, Status ou Feed.");
    });

    shareButton.addEventListener("click", async function () {
      if (!rendered || !blob || !sign) return;
      const file = new File([blob], "luxuriosa-" + sign.id + "-" + FORMATS[format].filename + ".png", { type: "image/png" });
      const shareData = {
        title: sign.name + " — Astrologia Luxuriosa",
        text: "Meu signo na experiência da Luxuriosa.",
        files: [file]
      };
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          await navigator.share(shareData);
          setStatus("Compartilhamento concluído ou enviado ao aplicativo escolhido.");
        } else {
          setStatus("Este navegador não compartilha imagens diretamente. Use Baixar imagem e anexe o arquivo no aplicativo desejado.");
        }
      } catch (error) {
        if (error && error.name === "AbortError") return;
        setStatus("Não foi possível abrir o compartilhamento. Baixe a imagem para enviá-la manualmente.");
      }
    });

    updateActions();
    return { setSign: setSign, render: render };
  }

  global.LuxuriosaSignShare = { mount: mount };
})(window);
