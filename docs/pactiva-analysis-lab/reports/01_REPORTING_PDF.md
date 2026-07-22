# Reporting et PDF reproductible

## Assistant

1. sélectionner un AnalysisRun réussi ;
2. choisir un template ;
3. sélectionner sections et visualisations ;
4. choisir synthèse/détail/annexes ;
5. définir confidentialité et inclusion éventuelle d’extraits ;
6. prévisualiser le sommaire ;
7. confirmer puis suivre le job.

Templates initiaux : qualité, corpus, individuel, inter-annotateurs, humain–LLM, inter-LLM, Gold et
campagne complète.

## Architecture

`ReportComposer` construit un `ReportDocument` neutre à partir de runs immuables. `ReportRenderer`
expose `render_html`, `render_pdf`, `render_assets`. L’implémentation initiale Playwright charge un
bundle print local, sans accès réseau. Les graphiques sont SVG ou PNG haute résolution ; la table
alternative est intégrée en annexe. `ArtifactStore` écrit temporairement, calcule SHA-256 puis
publie atomiquement.

## Structure obligatoire

Couverture, résumé exécutif, périmètre, méthodologie, résultats, interprétation, cas représentatifs
autorisés, limites, décisions/recommandations, annexes statistiques et manifeste de
reproductibilité.

## Manifeste

Projet/campagne, AnalysisRun IDs, auteur, date, schéma, GoldRun, filtres canoniques, acteurs ou
pseudonymes, supports, versions métriques, fingerprint sources, version template/renderer,
confidentialité et checksum final.

## Qualité print

A4 portrait par défaut, paysage pour matrices/tables, sommaire et signets PDF, titres non orphelins,
`break-inside: avoid`, en-têtes répétés, numéros de page, pied de page, contrastes imprimables et
polices embarquées. Tests par extraction de texte, compte de pages, comparaison visuelle ciblée et
validation de checksum/manifest. Les rapports ne contiennent aucun lien direct durable vers un
artefact privé.
