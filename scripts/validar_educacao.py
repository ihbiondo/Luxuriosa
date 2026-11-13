#!/usr/bin/env python3
"""Valida estrutura, navegação, metadados e integridade local da Educação Luxuriosa.

Uso na raiz do repositório:
    python scripts/validar_educacao.py
Não exige dependências externas.
"""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import sys
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EDU = ROOT / "educacao"
BASE_URL = "https://luxuriosa.com.br"


class PageAudit(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.h1_count = 0
        self.title_open = False
        self.title_text = []
        self.description = False
        self.canonical = False
        self.sources = False
        self.related = False
        self.scripts: list[str] = []
        self.links: list[str] = []
        self.ids: set[str] = set()
        self.forbidden_media: list[str] = []

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
        elif tag in {"img", "picture", "video", "iframe", "embed", "object"}:
            self.forbidden_media.append(tag)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if "ed-sources" in attrs.get("class", "").split():
            self.sources = True
        if "ed-related" in attrs.get("class", "").split():
            self.related = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.title_open = False

    def handle_data(self, data: str) -> None:
        if self.title_open:
            self.title_text.append(data)


def resolve_local_link(source: Path, href: str) -> tuple[Path | None, str]:
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc or href.startswith("//"):
        return None, ""
    raw_path = parsed.path
    if not raw_path:
        target = source
    elif raw_path.startswith("/"):
        target = ROOT / raw_path.lstrip("/")
    else:
        target = source.parent / raw_path
    if raw_path.endswith("/"):
        target = target / "index.html"
    target = target.resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        return None, parsed.fragment
    return target, parsed.fragment


def main() -> int:
    pages = sorted(EDU.rglob("*.html"))
    errors: list[str] = []
    sitemap_path = ROOT / "sitemap.xml"
    sitemap_urls: set[str] = set()

    if sitemap_path.exists():
        try:
            xml = ET.parse(sitemap_path)
            sitemap_urls = {
                node.text.strip()
                for node in xml.getroot()
                if node.tag.endswith("loc") and node.text
            }
        except ET.ParseError as error:
            errors.append(f"sitemap.xml inválido: {error}")
    else:
        errors.append("sitemap.xml ausente")

    audits: dict[Path, PageAudit] = {}
    for page in pages:
        audit = PageAudit()
        try:
            page_text = page.read_text(encoding="utf-8")
            audit.feed(page_text)
        except (OSError, UnicodeDecodeError) as error:
            errors.append(f"{page.relative_to(ROOT)}: não foi possível ler: {error}")
            continue
        audits[page] = audit

        rel = page.relative_to(ROOT)
        if audit.h1_count != 1:
            errors.append(f"{rel}: esperado exatamente 1 H1; encontrado {audit.h1_count}")
        if not "".join(audit.title_text).strip():
            errors.append(f"{rel}: título HTML ausente")
        if not audit.description:
            errors.append(f"{rel}: meta description ausente")
        if not audit.canonical:
            errors.append(f"{rel}: canonical ausente")
        if "/js/educacao.js" not in audit.scripts:
            errors.append(f"{rel}: script modular compartilhado ausente")
        if 'localStorage.getItem("lux18")' not in page_text or "ed-age-pending" not in page_text:
            errors.append(f"{rel}: proteção visual antecipada da declaração 18+ ausente")
        if '<summary>Explorar módulos ⌄</summary>' not in page_text:
            errors.append(f"{rel}: menu de cinco módulos ausente")
        menu_match = re.search(r'<details class="ed-menu">([\\s\\S]*?)</details>', page_text)
        if not menu_match or len(re.findall(r'<a\\b', menu_match.group(1))) != 5:
            errors.append(f"{rel}: menu deve conter exatamente cinco módulos")
        if not re.search(r'<a class="ed-brand" href="/educacao/"', page_text):
            errors.append(f"{rel}: link da marca não retorna à Educação")
        if audit.forbidden_media:
            errors.append(f"{rel}: mídia visual não permitida: {', '.join(audit.forbidden_media)}")

        if page.name != "index.html":
            if not audit.sources:
                errors.append(f"{rel}: bloco de fontes ausente")
            if not audit.related:
                errors.append(f"{rel}: bloco de leituras relacionadas ausente")

        canonical_url = f"{BASE_URL}/{rel.as_posix()}"
        if rel.name == "index.html":
            canonical_url = f"{BASE_URL}/{rel.parent.as_posix()}/"
        if canonical_url not in sitemap_urls:
            errors.append(f"{rel}: URL canônica não encontrada no sitemap")

    for page, audit in audits.items():
        for href in audit.links:
            target, fragment = resolve_local_link(page, href)
            if target is None:
                continue
            if not target.exists():
                errors.append(f"{page.relative_to(ROOT)}: link local quebrado: {href}")
                continue
            if fragment and target.suffix.lower() == ".html" and target in audits:
                target_audit = audits[target]
                if fragment not in target_audit.ids:
                    errors.append(f"{page.relative_to(ROOT)}: âncora não encontrada: {href}")

    print(f"Educação Luxuriosa: {len(pages)} páginas HTML verificadas.")
    if errors:
        print(f"Encontrados {len(errors)} problemas:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Estrutura, metadados, fontes, módulos, mídias e links locais: OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
