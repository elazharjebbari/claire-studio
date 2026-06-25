/**
 * Registre thème → icône Lucide (Lot 3 de la refonte atelier).
 *
 * Renforce l'identité d'un thème par une FORME en plus de la couleur : plusieurs thèmes
 * partagent des teintes proches (3 verts, 3 rouges…) que l'œil distingue mal ; le glyphe
 * monochrome désambiguïse sans ajouter de signal coloré (WCAG 1.4.1 : l'information n'est
 * pas portée par la seule couleur). Source unique consommée par le chip, le plan, le rail,
 * l'inspecteur et le menu express.
 */
import {
  FileText,
  BookOpen,
  Lock,
  UserCheck,
  ListChecks,
  PenLine,
  Copyright,
  RefreshCw,
  LogOut,
  ShieldOff,
  ShieldAlert,
  Gavel,
  Scale,
  Plug,
  CreditCard,
  Mail,
  MessageSquare,
  Gift,
  Stamp,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

/** Glyphe par code de thème CLAUDETTE. Repli neutre = MoreHorizontal (boilerplate/inconnu). */
const THEME_ICONS: Record<string, LucideIcon> = {
  META: FileText,
  PREAMBLE_SCOPE: BookOpen,
  PRIVACY_DATA: Lock,
  ELIGIBILITY_ACCOUNT: UserCheck,
  ACCEPTABLE_USE: ListChecks,
  USER_CONTENT: PenLine,
  LICENSE_IP: Copyright,
  MODIFICATION_OF_TERMS: RefreshCw,
  TERMINATION: LogOut,
  WARRANTY_DISCLAIMER: ShieldOff,
  LIMITATION_LIABILITY: ShieldAlert,
  ARBITRATION_DISPUTES: Gavel,
  GOVERNING_LAW: Scale,
  THIRD_PARTY_SERVICES: Plug,
  FEES_PAYMENT: CreditCard,
  COMMUNICATIONS: Mail,
  FEEDBACK: MessageSquare,
  PROMOTIONS: Gift,
  DMCA: Stamp,
  MISC_BOILERPLATE: MoreHorizontal,
};

export function getThemeIcon(code: string | null | undefined): LucideIcon {
  return (code && THEME_ICONS[code]) || MoreHorizontal;
}
