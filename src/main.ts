
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      instrument: ObserveInstrument,
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);

    // Set a global API prefix
    app.setGlobalPrefix('api');

    // Enable URI-based API versioning
    app.enableVersioning({
      type: 0, // VersioningType.URI
      defaultVersion: '1',
    });

    // Validate incoming request data
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Add common security headers
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:4200',
      credentials: true,
    });

    await app.listen(port);

    logger.log(`Application running at: http://localhost:${port}/api/v1`);
    logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`);
  } catch (error) {
    logger.error('Failed to start the application', error);
    process.exit(1);
  }
}

void bootstrap();
