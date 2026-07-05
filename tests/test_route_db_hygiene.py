"""Guard: every web route handler that opens a DB session must close it in a
finally block (CLAUDE.md — "SQLAlchemy sessions must be explicitly closed in
route handlers — always use try/finally: db.close()"). A leaked session holds a
SQLite connection open and can starve the ingest subprocess of the write lock.

This is a static AST check: any function that itself calls `.get_db()` must also
contain a `try/finally` whose finally body calls `.close()`. It does not descend
into nested function defs, so an outer factory that merely *defines* handlers is
not falsely flagged for its inner handlers' sessions.
"""
from __future__ import annotations

import ast
from pathlib import Path

ROUTES_DIR = Path(__file__).resolve().parents[1] / "yuu_clip" / "web" / "routes"


def _own_nodes(func: ast.AST):
    """Yield nodes belonging to *func*, not descending into nested callables."""
    stack = list(getattr(func, "body", []))
    while stack:
        node = stack.pop()
        yield node
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                continue
            stack.append(child)


def _calls_attr(nodes, attr: str) -> bool:
    return any(
        isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == attr
        for n in nodes
    )


def _opens_session(func: ast.AST) -> bool:
    return _calls_attr(_own_nodes(func), "get_db")


def _closes_in_finally(func: ast.AST) -> bool:
    for node in _own_nodes(func):
        if isinstance(node, ast.Try) and node.finalbody:
            if any(_calls_attr(ast.walk(stmt), "close") for stmt in node.finalbody):
                return True
    return False


def test_every_route_that_opens_a_session_closes_it_in_finally():
    offenders = []
    for path in sorted(ROUTES_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for func in ast.walk(tree):
            if isinstance(func, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if _opens_session(func) and not _closes_in_finally(func):
                    offenders.append(f"{path.name}:{func.name}")
    assert offenders == [], f"route handlers open a DB session without try/finally close: {offenders}"
