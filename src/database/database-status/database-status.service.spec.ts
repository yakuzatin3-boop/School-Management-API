import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseStatusService } from './database-status.service.js';

describe('DatabaseStatusService', () => {
  let service: DatabaseStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseStatusService],
    }).compile();

    service = module.get<DatabaseStatusService>(DatabaseStatusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
