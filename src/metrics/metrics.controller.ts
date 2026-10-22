import { Controller, Get, Header, Headers, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('Metrics & Observability')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Exporta métricas da aplicação em formato Prometheus ou JSON',
    description:
      'Retorna métricas em formato texto puro do Prometheus por padrão (text/plain; version=0.0.4) ou em JSON quando solicitado via query ?format=json ou cabeçalho Accept: application/json.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['prometheus', 'json'],
    description: 'Formato de saída desejado. O padrão é prometheus.',
  })
  @ApiProduces('text/plain', 'application/json')
  @ApiResponse({
    status: 200,
    description: 'Métricas coletadas exportadas no formato solicitado.',
  })
  getMetrics(
    @Query('format') format?: string,
    @Headers('accept') acceptHeader?: string,
    @Res() res?: Response,
  ) {
    const isJson =
      format === 'json' ||
      (acceptHeader && acceptHeader.includes('application/json'));

    if (isJson) {
      return res?.status(200).json(this.metricsService.toJsonFormat());
    }

    res?.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return res?.status(200).send(this.metricsService.toPrometheusFormat());
  }
}
