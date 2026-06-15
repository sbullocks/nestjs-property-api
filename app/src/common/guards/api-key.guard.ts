// Guards have one job — determine whether a request will be handled by the route handler or not. This is authorization. Guards know exactly what's going to be executed next (which controller, which method) so at runtime they can decide if the request is allowed to proceed.
// Certain routes are only available to callers with the right permissions. The guard checks the incoming request for proof of access — in this case an API key in the request header — and either allows it through or throws a 401.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  // requires an CanActivate method. NestJS calls this on every request that hits a guarded route.
  canActivate(context: ExecutionContext): boolean {
    // `canActivate(context: ExecutionContext): boolean` — the method NestJS calls. Returns `boolean`. Can also return `Promise<boolean>` or `Observable<boolean>` if the check is async, but since checking a header is synchronous, plain `boolean` is all that's needed here.
    const request = context.switchToHttp().getRequest(); // this is the line to memorize. Every HTTP guard will have it. .switchToHttp tells it we're in an HTTP context. .getRequest() returns the Express request object - everything the client sent: headers, body, params, URL, method. The result is stored in `request` — this represents the incoming network call at the moment the user sent it.
    const apiKey = request.headers['x-api-key']; // reads the `x-api-key` header from the incoming request. The client (curl, browser, Postman) sends this header. The guard reads it.
    // console.log(apiKey);
    if (apiKey === process.env.API_KEY) return true; // if the key matches, allow the request through. `'secret'` is a hardcoded placeholder. In production this would be `process.env.API_KEY`.
    throw new UnauthorizedException(); // if the key doesn't match or is missing, NestJS catches this and returns a 401 response automatically.
  }
}
