import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Publica a interface do Swagger em `/docs` e o documento OpenAPI em `/docs-json`. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('API de Protótipos')
    .setDescription(
      'CRUD de protótipos e clonagem com o padrão de projeto Prototype. ' +
        'As rotas de escrita exigem um token de acesso obtido em /auth.',
    )
    .setVersion('2.1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
}
