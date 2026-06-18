# ADR 0001 — Stack Django/DRF + Next.js

- Statut : **Accepté**
- Date : 2026-06-18
- Décideurs : architecte plateforme, lead backend, lead frontend
- Contexte de référence : `00_overview/CONTRACT.md`, `README.md`

## Contexte et problème

CLAIRE Studio doit fournir un **gold humain de référence** que trois protocoles LLM successifs n'ont pas
su produire (audit : κ ≈ 0,32–0,45). L'outil exige : (1) un **modèle relationnel riche** (16 entités,
invariants durs, versioning, audit), (2) un **workspace interactif au clavier** très réactif (le cœur
produit), (3) une **API stable et versionnée** comme frontière entre les deux, (4) une mise en route
rapide (admin, migrations, auth). Quelle stack adopter ?

## Options envisagées

1. **Django/DRF (backend) + Next.js/Tailwind (frontend)** — séparation API/SPA.
2. **Django monolithique avec templates server-rendered** (HTMX/Django templates).
3. **Backend Node (NestJS/Express) + Next.js** — un seul langage.
4. **Backend FastAPI + Next.js** — Python léger + SPA.

## Décision

Adopter l'**option 1 : Django + DRF côté backend, Next.js (App Router) + Tailwind côté frontend**, avec
une **API REST versionnée `/api/v1/` en JWT** comme contrat (CONTRACT §3) et le **format pivot clause**
(CONTRACT §4) comme frontière d'échange.

## Justification

- **Modèle de données** : l'ORM Django + migrations + contraintes DB conviennent idéalement aux invariants
  durs du CONTRACT §2 (unicité `(project, document, annotator)`, 1 clause-start/phrase, vocab fermé). DRF
  apporte sérialiseurs versionnés, pagination, filtres, permissions par rôle.
- **Bootstrap & opérations** : l'admin Django et les commandes de management accélèrent l'import CLAUDETTE
  (feature 12), le seed et l'exploitation par l'admin (P4) — sans réécrire un back-office.
- **Frontend** : Next.js App Router permet un workspace riche, rendu hybride, et une excellente DX pour
  l'ergonomie anti-fatigue (Tailwind + tokens du design system). Le clavier-first (P1/P2) est plus simple
  en SPA qu'en pages server-rendered.
- **Séparation des évolutions** : l'API stable découple les rythmes front/back et autorise d'autres
  consommateurs (scripts, notebooks de recherche) via le même contrat.
- **Écosystème Python** : aligne l'outil avec l'environnement de recherche du projet (calcul IAA/κ,
  loaders CLAUDETTE) sans pont de langage.

## Conséquences

**Positives** : robustesse du modèle, mise en route rapide, frontière API testable (un test par invariant,
E2E par feature), réutilisabilité multi-corpus côté backend.

**Négatives / coûts** : deux écosystèmes (Python + TS) à maintenir et déployer ; duplication des types
(atténuée par la génération de types depuis le schéma OpenAPI/DRF) ; option 2 (HTMX) aurait été plus simple
mais incompatible avec l'interactivité clavier du workspace ; option 3/4 auraient unifié le langage mais
perdu l'ORM/admin/migrations mûrs de Django, décisifs pour ce modèle.

**Liens** : ADR-0002 (DB-centrique), ADR-0003 (vocab fermé), `ARCHITECTURE.md §2`.
