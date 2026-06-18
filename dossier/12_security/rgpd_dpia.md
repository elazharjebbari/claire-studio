# RGPD & analyse d'impact (DPIA légère)

> Périmètre : données personnelles des **annotateurs/reviewers** (le corpus CLAUDETTE est public, sans
> PII). Aligné minimisation/pseudonymisation (`07_collaboration_versioning/collaboration.md` §4,
> `11_tracking_observability/tracking.md`) et rétention (`10_quality_certainty_comments/archival.md`).

## 1. Cartographie des données personnelles

CLAIRE ne traite pas de données personnelles dans le **contenu annoté** (ToS publics). Les PII se
limitent aux **utilisateurs de la plateforme** :

| Donnée | Entité | Finalité | Base légale |
|---|---|---|---|
| `username`, `email`, `display_name`, `locale` | `User` | compte, authn, notifications | exécution du contrat / intérêt légitime (recherche) |
| `role`, `ProjectMembership` | autorisation | contrôle d'accès | intérêt légitime |
| Productions (`Annotation`, `Clause`, `Comment`, `Review`) reliées à un `actor` | travail | constitution du corpus gold | intérêt légitime / mission de recherche |
| `ActivityEvent.actor` + payload | audit/tracking | traçabilité, pilotage qualité | intérêt légitime |
| Logs techniques (`user_pseudo`) | observabilité | exploitation | intérêt légitime |

Pas de données sensibles (art. 9), pas de décision automatisée à effet juridique sur les personnes.

## 2. Principes appliqués

- **Minimisation** : on ne collecte que l'indispensable. Pas de tracking comportemental fin (pas de
  frappes, focus, souris — `tracking.md` §3). Payloads `ActivityEvent` bornés, `excerpt` tronqué.
- **Pseudonymisation par défaut** : toute restitution comparative (IAA, compare, exports, dashboards)
  utilise un **pseudonyme stable par projet** (`HMAC(project_secret, user_id)`), non ré-identifiable
  entre projets. Dé-anonymisation = acte `lead`/`admin` **tracé** (`reveal_identity`).
- **Limitation de finalité** : les métriques servent le pilotage qualité du corpus, **pas**
  l'évaluation RH ; finalité documentée et affichée.
- **Exactitude** : l'utilisateur peut corriger ses données de profil.
- **Limitation de conservation** : rétention paramétrée par projet/corpus
  (`archival.md` §3) ; purge motivée et journalisée.
- **Intégrité & confidentialité** : chiffrement en transit (TLS) et au repos (DB chiffrée), accès au
  moindre privilège (`security.md` §2), pas de PII en logs.

## 3. Droits des personnes

| Droit | Mise en œuvre |
|---|---|
| Accès | export des données personnelles d'un utilisateur (profil + ses productions + ses `ActivityEvent`), sur demande |
| Rectification | édition profil ; correction d'attribution via le `lead` (tracée) |
| Effacement | pseudonymisation/anonymisation **irréversible** de l'`actor` (remplacement par pseudonyme définitif) tout en **conservant la valeur scientifique** des annotations (le gold reste, l'identité disparaît) ; hard delete réservé admin + motif |
| Opposition/limitation | retrait d'un projet ; suspension du tracking nominatif (passage en pseudonyme définitif) |
| Portabilité | export structuré (JSON) des productions de l'utilisateur |

Note méthodologique : l'effacement privilégie l'**anonymisation irréversible de l'attribution** plutôt
que la destruction des annotations, pour ne pas détruire un corpus de recherche déjà constitué — ce
qui est compatible RGPD dès lors que la ré-identification devient impossible.

## 4. DPIA légère (registre des risques de traitement)

| Risque vie privée | Vraisemblance | Gravité | Mesure |
|---|---|---|---|
| Ré-identification d'un annotateur via métriques fines | moyenne | moyenne | k-anonymat (k≥3) sur agrégats, pseudonyme par projet |
| Biais/pression entre pairs (visibilité nominative) | moyenne | moyenne | mode `blind`, pseudonymisation IAA, finalité non-RH affichée |
| Fuite de PII via logs/exports | faible | élevée | `PIIScrubber` logs, exports pseudonymisés par défaut, pas de PII en JWT |
| Conservation excessive | moyenne | faible | rétention paramétrée + purge motivée tracée |
| Dé-anonymisation abusive | faible | élevée | réservée `lead`/`admin`, **tracée** (`reveal_identity`), justifiée |

## 5. Gouvernance

- **Registre des traitements** maintenu (ce document en est le socle). Responsable : `owner` de
  l'instance.
- Toute évolution touchant les PII (nouvelle métrique nominative, nouveau champ utilisateur) exige une
  mise à jour de ce fichier et une revue (cohérent CLAUDE.md « défendre chaque choix »).
- Sous-traitants (hébergement, LLM judge si infogéré) : contrats DPA, données minimisées, pas d'envoi
  de PII annotateur aux API LLM (les pré-annotations portent sur le **corpus public**, pas sur les
  utilisateurs).

## 6. Tests / contrôles

- `pytest anonymize` : pseudonyme stable par projet, non ré-identifiable cross-projet ;
  dé-anonymisation tracée.
- `pytest rgpd_erasure` : effacement → attribution pseudonymisée irréversible, gold conservé,
  événement tracé.
- `pytest k_anonymity` : agrégats exposés respectent k≥3.
- Revue `rgpd_dpia.md` exigée à chaque ajout de donnée personnelle (checklist PR).
