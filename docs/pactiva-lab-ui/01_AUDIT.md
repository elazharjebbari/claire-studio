# Audit UI/UX — Pactiva Lab

**Périmètre** : les deux routes du module Lab — `/projects/[slug]/lab` (3 écrans à
onglets : Jeux de données, Expériences, Calcul) et `/projects/[slug]/lab/runs/[id]`
(détail d'un run) — soit 8 fichiers `.tsx` dans `frontend/src/features/lab/`, plus le
chrome applicatif global (`AppShell`, `Sidebar`, `TopBar`, `Breadcrumbs`) dont le Lab
hérite comme toutes les autres pages.

**Déclencheur** : retour utilisateur du 14 août 2026 sur
`https://pactiva.legal/projects/campagne-pactiva/lab/runs/754a17a3-71a7-4c75-8dac-805c0148aecc`
— « UI/UX très très faible, responsivité limitée, pas très lisible, pas bien présenté ».

**Méthode** : lecture exhaustive du code (fichier par fichier, ligne par ligne) +
inspection visuelle en direct sur la prod réelle, connecté avec un vrai compte, à trois
largeurs d'écran (375px mobile, 768px tablette, 1440px desktop), via Playwright piloté
par script. Chaque finding ci-dessous est sourcé — fichier + ligne, ou capture d'écran.
Un artefact suspect (une zone noire géante sur une première capture) a été
**contre-vérifié avant d'être retenu** : il s'est révélé être une limite de l'outil de
capture (zone de défilement imbriquée dans `<main overflow-auto>`, non un bug de
l'application) et a été écarté des findings — voir §5.

---

## 1. Ce qui a été vérifié et n'est PAS en cause

Avant la liste des problèmes, ce qui a été audité et s'est révélé **conforme** :

- **Couleurs / contraste** : zéro classe Tailwind « en dur » (`bg-gray-500` etc.) dans
  tout le module. Toutes les couleurs passent par les tokens sémantiques
  (`text-ink`, `bg-panel`, `border-line`, `text-danger`…) définis dans
  `globals.css`/`tailwind.config.ts`. Le Lab suit le design system sur cet axe.
- **Icônes** : `lucide-react`, tailles cohérentes avec la charte (`docs/pactiva/charte-graphique.md`).
- **Largeur du contenu sur grand écran** : contrairement à une première impression liée
  à l'artefact de capture (§5), le contenu utilise réellement ~82 % de la largeur
  disponible (1184px sur 1440px) — ce n'est pas un problème de largeur figée.

Le problème n'est donc **pas** un système de couleurs incohérent ni une largeur de
contenu artificiellement réduite. Il est structurel : absence quasi totale de
comportement responsive, densité typographique sous le seuil documenté, et deux bugs
fonctionnels concrets (chevauchement de texte, lien mort).

---

## 2. Findings

### 2.1 — CRITIQUE. La sidebar applicative ne devient jamais responsive, à aucune page

**Portée : globale**, pas spécifique au Lab — mais c'est ce qui rend la page de run
citée par l'utilisateur illisible sur mobile, donc le point d'entrée logique de l'audit.

`frontend/src/components/shell/Sidebar.tsx` (avant correctif) : la nav est un enfant
`flex` normal, largeur fixe `w-56` (224px) déplié / `w-14` (56px) replié — **à toute
taille d'écran**. Aucun point de rupture Tailwind (`md:`, `lg:`…), aucune détection de
viewport, aucun mode tiroir.

Capture prod, 375px de large (mobile), page de run citée par l'utilisateur :

- la sidebar occupe l'écran presque en entier ;
- la colonne de contenu restante fait ~170px ;
- **deux valeurs de métrique se chevauchent visuellement** : « 0.464 » (MACRO-F1) et
  « 0.550 » (MICRO-F1) se superposent au même endroit — un texte illisible, pas
  seulement « serré ».

À 768px (tablette), même symptôme en moins sévère : le fil d'Ariane est tronqué au
point d'être incompréhensible (« Accue › Pro › Campagne d'annota › l… › ru… ›
754a17a3-71a7-4c75-8d… »).

C'est la cause racine dominante de la plainte utilisateur : ce n'est pas que le Lab
soit mal conçu en particulier, c'est que **rien dans l'app n'a de repli mobile pour la
navigation primaire** — le Lab n'a simplement pas assez de largeur résiduelle pour
absorber ce manque, contrairement à des pages avec moins de densité d'information.

### 2.2 — CRITIQUE (bug fonctionnel réel). Fil d'Ariane cassé sur toute page `/lab/runs/[id]`

Deux défauts cumulés dans `frontend/src/components/shell/Breadcrumbs.tsx` :

**a) Libellés bruts.** `LABELS` (une table `Record<string,string>`, ligne 27) ne
contenait ni `"lab"` ni `"runs"` — ces segments s'affichaient donc en minuscules brutes
au lieu d'un libellé lisible, alors que le mécanisme existe déjà et est utilisé pour
d'autres sections (`gold: "Résolution GOLD"`). Le dernier segment (l'UUID du run)
s'affichait **en entier**, 36 caractères, dans une barre de 36px de haut.

**b) Lien mort → 404 systématique.** Le fichier documente déjà exactement cette classe
de bug pour un cas antérieur : « Segments qui n'existent QUE sous forme dynamique
(ex. /history/[id]) : pas de page d'index. Le fil d'Ariane ne doit donc PAS générer de
`<Link>` vers eux, sinon Next.js préfetch `/history?_rsc=…` → 404. » — avec un `Set`
dédié, `NO_INDEX_SEGMENTS`, contenant `"history"`. **`"runs"` n'y avait jamais été
ajouté**, alors que `/projects/[slug]/lab/runs` (sans id) n'existe pas — seules
`/lab` et `/lab/runs/[id]` existent (confirmé par recherche exhaustive des fichiers
`page.tsx`). Résultat, capturé en direct sur la vraie session prod (log réseau) :
```
[requestfailed] https://pactiva.legal/projects/campagne-pactiva/lab/runs?_rsc=… net::ERR_ABORTED
[http 404]       https://pactiva.legal/projects/campagne-pactiva/lab/runs?_rsc=…
```
Ce 404 se reproduit à **chaque** chargement de la page de run, silencieusement (aucune
erreur visible pour l'utilisateur, juste du bruit réseau et une requête gâchée) — un
pattern que le code lui-même identifie comme un bug quand il apparaît, mais qui n'avait
pas été appliqué à ce cas précis.

### 2.3 — Absence quasi totale de comportement responsive dans le module Lab

Sur 2371 lignes de code réparties dans 8 fichiers `features/lab/*.tsx`, **3 occurrences
seulement** d'un point de rupture Tailwind (`sm:`/`lg:`) :
- `DatasetBuilder.tsx:100` — `grid gap-4 lg:grid-cols-[320px_1fr]`
- `DatasetBuilder.tsx:209` — `grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4`
- `RunResults.tsx:110` — `grid grid-cols-2 gap-3 sm:grid-cols-4`

`LabWorkspace.tsx`, `RunList.tsx`, `ExperimentLauncher.tsx`, `ComputeSettings.tsx`,
`charts.tsx` : **zéro** point de rupture. Tous les layouts y sont des `flex`/`table`
sans variante par taille d'écran.

### 2.4 — Tableaux non protégés contre le débordement horizontal

5 tableaux `<table>` dans le module ; avant correctif, **4 sur 5** n'avaient aucun
conteneur `overflow-x-auto` (seul le tableau des clusters GPU dans
`ExperimentLauncher.tsx:361` en avait un) :
- `RunList.tsx` (liste des runs)
- `LabWorkspace.tsx` (jeux de données)
- `RunResults.tsx` (détail par pli — **nombre de colonnes dynamique**,
  `Object.keys(run.metrics.perFold[0])`, peut dépasser toute largeur d'écran sans
  aucun garde-fou)
- `DatasetBuilder.tsx` (documents écartés)

Sur mobile/tablette, ces tableaux débordaient silencieusement la largeur disponible.

### 2.5 — Typographie sous le seuil documenté par la charte graphique

`docs/pactiva/charte-graphique.md` (ligne 125) définit l'échelle officielle en
commençant à **`xs = 0.75rem` (12px)** — c'est le plancher documenté, aucune taille
en dessous n'est prévue. Avant correctif, le module Lab utilisait massivement des
tailles arbitraires **hors échelle** :

```
18× text-[11px]   (sous le plancher documenté)
17× text-[10px]   (sous le plancher documenté)
```
soit 35 occurrences sur ~90 classes de taille de texte du module — labels de champ,
messages d'erreur, hints, en-têtes de tableau, cellules KPI. Le SVG des graphiques
descend même à `fontSize={8}` pour les compteurs de la matrice de confusion
(`charts.tsx:230`) — hors du champ de cet audit (dimensionnement intrinsèque au SVG,
non une classe Tailwind), documenté ici pour mémoire, traité en backlog (§ plan
d'action, phase 3).

### 2.6 — L'équivalent tableau accessible de la matrice de confusion est structurellement inutilisable s'il est affiché

`charts.tsx`, `ConfusionMatrixFigure` — l'équivalent tabulaire (servant à la fois de
version lecteur d'écran et d'export CSV, principe documenté dans `Figure.tsx`) est
construit ainsi :
```ts
const rows = labels.flatMap((trueLabel, i) =>
  labels.map((predLabel, j) => ({ trueLabel, predLabel, count: matrix?.matrix[i]?.[j] ?? 0 }))
).filter((r) => r.count > 0);
```
Pour 20 classes, cela génère une **liste plate de 3 colonnes** (Vérité / Prédit / n)
avec potentiellement 150 à 250+ lignes, au lieu d'une grille 20×20. Mesuré en direct
sur la vraie page (matrice réelle, 20 thèmes) : le `<table>` correspondant fait **7574px
de haut pour 379px de large**. Par défaut il est `sr-only` (invisible, seulement pour
lecteur d'écran) donc **aucun utilisateur voyant n'est affecté aujourd'hui** — mais le
bouton « Afficher le tableau » (icône `Table2`, visible dans l'UI) existe précisément
pour le rendre visible, et le rendrait alors inutilisable. Non corrigé dans ce lot
(nécessite de repenser la structure de données de l'équivalent tabulaire, pas une
correction mécanique) — documenté en backlog.

### 2.7 — Écart de maturité architecturale avec les modules plus récents (Gold, atelier)

| Axe | Lab | Gold | Atelier d'annotation |
|---|---|---|---|
| Récupération de données | `useEffect`+`useState` manuel, y compris un `setInterval` de sondage réimplémenté à la main (`RunList.tsx:89-93`) | `@tanstack/react-query` (`useQuery`/`useMutation`, `lib/api/hooks.ts`) | idem react-query |
| État/style extrait | Non : `STATUS_META` inline dans `RunList.tsx:28-49` | Oui : `lib/gold/styling.ts`, `lib/gold/cockpit.ts` | Hooks dédiés (`useShortcuts`, `useAutosave`…) |
| Cellule KPI | `<dt>/<dd>` nu, `text-lg` max | `Panel` + `text-2xl` (`GoldCockpit.tsx:22-30`) | — |
| Colonne de lecture | Aucune (`max-w-reading`/`leading-reading`, définis dans `tailwind.config.ts`, jamais utilisés dans Lab) | — | Utilisée (`DocumentPanel.tsx`) |

Le Lab est le module le plus récent du produit (en-têtes de fichiers renvoyant
systématiquement vers `docs/pactiva-lab/*`/`docs/pactiva-g5k/*`, des specs très
orientées logique scientifique/métier qui ne mentionnent jamais layout/responsive). Il
n'a simplement pas encore reçu le second passage d'industrialisation visuelle qu'ont eu
Gold et l'atelier.

### 2.8 — Zéro couverture de test sur l'aspect visuel/responsive

4 fichiers de test touchent le Lab (`lab.test.tsx`, `labResults.test.tsx`,
`experimentLauncher.test.tsx`, plus `runs.test.ts` qui, malgré son nom, teste un
concept homonyme sans rapport). Tous couvrent la logique métier et l'accessibilité de
base (rôles ARIA). **Aucun ne teste une largeur d'écran, une troncature, ou une mise en
page.** C'est directement ce qui a permis à ces régressions de passer inaperçues —
d'où l'exigence de tests dédiés dans le plan d'exécution, pas seulement des
correctifs visuels.

---

## 3. Ce qui a été corrigé dans ce lot (voir `03_PLAN_ACTION.md` pour le détail)

- §2.1 — sidebar → tiroir mobile hors-flux sous `md` (768px), fermé par défaut, jamais
  persisté, testé (8 tests, `mobileNav.test.tsx`).
- §2.2 — labels « Lab »/« Expériences », UUID raccourci, lien mort supprimé (6 tests,
  `breadcrumbs.test.tsx`).
- §2.4 — les 4 tableaux non protégés enveloppés dans `overflow-x-auto`.
- §2.5 — les 35 occurrences `text-[10px]`/`text-[11px]` remontées à `text-xs` (12px),
  au plancher documenté.

## 4. Ce qui reste en backlog (non traité dans ce lot, scope documenté §3 de `03_PLAN_ACTION.md`)

- §2.3 — grilles responsive dédiées pour `LabWorkspace`/`RunList`/`ExperimentLauncher`
  (au-delà du strict nécessaire pour rendre la page utilisable, une vraie refonte de
  layout par point de rupture).
- §2.6 — équivalent tabulaire de la matrice de confusion (pivot en grille réelle).
- §2.7 — migration `RunList`/`RunResults` vers `react-query`, extraction de
  `STATUS_META`, alignement des cellules KPI sur le pattern Gold.
- Normalisation de l'espacement des cellules de tableau (4 valeurs différentes
  relevées pour un même usage : `py-1`, `py-1.5`, `px-3 py-1`, `py-0.5`).

## 5. Note méthodologique — un faux positif écarté

Une première capture plein-écran (Playwright, `fullPage: true`) de la page de run à
1440px montrait un contenu très court suivi d'un immense vide noir (~3000px). Avant de
l'inscrire comme finding, vérification par mesure directe du DOM
(`document.querySelector("main").scrollHeight`) et par log réseau/console : **aucune
erreur JavaScript, aucun échec de requête sur cette page précise**, et la hauteur réelle
du contenu (3701px) correspond exactement à la somme des éléments réels (carte KPI +
deux figures SVG ~1200px chacune + matrice de confusion). La zone « vide » de la
capture était un artefact connu de Playwright/Chromium : la capture plein-page suit
`document.body`, alors que le défilement réel se produit dans un `<main
overflow-auto>` imbriqué (pattern app-shell classique) — l'outil ne capture pas
correctement ce cas. **Corrigé dans le script de diagnostic avant d'écrire cet audit**,
pour ne pas remonter un bug qui n'existe pas. La vraie mesure (3701px de contenu pour
afficher le résumé d'un seul run) reste notée en §2.3/backlog comme un vrai problème de
densité — deux figures carrées ~1200px chacune — mais pas comme un « bug d'espace mort ».
