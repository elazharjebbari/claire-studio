# =============================================================================
# CLAIRE Studio — Makefile racine (ORCHESTRATION)
# Délègue à backend/ (make setup|migrate|seed|run|test|lint|build) et
# frontend/ (pnpm install|dev|test|e2e|lint|build). N'écrit jamais dans les sous-projets.
# =============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
SCRIPTS_DIR  := scripts
COMPOSE      := docker compose

# Charge .env si présent (pour les cibles qui en ont besoin)
ifneq (,$(wildcard ./.env))
include .env
export
endif

.PHONY: help setup setup-backend setup-frontend migrate seed dev dev-backend dev-frontend \
        run test test-backend test-frontend e2e lint lint-backend lint-frontend \
        build build-backend build-frontend logs ps up down reset clean check

help: ## Affiche cette aide
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- Setup -------------------------------------------------------------------
setup: setup-backend setup-frontend ## Installe toutes les dépendances (back + front + Playwright)

setup-backend: ## Installe les dépendances backend (uv)
	$(MAKE) -C $(BACKEND_DIR) setup

setup-frontend: ## Installe les dépendances frontend (pnpm) + navigateurs Playwright
	cd $(FRONTEND_DIR) && pnpm install --frozen-lockfile || pnpm install
	cd $(FRONTEND_DIR) && pnpm exec playwright install --with-deps || true

# --- Base de données ---------------------------------------------------------
migrate: ## Applique les migrations Django
	$(MAKE) -C $(BACKEND_DIR) migrate

seed: ## Peuple la base (idempotent) — voir dossier/15_runbook/seeding.md
	bash $(SCRIPTS_DIR)/seed_all.sh

# --- Développement -----------------------------------------------------------
dev: ## Lance la pile de dev (postgres + backend :8000 + frontend :3000)
	bash $(SCRIPTS_DIR)/dev_up.sh

dev-backend: ## Lance uniquement le backend (:8000)
	$(MAKE) -C $(BACKEND_DIR) run

dev-frontend: ## Lance uniquement le frontend (:3000)
	cd $(FRONTEND_DIR) && pnpm dev

run: dev ## Alias de `dev`

# --- Tests -------------------------------------------------------------------
test: lint test-backend test-frontend ## Lint + pytest + vitest (sans navigateur)

test-backend: ## pytest (backend)
	$(MAKE) -C $(BACKEND_DIR) test

test-frontend: ## Vitest + MSW (frontend)
	cd $(FRONTEND_DIR) && pnpm test

e2e: ## Playwright contre la pile réelle (seed + back + front)
	bash $(SCRIPTS_DIR)/e2e.sh

# --- Qualité -----------------------------------------------------------------
lint: lint-backend lint-frontend ## Lint back (ruff/import-linter) + front (eslint/prettier/tsc)

lint-backend: ## Lint backend
	$(MAKE) -C $(BACKEND_DIR) lint

lint-frontend: ## Lint + typecheck frontend
	cd $(FRONTEND_DIR) && pnpm lint && pnpm typecheck

# --- Build -------------------------------------------------------------------
build: build-backend build-frontend ## Build production (back + front)

build-backend: ## Build backend (collectstatic / image)
	$(MAKE) -C $(BACKEND_DIR) build

build-frontend: ## Build frontend (next build)
	cd $(FRONTEND_DIR) && pnpm build

# --- Docker / exploitation ---------------------------------------------------
ps: ## État des services docker
	$(COMPOSE) ps

up: ## Démarre toute la pile via docker compose
	$(COMPOSE) up

down: ## Arrête la pile (volumes conservés)
	$(COMPOSE) down

logs: ## Suit les logs de tous les services
	$(COMPOSE) logs -f

reset: ## RESET TOTAL : détruit la DB, re-migre, re-seed
	$(COMPOSE) down -v
	$(COMPOSE) up -d postgres
	$(MAKE) migrate
	$(MAKE) seed

# --- Nettoyage ---------------------------------------------------------------
clean: ## Arrête les conteneurs et nettoie caches/artefacts
	-$(COMPOSE) down
	-$(MAKE) -C $(BACKEND_DIR) clean
	-rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next \
	         $(FRONTEND_DIR)/coverage $(FRONTEND_DIR)/playwright-report \
	         $(FRONTEND_DIR)/test-results

# --- Validation finale -------------------------------------------------------
check: lint test e2e ## Pipeline complet local (lint + tests + e2e) — cf. RUNBOOK §10
