import assert from "node:assert/strict";
import test from "node:test";
import { getOwnerURIComponent } from "../../src/core/index.js";

test("GitHub owner lookup resolves organization and user URI components", async () => {
  const organizationOwnerURIComponent = await getOwnerURIComponent(
    async (input) => {
      assert.equal(input, "https://api.github.com/users/acme");
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return { type: "Organization" };
        }
      };
    },
    "acme",
    "token",
    { warn() {} }
  );
  const userOwnerURIComponent = await getOwnerURIComponent(
    async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      async json() {
        return { type: "User" };
      }
    }),
    "wuodan",
    "token",
    { warn() {} }
  );

  assert.equal(organizationOwnerURIComponent, "orgs/acme");
  assert.equal(userOwnerURIComponent, "users/wuodan");
});

test("GitHub owner lookup caches resolved owner URI components", async () => {
  let calls = 0;

  const firstOwnerURIComponent = await getOwnerURIComponent(
    async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return { type: "Organization" };
        }
      };
    },
    "cached-owner",
    "token",
    { warn() {} }
  );
  const secondOwnerURIComponent = await getOwnerURIComponent(
    async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return { type: "Organization" };
        }
      };
    },
    "cached-owner",
    "token",
    { warn() {} }
  );

  assert.equal(firstOwnerURIComponent, "orgs/cached-owner");
  assert.equal(secondOwnerURIComponent, "orgs/cached-owner");
  assert.equal(calls, 1);
});

test("GitHub owner lookup rejects unsupported owner types", async () => {
  await assert.rejects(
    getOwnerURIComponent(
      async () => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        async json() {
          return { type: "Bot" };
        }
      }),
      "weird-owner",
      "token",
      { warn() {} }
    ),
    /supported type/
  );
});

test("GitHub owner lookup surfaces non-retryable HTTP failures without retrying", async () => {
  let calls = 0;

  await assert.rejects(
    getOwnerURIComponent(
      async () => {
        calls += 1;
        return {
          ok: false,
          status: 401,
          headers: new Headers(),
          async json() {
            return { message: "nope" };
          }
        };
      },
      "unauthorized-owner",
      "token",
      { warn() {} }
    ),
    /GitHub owner lookup failed - status 401 - nope/
  );

  assert.equal(calls, 1);
});

test("GitHub owner lookup retries retryable failures without waiting for real timeouts", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const capturedDelays: number[] = [];
  const warnings: string[] = [];
  let calls = 0;

  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number) => {
    capturedDelays.push(delay ?? 0);
    callback();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  try {
    const ownerURIComponent = await getOwnerURIComponent(
      async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: false,
            status: 503,
            headers: new Headers(),
            async json() {
              return { message: "temporary failure" };
            }
          };
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          async json() {
            return { type: "Organization" };
          }
        };
      },
      "retry-owner",
      "token",
      {
        warn(message) {
          warnings.push(message);
        }
      }
    );

    assert.equal(ownerURIComponent, "orgs/retry-owner");
    assert.equal(calls, 2);
    assert.deepEqual(capturedDelays, [1000]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /attempt 1\/4/);
    assert.match(warnings[0], /temporary failure/);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
