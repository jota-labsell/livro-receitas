import { test } from "node:test";
import assert from "node:assert/strict";
import { marketingConfig } from "../lib/marketing-config";
import { DEFAULT_PIXEL } from "../lib/operations-settings";

function testEnv(flag: string | undefined, pixelId = DEFAULT_PIXEL): CloudflareEnv {
  return {
    META_PIXEL_ENABLED: flag,
    MERCADOPAGO_MODE: "sandbox",
    CHECKOUT_ENABLED: "false",
    LIVE_PAYMENTS_ENABLED: "false",
    ORDERS: {
      prepare(query: string) {
        assert.match(query, /operation_settings/);
        return { async first() { return { pixel_id: pixelId, capi_paused: 1 }; } };
      },
    } as unknown as D1Database,
  };
}

test("PageView flag is independent of checkout, payment mode and CAPI pause", async () => {
  assert.deepEqual(await marketingConfig(testEnv("true", "123456789")), {
    enabled: true, pixelId: "123456789",
  });
});

test("explicit opt-out or missing Pixel flag never enables browser tracking", async () => {
  assert.equal((await marketingConfig(testEnv("false"))).enabled, false);
  assert.equal((await marketingConfig(testEnv(undefined))).enabled, false);
  assert.equal((await marketingConfig(null)).enabled, false);
});

test("invalid configured Pixel ID cannot enable browser tracking", async () => {
  assert.deepEqual(await marketingConfig(testEnv("true", "invalid")), {
    enabled: false, pixelId: "invalid",
  });
});
