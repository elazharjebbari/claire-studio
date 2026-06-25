# Dossier de refonte — Atelier d'annotation Pactiva (UI/UX · design · ergonomie)

> Livrable **design / produit** (sans aspect technique). Le dossier d'implémentation
> (backend/frontend/data/tests) fait l'objet d'un dossier séparé : `dossier-refonte-atelier-tech/`.

**Date** : 2026-06-25 · **Périmètre** : l'écran `/annotate/[annotationId]` (atelier d'annotation) et ses sous-systèmes.

## Démarche (agence)

1. **Cartographie** de l'existant (zones, flux, douleurs) — `00-cartographie/`.
2. **Audit** par aspect : forces / faiblesses / pertinence / améliorations, puis **3 variantes**
   distinctes **notées et comparées**, puis la **meilleure variante** retenue — `01-audit/` (14 aspects).
3. **Proposition finale** intégrant les meilleures variantes en un tout cohérent — `02-proposition-finale/`.
4. **Design system** : couleurs (tokens), icônes par thème, **matrice des états de boutons** — `03-design-system/`.
5. **Plan d'action** priorisé, **non-technique** — `04-plan-action/`.

## Aspects audités

| # | Aspect | Meilleure variante retenue |
| --- | --- | --- |
| 01 | Layout général & gestion de l'espace (3 panneaux redimensionnables) | Cadre dock unifié : plancher + repli bilatéral + bandeaux fusionnés + persistance compte |
| 02 | Panneau Plan / ToC (un bloc par phrase, couverture, validation, sauts) | Plan virtualisé filtrable à liste plate |
| 03 | Overlays (injustice / fantômes LLM / traduction) — emplacement & encombrement du <nav> | Disclosure 'Affichage' replié au pied du plan |
| 04 | Zone Document (phrases, frontières/split, sélection, surlignage des thèmes) | Gouttière d'arbitrage unifiée + bord gauche assaini (consolidation) |
| 05 | Menu contextuel clic-droit (SentenceMenu : annoter / bloc LLM à retirer / traduire) | Menu express à révélation progressive |
| 06 | Inspecteur (rationale, comparaison juges, nature, divergence) | Inspecteur en accordéon hiérarchisé (révélation progressive) |
| 07 | Système de thèmes : couleurs → renforcement par icônes (subtil, sans fatigue visuelle) | Glyphe de thème monochrome dans la pastille (remplace le point) |
| 08 | Arbitrage & explicabilité C1–C5 (proposition du moteur, pourquoi, actions + alternatives, révélation à la demande) | Arbitrage ambiant dans l'inspecteur (révélation à la demande sur la clause) |
| 09 | États des boutons (repos/hover/actif/désactivé/chargement/succès/erreur) — système d'états | Button as State Machine (machine d'états unifiée) |
| 10 | Barre d'outils de l'atelier (WorkspaceToolbar) | Barre épurée + tiroir 'Affichage/Outils' à révélation progressive |
| 11 | Fantômes LLM & loupe d'injustice CLAUDETTE (overlays, hover, œil) | Loupe sobre à priorité de focus (token-pur + dépliable) |
| 12 | Iconographie & équilibre texte / graphique (icônes, lignes, lisibilité, densité) | Densité progressive : chip à signaux révélés à la demande |
| 13 | Couleurs, contraste & accessibilité (tokens sémantiques, WCAG AA) | Verrouillage strict des tokens sémantiques (zéro hex, CI de garde) |
| 14 | Rapidité d'usage (raccourcis, curseur collant, opérations par lot, flux d'annotation) | Mode rafale clavier-first (registre unifié + valider-suivant) |


## Vision

L'atelier d'annotation Pactiva devient un poste de travail expert « calme et dense » : un cœur de lecture toujours respecté (plancher de largeur garanti), entouré de deux flancs qui se replient à la demande, et une grammaire visuelle unique où chaque pixel porte un sens et un seul. Le bruit permanent disparaît au profit d'une révélation progressive systématique — l'information riche (arbitrage du moteur, pourquoi C1→C5, propositions LLM, signaux secondaires du chip) ne s'affiche que lorsqu'on la sollicite. Couleur, forme et texte se renforcent au lieu de se concurrencer : un langage couleur 100 % tokenisé (zéro hex, basculement clair/sombre prouvé, AA garanti) doublé d'icônes de thème monochromes pré-attentives, et un système de boutons unifié qui sait enfin dire « je charge, j'ai réussi, j'ai échoué ». Le résultat : un annotateur qui scanne plus vite, décide avec plus de confiance, et travaille au clavier en rafale — sans jamais se demander « où est ce réglage » ni « mon clic a-t-il été pris en compte ».

## Principes directeurs

- Révélation progressive par défaut : tout signal rare (arbitrage, pourquoi C1→C5, propositions LLM, signaux secondaires du chip, overlays, outils de la barre) est replié et ne se dévoile qu'au clic, au survol ou au focus — la surface de repos reste minimale et le détail expert reste à un geste.
- Le cœur de lecture est sacré : largeur minimale garantie pour le document central (plancher ~70ch), flancs repliables des deux côtés, auxiliaires en drawer overlay et non en compression latérale, bandeaux d'état fusionnés pour rendre de la hauteur.
- Un sens = un signal, jamais deux vérités : zéro hex en dur, tout passe par les tokens sémantiques (--sem-success/warning/danger/info en canaux RGB), frontière formalisée entre token MÉTIER (thème, certitude) et token d'ÉTAT (succès, alerte, danger), et chaque action a un lieu canonique unique.
- Couleur jamais seule (WCAG 1.4.1) : la forme (icône monochrome de thème, liseré plein/pointillé, glyphe d'état Lucide) double systématiquement la couleur, au bénéfice du daltonisme, de la mémorisation et du contraste AA recalculé en clair comme en sombre.
- Cohérence iconographique et typographique : une seule bibliothèque (Lucide), fin des glyphes Unicode textuels porteurs de sens, une échelle typographique nommée avec un plancher de lisibilité, des cibles tactiles conformes — la densité reste maîtrisée et non subie.
- Feedback d'état explicite et tokenisé : chaque bouton connaît repos/hover/actif/désactivé/chargement/succès/erreur via une source de vérité unique, et toute action asynchrone (Soumettre, prefill, vol de verrou) signale visuellement sa progression — fin des double-clics et de l'anxiété de latence.
- Rapidité clavier-first : le geste #1 (valider+suivant) et l'adoption LLM (1/2) sont au clavier via un registre unifié, avec découvrabilité par modale '?' et hints kbd — sans alourdir une barre déjà épurée.

## Arborescence

```
dossier-refonte-atelier/
├── README.md
├── 00-cartographie/      zones · flux · douleurs (+ diagramme)
├── 01-audit/             1 fiche par aspect (3 variantes notées) + matrice CSV
├── 02-proposition-finale/ vision · décisions par zone · avant/après
├── 03-design-system/     couleurs (YAML) · icônes thèmes (CSV) · états boutons (CSV+MD)
└── 04-plan-action/       lots priorisés (MD) + backlog (CSV)
```
