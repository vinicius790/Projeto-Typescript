import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        response.setHeader('X-Response-Time', `${duration}ms`);
      }),
    );
  }
}
