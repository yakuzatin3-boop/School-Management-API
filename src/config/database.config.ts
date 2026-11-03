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

    // Prevents TypeORM from automatically changing your database tables
    // to match your entities.
    synchronize: false,
  };
}
