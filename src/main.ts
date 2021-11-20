import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
// pino.destination({
// sync: false, // Asynchronous logging
// }),
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { CronJob } from 'cron';
import compression from 'fastify-compress';
import * as helmet from 'fastify-helmet';

import { AppModule } from './app.module';
import { MyLogger } from './common/basic/logger.basic';
import { BootstrapService } from './common/service/bootstrap.service';

const logger = new Logger('main');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    // logger: new MyLogger(),
    // bufferLogs: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.register(compression, { encodings: ['gzip', 'deflate'] });

  app.register(helmet.fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      },
    },
  });

  await app.startAllMicroservices();

  const bootstrapService = app.get<BootstrapService>(BootstrapService);

  bootstrapService.setupSwagger(app);

  await app.listen(3000, '0.0.0.0');

  const t = '*/1 * * * * *';

  const cron = new CronJob(t, () => {
    console.log('before');
  });

  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger is running on: ${await app.getUrl()}/v1/swagger`);
}
bootstrap();
