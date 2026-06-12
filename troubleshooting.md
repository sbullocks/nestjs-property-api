# Troubleshooting

Known errors and fixes for this stack.

---

## Prisma v7 incompatibility with NestJS

**Symptom:**
```
ReferenceError: exports is not defined in ES module scope
```

**Cause:** `npx prisma init` installs Prisma v7 by default. Prisma v7 generates a client using `import.meta.url` (ESM-only syntax). NestJS compiles to CommonJS. They are incompatible.

**Fix:**
```bash
npm install prisma@5 @prisma/client@5
```

Delete any v7-generated files: `generated/`, `prisma.config.ts`. Delete `prisma/migrations` if it exists. Rewrite `schema.prisma` cleanly.

In Prisma v5, `DATABASE_URL` stays in `schema.prisma` datasource block. In v7 it moved to `prisma.config.ts` — ignore that file entirely when using v5.

---

## tsconfig: module must be commonjs

**Symptom:** ESM/CJS import errors after Prisma init.

**Cause:** Prisma v7 init sets `"module": "nodenext"` and `"moduleResolution": "nodenext"` in tsconfig. This conflicts with NestJS's CommonJS compilation.

**Fix:**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

Never use `nodenext` with NestJS + Prisma v5.

---

## Prisma types not resolving in VS Code

**Symptom:**
```
Module '@prisma/client' has no exported member 'Property'
```

**Cause:** Prisma Client wasn't generated, or VS Code's TypeScript server has stale cache.

**Fix:**
```bash
npx prisma generate
```

Then in VS Code: `Cmd+Shift+P` → **TypeScript: Restart TS Server**.

---

## Migration drift warning

**Symptom:** Running `prisma migrate dev` warns about drift — tables exist in the database that aren't in migration history.

**Cause:** You deleted `prisma/migrations` after a migration was already applied.

**Fix:** Type `y` to reset. Safe in development. Never do this against production.

---

## PrismaService duplicated in AppModule

**Symptom:** Two PrismaService instances, unexpected behavior.

**Cause:** Adding `PrismaService` to both `PrismaModule.exports` and `AppModule.providers`.

**Fix:** Only import `PrismaModule` in `AppModule.imports[]`. Never add `PrismaService` to `AppModule.providers`.

```ts
// CORRECT
@Module({
  imports: [PrismaModule, PropertiesModule],
})
export class AppModule {}

// WRONG
@Module({
  imports: [PrismaModule, PropertiesModule],
  providers: [PrismaService], // don't do this
})
export class AppModule {}
```

---

## nest generate service does not create a module

**Symptom:** You run `nest generate service prisma` but no module file is created.

**Fix:** Always run both commands separately:
```bash
nest generate service prisma
nest generate module prisma
```

---

## npm global install permission error

**Symptom:**
```
EACCES: permission denied
```

**Fix:**
```bash
sudo npm i -g @nestjs/cli
sudo chown -R $(whoami) ~/.npm   # if npm cache gets corrupted
```

---

## @UseGuards with new

**Symptom:** Guard works but DI dependencies inside it aren't injected (if you need them later).

**Cause:** Using `new ApiKeyGuard()` inside `@UseGuards()`.

**Fix:** Pass the class, not an instance:
```ts
// CORRECT
@UseGuards(ApiKeyGuard)

// WRONG
@UseGuards(new ApiKeyGuard())
```

---

## curl -H syntax error

**Symptom:**
```
curl: (2) no URL specified
```

**Cause:** Removed the header value but left `-H` in the command. curl treats the URL as the header value.

**Fix:** Remove `-H` entirely when you don't want to send a header:
```bash
# No header
curl http://localhost:3000/properties

# With header
curl -H "x-api-key: secret" http://localhost:3000/properties
```
