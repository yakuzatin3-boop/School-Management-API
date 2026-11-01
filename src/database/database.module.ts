import { Module } from '@nestjs/common';
import { DatabaseStatusService } from './database-status/database-status.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseconfig } from '../config/database.config.js';

@Module({
  imports:[
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: databaseconfig,
    })
  ],
  providers: [DatabaseStatusService]
})
export class DatabaseModule {}
