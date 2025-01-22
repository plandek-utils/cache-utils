// src/index.ts
import { RedisDeletionMethod, redisDelByPattern } from "@eturino/ioredis-del-by-pattern";
function clientMainCachePrefix(clientKey) {
  return `ck-${clientKey}|`;
}
var CleanableRedisCache = class {
  delFn;
  redis;
  keyPrefix;
  defaultCacheTTL;
  enableLog;
  constructor(opts) {
    const { delFn, enableLog, keyPrefix, defaultTTLSeconds, redis } = opts;
    this.redis = redis;
    this.keyPrefix = keyPrefix;
    this.defaultCacheTTL = defaultTTLSeconds;
    this.enableLog = enableLog;
    this.delFn = delFn || redisDelByPattern;
  }
  /**
   * Disconnects the redis client
   */
  disconnect() {
    this.redis.disconnect();
  }
  /**
   * Loads the value from the cache (STRING) or undefined if not found
   *
   * @param givenKey Key to identify the cache entry
   * @returns
   */
  async get(givenKey) {
    const key = this.finalKeyFor(givenKey);
    const value = await this.redis.get(key);
    return isNil(value) ? void 0 : value;
  }
  /**
   * Deletes the cache entry using `redis.unlink`.
   *
   * Calls `finalKeyFor` to get the final key to be used in REDIS.
   *
   * @param givenKey Key to identify the cache entry
   */
  async delete(givenKey) {
    const key = this.finalKeyFor(givenKey);
    const result = await this.redis.unlink(key);
    return result > 0 ? true : void 0;
  }
  /**
   * Sets a value in the cache for the given key, using `redis.set` with `PX`.
   *
   * Calls `finalKeyFor` to get the final key to be used in REDIS.
   *
   * It does nothing if the value is `undefined`.
   *
   * @param givenKey Key to identify the cache entry
   * @param value Value to be stored in the cache
   * @param options Options for the cache entry
   * @param options.ttl TTL to use instead of the default this.defaultCacheTTL
   */
  async set(givenKey, value, options) {
    if (typeof value === "undefined") {
      return;
    }
    const key = this.finalKeyFor(givenKey);
    const ttlSeconds = options?.ttl ?? this.defaultCacheTTL;
    await this.redis.set(key, value, "PX", ttlSeconds * 1e3);
  }
  /**
   * Clears all the cache entries for this cache.
   */
  clearAll() {
    return this.clean("");
  }
  /**
   * Clears all the response entries (fqc:*) for this cache.
   *
   * It is the prefix added by the Apollo Server cache plugin
   */
  clearResponseCache() {
    return this.clean("fqc:");
  }
  /**
   * Clears all the cache entries for the given client.
   *
   * Uses `clientMainCachePrefix` to generate the prefix.
   *
   * @param clientKey
   * @returns the number of entries cleared
   * @see clientMainCachePrefix
   */
  clearClient(clientKey) {
    return this.clean(clientMainCachePrefix(clientKey));
  }
  /**
   * Clears all the cache entries for the given prefix.
   *
   * @param prefix
   * @returns the number of entries cleared
   */
  clearPrefix(prefix) {
    return this.clean(prefix);
  }
  /**
   * Deletes all cache entries using `delFn` with the given prefix, using `unlink` with Pipeline.
   *
   * Calls `finalKeyFor` to get the final pattern to be used in REDIS.
   *
   * @param prefix
   * @returns the number of entries cleared
   */
  clean(prefix) {
    return this.delFn({
      pattern: `${this.finalKeyFor(prefix)}*`,
      redis: this.redis,
      deletionMethod: RedisDeletionMethod.unlink,
      withPipeline: true,
      enableLog: this.enableLog
    });
  }
  finalKeyFor(key) {
    return `${this.keyPrefix}${key}`;
  }
};
function disconnectedCleanableRedisCache(redis, delFn) {
  const c = new CleanableRedisCache({
    redis,
    delFn,
    defaultTTLSeconds: 0,
    enableLog: false,
    keyPrefix: "<test>"
  });
  c.disconnect();
  return c;
}
var PlainObjectCache = class {
  constructor(cache) {
    this.cache = cache;
  }
  /**
   * Calls `cache.get` with the given key and parses the value as JSON if it is truthy, undefined otherwise.
   * @param key
   * @returns
   */
  async get(key) {
    const value = await this.cache.get(key);
    return value ? JSON.parse(value) : void 0;
  }
  /**
   * Calls `cache.set` with the given key and value, stringifying the value.
   * @param key
   * @param value
   * @param options
   * @returns
   */
  set(key, value, options) {
    return this.cache.set(key, JSON.stringify(value), options);
  }
  /**
   * Calls `cache.delete` with the given key.
   * @param key
   * @returns
   */
  async delete(key) {
    const result = await this.cache.delete(key);
    return typeof result === "boolean" ? result : void 0;
  }
};
var NoOpCache = class {
  /**
   * Always returns `undefined`
   * @returns Promise<undefined>
   */
  get(_key) {
    return Promise.resolve(void 0);
  }
  /**
   * Does nothing
   * @returns Promise<void>
   */
  set(_key, _value, _options) {
    return Promise.resolve();
  }
  /**
   * Does nothing
   * @returns Promise<void>
   */
  delete(_key) {
    return Promise.resolve(false);
  }
};
function isNil(value) {
  return value === void 0 || value === null;
}
export {
  CleanableRedisCache,
  NoOpCache,
  PlainObjectCache,
  clientMainCachePrefix,
  disconnectedCleanableRedisCache
};
//# sourceMappingURL=index.mjs.map