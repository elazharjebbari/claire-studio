# Proposition finale — « Loupe d'injustice » CLAUDETTE

> Synthèse unifiée et argumentée des recommandations de `01_etude_options_design.md`.
> Le composant proposé s'appelle **InjusticeLens** (« loupe d'injustice »).

---

## 1. Vision

Sur une phrase marquée injuste par CLAUDETTE, l'annotateur doit comprendre **en un coup
d'œil puis en profondeur** : *quoi* (quelles injustices), *combien grave* (sévérité), *ce
que ça veut dire* (définition), *où c'est* (évidence surlignée), et *comment ça se relie à
sa propre segmentation* (thème). Le tout sans jamais gêner l'annotation, dans un objet
élégant, sobre et pro, fidèle à la donnée (granularité phrase).

Deux temps :
- **Aperçu** (survol ~350 ms) : tooltip passif, l'essentiel (sévérité dominante + catégories).
- **Fiche** (clic/clavier sur la marque) : panneau épinglé, **complet**, lisible, scrollable.

---

## 2. Anatomie de la fiche (mode épinglé = complet)

```
┌────────────────────────────────────────────────────────────┐
│ ⚖  CLAUSE POTENTIELLEMENT INJUSTE              [overlay] ✕  │  ← en-tête
│ 2 catégories · sévérité max : ● ● ● Clairement injuste      │     (synthèse)
├────────────────────────────────────────────────────────────┤
│ ▮ LTD  Limitation de responsabilité      ▲ N3  ● ● ●        │  ← carte catégorie 1
│   « Clause qui limite/exclut la responsabilité du           │     (la plus sévère)
│     fournisseur. »                                          │
│   Thème associé : Limitation de responsabilité · Exclusion  │
│                   de garantie            (indicatif)        │
├────────────────────────────────────────────────────────────┤
│ ▮ A  Arbitrage                            ⚠ N2  ● ● ○        │  ← carte catégorie 2
│   « Clause qui impose l'arbitrage (renonce au tribunal). »  │
│   Thème associé : Arbitrage & litiges       (indicatif)     │
├────────────────────────────────────────────────────────────┤
│ ÉVIDENCE (phrase marquée)                                   │  ← évidence
│ ┃ « …shall not be liable… and you agree to binding         │     phrase surlignée
│ ┃   arbitration… »   ·  repère indicatif souligné           │     + repère pointillé
├────────────────────────────────────────────────────────────┤
│ ⓘ La catégorie d'injustice (overlay CLAUDETTE) est distincte│  ← rappel pédagogique
│   de votre thème de segmentation. Les deux coexistent.      │
└────────────────────────────────────────────────────────────┘
```

### Sections (ordre fixe)
1. **En-tête** : icône `Scale`, titre « Clause potentiellement injuste », pastille
   « overlay » (rappel : donnée de référence, pas votre annotation), bouton ✕ (mode épinglé).
   Sous-titre : compteur de catégories + **sévérité maximale** (jauge ●●● + libellé + glyphe).
2. **Cartes catégorie** (1 par catégorie, **triées par niveau ↓**). Chaque carte :
   - puce de couleur **catégorie** (token) + **code** (LTD/A…) + libellé complet ;
   - **badge de sévérité** : glyphe (ShieldCheck/AlertTriangle/ShieldAlert) + « N1/N2/N3 » +
     libellé + **jauge ●●●**, teinté échelle sémantique (vert→ambre→rouge) ;
   - **sens** « Clause qui… » (définition de la catégorie) ;
   - **correspondance thématique** indicative (libellés des thèmes liés) + tag « indicatif ».
3. **Évidence** : la phrase marquée **citée et surlignée** (jaune/ambre doux), avec
   **repère indicatif** (mots-clés de catégorie soulignés pointillé) si détecté ; libellé
   « repère indicatif, non vérifié ».
4. **Rappel pédagogique** : « catégorie d'injustice ≠ votre thème ».

### Mode aperçu (survol)
Réduit : en-tête (sévérité max) + la/les puces de catégorie + « cliquez pour les détails ».
`pointer-events-none`. S'efface au `mouseleave`.

---

## 3. Surlignage de l'évidence (option C — hybride honnête)

- **Phrase = évidence** : en survol/épinglage d'une marque, la phrase concernée est
  surlignée en **ambre doux** (`bg-amber-300/15` clair / adapté sombre), liseré gauche
  ambre — visuellement **distinct** de l'overlay permanent (teinte de catégorie + souligné).
- **Repère indicatif** : un moteur pur `injusticeKeywords(category)` souligne (pointillé
  ambre) les tournures typiques trouvées dans la phrase. **Toujours étiqueté « indicatif,
  non vérifié »**. Si rien ne matche → seule la phrase est surlignée (dégradation propre).
- Le surlignage jaune n'est actif **que** pendant le survol/épinglage (transitoire), jamais
  en permanence → aucune collision avec l'overlay de catégorie.

---

## 4. Multi-catégories

Le hook est corrigé pour **conserver toutes les marques** d'une phrase (tableau trié par
niveau ↓). La fiche liste **une carte par catégorie**. L'en-tête agrège (compteur +
sévérité max). Aperçu : montre la dominante + « +N ».

---

## 5. Système couleur + sévérité (charte-safe)

| Dimension | Encodage | Daltonisme |
|---|---|---|
| **Catégorie** (quoi) | puce couleur token `getUnfairnessToken(cat).color` + **code texte** | code lisible |
| **Sévérité** (combien grave) | échelle sémantique vert(N1)→ambre(N2)→rouge(N3) + **glyphe** + **libellé** + **jauge ●●●** | glyphe + libellé + jauge |
| **Évidence** | surlignage **ambre** (neutre vs catégories) | distinct par position (citation) |

- **Zéro hex en dur** : `getUnfairnessToken`, `getUnfairnessLevel`, classes sémantiques
  (`text-emerald-*`/`amber-*`/`rose-*` ou tokens `success/warning/danger`), `readableTextColor`
  pour le texte sur badges pleins.
- Surface `bg-elevated`, bordures `border-line`, ombres `shadow-xl`/`shadow-2xl`.
- Distinction « famille injustice » vs « famille thème » : la fiche n'emploie la couleur de
  **thème** que dans la ligne « correspondance », précédée du mot « Thème » — jamais en
  conflit visuel avec les badges d'injustice.

---

## 6. Animations (sobres, pro)

- Apparition : `animate-fade-in` (fade + translateY 2px, 120 ms).
- Lien marque↔fiche : **ring ambre** subtil sur la marque survolée (`ring-1 ring-amber-300/50`),
  `transition-colors`.
- Onglets/cartes : `transition-colors`. Pas de pulse permanent. Tout neutralisé sous
  `prefers-reduced-motion` (global).

---

## 7. Accessibilité & ergonomie

- **Aperçu** : `role="tooltip"`, `pointer-events-none`, lié par `aria-describedby`.
- **Fiche épinglée** : `role="dialog"` `aria-modal` `aria-label`, focus initial, **Échap** +
  **clic-extérieur**, fermable au ✕.
- **Clavier** : la marque d'injustice devient `tabIndex=0`, `aria-haspopup="dialog"`,
  `cursor-help` ; **Entrée/Espace** épingle la fiche.
- **Non-intrusif** : le survol n'altère ni la sélection, ni le long-press, ni l'annotation
  (déclencheur = la **marque**, pas la phrase ; aperçu sans pointer-events).
- **Scope** : actif uniquement sur les phrases marquées ; si l'overlay injustice est
  désactivé (`showUnfairness=false`), pas de marque → pas de loupe.

---

## 8. Points de vigilance / arbitrages

1. **Honnêteté épistémique** : le repère intra-phrase est *indicatif* et doit être visuellement
   ET textuellement marqué comme tel (sinon l'annotateur croit à une vérité terrain). Décision :
   étiquette explicite + style « pointillé » distinct du surlignage « vérité » plein.
2. **Conflit hover** : sur une phrase à la fois annotée ET marquée injuste, deux hovers
   possibles (RationaleHover vs InjusticeLens). Décision : sur une phrase **marquée**, la
   loupe d'injustice **prime** au survol de la marque ; le RationaleHover reste sur le reste.
3. **Perf** : la correspondance mots-clés est O(longueur de phrase) au survol uniquement
   (lazy), mémoïsée par phrase — négligeable.
4. **Évolutivité** : si un jour CLAUDETTE fournit des offsets d'évidence, le composant accepte
   déjà un `evidenceSpan` optionnel (le repère deviendra vérité terrain sans refonte UI).

---

## 9. Décision GO

Proposition validée pour mise en œuvre. Détails techniques (data/archi/dev/tests) :
`03_dossier_technique.md`. Plan d'exécution : `04_runbook_execution.md`.
