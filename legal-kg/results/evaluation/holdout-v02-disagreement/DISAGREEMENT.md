# Désaccords règles ↔ référence — holdout / population (4078 phrases, 2 passes)

| Item | Réf. | signalées | TP | FP | FP stables | FP autre cat. | FP clause réf. | FN | FN N0 sans norme | N1 action ok, champs ≠ | N2 action ≠ | N3 autre passe |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| a | LTD | 4 | 2 | 2 | 1 | 0 | 1 | 130 | 0 | 70 | 59 | 1 |
| b | LTD | 19 | 15 | 4 | 3 | 0 | 0 | 117 | 0 | 55 | 59 | 3 |
| d | — | 21 | 0 | 21 | 12 | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| f | TER,CR | 12 | 10 | 2 | 2 | 1 | 0 | 130 | 0 | 57 | 70 | 3 |
| g | TER | 40 | 27 | 13 | 12 | 8 | 4 | 75 | 0 | 34 | 37 | 4 |
| i | USE | 37 | 16 | 21 | 14 | 0 | 4 | 28 | 0 | 21 | 5 | 2 |
| j | CH | 42 | 26 | 16 | 15 | 0 | 14 | 62 | 0 | 9 | 53 | 0 |
| k | CH | 22 | 11 | 11 | 11 | 6 | 9 | 77 | 0 | 8 | 69 | 0 |
| l | CH | 18 | 11 | 7 | 6 | 0 | 3 | 77 | 0 | 1 | 76 | 0 |
| m | — | 39 | 0 | 39 | 31 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| p | — | 17 | 0 | 17 | 17 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| q | A,J | 103 | 17 | 86 | 75 | 1 | 31 | 28 | 0 | 28 | 0 | 0 |

## Sévérité (TP vs FN) et champs les plus proches des faux négatifs N1

- **a** : TP par sévérité {'None': 1, '2': 1} ; FN par sévérité {'2': 113, 'None': 16, '3': 1} ; champs bloquants (N1) {'object∌personal_injury/death/gross_negligence': 42} ; FP par thème {'LIMITATION_LIABILITY': 2}
- **b** : TP par sévérité {'2': 14, '3': 1} ; FN par sévérité {'2': 100, 'None': 17} ; champs bloquants (N1) {'object∌personal_injury/death/gross_negligence': 40} ; FP par thème {'LIMITATION_LIABILITY': 4}
- **f** : TP par sévérité {'2': 2, '3': 10} ; FN par sévérité {'2': 89, '3': 45, 'None': 8} ; champs bloquants (N1) {'condition=for_cause': 16, 'actor=user': 11, 'condition=specified_reason': 3} ; FP par thème {'ACCOUNT_USE': 1, 'TERMINATION': 1}
- **g** : TP par sévérité {'2': 11, '3': 16} ; FN par sévérité {'2': 50, 'None': 5, '3': 20} ; champs bloquants (N1) {'condition=for_cause': 15, 'actor=user': 7, 'notice=reasonable': 3, 'condition=specified_reason': 3} ; FP par thème {'ACCOUNT_USE': 2, 'TERMINATION': 11}
- **i** : TP par sévérité {'2': 14, 'None': 2} ; FN par sévérité {'2': 27, 'None': 1} ; champs bloquants (N1) {'actor=user': 16, 'modality=obligation': 16, 'modality=permission': 4} ; FP par thème {'FRAMEWORK': 13, 'PRIVACY_DATA': 5, 'MODIFICATION_OF_TERMS': 3}
- **j** : TP par sévérité {'2': 26} ; FN par sévérité {'None': 6, '2': 53, '3': 3} ; champs bloquants (N1) {} ; FP par thème {'MODIFICATION_OF_TERMS': 16}
- **k** : TP par sévérité {'2': 8, 'None': 3} ; FN par sévérité {'2': 71, 'None': 3, '3': 3} ; champs bloquants (N1) {'condition=specified_reason': 3} ; FP par thème {'MODIFICATION_OF_TERMS': 11}
- **l** : TP par sévérité {'2': 9, '3': 1, 'None': 1} ; FN par sévérité {'2': 70, '3': 2, 'None': 5} ; champs bloquants (N1) {} ; FP par thème {'MODIFICATION_OF_TERMS': 1, 'FEES_PAYMENT': 6}
- **q** : TP par sévérité {'3': 2, '2': 14, 'None': 1} ; FN par sévérité {'None': 1, '2': 2, '3': 25} ; champs bloquants (N1) {'action=choose_forum': 20, 'modality=permission': 2} ; FP par thème {'DISPUTES_LAW': 86}

## Stabilité : union 421 phrases signalées ; par nombre de passes {'1': 117, '2': 304} ; majorité 304 ; κ de Fleiss (toutes phrases) 0.8229
