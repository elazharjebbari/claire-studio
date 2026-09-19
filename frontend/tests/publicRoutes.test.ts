import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/publicRoutes";

describe("isPublicPath", () => {
  it("recognises the reviewer page and the other public surfaces", () => {
    for (const p of ["/", "/presentation", "/public", "/public/campagne", "/login", "/signup", "/welcome", "/join/abc"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });
  it("keeps the workshop and admin private", () => {
    for (const p of ["/home", "/work", "/annotate/1", "/admin", "/projects/x/lab", "/publication", null, undefined, ""]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
