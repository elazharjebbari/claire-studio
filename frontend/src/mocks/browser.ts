/** Worker MSW pour le navigateur (dev / E2E). */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
