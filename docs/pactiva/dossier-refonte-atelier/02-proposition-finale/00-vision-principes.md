# Proposition finale — vision & principes

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
