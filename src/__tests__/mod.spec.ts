import { describe, it } from "@std/testing/bdd";
import { assertSpyCall, type Stub, stub } from "@std/testing/mock";
import { expect } from "@std/expect";

// @ts-types="npm:@types/ioredis-mock"
import redisMock from "ioredis-mock";

import type { Redis } from "ioredis";

import type { RedisDelByPatternOptions } from "@eturino/ioredis-del-by-pattern";

import type { DelFn } from "../mod.ts";
import { disconnectedCleanableRedisCache } from "../mod.ts";

function buildRedisStubbed(
  opts: { expectSet?: boolean; expectGet?: "with-value" | "without-value" | false; expectDel?: boolean } = {},
) {
  const redis = new redisMock.default({});
  const setStub = (opts.expectSet
    ? stub(
      redis,
      "set",
      () => Promise.resolve("OK"),
    )
    : stub(
      redis,
      "set",
      () => Promise.reject("should not be called"),
    )) as unknown as Stub<
      Redis,
      [key: string, value: string, millisecondsToken: "PX", milliseconds: number | string]
    >;

  const getStub = opts.expectGet === "with-value"
    ? stub(redis, "get", () => Promise.resolve("VALUE"))
    : opts.expectGet === "without-value"
    ? stub(redis, "get", () => Promise.resolve(null))
    : stub(redis, "get", () => Promise.reject("should not be called"));

  const delStub =
    (opts.expectDel
      ? stub(redis, "unlink", () => Promise.resolve(3))
      : stub(redis, "unlink", () => Promise.reject("should not be called"))) as unknown as Stub<
        Redis,
        [key: string] | [keys: string[]]
      >;

  return {
    redis,
    setStub,
    getStub,
    delStub,
    [Symbol.dispose]: () => {
      setStub.restore();
      getStub.restore();
      delStub.restore();
    },
  };
}

describe("CleanableRedisCache", () => {
  function buildDelFn(expectedPattern: string): DelFn {
    return (opts: RedisDelByPatternOptions) => {
      expect(opts.pattern).toEqual(`<test>${expectedPattern}`);
      return Promise.resolve(3);
    };
  }

  describe("#set()", () => {
    it("does nothing with undefined", async () => {
      using redisStubs = buildRedisStubbed();
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", undefined as unknown as string);
    });

    it("calls the value", async () => {
      using redisStubs = buildRedisStubbed({ expectSet: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", "value");
      assertSpyCall(redisStubs.setStub, 0, {
        args: ["<test>key", "value", "PX", 0],
      });
    });

    it("calls the value with ttl", async () => {
      using redisStubs = buildRedisStubbed({ expectSet: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", "value", { ttl: 10 });
      assertSpyCall(redisStubs.setStub, 0, {
        args: ["<test>key", "value", "PX", 10_000],
      });
    });
  });

  describe("#get()", () => {
    it("with value", async () => {
      using redisStubs = buildRedisStubbed({ expectGet: "with-value" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const actual = await crc.get("key");
      assertSpyCall(redisStubs.getStub, 0, {
        args: ["<test>key"],
      });
      expect(actual).toEqual("VALUE");
    });

    it("without value", async () => {
      using redisStubs = buildRedisStubbed({ expectGet: "without-value" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const actual = await crc.get("key");
      assertSpyCall(redisStubs.getStub, 0, {
        args: ["<test>key"],
      });
      expect(actual).toBeUndefined();
    });
  });

  describe("#delete()", () => {
    it("calls unlink", async () => {
      using redisStubs = buildRedisStubbed({ expectDel: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.delete("key");
      assertSpyCall(redisStubs.delStub, 0, {
        args: ["<test>key"],
      });
    });
  });

  describe("#clearAll()", () => {
    it("deletes by pattern", async () => {
      using redisStubs = buildRedisStubbed();

      const delFn = buildDelFn("*");
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearAll();
      expect(res).toEqual(3);
    });
  });

  describe("#clearPrefix()", () => {
    it("deletes by pattern", async () => {
      using redisStubs = buildRedisStubbed();
      const pref = "pref";
      const delFn = buildDelFn(`${pref}*`);
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearPrefix(pref);
      expect(res).toEqual(3);
    });
  });

  describe("#clearResponseCache()", () => {
    it("deletes by pattern", async () => {
      using redisStubs = buildRedisStubbed();
      const delFn = buildDelFn("fqc:*");
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearResponseCache();
      expect(res).toEqual(3);
    });
  });

  describe("#clearClient()", () => {
    it("deletes by pattern", async () => {
      using redisStubs = buildRedisStubbed();
      const clientKey = "plandek";
      const delFn = buildDelFn(`ck-${clientKey}|*`);
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearClient(clientKey);
      expect(res).toEqual(3);
    });
  });
});
