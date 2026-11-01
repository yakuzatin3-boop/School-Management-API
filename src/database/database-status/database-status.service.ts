
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseStatusService implements OnApplicationBootstrap {
  private readonly logger = new Logger('PostgreSQL');

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.query('SELECT 1');

    this.logger.log('PostgreSQL connected successfully!');
  }
}
