import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authKit } from "./auth";

const http = httpRouter();

authKit.registerRoutes(http);

http.route({
  path: "/twenty/contact-edit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.TWENTY_CONTACT_EDIT_WEBHOOK_SECRET;

    if (!secret) {
      return new Response("Webhook is not configured", { status: 503 });
    }

    const timestamp = request.headers.get("x-avm-timestamp") ?? "";
    const signature = request.headers.get("x-avm-signature") ?? "";
    const timestampMs = Number(timestamp) * 1000;

    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 5 * 60_000
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return new Response("Invalid request body", { status: 400 });
    }

    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return new Response("Payload too large", { status: 413 });
    }

    let suppliedSignature: Uint8Array;
    try {
      if (!/^[a-f0-9]{64}$/i.test(signature)) throw new Error("bad signature");
      suppliedSignature = new Uint8Array(
        signature.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)),
      );
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      suppliedSignature.buffer as ArrayBuffer,
      new TextEncoder().encode(`${timestamp}.${rawBody}`),
    );

    if (!valid) return new Response("Unauthorized", { status: 401 });

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return new Response("Invalid payload", { status: 400 });
    }

    const event = body as Record<string, unknown>;
    const fields = event.fields as Record<string, unknown> | undefined;

    if (
      typeof event.eventId !== "string" ||
      typeof event.personId !== "string" ||
      typeof event.workosId !== "string" ||
      !fields ||
      typeof fields !== "object"
    )
      return new Response("Invalid payload", { status: 400 });

    const allowed = ["first_name", "last_name", "email", "phone"] as const;
    const cleanFields: Record<string, string> = {};

    for (const key of allowed) {
      const value = fields[key];
      if (value !== undefined) {
        if (typeof value !== "string" || value.length > 320) {
          return new Response("Invalid contact field", { status: 400 });
        }
        cleanFields[key] = value.trim();
      }
    }

    if (!Object.keys(cleanFields).length)
      return new Response(null, { status: 204 });

    const result = await ctx.runMutation(
      internal.twentyContactEdits.ingestFromTwenty,
      {
        sourceEventId: event.eventId,
        twentyPersonId: event.personId,
        workosId: event.workosId,
        fields: cleanFields,
      },
    );

    return new Response(null, { status: result.accepted ? 202 : 404 });
  }),
});

export default http;
