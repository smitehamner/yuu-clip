"""Drift guard for the end-to-end use-case catalog and its derived checklist.

Structural, offline, exact-match scanners (unit tier) that keep
``docs/dev/USE_CASES.md`` and ``docs/dev/testing/installed-app-checklist.md`` in sync
as use cases are added or renumbered. This is the Stage-1/2 half of the plan's Stage-6
meta-test: it checks the catalog's shape and that the checklist references only real
UC IDs. The other half - asserting every ``automated``/``golden`` UC points at a real
``tests/system/`` node - lands with the Stage-3 system tier and its real test nodes.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CATALOG = REPO / "docs" / "dev" / "USE_CASES.md"
CHECKLIST = REPO / "docs" / "dev" / "testing" / "installed-app-checklist.md"

UC_HEADING = re.compile(r"^### (UC-[A-G]\d{2}) - ", re.MULTILINE)
UC_ID = re.compile(r"UC-[A-G]\d{2}")
AUTOMATION_TAGS = {"automated", "golden", "manual-only"}
PRIORITY_TAGS = {"P0", "P1", "P2"}


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
