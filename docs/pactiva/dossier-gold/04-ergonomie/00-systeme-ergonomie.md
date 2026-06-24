# Système d'ergonomie « de tonnerre »

SYSTÈME D'ERGONOMIE — « de tonnerre », interconnexion totale, clics successifs sans bouger la souris.

1) BUS D'INTERACTION PARTAGÉ (goldStore Zustand, miroir léger de store/workspace.ts)
État central écouté par les trois zones (sidebar GoldOutlinePanel ↔ fil contrat central ↔ InspectorPanel) + la navbar (ConflictNav) :
- selectClause(localId) / focusSentence(start) : canal de SÉLECTION déjà câblé dans le socle, réutilisé tel quel (TocPanel/DocumentPanel/InspectorPanel l'écoutent).
- hoveredConflictId / hoveredOption / activeConflictId : canal de SURVOL bidirectionnel neuf. Survoler une ligne de vote dans l'inspecteur surligne SIMULTANÉMENT la phrase au centre, l'entrée en sidebar et la ligne du classement de concordance. Inversement, survoler un article en sidebar éclaire le cartouche correspondant.
- lockedBy : verrou d'arbitrage exclusif diffusé en temps réel.
Règle : un seul point de vérité de sélection/survol ; aucune zone ne maintient son propre état de focus divergent.

2) CLICS SUCCESSIFS SANS BOUGER LA SOURIS (sticky-cursor)
Réutilisation EXACTE du pattern prouvé en prod (QuickActionRail.onValidateAdvance(index, clientY) + scroll DocumentPanel qui re-parque le bouton suivant au même clientY). Adaptation GOLD :
- L'unité de parcage passe de la PHRASE au BLOC/CARTOUCHE (deriveBlocks) : après adoption d'un vote, le cartouche de conflit suivant remonte exactement sous le curseur via useAnchoredPosition + scroll-margin-top.
- Après résolution : focusSentence(nextConflict.start) ; le bouton primaire « Adopter + suivant » se re-positionne au même clientY ; le focus DOM est re-parqué par une machine de focus centralisée (une seule décide qui a le focus après chaque action).
- Mode Focus tunnel : un seul point d'action à l'écran, toujours au même endroit → vitesse maximale en fin de campagne (purge des accords absolus en rafale).

3) HOVERS RICHES (useAnchoredPosition / placeWithinViewport déjà prêts : flip + clamp viewport + ResizeObserver)
- Carte de vote : survol d'une ligne = carte dense (qui a voté quoi, support, rationale dépliable via RationaleHover, evidence_span surligné, écart au LLM, badge « décision humaine ≠ LLM = signal fort »).
- Sidebar : survol d'une entrée = aperçu votes humains/LLM + sévérité, sans clic.
- Aucun saut ni débordement (flip+clamp) ; les cartes peuvent s'agrandir (rationale) sans repositionnement brutal.

4) NAVIGATION DOUBLE (désaccords ET blocs similaires)
- divergence.ts (divergenceSegments/anchors/next/prev/ordinal, purs et testés) recâblé sur des vecteurs INTER-ANNOTATEURS (au lieu de claude/codex) → saut de BLOC de conflit en bloc de conflit (n/p, compteur k/N).
- j/k : saut entre articles d'accord de même catégorie (suites de phrases regroupées).
- useDivergenceShortcuts étendu : 1..9 = adopter la k-ième option de vote (ordre stable annotateur A/B/… puis LLM), Espace/Entrée = majoritaire pondéré, u = annuler, e = peek evidence, c = compare, garde isEditable + metaKey/ctrlKey.

5) SÉLECTION SYNCHRONISÉE & MÉMOIRE DE CONFIG
- Sélection synchronisée navbar↔centre↔inspecteur via le canal selectClause/focusSentence.
- Mémoire PAR DOCUMENT (nouvelle couche au-dessus de mergeUiPrefs) : replis d'articles, densité, divergences-seules, mode Focus, état des panneaux, sous clé perDoc[documentId] persistée dans User.ui_preferences (camelCase). Mémoire PAR COMPTE (existante) : tri/filtres/colonnes du cockpit, onglet actif.

6) FLUIDITÉ & ANIMATIONS SOBRES
Transitions de disclosure et de re-parcage reprennent la classe de transition des panneaux InspectorPanel existants (durées courtes, easing doux, prefers-reduced-motion respecté). Le scroll de re-parcage est instantané+amorti, jamais une longue animation qui désoriente.

7) TEMPS RÉEL NON INTRUSIF
Verrou diffusé via le WebSocket de présence (group gold_{slug}) : badge « Arbitré par X » (couleur user_color), bandeau read-only si tenu par un autre, bouton Reprendre (steal) pour lead/reviewer. Repli polling REST si WS off. L'arbitre voit l'effet immédiat de ses choix sur la proximité au gold (panneau live) sans bloquer l'UI.