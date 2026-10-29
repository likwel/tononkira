"""Conversion d'un fragment HTML de paroles en texte brut lisible."""

from __future__ import annotations

import re

from bs4 import Comment, NavigableString, Tag

_SPACES = re.compile(r"[ \t ]+")
_HTML_WHITESPACE = re.compile(r"[ \t\r\n\f]+")
_MANY_BLANK_LINES = re.compile(r"\n{3,}")


def lyrics_from_html(node: Tag) -> str:
    """Retourne les paroles d'un bloc HTML comme le navigateur les affiche : une
    ligne par `<br>`, strophes séparées par une ligne vide. Les retours à la ligne
    et l'indentation du code source ne comptent pas ; l'indentation en `&nbsp;`
    (souvent utilisée pour les refrains) est conservée."""
    parts: list[str] = []
    for el in node.descendants:
        if isinstance(el, Comment):
            continue
        if isinstance(el, NavigableString):
            parts.append(_HTML_WHITESPACE.sub(" ", str(el)))
        elif isinstance(el, Tag) and el.name == "br":
            parts.append("\n")
        elif isinstance(el, Tag) and el.name in {"p", "div"} and parts:
            parts.append("\n")
    lines = [line.lstrip(" ") for line in "".join(parts).split("\n")]
    return normalize_lyrics("\n".join(lines))


def normalize_lyrics(raw: str) -> str:
    lines: list[str] = []
    for line in raw.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = line.replace(" ", " ").rstrip()
        stripped = line.lstrip(" \t")
        if not stripped:
            lines.append("")
            continue
        indent = min(len(line) - len(stripped), 8)
        lines.append(" " * indent + _SPACES.sub(" ", stripped))
    text = _MANY_BLANK_LINES.sub("\n\n", "\n".join(lines))
    return text.strip("\n")


def clean_inline(text: str | None) -> str:
    """Texte d'une seule ligne : espaces normalisés."""
    return _SPACES.sub(" ", (text or "").replace("\n", " ")).strip()


def first_int(text: str | None) -> int | None:
    match = re.search(r"\d[\d\s .,]*", text or "")
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(0))
    return int(digits) if digits else None
