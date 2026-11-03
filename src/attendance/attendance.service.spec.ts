import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it } from 'vitest';

import { AttendanceService } from './attendance.service.js';
import { Attendance } from './entities/attendance.entity/attendance.entity.js';
import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { ClassSchedule } from '../classes/entities/class-schedule.entity/class-schedule.entity.js';

describe('AttendanceService', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService(
      {} as Repository<Attendance>,
      {} as Repository<Enrollment>,
      {} as Repository<ClassSchedule>,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
