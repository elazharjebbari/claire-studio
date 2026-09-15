# Tests pré-enregistrés — holdout-v02-pass1 (4078 phrases, 17 documents)

| Item | n_pos | ΔF1 règles − thème seul | p (perm.) | p Holm | rejet | concluant |
|---|---|---|---|---|---|---|
| a | 132 | -0.3946 | 0.0001 | 0.0009 | True | oui |
| b | 132 | -0.253 | 0.0003 | 0.0024 | True | oui |
| f | 140 | -0.182 | 0.002 | 0.012 | True | oui |
| g | 102 | 0.0192 | 0.60714 | 1.0 | False | oui |
| i | 44 | 0.1425 | 0.0377 | 0.1508 | False | oui |
| j | 88 | -0.0195 | 0.72143 | 0.72143 | False | oui |
| k | 88 | -0.2036 | 0.0003 | 0.0021 | True | oui |
| l | 88 | -0.1907 | 0.0138 | 0.069 | False | oui |
| q | 45 | 0.0282 | 0.41816 | 1.0 | False | oui |

## Binaire : règles ∪ vs texte seul

- **theme_only** : ΔF1 -0.103 (p 0.0048) ; non-infériorité δ=0.05 : IC [-0.1588, -0.0394] → NON
- **B2** : ΔF1 -0.3649 (p 0.0001) ; non-infériorité δ=0.05 : IC [-0.4403, -0.295] → NON
- **B1** : ΔF1 -0.1932 (p 0.0001) ; non-infériorité δ=0.05 : IC [-0.2431, -0.1429] → NON

Précision des règles ∪ (Wilson) : 0.3686 [0.3209 ; 0.4189] (k=136, n=369)
