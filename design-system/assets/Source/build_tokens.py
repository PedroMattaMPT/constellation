#!/usr/bin/env python3
"""Build every Constellation style file from constellation.tokens.json.

    python3 build_tokens.py [--out DIR] [--check]

Writes (into DIR, default ./build):
  constellation.css        CSS custom properties for the web app (dark, light, prefers-color-scheme)
  constellation_theme.py   Textual themes: dark, light, dark-256, light-256, ansi (16 colors) + glyph helpers
  constellation.tcss       Textual CSS for the shared widgets, written against the theme variables
  glyphs.ts                The glyph table for the React app
  tokens.json              The same tokens in the design-system page's format
  color-tables.md          Token tables (hex, xterm-256, ANSI) for the docs
  report.md                Contrast and 256-color checks; --check exits non-zero if any fail

Standard library only. The xterm-256 fallback is the nearest of indices 16-255 by CIEDE2000
(0-15 are the user's terminal palette, so they are never used as a 256-color fallback),
unless the palette entry pins one with "x256": {"dark": n, "light": n}.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# ----------------------------------------------------------------------------- color math

def hex2rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgb2hex(r: int, g: int, b: int) -> str:
    return "#%02x%02x%02x" % (r, g, b)


def _lin(c: int) -> float:
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(h: str) -> float:
    r, g, b = (_lin(c) for c in hex2rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def lab(h: str) -> tuple[float, float, float]:
    r, g, b = (_lin(c) for c in hex2rgb(h))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de2000(h1: str, h2: str) -> float:
    L1, a1, b1 = lab(h1)
    L2, a2, b2 = lab(h2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    else:
        dhp = h2p - h1p - 360 if h2p - h1p > 180 else h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hbp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbp = (h1p + h2p) / 2
    else:
        hbp = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp))
         + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63)))
    dth = 30 * math.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def xterm256() -> dict[int, str]:
    levels = [0, 95, 135, 175, 215, 255]
    pal = {16 + i: rgb2hex(levels[i // 36], levels[(i // 6) % 6], levels[i % 6]) for i in range(216)}
    pal.update({232 + i: rgb2hex(8 + 10 * i, 8 + 10 * i, 8 + 10 * i) for i in range(24)})
    return pal


X256 = xterm256()


def feed_hex(index: int) -> str:
    """The hex to hand Textual so that Rich's 8-bit downgrade emits exactly `index`.

    Cube colors map to themselves. Rich maps every low-saturation color to the gray ramp with
    round(lightness * 25), which is off by one for the light end of the ramp, so a gray index is fed
    the center of its bucket instead of its own palette value."""
    if 232 <= index <= 255:
        v = round((index - 231) / 25 * 255)
        return rgb2hex(v, v, v)
    return X256[index]


def reachable(index: int) -> bool:
    return rich_downgrade_256(feed_hex(index)) == index


def nearest256(h: str) -> int:
    return min((i for i in X256 if reachable(i)), key=lambda i: de2000(h, X256[i]))


def rich_downgrade_256(h: str) -> int:
    """Mirror of rich.color.Color.downgrade(EIGHT_BIT), to prove each fallback lands where we say."""
    import colorsys
    r, g, b = hex2rgb(h)
    _h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.15:
        gray = round(l * 25.0)
        return 16 if gray == 0 else 231 if gray == 25 else 231 + gray
    six = lambda c: c / 95 if c < 95 else 1 + (c - 95) / 40
    return 16 + 36 * round(six(r)) + 6 * round(six(g)) + round(six(b))


# ----------------------------------------------------------------------------- model

class Tokens:
    def __init__(self, src: dict):
        self.src = src
        self.themes = [t["id"] for t in src["themes"]]
        self.palette = src["palette"]
        self.tokens = src["tokens"]
        self.by_name = {t["name"]: t for t in self.tokens}
        self._cache: dict[tuple[str, str], int] = {}

    def palette_hex(self, ref: str, theme: str) -> str:
        return self.palette[ref][theme].lower()

    def hex(self, name: str, theme: str) -> str:
        if name in self.by_name:
            return self.palette_hex(self.by_name[name]["ref"], theme)
        return self.palette_hex(name, theme)

    def x256(self, name: str, theme: str) -> int:
        """xterm-256 fallback. A pin in the palette wins; otherwise the nearest reachable index that
        still meets the token's contrast need against the 256-color grounds (text 4.5, marks 3.0,
        text-on-fill 4.5 against its fill)."""
        key = (name, theme)
        if key in self._cache:
            return self._cache[key]
        ref = self.by_name[name]["ref"] if name in self.by_name else name
        pin = self.palette[ref].get("x256", {})
        target = self.palette_hex(ref, theme)
        if theme in pin:
            idx = int(pin[theme])
        else:
            t = self.by_name.get(name, {})
            role = t.get("role")
            grounds: list[str] = []
            need = 0.0
            if role == "text":
                need, grounds = 4.5, [X256[self.x256(g, theme)] for g in GROUNDS]
            elif role == "mark":
                need, grounds = 3.0, [X256[self.x256(g, theme)] for g in MARK_GROUNDS]
            elif role == "on":
                fill = next(f for f in self.tokens if f.get("on") == name)
                need, grounds = 4.5, [X256[self.x256(fill["name"], theme)]]
            # Within a group (Status, Modes, Messages …) different meanings must keep different indices.
            taken = set()
            if t and role in ("text", "mark", "fill"):
                for other in self.tokens:
                    if other is t:
                        break
                    if other["group"] == t["group"] and other["ref"] != t["ref"] and other.get("role") == role:
                        taken.add(self.x256(other["name"], theme))
            candidates = [i for i in X256 if reachable(i) and i not in taken
                          and all(contrast(X256[i], g) >= need for g in grounds)]
            idx = min(candidates or [i for i in X256 if reachable(i)], key=lambda i: de2000(target, X256[i]))
        self._cache[key] = idx
        return idx

    def hex256(self, name: str, theme: str) -> str:
        """What a 256-color terminal draws (xterm's default palette for that index)."""
        return X256[self.x256(name, theme)]

    def feed256(self, name: str, theme: str) -> str:
        """What the 256 theme hands Textual so Rich emits that index."""
        return feed_hex(self.x256(name, theme))

    def ansi(self, name: str) -> tuple[str, str]:
        t = self.by_name[name]
        return t.get("ansi", "default"), t.get("ansi_style", "")


def textual_ansi(color: str) -> str:
    return "ansi_default" if color == "default" else f"ansi_{color}"


# ----------------------------------------------------------------------------- outputs

def build_ds_tokens(T: Tokens) -> dict:
    """The design-system page format: a list per family, colors with themes; semantic tokens alias the palette."""
    colors = []
    for ref, v in T.palette.items():
        usage = v.get("note", "Palette entry; use the semantic tokens below, not this directly.")
        if "note" in v:
            usage += " Palette entry: components use the semantic tokens that alias it."
        colors.append({"name": ref, "value": {th: v[th].lower() for th in T.themes}, "usage": usage})
    for t in T.tokens:
        a, st = T.ansi(t["name"])
        fallback = (f" Fallbacks: 256 dark {T.x256(t['name'], 'dark')} / light {T.x256(t['name'], 'light')}; "
                    f"16 colors {a}{(' ' + st) if st else ''}.")
        colors.append({"name": t["name"], "value": "{" + t["ref"] + "}", "usage": t["usage"] + fallback})
    out = {
        "name": T.src["name"],
        "version": 1,
        "meta": {"source": "assets/Source/constellation.tokens.json (generated by build_tokens.py)"},
        "color": {"themes": [{"id": t["id"], "name": t["name"]} for t in T.src["themes"]], "tokens": colors},
        "type": T.src["type"],
        "spacing": {"note": T.src["spacing"]["note"],
                    "tokens": [{"name": s["name"], "value": s["value"], "usage": s["usage"] + f" TUI: {s['cells']}."} for s in T.src["spacing"]["tokens"]]},
        "radius": {"note": T.src["radius"]["note"], "tokens": T.src["radius"]["tokens"]},
        "shadow": {"note": T.src["shadow"]["note"], "tokens": T.src["shadow"]["tokens"]},
        "stroke": {"note": T.src["stroke"]["note"], "tokens": T.src["stroke"]["tokens"]},
    }
    return out


def css_escape_str(s: str) -> str:
    out = []
    for ch in s:
        if ord(ch) > 0x7e or ch in '"\\':
            out.append("\\%x " % ord(ch))
        else:
            out.append(ch)
    return '"' + "".join(out) + '"'


def build_css(T: Tokens) -> str:
    L = ["/* Constellation — generated from constellation.tokens.json by build_tokens.py. Do not edit. */", ""]
    for f in T.src["type"]["fonts"]:
        L += ["@font-face {", f'  font-family: "{f["family"]}";', f'  src: url("{f["file"]}") format("woff2");',
              f'  font-weight: {f["weight"]};', f'  font-style: {f.get("style", "normal")};', "  font-display: swap;", "}"]
    L.append("")

    def color_block(theme: str) -> list[str]:
        lines = []
        for ref in T.palette:
            lines.append(f"  --{ref}: {T.palette_hex(ref, theme)};")
        for t in T.tokens:
            lines.append(f"  --{t['name']}: var(--{t['ref']});")
        for s in T.src["shadow"]["tokens"]:
            v = s["value"][theme] if isinstance(s["value"], dict) else s["value"]
            lines.append(f"  --{s['name']}: {v};")
        lines.append(f"  color-scheme: {'dark' if theme == 'dark' else 'light'};")
        return lines

    L.append(':root, [data-theme="dark"] {')
    L += color_block("dark")
    L.append("}")
    L.append('[data-theme="light"] {')
    L += color_block("light")
    L.append("}")
    L.append("@media (prefers-color-scheme: light) {")
    L.append("  :root:not([data-theme]) {")
    L += ["  " + l for l in color_block("light")]
    L.append("  }")
    L.append("}")
    L.append("")
    L.append(":root {")
    L.append(f"  --font-mono: {T.src['type']['families']['mono']};")
    for fam in ("spacing", "radius", "stroke"):
        for s in T.src[fam]["tokens"]:
            L.append(f"  --{s['name']}: {s['value']};")
    for cat, items in T.src["glyphs"].items():
        if not isinstance(items, dict) or cat in ("meter",):
            continue
        for k, g in items.items():
            if isinstance(g, dict) and isinstance(g.get("unicode"), str):
                L.append(f"  --glyph-{cat}-{k.replace('_', '-')}: {css_escape_str(g['unicode'])};")
    L.append("}")
    L.append("")
    # Browser surfaces take the TUI's own choices, so both renderers scroll, select and type alike.
    o = TEXTUAL_OVERRIDES
    L.append(f":root {{ scrollbar-color: var(--{o['scrollbar']}) var(--{o['scrollbar-background']}); "
             f"caret-color: var(--{o['input-cursor-background']}); }}")
    L.append(f"::selection {{ background: var(--{o['screen-selection-background']}); "
             f"color: var(--{o['screen-selection-foreground']}); }}")
    L.append("")
    for g in T.src["type"]["groups"]:
        for s in g["styles"]:
            decl = [f"font-family: var(--font-mono)", f"font-size: {s['fontSize']}", f"line-height: {s['lineHeight']}",
                    f"font-weight: {s['fontWeight']}"]
            if "letterSpacing" in s:
                decl.append(f"letter-spacing: {s['letterSpacing']}")
            if s.get("fontStyle") == "italic":
                decl.append("font-style: italic")
            if s["name"] in ("text-dim", "text-label"):
                decl.append("color: var(--fg-muted)")
            if s["name"] == "text-link":
                decl.append("text-decoration: underline; text-underline-offset: 2px")
            L.append(f".{s['name']} {{ {'; '.join(decl)}; }}")
    L.append("")
    return "\n".join(L)


TEXTUAL_OVERRIDES = {
    # Textual's own design variables, pointed at Constellation tokens.
    "block-cursor-background": "selection",
    "block-cursor-foreground": "fg-strong",
    "block-cursor-blurred-background": "panel",
    "block-cursor-blurred-foreground": "fg",
    "border": "focus",
    "border-blurred": "line",
    "footer-background": "panel",
    "footer-foreground": "fg-muted",
    "footer-key-foreground": "focus",
    "footer-description-foreground": "fg-muted",
    "input-selection-background": "selection",
    "input-cursor-background": "focus",
    "input-cursor-foreground": "bg",
    "scrollbar": "line-strong",
    "scrollbar-hover": "line-control",
    "scrollbar-active": "focus",
    "scrollbar-background": "panel",
    "scrollbar-background-hover": "panel",
    "scrollbar-background-active": "panel",
    "scrollbar-corner-color": "panel",
    "link-color": "fg",
    "link-color-hover": "fg-strong",
    "link-background-hover": "selection",
    "screen-selection-background": "selection",
    "screen-selection-foreground": "fg-strong",
    "text-muted": "fg-muted",
    "text-disabled": "fg-faint",
}

TEXTUAL_STYLE_OVERRIDES = {
    "block-cursor-text-style": ("bold", "bold reverse"),
    "block-cursor-blurred-text-style": ("none", "none"),
    "input-cursor-text-style": ("none", "reverse"),
    "link-style": ("underline", "underline"),
    "link-style-hover": ("underline", "bold underline"),
    "button-focus-text-style": ("bold", "bold reverse"),
}


def theme_kwargs(T: Tokens, theme: str, depth: str) -> dict:
    pick = (lambda n: T.hex(n, theme)) if depth == "truecolor" else (lambda n: T.feed256(n, theme))
    variables: dict[str, str] = {}
    for t in T.tokens:
        variables[t["name"]] = pick(t["name"])
        variables[t["name"] + "-style"] = "none"
    for k, v in TEXTUAL_OVERRIDES.items():
        variables[k] = pick(v)
    for k, (tc, _ansi) in TEXTUAL_STYLE_OVERRIDES.items():
        variables[k] = tc
    return dict(primary=pick("focus"), secondary=pick("edge"), accent=pick("edge"), warning=pick("status-waiting"),
                error=pick("status-error"), success=pick("msg-answer"), foreground=pick("fg"), background=pick("bg"),
                surface=pick("surface"), panel=pick("panel"), dark=(theme == "dark"), variables=variables)


def ansi_kwargs(T: Tokens) -> dict:
    variables: dict[str, str] = {}
    for t in T.tokens:
        color, style = T.ansi(t["name"])
        variables[t["name"]] = textual_ansi(color)
        variables[t["name"] + "-style"] = style or "none"
    for k, v in TEXTUAL_OVERRIDES.items():
        variables[k] = variables[v]
    # Textual's own widget CSS reads these in :ansi blocks.
    variables["ansi-background"] = "ansi_default"
    variables["ansi-foreground"] = "ansi_default"
    variables["block-cursor-background"] = "ansi_default"
    variables["block-cursor-foreground"] = "ansi_default"
    variables["border"] = "ansi_default"
    variables["border-blurred"] = "ansi_default"
    for k, (_tc, ansi) in TEXTUAL_STYLE_OVERRIDES.items():
        variables[k] = ansi
    return dict(primary="ansi_blue", secondary="ansi_cyan", accent="ansi_cyan", warning="ansi_yellow", error="ansi_red",
                success="ansi_green", foreground="ansi_default", background="ansi_default", surface="ansi_default",
                panel="ansi_default", dark=True, ansi=True, variables=variables)


def py_literal(d: dict, indent: int = 8) -> str:
    pad = " " * indent
    items = []
    for k, v in d.items():
        items.append(f"{pad}{k!r}: {v!r},")
    return "\n".join(items)


def build_theme_py(T: Tokens) -> str:
    themes = {}
    for th in T.themes:
        themes[f"constellation-{th}"] = theme_kwargs(T, th, "truecolor")
        themes[f"constellation-{th}-256"] = theme_kwargs(T, th, "256")
    themes["constellation-ansi"] = ansi_kwargs(T)

    parts = ['"""Constellation themes for Textual — generated from constellation.tokens.json by build_tokens.py. Do not edit.',
             "",
             "    from constellation_theme import ConstellationApp, glyph, style",
             "",
             "    class Constellation(ConstellationApp):   # registers themes, picks dark/light, 256 or 16 colors",
             "        ...",
             "",
             "Color depth: CONSTELLATION_COLOR=truecolor|256|16 overrides detection (app.console.color_system).",
             "Glyph tier: CONSTELLATION_GLYPHS=unicode|ascii|nerd overrides detection (UTF-8 locale -> unicode).",
             '"""', "from __future__ import annotations", "", "import locale", "import os", "",
             "from textual.app import App", "from textual.theme import Theme", "", "THEMES: dict[str, Theme] = {"]
    for name, kw in themes.items():
        variables = kw.pop("variables")
        parts.append(f"    {name!r}: Theme(")
        parts.append(f"        name={name!r},")
        for k, v in kw.items():
            parts.append(f"        {k}={v!r},")
        parts.append("        variables={")
        parts.append(py_literal(variables, 12))
        parts.append("        },")
        parts.append("    ),")
    parts.append("}")
    parts.append("")
    glyphs = {k: v for k, v in T.src["glyphs"].items() if k != "note"}
    parts.append("GLYPHS: dict = " + json.dumps(glyphs, ensure_ascii=False, indent=4))
    parts.append("")
    ansi_styles = {t["name"]: t.get("ansi_style", "") for t in T.tokens if t.get("ansi_style")}
    fills = {t["name"]: t["on"] for t in T.tokens if t.get("on")}
    parts.append("# Text attributes the 16-color theme adds to a token (truecolor themes add none).")
    parts.append("ANSI_STYLES: dict[str, str] = " + json.dumps(ansi_styles, indent=4))
    parts.append("# Fill tokens and the token for text drawn on them.")
    parts.append("FILLS: dict[str, str] = " + json.dumps(fills, indent=4))
    parts.append('''

def register_themes(app: App) -> None:
    """Register every Constellation theme on the app."""
    for theme in THEMES.values():
        app.register_theme(theme)


def variable_defaults() -> dict[str, str]:
    """Defaults for Constellation's custom variables, so constellation.tcss parses under any theme.
    Return this from App.get_theme_variable_defaults()."""
    return dict(THEMES["constellation-dark"].variables)


class ConstellationApp(App):
    """Base app: registers the themes, picks the right one for the terminal, loads constellation.tcss.

    The theme is chosen in __init__ (not on_mount, which Textual also calls on every base class)."""

    CSS_PATH = "constellation.tcss"
    THEME_VARIANT = "dark"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        register_themes(self)
        apply_theme(self, self.THEME_VARIANT)

    def get_theme_variable_defaults(self) -> dict[str, str]:
        return {**super().get_theme_variable_defaults(), **variable_defaults()}


def color_depth(app: App) -> str:
    """'truecolor', '256' or '16' — from CONSTELLATION_COLOR, else what Rich detected for this terminal."""
    forced = os.environ.get("CONSTELLATION_COLOR", "").strip().lower()
    if forced in ("truecolor", "256", "16"):
        return forced
    system = app.console.color_system or "standard"
    return {"truecolor": "truecolor", "256": "256"}.get(system, "16")


def theme_name(variant: str = "dark", depth: str = "truecolor") -> str:
    if depth == "16":
        return "constellation-ansi"
    return f"constellation-{variant}" + ("-256" if depth == "256" else "")


def apply_theme(app: App, variant: str = "dark") -> str:
    """Pick and apply the theme for this terminal. Returns the theme name."""
    name = theme_name(variant, color_depth(app))
    app.theme = name
    return name


def glyph_tier() -> str:
    forced = os.environ.get("CONSTELLATION_GLYPHS", "").strip().lower()
    if forced in ("unicode", "ascii", "nerd"):
        return forced
    encoding = (locale.getpreferredencoding(False) or "").lower().replace("-", "")
    return "unicode" if "utf8" in encoding else "ascii"


def glyph(category: str, name: str, tier: str | None = None) -> str:
    """glyph('status', 'waiting') -> '?'; falls back nerd -> unicode -> ascii."""
    entry = GLYPHS[category][name]
    tier = tier or glyph_tier()
    if tier == "nerd" and "nerd" in entry:
        return entry["nerd"]
    if tier in ("unicode", "nerd"):
        return entry["unicode"]
    return entry["ascii"]


def label(category: str, name: str) -> str:
    return GLYPHS[category][name].get("label", name)


def style(app: App, token: str, extra: str = "") -> str:
    """Content-markup style for a token: style(app, 'fg-muted') -> '$fg-muted' (truecolor) or '$fg-muted dim' (16 colors).

    Fill tokens come back as '<on> on <fill>', e.g. style(app, 'status-waiting-fill')."""
    ansi = bool(getattr(app.current_theme, "ansi", False))
    parts = [extra] if extra else []
    if token in FILLS:
        parts += ["bold", f"${FILLS[token]} on ${token}"]
    else:
        parts.append(f"${token}")
        if ansi and token in ANSI_STYLES:
            parts.append(ANSI_STYLES[token])
    return " ".join(p for p in parts if p)


def resolve(app: App, markup: str) -> str:
    """Replace $token references with concrete colors, for Rich-only APIs (Tree labels, Rich Text).

    Textual content markup resolves $variables itself; Rich markup does not."""
    import re

    variables = app.get_css_variables()

    def sub(m: "re.Match[str]") -> str:
        value = variables.get(m.group(1), "default").split()[0]
        return value[5:] if value.startswith("ansi_") else value

    return re.sub(r"\\$([a-z][a-z0-9-]*)", sub, markup)


def chip(app: App, token: str, text: str) -> str:
    """A filled chip in content markup: chip(app, 'status-waiting-fill', '? needs you')."""
    return f"[{style(app, token)}] {text} [/]"
''')
    return "\n".join(parts) + "\n"


def build_glyphs_ts(T: Tokens) -> str:
    glyphs = {k: v for k, v in T.src["glyphs"].items() if k != "note"}
    return ("// Constellation glyphs — generated from constellation.tokens.json by build_tokens.py. Do not edit.\n"
            "export const GLYPHS = " + json.dumps(glyphs, ensure_ascii=False, indent=2) + " as const;\n"
            "export type GlyphTier = 'unicode' | 'ascii' | 'nerd';\n"
            "export function glyph(category: keyof typeof GLYPHS, name: string, tier: GlyphTier = 'unicode'): string {\n"
            "  const entry = (GLYPHS as any)[category]?.[name];\n"
            "  if (!entry) return '?';\n"
            "  if (tier === 'nerd' && entry.nerd) return entry.nerd;\n"
            "  return tier === 'ascii' ? entry.ascii : entry.unicode;\n"
            "}\n")


# ----------------------------------------------------------------------------- TCSS

STATE_CLASSES = {
    # css class -> token; generated so a widget can say  label.add_class("-working")
    "status": ["working", "waiting", "idle", "stale", "error", "stopped"],
    "mode": ["default", "plan", "edits", "auto", "bypass", "dontask"],
    "msg": ["prompt", "slash", "tool", "question", "answer", "denied", "sent", "received", "subagent", "reply"],
    "res": ["normal", "warning", "critical"],
    "kind": ["managed", "external"],
}


def build_tcss(T: Tokens) -> str:
    L = ["/* Constellation — Textual CSS generated from constellation.tokens.json by build_tokens.py. Do not edit.",
         "   Every color is a theme variable, so dark, light, 256-color and 16-color themes all reuse this file.",
         "   $<token>-style carries the text attribute the 16-color theme needs (dim, bold, reverse); truecolor sets it to none. */",
         "",
         "Screen { background: $bg; color: $fg; }",
         "",
         "/* ── Text helpers ───────────────────────────────────────────── */",
         ".fg-muted { color: $fg-muted; text-style: $fg-muted-style; }",
         ".fg-strong { color: $fg-strong; text-style: bold; }",
         ".fg-faint { color: $fg-faint; text-style: $fg-faint-style; }",
         ".summary { color: $fg-muted; text-style: italic; }",
         ".link { text-style: underline; }",
         "",
         "/* ── Status, mode, message, resource and kind colors (generated) ── */"]
    fills = {"waiting": ("status-waiting-fill", "on-status-waiting-fill"),
             "auto": ("mode-auto", "on-mode-auto"), "bypass": ("mode-bypass", "on-mode-bypass"),
             "critical": ("res-critical-fill", "on-res-critical-fill")}
    for cat, names in STATE_CLASSES.items():
        prefix = {"status": "status-", "mode": "mode-", "msg": "msg-", "res": "res-", "kind": "kind-"}[cat]
        for n in names:
            token = prefix + n
            if token not in T.by_name:
                # chips for auto/bypass: the text form uses the fill's palette entry
                token = {"mode-auto": "mode-edits", "mode-bypass": "status-error"}.get(token, token)
            L.append(f".{cat}-{n} {{ color: ${token}; text-style: ${token}-style; }}")
    L.append("")
    L.append("/* Filled chips: the only places color fills a cell. */")
    for n, (fill, on) in fills.items():
        L.append(f".chip-{n} {{ background: ${fill}; color: ${on}; text-style: bold; }}")
    L.append(".chip-brand { background: $fill-brand; color: $on-fill-brand; text-style: bold; }")
    L.append("")
    L += [
        "/* ── Layout ─────────────────────────────────────────────────── */",
        "#body { height: 1fr; }",
        "#tree {",
        "    width: 34; height: 1fr; background: $panel;",
        "    border-right: solid $line; padding: 0 0;",
        "    scrollbar-size-vertical: 1;",
        "}",
        "#tree:focus-within { border-right: heavy $focus; }",
        "#map { height: auto; max-height: 50%; background: $surface; padding: 0 1; }",
        "#panes { height: 1fr; layout: horizontal; }",
        "#status-bar { dock: bottom; height: 1; background: $panel; color: $fg-muted; }",
        "#status-bar .-current { background: $selection; color: $fg-strong; text-style: bold; }",
        "#status-bar .-prefix { background: $fill-brand; color: $on-fill-brand; text-style: bold; }",
        "",
        "/* ── Pane: one session. Title in the top border, status line in the bottom border. ── */",
        "SessionPane {",
        "    border: solid $line; border-title-align: left; border-subtitle-align: left;",
        "    border-title-color: $fg-muted; border-subtitle-color: $fg-muted;",
        "    background: $surface; padding: 0 1; width: 1fr; height: 1fr;",
        "}",
        "SessionPane:focus-within {",
        "    border: heavy $focus; border-title-color: $fg-strong; border-title-style: bold;",
        "    border-subtitle-color: $fg;",
        "}",
        "SessionPane.-external { border: dashed $kind-external; }",
        "SessionPane.-external:focus-within { border: dashed $focus; }",
        "SessionPane.-bypass { border-title-background: $mode-bypass; border-title-color: $on-mode-bypass; }",
        "SessionPane.-zoomed { border: double $focus; }",
        "SessionPane .conversation { height: 1fr; scrollbar-size-vertical: 1; }",
        "SessionPane .turn-prompt { color: $msg-prompt; text-style: bold; }",
        "SessionPane .turn-tool { color: $fg-muted; text-style: $fg-muted-style; }",
        "SessionPane .turn-reply { color: $fg; }",
        "",
        "/* Prompt box: a hairline above, the › marker, grows to 6 lines. */",
        "PromptBox {",
        "    height: auto; max-height: 8; min-height: 1;",
        "    border-top: solid $line; background: $panel; padding: 0 1;",
        "}",
        "PromptBox:focus-within { border-top: solid $line-control; }",
        "PromptBox.-broadcast { border-top: heavy $edge; }",
        "PromptBox.-disabled { color: $fg-faint; text-style: italic; }",
        "",
        "/* ── Session row on the map and in the status bar ─────────────── */",
        "SessionRow { height: 2; padding: 0 1; }",
        "SessionRow.-compact { height: 1; }",
        "SessionRow.-selected { background: $selection; }",
        "SessionRow:focus { background: $selection; text-style: bold; }",
        "SessionRow.-waiting { border-left: outer $status-waiting-fill; }",
        "SessionRow.-stale { border-left: outer $status-stale; }",
        "SessionRow.-external { text-style: italic; }",
        "",
        "/* ── Tree ─────────────────────────────────────────────────────── */",
        "MessageTree { background: $panel; }",
        "MessageTree > .tree--guides { color: $fg-faint; }",
        "MessageTree > .tree--guides-hover { color: $line-control; }",
        "MessageTree > .tree--guides-selected { color: $focus; }",
        "MessageTree > .tree--cursor { background: $selection; color: $fg-strong; text-style: $block-cursor-text-style; }",
        "MessageTree > .tree--highlight-line { background: $hover; }",
        "",
        "/* ── Floating things: command menu, pickers, cards, dialogs (round border) ── */",
        "CommandMenu, Picker {",
        "    background: $raised; border: round $line-strong; padding: 0 0;",
        "    width: 100%; max-width: 72; max-height: 14;",
        "}",
        "CommandMenu > .option-list--option-highlighted, Picker > .option-list--option-highlighted {",
        "    background: $selection; color: $fg-strong; text-style: bold;",
        "}",
        "QuestionCard {",
        "    background: $raised; border: round $status-waiting-fill; padding: 0 1; height: auto;",
        "    border-title-color: $on-status-waiting-fill; border-title-background: $status-waiting-fill; border-title-style: bold;",
        "}",
        "QuestionCard.-answered { border: round $line-strong; border-title-background: $raised; border-title-color: $msg-answer; }",
        "PermissionCard {",
        "    background: $raised; border: round $status-waiting-fill; padding: 0 1; height: auto;",
        "    border-title-color: $on-status-waiting-fill; border-title-background: $status-waiting-fill; border-title-style: bold;",
        "}",
        "PermissionCard .diff-add { color: $msg-answer; }",
        "PermissionCard .diff-del { color: $msg-denied; }",
        "PermissionCard.-bypass-risk { border: round $mode-bypass; }",
        "Option { height: 1; padding: 0 1; }",
        "Option.-highlighted { background: $selection; color: $fg-strong; text-style: bold; }",
        "Option.-chosen { color: $fg-strong; text-style: bold; }",
        "Option.-disabled { color: $fg-faint; text-style: $fg-faint-style; }",
        "",
        "/* ── Meters ───────────────────────────────────────────────────── */",
        "ContextBar { width: 16; height: 1; color: $res-normal; background: $panel; }",
        "ContextBar.-warning { color: $res-warning; }",
        "ContextBar.-critical { color: $res-critical; text-style: $res-critical-style; }",
        "Sparkline { height: 1; }",
        "Sparkline > .sparkline--min-color { color: $res-normal; }",
        "Sparkline > .sparkline--max-color { color: $res-normal; }",
        "Sparkline.-warning > .sparkline--max-color { color: $res-warning; }",
        "Sparkline.-critical > .sparkline--max-color { color: $res-critical; }",
        "",
        "/* ── Dialogs ──────────────────────────────────────────────────── */",
        "ModalScreen { background: $bg 60%; }",
        "Launcher, BroadcastDialog, ConfirmStop {",
        "    background: $raised; border: round $line-strong; padding: 1 2; width: 72; height: auto;",
        "    border-title-color: $fg-strong; border-title-style: bold;",
        "}",
        "BroadcastDialog { border: round $edge; }",
        "ConfirmStop { border: round $status-error; }",
        "Input { border: tall $line-control; background: $surface; }",
        "Input:focus { border: tall $focus; }",
        "Button { min-width: 10; height: 1; border: none; background: $panel; color: $fg; }",
        "Button:focus { background: $fill-brand; color: $on-fill-brand; text-style: bold; }",
        "Button.-danger { color: $status-error; }",
        "Button.-danger:focus { background: $mode-bypass; color: $on-mode-bypass; }",
        "",
        "/* ── Key hints ────────────────────────────────────────────────── */",
        ".key { color: $focus; text-style: bold; }",
        ".key-label { color: $fg-muted; text-style: $fg-muted-style; }",
        "",
    ]
    return "\n".join(L)


# ----------------------------------------------------------------------------- docs + checks

GROUNDS = ["bg", "surface", "panel", "raised", "selection"]
MARK_GROUNDS = ["bg", "surface", "panel", "raised"]


def checks(T: Tokens) -> tuple[list[str], list[str]]:
    rows, failures = [], []
    for depth in ("truecolor", "256"):
        for th in T.themes:
            val = (lambda n: T.hex(n, th)) if depth == "truecolor" else (lambda n: T.hex256(n, th))
            for t in T.tokens:
                role = t.get("role")
                if role == "text":
                    need, grounds = 4.5, GROUNDS
                elif role == "mark":
                    need, grounds = 3.0, MARK_GROUNDS
                elif role == "fill":
                    need, grounds = 4.5, None
                else:
                    continue
                if grounds is None:
                    c = contrast(val(t["on"]), val(t["name"]))
                    ok = c >= need
                    rows.append(f"| {depth} | {th} | `{t['on']}` on `{t['name']}` | {c:.2f} | {need} | {'pass' if ok else 'FAIL'} |")
                    if not ok:
                        failures.append(f"{depth} {th}: {t['on']} on {t['name']} = {c:.2f}")
                    continue
                worst = min(grounds, key=lambda g: contrast(val(t["name"]), val(g)))
                c = contrast(val(t["name"]), val(worst))
                ok = c >= need
                rows.append(f"| {depth} | {th} | `{t['name']}` (worst on `{worst}`) | {c:.2f} | {need} | {'pass' if ok else 'FAIL'} |")
                if not ok:
                    failures.append(f"{depth} {th}: {t['name']} on {worst} = {c:.2f}")
    # 256: Rich must land on the index we promise, and the surfaces must stay distinct
    for th in T.themes:
        for t in T.tokens:
            want = T.x256(t["name"], th)
            got = rich_downgrade_256(T.feed256(t["name"], th))
            if got != want:
                failures.append(f"256 {th}: {t['name']} index {want} would be drawn as {got} by Rich")
        seen: dict[tuple[str, str, int], str] = {}
        for t in T.tokens:
            if t.get("role") not in ("text", "mark", "fill"):
                continue
            k = (t["group"], t.get("role", ""), T.x256(t["name"], th))
            if k in seen and T.by_name[seen[k]]["ref"] != t["ref"]:
                failures.append(f"256 {th}: {seen[k]} and {t['name']} share index {k[2]} in {t['group']}")
            seen.setdefault(k, t["name"])
        surf = [T.x256(n, th) for n in ("bg", "surface", "panel")]
        if len(set(surf)) < 3:
            failures.append(f"256 {th}: bg/surface/panel collapse to {surf}")
    return rows, failures


def color_tables(T: Tokens) -> str:
    out = []
    groups: dict[str, list[dict]] = {}
    for t in T.tokens:
        groups.setdefault(t["group"], []).append(t)
    for g, toks in groups.items():
        out.append(f"### {g}\n")
        out.append("| Token | Dark | 256 | Light | 256 | 16 colors | Use |")
        out.append("|---|---|---|---|---|---|---|")
        for t in toks:
            a, st = T.ansi(t["name"])
            ansi = f"`{a}`" + (f" {st}" if st else "")
            out.append(f"| `{t['name']}` | `{T.hex(t['name'], 'dark')}` | {T.x256(t['name'], 'dark')} | "
                       f"`{T.hex(t['name'], 'light')}` | {T.x256(t['name'], 'light')} | {ansi} | {t['usage']} |")
        out.append("")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", default=str(HERE / "constellation.tokens.json"))
    ap.add_argument("--out", default=str(HERE / "build"))
    ap.add_argument("--check", action="store_true", help="exit 1 if a contrast or 256-color check fails")
    args = ap.parse_args(argv)

    T = Tokens(json.loads(Path(args.src).read_text(encoding="utf-8")))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "constellation.css").write_text(build_css(T), encoding="utf-8")
    (out / "constellation_theme.py").write_text(build_theme_py(T), encoding="utf-8")
    (out / "constellation.tcss").write_text(build_tcss(T), encoding="utf-8")
    (out / "glyphs.ts").write_text(build_glyphs_ts(T), encoding="utf-8")
    (out / "tokens.json").write_text(json.dumps(build_ds_tokens(T), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / "color-tables.md").write_text(color_tables(T), encoding="utf-8")
    rows, failures = checks(T)
    report = ["# Constellation — color checks", "", "WCAG 2 contrast for every text (4.5:1), mark (3:1) and fill/on pair (4.5:1), "
              "for truecolor and the xterm-256 fallback, in both themes. Text is checked against bg, surface, panel, raised "
              "and selection; marks against bg, surface, panel and raised. The worst ground is shown.", "",
              "| Depth | Theme | Pair | Ratio | Needs | Result |", "|---|---|---|---|---|---|", *rows, ""]
    report.append("## Failures\n")
    report.append("\n".join(f"- {f}" for f in failures) if failures else "None.")
    (out / "report.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"wrote 7 files to {out}; {len(failures)} check failures")
    for f in failures:
        print("  FAIL", f)
    return 1 if (failures and args.check) else 0


if __name__ == "__main__":
    sys.exit(main())
