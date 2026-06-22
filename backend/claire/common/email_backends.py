"""Backend e-mail SMTP pour la soumission vers le Stalwart LOCAL (même hôte).

Pourquoi : le serveur de soumission (`mail.lumiereacademy.com:587`, Stalwart
mutualisé) ne présente que le **certificat feuille** sur le port submission, sans
la chaîne intermédiaire Let's Encrypt. Python (3.12+) vérifie le certificat par
défaut au `STARTTLS` et échoue alors ("unable to get local issuer certificate").

Comme la connexion vise le serveur mail **de confiance hébergé sur la même
machine** (la submission part de l'app vers le loopback/host local), on n'exige
pas la vérification du certificat pour ce saut — exactement le choix fait côté
webmail SnappyMail (`verify_peer=false`). Le trafic reste chiffré (STARTTLS),
seule la validation de la chaîne est désactivée.

⚠️ À n'utiliser que pour cette soumission locale maîtrisée — jamais pour un
relais SMTP distant non contrôlé.
"""

import ssl

from django.core.mail.backends.smtp import EmailBackend as _SmtpEmailBackend


class LocalTrustedTLSBackend(_SmtpEmailBackend):
    """Backend SMTP identique à celui de Django, mais avec un contexte TLS qui
    ne vérifie ni la chaîne ni le nom d'hôte (soumission locale de confiance)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ssl_context = ssl._create_unverified_context()
