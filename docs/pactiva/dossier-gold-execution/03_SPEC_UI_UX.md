# 03 — Spécification UI/UX de l'arbitrage

> Objectif chiffré : faire passer le coût d'un cas manuel de **~6 actions souris +
> recherche visuelle** à **1 à 2 frappes clavier**, sans jamais permettre une décision
> ambiguë ou irréversible par accident.

## 1. Le parcours cible d'un arbitre

```
  Cockpit                     Atelier                            Fin
  ───────                     ───────                            ───
  « 462 cas manuels           [n] → cas manuel suivant           toutes décidées
    sur 49 documents »   ──►  lire la phrase + les 3 votes  ──►  « Soumettre »
  trier par cas manuels       [1..9] adopter un vote             → gold figé
  ouvrir un document          [Entrée] adopter la proposition
                              [s] éditer les secondaires
                              [u] annuler la dernière
```

Règle d'or : **l'arbitre ne doit jamais avoir à chercher où est le travail.** À
l'ouverture d'un document, la sélection se pose sur le **premier cas manuel**, pas sur
la première phrase.

## 2. Raccourcis clavier — conformes à la spécification d'origine

Repris tels quels de `docs/pactiva/dossier-gold/02-navigation/02-raccourcis.csv`
(aucune invention de convention) :

| Touche | Action | Garde |
|---|---|---|
| `n` / `p` | cas **manuel** suivant / précédent | — |
| `1`…`9` | adopter le k-ième candidat (ordre affiché, numéroté à l'écran) | verrou détenu |
| `Entrée` | adopter la proposition du moteur | verrou détenu + proposition non vide |
| `u` | annuler la dernière décision de la session | verrou détenu |
| `s` | ouvrir l'édition des secondaires | verrou détenu |
| `?` | aide des raccourcis | — |
| `Échap` | fermer l'overlay ouvert | — |

Garde-fous d'implémentation :

- **Jamais de capture** quand le focus est dans un `input`, `textarea` ou un élément
  `contenteditable` (sinon taper un commentaire déclencherait des décisions).
- Les touches sont **inertes** si le verrou n'est pas détenu — même condition que les
  boutons (`canDecide`), aucune divergence possible entre les deux chemins.
- Chaque raccourci a **un équivalent souris visible** : le clavier accélère, il ne
  cache rien.
- Les numéros `1..9` sont **affichés** sur les candidats (pastille), sinon le raccourci
  est un savoir caché.

## 3. L'inspecteur — les trois manques comblés

### 3.1 Choisir un thème hors candidats

Aujourd'hui, seuls les thèmes proposés par les annotateurs sont cliquables. Ajout d'un
sélecteur **« Autre thème… »** listant tout le schéma (20 thèmes), recherche au clavier,
visuellement **distinct** des candidats (bordure discontinue) pour que l'arbitre voie
qu'il sort du vote.

Rationnel : sur un cas 1-1-1, les trois annotateurs peuvent tous se tromper ; sans
cette porte de sortie, l'arbitre est contraint de choisir une réponse qu'il sait fausse.

### 3.2 Décider les secondaires

Bloc **« Secondaires »** sous le primaire, pré-rempli avec la proposition du moteur,
avec pour chaque secondaire candidat (union des secondaires des trois annotateurs) une
puce activable/désactivable, plus l'accès au schéma complet.

Contraintes reprises du backend (`decide_sentence`) et appliquées **côté UI** pour
éviter un aller-retour en erreur :
- un secondaire ne peut pas être égal au primaire (retiré automatiquement) ;
- un thème-refuge (`PREAMBLE_SCOPE`, `MISC_BOILERPLATE`) ne peut pas être secondaire
  (puce désactivée, avec l'explication au survol).

Affichage systématique de **qui a proposé quoi** : sans cette information, l'arbitre
décide à l'aveugle.

### 3.3 Commenter une décision

Champ de commentaire **optionnel**, replié par défaut (ouvert par `c` ou au clic),
envoyé dans `payload.comment` — déjà supporté par l'API et stocké dans
`ArbitrationEvent.note`. C'est la trace qui rendra les choix défendables dans l'article.

## 4. Progression : compter ce qui reste **à faire à la main**

| Emplacement | Aujourd'hui | Cible |
|---|---|---|
| Plan (gauche) | décidées / conflits / à faire | + **cas manuels restants** (le compteur qui compte) |
| Filtres | tout · conflits · non décidées | + **« manuels »**, sélectionné par défaut à l'ouverture |
| Barre d'outils | « 42 % résolu » | + « **17 cas manuels restants** » |
| Cockpit | strict · majorité · divergence | + colonne **manuels**, triable |

Nuance à conserver : « conflit » (`agreementClass ≠ strict`) et « manuel »
(`autoLevel = manual`) sont deux notions **différentes** ; on ajoute la seconde sans
retirer la première, et l'aide explique l'écart.

## 5. Annulation (`u`) — filet de sécurité

- Pile d'annulation **en mémoire de session** (dernières 20 décisions).
- `u` restaure l'état **moteur** de la phrase (non décidée, proposition recalculée) via
  un appel serveur explicite et tracé — jamais une simple mutation locale.
- Bornes assumées et affichées : l'annulation ne traverse pas un rafraîchissement de
  page (la trace, elle, reste dans `ArbitrationEvent`).

## 6. États d'erreur — dire ce qui se passe

| Situation | Aujourd'hui | Cible |
|---|---|---|
| Annotations incomplètes | « 2/3 annotateurs ont soumis » | « **jc.lamirel** n'a pas soumis » + lien vers la config (lead/admin) |
| Verrou tenu par un autre | bandeau correct | inchangé (déjà bon) |
| Verrou perdu en cours | message dans le hook, **non affiché** | bandeau d'alerte + bouton « Reprendre la main » |
| Décision refusée (409/423) | avance optimiste annulée en silence | **message explicite** + la phrase reprend le focus |
| Projet gelé | 423 | bandeau « projet gelé par un administrateur » |

Principe : **aucune erreur silencieuse**. Chaque refus serveur doit produire une phrase
lisible à l'écran ; c'est ce qui manquait pour diagnostiquer le blocage actuel.

## 7. Prévention de l'erreur humaine

1. **Pas de décision par inadvertance** : les raccourcis n'agissent que sur la phrase
   **sélectionnée**, qui est toujours mise en évidence visuellement.
2. **La décision est visible après coup** : thème gold, auteur, et (nouveau) le
   commentaire ; une phrase déjà décidée affiche clairement qu'un nouveau clic la
   **remplace** (verbe `override` déjà tracé côté serveur).
3. **La finalisation est un acte séparé** : bouton distinct, actif seulement quand tout
   est décidé, avec un récapitulatif avant confirmation (« 462 décisions dont 13
   arbitrages manuels — figer ce gold ? »).
4. **Rien n'est irréversible** : `reopen` (lead/admin) reste le dégel officiel.

## 8. Accessibilité

- Toute action clavier a un rôle ARIA et un nom accessible sur son équivalent bouton.
- Le compteur de cas restants est une région `aria-live="polite"` (annonce la
  progression sans voler le focus).
- Les pastilles de raccourci sont `aria-hidden` (décoratives), l'information étant déjà
  portée par le `aria-label` du bouton.
- Conservation de la règle maison : icônes non textuelles pour les statuts (contraste
  non-texte 3:1), jamais de micro-libellés colorés.
