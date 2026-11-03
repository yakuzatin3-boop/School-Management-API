import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function databaseconfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',

    host: config.get<string>('DB_HOST', 'localhost'),
    port: Number(config.get<string>('DB_PORT', '5432')),

    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_DATABASE'),

    // Register every entity added through TypeOrmModule.forFeature().
    // This works in both the compiled app and Vitest without trying to
    // import raw TypeScript entity files at runtime.
    autoLoadEntities: true,

    // Schema synchronisation is opt-in. Docker Compose enables it on a fresh
    // database so the tables are created automatically. Keep it disabled in
    // production once the schema is managed through migrations.
    synchronize:
      config.get<string>('DB_SYNCHRONIZE', 'false').toLowerCase() === 'true',
  };
}
