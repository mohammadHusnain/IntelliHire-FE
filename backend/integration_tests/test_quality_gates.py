"""Whole-system gates: the schema, migrations, dependency direction and the Doc's test-case coverage."""
import ast
import re
from pathlib import Path

import pytest
from django.apps import apps as django_apps
from django.core.management import call_command
from django.db import connection

BACKEND = Path(__file__).resolve().parent.parent
APPS = BACKEND / "apps"
pytestmark = pytest.mark.django_db

MODULES = ["Module1_Authentication", "Module2_CompanyManagement", "Module3_JobPosting", "Module4_ApplicationManagement"]
# Phase 1 test cases from the Doc ("Automated tests mapped to your report")
DOC_TEST_CASES = [1, 2, 3, 4, 5, 6, 7, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22]


def test_django_system_checks_pass():
    call_command("check")


def test_there_are_no_model_changes_without_a_migration():
    call_command("makemigrations", "--check", "--dry-run")


def test_the_openapi_schema_is_valid_and_warning_free(tmp_path):
    call_command("spectacular", "--validate", "--fail-on-warn", "--file", str(tmp_path / "schema.yml"))


def test_every_model_has_its_table():
    tables = set(connection.introspection.table_names())
    missing = [m._meta.db_table for m in django_apps.get_models() if m._meta.managed and m._meta.db_table not in tables]
    assert missing == []
    for name in ("jobs_jobposting", "jobs_applicationfield", "applications_application", "applications_applicationfile", "applications_applicationstatuschange", "companies_company", "accounts_user"):
        assert name in tables


def _module_level_imports(path):
    tree = ast.parse(path.read_text())
    found = set()
    for node in tree.body:  # module level only: function-level imports are the documented exception
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            found.update(alias.name for alias in node.names)
    return found


@pytest.mark.parametrize("index", range(len(MODULES)))
def test_a_module_never_imports_a_higher_module_at_module_level(index):
    higher = MODULES[index + 1:]
    offenders = []
    for path in (APPS / MODULES[index]).rglob("*.py"):
        if "tests" in path.parts or "migrations" in path.parts:
            continue
        for imported in _module_level_imports(path):
            if any(imported.startswith(f"apps.{name}") for name in higher):
                offenders.append((str(path.relative_to(APPS)), imported))
    assert offenders == []


def test_common_never_imports_a_feature_module():
    offenders = []
    for path in (APPS / "common").rglob("*.py"):
        if "tests" in path.parts:
            continue
        offenders += [(path.name, i) for i in _module_level_imports(path) if re.match(r"apps\.Module\d", i)]
    assert offenders == []


def test_every_doc_test_case_has_a_named_automated_test():
    names = set()
    for path in list(APPS.rglob("test_*.py")) + list((BACKEND / "integration_tests").glob("test_*.py")):
        names.update(int(n) for n in re.findall(r"def test_tc(\d+)_", path.read_text()))
    assert [tc for tc in DOC_TEST_CASES if tc not in names] == []


def test_unknown_api_paths_answer_in_json_not_html(api_client):
    response = api_client.get("/api/does/not/exist/")
    assert response.status_code == 404 and response["Content-Type"].startswith("application/json")


def test_every_module_has_a_readme_and_its_tests():
    for name in MODULES:
        assert (APPS / name / "README.md").exists() and list((APPS / name / "tests").glob("test_*.py"))
