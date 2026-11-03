import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import {
  IsNull,
  Repository,
} from 'typeorm';

import { Attendance } from './entities/attendance.entity/attendance.entity.js';

import { Enrollment } from '../enrollments/entities/enrollment.entity/enrollment.entity.js';

import { ClassSchedule } from '../classes/entities/class-schedule.entity/class-schedule.entity.js';

import { CreateAttendanceDto } from './dto/create-attendance.dto.js';

import { UpdateAttendanceDto } from './dto/update-attendance.dto.js';

import { QueryAttendanceDto } from './dto/query-attendance.dto.js';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,

    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,

    @InjectRepository(ClassSchedule)
    private readonly classScheduleRepository: Repository<ClassSchedule>,
  ) {}

  // CREATE ATTENDANCE
  async create(
    createAttendanceDto: CreateAttendanceDto,
  ): Promise<Attendance> {
    const {
      enrollmentId,
      classScheduleId,
      attendanceDate,
      ...attendanceData
    } = createAttendanceDto;

    // 1. Check whether the enrollment exists.
    const enrollment = await this.enrollmentRepository.findOneBy({
      id: enrollmentId,
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} was not found`,
      );
    }

    // 2. Check whether the class schedule exists.
    let classSchedule: ClassSchedule | null = null;

    if (classScheduleId) {
      const foundClassSchedule =
        await this.classScheduleRepository.findOneBy({
          id: classScheduleId,
        });

      if (!foundClassSchedule) {
        throw new NotFoundException(
          `Class schedule with ID ${classScheduleId} was not found`,
        );
      }

      classSchedule = foundClassSchedule;
    }

    // 3. Prevent duplicate attendance for the same
    // enrollment, date, and class schedule.
    const existingAttendance =
      await this.attendanceRepository.findOne({
        where: {
          enrollment: { id: enrollmentId },
          attendanceDate,
          classSchedule: classScheduleId
            ? { id: classScheduleId }
            : IsNull(),
        },
      });

    if (existingAttendance) {
      throw new BadRequestException(
        'Attendance already exists for this enrollment, date, and class session',
      );
    }

    // 4. Create the attendance record.
    const attendance = this.attendanceRepository.create({
      ...attendanceData,
      attendanceDate,
      enrollment,
      classSchedule,
    });

    // 5. Save it to PostgreSQL.
    return this.attendanceRepository.save(attendance);
  }

  // GET ALL ATTENDANCE WITH FILTERS
  async findAll(
    query: QueryAttendanceDto,
  ): Promise<Attendance[]> {
    const {
      attendanceDate,
      status,
      enrollmentId,
      classScheduleId,
    } = query;

    const where: Record<string, unknown> = {};

    if (attendanceDate) {
      where['attendanceDate'] = attendanceDate;
    }

    if (status) {
      where['status'] = status;
    }

    if (enrollmentId) {
      where['enrollment'] = { id: enrollmentId };
    }

    if (classScheduleId) {
      where['classSchedule'] = { id: classScheduleId };
    }

    return this.attendanceRepository.find({
      where,
      relations: {
        enrollment: true,
        classSchedule: true,
      },
      order: {
        attendanceDate: 'DESC',
        createdAt: 'DESC',
      },
    });
  }

  // GET ONE ATTENDANCE RECORD
  async findOne(id: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne({
      where: { id },
      relations: {
        enrollment: true,
        classSchedule: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException(
        `Attendance with ID ${id} was not found`,
      );
    }

    return attendance;
  }

  // GET ATTENDANCE BY ENROLLMENT
  async findByEnrollment(
    enrollmentId: string,
  ): Promise<Attendance[]> {
    const enrollment = await this.enrollmentRepository.findOneBy({
      id: enrollmentId,
    });

    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${enrollmentId} was not found`,
      );
    }

    return this.attendanceRepository.find({
      where: {
        enrollment: { id: enrollmentId },
      },
      relations: {
        enrollment: true,
        classSchedule: true,
      },
      order: {
        attendanceDate: 'DESC',
      },
    });
  }

  // GET ATTENDANCE BY CLASS SCHEDULE
  async findByClassSchedule(
    classScheduleId: string,
  ): Promise<Attendance[]> {
    const classSchedule = await this.classScheduleRepository.findOneBy({
      id: classScheduleId,
    });

    if (!classSchedule) {
      throw new NotFoundException(
        `Class schedule with ID ${classScheduleId} was not found`,
      );
    }

    return this.attendanceRepository.find({
      where: {
        classSchedule: { id: classScheduleId },
      },
      relations: {
        enrollment: true,
        classSchedule: true,
      },
      order: {
        attendanceDate: 'DESC',
      },
    });
  }

  // UPDATE ATTENDANCE
  async update(
    id: string,
    updateAttendanceDto: UpdateAttendanceDto,
  ): Promise<Attendance> {
    // Make sure the attendance record exists.
    const attendance = await this.findOne(id);

    const {
      enrollmentId,
      classScheduleId,
      ...attendanceData
    } = updateAttendanceDto;

    // Update enrollment if a new enrollment ID was supplied.
    if (enrollmentId !== undefined) {
      const enrollment = await this.enrollmentRepository.findOneBy({
        id: enrollmentId,
      });

      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} was not found`,
        );
      }

      attendance.enrollment = enrollment;
    }

    // Update the class schedule if supplied.
    // Explicit null removes the association.
    if (classScheduleId !== undefined) {
      if (classScheduleId === null) {
        attendance.classSchedule = null;
      } else {
        const classSchedule =
          await this.classScheduleRepository.findOneBy({
            id: classScheduleId,
          });

        if (!classSchedule) {
          throw new NotFoundException(
            `Class schedule with ID ${classScheduleId} was not found`,
          );
        }

        attendance.classSchedule = classSchedule;
      }
    }

    Object.assign(attendance, attendanceData);

    // Save the changes.
    return this.attendanceRepository.save(attendance);
  }

  // DELETE ATTENDANCE
  async remove(id: string): Promise<{ message: string }> {
    const attendance = await this.findOne(id);

    await this.attendanceRepository.remove(attendance);

    return {
      message: 'Attendance deleted successfully',
    };
  }
}