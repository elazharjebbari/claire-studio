# FAQ

## Mes modifications ne sont pas enregistrées automatiquement ?

L'indicateur **« modifications non enregistrées »** apparaît tant que vous n'avez
pas créé de snapshot. Appuyez sur `⌘S` (ou le bouton **Snapshot**) pour capturer
votre état.

## Pourquoi ne puis-je pas créer un thème personnalisé ?

Le vocabulaire est **fermé** : seuls les thèmes du schéma du projet sont
disponibles, pour garantir la cohérence. Les schémas se modifient côté admin
(`/admin/schemes`).

## Les fantômes LLM modifient-ils mon annotation ?

Non. Les fantômes ne sont qu'un **affichage de comparaison**. Tant que vous ne
les adoptez pas via « Pré-remplir depuis Claude / Codex », ils n'altèrent rien.

## Je ne vois pas le fil de commentaires.

Il n'apparaît que lorsqu'une **clause est sélectionnée**. Cliquez d'abord une
clause dans le document ou le plan, ou appuyez sur `C`.

## Comment passer du mode démo au mode réel ?

Le mode dépend de `NEXT_PUBLIC_ENABLE_MOCKS`. En mode réel (`false`), l'app parle
à l'API Django et exige une authentification ; en mode démo (`true`), l'interface
est autonome (MSW), sans backend.

## Où trouver la liste des raccourcis ?

Dans la section **Raccourcis clavier** de ce centre d'aide, ou en lançant la
**visite guidée** depuis la barre d'outils du workspace.
