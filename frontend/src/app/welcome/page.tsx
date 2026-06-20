/**
 * `/welcome` est conservé comme alias historique : le contenu d'accueil vit
 * désormais à la racine `/` (page d'accueil publique de pactiva.legal).
 */

import { redirect } from "next/navigation";

export default function WelcomeRedirect() {
  redirect("/");
}
