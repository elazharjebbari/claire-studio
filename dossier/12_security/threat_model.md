# Modèle de menace (STRIDE)

> Périmètre : STRIDE sur les flux principaux de CLAIRE Studio. Complète `security.md` (mesures) et
> `rgpd_dpia.md` (vie privée). STRIDE = Spoofing, Tampering, Repudiation, Information disclosure,
> Denial of service, Elevation of privilege.

## 1. Flux principaux analysés

1. **Authentification** (`/api/v1/auth/*`, JWT).
2. **Annotation** (workspace → `POST/PATCH /annotations`, `/clauses`).
3. **Import file-based** (auto-pull pré-annotations, sync traductions).
4. **Export** (`/exports`, écriture d'artefacts fichiers).
5. **Audit/activité** (`ActivityEvent`, dé-anonymisation IAA).

## 2. Limites de confiance (trust boundaries)

- Navigateur (non fiable) ↔ API DRF (autorité). Toute décision d'accès est **côté serveur**.
- API ↔ DB Postgres (réseau interne, accès au moindre privilège).
- API/worker ↔ **système de fichiers** (racines `TRANSLATIONS_ROOT`, `PREANNOTATIONS_ROOT`,
  `EXPORTS_ROOT`) — frontière sensible (path-traversal, SSRF-like).
- API ↔ provider OIDC (SSO) et, le cas échéant, API LLM (corpus public uniquement, jamais de PII).

## 3. Analyse STRIDE par flux

### 3.1 Authentification
| Menace | Scénario | Mitigation (`security.md`) |
|---|---|---|
| S | vol/rejeu de token | refresh rotatif + blacklist `jti`, access court, RS256, cookie HttpOnly |
| T | altération du JWT | signature asymétrique vérifiée, claims minimaux |
| R | nier une connexion | `ActivityEvent`/logs `login` horodatés avec `request_id` |
| I | fuite de credentials | TLS, Argon2id, pas de PII dans le token, scrubbing logs |
| D | bourrage de login | rate limit/lockout, alerte `login_failures_total` |
| E | escalade via rôle falsifié | rôle lu en DB (jamais du seul JWT côté actions sensibles), permissions object-level |

### 3.2 Annotation
| Menace | Scénario | Mitigation |
|---|---|---|
| S | agir au nom d'autrui | `actor` = utilisateur authentifié, jamais un champ client |
| T | poser une clause sur l'annotation d'un pair | `IsAnnotationOwnerOrReviewer` object-level ; unicité `(project,document,annotator)` |
| T | thème hors vocab / anchor hors borne | validation invariants (vocab fermé, `anchor_index ∈ [0,N)`) |
| R | contester une édition | `ActivityEvent clause.*` + `AnnotationVersion` (snapshot immuable) |
| I | lire l'annotation d'un pair en mode blind | `PeerVisibilityPermission` |
| D | spam d'éditions | throttling DRF écritures |
| E | annotateur accédant à `/admin` | rôle global vérifié, deny-by-default |

### 3.3 Import file-based (auto-pull, sync traductions)
| Menace | Scénario | Mitigation |
|---|---|---|
| S | source falsifiée | chemins **dans racine autorisée** uniquement, pas d'URL arbitraire (anti-SSRF, A10) |
| T | path-traversal (`../etc/passwd`), symlink sortant | normalisation + rejet `..`/absolu/symlink (`09_translations/`) |
| T | JSON pré-annotation malveillant (anchor hallucinés) | validation Pydantic, `AnchorOutOfRangeError`, dédup d'ancres |
| R | origine d'un import inconnue | `provenance` (chemin, checksum) + `preannotation.imported` |
| I | lecture de fichiers hors périmètre | confinement racine, permissions FS du worker minimales |
| D | fichier géant / zip bomb | taille plafonnée, parsing borné, timeouts worker |
| E | exécution de code via désérialisation | **pas** de pickle/`eval` ; JSON/YAML safe-load uniquement |

### 3.4 Export
| Menace | Scénario | Mitigation |
|---|---|---|
| T | manifeste/artefact altéré | checksums SHA-256 dans le manifeste, vérifiables |
| R | nier un export sensible | `export.requested/completed` + `requested_by` |
| I | fuite d'identités via export comparatif | `anonymize=true` par défaut sur IAA/compare, pseudonymes |
| D | export massif épuisant le worker | throttling exports, concurrence bornée par projet |
| E | export hors de son périmètre projet | autorisation projet sur `POST /projects/{slug}/exports` |

### 3.5 Audit / dé-anonymisation
| Menace | Scénario | Mitigation |
|---|---|---|
| T | falsifier le journal | `ActivityEvent` append-only, aucune route de mutation |
| R | nier une dé-anonymisation | `reveal_identity` tracé (qui, quand, quels pseudonymes) |
| I | révéler des identités sans droit | réservé `lead`/`admin`, justifié, journalisé (`rgpd_dpia.md`) |
| E | accès au mapping pseudo→user | endpoint dédié restreint + tracé |

## 4. Risques résiduels & suivi

- **Compromission d'un compte `admin`/`owner`** : impact élevé (dé-anonymisation, purge). Mitigations :
  MFA-ready, actions sensibles tracées et idéalement à double validation (4 yeux) en option projet.
- **Fuite via dépendance vulnérable** : suivi `pip-audit`/Dependabot, lock `uv`.
- Ces risques alimentent `14_plans/risks_register.csv`.

## 5. Tests

- `pytest pathsafety` (traductions + pré-annotations) : `..`/absolu/symlink rejetés.
- `pytest authz_isolation`, `pytest jwt_rotation`, `pytest ratelimit_login` (cf. `security.md`).
- `pytest audit_append_only` : aucune route ne mute/supprime un `ActivityEvent`.
- `security-review` CI sur diffs auth/permissions/file-based.

**État M9 (implémenté)** — voir `security.md` §9. Les mitigations STRIDE marquées
ci-dessus sont couvertes par `backend/tests/test_security_m9.py` :
§3.1 (S rejeu → `test_jwt_rotation` ; D bourrage → `test_ratelimit_login` ;
I scrubbing → `test_logging_pii`), §3.2 (T/I isolation → `test_authz_isolation`),
§3.3 (T path-traversal → `test_translation_pathsafety`). En-têtes A05 :
`test_security_headers`. Suite complète : 48 tests verts.
