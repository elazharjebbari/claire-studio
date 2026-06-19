# 00 — Vision, personas, objectifs

## Vision

Faire de CLAIRE Studio un **atelier collaboratif** où plusieurs annotateurs
juridiques construisent, versionnent et discutent des annotations de clauses, avec
une traçabilité totale et une ergonomie qui rend la collaboration *légère* plutôt
que pesante. L'objectif scientifique reste la production d'un **gold humain**
traçable, comparable aux juges LLM (Claude/Codex), pour calibrer le pipeline de
détection d'anomalies.

## Personas

- **Annotateur** (chercheur/juriste) : découpe le document en clauses, attribue des
  thèmes, justifie, commente, soumet des versions. Travaille souvent à plusieurs.
- **Relecteur / encadrant** (J.-C. Lamirel) : compare des versions, valide, commente,
  qualifie la cohérence inter-annotateurs.
- **Administrateur** : gère projets, membres, rôles, vocabulaire, flags, quotas,
  liens de partage ; supervise l'audit et les métriques.

## Objectifs (Definition of Success)

1. Plusieurs annotateurs travaillent sur **le même corpus** sans se marcher dessus.
2. Chaque modification est **attribuée** (qui), **datée** (quand), **localisée**
   (phrase/clause/document) et **justifiable** (pourquoi).
3. On peut **revenir en arrière** (undo/redo) et **rejouer l'histoire** d'un document
   ou d'une **phrase** à travers les annotateurs et les versions.
4. La **soumission** crée une version nommée et décrite ; les versions coexistent.
5. Un **écran d'exploration** qualifie les annotations humaines (corpus + document).
6. Le **mode collaboratif** est intuitif : présence, voyants, résolution de conflits
   transparente, lien de partage.

## Non-objectifs (ce cycle)

- Pas de messagerie temps réel généraliste (on cible le commentaire d'annotation).
- Pas d'éditeur de texte riche : l'unité reste la **phrase indexée**.
- Pas de fusion automatique « intelligente » de thèmes divergents : la fusion CRDT
  opère au niveau structurel (clauses/ancres/champs), l'arbitrage sémantique reste
  humain (cf. arbitrage des divergences déjà livré).

## Métriques produit

- Temps médian d'annotation par document, par annotateur.
- Taux d'accord inter-annotateurs (κ) par projet et par catégorie.
- Nombre de versions par document, délai entre versions.
- Conflits détectés / résolus automatiquement / escaladés.
- Adoption du collaboratif (sessions multi-utilisateurs, commentaires/clause).
