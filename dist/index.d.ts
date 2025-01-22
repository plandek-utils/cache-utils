import type { KeyValueCache, KeyValueCacheSetOptions } from "@apollo/utils.keyvaluecache";
import { redisDelByPattern } from "@eturino/ioredis-del-by-pattern";
import type { PlainObject } from "@plandek-utils/plain-object";
import type { Redis } from "ioredis";
/**
 * Function to delete keys by pattern.
 */
export type DelFn = typeof redisDelByPattern;
/**
 * Util to generate the prefix for the main cache of a client.
 *
 * @param clientKey
 * @returns `ck-${clientKey}|`
 */
export declare function clientMainCachePrefix(clientKey: string): string;
type ConstructorParams = {
    /**
     * Redis client
     */
    redis: Redis;
    /**
     * Function to delete keys by pattern.
     * If not present, then `redisDelByPattern` from `@eturino/ioredis-del-by-pattern` will be used
     *
     * @see redisDelByPattern
     */
    delFn?: DelFn;
    /**
     * Mandatory prefix for all the keys in this cache, which will be prepended to all keys in REDIS
     */
    keyPrefix: string;
    /**
     * Default TTL for cache entries in seconds
     */
    defaultTTLSeconds: number;
    /**
     * If true, it will be sent to the delFn when cleaning the cache
     */
    enableLog: boolean;
};
/**
 * uses ioredis directly to implement a redis cache that can be cleaned by pattern
 */
export declare class CleanableRedisCache implements KeyValueCache<string> {
    readonly delFn: DelFn;
    readonly redis: Redis;
    readonly keyPrefix: string;
    readonly defaultCacheTTL: number;
    readonly enableLog: boolean;
    constructor(opts: ConstructorParams);
    /**
     * Disconnects the redis client
     */
    disconnect(): void;
    /**
     * Loads the value from the cache (STRING) or undefined if not found
     *
     * @param givenKey Key to identify the cache entry
     * @returns
     */
    get(givenKey: string): Promise<string | undefined>;
    /**
     * Deletes the cache entry using `redis.unlink`.
     *
     * Calls `finalKeyFor` to get the final key to be used in REDIS.
     *
     * @param givenKey Key to identify the cache entry
     */
    delete(givenKey: string): Promise<boolean | undefined>;
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
    set(givenKey: string, value: string, options?: KeyValueCacheSetOptions): Promise<void>;
    /**
     * Clears all the cache entries for this cache.
     */
    clearAll(): Promise<number>;
    /**
     * Clears all the response entries (fqc:*) for this cache.
     *
     * It is the prefix added by the Apollo Server cache plugin
     */
    clearResponseCache(): Promise<number>;
    /**
     * Clears all the cache entries for the given client.
     *
     * Uses `clientMainCachePrefix` to generate the prefix.
     *
     * @param clientKey
     * @returns the number of entries cleared
     * @see clientMainCachePrefix
     */
    clearClient(clientKey: string): Promise<number>;
    /**
     * Clears all the cache entries for the given prefix.
     *
     * @param prefix
     * @returns the number of entries cleared
     */
    clearPrefix(prefix: string): Promise<number>;
    /**
     * Deletes all cache entries using `delFn` with the given prefix, using `unlink` with Pipeline.
     *
     * Calls `finalKeyFor` to get the final pattern to be used in REDIS.
     *
     * @param prefix
     * @returns the number of entries cleared
     */
    protected clean(prefix: string): Promise<number>;
    protected finalKeyFor(key: string): string;
}
/**
 * returns a DISCONNECTED CleanableRedisCache, useful for tests.
 */
export declare function disconnectedCleanableRedisCache(redis: Redis, delFn?: DelFn): CleanableRedisCache;
/**
 * Adaptor for a KeyValueCache<string> to KeyValueCache<PlainObject>, using JSON.parse and JSON.stringify
 */
export declare class PlainObjectCache implements KeyValueCache<PlainObject> {
    readonly cache: KeyValueCache<string>;
    constructor(cache: KeyValueCache<string>);
    /**
     * Calls `cache.get` with the given key and parses the value as JSON if it is truthy, undefined otherwise.
     * @param key
     * @returns
     */
    get(key: string): Promise<PlainObject | undefined>;
    /**
     * Calls `cache.set` with the given key and value, stringifying the value.
     * @param key
     * @param value
     * @param options
     * @returns
     */
    set(key: string, value: PlainObject, options?: KeyValueCacheSetOptions): Promise<void>;
    /**
     * Calls `cache.delete` with the given key.
     * @param key
     * @returns
     */
    delete(key: string): Promise<boolean | undefined>;
}
/**
 * KeyValueCache that does nothing, useful for tests or to disable cache with minimal impact.
 */
export declare class NoOpCache<T = unknown> implements KeyValueCache<T> {
    /**
     * Always returns `undefined`
     * @returns Promise<undefined>
     */
    get(_key: string): Promise<T | undefined>;
    /**
     * Does nothing
     * @returns Promise<void>
     */
    set(_key: string, _value: T, _options?: KeyValueCacheSetOptions | undefined): Promise<void>;
    /**
     * Does nothing
     * @returns Promise<void>
     */
    delete(_key: string): Promise<boolean | undefined>;
}
export {};
