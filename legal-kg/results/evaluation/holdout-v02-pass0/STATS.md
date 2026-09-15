# Tests pré-enregistrés — holdout-v02-pass0 (4078 phrases, 17 documents)

| Item | n_pos | ΔF1 règles − thème seul | p (perm.) | p Holm | rejet | concluant |
|---|---|---|---|---|---|---|
| a | 132 | -0.409 | 0.0001 | 0.0009 | True | oui |
| b | 132 | -0.2398 | 0.0028 | 0.014 | True | oui |
| f | 140 | -0.2053 | 0.0007 | 0.0049 | True | oui |
| g | 102 | 0.0159 | 0.77512 | 1.0 | False | oui |
| i | 44 | 0.2132 | 0.0015 | 0.009 | True | oui |
| j | 88 | 0.0017 | 1.0 | 1.0 | False | oui |
| k | 88 | -0.1983 | 0.0003 | 0.0024 | True | oui |
| l | 88 | -0.1907 | 0.014 | 0.056 | False | oui |
| q | 45 | 0.0515 | 0.18658 | 0.55974 | False | oui |

## Binaire : règles ∪ vs texte seul

- **theme_only** : ΔF1 -0.0749 (p 0.0327) ; non-infériorité δ=0.05 : IC [-0.1248, -0.0185] → NON
- **B2** : ΔF1 -0.3368 (p 0.0001) ; non-infériorité δ=0.05 : IC [-0.3995, -0.278] → NON
- **B1** : ΔF1 -0.1651 (p 0.0001) ; non-infériorité δ=0.05 : IC [-0.2113, -0.1182] → NON

Précision des règles ∪ (Wilson) : 0.4073 [0.3575 ; 0.4591] (k=145, n=356)
