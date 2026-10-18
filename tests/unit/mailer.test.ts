import { describe, expect, it, vi } from "vitest";
import { createResendMailer } from "@/lib/mailer";

const email = { to: "rider@example.com", subject: "Reset", text: "link" };

describe("createResendMailer", () => {
  it("posts the message to Resend with the API key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await createResendMailer(
      "re_key",
      "Jala <jala@jala.oak4.xyz>",
      fetchImpl,
    ).send(email);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body)).toEqual({
      from: "Jala <jala@jala.oak4.xyz>",
      to: ["rider@example.com"],
      subject: "Reset",
      text: "link",
    });
  });

  it("throws when Resend rejects the message", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 422 }));
    await expect(
      createResendMailer("k", "f", fetchImpl).send(email),
    ).rejects.toThrow("422");
  });
});
