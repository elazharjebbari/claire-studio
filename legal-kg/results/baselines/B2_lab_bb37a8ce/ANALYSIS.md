# Analyse d'erreurs — B2 Legal-BERT (hold-out, 4078 phrases, 440 abusives)

## Rappel par catégorie CLAUDETTE

| Catégorie | n | rappel |
|---|---|---|
| A | 17 | 0.647 |
| CH | 88 | 0.739 |
| CR | 52 | 0.808 |
| J | 28 | 0.857 |
| LAW | 27 | 0.852 |
| LTD | 132 | 0.742 |
| TER | 102 | 0.892 |
| USE | 44 | 0.727 |

## Par thème T11 (consensus)

| Thème | n | abusives | taux | P | R | F1 | FP | FN |
|---|---|---|---|---|---|---|---|---|
| LIMITATION_LIABILITY | 201 | 73 | 0.363 | 0.671 | 0.781 | 0.722 | 28 | 16 |
| MODIFICATION_OF_TERMS | 143 | 71 | 0.497 | 0.718 | 0.859 | 0.782 | 24 | 10 |
| DISPUTES_LAW | 460 | 68 | 0.148 | 0.688 | 0.809 | 0.743 | 25 | 13 |
| TERMINATION | 145 | 60 | 0.414 | 0.707 | 0.883 | 0.785 | 22 | 7 |
| CONTENT_IP | 791 | 47 | 0.059 | 0.649 | 0.787 | 0.712 | 20 | 10 |
| ACCOUNT_USE | 762 | 39 | 0.051 | 0.532 | 0.641 | 0.581 | 22 | 14 |
| FRAMEWORK | 555 | 28 | 0.05 | 0.517 | 0.536 | 0.526 | 14 | 13 |
| FEES_PAYMENT | 542 | 28 | 0.052 | 0.615 | 0.857 | 0.716 | 15 | 4 |
| THIRD_PARTY_SERVICES | 201 | 12 | 0.06 | 0.333 | 0.417 | 0.37 | 10 | 7 |
| WARRANTY_DISCLAIMER | 187 | 11 | 0.059 | 0.462 | 0.545 | 0.5 | 7 | 5 |
| PRIVACY_DATA | 91 | 3 | 0.033 | 0.5 | 0.333 | 0.4 | 1 | 2 |

## Classe d'accord thématique (humains) et taux d'erreur

| Classe | n | taux d'erreur | taux d'abusives |
|---|---|---|---|
| divergence | 156 | 0.071 | 0.109 |
| majority | 2008 | 0.068 | 0.109 |
| strict | 1914 | 0.074 | 0.107 |

## Erreurs confiantes

- Faux négatifs : 101, dont 83 avec un score « abusif » < 0,1 (le modèle ne voit rien) et 5 ≥ 0,4 (proches de la frontière).
- Faux positifs : 188, dont 129 avec un score > 0,9.

## Par document : F1 min 0.49 (WorldOfWarcraft), médiane 0.721 (Tinder), max 0.857 (PokemonGo) sur 17 documents.

## Phrases multi-catégories : 44 phrases à ≥ 2 catégories, rappel 0.932.

## Recouvrement avec B1 TF-IDF (phrases abusives détectées)

- Détectées par les deux : 243 ; par B2 Legal-BERT seul : 96 ; par B1 TF-IDF seul : 36 ; par aucun : 65 (sur 440).

---

# Analyse d'erreurs — B1 TF-IDF (hold-out, 4078 phrases, 440 abusives)

## Rappel par catégorie CLAUDETTE

| Catégorie | n | rappel |
|---|---|---|
| A | 17 | 0.647 |
| CH | 88 | 0.682 |
| CR | 52 | 0.615 |
| J | 28 | 0.929 |
| LAW | 27 | 0.889 |
| LTD | 132 | 0.606 |
| TER | 102 | 0.647 |
| USE | 44 | 0.432 |

## Par thème T11 (consensus)

| Thème | n | abusives | taux | P | R | F1 | FP | FN |
|---|---|---|---|---|---|---|---|---|
| LIMITATION_LIABILITY | 201 | 73 | 0.363 | 0.467 | 0.767 | 0.58 | 64 | 17 |
| MODIFICATION_OF_TERMS | 143 | 71 | 0.497 | 0.606 | 0.803 | 0.691 | 37 | 14 |
| DISPUTES_LAW | 460 | 68 | 0.148 | 0.491 | 0.838 | 0.62 | 59 | 11 |
| TERMINATION | 145 | 60 | 0.414 | 0.571 | 0.8 | 0.667 | 36 | 12 |
| CONTENT_IP | 791 | 47 | 0.059 | 0.467 | 0.447 | 0.457 | 24 | 26 |
| ACCOUNT_USE | 762 | 39 | 0.051 | 0.394 | 0.333 | 0.361 | 20 | 26 |
| FRAMEWORK | 555 | 28 | 0.05 | 0.13 | 0.25 | 0.171 | 47 | 21 |
| FEES_PAYMENT | 542 | 28 | 0.052 | 0.364 | 0.571 | 0.444 | 28 | 12 |
| THIRD_PARTY_SERVICES | 201 | 12 | 0.06 | 0.125 | 0.083 | 0.1 | 7 | 11 |
| WARRANTY_DISCLAIMER | 187 | 11 | 0.059 | 0.182 | 0.182 | 0.182 | 9 | 9 |
| PRIVACY_DATA | 91 | 3 | 0.033 | 0.2 | 0.333 | 0.25 | 4 | 2 |

## Classe d'accord thématique (humains) et taux d'erreur

| Classe | n | taux d'erreur | taux d'abusives |
|---|---|---|---|
| divergence | 156 | 0.128 | 0.109 |
| majority | 2008 | 0.12 | 0.109 |
| strict | 1914 | 0.123 | 0.107 |

## Erreurs confiantes

- Faux négatifs : 161, dont 0 avec un score « abusif » < 0,1 (le modèle ne voit rien) et 161 ≥ 0,4 (proches de la frontière).
- Faux positifs : 335, dont 0 avec un score > 0,9.

## Par document : F1 min 0.372 (WorldOfWarcraft), médiane 0.538 (TripAdvisor), max 0.789 (Twitter) sur 17 documents.

## Phrases multi-catégories : 44 phrases à ≥ 2 catégories, rappel 0.75.
