import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // const request = context.switchToHttp().getRequest();
    // const method = request.method;
    // const url = request.url;
    // console.log(request);
    const { method, url } = context.switchToHttp().getRequest();

    console.log(`[${method}] ${url} — incoming`);

    const start = Date.now();
    return next
      .handle()
      .pipe(
        tap(() => console.log(`[${method}] ${url} — ${Date.now() - start}ms`)),
      );
  }
}
