# Démarrage

## Connexion

En mode données réelles, l'application demande une authentification (JWT). Les
identifiants de démonstration sont :

- **Utilisateur** : `alice`
- **Mot de passe** : `claire-demo`

Selon la configuration, un auto-login dev peut vous connecter automatiquement au
démarrage. Sinon, passez par la page `/login`.

## Navigation

La navigation suit la règle « 3 zones, profondeur ≤ 3 clics » :

- **Barre latérale gauche** (repliable) : navigation contextuelle au projet
  (Tableau de bord, Documents, Mes projets, Comparer, Préférences).
- **Top bar** : sélecteur de projet, recherche globale (palette `⌘K`), bascule
  de thème clair/sombre, cloche d'activité, menu utilisateur et accès à l'**Aide**.
- **Zone admin** (`/admin`) : pilotage des corpus, schémas, campagnes, exports.

## Modes de données

CLAIRE Studio fonctionne dans deux modes :

| Mode | Réglage | Comportement |
|---|---|---|
| **Données réelles** | `NEXT_PUBLIC_ENABLE_MOCKS=false` | L'app parle à l'API Django (JWT requis). |
| **Démo / mock** | `NEXT_PUBLIC_ENABLE_MOCKS=true` | UI autonome via MSW, sans backend ni authentification. |

Le mode démo sert à explorer l'interface sans serveur. Le mode réel exige une
connexion et des permissions selon votre rôle.
