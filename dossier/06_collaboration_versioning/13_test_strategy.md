# 13 — Stratégie de tests

Pyramide : beaucoup d'unitaires purs, des tests de composants/API, quelques parcours
e2e. Tout nouveau comportement est couvert avant d'être considéré « fait ».

## Vitest (unitaires & composants — front)
- **Pur** : pile undo/redo (do/undo/redo, troncature, jalon non annulable) ;
  réducteur `replacePrefill` (préserve l'humain, remplace les seeds) ; diff de snapshots ;
  projection `sentence-history` ; calcul des métriques analytics.
- **Store** : `actionLog` (append, cap, before/after), `prefilledJudge`, soumission
  versionnée (payload), conformité aux flags.
- **Composants** : `DocumentSwitcher` (autocomplete, voyant draft), `SubmitDialog`
  (validation nom requis), `HistoryPanel` (clic → recentre), `PresenceBar` (rendu états),
  `CommentComposer` (scopes).

## MSW (contrat API — front)
Handlers pour : versions (name/description/kind/stats), submit, sentence-history,
attribution, comments (scopes), insights (corpus+document), share-links, collab-ticket,
config/flags. Les fixtures produisent des cas réalistes (divergences, multi-versions,
multi-annotateurs).

## Playwright (e2e — parcours)
- **Pré-remplir** : Claude → Codex bascule réellement (clauses du nouveau juge visibles,
  humaines préservées).
- **DocumentSwitcher** : recherche, voyant draft, navigation.
- **Sticky** : l'en-tête reste visible après scroll.
- **Soumission versionnée** : dialogue nom+description → version créée + statut submitted.
- **Historique** : action → entrée dans le panneau → clic recentre.
- (cycle suivant) collaboratif : 2 contextes navigateur, présence, édition concurrente,
  voyant de conflit ; partage de lien ; analytics ; explorateur de versions phrase/doc.

## pytest (backend)
- Versioning : snapshot immuable, number monotone, submit transactionnel, restore =
  nouvelle version. Audit append-only (refus UPDATE/DELETE).
- Sentence-history : projection correcte filtrée par (document, index).
- Share-links : signature HMAC, expiration, quota, révocation, refus anonyme.
- Permissions : owner/reviewer/annotator ; tickets WS ; idempotence `clientOpId`.
- Consumer Channels (pytest-asyncio + ChannelsLiveServer) : join/leave, broadcast,
  snapshot debouncé, refus sans ticket.

## CI & qualité
- `tsc --noEmit` 0 erreur ; `ruff`/`black` backend ; couverture des briques critiques.
- E2E en mode mock (déterministe) + smoke réel optionnel.
