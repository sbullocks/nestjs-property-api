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

## Build Order That Makes Sense

1. Define the module — declare what controllers and services exist in this scope
2. Define the controller — what routes exist, what each one does
3. Define the service — the actual logic each route calls

In practice I think about it in reverse: what data do I need? → write the service method → wire the controller to call it → register both in the module.
