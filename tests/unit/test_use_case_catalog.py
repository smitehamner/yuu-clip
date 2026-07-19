"""Drift guard for the end-to-end use-case catalog and its derived checklist.

Structural, offline, exact-match scanners (unit tier) that keep
``docs/dev/USE_CASES.md`` and ``docs/dev/testing/installed-app-checklist.md`` in sync
as use cases are added or renumbered. This is the plan's Stage-6 meta-test:

- the catalog's shape (unique/sequential IDs, valid Automation + priority tags),
- the checklist references only real UC IDs, and
- every ``automated``/``golden`` UC's Coverage line references at least one real
  pytest node id (asserted against an offline AST walk of the test tiers, so a
  renamed/deleted test node fails the build).
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "docs" / "dev" / "USE_CASES.md"
CHECKLIST = REPO / "docs" / "dev" / "testing" / "installed-app-checklist.md"
TEST_TIERS = ("tests/unit", "tests/integration", "tests/ui", "tests/system")

UC_HEADING = re.compile(r"^### (UC-[A-G]\d{2}) - ", re.MULTILINE)
UC_ID = re.compile(r"UC-[A-G]\d{2}")
# A pytest node id: tests/<path>.py::test_fn or tests/<path>.py::Class::method.
NODE_ID = re.compile(r"tests/[\w/]+\.py::[\w:]+")
AUTOMATION_TAGS = {"automated", "golden", "manual-only"}
AUTOMATED_TAGS = {"automated", "golden"}
PRIORITY_TAGS = {"P0", "P1", "P2"}


def _collect_test_node_ids() -> set[str]:
    """AST-walk the Python test tiers into a set of ``relpath::name`` node ids.

    Pure parse (no import, no collection), so it stays offline and cannot be
    tripped by a missing browser/model - it just reads what test functions and
    ``Test*`` methods exist. Parametrization suffixes are not included; the catalog
    cites base node ids only.
    """
    node_ids: set[str] = set()
    for tier in TEST_TIERS:
        for path in sorted((REPO / tier).rglob("test_*.py")):
            rel = path.relative_to(REPO).as_posix()
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in tree.body:
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test"):
                    node_ids.add(f"{rel}::{node.name}")
                elif isinstance(node, ast.ClassDef) and node.name.startswith("Test"):
                    for member in node.body:
                        if isinstance(member, (ast.FunctionDef, ast.AsyncFunctionDef)) and member.name.startswith("test"):
                            node_ids.add(f"{rel}::{node.name}::{member.name}")
    return node_ids


def _automation_tags(block: str) -> set[str]:
    match = re.search(r"\*\*Automation:\*\* ([a-z/ -]+)", block)
    return {tag.strip() for tag in match.group(1).split("/")} if match else set()


def _catalog_text() -> str:
    return CATALOG.read_text(encoding="utf-8")


def _uc_blocks() -> dict[str, str]:
    text = _catalog_text()
    matches = list(UC_HEADING.finditer(text))
    blocks: dict[str, str] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks[match.group(1)] = text[match.start() : end]
    return blocks


def test_catalog_has_use_cases():
    assert _uc_blocks(), "no UC entries parsed from the catalog - format drift?"


def test_use_case_ids_are_unique():
    ids = UC_HEADING.findall(_catalog_text())
    duplicates = sorted({uc for uc in ids if ids.count(uc) > 1})
    assert duplicates == [], f"duplicate UC IDs in the catalog: {duplicates}"


def test_use_case_ids_are_sequential_within_each_section():
    by_section: dict[str, list[int]] = {}
    for uc in UC_HEADING.findall(_catalog_text()):
        by_section.setdefault(uc[3], []).append(int(uc[4:]))
    wrong = {
        section: numbers
        for section, numbers in by_section.items()
        if numbers != list(range(1, len(numbers) + 1))
    }
    assert wrong == {}, f"sections must number 01..N with no gaps/reorders: {wrong}"


def test_every_use_case_has_valid_automation_and_priority():
    problems: list[str] = []
    for uc, block in _uc_blocks().items():
        automation = re.search(r"\*\*Automation:\*\* ([a-z/ -]+)", block)
        if automation is None:
            problems.append(f"{uc}: missing Automation line")
        else:
            tags = {tag.strip() for tag in automation.group(1).split("/")}
            unknown = tags - AUTOMATION_TAGS
            if unknown:
                problems.append(f"{uc}: unknown Automation tag(s) {unknown}")
        priority = re.search(r"\*\*Pre-release priority:\*\* (P\d)", block)
        if priority is None or priority.group(1) not in PRIORITY_TAGS:
            problems.append(f"{uc}: missing/invalid Pre-release priority")
    assert problems == [], f"catalog entry problems: {problems}"


def test_checklist_references_only_real_use_case_ids():
    catalog_ids = set(UC_HEADING.findall(_catalog_text()))
    checklist_ids = set(UC_ID.findall(CHECKLIST.read_text(encoding="utf-8")))
    dangling = sorted(checklist_ids - catalog_ids)
    assert dangling == [], f"checklist rows reference non-existent UC IDs: {dangling}"


def test_every_use_case_appears_in_the_checklist():
    catalog_ids = set(UC_HEADING.findall(_catalog_text()))
    checklist_ids = set(UC_ID.findall(CHECKLIST.read_text(encoding="utf-8")))
    missing = sorted(catalog_ids - checklist_ids)
    assert missing == [], f"use cases with no installed-app checklist row: {missing}"


def test_every_automated_use_case_references_a_real_test_node():
    """Each automated/golden UC's Coverage line must cite at least one pytest node
    id, and every cited node id must actually exist (offline AST walk)."""
    known_nodes = _collect_test_node_ids()
    problems: list[str] = []
    for uc, block in _uc_blocks().items():
        if not (_automation_tags(block) & AUTOMATED_TAGS):
            continue
        cited = set(NODE_ID.findall(block))
        if not cited:
            problems.append(f"{uc}: automated/golden but cites no pytest node id")
            continue
        dangling = sorted(node for node in cited if node not in known_nodes)
        if dangling:
            problems.append(f"{uc}: cites non-existent test node(s) {dangling}")
    assert problems == [], f"catalog coverage-node problems: {problems}"


def test_referenced_system_nodes_exist():
    """Every ``tests/system/`` node id the catalog references must exist - a rename
    of a Stage-3 system test must not silently orphan its catalog reference."""
    known_nodes = _collect_test_node_ids()
    referenced_system = {
        node for node in NODE_ID.findall(_catalog_text()) if node.startswith("tests/system/")
    }
    assert referenced_system, "the catalog should reference the Stage-3 system tests"
    dangling = sorted(node for node in referenced_system if node not in known_nodes)
    assert dangling == [], f"catalog references non-existent tests/system nodes: {dangling}"
