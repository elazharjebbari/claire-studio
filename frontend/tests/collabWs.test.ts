import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCollabClient,
  createWebSocketCollab,
} from "@/lib/collab/collabClient";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("createWebSocketCollab (présence temps réel, chantier D)", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("se connecte avec le token et diffuse le roster reçu", async () => {
    const client = createWebSocketCollab({ annotationId: "ann-1", wsUrl: "ws://x/", token: "tok" });
    const seen: unknown[] = [];
    client.onPresence((p) => seen.push(p));

    const pending = client.connect();
    const ws = MockWebSocket.instances[0]!;
    expect(ws.url).toContain("/ws/presence/ann-1/?token=tok");
    ws.open();
    await pending;
    expect(client.isLive).toBe(true);

    ws.message({ type: "presence", participants: [{ userId: "u1", name: "A", color: "#fff" }] });
    expect(seen.at(-1)).toEqual([{ userId: "u1", name: "A", color: "#fff" }]);
  });

  it("setFocus publie un message focus quand connecté", async () => {
    const client = createWebSocketCollab({ annotationId: "ann-1", wsUrl: "ws://x", token: null });
    const pending = client.connect();
    const ws = MockWebSocket.instances[0]!;
    ws.open();
    await pending;
    client.setFocus(5);
    expect(ws.sent).toContainEqual(JSON.stringify({ type: "focus", sentenceIndex: 5 }));
  });

  it("createCollabClient sans wsUrl = repli inerte (mono-utilisateur REST)", () => {
    const client = createCollabClient({ annotationId: "ann-1" });
    expect(client.isLive).toBe(false);
  });
});
