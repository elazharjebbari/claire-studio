# Collaboration vs Session — la frontière, point par point

> Cœur de la demande : « le multi‑annotation sert surtout à s'aider/discuter ;
> en vrai chacun annote seul sur SA session ; l'admin visualise l'avancement ;
> cela permet de calculer la concordance entre annotateurs. On doit distinguer
> clairement ce qui relève de la collaboration de ce qui relève de la vraie
> session, pour éviter les ambiguïtés. »

## 1. Deux mondes, une frontière nette

```
        ┌──────────────────────────────┐      ┌──────────────────────────────┐
        │   VRAIE SESSION (référence)   │      │   COLLABORATION (aide)        │
        ├──────────────────────────────┤      ├──────────────────────────────┤
        │ • 1 Annotation par (doc,moi)  │      │ • Commentaires / fils         │
        │ • Mes clauses validées        │      │ • Présence (qui regarde quoi) │
        │ • Mon statut / ma certitude   │      │ • Comparaison N‑way (lecture) │
        │ • Owner‑only en écriture      │      │ • Fantômes / pré‑remplissage  │
        │ • Versionnée à la soumission  │      │   LLM (claude/codex/mistral)  │
        ├──────────────────────────────┤      ├──────────────────────────────┤
        │  COMPTE pour : IAA, export,   │      │  NE COMPTE PAS comme          │
        │  qualité, gold               │      │  référence (INV‑COLLAB)       │
        └──────────────────────────────┘      └──────────────────────────────┘
                       │                                     │
                       └───────────── IAA (concordance) ─────┘
                  κ de Cohen pairwise entre sessions SOUMISES (≥2 annotateurs/doc)
```

## 2. Tableau de décision (qui peut quoi)

| Action | Annotateur (sa session) | Annotateur (session d'un autre) | Admin/Lead (session d'un autre) |
|---|---|---|---|
| Lire le document | ✅ | ✅ | ✅ |
| Lire l'annotation | ✅ | ✅ (lecture seule) | ✅ (lecture seule, supervision) |
| Créer/éditer/supprimer une clause | ✅ | ❌ (403 `IsAnnotationOwner`) | ❌ (403 — intégrité IAA) |
| Soumettre | ✅ | ❌ | ❌ |
| Commenter (collaboration) | ✅ | ✅ | ✅ |
| Voir l'avancement de tous | ❌ | ❌ | ✅ (`annotators-progress`) |
| Comparer N‑way (aide) | ✅ (lecture) | ✅ (lecture) | ✅ (lecture) |

## 3. Garanties techniques (déjà dans le code ou ajoutées)

- **Isolation d'écriture** : `IsAnnotationOwner` (`common/permissions.py`) — aucune
  dérogation de rôle. *Test pytest* : A édite la clause de B → **403**.
- **Ouverture de sa session** : `createAnnotation` → `get_or_create(... annotator=me)`
  (idempotent). *Test* : 2 clics ne créent pas 2 annotations.
- **Lecture seule visible** : `AnnotationWorkspace.isMine` → bannière + store
  `readOnly` + autosave coupé. *Test* : viewer ne déclenche aucun PATCH.
- **Collaboration non‑référence** : les `PreAnnotation`/comparaisons alimentent des
  *overlays* (`ghostClauses`, `compare`) ; seules les `Clause.validated` de MA
  session sont retenues à la soumission/export. *Test* : export d'une session ne
  contient pas les clauses fantômes LLM.
- **Concordance** : `projects/iaa.py` ne lit que les annotations **submitted** ;
  jamais les commentaires ni les pré‑annotations.

## 4. Ce qui était ambigu (avant) → ce qui est clair (après)

| Avant (ambigu) | Après (clair) |
|---|---|
| Documents en triple (1/annotateur) sur la campagne et le sélecteur | 1 ligne par document ; les sessions des autres sont une **dimension** (matrice admin), pas des lignes en double |
| Lien « Annoter » pouvant ouvrir la session d'un autre (lecture seule surprise) | « Annoter » ouvre **toujours MA** session ; voir celle d'un autre passe par un **bouton œil** explicite (admin) |
| Pas de mot pour « session » dans l'UI | Vocabulaire « Ma session » / « Lecture seule » / « Collaboration » partout (cf. `glossaire.md`) |
| Comptes fictifs (« Bruno ») mélangés aux vrais | Membres = vrais membres du projet ; reliquats de démo supprimés |
