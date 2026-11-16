#!/usr/bin/env python3
"""Valida cartões, atividades e perfis da área de Experiências Luxuriosa.

Uso na raiz do repositório:
    python scripts/validar_experiencias.py
Não exige dependências externas.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
EXPERIENCES = ROOT / "experiencias"
SIGN_SLUGS = (
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
)
EXPECTED_DIALOG_ACTIVITIES = {"discovery", "connection", "curiosity", "challenge"}
EXPECTED_CARDS = {"discovery", "connection", "curiosity", "challenge", "astrology"}
REQUIRED_PROFILE_SECTIONS = (
    "Relacionamentos e vínculos",
    "Intimidade e expressão",
    "Um caminho de crescimento",
)


class PageAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.h1_count = 0
        self.title_open = False
        self.title_text: list[str] = []
        self.description = False
        self.canonical = False
        self.scripts: list[str] = []
        self.links: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs = dict(attrs)
        if tag == "h1":
            self.h1_count += 1
        elif tag == "title":
            self.title_open = True
        elif tag == "meta" and attrs.get("name", "").lower() == "description":
            self.description = bool(attrs.get("content", "").strip())
        elif tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonical = bool(attrs.get("href", "").strip())
        elif tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"])
        elif tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if attrs.get("id"):
            self.ids.add(attrs["id"])

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.title_open = False

    def handle_data(self, data: str) -> None:
        if self.title_open:
            self.title_text.append(data)


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    plain = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", plain)).strip()


def read(path: Path, errors: list[str]) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        errors.append(f"{path.relative_to(ROOT)}: não foi possível ler: {error}")
        return ""


def main() -> int:
    errors: list[str] = []
    index_path = EXPERIENCES / "index.html"
    index = read(index_path, errors)
    script_path = ROOT / "js" / "experiencias.js"
    script = read(script_path, errors)

    cards = re.findall(r'<article\b[^>]*class="[^"]*\bcard\b[^"]*"[^>]*>', index, re.IGNORECASE)
    card_ids = re.findall(r'<article\b[^>]*\bdata-id="([^"]+)"', index, re.IGNORECASE)
    card_categories = re.findall(r'<article\b[^>]*\bdata-category="([^"]+)"', index, re.IGNORECASE)
    if len(cards) != 5 or set(card_ids) != EXPECTED_CARDS or len(card_ids) != len(set(card_ids)):
        errors.append("experiencias/index.html: esperado um catálogo com cinco cartões únicos e IDs conhecidos")
    if set(card_categories) != {"quiz", "couple", "challenge", "astrology"}:
        errors.append("experiencias/index.html: categorias dos cartões não correspondem às atividades")

    filters = set(re.findall(r'\bdata-filter="([^"]+)"', index))
    if not {"all", "quiz", "couple", "challenge", "astrology", "favorites"}.issubset(filters):
        errors.append("experiencias/index.html: filtros principais ou favoritos ausentes")

    activity_buttons = set(re.findall(r'\bdata-experience="([^"]+)"', index))
    if activity_buttons != EXPECTED_DIALOG_ACTIVITIES:
        errors.append("experiencias/index.html: botões das atividades não correspondem aos quatro fluxos interativos")

    if 'id="ageGate"' not in index or 'id="ageConfirm"' not in index:
        errors.append("experiencias/index.html: declaração de maioridade ausente")
    if "/js/experiencias.js" not in index or "/js/experiencias-salvar.js" not in index:
        errors.append("experiencias/index.html: scripts principais das experiências ausentes")

    card = re.search(r'<article\b(?=[^>]*\bdata-id="curiosity")[\s\S]*?</article>', index, re.IGNORECASE)
    card_text = card.group(0) if card else ""
    for phrase in ("saúde sexual", "prevenção", "privacidade", "acessórios"):
        if phrase not in card_text.casefold():
            errors.append(f"experiencias/index.html: cartão Mitos ou verdades não comunica o tema {phrase!r}")

    curiosity_start = script.find('\n  curiosity:{\n    id:"curiosity"')
    curiosity_end = script.find('\n  challenge:{', curiosity_start)
    if curiosity_start < 0 or curiosity_end < 0:
        errors.append("js/experiencias.js: bloco do quiz Mitos ou verdades não foi encontrado")
        curiosity_block = ""
    else:
        curiosity_block = script[curiosity_start:curiosity_end]

    questions = re.findall(
        r'\{question:"([^"]+)",prompt:"([^"]+)",answer:(true|false),explanation:"([^"]+)"\}',
        curiosity_block,
        flags=re.DOTALL,
    )
    if len(questions) != 15:
        errors.append(f"js/experiencias.js: esperado quiz com 15 afirmações completas; encontrado {len(questions)}")

    seen: set[str] = set()
    for number, (question, prompt, answer, explanation) in enumerate(questions, start=1):
        key = normalize(question)
        if not key:
            errors.append(f"js/experiencias.js: questão {number} sem enunciado")
        elif key in seen:
            errors.append(f"js/experiencias.js: enunciado duplicado no quiz: {question}")
        else:
            seen.add(key)
        if answer not in {"true", "false"} or not prompt.strip() or not explanation.strip():
            errors.append(f"js/experiencias.js: questão {number} sem resposta, instrução ou explicação válida")

    if questions and "dormindo ou inconsciente" not in normalize(questions[-1][0]):
        errors.append("js/experiencias.js: o quiz deve cobrir a impossibilidade de consentir durante sono ou inconsciência")
    if "O consentimento pode ser retirado mesmo depois da atividade começar." in curiosity_block:
        errors.append("js/experiencias.js: repetição antiga sobre retirada do consentimento ainda está presente")

    if "Quinze afirmações" not in curiosity_block:
        errors.append("js/experiencias.js: descrição interna do quiz não foi alinhada às afirmações")

    sign_pages = [EXPERIENCES / "signos" / f"{slug}.html" for slug in SIGN_SLUGS]
    for page in sign_pages:
        content = read(page, errors)
        if not content:
            continue
        audit = PageAudit()
        audit.feed(content)
        rel = page.relative_to(ROOT)
        if audit.h1_count != 1:
            errors.append(f"{rel}: esperado exatamente um H1")
        if not "".join(audit.title_text).strip() or not audit.description or not audit.canonical:
            errors.append(f"{rel}: título, descrição ou URL canônica ausente")
        if "/js/signo-detalhe.js" not in audit.scripts:
            errors.append(f"{rel}: script de navegação e proteção da página ausente")
        if 'id="ageGate"' not in content or 'id="ageConfirm"' not in content:
            errors.append(f"{rel}: declaração de maioridade ausente")
        for section in REQUIRED_PROFILE_SECTIONS:
            if section not in content:
                errors.append(f"{rel}: seção editorial ausente: {section}")
        if "/experiencias/signos.html#signCalculator" not in content:
            errors.append(f"{rel}: retorno à calculadora do signo solar ausente")

    # Confere destinos internos entre as próprias páginas da área de Experiências.
    known_pages = {index_path.resolve(), (EXPERIENCES / "signos.html").resolve(), *(p.resolve() for p in sign_pages)}
    for page in [index_path, EXPERIENCES / "signos.html", *sign_pages]:
        if not page.exists():
            continue
        audit = PageAudit()
        audit.feed(read(page, errors))
        for href in audit.links:
            parsed = urlsplit(href)
            if parsed.scheme or parsed.netloc or not parsed.path.startswith("/experiencias/"):
                continue
            target = ROOT / parsed.path.lstrip("/")
            if parsed.path.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                errors.append(f"{page.relative_to(ROOT)}: link interno quebrado: {href}")
                continue
            if parsed.fragment and target.resolve() in known_pages:
                target_audit = PageAudit()
                target_audit.feed(read(target, errors))
                if parsed.fragment not in target_audit.ids:
                    errors.append(f"{page.relative_to(ROOT)}: âncora interna não encontrada: {href}")

    print(f"Experiências Luxuriosa: catálogo e {len(sign_pages)} perfis astrológicos verificados.")
    if errors:
        print(f"Encontrados {len(errors)} problemas:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Cartões, filtros, quiz, explicações, maioridade, estrutura dos perfis e links internos: OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
