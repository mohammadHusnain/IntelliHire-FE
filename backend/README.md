# IntelliHire Backend

Django + Django REST Framework API for the IntelliHire recruitment platform. Phase 1 covers authentication, company management and approval, job posting and the application form, and candidate application management. Phase 2 (in progress, one module at a time) so far has the AI and notifications foundation (`Module5_Foundation`) and CV analysis and shortlisting (`Module6_CVAnalysis`). Project memory (requirements, architecture, schema, API contracts, decisions, open questions, progress) is in [`documentation/`](documentation).

## Requirements

Python 3.12 or newer (developed on 3.13), PostgreSQL 14 or newer (developed on 16).

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Linux/macOS: source .venv/bin/activate
pip install -r requirements/dev.txt
copy .env.example .env                # Linux/macOS: cp .env.example .env  — then edit the values
psql -U postgres -f scripts/create_dev_database.sql
python manage.py migrate
python manage.py createsuperuser      # creates the platform admin
python manage.py runserver
```

`.env` must define `SECRET_KEY`, `DATABASE_URL` and `FRONTEND_URL`; the app refuses to start without them. Never commit `.env`.

## Everyday commands

| Task | Command |
|---|---|
| Run the API | `python manage.py runserver` |
| Run all tests | `python -m pytest` |
| Check for missing migrations | `python manage.py makemigrations --check --dry-run` |
| Validate the OpenAPI schema | `python manage.py spectacular --validate --fail-on-warn --file schema.yml` |
| Deployment checks | `DJANGO_SETTINGS_MODULE=config.settings.production python manage.py check --deploy` |

Swagger UI: http://localhost:8000/api/docs/ (local settings only; controlled by `API_DOCS_ENABLED`).

## Layout

`config/` project settings and URLs · `apps/common` shared infrastructure · `apps/Module1_Authentication`, `apps/Module2_CompanyManagement`, `apps/Module3_JobPosting`, `apps/Module4_ApplicationManagement` (one folder per module, `Module<N>_<Name>`; Django labels `accounts`, `companies`, `jobs` and `applications`; each has its own `README.md`) · `documentation/` project memory · `requirements/` dependencies · `scripts/` helper scripts.
