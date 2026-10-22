import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const start = performance.now();
    const method = req.method;
    const url = req.baseUrl || req.url || '/';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = performance.now() - start;
          const status = res.statusCode || 200;
          this.metricsService.recordHttpRequest(method, url, status, duration);
        },
        error: (err) => {
          const duration = performance.now() - start;
          const status = err.status || 500;
          this.metricsService.recordHttpRequest(method, url, status, duration);
        },
      }),
    );
  }
}
