# Plan de navigation — deux sens (aller/retour)

PLAN DE NAVIGATION DEUX SENS (module GOLD) — chaque transition a son ALLER et son RETOUR explicite, avec entrées/sorties et raccourcis. Le module GOLD se greffe sur l'arborescence projet existante (/projects/[slug]) et réutilise le shell d'app.

ÉCRANS DU MODULE
1. Cockpit GOLD — /projects/[slug]/gold (liste docs, KPIs, lots)
2. Onglet Stats — /projects/[slug]/gold/stats (matrices + classement proximité gold)
3. Studio de config — section dépliable de /admin/projects/[slug] (config campagne)
4. Atelier de résolution — /projects/[slug]/gold/[documentId] (cœur arbitrage)
5. Mode Focus (tunnel) — overlay sur l'atelier (toggle, même URL + ?focus=1)
6. Drawer Compare N-way — overlay sur l'atelier (toggle)
7. Modale Export gold — overlay sur le cockpit / depuis GoldBatchBar

ALLER → / ← RETOUR

A) Page projet (docs) ↔ Cockpit GOLD
ALLER: bouton « Résolution GOLD » dans la barre de projet (visible reviewer/lead), data-testid=open-gold ; entrée = slug. Raccourci: g puis o.
RETOUR: fil d'Ariane « Projet ‹ Résolution » cliquable + bouton « Retour au projet » ; conserve filtres cockpit en prefs (pas de perte d'état). Échap depuis cockpit ne quitte pas (réservé aux overlays).

B) Cockpit GOLD ↔ Atelier de résolution
ALLER: clic ligne ou bouton « Arbitrer » data-testid=open-gold-{externalId} ; double-clic = ouverture directe ; raccourci o sur ligne focalisée. Pose le verrou d'arbitrage (acquire). Entrée = documentId + tri/filtre courant mémorisé.
RETOUR: bouton « ‹ Cockpit » + Échap (si aucun overlay ouvert) ; relâche le verrou (release via sendBeacon) ; le cockpit re-scrolle SOUS le curseur sur la ligne quittée (scrollIntoView block:nearest) et la marque visitée. Le % et le statut de la ligne sont rafraîchis (invalidate React Query).

C) Atelier → Atelier (document suivant) — navigation latérale sans repasser par le cockpit
ALLER: « Document suivant non résolu » data-testid=gold-next-doc, raccourci ] ; relâche verrou courant + acquiert le suivant ; le DocumentSwitcher (réutilisé) liste les docs du lot.
RETOUR: « Document précédent » raccourci [ ; même logique de verrou. Le fil d'Ariane reste ancré au lot.

D) Cockpit ↔ Stats
ALLER: onglet segmenté « Liste | Stats » (pattern LangSwitch), data-testid=gold-tab-stats, raccourci s. Pas de changement de contexte projet.
RETOUR: onglet « Liste », raccourci l ; l'onglet actif est mémorisé en prefs par projet.

E) Cockpit / Atelier ↔ Studio de config
ALLER: bouton « Config de campagne » (lead only) → /admin/projects/[slug]#resolution (déplie la section, scrollIntoView). data-testid=open-resolution-config.
RETOUR: bouton « ‹ Revenir au cockpit GOLD » dans la section config ; après save, toast + retour optionnel. Si campagne verrouillée, bandeau read-only + lien retour.

F) Atelier ↔ Drawer Compare N-way (overlay, deux sens dans le même écran)
ALLER: bouton « Comparer (N rails) » data-testid=gold-open-compare, raccourci c ; ouvre ComparePanel réutilisé en drawer latéral droit. Ne perd pas le focus conflit.
RETOUR: Échap ou re-clic c ; rend le focus à la carte de vote précédemment active (focus DOM re-parqué).

G) Atelier ↔ Mode Focus tunnel (overlay, deux sens)
ALLER: toggle « Focus » data-testid=gold-focus-toggle, raccourci f ; bascule en vue un-conflit-à-la-fois ; mémorisé en prefs PAR DOCUMENT.
RETOUR: re-toggle f ou Échap ; revient à la vue contrat 3-panneaux SUR le conflit courant (pas de saut).

H) Cockpit / Atelier ↔ Modale Export gold (overlay, deux sens)
ALLER: « Exporter le gold » (cockpit: GoldBatchBar → scope lot/corpus ; atelier: bouton doc) data-testid=gold-export-open ; ouvre la modale réutilisant le flux ExportJob async.
RETOUR: « Voir mes exports » → page exports existante (nouvelle nav latérale) OU Échap pour fermer et rester. Le job continue en tâche de fond (notification quand prêt).

I) Atelier interne — navigation conflit↔conflit ET bloc↔bloc (sync trois panneaux)
ALLER conflit suivant: n (ConflictNav ◂ k/N ▸, data-testid=gold-conflict-next) → sélectionne le conflit, focusSentence, scroll DocumentPanel SOUS le curseur, met à jour InspectorPanel.
RETOUR conflit précédent: p (gold-conflict-prev), symétrique.
ALLER/RETOUR bloc d'accord: j / k (bloc suivant/précédent de même catégorie). Clic sur entrée de la sidebar (GoldOutlinePanel) = selectClause+focusSentence (canal partagé écouté par les 3 panneaux). Survol d'un vote dans l'inspecteur surligne simultanément la phrase au centre + l'entrée en sidebar (bus d'interaction bidirectionnel).

RACCOURCIS GLOBAUX DU MODULE (gardes isEditable, no-op si saisie)
g o (ouvrir gold), s/l (stats/liste), o (ouvrir doc focalisé), Échap (fermer overlay → sinon remonter), [ ] (doc préc/suiv), n p (conflit ±), j k (bloc ±), 1..9 (adopter k-ième vote), Espace/Entrée (adopter majoritaire pondéré), u (annuler), c (compare), f (focus), e (peek evidence), ? (aide raccourcis, réutilise TriageHelpModal).

INVARIANTS DE NAVIGATION
- Tout ALLER qui pose un verrou a un RETOUR qui le relâche (jamais de verrou orphelin : beforeunload + release explicite + TTL serveur).
- Aucune transition ne perd l'état UI : tri/filtres/onglet en prefs par compte ; replis/densité/focus en prefs PAR DOCUMENT.
- Échap est strictement hiérarchique : ferme l'overlay le plus haut d'abord, ne quitte jamais l'écran tant qu'un overlay est ouvert.
- Le fil d'Ariane (Projet ‹ Résolution ‹ Document) est toujours présent et cliquable dans les deux sens.