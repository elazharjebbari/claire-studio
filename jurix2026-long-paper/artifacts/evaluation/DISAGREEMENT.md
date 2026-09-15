# Désaccords règles ↔ référence — holdout / population (4078 phrases, 1 passes)

| Item | Réf. | signalées | TP | FP | FP stables | FP autre cat. | FP clause réf. | FN | FN N0 sans norme | N1 action ok, champs ≠ | N2 action ≠ | N3 autre passe |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a | LTD | 4 | 2 | 2 | 2 | 0 | 1 | 130 | 0 | 71 | 59 | 0 |
| b | LTD | 19 | 15 | 4 | 4 | 0 | 0 | 117 | 0 | 58 | 59 | 0 |
| d | — | 21 | 0 | 21 | 21 | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| f | TER,CR | 12 | 10 | 2 | 2 | 1 | 0 | 130 | 0 | 60 | 70 | 0 |
| g | TER | 40 | 27 | 13 | 13 | 8 | 4 | 75 | 0 | 38 | 37 | 0 |
| i | USE | 37 | 16 | 21 | 21 | 0 | 4 | 28 | 0 | 23 | 5 | 0 |
| j | CH | 42 | 26 | 16 | 16 | 0 | 14 | 62 | 0 | 9 | 53 | 0 |
| k | CH | 22 | 11 | 11 | 11 | 6 | 9 | 77 | 0 | 8 | 69 | 0 |
| l | CH | 18 | 11 | 7 | 7 | 0 | 3 | 77 | 0 | 1 | 76 | 0 |
| m | — | 39 | 0 | 39 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| p | — | 17 | 0 | 17 | 17 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| q | A,J | 103 | 17 | 86 | 86 | 1 | 31 | 28 | 0 | 28 | 0 | 0 |

## Sévérité (TP vs FN) et champs les plus proches des faux négatifs N1

- **a** : TP par sévérité {'2': 1, 'None': 1} ; FN par sévérité {'2': 113, 'None': 16, '3': 1} ; champs bloquants (N1) {'object∌personal_injury/death/gross_negligence': 42} ; FP par thème {'LIMITATION_LIABILITY': 2}
- **b** : TP par sévérité {'2': 14, '3': 1} ; FN par sévérité {'2': 100, 'None': 17} ; champs bloquants (N1) {'object∌personal_injury/death/gross_negligence': 42} ; FP par thème {'LIMITATION_LIABILITY': 4}
- **f** : TP par sévérité {'3': 10, '2': 2} ; FN par sévérité {'3': 45, '2': 89, 'None': 8} ; champs bloquants (N1) {'condition=for_cause': 16, 'actor=user': 11, 'condition=specified_reason': 3} ; FP par thème {'TERMINATION': 1, 'ACCOUNT_USE': 1}
- **g** : TP par sévérité {'2': 11, '3': 16} ; FN par sévérité {'2': 50, '3': 20, 'None': 5} ; champs bloquants (N1) {'condition=for_cause': 15, 'actor=user': 10, 'condition=specified_reason': 3, 'notice=reasonable': 3} ; FP par thème {'TERMINATION': 11, 'ACCOUNT_USE': 2}
- **i** : TP par sévérité {'2': 14, 'None': 2} ; FN par sévérité {'2': 27, 'None': 1} ; champs bloquants (N1) {'actor=user': 18, 'modality=obligation': 18, 'modality=permission': 4} ; FP par thème {'FRAMEWORK': 13, 'MODIFICATION_OF_TERMS': 3, 'PRIVACY_DATA': 5}
- **j** : TP par sévérité {'2': 26} ; FN par sévérité {'2': 53, '3': 3, 'None': 6} ; champs bloquants (N1) {} ; FP par thème {'MODIFICATION_OF_TERMS': 16}
- **k** : TP par sévérité {'2': 8, 'None': 3} ; FN par sévérité {'2': 71, '3': 3, 'None': 3} ; champs bloquants (N1) {'condition=specified_reason': 3} ; FP par thème {'MODIFICATION_OF_TERMS': 11}
- **l** : TP par sévérité {'2': 9, '3': 1, 'None': 1} ; FN par sévérité {'2': 70, 'None': 5, '3': 2} ; champs bloquants (N1) {} ; FP par thème {'FEES_PAYMENT': 6, 'MODIFICATION_OF_TERMS': 1}
- **q** : TP par sévérité {'2': 14, '3': 2, 'None': 1} ; FN par sévérité {'3': 25, 'None': 1, '2': 2} ; champs bloquants (N1) {'action=choose_forum': 20, 'modality=permission': 2} ; FP par thème {'DISPUTES_LAW': 86}

## Stabilité : union 356 phrases signalées ; par nombre de passes {'1': 356} ; majorité 356 ; κ de Fleiss (toutes phrases) None
