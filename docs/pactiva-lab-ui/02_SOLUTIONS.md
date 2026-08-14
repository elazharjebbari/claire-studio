# Analyse de solutions — remédiation UI/UX Pactiva Lab

Pour chaque problème structurel identifié dans `01_AUDIT.md`, plusieurs approches sont
envisageables. Ce document compare leurs forces/faiblesses et justifie le choix retenu
(marqué **✅ retenu**) — voir `03_PLAN_ACTION.md` pour l'exécution.

---

## Axe A — Sidebar non responsive (§2.1, cause racine dominante)

### A1 — Repli automatique en mode icône sous un point de rupture
Forcer `sidebarCollapsed = true` en dessous de `md` en lisant `window.matchMedia` côté
client.

- **Forces** : changement minimal (un seul état booléen déjà existant), aucun nouveau
  composant.
- **Faiblesses** : à 56px de large sur un écran de 375px, la sidebar mange encore ~15 %
  de la largeur en PERMANENCE — pas de moyen de la masquer complètement pour lire un
  tableau dense. Confond deux besoins différents : « je veux moins de sidebar » (desktop,
  préférence durable) et « je veux zéro sidebar tant que je ne navigue pas » (mobile,
  état transitoire). Un utilisateur qui a explicitement déplié sa sidebar desktop (pref
  serveur) se retrouverait avec la même préférence appliquée à tort sur mobile lors du
  prochain login.

### A2 — Tiroir (drawer) hors-flux, fermé par défaut sous `md`, ouvert par un bouton hamburger
La sidebar passe en `position: fixed`, translatée hors écran (`-translate-x-full`) par
défaut sous le point de rupture, ouverte par un bouton dédié dans la `TopBar`, avec un
fond cliquable pour refermer. Au-dessus du point de rupture, comportement desktop
inchangé (repli icône optionnel, persisté par compte).

- **Forces** : pattern standard, bien compris par tout utilisateur de web/mobile
  moderne ; libère 100 % de la largeur pour le contenu quand fermé (le cas par défaut) ;
  ne casse aucun comportement desktop existant ; distingue proprement l'état desktop
  (persisté) de l'état mobile (transitoire, jamais persisté — sinon un tiroir resterait
  ouvert par-dessus la page suivante après un rechargement, un bug pire que l'original).
- **Faiblesses** : plus de code que A1 (nouvel état, backdrop, bouton, gestion clavier
  Échap) ; nécessite de dissocier `showLabels` de `collapsed` pour ne pas hériter du
  repli desktop dans le tiroir mobile (piège identifié et corrigé — voir Sidebar.tsx).
- **✅ retenu.** C'est le seul des trois qui répond réellement au problème mesuré (60 %
  de l'écran mangé, chevauchement de texte) plutôt que de l'atténuer partiellement.

### A3 — Barre de navigation basse (bottom tab bar), pattern natif mobile
Remplacer entièrement la sidebar par une barre d'onglets en bas d'écran sous un point
de rupture, à la manière d'une app mobile native.

- **Forces** : le plus « natif » sur mobile, zéro geste requis pour naviguer entre les
  5-6 items les plus utilisés.
- **Faiblesses** : la sidebar de Pactiva a ~15 items répartis en 5 groupes nommés
  (Ma session / Corpus & projets / Collaboration / Administration…) — une bottom bar ne
  peut raisonnablement en exposer que 4-5 sans son propre sous-menu, ce qui revient à
  réintroduire un tiroir pour le reste. Redesign de la taxonomie de navigation complète,
  hors du périmètre d'un audit ciblé sur le Lab. Risque de régression élevé (nav
  utilisée sur 100 % des pages authentifiées).
- **Écarté** — sur-dimensionné par rapport au problème, et le gain marginal par rapport
  à A2 ne justifie pas le risque sur un composant aussi transverse.

---

## Axe B — Fil d'Ariane cassé sur `/lab/runs/[id]` (§2.2)

### B1 — Cas par cas : ajouter `lab`/`runs` aux tables existantes
Ajouter les deux entrées manquantes à `LABELS` et `runs` à `NO_INDEX_SEGMENTS`, comme le
pattern déjà établi pour `history`. Ajouter une fonction pure de raccourcissement des
segments UUID.

- **Forces** : suit EXACTEMENT un pattern déjà écrit, testé en intention (le
  commentaire du code documente précisément ce cas), dans le même fichier — zéro
  nouvelle abstraction, risque de régression minimal, corrige aussi bien le 404
  réseau que la lisibilité. Généralisable : la détection UUID par regex couvre tout
  futur segment dynamique de ce type (datasets, runs, sessions…) sans y repenser à
  chaque fois.
- **Faiblesses** : ne résout pas le cas plus général « afficher le nom de la ressource
  plutôt que son id » (ex. le nom de l'expérience au lieu de l'UUID raccourci) — un
  gain de lisibilité existe déjà (UUID → 8 caractères) mais pas une résolution complète.
- **✅ retenu** pour ce lot — corrige le bug réel (404 + illisibilité) au bon niveau
  d'effort. Résolution complète du libellé documentée en B2, backlog.

### B2 — Résolution complète du nom de la ressource (appel API dans `Breadcrumbs`)
Faire en sorte que le dernier segment d'un `/lab/runs/[id]` affiche le nom réel de
l'expérience (« Embeddings gelés + tête légère ») plutôt qu'un UUID raccourci.

- **Forces** : la meilleure lisibilité possible.
- **Faiblesses** : `Breadcrumbs` est un composant **global**, monté sur chaque page
  authentifiée ; lui faire connaître le détail de CHAQUE type de ressource dynamique de
  l'app (runs, datasets, documents, sessions…) est un couplage qui grossit sans borne à
  mesure que l'app grandit. Nécessite une requête réseau supplémentaire par page (même
  si mise en cache par react-query, c'est un aller-retour de plus juste pour un fil
  d'Ariane) et une gestion d'état de chargement (« Chargement… » pendant la résolution).
- **Écarté pour ce lot**, noté en backlog — à ne faire QUE si un besoin utilisateur
  précis le justifie (aujourd'hui, le titre de l'expérience est déjà affiché en gros
  dans le corps de la page ; le doublon dans le fil d'Ariane est un gain marginal).

---

## Axe C — Tableaux non protégés contre le débordement (§2.4)

### C1 — `overflow-x-auto` sur chaque conteneur de tableau
Envelopper chaque `<table>` non protégé dans un `<div className="overflow-x-auto">`.

- **Forces** : correctif d'une ligne par tableau, zéro changement de comportement sur
  desktop (où le débordement ne se produit pas), pattern déjà en usage ailleurs dans le
  même module (`ExperimentLauncher.tsx`) — cohérence immédiate. Risque de régression
  proche de zéro.
- **Faiblesses** : sur mobile, un tableau qui défile horizontalement reste un tableau
  qui défile horizontalement — ergonomiquement inférieur à une vraie vue « carte » par
  ligne. N'améliore pas la densité d'information, seulement l'accès à celle-ci sans
  débordement cassé.
- **✅ retenu pour ce lot** — c'est le correctif qui élimine le bug (débordement cassé,
  contenu inaccessible) au bon rapport effort/risque. La vraie refonte en vue carte est
  un axe de fond, documentée en C2.

### C2 — Vue « carte » alternative par ligne sous un point de rupture
Sous `md`, remplacer chaque `<tr>` par une carte empilée (`<Panel>` par ligne, champs en
liste verticale) plutôt qu'une ligne de tableau compressée.

- **Forces** : la meilleure ergonomie mobile réelle — c'est le pattern que Gold utilise
  déjà par endroits.
- **Faiblesses** : demande une DEUXIÈME implémentation de rendu par tableau (carte +
  tableau, avec un même modèle de données mais un JSX différent selon le point de
  rupture) — 4 tableaux à dupliquer, effort ×3-4 par rapport à C1, et un vrai risque de
  divergence entre les deux rendus au fil du temps si on oublie d'en maintenir un des
  deux à jour.
- **Écarté pour ce lot**, backlog — à envisager tableau par tableau, en commençant par
  `RunList` (le plus consulté), une fois le reste stabilisé.

---

## Axe D — Typographie sous le seuil documenté (§2.5)

### D1 — Remontée mécanique `text-[10px]`/`text-[11px]` → `text-xs` (12px)
Remplacement systématique par l'échelle officielle déjà documentée dans la charte
graphique.

- **Forces** : aligne le module sur un standard **déjà écrit et déjà appliqué
  ailleurs** dans l'app (Gold, atelier) — ce n'est pas une nouvelle règle inventée pour
  l'occasion, c'est une dette corrigée. Changement mécanique, à faible risque
  (`text-xs` est une classe Tailwind standard du thème, pas une valeur arbitraire à
  faire cohabiter). Gain de lisibilité immédiat sur les 35 occurrences concernées.
- **Faiblesses** : un texte 12px au lieu de 10-11px prend plus de place — sur des
  tableaux déjà denses, peut accentuer un peu plus le besoin de défilement (adressé par
  l'axe C).
- **✅ retenu** — c'est un alignement sur un système déjà validé, pas une décision de
  design nouvelle à trancher.

### D2 — Nouvelle échelle typographique spécifique au Lab (mode « dense »)
Définir un jeu de tailles propre au Lab (ex. 11px accepté comme un palier officiel
supplémentaire, documenté), au motif que c'est un outil scientifique dense par nature.

- **Forces** : reconnaît que le Lab affiche structurellement plus de chiffres/colonnes
  que les autres pages, un besoin réel de densité.
- **Faiblesses** : introduit une DEUXIÈME échelle typographique dans le produit, exactement
  ce que `docs/pactiva/charte-graphique.md` existe pour éviter — un système de design a
  de la valeur seulement s'il n'a pas d'exception locale par module. Chaque futur audit
  UI devrait alors vérifier « est-ce une page normale ou une page Lab » avant de juger
  une taille de police.
- **Écarté** — la densité d'un tableau doit se gérer par la mise en page (colonnes,
  `overflow-x-auto`, vue carte), pas en abaissant le plancher de lisibilité en dessous
  de ce que le reste du produit juge acceptable.

---

## Axe E — Écart architectural avec Gold/atelier (§2.7)

### E1 — Migration complète vers `react-query` + extraction des helpers de style, dans ce lot
Réécrire `RunList`/`RunResults`/`ComputeSettings` pour consommer `useQuery`/`useMutation`
au lieu de `useEffect`+`useState`+`setInterval` manuels, à l'image de Gold.

- **Forces** : cohérence totale avec le reste du produit, retry/cache/stale-time
  gratuits, code plus court à terme.
- **Faiblesses** : touche la logique de récupération de données de TROIS composants
  déjà couverts par des tests fonctionnels existants (polling, dédup, annulation) — le
  risque de régression comportementale (ex. cassage du sondage des runs actifs, déjà
  une fois source d'un bug de boucle documenté dans le code même :
  « un mock à usage unique a révélé » une boucle infinie potentielle) est réel et sans
  rapport avec la plainte UI/UX initiale de l'utilisateur.
- **Écarté pour ce lot** — c'est un refactor de fond, à mener pour lui-même avec sa
  propre revue, pas à la faveur d'un audit visuel. Backlog, phase 3.

### E2 — Ne toucher que ce qui est visuellement observable dans ce lot ; documenter le reste
Limiter l'exécution de ce lot aux points A/B/C/D (correctifs visuels/structurels
observables, testables, à faible risque) ; documenter précisément E1 et le reste du
§2.7 comme travail de fond futur, sans l'exécuter aujourd'hui.

- **Forces** : chaque changement de ce lot est petit, testé, review-able
  indépendamment ; le tout reste déployable en une fois sans mélanger refactor de fond
  et correctif utilisateur. Correspond au principe *no half-finished implementations* :
  on ne commence pas une migration react-query qu'on ne peut pas honnêtement terminer,
  tester et déployer dans la même session.
- **Faiblesses** : le Lab restera, après ce lot, en dessous du niveau de finition de
  Gold sur l'axe architectural (pas seulement visuel) — un prochain audit y retrouvera
  les mêmes findings s'il n'est pas repris.
- **✅ retenu** — c'est le choix qui correspond au périmètre réellement exécutable et
  testable dans une seule session, sans sacrifier la rigueur des tests sur l'autel de
  l'exhaustivité.

---

## Synthèse des choix retenus

| Axe | Solution retenue | Exécutée dans ce lot |
|---|---|---|
| A — Sidebar | A2, tiroir mobile hors-flux | ✅ |
| B — Fil d'Ariane | B1, cas par cas + détection UUID générique | ✅ |
| C — Tableaux | C1, `overflow-x-auto` | ✅ |
| D — Typographie | D1, remontée à `text-xs` | ✅ |
| E — Architecture | E2, documenter sans exécuter | Backlog (phase 3) |
