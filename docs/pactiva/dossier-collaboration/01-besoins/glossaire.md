# Glossaire — lever toute ambiguïté

Le vocabulaire ci‑dessous est la **source de vérité** partagée par le produit, le
backend, le frontend et les tests. Objectif : qu'un lecteur ne confonde **jamais**
« multi‑annotation pour s'aider » et « vraie session d'annotation ».

| Terme | Définition | Dans le code | Ce que ce N'EST PAS |
|---|---|---|---|
| **Campagne** | Projet d'annotation : un corpus + un schéma + des membres + des assignations. | `Project` (`slug=campagne-pactiva`) | Pas un document, pas une session |
| **Document** | Un texte du corpus (un ToS CLAUDETTE). **Apparaît une seule fois** par campagne. | `Document` (unique `corpus`,`external_id`) | Pas une assignation ; ne doit jamais être « dupliqué » à l'écran |
| **Assignation** | Intention de travail : « cet annotateur **doit** annoter ce document ». | `Assignment` (unique `project,document,assignee`) | Pas la session ; pas le contenu ; optionnelle (on peut annoter sans assignation) |
| **Session d'annotation** | Le travail **réel et isolé** d'**un** annotateur sur **un** document : ses clauses, son statut, sa certitude. **Lui appartient.** | `Annotation` (unique `project,document,annotator`) + ses `Clause` | Pas partagée ; personne d'autre (même admin) n'en édite le contenu |
| **Ma session** | La session **de l'utilisateur courant** (éditable). | `Annotation.annotator == me` (`isMine`) | Pas la session d'un collègue |
| **Lecture seule / Supervision** | Consultation par l'admin/lead de la session **d'un autre** (sans pouvoir l'éditer). | queryset admin + `IsAnnotationOwner` (écriture refusée) | Pas une co‑édition |
| **Concordance (IAA)** | Mesure d'**accord** entre les sessions **soumises** de ≥2 annotateurs sur le **même** document (κ de Cohen pairwise). | `projects/iaa.py` | Pas une fusion ; ne modifie aucune session |
| **Collaboration** | Tout ce qui **aide** les annotateurs à converger : commentaires, présence, comparaison N‑way, fantômes/pré‑remplissage LLM. | `Comment`, `Review`, comparaison, `PreAnnotation` | **Jamais une référence** : n'entre ni dans MA soumission ni dans MON export |
| **Référence (gold)** | Ce qui fait foi pour l'export/qualité : **uniquement** des clauses **validées** par l'annotateur dans **sa** session. | `Clause.validated == true` | Ni une pré‑annotation LLM, ni la session d'un autre, ni un commentaire |

## Règles d'or (invariants métier)

1. **Un document = une ligne** dans toute liste de documents (INV‑DOC‑UNIQUE).
2. **Chacun annote seul** : on ouvre **toujours sa propre** session
   (`createAnnotation`), jamais celle d'un autre par accident.
3. **L'écriture est owner‑only** : ni admin ni reviewer n'éditent la session
   d'autrui (intégrité de la concordance).
4. **La collaboration aide, ne fait pas référence** (INV‑COLLAB) : pré‑annotations,
   comparaisons et sessions tierces sont des **aides** visuelles, jamais des
   données comptées à ma place.
5. **L'admin supervise** : il voit l'avancement et peut **lire** chaque session,
   mais la frontière « lecture » / « édition » est toujours **affichée**.
