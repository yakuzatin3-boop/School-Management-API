import { beforeEach, describe, expect, it } from 'vitest';

import { AttendanceController } from './attendance.controller.js';
import type { AttendanceService } from './attendance.service.js';

describe('AttendanceController', () => {
  let controller: AttendanceController;

  beforeEach(() => {
    controller = new AttendanceController({} as AttendanceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
