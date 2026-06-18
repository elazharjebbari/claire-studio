/** Serveur MSW pour les tests Node (Vitest). */
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
