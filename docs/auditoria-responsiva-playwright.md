# Auditoria responsiva mobile-first com Playwright

A auditoria usa Playwright e Chromium local. Não utiliza TinyFish, não exige login e não executa compras ou operações no banco de dados.

## Requisitos

- Node.js 22 ou superior
- Python 3 (para servir os arquivos estáticos localmente)
- Conexão com a internet apenas na primeira instalação do Playwright e do Chromium

## Preparação no Windows (CMD)

Abra o CMD na pasta do projeto:

```bat
cd /d "T:\0 - LOJA SEXSHOP\Luxuriosa-Site"
npm install --no-save --package-lock=false playwright@1
npx playwright install chromium
```

## Executar a auditoria

Em um segundo CMD, inicie o servidor local na pasta do projeto:

```bat
cd /d "T:\0 - LOJA SEXSHOP\Luxuriosa-Site"
py -m http.server 4173
```

No primeiro CMD, execute:

```bat
set E2E_BASE_URL=http://127.0.0.1:4173
set RESPONSIVE_SCREENSHOT_DIR=artifacts\responsividade
set RESPONSIVE_REPORT_PATH=artifacts\responsividade\report.json
node tests\e2e\responsividade.mjs
```

## O que é verificado

- Rotas públicas presentes no `sitemap.xml`, em largura mobile de 360 px.
- Páginas centrais em 320, 360, 390, 430, 768, 1024 e 1440 px.
- Rolagem horizontal, presença da meta viewport e rotas com erro.
- Carregamento e enquadramento das imagens dos cards de lingerie.
- `object-fit`, ponto de foco e estimativa de corte de cada foto.
- Abertura e altura do modal de detalhes em celular.
- Screenshots e relatório JSON para revisão dos problemas encontrados.

Os arquivos ficam em `artifacts\responsividade\`. Para encerrar o servidor, pressione `Ctrl+C` no segundo CMD.

## Execução automatizada

O workflow `.github/workflows/payment-validate.yml` executa o mesmo script em uma cópia temporária do site no runner do GitHub Actions e publica as evidências como artefato. A rotina de responsividade não depende das credenciais do Supabase usadas pela outra etapa E2E.
