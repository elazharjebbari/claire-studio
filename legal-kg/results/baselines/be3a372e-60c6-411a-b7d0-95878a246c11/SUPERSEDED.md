# Run remplacé — ne pas citer

`threshold_policy` = « max F1 on training data » : seuils choisis sur des scores **in-sample** de la régression
logistique, donc sur-ajustés (≈ 0,9) → rappel effondré (0,08–0,36) alors que les PR-AUC étaient corrects.
Défaut de méthode détecté à la lecture des résultats par catégorie ; corrigé par des seuils sur scores
hors-échantillon (GroupKFold interne k = 4 par document). Run de remplacement : `6bf45ed8-6a24-4cf3-9613-398474fc7a39`.
Conservé (append-only) pour la traçabilité.
