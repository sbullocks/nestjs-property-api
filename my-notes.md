# My Notes — In My Own Words

Personal understanding checkpoints as I work through this curriculum. Written the way I actually understand it, not the way docs explain it.

---

## Starting a NestJS Project

`nest new <name>` creates the project. `cd` into it. `npm run start:dev` fires it up.

The `:dev` part puts the terminal in watch mode — it's always watching for file changes and will recompile and restart automatically when I save something.

When it starts, the terminal output isn't a tree — it's NestJS logging its startup sequence. I can read exactly what's happening line by line:

```
InstanceLoader  — AppModule dependencies initialized   → DI graph built, services instantiated
RoutesResolver  — AppController {/}                    → controller registered, routes scanned
RouterExplorer  — Mapped {/, GET}                      → GET / route registered
NestApplication — Nest application successfully started → now listening for requests
```

---

## What's Actually Happening at Startup vs on a Request

At startup NestJS is doing the wiring — reading the module, creating instances of services, connecting them to controllers. Nothing from the service runs yet.

When a request actually comes in THEN the controller calls the service method and the service runs and returns something.

So startup = wiring. Request = execution. Nothing runs until someone hits the route.

---

## The Flow of a Request (Hello World Example)

1. `AppModule` declares `AppController` and `AppService` — this is how NestJS knows they exist
2. NestJS reads `@Get()` on the controller and registers `GET /` as a route
3. User hits `localhost:3000` in the browser (a GET request)
4. Controller receives it and calls `this.appService.getHello()`
5. `AppService.getHello()` returns `'Hello World!'`
6. That string goes back as the HTTP response

The controller doesn't do the work. It just receives the request and hands it off to the service. The service does the actual work.

---

## How the Controller Knows Which Service and Method to Call

`this.appService.getHello()` — two parts:

- `this.appService` — which service instance to use
- `.getHello()` — which method on that service to call

If I had multiple services injected, I'd navigate to each one the same way:

- `this.appService.getHello()` → AppService
- `this.propertiesService.findAll()` → PropertiesService

It's just JavaScript object navigation. `this.x` = which service, `.x()` = which method.

---

## The Constructor — Storing the Service

Before I can call `this.appService` in a method, the service has to be stored on the class. That's what the constructor does.

The long way:

```ts
private readonly appService: AppService;

constructor(appService: AppService) {
  this.appService = appService;
}
```

The shorthand that does the exact same thing:

```ts
constructor(private readonly appService: AppService) {}
```

TypeScript collapses the declaration and assignment into one line. Same result — `this.appService` is now available in every method in the class.

If I need more than one service, same constructor, separate parameters:

```ts
constructor(
  private readonly appService: AppService,
  private readonly propertiesService: PropertiesService,
) {}
```

One constructor. Never multiple.

---

## private and readonly — The Keycard Analogy

Think of it like a company keycard.

**private** — the keycard is issued to me personally. My coworker can't borrow it or use mine. If they need access, they get their own keycard. In code, if `CatController` needs `AppService`, it just injects its own copy — it doesn't reach into `AppController` and grab its version.

**readonly** — once the company issues me the keycard at the start of the day, nobody can swap it out for a different one mid-day. The injected service won't be replaced after startup.

Without `private` the keycard is left on my desk. Anyone walking by can pick it up and use it directly — bypassing the proper flow entirely. In code that means someone could skip the route and call the service directly from anywhere in the codebase. In a large team that becomes chaos fast.

So `private readonly` = this service is mine, it's locked in, and nobody outside this class touches it.

---

## NestJS vs React/RTK Query

RTK Query is the closest comparison on the frontend side:

| RTK Query (client) | NestJS (server) |
|---|---|
| endpoint definition | controller route |
| query/mutation | service method |
| cache/state | database via Prisma |

Both are structured pipelines where each layer has one job. RTK Query manages server state in the browser. NestJS is the server — it's what RTK Query is talking to.

---

## Wiring Prisma into NestJS (Step 6)

### nest generate service prisma
Generates two files: `prisma.service.spec.ts` (Jest test file) and `prisma.service.ts`. Also auto-updates `app.module.ts` to add PrismaService as a provider. The spec file is for testing the service logic. The service file is where I write the actual PrismaService class.

### nest generate module prisma
Creates `prisma.module.ts` and auto-updates `app.module.ts` to add PrismaModule to the imports array.

---

### prisma.service.ts — What I Did

Made `PrismaService` extend `PrismaClient` and implement `OnModuleInit` and `OnModuleDestroy`. Extending PrismaClient means PrismaService IS the client — I call `this.property.findMany()` directly instead of going through a separate instance.

`OnModuleInit` and `OnModuleDestroy` are NestJS lifecycle hooks:
- `onModuleInit` fires after all modules are loaded and providers are resolved — right before the app starts accepting traffic. This is when `$connect()` runs.
- `onModuleDestroy` fires when the app shuts down. This is when `$disconnect()` runs — closes the connection cleanly.

Without these hooks I'd have to manage the database connection myself. NestJS fires them at exactly the right moment.

---

### prisma.module.ts — providers, exports, @Global()

Three things happening here and they each mean something different:

**providers: [PrismaService]** — PrismaModule is responsible for creating and managing the PrismaService instance. It owns it. Not just the lifecycle hooks — it owns the whole thing.

**exports: [PrismaService]** — makes PrismaService available to any module that imports PrismaModule. Just adding it to providers is not enough — without exports, other modules that import PrismaModule still can't access PrismaService. Have to explicitly say "this is available to whoever imports me."

**@Global()** — import PrismaModule once in AppModule and PrismaService becomes available everywhere automatically. Without @Global(), every module that needs PrismaService would have to import PrismaModule itself.

The breakdown: `providers` = I own this. `exports` = others can use it. `@Global()` = everyone gets it without asking.

---

### app.module.ts — Common Mistake

When the CLI auto-generates, it may add PrismaService to both `AppModule.providers` AND PrismaModule already exports it. That creates two separate instances. The fix: only `PrismaModule` goes in `AppModule.imports[]`. Never add `PrismaService` to `AppModule.providers[]` when using PrismaModule.

---

## Setting Up Postgres

Two commands to know:

- `pg_ctl -D /opt/homebrew/var/postgresql@16 start` — starts the Postgres database server so it's listening for connections. If Postgres is already running as a background service (brew services), this isn't needed.
- `createdb hpos_test_db` — creates a new empty database with that name

TablePlus is a visual tool to see the database — like Snowflake but for local Postgres. Connect using: Host `127.0.0.1`, Port `5432`, User = Mac username, Password blank, Database = the db name. Before connecting, the Postgres role (user) has to exist — create it with:
```bash
psql postgres -c "CREATE ROLE your_username WITH SUPERUSER LOGIN;"
```

---

## What Prisma Is

Prisma lets me interact with the database using TypeScript instead of writing raw SQL. Instead of a massive SQL block to query a table, I write `prisma.property.findMany()` and Prisma generates and runs the SQL for me.

Two packages:
- `prisma` — the CLI dev tool. Manages the schema, runs migrations, generates the client. Not shipped to production.
- `@prisma/client` — the runtime client my app actually imports and uses. This goes to production.

Install with explicit v6 (v5 crashes on Node 24, v7 breaks NestJS):
```bash
npm install prisma@"^6.0.0" @prisma/client@"^6.0.0"
```

---

## What prisma init Creates

Two things:
- `prisma/schema.prisma` — where I define my data models (tables) and my database connection. This is the source of truth for the database structure.
- `.env` — where `DATABASE_URL` lives. Never commit this. Always check `.gitignore` has `.env` in it.

`DATABASE_URL` is the connection string that tells Prisma where my database is, what user to connect as, and which database to use:
```
postgresql://my_mac_username@localhost:5432/hpos_test_db
```

---

## Prisma Migrations

Running `npx prisma migrate dev --name init` does the following:
1. Reads the DATABASE_URL from `.env` to connect to Postgres
2. Loads the models from `schema.prisma`
3. Generates SQL (like `CREATE TABLE`) and saves it to `prisma/migrations/<timestamp>_init/migration.sql`
4. Applies that SQL to the database
5. Records what was run so it knows what's already been applied

This is the same thing as going into Snowflake and running `CREATE TABLE` manually — Prisma just generates and runs the SQL for me.

**The migration file should never be manually edited.** It's a historical record of what was applied to the database. If I need to change the schema, I update the model in `schema.prisma` and run `migrate dev` again — Prisma generates a new migration file for only the difference. Editing an already-applied migration causes drift between Prisma's history and what's actually in the database.

**What migrate dev also does — generates the Prisma Client.** After applying the migration, Prisma regenerates the TypeScript client based on the current schema. This is what makes `Property` available to import from `@prisma/client`. Every time the schema changes and migrate dev runs, the client is updated to reflect the new shape. If I add a field to a model, that field becomes available in TypeScript automatically after the next migration. No manual type writing needed — the types come directly from the schema.

---

## Using PrismaService in PropertiesService (Step 7)

Three things needed in `properties.service.ts`:

1. `import { PrismaService } from '../prisma/prisma.service'` — brings in the service so it can be injected
2. `constructor(private readonly prisma: PrismaService) {}` — injects it so `this.prisma` is available in every method
3. `import { Property } from '@prisma/client'` — brings in the generated TypeScript type so the return type of `findAll` is known

The `Property` type comes from the Prisma client that was generated when `prisma migrate dev` ran. It matches exactly what's in the database — every field in the schema becomes a property on the type. TypeScript uses it to catch mistakes — if I try to access a field that doesn't exist on Property, it errors at compile time, not at runtime.

`Promise<Property[]>` means: this async function returns a promise that resolves to an array of Property objects. The `[]` means array.

`this.prisma.property.findMany()` — `this.prisma` is the injected PrismaService instance. `.property` is the table. `.findMany()` returns all rows.

---

## Prisma Generator — Must Use prisma-client-js

When `prisma init` runs, it might generate the schema with `provider = "prisma-client"` and a custom output path. This breaks NestJS because it generates an ESM-incompatible client. Always fix it to:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Also delete `prisma.config.ts` if it gets generated — DATABASE_URL belongs in `schema.prisma`'s datasource block, not in a separate file.

---

## Build Order That Makes Sense

1. Define the module — declare what controllers and services exist in this scope
2. Define the controller — what routes exist, what each one does
3. Define the service — the actual logic each route calls

In practice I think about it in reverse: what data do I need? → write the service method → wire the controller to call it → register both in the module.

---

## nest generate resource — What It Creates

`nest generate resource properties` is similar to `nest new` — it creates a whole directory and structures it with files automatically. I just name it and NestJS scaffolds everything.

Files it creates:
- `properties.controller.ts` — predefined routes already configured, each referencing `this.propertiesService.x()`
- `properties.service.ts` — predefined methods: `create`, `findAll`, `findOne`, `update`, `remove`
- `properties.module.ts` — registers the controller and service for this scope
- `properties.controller.spec.ts` — Jest test file for the controller
- `properties.service.spec.ts` — Jest test file for the service
- `dto/create-property.dto.ts` — defines the shape of incoming data for create
- `dto/update-property.dto.ts` — extends CreatePropertyDto via PartialType
- `entities/property.entity.ts` — placeholder for the database row shape

The `:dev` server picks up the new files automatically and reinitializes with the new routes included — I can see them appear in the terminal output.

**Important:** always run `nest generate` commands from inside `app/` — not the curriculum root. Running it from the wrong directory generates files in the wrong place.

---

## AppModule imports Array — Why PropertiesModule Goes There

`AppModule` owns `AppController` and `AppService` in its `controllers` and `providers` arrays. The `imports` array is for modules that live outside of it — self-contained modules with their own controllers and services.

`PropertiesModule` is its own `@Module` with its own controller and service. To make it part of the app, it has to be in `AppModule.imports[]`. If it's not there, NestJS doesn't know it exists and the routes won't register.

So the pattern is: `controllers` and `providers` = things this module owns directly. `imports` = other modules being brought in from outside.

---

## AppController and AppService = The Home Route

`AppController` and `AppService` handle `/` — the root.

`PropertiesController` handles `/properties`. As more resources get added, each gets its own controller and prefix:

```
AppController        → /
PropertiesController → /properties
TenantsController    → /tenants
```

`AppController` is typically just a health check in production — a `GET /health` endpoint so infrastructure can ping it to confirm the app is alive.

---

## @Controller('properties') — The Route Prefix

The string passed to `@Controller()` defines the prefix for every route inside that controller. So `@Get()` becomes `GET /properties`, `@Get(':id')` becomes `GET /properties/:id`. NestJS uses it to know which controller owns which URL path.

---

## DTOs — Shape of Incoming Data

A DTO defines what shape of data is allowed into an operation. Right now they're empty because the fields haven't been defined yet. Once I add fields like `name`, `address`, `city`, `state` — NestJS validates that incoming request bodies match that shape before they ever reach the service.

`UpdatePropertyDto` extends `CreatePropertyDto` via `PartialType` — instead of defining the same fields twice, Update just references Create and makes every field optional. This makes sense because on an update I might only send the fields I'm changing, not all of them.

---

## entities/property.entity.ts — Placeholder

An empty class right now. It's meant to represent a database row as a TypeScript class. Once Prisma is wired in, the actual type comes from `@prisma/client` — so this file won't really be used directly.

---

## Route Order Matters

NestJS reads routes top to bottom. If a dynamic route like `:id` is defined before a specific route like `example`, a request to `/properties/example` will match `:id` first and treat `"example"` as the id value — it never reaches the specific route.

Fix: always define specific routes before dynamic ones:

```ts
@Get('example')   // specific — first
@Get(':id')       // dynamic — after
```

The rule: specific routes before `:param` routes. Always.
