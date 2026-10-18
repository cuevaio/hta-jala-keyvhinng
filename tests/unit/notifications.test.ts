import { describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { createNotificationService } from "@/modules/notifications/application/notification.service";
import {
  isKnownPushEndpoint,
  roomMessages,
  type PushResult,
  type PushSubscriptionKeys,
} from "@/modules/notifications/domain/push";
import { createWebPushSender } from "@/modules/notifications/infrastructure/push-sender";
import { pushSubscriptionBody } from "@/modules/notifications/schemas/push.schema";

const sub = (endpoint: string): PushSubscriptionKeys => ({
  endpoint,
  p256dh: "key",
  auth: "auth",
});
const message = roomMessages.partyFormed(
  "4f1c2d3e-0000-4000-8000-000000000001",
);

describe("notification service", () => {
  function setup(results: Record<string, PushResult | Error>) {
    const subscriptions = {
      forUsers: vi.fn(async () => Object.keys(results).map(sub)),
      removeEndpoints: vi.fn(async () => {}),
    };
    const sender = {
      send: vi.fn(async (s: PushSubscriptionKeys) => {
        const r = results[s.endpoint];
        if (r instanceof Error) throw r;
        return r;
      }),
    };
    return {
      subscriptions,
      sender,
      service: createNotificationService(subscriptions, sender),
    };
  }

  it("sends to every browser and forgets the ones the push service dropped", async () => {
    const { subscriptions, sender, service } = setup({
      a: "sent",
      b: "gone",
      c: "failed",
    });
    await service.notify(["u1", "u2", "u1"], message);
    expect(subscriptions.forUsers).toHaveBeenCalledWith(["u1", "u2"]);
    expect(sender.send).toHaveBeenCalledTimes(3);
    expect(subscriptions.removeEndpoints).toHaveBeenCalledWith(["b"]);
  });

  it("never throws, so a broken push service cannot fail the request", async () => {
    const { service } = setup({ a: new Error("boom") });
    await expect(service.notify(["u1"], message)).resolves.toBeUndefined();
  });
});

describe("web push sender", () => {
  const vapid = {
    publicKey: "pub",
    privateKey: "priv",
    subject: "mailto:x@y.z",
  };

  it.each([
    [404, "gone"],
    [410, "gone"],
    [429, "failed"],
    [500, "failed"],
  ])("maps push service status %i to %s", async (status, expected) => {
    const send = vi.fn(async () => {
      throw new webpush.WebPushError("x", status, {}, "", "endpoint");
    });
    const sender = createWebPushSender(vapid, send as never);
    expect(await sender.send(sub("e"), message)).toBe(expected);
  });

  it("sends a short-lived, high-urgency payload collapsed per room", async () => {
    const send = vi.fn(async () => ({
      statusCode: 201,
      body: "",
      headers: {},
    }));
    const sender = createWebPushSender(vapid, send as never);
    expect(await sender.send(sub("e"), message)).toBe("sent");
    const [, payload, options] = send.mock.calls[0] as unknown as [
      unknown,
      string,
      { TTL: number; urgency: string; topic: string },
    ];
    expect(JSON.parse(payload)).toEqual(message);
    expect(options).toMatchObject({ TTL: 600, urgency: "high" });
    expect(options.topic).toMatch(/^[A-Za-z0-9]{32}$/);
  });
});

describe("push endpoints", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QH1",
    "https://db5p.notify.windows.com/w/?token=abc",
  ])("accepts the push service %s", (endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://fcm.googleapis.com:8443/fcm/send/abc",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/push",
    "https://fcm.googleapis.com.evil.test/x",
    "https://evilpush.apple.com/x",
    "not a url",
  ])("refuses %s so the server cannot be aimed elsewhere", (endpoint) => {
    expect(isKnownPushEndpoint(endpoint)).toBe(false);
  });

  it("validates the browser subscription shape", () => {
    expect(
      pushSubscriptionBody.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "BNcR-x_1", auth: "tBHI" },
      }).success,
    ).toBe(true);
    expect(
      pushSubscriptionBody.safeParse({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "<script>", auth: "tBHI" },
      }).success,
    ).toBe(false);
  });
});
