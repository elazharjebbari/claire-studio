# Chantier E — Comptes & onboarding (réalisé)

> Branche `refonte/vague1-derigidification`. Tout vert : pytest 79/79 · tsc 0 ·
> Vitest 104/104 · e2e 66/66 · `next build` OK.

## 1. Livré

| Bloc | Détail | Preuve |
|---|---|---|
| **Config e-mail** | SMTP Stalwart pilotée par env (console en dev, SMTP en prod), `FRONTEND_BASE_URL`, `EMAIL_TOKEN_MAX_AGE`. Aucun secret en dur. | `settings/base.py`, `prod.py`, `.env.example` ; test locmem |
| **Inscription** | `POST /auth/register` (annotateur, non vérifié) + e-mail de vérification. Validation (e-mail/username uniques, mot de passe). Throttlé. | `accounts/views.py`, `serializers.py` ; `test_accounts` |
| **Vérification e-mail** | `POST /auth/verify-email` (token signé `signing`, expirant, idempotent) → `User.is_email_verified`. | `tokens.py`, migration `0002` |
| **Reset mot de passe** | `POST /auth/password-reset` (anti-énumération) + `/confirm` (token Django one-time). | `tokens.py`, `emails.py` |
| **Profil** | `PATCH /me` (display_name, locale ; rôle/e-mail non éditables). | `views.py` |
| **Front** | Pages publiques `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` + liens depuis `/login`. | `app/*`, `endpoints.ts` |
| **Landing** | `/welcome` publique (valeur + fonctionnement + CTA). | `app/welcome`, `e2e/welcome.spec.ts` |

## 2. Sécurité

- Tokens **sans table** : `django.core.signing` (vérif, expirant) et
  `PasswordResetTokenGenerator` (reset, à usage unique — invalidé au changement de mdp).
- **Anti-énumération** : `/auth/password-reset` renvoie la même réponse, e-mail existant ou non.
- **Throttling** dédié : `register` (10/h), `password_reset` (5/h), via `ScopedRateThrottle`.
- Mots de passe validés par les validators Django. Comptes seedés marqués vérifiés.
- Aucun secret en dur ; tout l'e-mail vient de l'environnement.

## 3. Runbook

```bash
# Dev : les e-mails s'impriment dans la console (aucun SMTP requis).
python manage.py runserver
# Prod (Stalwart) : renseigner DJANGO_EMAIL_BACKEND=…smtp…, EMAIL_HOST/PORT/USER/PASSWORD,
# DEFAULT_FROM_EMAIL, FRONTEND_BASE_URL (cf. backend/.env.example).
```
Parcours : `/welcome` → `/signup` → e-mail → `/verify-email?token=…` → `/login`.
Oubli : `/forgot-password` → e-mail → `/reset-password?uid=…&token=…`.

## 4. Reste (suite)

- **Invitations** de membres par e-mail (recoupe le chantier F — rôles/projets).
- Faire de `/welcome` l'entrée racine pour visiteur non authentifié (restructuration
  de `/` ; aujourd'hui `/welcome` est public et lié depuis `/login`, deep-links `?next=`
  préservés).
- Blocage optionnel de la connexion tant que l'e-mail n'est pas vérifié (actuellement
  non bloquant : `is_email_verified` est exposé, l'UI peut inciter).
