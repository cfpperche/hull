"""Every error the API raises names a key the catalog actually has.

This is the seam ADR-0016 opens up, and it fails silently in exactly one
direction. The server sends `message_key`; the browser looks it up and, finding
nothing, falls back to the English `detail`. So a typo does not throw, does not
log, and does not fail a test — it produces one English sentence in the middle
of an otherwise Portuguese screen, and only for the error path that nobody hits
in development.

The key list is generated from `packages/i18n` into `locales.json`, so this
compares the source of truth against every raise site rather than against a
second list somebody would have to maintain here.

Read by AST rather than by grep: two of these calls are wrapped across lines and
a regex missed both the first time this file was written.
"""

from __future__ import annotations

import ast
import json
import pathlib

import pytest

from hull_fastapi.locales import MANIFEST

SRC = pathlib.Path(__file__).resolve().parents[1] / "src" / "hull_fastapi"

RAISERS = {"AccountError", "StorageError"}


def _declared() -> set[str]:
    return set(json.loads(MANIFEST.read_text(encoding="utf-8"))["errorKeys"])


def _raised() -> list[tuple[str, int, str | None]]:
    """(file, line, key) for every error the adapter constructs.

    A key that is not a literal — a variable, an f-string — comes back as None
    and fails the test below. It is not that a computed key cannot work; it is
    that this check cannot see it, and a guard with a blind spot it does not
    announce is worse than no guard.
    """
    found: list[tuple[str, int, str | None]] = []
    for path in sorted(SRC.glob("*.py")):
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if not isinstance(node, ast.Call):
                continue
            if not isinstance(node.func, ast.Name) or node.func.id not in RAISERS:
                continue
            key = None
            if len(node.args) >= 3 and isinstance(node.args[2], ast.Constant):
                key = node.args[2].value
            for kw in node.keywords:
                if kw.arg == "key" and isinstance(kw.value, ast.Constant):
                    key = kw.value.value
            found.append((path.name, node.lineno, key))
    return found


def test_the_adapter_raises_errors_at_all() -> None:
    """If the AST walk stops finding raise sites — a rename, a refactor into a
    helper — every assertion below passes over an empty list and this file
    becomes decoration."""
    assert len(_raised()) >= 25


@pytest.mark.parametrize(("file", "line", "key"), _raised(), ids=lambda v: str(v))
def test_every_raised_key_is_a_literal_the_catalog_has(
    file: str, line: int, key: str | None
) -> None:
    assert key is not None, f"{file}:{line} builds its key instead of naming one"
    assert key in _declared(), (
        f"{file}:{line} names {key!r}, which is not in packages/i18n. "
        "Add it to src/catalogs/en.ts and pt-BR.ts, then run "
        "`pnpm --filter @hull/i18n build`."
    )


def test_no_declared_error_key_is_dead() -> None:
    """The other direction. A key nothing raises is a sentence two translators
    wrote and nobody will ever read, and it will sit there looking load-bearing.

    The five exceptions are raised by `problem()` directly rather than by an
    exception class, because they are not the caller's mistake — they are the
    edge, the router and the crash handler.
    """
    from_problem = {
        "error.notFound",
        "error.requestFailed",
        "error.server",
        "error.unauthenticated",
        # Minted in the client: the edge answers 429 as plain text, so
        # api-client builds this one itself.
        "error.rateLimited",
        "error.rateLimitedSoon",
    }
    raised = {key for _f, _l, key in _raised() if key}
    orphans = _declared() - raised - from_problem
    assert not orphans, f"nothing raises {sorted(orphans)}"
