# Module 1: NestJS Fundamentals

You already know Express. NestJS is a framework built on top of Node.js/Express that adds structure — modules, dependency injection, decorators. The HTTP layer works the same way. What NestJS adds is organization and conventions.

---

## 1.1 What NestJS Is

| Express | NestJS |
|---|---|
| `app.get('/route', handler)` | `@Get()` decorator on a class method |
| No structure enforced | Modules, controllers, services — enforced pattern |
| Manually wire dependencies | Dependency injection built in |
| No lifecycle hooks | `OnModuleInit`, `OnModuleDestroy`, etc. |
| `app.use(middleware)` | Guards, interceptors, pipes — each with a specific role |

NestJS does not replace Express — it wraps it. Everything Express can do, NestJS can do. NestJS just gives you a structured way to do it.

> **Docs:** https://docs.nestjs.com/first-steps

---

## 1.2 Modules

In Express, you manually import and wire everything. In NestJS, every piece of the app belongs to a **module**. Modules declare what they contain and what they expose to other modules.

```ts
// Express — manual wiring
const customerRouter = require('./routes/customers');
app.use('/customers', customerRouter);

// NestJS — module declares its own scope
@Module({
  imports: [],            // other modules this module depends on
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService], // what other modules can use
})
export class PropertiesModule {}
```

NestJS reads the full module tree at startup and builds a **dependency injection graph** — a map of what is available to what. If a service is not in `providers`, it does not exist to that module.

**AppModule** is the root. Every other module gets imported into it (directly or transitively).

> **Docs:** https://docs.nestjs.com/modules

---

## 1.3 Dependency Injection

In Express, you instantiate services yourself:

```js
// Express
const service = new CustomerService(db);
app.get('/customers', (req, res) => service.findAll());
```

In NestJS, you never call `new` on a service. You declare what you need in the constructor and NestJS provides it:

```ts
// NestJS
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}
  // NestJS injected PrismaService — you didn't instantiate it
}
```

For DI to work, three things must be true:
1. The service has `@Injectable()`
2. The service is in the module's `providers` array
3. The consumer declares it in the constructor

**Why DI matters:** NestJS manages the instance lifecycle. One instance per app, shared everywhere. No manual wiring, no duplicate instances.

> **Docs:** https://docs.nestjs.com/providers

---

## 1.4 Controllers

Controllers handle HTTP routing. In Express you attach handlers to the router. In NestJS you decorate class methods.

```ts
// Express
router.get('/', getAllProperties);
router.get('/:id', getProperty);
router.post('/', createProperty);

// NestJS
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(+id);
  }

  @Post()
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }
}
```

Route decorators:

| Decorator | HTTP method |
|---|---|
| `@Get()` | GET |
| `@Post()` | POST |
| `@Patch(':id')` | PATCH |
| `@Delete(':id')` | DELETE |

Parameter decorators:

| Decorator | What it extracts |
|---|---|
| `@Param('id')` | URL path param |
| `@Body()` | Request body |
| `@Query('key')` | Query string param |

> **Docs:** https://docs.nestjs.com/controllers

---

## 1.5 Services

Services hold business logic. Controllers never do work — they delegate to services. This is the same separation you'd want in Express, but NestJS enforces it structurally.

```ts
// Express — logic lives in handler (bad pattern)
app.get('/properties', async (req, res) => {
  const rows = await db.query('SELECT * FROM properties');
  res.json(rows);
});

// NestJS — controller delegates, service does the work
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.property.findMany();
  }
}
```

---

## 1.6 Lifecycle Hooks

NestJS fires hooks at specific points during startup and shutdown. Use them to connect/disconnect external resources.

```ts
@Injectable()
export class PrismaService extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();   // fires after all modules are loaded, before app accepts traffic
  }

  async onModuleDestroy() {
    await this.$disconnect(); // fires on shutdown
  }
}
```

| Hook | When it fires |
|---|---|
| `OnModuleInit` | After all providers resolved, before `app.listen()` |
| `OnModuleDestroy` | When `app.close()` is called |

> **Docs:** https://docs.nestjs.com/fundamentals/lifecycle-events

---

## 1.7 Bootstrap (main.ts)

Every NestJS app starts in `main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

`NestFactory.create(AppModule)`:
1. Reads the module tree starting from `AppModule`
2. Builds the DI container
3. Resolves all providers
4. Fires `OnModuleInit` hooks

`app.listen()` opens the HTTP port after all of that completes.

---

## 1.8 Generate Commands

NestJS CLI scaffolds boilerplate so you don't write it manually:

```bash
nest new <project-name>              # scaffold a new project
nest generate resource <name>        # controller + service + module + DTOs
nest generate service <name>         # service only
nest generate module <name>          # module only
nest generate guard <name>           # guard
nest generate interceptor <name>     # interceptor
```

> `nest generate service` does NOT create a module. Always run both separately.

---

## 1.9 Request Pipeline

Understanding the order NestJS processes a request:

```
Request
  → Middleware       (runs before routing, no ExecutionContext)
  → Guards           (allow or deny — runs after routing)
  → Interceptors     (wrap request/response — before handler)
  → Pipes            (validate/transform input)
  → Handler          (your controller method)
  → Interceptors     (wrap request/response — after handler)
  → Response
```

Each layer has a specific job. Don't put authorization logic in middleware. Don't put logging in a guard. Use the right tool for each concern.
