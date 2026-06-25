# Plan d'action — refonte de l'atelier (NON technique)

> Lots priorisés du point de vue **produit / design / ergonomie**. L'implémentation
> (composants, store, tests) est détaillée dans le dossier technique séparé.

| Lot | Titre | Priorité | Effort | Impact | Objectif |
| --- | --- | --- | --- | --- | --- |
| Lot 0 | Verrouillage du langage couleur (socle transverse) | P0 | M | Élevé | Faire de l'accessibilité une propriété prouvée et non déclarée : zéro hex en dur, AA garanti en clair et sombre, frontière formalisée entre token métier et token d'état. Prérequis de tous les autres lots. |
| Lot 1 | Cadre dock unifié + plancher de lecture | P0 | L | Élevé | Garantir un cœur de lecture lisible en permanence, rendre l'espace au document des deux côtés, récupérer de la hauteur, et unifier la persistance au compte. |
| Lot 2 | Système d'états de boutons unifié | P0 | M | Élevé | Doter chaque bouton d'une source de vérité repos/hover/actif/désactivé/chargement/succès/erreur, et signaler la progression des actions asynchrones. |
| Lot 3 | Icônes de thème monochromes + assainissement du chip | P1 | M | Élevé | Désambiguïser les 20 thèmes par la forme sans ajouter de densité, et réduire la sur-densité permanente du chip. |
| Lot 4 | Plan virtualisé filtrable + sortie des Overlays | P1 | M | Élevé | Rendre le plan scannable à 193+ entrées, fermer le piège 'j'ai cru avoir fini', libérer la hauteur du nav. |
| Lot 5 | Menu contextuel express (retrait LLM) | P1 | S | Moyen | Transformer le clic-droit en menu d'actions ciblées et rapides, conforme à l'instruction commanditaire. |
| Lot 6 | Inspecteur en accordéon + arbitrage ambiant C1→C5 | P1 | L | Élevé | Remettre Valider au premier plan, porter l'explicabilité C1→C5 et l'arbitrage du moteur là où la décision se prend, avec révélation à la demande. |
| Lot 7 | Gouttière d'arbitrage unifiée (zone document) | P2 | L | Élevé | Réduire les 4 représentations de frontière/split à un œil unique révélant le détail N-way à la demande, et hiérarchiser le bord gauche. |
| Lot 8 | Barre d'outils épurée + tiroir | P2 | M | Moyen | Éliminer le mur de ~15 contrôles plats, rendre lisible la hiérarchie destructif/critique, appliquer la révélation progressive. |
| Lot 9 | Mode rafale clavier-first | P2 | M | Moyen | Mettre le geste #1 (valider+suivant) et l'adoption LLM au clavier, avec découvrabilité, sans alourdir la barre. |


## Détail des lots

### Lot 0 · Verrouillage du langage couleur (socle transverse)

- **Objectif** : Faire de l'accessibilité une propriété prouvée et non déclarée : zéro hex en dur, AA garanti en clair et sombre, frontière formalisée entre token métier et token d'état. Prérequis de tous les autres lots.
- **Priorité** : P0 · **Effort** : M · **Impact** : Élevé
- **Dépendances** : —

**Tâches :**
- Recenser toutes les fuites d'hex (ClauseChip, StatusPill, levels.ts, LLM_JUDGES, useUnfairness, InjusticeLens, toolbar, inspecteur, ToC)
- Cartographier chaque hex vers son token sémantique cible (success/warning/danger/info) ou métier (thème/triage/juge)
- Formaliser et documenter la règle 'token métier ≠ token d'état' dans la charte
- Définir la garde anti-régression (revue + contrôle automatisé) pour interdire tout nouvel hex
- Valider le contraste AA de chaque combinaison texte/fond sur les deux thèmes

### Lot 1 · Cadre dock unifié + plancher de lecture

- **Objectif** : Garantir un cœur de lecture lisible en permanence, rendre l'espace au document des deux côtés, récupérer de la hauteur, et unifier la persistance au compte.
- **Priorité** : P0 · **Effort** : L · **Impact** : Élevé
- **Dépendances** : Lot 0

**Tâches :**
- Définir le plancher de largeur du document central (~70ch) et le comportement de compression bloqué
- Concevoir le repli bilatéral en rail (gauche + droite) avec tooltip et affordance de redimensionnement
- Faire passer Commentaires/Historique/Triage en drawer overlay et non en frères compresseurs
- Fusionner les bandeaux session/verrou/vue-juge en un bandeau hiérarchisé unique
- Définir la remontée de la persistance du layout au compte (cohérence avec panneaux/overlays/zoom)

### Lot 2 · Système d'états de boutons unifié

- **Objectif** : Doter chaque bouton d'une source de vérité repos/hover/actif/désactivé/chargement/succès/erreur, et signaler la progression des actions asynchrones.
- **Priorité** : P0 · **Effort** : M · **Impact** : Élevé
- **Dépendances** : Lot 0

**Tâches :**
- Spécifier la matrice d'états et les variantes sémantiques (primary/neutral/warning/danger/success)
- Concevoir le feedback de chargement (spinner, largeur stable, anti double-clic) branché sur les actions longues
- Concevoir les transitions succès/erreur transitoires et leur durée
- Définir la hiérarchie destructif/toggle (prefill en warning, Soumettre seul primary)
- Lister les boutons ad hoc à rallier au composant (SelectionToolbar, BlockToolbar)

### Lot 3 · Icônes de thème monochromes + assainissement du chip

- **Objectif** : Désambiguïser les 20 thèmes par la forme sans ajouter de densité, et réduire la sur-densité permanente du chip.
- **Priorité** : P1 · **Effort** : M · **Impact** : Élevé
- **Dépendances** : Lot 0

**Tâches :**
- Valider le mapping thème→icône Lucide (20 entrées) avec les annotateurs experts
- Substituer le glyphe monochrome au point coloré dans la pastille (aucun signal ajouté)
- Définir l'échelle typographique nommée avec plancher de lisibilité (fin des 9px/10px épars)
- Spécifier la révélation à la demande des signaux secondaires du chip (index d'ancre, +N)
- Unifier sur Lucide et retirer les glyphes Unicode porteurs de sens

### Lot 4 · Plan virtualisé filtrable + sortie des Overlays

- **Objectif** : Rendre le plan scannable à 193+ entrées, fermer le piège 'j'ai cru avoir fini', libérer la hauteur du nav.
- **Priorité** : P1 · **Effort** : M · **Impact** : Élevé
- **Dépendances** : Lot 0, Lot 3

**Tâches :**
- Spécifier les filtres (non validées / pré-annotées LLM non validées / par thème) et leur état clavier
- Concevoir la virtualisation et la conservation du saut 'prochaine non annotée' et des marqueurs de couverture
- Rendre le panneau repliable en rail
- Déplacer le fieldset Overlays vers un disclosure 'Affichage' replié avec badge 'N actifs'
- Supprimer la duplication du toggle Traduction (un seul contrôle displayLang) et ajouter les glyphes d'overlay

### Lot 5 · Menu contextuel express (retrait LLM)

- **Objectif** : Transformer le clic-droit en menu d'actions ciblées et rapides, conforme à l'instruction commanditaire.
- **Priorité** : P1 · **Effort** : S · **Impact** : Moyen
- **Dépendances** : Lot 0, Lot 2, Lot 3

**Tâches :**
- Hiérarchiser : thème principal + Valider en saillance, reste replié à la demande
- Retirer la section 'Propositions LLM' (disponible au survol et via l'œil ailleurs)
- Borner la hauteur du menu (anti-débordement bas d'écran + long-press tactile)
- Remplacer les emojis Unicode par l'iconographie Lucide
- Réutiliser ThemeMultiPicker/CertaintyPicker sans changer la logique du store

### Lot 6 · Inspecteur en accordéon + arbitrage ambiant C1→C5

- **Objectif** : Remettre Valider au premier plan, porter l'explicabilité C1→C5 et l'arbitrage du moteur là où la décision se prend, avec révélation à la demande.
- **Priorité** : P1 · **Effort** : L · **Impact** : Élevé
- **Dépendances** : Lot 0, Lot 2, Lot 3

**Tâches :**
- Concevoir l'accordéon hiérarchisé (Valider + qualification de base en tête, 7 sections repliées)
- Concevoir la carte d'arbitrage : proposition compacte → 'Pourquoi ?' → actions ET alternatives explicites
- Concevoir la révélation à la demande de la signification C1→C5 (clic pour dévoiler, zéro pollution permanente)
- Unifier la surface d'arbitrage (état partagé hover/inspecteur/Compare, fin du triple affichage)
- Corriger 'Reprendre dans mon annotation' pour copier thème + nature en plus d'evidence + rationale

### Lot 7 · Gouttière d'arbitrage unifiée (zone document)

- **Objectif** : Réduire les 4 représentations de frontière/split à un œil unique révélant le détail N-way à la demande, et hiérarchiser le bord gauche.
- **Priorité** : P2 · **Effort** : L · **Impact** : Élevé
- **Dépendances** : Lot 0, Lot 3

**Tâches :**
- Concevoir l'œil de frontière unique et sa révélation N-way à la demande
- Hiérarchiser les 4 canaux du bord gauche (thème/triage/focus/validation) pour les distinguer
- Concevoir le cheat-sheet d'affordance des gestes (clic, Shift+clic, double-clic, etc.)
- Plafonner l'empilement de badges au-dessus de la phrase (+N autres)
- Aligner la loupe d'injustice (tons de sévérité → tokens, carte dépliable, plafonnement multi-catégories)

### Lot 8 · Barre d'outils épurée + tiroir

- **Objectif** : Éliminer le mur de ~15 contrôles plats, rendre lisible la hiérarchie destructif/critique, appliquer la révélation progressive.
- **Priorité** : P2 · **Effort** : M · **Impact** : Moyen
- **Dépendances** : Lot 0, Lot 2

**Tâches :**
- Structurer la barre en 3 zones (contexte / outils / actions)
- Sortir les destinations rares en tiroir 'Affichage/Outils'
- Regrouper les trois entrées de prefill et marquer le prefill comme action warning
- Conformer les cibles tactiles et retirer les glyphes Unicode mélangés au texte
- Définir libellés clairs + raccourcis pour mitiger la découvrabilité des fonctions déplacées

### Lot 9 · Mode rafale clavier-first

- **Objectif** : Mettre le geste #1 (valider+suivant) et l'adoption LLM au clavier, avec découvrabilité, sans alourdir la barre.
- **Priorité** : P2 · **Effort** : M · **Impact** : Moyen
- **Dépendances** : Lot 2, Lot 6

**Tâches :**
- Concevoir le registre de raccourcis unifié (source de vérité partagée pour hints/kbd)
- Définir les raccourcis manquants (valider+suivant, adoption LLM 1/2, navigation divergences, prochaine non validée, prefill)
- Supprimer le doublon B/T
- Concevoir la modale d'aide '?' et les tooltips kbd focusables (fin des title= invisibles)
- Exploiter le curseur collant et les lots atomiques existants pour le flux de bout en bout
