# Sécurité applicative

> Périmètre : authentification, autorisation, OWASP Top 10, rate limiting, secrets. Qualité
> « sécurisé » (CONTRACT §6). Stack : Django/DRF + JWT (CONTRACT §3), Next.js. Relié au modèle de
> menace (`threat_model.md`) et au RGPD (`rgpd_dpia.md`).

## 1. Authentification (JWT)

- `POST /api/v1/auth/login` → `{access, refresh}` (CONTRACT §3). `access` court (≈ 15 min),
  `refresh` long (≈ 7 j) rotatif. `POST /api/v1/auth/refresh` émet un nouvel access et **fait tourner**
  le refresh (rotation + blacklist de l'ancien : anti-rejeu).
- Stockage front : `access` en mémoire (pas `localStorage`) ; `refresh` en cookie **HttpOnly, Secure,
  SameSite=Strict** → indisponible au JS (mitige XSS-vol-de-token). CSRF couvert car l'API est
  Bearer-token pour les mutations sensibles + cookie SameSite.
- Algo de signature **asymétrique** (RS256) clé tournante (`kid`) ; jamais HS256 avec secret partagé
  côté front. Claims minimaux : `sub` (user id), `role`, `exp`, `iat`, `jti`. **Pas** de PII dans le
  JWT.
- SSO-ready (navigation.md `/login`) : provider OIDC enfichable, mapping `role` à la première
  connexion.
- Déconnexion : blacklist du `jti` refresh (table `BlacklistedToken`).

## 2. Autorisation (par rôle & par projet)

Double couche (cf. `07_collaboration_versioning/collaboration.md` §2) :

- **Rôle global** (`User.role`) : ouvre `/admin/*` pour `admin`/`owner` ; sinon refus 403 sur les
  routes admin.
- **Rôle projet** (`ProjectMembership.role`) : `annotator|reviewer|lead` borne les actions dans le
  projet. Permissions DRF dédiées :
  - `IsProjectMember` (toute lecture projet),
  - `IsAnnotationOwnerOrReviewer` (édition/review),
  - `PeerVisibilityPermission` (lecture des annotations de pairs selon `peer_visibility`),
  - `IsProjectLeadOrAdmin` (membres, assignations, dé-anonymisation).
- **Object-level** systématique : un PATCH de `Clause` vérifie que la clause ∈ annotation de l'appelant
  (ou rôle supérieur). Jamais d'autorisation déduite du seul frontend.
- Principe du **moindre privilège** : un annotateur n'accède ni aux schémas, ni aux corpus, ni aux
  exports admin, ni aux identités réelles des pairs.

## 3. OWASP Top 10 — mesures

| Risque | Mitigation CLAIRE |
|---|---|
| A01 Broken Access Control | permissions DRF object-level (§2), tests d'isolation projet, deny-by-default |
| A02 Cryptographic Failures | TLS partout, JWT RS256, refresh cookie HttpOnly/Secure, hash mots de passe Argon2id |
| A03 Injection | ORM Django (pas de SQL brut), validation Pydantic/serializers, assainissement Markdown commentaires |
| A04 Insecure Design | vocab fermé, invariants DB testés, séparation gold/LLM, threat model STRIDE (`threat_model.md`) |
| A05 Security Misconfiguration | `DEBUG=False` prod, `ALLOWED_HOSTS`, en-têtes sécurité (CSP, HSTS, X-Content-Type-Options), CORS allowlist |
| A06 Vulnerable Components | `uv` lock + audit deps (pip-audit/Dependabot), images base minces, mises à jour suivies |
| A07 Identification/Auth Failures | lockout/rate limit login (§4), rotation refresh, MFA-ready, mots de passe forts |
| A08 Software/Data Integrity | checksums import/export (manifeste), signatures artefacts, CI vérifiée, pas de désérialisation non sûre |
| A09 Logging/Monitoring Failures | logs structurés sans PII + alerting (`11_tracking_observability/observability.md`), audit `ActivityEvent` |
| A10 SSRF | `folder_path`/sources file-based validés sous racine autorisée, pas de fetch d'URL arbitraire côté serveur (auto-pull sur chemins contrôlés uniquement) |

## 4. Rate limiting & abus

- **Login** : limite stricte par IP + par compte (ex. 5 tentatives / 5 min) puis backoff/lockout
  temporaire ; `login_failures_total` métré, alerte sur pic (`observability.md` §6).
- **API authentifiée** : quotas par utilisateur/rôle (throttling DRF `ScopedRateThrottle`) — lecture
  généreuse, écritures et **exports** plus strictes (un export lourd ne doit pas DoS).
- **Jobs** : exports/sync en file avec concurrence bornée par projet (anti-épuisement worker).
- Réponses `429` avec `Retry-After`.

## 5. Validation des entrées

- **Serializers DRF + Pydantic** pour les payloads complexes (import v9.2/v9.4, manifeste). Bornes
  dures : `certainty ∈ {0..3}`, `theme ∈ LabelScheme`, `anchor_index ∈ [0, n_sentences)`,
  `decision`/`score` fermés.
- **Path-safety** (file-based) : traductions et auto-pull pré-annotations rejettent `..`, chemins
  absolus hors racine, symlinks sortants (cf. `09_translations/`).
- **Markdown** (commentaires, body review) : assaini (allowlist), pas de HTML brut → anti-XSS stocké.
- **Upload** (pré-annotations) : type/MIME vérifiés, taille plafonnée, JSON validé avant persistance.

## 6. Secrets & configuration

- Secrets via **variables d'environnement / coffre** (Vault/SOPS), jamais en repo (cohérent CLAUDE.md
  « jamais de données/secrets versionnés »). `.env` ignoré, `.env.example` documenté.
- Clés JWT RS256 en coffre, rotation par `kid`. Identifiants DB/broker injectés au runtime.
- CI : pas de secret en clair dans les logs ; scan de secrets (gitleaks) en pre-commit/CI.

## 7. En-têtes & transport

- HTTPS obligatoire, HSTS. CSP stricte (pas d'inline script non nonce). `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`. CORS en **allowlist** (origines front
  connues), credentials maîtrisés.

## 8. Tests (CONTRACT §6)

- `pytest authz_isolation` : un annotateur ne lit/édite pas hors de son périmètre ; deny-by-default.
- `pytest jwt_rotation` : rotation refresh, blacklist, rejet token expiré/altéré.
- `pytest ratelimit_login` : lockout après N échecs, `429` + `Retry-After`.
- `pytest input_validation` : bornes certitude/thème/anchor ; path-safety ; XSS Markdown bloqué.
- `security-review` (CI) sur tout diff touchant auth/permissions.
