# Module 16: Response Caching

For read-heavy endpoints like `GET /properties`, hitting the database on every request is wasteful when the data rarely changes. Caching stores the response in memory and returns it instantly for subsequent identical requests until the cache expires.

---

## 16.1 Setup

```bash
npm install @nestjs/cache-manager cache-manager
```

In `app.module.ts`:
```ts
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30000,   // cache entries expire after 30 seconds (in ms)
      max: 100,     // max number of cached items in memory
    }),
  ],
})
export class AppModule {}
```

---

## 16.2 Caching a Route with CacheInterceptor

```ts
import { UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

@UseInterceptors(CacheInterceptor)   // caches the response of this route
@Get()
findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryPropertyDto) {
  return this.propertiesService.findAll(user.tenantId, query);
}
```

`CacheInterceptor` uses the request URL as the cache key. Two requests to `GET /properties?city=Austin` get the same cached response. `GET /properties?city=Dallas` is a different key — its own cache entry.

---

## 16.3 Cache Invalidation

The hardest problem in caching. When `POST /properties` creates a new property, the cached `GET /properties` response is stale. Options:

**Short TTL (simplest)** — let the cache expire naturally after 30 seconds. Acceptable staleness for read-heavy, write-rarely data.

**Manual invalidation** — clear the cache when data changes:
```ts
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';

constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

async create(dto: CreatePropertyDto, tenantId: number) {
  const result = await this.prisma.property.create({ data: { ...dto, tenantId } });
  await this.cacheManager.reset();  // clear all cache on write
  return result;
}
```

`reset()` clears everything. For fine-grained control you'd `del(specificKey)` instead.

---

## 16.4 When to Cache

Cache is best for:
- Data that changes infrequently (property listings, lookup tables)
- Read-heavy endpoints (GET requests called far more than POST/PATCH/DELETE)
- Expensive queries (aggregations, large joins)

Don't cache:
- Data that must always be fresh (user-specific real-time data)
- Write operations (POST, PATCH, DELETE should never be cached)
- Paginated endpoints with filters per user — cache key explosion

---

## 16.5 Redis Cache (Production)

In-memory cache (`cache-manager` default) is lost when the server restarts and isn't shared across multiple instances. In production, use Redis:

```bash
npm install cache-manager-redis-store redis
```

```ts
CacheModule.register({
  store: redisStore,
  host: 'localhost',
  port: 6379,
  ttl: 30,
})
```

Redis persists across restarts and is shared across all instances of the app — essential for horizontal scaling.

> **Docs:** https://docs.nestjs.com/techniques/caching
