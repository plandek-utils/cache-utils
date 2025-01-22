import type { RedisDelByPatternOptions } from "@eturino/ioredis-del-by-pattern";
import RedisMock from "ioredis-mock";
import { describe, expect, it, vi } from "vitest";
import type { DelFn } from "..";
import { NoOpCache, PlainObjectCache, disconnectedCleanableRedisCache } from "..";

const JSON_VALUE = { foo: "bar" };
const JSON_VALUE_SERIALISED = JSON.stringify(JSON_VALUE);

function buildRedisStubbed(
  opts: {
    expectSet?: boolean;
    expectGet?: "with-value" | "with-json" | "without-value" | false;
    expectDel?: boolean;
  } = {},
) {
  const redis = new RedisMock();

  const setStub = vi
    .spyOn(redis, "set")
    .mockImplementation(opts.expectSet ? () => Promise.resolve("OK") : () => Promise.reject("should not be called"));

  const getStub = vi
    .spyOn(redis, "get")
    .mockImplementation(
      opts.expectGet === "with-value"
        ? () => Promise.resolve("VALUE")
        : opts.expectGet === "with-json"
          ? () => Promise.resolve(JSON_VALUE_SERIALISED)
          : opts.expectGet === "without-value"
            ? () => Promise.resolve(null)
            : () => Promise.reject("should not be called"),
    );

  const delStub = vi
    .spyOn(redis, "unlink")
    .mockImplementation(opts.expectDel ? () => Promise.resolve(3) : () => Promise.reject("should not be called"));

  return {
    redis,
    setStub,
    getStub,
    delStub,
    cleanup: () => {
      setStub.mockRestore();
      getStub.mockRestore();
      delStub.mockRestore();
    },
  };
}

describe("CleanableRedisCache", () => {
  function buildDelFn(expectedPattern: string): DelFn {
    return (opts: RedisDelByPatternOptions) => {
      expect(opts.pattern).toBe(`<test>${expectedPattern}`);
      return Promise.resolve(3);
    };
  }

  describe("#set()", () => {
    it("does nothing with undefined", async () => {
      const redisStubs = buildRedisStubbed();
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", undefined as unknown as string);
      redisStubs.cleanup();
    });

    it("calls the value", async () => {
      const redisStubs = buildRedisStubbed({ expectSet: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", "value");
      expect(redisStubs.setStub).toHaveBeenCalledWith("<test>key", "value", "PX", 0);
      redisStubs.cleanup();
    });

    it("calls the value with ttl", async () => {
      const redisStubs = buildRedisStubbed({ expectSet: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.set("key", "value", { ttl: 10 });
      expect(redisStubs.setStub).toHaveBeenCalledWith("<test>key", "value", "PX", 10_000);
      redisStubs.cleanup();
    });
  });

  describe("#get()", () => {
    it("with value", async () => {
      const redisStubs = buildRedisStubbed({ expectGet: "with-value" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const actual = await crc.get("key");
      expect(redisStubs.getStub).toHaveBeenCalledWith("<test>key");
      expect(actual).toBe("VALUE");
      redisStubs.cleanup();
    });

    it("without value", async () => {
      const redisStubs = buildRedisStubbed({ expectGet: "without-value" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const actual = await crc.get("key");
      expect(redisStubs.getStub).toHaveBeenCalledWith("<test>key");
      expect(actual).toBeUndefined();
      redisStubs.cleanup();
    });
  });

  describe("#delete()", () => {
    it("calls unlink", async () => {
      const redisStubs = buildRedisStubbed({ expectDel: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      await crc.delete("key");
      expect(redisStubs.delStub).toHaveBeenCalledWith("<test>key");
      redisStubs.cleanup();
    });
  });

  describe("#clearAll()", () => {
    it("deletes by pattern", async () => {
      const redisStubs = buildRedisStubbed();
      const delFn = buildDelFn("*");
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearAll();
      expect(res).toBe(3);
      redisStubs.cleanup();
    });
  });

  describe("#clearPrefix()", () => {
    it("deletes by pattern", async () => {
      const redisStubs = buildRedisStubbed();
      const pref = "pref";
      const delFn = buildDelFn(`${pref}*`);
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearPrefix(pref);
      expect(res).toBe(3);
      redisStubs.cleanup();
    });
  });

  describe("#clearResponseCache()", () => {
    it("deletes by pattern", async () => {
      const redisStubs = buildRedisStubbed();
      const delFn = buildDelFn("fqc:*");
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearResponseCache();
      expect(res).toBe(3);
      redisStubs.cleanup();
    });
  });

  describe("#clearClient()", () => {
    it("deletes by pattern", async () => {
      const redisStubs = buildRedisStubbed();
      const clientKey = "plandek";
      const delFn = buildDelFn(`ck-${clientKey}|*`);
      const crc = disconnectedCleanableRedisCache(redisStubs.redis, delFn);
      const res = await crc.clearClient(clientKey);
      expect(res).toBe(3);
      redisStubs.cleanup();
    });
  });
});

describe("PlainObjectCache", () => {
  describe("#set()", () => {
    it("serialises the plain object into json and calls internalCache.set with it", async () => {
      const redisStubs = buildRedisStubbed({ expectSet: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const cache = new PlainObjectCache(crc);

      await cache.set("key", JSON_VALUE);

      expect(redisStubs.setStub).toHaveBeenCalledWith("<test>key", JSON_VALUE_SERIALISED, "PX", 0);
      redisStubs.cleanup();
    });
  });

  describe("#get()", () => {
    it("parses as JSON the retrieved value", async () => {
      const redisStubs = buildRedisStubbed({ expectGet: "with-json" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const cache = new PlainObjectCache(crc);

      const result = await cache.get("key");

      expect(result).toEqual(JSON_VALUE);
      redisStubs.cleanup();
    });

    it("works with cache miss", async () => {
      const redisStubs = buildRedisStubbed({ expectGet: "without-value" });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const cache = new PlainObjectCache(crc);

      const result = await cache.get("key");

      expect(result).toBeUndefined();
      redisStubs.cleanup();
    });
  });

  describe("#delete()", () => {
    it("passes the call to the internal cache", async () => {
      const redisStubs = buildRedisStubbed({ expectDel: true });
      const crc = disconnectedCleanableRedisCache(redisStubs.redis);
      const cache = new PlainObjectCache(crc);

      await cache.delete("key");

      expect(redisStubs.delStub).toHaveBeenCalledWith("<test>key");
      redisStubs.cleanup();
    });
  });
});

describe("NoOpCache", () => {
  it("should always return undefined for get", async () => {
    const noOpCache = new NoOpCache<unknown>();
    const result = await noOpCache.get("some-key");
    expect(result).toBeUndefined();
  });

  it("should do nothing for set", async () => {
    const noOpCache = new NoOpCache<unknown>();
    await noOpCache.set("some-key", "whatever");
    expect(true).toBeTruthy(); // This test passes because set doesn't throw any errors
  });

  it("should do nothing for delete", async () => {
    const noOpCache = new NoOpCache<unknown>();
    await noOpCache.delete("some-key");
    expect(true).toBeTruthy(); // This test passes because delete doesn't throw any errors
  });
});
