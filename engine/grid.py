"""grid.py: compose Clone Dylan's identity from a grid of small cells.

WHY THIS FILE EXISTS
--------------------
Dylan's identity used to live in a few big files. Big files have one nice
property: you cannot accidentally load half of one. A grid of many small files
loses that property, and the failure is silent. Load 27 of 30 cells and you do
not get an error, you get a Clone Dylan who is subtly wrong, and nobody notices
until it has already said something Dylan would never say.

Every design choice below exists to convert that silent failure into a loud one.
The rule the whole file follows:

    A partial identity is worse than no identity.
    So: refuse to build, never build a partial.

READING ORDER FOR A BEGINNER
----------------------------
1. The roster constants (what facets are allowed to exist at all)
2. The Finding/Report types (how problems are reported)
3. The tiny YAML reader (why we did not just use JSON)
4. validate()      checks the grid
5. stamp()         records a fingerprint of every cell
6. check_hashes()  notices when a cell changed after stamping
7. compose()       builds the prompt, or raises
8. the emit_*()    functions, which are thin wrappers over compose()

Python 3 standard library only. No pip install, ever.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import secrets
import sys
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# v2 PATCH NOTE. This file is grid-engine/grid.py with the smallest change set
# that lets it validate grid v2. It is a COPY: /home/claude/out/grid-engine/
# was not touched. The changes are all roster and slot changes, never a
# loosening of a check:
#   1. "librarian" added to SPECIALISTS (16th facet).
#   2. ROLES added as a fourth axis kind, three facets.
#   3. VOICE.md permitted in core as well as registers, and added to the core floor.
#   4. resolve_facets / compose / emitters / CLI gained a role slot,
#      composed in the order core, specialist, mode, role, register.
# Every refusal the original made, this one still makes.

# v3 HARDENING NOTE (2026-08-21). Thirteen verified findings from mutation
# testing, plus one keystone. Every change below converts a silent success into
# a loud refusal; not one of them loosens a check. Summary:
#   1.  MARKER_INJECTION: cell text may not contain composer markers, and the
#       composer's markers now carry a per-composition random nonce.
#   2.  KIND_SCHEMA replaces the old partial FLOOR_REQUIRED. The floor is now
#       the complete per-kind cell set, and required also absorbs every
#       permitted cell file found on disk.
#   3.  HASH_MISSING is a BLOCK for required cells; stamped_cells is
#       cross-checked against the live hash count (STAMP_COUNT_MISMATCH).
#   4.  compose reads every required cell ONCE up front and iterates the
#       REQUIRED set, never the "happens to be present" set (TOCTOU).
#   5.  _normalise strips BOM and zero-width characters before any
#       substantive-text logic.
#   6.  scaffold refuses outright when a manifest already exists, and writes
#       nothing at all until every check has passed.
#   7.  --no-verify-hashes prints "integrity: UNVERIFIED" and lists drift.
#   8.  read_cell refuses symlinks and any path resolving outside the grid.
#   9.  Re-stamping over a DIFFERENT recorded hash requires --force and names
#       the cells being re-blessed.
#   10. Comment detection tracks <!-- and --> anywhere in a line.
#   11. An empty optional cell is skipped, noted, and not counted.
#   12. Undecodable cell bytes become a GridError naming facet/cell.
#   13. MAX_CELL_BYTES caps a cell; reads are cached per command invocation.
#   KEYSTONE: "integrity: complete" is COMPUTED from the per-kind schema and
#       compared against what was actually appended to the body.
#   CANON: DEFAULT_REGISTER is "vibe", not "surgery".

__all__ = [
    "GridError", "ManifestError", "UnknownFacetError", "MissingCellError",
    "CompositionError", "HashDriftError", "CellReadError", "CellDecodeError",
    "CellTooLargeError", "UnsafeCellPathError", "GridExistsError",
    "Finding", "Report", "Composition",
    "validate", "compose", "compose_detail", "stamp", "check_hashes",
    "emit_autohand_agents", "emit_claude_subagent", "emit_flat",
    "scaffold",
]

# ---------------------------------------------------------------------------
# 1. THE ROSTER
# ---------------------------------------------------------------------------
# These names are hard-coded on purpose. The manifest is a file on disk and a
# file on disk can be wrong, truncated, or half-written by a crashed tool. If
# the roster lived only in the manifest, deleting a facet from the manifest
# would make the grid "valid" again, which is exactly the silent failure we are
# trying to prevent. Code is the source of truth; the manifest must agree
# with it.

CORE_FACET = "core"

SPECIALISTS: Tuple[str, ...] = (
    "manager", "designer", "marketer", "engineer", "writer", "qa-skeptic",
    # v2, Dylan's ruling 2026-08-20. Vault maintenance had no facet in v1, so
    # the ingest workflow, page format, citation rules, lint and log.d
    # mechanics were split across core or dropped. librarian owns them.
    # It fills the SPECIALIST SLOT. It is NOT a seventh CDD council seat:
    # the council roster is still the six names above.
    "librarian",
)

MODES: Tuple[str, ...] = (
    "prototyper", "builder", "sweeper", "grower", "maintainer",
)

# v2, Dylan's ruling 2026-08-20: a fourth axis. The Adaptive Roles
# (clone-dylan skill section 6, wiki clone-dylan-protocol.md) are not
# registers, not specialists and not Looper modes. They govern how an answer
# is SHAPED for Dylan. v1 had no slot for them and lost Teacher Mode entirely.
ROLES: Tuple[str, ...] = ("teacher", "business-partner", "worker")

REGISTERS: Tuple[str, ...] = ("vibe", "surgery", "full-copy")

# v3, ratified by canon 2026-08-21: the identity's default register is Vibe.
# The engine defaulted to "surgery", which is a different Clone Dylan than the
# one the canon describes. The receipt has always disclosed the register, and
# still does, so this change is visible in every composition it touches.
DEFAULT_REGISTER = "vibe"

# The full set of facet directories that MUST exist. v2: 1 + 7 + 5 + 3 + 3 = 19.
ALL_FACETS: Tuple[str, ...] = (CORE_FACET,) + SPECIALISTS + MODES + ROLES + REGISTERS

FACET_KIND: Dict[str, str] = {}
FACET_KIND[CORE_FACET] = "core"
for _n in SPECIALISTS:
    FACET_KIND[_n] = "specialist"
for _n in MODES:
    FACET_KIND[_n] = "mode"
for _n in ROLES:
    FACET_KIND[_n] = "role"
for _n in REGISTERS:
    FACET_KIND[_n] = "register"

# Cell types, in the order they are always emitted. Never sorted, never
# reordered by caller input: determinism is a feature you can test.
CELL_ORDER: Tuple[str, ...] = ("DO.md", "DONT.md", "VOICE.md", "GATES.md", "CONTEXT.md")
CELL_TYPES = frozenset(CELL_ORDER)

# VOICE.md used to be a registers-only cell. v2, Dylan's ruling 2026-08-20:
# the Voice Card is promoted into core so it rides EVERY composition, because
# a Vibe session that drafted as Dylan never loaded it. So VOICE.md is now
# permitted in exactly two kinds, core and register, and nowhere else. Finding
# one in a specialist, mode or role facet still means somebody put voice rules
# where the composer will not look for them, which is a quiet way to lose them.
VOICE_CELLS = frozenset({"VOICE.md"})
VOICE_PERMITTED_KINDS = frozenset({"core", "register"})
REGISTERS_ONLY_CELLS = VOICE_CELLS  # kept: older callers import this name

# THE FLOOR, v3. The old floor was a SUBSET of what every facet of a kind
# actually carries: it let a manifest quietly drop every CONTEXT.md, drop
# GATES.md from modes, roles and registers, and drop DO.md from registers,
# and the grid still validated clean. A floor below the real shape of the data
# is not a floor, it is a trapdoor.
#
# KIND_SCHEMA is now the COMPLETE cell set for each kind, derived from what the
# 80-cell v2 grid actually contains: core and registers carry all five cells,
# specialists, modes and roles carry four (no VOICE.md, which is not permitted
# in those kinds at all). A missing schema cell is a BLOCK, always, and no
# manifest edit can remove one.
KIND_SCHEMA: Dict[str, frozenset] = {
    "core":       frozenset({"DO.md", "DONT.md", "VOICE.md", "GATES.md", "CONTEXT.md"}),
    "specialist": frozenset({"DO.md", "DONT.md", "GATES.md", "CONTEXT.md"}),
    "mode":       frozenset({"DO.md", "DONT.md", "GATES.md", "CONTEXT.md"}),
    "role":       frozenset({"DO.md", "DONT.md", "GATES.md", "CONTEXT.md"}),
    "register":   frozenset({"DO.md", "DONT.md", "VOICE.md", "GATES.md", "CONTEXT.md"}),
}

# Kept as an alias: older callers (and older tests) import FLOOR_REQUIRED. The
# floor and the schema are now the same object on purpose. If they ever drift
# apart again, the trapdoor comes back.
FLOOR_REQUIRED: Dict[str, frozenset] = KIND_SCHEMA

# Sequences a cell may never contain. compose() uses these to delimit blocks,
# so a cell that contains one can forge a facet block the receipt does not
# list: a reader (human or model) sees an authoritative-looking DO NOT block
# that no cell on disk authorises. Blocked at validate time, and made inert at
# compose time by the nonce below.
MARKER_SEQUENCES: Tuple[str, ...] = ("<!-- BEGIN", "<!-- END", "## FACET:")

# Characters that are invisible but non-empty. Without stripping them, a cell
# holding nothing but a BOM or a zero-width space reads as "has content" to
# every length check in this file. U+FEFF, U+200B, U+200C, U+200D, U+2060.
ZERO_WIDTH_CHARS = "﻿​‌‍⁠"
_ZERO_WIDTH_RE = re.compile("[" + ZERO_WIDTH_CHARS + "]")

# A cell is a page of identity text, not a payload. One megabyte is already
# absurd for a DONT.md; past that, something is being smuggled or a tool has
# gone wrong, and either way we stop rather than read it into a prompt.
MAX_CELL_BYTES = 1_000_000

# A required cell must carry at least this many "substantive" characters.
# A zero-byte DONT.md is not a DONT.md, it is a missing DONT.md wearing a
# filename. See _substantive_text() for what counts.
MIN_SUBSTANTIVE_CHARS = 12

MANIFEST_NAME = "manifest.yaml"
HASH_PREFIX = "sha256:"

# Finding codes that describe the grid as a whole rather than one facet.
# compose() treats these as fatal no matter which facets you asked for,
# because they mean the manifest itself cannot be trusted.
GLOBAL_CODES = frozenset({
    "MANIFEST_MISSING", "MANIFEST_UNPARSEABLE", "MANIFEST_SHAPE",
    "ROSTER_MISSING_FACET", "ROSTER_UNKNOWN_FACET", "ROSTER_STRAY_DIR",
    # v3: the stamp bookkeeping describes the manifest as a whole. If the
    # recorded cell count and the recorded hashes disagree, the manifest has
    # been edited by something that did not understand it, and no facet in it
    # can be trusted.
    "STAMP_COUNT_MISMATCH",
})


# ---------------------------------------------------------------------------
# 2. ERRORS AND FINDINGS
# ---------------------------------------------------------------------------

class GridError(Exception):
    """Base class. Catching this catches every refusal this module makes."""


class ManifestError(GridError):
    """The manifest is missing, unreadable, or not shaped like a manifest.

    Carries a `code` so callers can tell those three cases apart without
    matching on the text of the message. Matching on message text is how error
    handling quietly stops working the day somebody improves the wording.
    """

    def __init__(self, message: str, code: str = "MANIFEST_UNPARSEABLE"):
        super().__init__(message)
        self.code = code


class UnknownFacetError(GridError):
    """Somebody asked for a facet that is not on the roster, or in the wrong slot."""


class MissingCellError(GridError):
    """A required cell is absent or empty. This is the headline refusal."""


class HashDriftError(GridError):
    """A cell's content no longer matches the hash recorded in the manifest."""


class CompositionError(GridError):
    """Composition was refused for a reason that is not one of the above."""


class CellReadError(GridError):
    """A cell exists but cannot be safely turned into text.

    Carries `code`, `facet` and `cell` so validate() can turn it into a Finding
    without parsing the message, and so the CLI can name the offending file
    instead of dumping a traceback at the operator.
    """

    def __init__(self, message: str, code: str, facet: str = None, cell: str = None):
        super().__init__(message)
        self.code = code
        self.facet = facet
        self.cell = cell


class CellDecodeError(CellReadError):
    """The bytes on disk are not valid UTF-8. Finding code CELL_UNREADABLE."""

    def __init__(self, message: str, facet: str = None, cell: str = None):
        super().__init__(message, "CELL_UNREADABLE", facet, cell)


class CellTooLargeError(CellReadError):
    """The cell is larger than MAX_CELL_BYTES. Finding code CELL_TOO_LARGE."""

    def __init__(self, message: str, facet: str = None, cell: str = None):
        super().__init__(message, "CELL_TOO_LARGE", facet, cell)


class UnsafeCellPathError(CellReadError):
    """The cell is a symlink, or resolves outside the grid. Code SYMLINK_CELL."""

    def __init__(self, message: str, facet: str = None, cell: str = None):
        super().__init__(message, "SYMLINK_CELL", facet, cell)


@dataclass(frozen=True)
class Finding:
    """One problem, reported as data rather than printed text.

    Keeping findings as objects (instead of strings) is what lets validate()
    report ALL problems at once and lets compose() ask "is any of these fatal
    for the facets I am about to load?".
    """
    severity: str          # "BLOCK" or "WARN"
    code: str              # stable machine-readable code, see GLOBAL_CODES etc
    message: str           # human sentence
    facet: Optional[str] = None
    cell: Optional[str] = None

    @property
    def is_global(self) -> bool:
        return self.code in GLOBAL_CODES

    def __str__(self) -> str:
        where = self.facet or "-"
        if self.cell:
            where = where + "/" + self.cell
        return "[%s] %s %s: %s" % (self.severity, self.code, where, self.message)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity, "code": self.code, "message": self.message,
            "facet": self.facet, "cell": self.cell,
        }


@dataclass
class Report:
    """The structured result of validate()."""
    grid_dir: str
    findings: List[Finding] = field(default_factory=list)
    facets_seen: List[str] = field(default_factory=list)
    cells_seen: int = 0

    @property
    def blocks(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == "BLOCK"]

    @property
    def warnings(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == "WARN"]

    @property
    def ok(self) -> bool:
        """True only when there is not a single BLOCK. Warnings do not pass or fail."""
        return not self.blocks

    def blocks_for(self, facets: Iterable[str]) -> List[Finding]:
        """Fatal findings that matter when composing exactly `facets`.

        Global findings always count. Facet findings count only if that facet
        is one we are about to load. A broken 'marketer' facet must not stop
        the engineer from working, but a broken manifest must stop everybody.
        """
        wanted = set(facets)
        return [f for f in self.blocks if f.is_global or (f.facet in wanted)]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "grid_dir": self.grid_dir,
            "ok": self.ok,
            "facets_seen": list(self.facets_seen),
            "cells_seen": self.cells_seen,
            "block_count": len(self.blocks),
            "warn_count": len(self.warnings),
            "findings": [f.as_dict() for f in self.findings],
        }

    def text(self) -> str:
        if not self.findings:
            return "OK: %d facets, %d cells, no findings." % (len(self.facets_seen), self.cells_seen)
        lines = [str(f) for f in self.findings]
        lines.append("")
        lines.append("%d BLOCK, %d WARN across %d facets / %d cells."
                     % (len(self.blocks), len(self.warnings), len(self.facets_seen), self.cells_seen))
        return "\n".join(lines)


@dataclass
class Composition:
    """What compose_detail() returns: the prompt plus a receipt about it.

    The receipt is the audit trail. If you ever wonder "did this agent get the
    whole identity?", the receipt answers it without re-reading the grid.
    """
    text: str
    facets: List[str]
    cells: List[Tuple[str, str, str]]   # (facet, cell, hash)
    register: str
    specialist: Optional[str]
    mode: Optional[str]

    @property
    def cell_count(self) -> int:
        return len(self.cells)


# ---------------------------------------------------------------------------
# 3. A DELIBERATELY TINY, DELIBERATELY STRICT YAML READER
# ---------------------------------------------------------------------------
# The schema fixes the filename as manifest.yaml, and the standard library has
# no YAML parser. Rather than switch the file to JSON (which would change the
# schema I was told not to redesign), this reads a small, fixed subset of YAML:
#
#   key: value          mappings, nested by exactly 2 spaces per level
#   key:                a mapping or list follows, indented
#     - item            block lists of plain scalars
#   # comment           only when the whole line is a comment
#
# It supports nothing else. Not flow style, not anchors, not multi-line
# scalars, not inline comments, not tabs. And it RAISES on anything it does
# not recognise instead of skipping the line. A parser that skips what it does
# not understand is a machine for silently dropping half your manifest, which
# is the exact bug this whole project is about.

_INDENT_STEP = 2
_KEY_RE = re.compile(r"^([A-Za-z0-9_.\-]+):(?:\s+(.*))?$")


def _yaml_scalar(raw: str, lineno: int) -> Any:
    s = raw.strip()
    if s == "" or s in ("null", "~"):
        return None
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1]
    if " #" in s:
        raise ManifestError(
            "line %d: inline comments are not supported; quote the value or move the comment to its own line" % lineno)
    if s in ("true", "True"):
        return True
    if s in ("false", "False"):
        return False
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    return s


def _yaml_lines(text: str) -> List[Tuple[int, int, str]]:
    """Return (lineno, indent, content) for every meaningful line."""
    out: List[Tuple[int, int, str]] = []
    for i, raw in enumerate(text.replace("\r\n", "\n").replace("\r", "\n").split("\n"), start=1):
        if "\t" in raw:
            raise ManifestError("line %d: tab character; YAML indentation must be spaces" % i)
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        if indent % _INDENT_STEP != 0:
            raise ManifestError("line %d: indent of %d spaces; must be a multiple of %d"
                                % (i, indent, _INDENT_STEP))
        out.append((i, indent, stripped))
    return out


def parse_yaml(text: str) -> Dict[str, Any]:
    """Parse the manifest subset. Raises ManifestError on anything unexpected."""
    lines = _yaml_lines(text)
    value, idx = _parse_block(lines, 0, 0)
    if idx != len(lines):
        lineno = lines[idx][0]
        raise ManifestError("line %d: unexpected indentation, could not continue parsing" % lineno)
    if not isinstance(value, dict):
        raise ManifestError("top level of the manifest must be a mapping", "MANIFEST_SHAPE")
    return value


def _parse_block(lines, idx: int, indent: int):
    if idx >= len(lines):
        return None, idx
    if lines[idx][2].startswith("- "):
        return _parse_list(lines, idx, indent)
    return _parse_map(lines, idx, indent)


def _parse_list(lines, idx: int, indent: int):
    items: List[Any] = []
    while idx < len(lines):
        lineno, ind, content = lines[idx]
        if ind < indent:
            break
        if ind > indent:
            raise ManifestError("line %d: over-indented list item" % lineno)
        if not content.startswith("- "):
            break
        items.append(_yaml_scalar(content[2:], lineno))
        idx += 1
    return items, idx


def _parse_map(lines, idx: int, indent: int):
    out: Dict[str, Any] = {}
    while idx < len(lines):
        lineno, ind, content = lines[idx]
        if ind < indent:
            break
        if ind > indent:
            raise ManifestError("line %d: over-indented mapping key" % lineno)
        m = _KEY_RE.match(content)
        if not m:
            raise ManifestError("line %d: cannot parse %r as 'key: value'" % (lineno, content))
        key, inline = m.group(1), m.group(2)
        if key in out:
            # Duplicate keys in YAML silently overwrite. Silent overwrite is
            # how you lose a facet without noticing, so refuse instead.
            raise ManifestError("line %d: duplicate key %r" % (lineno, key))
        idx += 1
        if inline is not None and inline.strip() != "":
            out[key] = _yaml_scalar(inline, lineno)
            continue
        if idx < len(lines) and lines[idx][1] > ind:
            child, idx = _parse_block(lines, idx, lines[idx][1])
            out[key] = child
        else:
            out[key] = None
    return out, idx


def dump_yaml(data: Dict[str, Any], indent: int = 0) -> str:
    """Write the same subset back out. Deterministic: same input, same bytes."""
    pad = " " * indent
    chunks: List[str] = []
    for key, value in data.items():
        if isinstance(value, dict):
            if not value:
                chunks.append("%s%s: {}\n" % (pad, key))
            else:
                chunks.append("%s%s:\n" % (pad, key))
                chunks.append(dump_yaml(value, indent + _INDENT_STEP))
        elif isinstance(value, (list, tuple)):
            if not value:
                chunks.append("%s%s: []\n" % (pad, key))
            else:
                chunks.append("%s%s:\n" % (pad, key))
                for item in value:
                    chunks.append("%s%s- %s\n" % (pad, " " * _INDENT_STEP, _dump_scalar(item)))
        else:
            chunks.append("%s%s: %s\n" % (pad, key, _dump_scalar(value)))
    return "".join(chunks)


def _dump_scalar(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    s = str(v)
    if s == "" or s != s.strip() or " #" in s or ":" in s or s[0] in "-'\"[]{}#":
        return '"%s"' % s.replace('"', '\\"')
    return s


# ---------------------------------------------------------------------------
# 4. CELL READING AND HASHING
# ---------------------------------------------------------------------------

def _normalise(raw: bytes, facet: str = None, cell: str = None) -> str:
    """Turn file bytes into the canonical text we hash and compose.

    Line endings are normalised because Dylan works on Windows with WSL, and a
    file that round-trips through a Windows editor gains CRLF. Without this,
    every cell would look like it had drifted the moment he opened it, the
    drift alarm would cry wolf, and he would learn to ignore it. An alarm you
    ignore is worse than no alarm.

    v3, two changes:

    * Undecodable bytes raise CellDecodeError naming the facet and cell,
      instead of throwing a bare UnicodeDecodeError out of the bottom of the
      program. A traceback is not a refusal; the operator cannot tell whether
      the grid was rejected or the tool simply fell over.
    * BOM and zero-width characters are stripped BEFORE anything measures the
      text. A file containing only U+FEFF is an empty cell wearing a costume,
      and every length check downstream was believing the costume.
    """
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        where = "%s/%s" % (facet or "?", cell or "?")
        raise CellDecodeError(
            "cell %s is not valid UTF-8 (%s at byte %d); refusing to guess an encoding"
            % (where, exc.reason, exc.start), facet, cell)
    text = _ZERO_WIDTH_RE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.rstrip() + "\n" if text.strip() else ""


def _strip_comments(text: str) -> str:
    """Remove every HTML comment span, wherever it starts and ends.

    v3. The old scanner only entered comment mode when a line STARTED with
    "<!--", so `x <!--` left the scanner outside a comment and every commented
    line after it counted as content. A cell of pure commented-out filler
    passed the substantive-content check that way. This scans for the opener
    and the closer anywhere in the text, including mid-line, and treats an
    unterminated comment as running to the end of the file.
    """
    out: List[str] = []
    i = 0
    while True:
        start = text.find("<!--", i)
        if start < 0:
            out.append(text[i:])
            break
        out.append(text[i:start])
        end = text.find("-->", start + 4)
        if end < 0:
            break                      # unterminated: everything after is comment
        i = end + 3
    return "".join(out)


def _substantive_text(text: str) -> str:
    """The part of a cell that actually says something.

    Headings and HTML comments are scaffolding. A DONT.md containing only
    "# DON'T" and a TODO comment is a placeholder somebody meant to fill in
    later, and treating it as a loaded constraint is precisely how a grid
    produces a Clone Dylan with no brakes.
    """
    keep: List[str] = []
    for line in _strip_comments(text).split("\n"):
        s = line.strip()
        if not s or s.startswith("#") or set(s) <= set("-=*_ "):
            continue
        keep.append(s)
    return " ".join(keep)


def cell_path(grid_dir: Path, facet: str, cell: str) -> Path:
    return Path(grid_dir) / facet / cell


def contains_marker(text: Optional[str]) -> Optional[str]:
    """Return the first composer marker found in `text`, or None."""
    if not text:
        return None
    for marker in MARKER_SEQUENCES:
        if marker in text:
            return marker
    return None


# --- the per-invocation read cache ----------------------------------------
# v3, two findings in one mechanism.
#
# CELL SIZE (13) asked for cached reads so one command does not re-open the
# same file six times. TOCTOU (4) asked that a cell cannot change between the
# moment validate() approves it and the moment compose() writes it into the
# prompt. A cache scoped to one command invocation is the same answer to both:
# inside a scope, a cell is read exactly once, and every later question about
# it is answered from the copy that was approved.
#
# The scope is thread-local and re-entrant, so nesting (compose calls validate)
# shares one cache and the outermost caller owns its lifetime. Outside a scope
# there is no caching at all, which keeps library callers that poke at the
# filesystem between calls honest.

_cache_state = threading.local()


def _cache() -> Optional[Dict[Tuple[str, str, str], Any]]:
    return getattr(_cache_state, "store", None)


@contextlib.contextmanager
def cache_scope():
    """Read every cell at most once for the duration of this block."""
    if getattr(_cache_state, "store", None) is not None:
        yield                                    # already inside a scope
        return
    _cache_state.store = {}
    try:
        yield
    finally:
        _cache_state.store = None


def _resolved_within(grid_dir: Path, p: Path) -> bool:
    root = Path(grid_dir).resolve()
    try:
        target = p.resolve()
    except OSError:
        return False
    return target == root or root in target.parents


def _read_cell_uncached(grid_dir: Path, facet: str, cell: str) -> Optional[str]:
    p = cell_path(grid_dir, facet, cell)
    # v3 SYMLINKS. A symlinked cell let anything on the filesystem be composed
    # into the identity as if it were Dylan's own words, with a clean receipt
    # and a valid hash of whatever it pointed at. Both halves are needed: the
    # is_symlink() test catches a link that points back inside the grid, and
    # the resolve() test catches a symlinked FACET DIRECTORY carrying an
    # ordinary-looking file.
    if p.is_symlink():
        raise UnsafeCellPathError(
            "cell %s/%s is a symlink; cells must be real files inside the grid" % (facet, cell),
            facet, cell)
    if not p.is_file():
        return None
    if not _resolved_within(grid_dir, p):
        raise UnsafeCellPathError(
            "cell %s/%s resolves outside the grid directory" % (facet, cell), facet, cell)
    try:
        size = p.stat().st_size
    except OSError as exc:
        raise CellReadError("cannot stat cell %s/%s: %s" % (facet, cell, exc),
                            "CELL_UNREADABLE", facet, cell)
    if size > MAX_CELL_BYTES:
        raise CellTooLargeError(
            "cell %s/%s is %d bytes, over the %d byte cap" % (facet, cell, size, MAX_CELL_BYTES),
            facet, cell)
    return _normalise(p.read_bytes(), facet, cell)


def read_cell(grid_dir: Path, facet: str, cell: str) -> Optional[str]:
    """Return canonical cell text, or None if the file does not exist.

    Raises CellReadError (symlink, oversized, undecodable) rather than
    returning None for a file that exists but must not be loaded. None means
    "not there"; it never means "there but unusable".
    """
    store = _cache()
    if store is None:
        return _read_cell_uncached(grid_dir, facet, cell)
    key = (str(Path(grid_dir)), facet, cell)
    if key not in store:
        try:
            store[key] = _read_cell_uncached(grid_dir, facet, cell)
        except CellReadError as exc:
            store[key] = exc
    got = store[key]
    if isinstance(got, CellReadError):
        raise got
    return got


def hash_text(text: str) -> str:
    return HASH_PREFIX + hashlib.sha256(text.encode("utf-8")).hexdigest()


def hash_cell(grid_dir: Path, facet: str, cell: str) -> Optional[str]:
    text = read_cell(grid_dir, facet, cell)
    return None if text is None else hash_text(text)


def _is_loaded(text: Optional[str]) -> bool:
    """The single definition of 'this cell counts'. Used by validate AND compose
    so the two can never disagree about what 'present' means."""
    if text is None:
        return False
    return len(_substantive_text(text)) >= MIN_SUBSTANTIVE_CHARS


# ---------------------------------------------------------------------------
# 5. MANIFEST LOADING
# ---------------------------------------------------------------------------

def manifest_path(grid_dir: Path) -> Path:
    return Path(grid_dir) / MANIFEST_NAME


def load_manifest(grid_dir: Path) -> Dict[str, Any]:
    p = manifest_path(grid_dir)
    if not p.is_file():
        raise ManifestError("no %s in %s" % (MANIFEST_NAME, grid_dir), "MANIFEST_MISSING")
    try:
        data = parse_yaml(p.read_text(encoding="utf-8"))
    except ManifestError:
        raise
    except Exception as exc:
        raise ManifestError("could not read %s: %s" % (p, exc), "MANIFEST_UNPARSEABLE")
    if not isinstance(data.get("facets"), dict) or not data["facets"]:
        raise ManifestError("%s has no 'facets:' mapping" % p, "MANIFEST_SHAPE")
    return data


def _facet_entry(manifest: Dict[str, Any], facet: str) -> Dict[str, Any]:
    entry = manifest.get("facets", {}).get(facet)
    return entry if isinstance(entry, dict) else {}


def cell_permitted(kind: str, cell: str) -> bool:
    """Is this cell type allowed to exist in a facet of this kind at all?"""
    if cell not in CELL_TYPES:
        return False
    if cell in VOICE_CELLS and kind not in VOICE_PERMITTED_KINDS:
        return False
    return True


def _present_cells(grid_dir, facet: str, kind: str) -> List[str]:
    """Permitted cell files that actually exist in this facet's directory.

    v3. These are folded into the required set, so a cell on disk can never be
    "not mentioned by the manifest, therefore silently skipped". Wrong-type
    files (a VOICE.md in a specialist) are deliberately NOT folded in: they
    keep raising CELL_NOT_PERMITTED, because the answer to voice rules filed
    where the composer will not look is to move them, not to start loading
    them from the wrong place.
    """
    if grid_dir is None:
        return []
    fdir = Path(grid_dir) / facet
    try:
        if fdir.is_symlink() or not fdir.is_dir():
            return []
        names = [p.name for p in fdir.iterdir() if p.is_file() or p.is_symlink()]
    except OSError:
        return []
    return [c for c in CELL_ORDER if c in names and cell_permitted(kind, c)]


def _declared(entry: Dict[str, Any], key: str) -> List[str]:
    v = entry.get(key)
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x) for x in v]
    return [str(v)]


def required_cells(manifest: Dict[str, Any], facet: str, grid_dir=None) -> List[str]:
    """Required cells, v3:

        the COMPLETE per-kind schema
          UNION anything the manifest declares required
          UNION every permitted cell file present on disk

    Union, never intersection. Editing the manifest can make a facet stricter.
    It can never make it looser. That is the difference between a manifest and
    a loophole.

    The third term is what closes the "undeclared cell" hole from the other
    end: a cell sitting on disk is either loaded or the grid refuses. It is
    never quietly ignored. The one exception is a cell the manifest explicitly
    marks optional, which is a deliberate statement that the grid works with or
    without it, and which cannot touch the schema because marking a schema cell
    optional is MANIFEST_WEAKENS_FLOOR.
    """
    kind = FACET_KIND.get(facet, "")
    schema = KIND_SCHEMA.get(kind, frozenset())
    entry = _facet_entry(manifest, facet)
    declared = set(_declared(entry, "required"))
    optional = set(_declared(entry, "optional")) - schema - declared
    on_disk = set(_present_cells(grid_dir, facet, kind)) - optional
    combined = set(schema) | declared | on_disk
    return [c for c in CELL_ORDER if c in combined]


def optional_cells(manifest: Dict[str, Any], facet: str, grid_dir=None) -> List[str]:
    req = set(required_cells(manifest, facet, grid_dir))
    opt = set(_declared(_facet_entry(manifest, facet), "optional")) - req
    return [c for c in CELL_ORDER if c in opt]


# ---------------------------------------------------------------------------
# 6. VALIDATE
# ---------------------------------------------------------------------------

def validate(grid_dir) -> Report:
    """Check every facet against the manifest and the roster.

    Reports EVERY problem it finds, never stopping at the first. If you are
    going to make somebody fix a grid, tell them the whole list once.

    Missing required cell is always BLOCK, never WARN. There is no flag to
    downgrade it, because a flag to downgrade it would eventually get set.
    """
    with cache_scope():
        return _validate(grid_dir)


def _validate(grid_dir) -> Report:
    grid_dir = Path(grid_dir)
    report = Report(grid_dir=str(grid_dir))
    add = report.findings.append

    if not grid_dir.is_dir():
        add(Finding("BLOCK", "MANIFEST_MISSING",
                    "grid directory does not exist: %s" % grid_dir))
        return report

    try:
        manifest = load_manifest(grid_dir)
    except ManifestError as exc:
        add(Finding("BLOCK", getattr(exc, "code", "MANIFEST_UNPARSEABLE"), str(exc)))
        return report

    declared_facets = list(manifest.get("facets", {}).keys())
    report.facets_seen = [f for f in ALL_FACETS if f in declared_facets]

    # --- roster checks: the grid must be whole -----------------------------
    for facet in ALL_FACETS:
        if facet not in declared_facets:
            add(Finding("BLOCK", "ROSTER_MISSING_FACET",
                        "facet %r is on the roster but not declared in the manifest" % facet,
                        facet=facet))
    for facet in declared_facets:
        if facet not in FACET_KIND:
            add(Finding("BLOCK", "ROSTER_UNKNOWN_FACET",
                        "manifest declares facet %r which is not on the roster" % facet,
                        facet=facet))

    for child in sorted(p.name for p in grid_dir.iterdir() if p.is_dir()):
        if child.startswith(".") or child == "__pycache__":
            continue
        if child not in FACET_KIND:
            add(Finding("BLOCK", "ROSTER_STRAY_DIR",
                        "directory %r is not a known facet; a cell filed here would never be loaded" % child,
                        facet=child))

    # --- stamp bookkeeping, v3 ---------------------------------------------
    # HASH_MISSING used to be a WARN, so deleting a facet's whole hashes block
    # disarmed tamper evidence while every gate stayed green. Deleting the
    # count as well would have hidden even that, so the count is cross-checked
    # against the hashes that are actually there.
    live_hash_entries = 0
    for facet_name, fentry in (manifest.get("facets") or {}).items():
        if isinstance(fentry, dict) and isinstance(fentry.get("hashes"), dict):
            live_hash_entries += len(fentry["hashes"])
    declared_count = manifest.get("stamped_cells")
    if declared_count is None:
        if live_hash_entries:
            add(Finding("BLOCK", "STAMP_COUNT_MISMATCH",
                        "manifest records %d cell hashes but has no stamped_cells count; "
                        "re-stamp the grid" % live_hash_entries))
    elif not isinstance(declared_count, int) or declared_count != live_hash_entries:
        add(Finding("BLOCK", "STAMP_COUNT_MISMATCH",
                    "manifest says stamped_cells: %r but carries %d hash entries"
                    % (declared_count, live_hash_entries)))

    # --- per facet ---------------------------------------------------------
    for facet in ALL_FACETS:
        kind = FACET_KIND[facet]
        raw_entry = (manifest.get("facets") or {}).get(facet)
        if facet in declared_facets and raw_entry is not None and not isinstance(raw_entry, dict):
            add(Finding("BLOCK", "MANIFEST_SHAPE",
                        "facet %r is declared as %s, not a mapping" % (facet, type(raw_entry).__name__),
                        facet=facet))
        entry = _facet_entry(manifest, facet)
        if facet in declared_facets:
            stated_kind = entry.get("kind")
            if stated_kind is not None and stated_kind != kind:
                add(Finding("BLOCK", "FACET_KIND_MISMATCH",
                            "manifest says kind=%r but %r is a %s facet" % (stated_kind, facet, kind),
                            facet=facet))
            # Did the manifest try to make a floor cell merely optional?
            weakened = set(_declared(entry, "optional")) & FLOOR_REQUIRED.get(kind, frozenset())
            for cell in sorted(weakened):
                add(Finding("BLOCK", "MANIFEST_WEAKENS_FLOOR",
                            "manifest lists %s as optional for %r, but it is mandatory for every %s facet"
                            % (cell, facet, kind), facet=facet, cell=cell))

        fdir = grid_dir / facet
        if fdir.is_symlink() or (fdir.is_dir() and not _resolved_within(grid_dir, fdir)):
            add(Finding("BLOCK", "SYMLINK_CELL",
                        "facet directory %r is a symlink or resolves outside the grid; "
                        "its cells would compose content from somewhere else entirely" % facet,
                        facet=facet))
            continue
        if not fdir.is_dir():
            # Still report each required cell so the fix list is complete.
            for cell in required_cells(manifest, facet, grid_dir):
                add(Finding("BLOCK", "MISSING_REQUIRED_CELL",
                            "required cell is missing (no facet directory)", facet=facet, cell=cell))
            continue

        req = required_cells(manifest, facet, grid_dir)
        opt = optional_cells(manifest, facet, grid_dir)
        schema = KIND_SCHEMA.get(kind, frozenset())
        hashes = entry.get("hashes") if isinstance(entry.get("hashes"), dict) else {}

        def _safe_read(cell):
            """Read a cell, turning an unsafe/unreadable one into a Finding."""
            try:
                return read_cell(grid_dir, facet, cell), None
            except CellReadError as exc:
                return None, Finding("BLOCK", exc.code, str(exc), facet=facet, cell=cell)

        unreadable = set()
        for cell in req:
            text, bad = _safe_read(cell)
            if bad is not None:
                add(bad)
                unreadable.add(cell)
                continue
            if text is None:
                add(Finding("BLOCK", "MISSING_REQUIRED_CELL",
                            "required cell is missing from disk"
                            + (" (it is part of the %s schema)" % kind if cell in schema else ""),
                            facet=facet, cell=cell))
                continue
            report.cells_seen += 1
            if not _is_loaded(text):
                add(Finding("BLOCK", "EMPTY_REQUIRED_CELL",
                            "required cell exists but carries no substantive content "
                            "(needs at least %d characters that are not headings, rules or comments)"
                            % MIN_SUBSTANTIVE_CHARS, facet=facet, cell=cell))
            marker = contains_marker(text)
            if marker is not None:
                add(Finding("BLOCK", "MARKER_INJECTION",
                            "cell contains the composer marker %r; a cell that carries composer "
                            "markers can forge a facet block the receipt does not list" % marker,
                            facet=facet, cell=cell))

        for cell in opt:
            text, bad = _safe_read(cell)
            if bad is not None:
                add(bad)
                unreadable.add(cell)
                continue
            if text is None:
                continue
            report.cells_seen += 1
            if not _is_loaded(text):
                add(Finding("WARN", "EMPTY_OPTIONAL_CELL",
                            "optional cell carries no substantive content; compose() will skip it",
                            facet=facet, cell=cell))
            marker = contains_marker(text)
            if marker is not None:
                add(Finding("BLOCK", "MARKER_INJECTION",
                            "cell contains the composer marker %r; a cell that carries composer "
                            "markers can forge a facet block the receipt does not list" % marker,
                            facet=facet, cell=cell))

        # --- files on disk that the manifest never mentions -----------------
        allowed = set(req) | set(opt)
        for f in sorted(p.name for p in fdir.iterdir() if p.is_file() or p.is_symlink()):
            if f not in CELL_TYPES:
                add(Finding("WARN", "UNKNOWN_CELL_FILE",
                            "file %r is not one of the five cell types and will be ignored" % f,
                            facet=facet, cell=f))
            elif f not in allowed:
                add(Finding("BLOCK", "UNDECLARED_CELL",
                            "cell exists on disk but the manifest declares it neither required nor "
                            "optional, so compose() would silently skip it", facet=facet, cell=f))
            if f in VOICE_CELLS and kind not in VOICE_PERMITTED_KINDS:
                add(Finding("BLOCK", "CELL_NOT_PERMITTED",
                            "VOICE.md belongs to core and register facets only; voice rules placed "
                            "here would never be composed", facet=facet, cell=f))

        # --- hash bookkeeping ----------------------------------------------
        required_set = set(req)
        for cell in req + opt:
            if cell in unreadable:
                continue                      # already reported; do not hash it
            try:
                live = hash_cell(grid_dir, facet, cell)
            except CellReadError:
                continue
            recorded = hashes.get(cell)
            if live is None:
                if recorded:
                    add(Finding("WARN", "HASH_ORPHAN",
                                "manifest records a hash for a cell that no longer exists",
                                facet=facet, cell=cell))
                continue
            if not recorded:
                # v3: BLOCK, not WARN, for anything required. A required cell
                # with no recorded hash cannot drift, because there is nothing
                # to drift from: deleting the hashes block was a one-line way
                # to disarm tamper evidence with every gate still green.
                if cell in required_set:
                    add(Finding("BLOCK", "HASH_MISSING",
                                "required cell has no recorded hash, so drift in it could never be "
                                "detected; run stamp()", facet=facet, cell=cell))
                else:
                    add(Finding("WARN", "HASH_MISSING",
                                "no hash recorded; run stamp() so drift can be detected",
                                facet=facet, cell=cell))
            elif recorded != live:
                add(Finding("BLOCK", "HASH_DRIFT",
                            "cell content changed since it was stamped (recorded %s, live %s)"
                            % (str(recorded)[:19], live[:19]), facet=facet, cell=cell))

    return report


# ---------------------------------------------------------------------------
# 7. STAMP AND CHECK_HASHES
# ---------------------------------------------------------------------------

# Codes that stamping is allowed to fix, and therefore must not refuse over.
# Everything else is a real defect that stamping would merely sign.
_STAMPABLE_CODES = frozenset({
    "HASH_DRIFT", "HASH_MISSING", "HASH_ORPHAN", "STAMP_COUNT_MISMATCH",
})


def stamp(grid_dir, force: bool = False, out=None) -> Dict[str, str]:
    """Write a content hash for every cell into the manifest.

    Refuses to stamp a grid that has blocking problems stamping cannot fix.
    Stamping a broken grid would freeze the breakage into an official-looking
    fingerprint, which turns "this grid is broken" into "this grid is signed".

    v3, RE-STAMP LAUNDERING. Stamping over a hash that is present and DIFFERENT
    is not bookkeeping, it is re-blessing changed content: the exact move that
    turns an edited cell into an officially fingerprinted one with no trace
    that anything happened. That now requires force=True, and either way the
    cells being re-blessed are named. A cell that was never stamped is a
    different case and stamps freely: there is no prior blessing to launder.
    """
    with cache_scope():
        grid_dir = Path(grid_dir)
        out = sys.stdout if out is None else out
        report = validate(grid_dir)
        fatal = [f for f in report.blocks if f.code not in _STAMPABLE_CODES]
        if fatal and not force:
            raise CompositionError(
                "refusing to stamp a grid with %d blocking problem(s):\n%s"
                % (len(fatal), "\n".join(str(f) for f in fatal)))

        drifted = [f for f in report.blocks if f.code == "HASH_DRIFT"]
        if drifted:
            names = ["%s/%s" % (f.facet, f.cell) for f in drifted]
            if not force:
                raise HashDriftError(
                    "refusing to re-stamp %d cell(s) whose recorded hash differs from what is on "
                    "disk. Re-stamping would bless the change with no record that it happened. "
                    "Review the drift (grid.py check), then pass --force if the change is "
                    "intended:\n%s" % (len(names), "\n".join("  " + n for n in names)))
            out.write("re-blessing %d drifted cell(s) because --force was given:\n" % len(names))
            for n in names:
                out.write("  %s\n" % n)

        manifest = load_manifest(grid_dir)
        written: Dict[str, str] = {}
        for facet in ALL_FACETS:
            entry = manifest.setdefault("facets", {}).setdefault(facet, {})
            if not isinstance(entry, dict):
                entry = {}
                manifest["facets"][facet] = entry
            entry["kind"] = FACET_KIND[facet]
            hashes: Dict[str, str] = {}
            for cell in CELL_ORDER:
                try:
                    h = hash_cell(grid_dir, facet, cell)
                except CellReadError as exc:
                    raise CompositionError("refusing to stamp: %s" % exc)
                if h is not None:
                    hashes[cell] = h
                    written["%s/%s" % (facet, cell)] = h
            entry["hashes"] = hashes

        manifest["stamped_cells"] = len(written)
        manifest_path(grid_dir).write_text(_render_manifest(manifest), encoding="utf-8")
        return written


def _render_manifest(manifest: Dict[str, Any]) -> str:
    """Write the manifest back with a stable key order so diffs stay readable."""
    top_order = ["version", "grid", "stamped_cells", "facets"]
    ordered: Dict[str, Any] = {}
    for k in top_order:
        if k in manifest:
            ordered[k] = manifest[k]
    for k in manifest:
        if k not in ordered:
            ordered[k] = manifest[k]

    facets = ordered.get("facets", {})
    ordered_facets: Dict[str, Any] = {}
    for facet in ALL_FACETS:                      # roster order, not disk order
        if facet not in facets:
            continue
        entry = facets[facet] or {}
        e: Dict[str, Any] = {"kind": FACET_KIND[facet]}
        for key in ("required", "optional"):
            if entry.get(key):
                e[key] = [c for c in CELL_ORDER if c in set(entry[key])]
        h = entry.get("hashes") or {}
        e["hashes"] = {c: h[c] for c in CELL_ORDER if c in h}
        ordered_facets[facet] = e
    for facet in facets:                          # keep strays visible, not silently dropped
        if facet not in ordered_facets:
            ordered_facets[facet] = facets[facet]
    ordered["facets"] = ordered_facets

    header = (
        "# Clone Dylan identity grid manifest\n"
        "# Generated by grid.py stamp. See manifest.schema.md.\n"
        "# Hashes are sha256 of the cell text after CRLF and trailing-whitespace normalisation.\n"
    )
    return header + dump_yaml(ordered)


def check_hashes(grid_dir) -> List[Finding]:
    """Detect drift between manifest hashes and live cell content."""
    with cache_scope():
        grid_dir = Path(grid_dir)
        manifest = load_manifest(grid_dir)
        out: List[Finding] = []
        for facet in ALL_FACETS:
            entry = _facet_entry(manifest, facet)
            hashes = entry.get("hashes") if isinstance(entry.get("hashes"), dict) else {}
            required = set(required_cells(manifest, facet, grid_dir))
            for cell in CELL_ORDER:
                try:
                    live = hash_cell(grid_dir, facet, cell)
                except CellReadError as exc:
                    out.append(Finding("BLOCK", exc.code, str(exc), facet=facet, cell=cell))
                    continue
                recorded = hashes.get(cell)
                if live is None and recorded is None:
                    continue
                if live is None:
                    out.append(Finding("BLOCK", "HASH_ORPHAN",
                                       "stamped cell has been deleted", facet=facet, cell=cell))
                elif recorded is None:
                    # v3: unstamped REQUIRED cell is a BLOCK here too, so
                    # `check` and `validate` cannot disagree about whether a
                    # grid's tamper evidence is armed.
                    out.append(Finding("BLOCK" if cell in required else "WARN", "HASH_MISSING",
                                       "cell exists but was never stamped", facet=facet, cell=cell))
                elif recorded != live:
                    out.append(Finding("BLOCK", "HASH_DRIFT",
                                       "content changed since stamping (recorded %s, live %s)"
                                       % (str(recorded)[:19], live[:19]), facet=facet, cell=cell))
        return out


# ---------------------------------------------------------------------------
# 8. COMPOSE
# ---------------------------------------------------------------------------

def resolve_facets(specialist: Optional[str] = None,
                   mode: Optional[str] = None,
                   register: str = DEFAULT_REGISTER,
                   role: Optional[str] = None) -> List[str]:
    """Turn a request into the exact, ordered list of facets to load.

    Order is fixed: core, specialist, mode, role, register. Not alphabetical, not
    input order. Last word goes to the register because it governs how the
    output sounds, and reading order matters to a language model.

    Every name is checked against its own slot. 'prototyper' is a real facet
    but it is not a specialist, and accepting it in the specialist slot would
    load a mode where a specialist should be and produce a plausible, wrong
    identity. Wrong slot is rejected exactly as hard as a typo.
    """
    if register is None:
        register = DEFAULT_REGISTER
    facets = [CORE_FACET]
    if specialist is not None:
        if specialist not in SPECIALISTS:
            raise UnknownFacetError(
                "unknown specialist %r; expected one of: %s" % (specialist, ", ".join(SPECIALISTS)))
        facets.append(specialist)
    if mode is not None:
        if mode not in MODES:
            raise UnknownFacetError(
                "unknown looper mode %r; expected one of: %s" % (mode, ", ".join(MODES)))
        facets.append(mode)
    if role is not None:
        if role not in ROLES:
            raise UnknownFacetError(
                "unknown role %r; expected one of: %s" % (role, ", ".join(ROLES)))
        facets.append(role)
    if register not in REGISTERS:
        raise UnknownFacetError(
            "unknown register %r; expected one of: %s" % (register, ", ".join(REGISTERS)))
    facets.append(register)
    return facets


_CELL_TITLE = {
    "DO.md": "DO",
    "DONT.md": "DO NOT",
    "VOICE.md": "VOICE",
    "GATES.md": "GATES",
    "CONTEXT.md": "CONTEXT",
}


def _opens_with_heading(text: str) -> bool:
    for line in text.split("\n"):
        if line.strip():
            return line.lstrip().startswith("#")
    return False


def compose_detail(grid_dir,
                   specialist: Optional[str] = None,
                   mode: Optional[str] = None,
                   register: str = DEFAULT_REGISTER,
                   verify_hashes: bool = True,
                   role: Optional[str] = None) -> Composition:
    """Build the identity, or refuse. This is the function that must never lie.

    It raises rather than warns whenever a required cell is missing or empty,
    the manifest cannot be trusted, or (by default) a composed cell has drifted
    from its stamp. There is no "compose anyway" path. If you want one, you
    want a different tool.
    """
    with cache_scope():
        return _compose_detail(grid_dir, specialist, mode, register, verify_hashes, role)


def _new_nonce() -> str:
    """A fresh, unguessable tag for one composition's block markers.

    v3 FORGERY. The markers used to be literal and constant, so a cell whose
    text contained "<!-- BEGIN core/DONT.md ... -->" produced a block that
    looked exactly like a real one and appeared nowhere in the receipt: a
    forged DO NOT section, authorised by nobody. validate() now blocks such a
    cell outright, and this nonce is the second line of defence: markers are
    only markers if they carry the nonce, which is generated per composition
    and disclosed in the receipt, so literal markers smuggled into cell text
    are inert even when validation is skipped entirely.
    """
    return secrets.token_hex(8)


def _compose_detail(grid_dir,
                    specialist: Optional[str] = None,
                    mode: Optional[str] = None,
                    register: str = DEFAULT_REGISTER,
                    verify_hashes: bool = True,
                    role: Optional[str] = None) -> Composition:
    grid_dir = Path(grid_dir)
    facets = resolve_facets(specialist, mode, register, role)  # raises on bad names

    report = validate(grid_dir)
    relevant = report.blocks_for(facets)
    if verify_hashes is False:
        # --no-verify-hashes switches off hash checking, all of it: drift, the
        # missing-hash block and the stamp-count cross-check are one mechanism.
        # Switching off half of it would just move the confusion. What it can
        # never switch off is disclosure: the receipt says UNVERIFIED and names
        # every composed cell that does not match its recorded hash.
        relevant = [f for f in relevant
                    if f.code not in ("HASH_DRIFT", "HASH_MISSING", "STAMP_COUNT_MISMATCH")]

    if relevant:
        missing = [f for f in relevant if f.code in ("MISSING_REQUIRED_CELL", "EMPTY_REQUIRED_CELL")]
        drift = [f for f in relevant if f.code == "HASH_DRIFT"]
        detail = "\n".join("  " + str(f) for f in relevant)
        head = ("refusing to compose %s: %d blocking problem(s). "
                "A partial identity is worse than none.\n" % ("+".join(facets), len(relevant)))
        if missing and not drift:
            raise MissingCellError(head + detail)
        if drift and not missing:
            raise HashDriftError(head + detail)
        raise CompositionError(head + detail)

    manifest = load_manifest(grid_dir)
    nonce = _new_nonce()

    # --- v3 TOCTOU: read everything ONCE, up front -------------------------
    # The old loop built a `present` list by asking the filesystem which cells
    # existed, then looped over THAT. A required cell that vanished between
    # validate() and the loop simply dropped out of `present`, and the identity
    # composed without it under a receipt that said "integrity: complete".
    # Now every required cell is pulled into memory before a single line of
    # body is written, the loop walks the REQUIRED set rather than whatever
    # happens to be on disk, and a cell that disappears mid-flight is a
    # refusal instead of a silent omission.
    plan: List[Tuple[str, List[str], List[str]]] = []
    texts: Dict[Tuple[str, str], str] = {}
    skipped_empty_optional: List[str] = []

    for facet in facets:
        req = required_cells(manifest, facet, grid_dir)
        opt = optional_cells(manifest, facet, grid_dir)
        for cell in req:
            text = read_cell(grid_dir, facet, cell)     # raises on unsafe cells
            if text is None:
                raise MissingCellError(
                    "required cell %s/%s disappeared between validation and composition; "
                    "refusing to compose a partial identity" % (facet, cell))
            if not _is_loaded(text):
                raise MissingCellError("required cell %s/%s is empty at compose time" % (facet, cell))
            marker = contains_marker(text)
            if marker is not None:
                raise CompositionError(
                    "cell %s/%s contains the composer marker %r at compose time" % (facet, cell, marker))
            texts[(facet, cell)] = text
        keep_opt: List[str] = []
        for cell in opt:
            text = read_cell(grid_dir, facet, cell)
            if text is None:
                continue
            if not _is_loaded(text):
                # v3: an empty optional cell used to be emitted as an empty
                # labelled block and counted in cells_loaded, so the receipt
                # claimed content that was not there. Skip it, note it, and do
                # not count it.
                skipped_empty_optional.append("%s/%s" % (facet, cell))
                continue
            marker = contains_marker(text)
            if marker is not None:
                raise CompositionError(
                    "cell %s/%s contains the composer marker %r at compose time" % (facet, cell, marker))
            texts[(facet, cell)] = text
            keep_opt.append(cell)
        plan.append((facet, req, keep_opt))

    loaded: List[Tuple[str, str, str]] = []
    appended: List[Tuple[str, str]] = []
    body: List[str] = []

    for facet, req, keep_opt in plan:                      # fixed facet order
        kind = FACET_KIND[facet]
        emit = [c for c in CELL_ORDER if c in set(req) | set(keep_opt)]
        body.append("## FACET: %s (%s) %s" % (facet, kind, nonce))
        body.append("")
        for cell in emit:                                  # fixed cell order
            text = texts[(facet, cell)]
            h = hash_text(text)
            loaded.append((facet, cell, h))
            appended.append((facet, cell))
            # Explicit begin/end markers keep DO and DO NOT provably separate.
            # Nothing merges them, nothing reorders them, and a human can see
            # at a glance that the block arrived whole. The nonce is what makes
            # them unforgeable from inside a cell.
            body.append("<!-- BEGIN %s %s/%s %s -->" % (nonce, facet, cell, h))
            # Add a section label only when the cell does not already open with
            # its own heading. This is a choice about our wrapper, never an edit
            # to the cell: the cell text below is always byte-for-byte verbatim.
            if not _opens_with_heading(text):
                body.append("### %s: %s" % (_CELL_TITLE.get(cell, cell), facet))
                body.append("")
            body.append(text.rstrip())
            body.append("")
            body.append("<!-- END %s %s/%s -->" % (nonce, facet, cell))
            body.append("")

    # --- THE KEYSTONE ------------------------------------------------------
    complete = _integrity_verdict(manifest, grid_dir, facets, appended, loaded)

    drifted = _drifted_cells(manifest, loaded) if not verify_hashes else []
    header = _receipt(facets, loaded, specialist, mode, register, role,
                      nonce=nonce, complete=complete, verify_hashes=verify_hashes,
                      drifted=drifted, skipped=skipped_empty_optional)
    text = header + "\n" + "\n".join(body).rstrip() + "\n"

    # Receipt-vs-body correspondence, checked on the finished bytes: exactly one
    # opening marker per cell the receipt lists, and no others.
    marker_count = text.count("<!-- BEGIN %s " % nonce)
    if marker_count != len(loaded):
        raise CompositionError(
            "composed body carries %d block markers but the receipt lists %d cells"
            % (marker_count, len(loaded)))

    comp = Composition(text=text, facets=facets, cells=loaded,
                       register=register, specialist=specialist, mode=mode)
    setattr(comp, "role", role)
    setattr(comp, "nonce", nonce)
    setattr(comp, "skipped_empty_optional", list(skipped_empty_optional))
    return comp


def _integrity_verdict(manifest, grid_dir, facets, appended, loaded) -> bool:
    """Is the composed body actually complete? Computed, never asserted.

    THE KEYSTONE. "integrity: complete" used to be a string literal printed
    unconditionally, which meant the receipt's strongest claim was the one
    piece of it that was never checked. Every other fix in this file is worth
    less if this line can lie.

    The expected set is derived from the per-kind SCHEMA for each composed
    facet (plus whatever the manifest and the disk add on top), and compared
    against what was actually appended to the body. Any mismatch in either
    direction, missing or extra, is a refusal.
    """
    expected: List[Tuple[str, str]] = []
    for facet in facets:
        kind = FACET_KIND[facet]
        schema = KIND_SCHEMA.get(kind, frozenset())
        req = set(required_cells(manifest, facet, grid_dir))
        if not schema <= req:
            raise CompositionError(
                "internal error: required set for %r (%s) does not cover its schema: missing %s"
                % (facet, kind, ", ".join(sorted(schema - req))))
        for cell in CELL_ORDER:
            if cell in req:
                expected.append((facet, cell))

    appended_set = set(appended)
    expected_set = set(expected)
    missing = sorted(expected_set - appended_set)
    extra = sorted(appended_set - expected_set)
    optional_extra = []
    for facet, cell in extra:
        # An extra is legitimate only when it is a declared optional cell that
        # was present and substantive. Anything else is a block in the body
        # with no authority behind it.
        if cell in optional_cells(manifest, facet, grid_dir):
            optional_extra.append((facet, cell))
    rogue = [x for x in extra if x not in optional_extra]

    if missing or rogue:
        bits = []
        if missing:
            bits.append("missing from body: " + ", ".join("%s/%s" % m for m in missing))
        if rogue:
            bits.append("in body but not authorised: " + ", ".join("%s/%s" % r for r in rogue))
        raise CompositionError(
            "refusing to emit a receipt that would claim completeness it does not have. " +
            "; ".join(bits))

    if len(appended) != len(appended_set) or len(loaded) != len(appended):
        raise CompositionError(
            "composed body and receipt disagree: %d blocks appended, %d unique, %d on the receipt"
            % (len(appended), len(appended_set), len(loaded)))
    return True


def _drifted_cells(manifest, loaded) -> List[Tuple[str, str, str, str]]:
    """(facet, cell, recorded, live) for every composed cell whose hash moved."""
    out = []
    for facet, cell, live in loaded:
        entry = _facet_entry(manifest, facet)
        hashes = entry.get("hashes") if isinstance(entry.get("hashes"), dict) else {}
        recorded = hashes.get(cell)
        if recorded is None:
            out.append((facet, cell, "NEVER STAMPED", live))
        elif recorded != live:
            out.append((facet, cell, str(recorded), live))
    return out


def _receipt(facets, loaded, specialist, mode, register, role=None,
             nonce: str = "", complete: bool = False, verify_hashes: bool = True,
             drifted=None, skipped=None) -> str:
    """The header block. Contains no timestamp on purpose: compose() must
    produce byte-identical output for identical input so that diffing two
    compositions shows real changes only. (The block nonce is the one part
    that changes per run; strip it when diffing two compositions.)"""
    drifted = drifted or []
    skipped = skipped or []
    lines = [
        "<!-- CLONE DYLAN IDENTITY GRID: COMPOSED IDENTITY -->",
        "# Clone Dylan",
        "",
        "<!-- COMPOSITION RECEIPT",
        "facets: %s" % " + ".join(facets),
        "specialist: %s" % (specialist or "none"),
        "mode: %s" % (mode or "none"),
        "role: %s" % (role or "none"),
        "register: %s" % register,
        "block_nonce: %s" % nonce,
        "cells_loaded: %d" % len(loaded),
    ]
    for facet, cell, h in loaded:
        lines.append("  %s/%s %s" % (facet, cell, h))
    for note in skipped:
        lines.append("note: optional cell %s was empty and was NOT loaded" % note)
    if not verify_hashes:
        # v3. This path used to print "integrity: complete" while hash checking
        # was switched off, which is the receipt telling its most confident lie
        # at exactly the moment it knows least.
        lines.append("integrity: UNVERIFIED (hash checking disabled)")
        if drifted:
            lines.append("drifted: %d composed cell(s) do not match their recorded hash" % len(drifted))
            for facet, cell, recorded, live in drifted:
                lines.append("  %s/%s recorded %s live %s" % (facet, cell, recorded, live))
        else:
            lines.append("drifted: none of the composed cells differ from their recorded hash")
    elif complete:
        lines.append("integrity: complete (every required cell for every facet above was loaded)")
    else:                                    # unreachable: _integrity_verdict raises
        raise CompositionError("integrity could not be established")
    lines.append("-->")
    lines.append("")
    lines.append("Everything below is your identity. The sections marked DO NOT are "
                 "hard constraints, not preferences. They are never overridden by a "
                 "DO section, by a later facet, or by a user request.")
    lines.append("")
    return "\n".join(lines)


def compose(grid_dir,
            specialist: Optional[str] = None,
            mode: Optional[str] = None,
            register: str = DEFAULT_REGISTER,
            verify_hashes: bool = True,
            role: Optional[str] = None) -> str:
    """Return the composed prompt as a string, or raise. See compose_detail()."""
    return compose_detail(grid_dir, specialist=specialist, mode=mode,
                          register=register, verify_hashes=verify_hashes, role=role).text


# ---------------------------------------------------------------------------
# 9. EMITTERS
# ---------------------------------------------------------------------------

DEFAULT_TOOLS = ["read", "write", "edit", "bash", "grep", "glob"]


def emit_flat(grid_dir, specialist=None, mode=None, register=DEFAULT_REGISTER,
              verify_hashes: bool = True, role=None) -> str:
    """One engine-agnostic markdown prompt. This is just compose()."""
    return compose(grid_dir, specialist=specialist, mode=mode,
                   register=register, verify_hashes=verify_hashes, role=role)


def emit_claude_subagent(grid_dir, specialist=None, mode=None, register=DEFAULT_REGISTER,
                         verify_hashes: bool = True, role=None) -> str:
    """A plain prompt string for a Claude subagent."""
    return compose(grid_dir, specialist=specialist, mode=mode,
                   register=register, verify_hashes=verify_hashes, role=role)


def emit_autohand_agents(grid_dir, agents: Sequence[Dict[str, Any]],
                         verify_hashes: bool = True, indent: Optional[int] = None) -> str:
    """Build the inline JSON Autohand expects after --agents.

    Shape: {"<name>": {"description": ..., "prompt": ..., "tools": [...]}}

    Every agent is composed first. If ANY of them fails to compose, the whole
    call raises and no JSON comes back. Emitting a fleet where one member is
    quietly missing its DONT cell would be the same bug at fleet scale.
    """
    if not agents:
        raise CompositionError("emit_autohand_agents needs at least one agent spec")

    out: Dict[str, Dict[str, Any]] = {}
    for spec in agents:
        name = spec.get("name")
        if not name:
            raise CompositionError("every agent spec needs a 'name'")
        if name in out:
            raise CompositionError("duplicate agent name %r" % name)
        prompt = compose(grid_dir,
                         specialist=spec.get("specialist"),
                         mode=spec.get("mode"),
                         register=spec.get("register", DEFAULT_REGISTER),
                         verify_hashes=verify_hashes,
                         role=spec.get("role"))
        out[name] = {
            "description": spec.get("description") or _auto_description(spec),
            "prompt": prompt,
            "tools": list(spec.get("tools") or DEFAULT_TOOLS),
        }
    separators = (",", ":") if indent is None else (",", ": ")
    return json.dumps(out, indent=indent, separators=separators, ensure_ascii=False)


def _auto_description(spec: Dict[str, Any]) -> str:
    bits = [b for b in (spec.get("specialist"), spec.get("mode"), spec.get("role")) if b]
    role = " / ".join(bits) if bits else "core"
    return "Clone Dylan (%s) in %s register." % (role, spec.get("register", DEFAULT_REGISTER))


# ---------------------------------------------------------------------------
# 10. SCAFFOLD (used by the tests and by anyone starting a grid)
# ---------------------------------------------------------------------------

class GridExistsError(GridError):
    """scaffold() was pointed at a directory that already holds a grid."""


def scaffold(grid_dir, filler: str = "PLACEHOLDER: replace me with real content.") -> Path:
    """Create a complete, minimally valid grid. Handy for tests and for
    starting from a known-good shape rather than a known-broken one.

    v3 SCAFFOLD DESTRUCTION, ratified by Dylan 2026-08-21. The old order of
    operations was: write the manifest, THEN call stamp(), which validates and
    can refuse. Pointed at a real grid, it printed "GRID REFUSED" while having
    already overwritten the manifest with an empty-hash, floor-only version:
    every hash and every requirement in the vault's identity grid destroyed by
    the command that said it did nothing. The ruling is that scaffold REFUSES
    OUTRIGHT when a manifest already exists. There is no --force: a flag that
    overwrites an identity grid is a flag that will eventually be typed.

    Nothing at all is written until every check has passed, and the manifest is
    written exactly once, complete with hashes, so there is no window in which
    a half-built manifest exists on disk.
    """
    grid_dir = Path(grid_dir)

    # ---- checks first. No mkdir, no write, no touch, until these pass. ----
    mpath = manifest_path(grid_dir)
    if mpath.exists() or mpath.is_symlink():
        raise GridExistsError(
            "a grid already exists at %s (%s is present). Refusing to scaffold over it: "
            "scaffolding would replace its requirements and destroy every recorded hash. "
            "NOTHING WAS WRITTEN. Point scaffold at an empty directory, or move the existing "
            "grid aside yourself if you really mean to replace it." % (grid_dir, MANIFEST_NAME))
    if grid_dir.exists() and not grid_dir.is_dir():
        raise CompositionError("%s exists and is not a directory. Nothing was written." % grid_dir)

    planned: List[Tuple[Path, str]] = []
    facets_block: Dict[str, Any] = {}
    for facet in ALL_FACETS:
        kind = FACET_KIND[facet]
        req = [c for c in CELL_ORDER if c in KIND_SCHEMA[kind]]
        for cell in req:
            p = grid_dir / facet / cell
            if p.is_symlink():
                raise CompositionError(
                    "%s/%s is a symlink. Nothing was written." % (facet, cell))
            planned.append((p, "# %s: %s\n\n- %s\n" % (_CELL_TITLE[cell], facet, filler)))
        facets_block[facet] = {"kind": kind, "required": list(req), "hashes": {}}

    # ---- writes, only now -------------------------------------------------
    for facet in ALL_FACETS:
        (grid_dir / facet).mkdir(parents=True, exist_ok=True)
    for p, content in planned:
        if not p.exists():                    # never clobber existing cell text
            p.write_text(content, encoding="utf-8")

    # Hash in memory and write the manifest ONCE, already stamped. The old code
    # wrote an unstamped manifest and then called stamp() to fix it up, which
    # is what left a destroyed manifest behind when stamp() refused.
    with cache_scope():
        written = 0
        for facet in ALL_FACETS:
            hashes: Dict[str, str] = {}
            for cell in CELL_ORDER:
                h = hash_cell(grid_dir, facet, cell)
                if h is not None:
                    hashes[cell] = h
                    written += 1
            facets_block[facet]["hashes"] = hashes
        manifest = {"version": 1, "grid": "clone-dylan",
                    "stamped_cells": written, "facets": facets_block}
        mpath.write_text(_render_manifest(manifest), encoding="utf-8")

    report = validate(grid_dir)
    if not report.ok:
        raise CompositionError(
            "scaffold produced a grid that does not validate; this is a bug in scaffold():\n%s"
            % "\n".join(str(f) for f in report.blocks))
    return grid_dir


# ---------------------------------------------------------------------------
# 11. COMMAND LINE
# ---------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(prog="grid.py", description="Clone Dylan identity grid engine.")
    ap.add_argument("command", choices=["validate", "stamp", "check", "compose", "emit", "scaffold"])
    ap.add_argument("grid_dir")
    ap.add_argument("--specialist", default=None)
    ap.add_argument("--mode", default=None)
    ap.add_argument("--role", default=None)
    ap.add_argument("--register", default=DEFAULT_REGISTER)
    ap.add_argument("--target", default="flat", choices=["flat", "claude", "autohand"])
    ap.add_argument("--name", default="clone-dylan", help="agent name for the autohand target")
    ap.add_argument("--json", action="store_true", help="machine-readable output for validate/check")
    ap.add_argument("--no-verify-hashes", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="stamp even when the grid is blocking, and re-bless drifted cells. "
                         "Has no effect on scaffold, which never overwrites a grid.")
    args = ap.parse_args(argv)

    verify = not args.no_verify_hashes

    try:
      with cache_scope():                 # one command, one read of each cell
        if args.command == "scaffold":
            scaffold(args.grid_dir)
            print("scaffolded a complete grid at %s" % args.grid_dir)
            return 0

        if args.command == "validate":
            rep = validate(args.grid_dir)
            print(json.dumps(rep.as_dict(), indent=2) if args.json else rep.text())
            if any(f.code in ("CELL_UNREADABLE", "CELL_TOO_LARGE", "SYMLINK_CELL")
                   for f in rep.blocks):
                # These are refusals, not merely a report of a fixable grid:
                # the engine could not safely read what it was pointed at.
                return 2
            return 0 if rep.ok else 1

        if args.command == "check":
            findings = check_hashes(args.grid_dir)
            if args.json:
                print(json.dumps([f.as_dict() for f in findings], indent=2))
            else:
                print("\n".join(str(f) for f in findings) or "OK: no drift.")
            if any(f.code in ("CELL_UNREADABLE", "CELL_TOO_LARGE", "SYMLINK_CELL")
                   for f in findings):
                return 2
            return 1 if any(f.severity == "BLOCK" for f in findings) else 0

        if args.command == "stamp":
            written = stamp(args.grid_dir, force=args.force)
            print("stamped %d cells into %s" % (len(written), MANIFEST_NAME))
            return 0

        if args.command == "compose":
            print(compose(args.grid_dir, args.specialist, args.mode, args.register, verify, args.role), end="")
            return 0

        if args.command == "emit":
            if args.target == "autohand":
                spec = {"name": args.name, "specialist": args.specialist,
                        "mode": args.mode, "role": args.role, "register": args.register}
                print(emit_autohand_agents(args.grid_dir, [spec], verify_hashes=verify))
            elif args.target == "claude":
                print(emit_claude_subagent(args.grid_dir, args.specialist, args.mode,
                                           args.register, verify, args.role), end="")
            else:
                print(emit_flat(args.grid_dir, args.specialist, args.mode, args.register,
                                verify, args.role), end="")
            return 0
    except GridError as exc:
        sys.stderr.write("GRID REFUSED: %s\n" % exc)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
