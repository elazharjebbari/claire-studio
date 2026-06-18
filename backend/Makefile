# CLAIRE Studio backend — developer tasks.
PY ?= python
MANAGE = $(PY) manage.py

.PHONY: setup migrate makemigrations seed feed run test lint openapi check

setup:
	$(PY) -m pip install -r requirements.txt

makemigrations:
	$(MANAGE) makemigrations

migrate:
	$(MANAGE) migrate

seed:
	$(MANAGE) migrate
	$(MANAGE) seed_demo

feed:
	$(MANAGE) migrate
	$(MANAGE) feed_db

run:
	$(MANAGE) runserver 0.0.0.0:8000

test:
	pytest -q

lint:
	ruff check .

check:
	$(MANAGE) check

openapi:
	$(MANAGE) spectacular --file openapi.yaml
	@echo "OpenAPI schema written to openapi.yaml"

resync-translations:
	$(MANAGE) sync_translations
