# Audit par aspect — méthodologie & index

Chaque fiche suit le même gabarit d'agence :

1. **Audit** : forces · faiblesses · pertinence (rôle dans le flux) · pistes d'amélioration.
2. **3 variantes** distinctes, chacune notée /10 et comparée (forces/faiblesses/pertinence/effet sur l'usage).
3. **Recommandation** : la meilleure variante, sa justification comparative, et les *quick wins*.

## Index

| # | Aspect | Fiche | Variante retenue | Note |
| --- | --- | --- | --- | --- |
| 01 | Layout général & gestion de l'espace (3 panneaux redimensionnables) | [01-layout-espace.md](01-layout-espace.md) | Cadre dock unifié : plancher + repli bilatéral + bandeaux fusionnés + persistance compte | 9 |
| 02 | Panneau Plan / ToC (un bloc par phrase, couverture, validation, sauts) | [02-plan-toc.md](02-plan-toc.md) | Plan virtualisé filtrable à liste plate | 8 |
| 03 | Overlays (injustice / fantômes LLM / traduction) — emplacement & encombrement du <nav> | [03-overlays-emplacement.md](03-overlays-emplacement.md) | Disclosure 'Affichage' replié au pied du plan | 8 |
| 04 | Zone Document (phrases, frontières/split, sélection, surlignage des thèmes) | [04-zone-document.md](04-zone-document.md) | Gouttière d'arbitrage unifiée + bord gauche assaini (consolidation) | 9 |
| 05 | Menu contextuel clic-droit (SentenceMenu : annoter / bloc LLM à retirer / traduire) | [05-menu-contextuel.md](05-menu-contextuel.md) | Menu express à révélation progressive | 9 |
| 06 | Inspecteur (rationale, comparaison juges, nature, divergence) | [06-inspecteur.md](06-inspecteur.md) | Inspecteur en accordéon hiérarchisé (révélation progressive) | 8 |
| 07 | Système de thèmes : couleurs → renforcement par icônes (subtil, sans fatigue visuelle) | [07-themes-icones.md](07-themes-icones.md) | Glyphe de thème monochrome dans la pastille (remplace le point) | 9 |
| 08 | Arbitrage & explicabilité C1–C5 (proposition du moteur, pourquoi, actions + alternatives, révélation à la demande) | [08-arbitrage-c1c5.md](08-arbitrage-c1c5.md) | Arbitrage ambiant dans l'inspecteur (révélation à la demande sur la clause) | 9 |
| 09 | États des boutons (repos/hover/actif/désactivé/chargement/succès/erreur) — système d'états | [09-etats-boutons.md](09-etats-boutons.md) | Button as State Machine (machine d'états unifiée) | 9 |
| 10 | Barre d'outils de l'atelier (WorkspaceToolbar) | [10-barre-outils.md](10-barre-outils.md) | Barre épurée + tiroir 'Affichage/Outils' à révélation progressive | 9 |
| 11 | Fantômes LLM & loupe d'injustice CLAUDETTE (overlays, hover, œil) | [11-fantomes-injustice.md](11-fantomes-injustice.md) | Loupe sobre à priorité de focus (token-pur + dépliable) | 9 |
| 12 | Iconographie & équilibre texte / graphique (icônes, lignes, lisibilité, densité) | [12-iconographie-equilibre.md](12-iconographie-equilibre.md) | Densité progressive : chip à signaux révélés à la demande | 9 |
| 13 | Couleurs, contraste & accessibilité (tokens sémantiques, WCAG AA) | [13-couleurs-a11y.md](13-couleurs-a11y.md) | Verrouillage strict des tokens sémantiques (zéro hex, CI de garde) | 8 |
| 14 | Rapidité d'usage (raccourcis, curseur collant, opérations par lot, flux d'annotation) | [14-rapidite-usage.md](14-rapidite-usage.md) | Mode rafale clavier-first (registre unifié + valider-suivant) | 9 |


> Matrice comparative complète de toutes les variantes : [`00-matrice-variantes.csv`](00-matrice-variantes.csv).
