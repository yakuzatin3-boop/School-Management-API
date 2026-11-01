import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Student,
  StudentStatus,
} from './entities/student.entity/student.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import { SchoolClass } from '../classes/entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from '../classes/entities/class-schedule.entity/class-schedule.entity.js';
import {
  Attendance,
  AttendanceStatus,
} from '../attendance/entities/attendance.entity/attendance.entity.js';
import { Assignment } from '../assignments/entities/assignment.entity/assignment.entity.js';
import { Submission } from '../submissions/entities/submission.entity/submission.entity.js';
import { Score } from '../grading/entities/score.entity/score.entity.js';
import { GradeScale } from '../grading/entities/grade-scale.entity/grade-scale.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto.js';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto.js';
import { EnrollStudentDto } from './dto/enroll-student.dto.js';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto.js';
import { CreateAttendanceDto } from './dto/create-attendance.dto.js';
import { CreateScoreDto } from './dto/create-score.dto.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(EnrollmentStatusHistory)
    private readonly enrollmentStatusHistoryRepository: Repository<EnrollmentStatusHistory>,
    @InjectRepository(SchoolClass)
    private readonly schoolClassRepository: Repository<SchoolClass>,
    @InjectRepository(ClassSchedule)
    private readonly classScheduleRepository: Repository<ClassSchedule>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Assignment)
    private readonly assignmentRepository: Repository<Assignment>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Score)
    private readonly scoreRepository: Repository<Score>,
    @InjectRepository(GradeScale)
    private readonly gradeScaleRepository: Repository<GradeScale>,
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
  ) {}

  async create(createStudentDto: CreateStudentDto) {
    const studentNumber = createStudentDto.studentNumber.trim();
    const user = await this.resolveStudentUser(createStudentDto.userId);
    const email =
      createStudentDto.email?.trim().toLowerCase() ?? user?.email;

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    await this.ensureStudentNumberAvailable(studentNumber);
    await this.ensureEmailAvailable(email);

    const student = this.studentRepository.create({
      studentNumber,
      firstName: createStudentDto.firstName.trim(),
      lastName: createStudentDto.lastName.trim(),
      email,
      phoneNumber: createStudentDto.phoneNumber?.trim() || null,
      dateOfBirth: createStudentDto.dateOfBirth ?? null,
      gender: createStudentDto.gender ?? null,
      address: createStudentDto.address?.trim() || null,
      guardianName: createStudentDto.guardianName?.trim() || null,
      guardianPhone: createStudentDto.guardianPhone?.trim() || null,
      status: createStudentDto.status ?? StudentStatus.ACTIVE,
    });

    student.user = user;

    return this.toPublicStudent(
      await this.studentRepository.save(student),
    );
  }

  async createProfile(
    userId: string,
    createStudentProfileDto: CreateStudentProfileDto,
  ) {
    const user = await this.resolveStudentUser(userId);

    if (!user) {
      throw new BadRequestException('Student account is required');
    }

    const studentNumber =
      createStudentProfileDto.studentNumber.trim();
    const email =
      createStudentProfileDto.email?.trim().toLowerCase() ??
      user.email;

    await this.ensureStudentNumberAvailable(studentNumber);
    await this.ensureEmailAvailable(email);

    const student = this.studentRepository.create({
      studentNumber,
      firstName: createStudentProfileDto.firstName.trim(),
      lastName: createStudentProfileDto.lastName.trim(),
      email,
      phoneNumber:
        createStudentProfileDto.phoneNumber?.trim() || null,
      dateOfBirth: createStudentProfileDto.dateOfBirth ?? null,
      gender: createStudentProfileDto.gender ?? null,
      address: createStudentProfileDto.address?.trim() || null,
      guardianName:
        createStudentProfileDto.guardianName?.trim() || null,
      guardianPhone:
        createStudentProfileDto.guardianPhone?.trim() || null,
      status: StudentStatus.ACTIVE,
    });

    student.user = user;

    return this.toPublicStudent(
      await this.studentRepository.save(student),
    );
  }

  async findAll() {
    const students = await this.studentRepository.find({
      relations: {
        user: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return students.map((student) => this.toPublicStudent(student));
  }

  async findOne(id: string) {
    const student = await this.getStudentEntity(id);

    return this.toPublicStudent(student);
  }

  async findProfile(userId: string) {
    const student = await this.findProfileEntity(userId);

    return this.toPublicStudent(student);
  }

  async update(id: string, updateStudentDto: UpdateStudentDto) {
    const student = await this.getStudentEntity(id);

    if (updateStudentDto.studentNumber !== undefined) {
      const studentNumber = updateStudentDto.studentNumber.trim();

      if (studentNumber !== student.studentNumber) {
        await this.ensureStudentNumberAvailable(studentNumber);
        student.studentNumber = studentNumber;
      }
    }

    if (updateStudentDto.email !== undefined) {
      const email = updateStudentDto.email.trim().toLowerCase();

      if (email !== student.email) {
        await this.ensureEmailAvailable(email);
        student.email = email;
      }
    }

    if (updateStudentDto.userId !== undefined) {
      student.user = await this.resolveStudentUser(
        updateStudentDto.userId,
        id,
      );
    }

    if (updateStudentDto.firstName !== undefined) {
      student.firstName = updateStudentDto.firstName.trim();
    }

    if (updateStudentDto.lastName !== undefined) {
      student.lastName = updateStudentDto.lastName.trim();
    }

    if (updateStudentDto.phoneNumber !== undefined) {
      student.phoneNumber =
        updateStudentDto.phoneNumber.trim() || null;
    }

    if (updateStudentDto.dateOfBirth !== undefined) {
      student.dateOfBirth = updateStudentDto.dateOfBirth;
    }

    if (updateStudentDto.gender !== undefined) {
      student.gender = updateStudentDto.gender ?? null;
    }

    if (updateStudentDto.address !== undefined) {
      student.address = updateStudentDto.address?.trim() || null;
    }

    if (updateStudentDto.guardianName !== undefined) {
      student.guardianName =
        updateStudentDto.guardianName?.trim() || null;
    }

    if (updateStudentDto.guardianPhone !== undefined) {
      student.guardianPhone =
        updateStudentDto.guardianPhone?.trim() || null;
    }

    if (updateStudentDto.status !== undefined) {
      student.status = updateStudentDto.status;
    }

    return this.toPublicStudent(
      await this.studentRepository.save(student),
    );
  }

  async updateProfile(
    userId: string,
    updateStudentProfileDto: UpdateStudentProfileDto,
  ) {
    const student = await this.findProfileEntity(userId);

    return this.update(student.id, updateStudentProfileDto);
  }

  async remove(id: string) {
    const student = await this.getStudentEntity(id);

    await this.studentRepository.remove(student);

    return {
      message: 'Student deleted successfully',
    };
  }

  async enroll(
    studentId: string,
    enrollStudentDto: EnrollStudentDto,
    changedByUserId?: string,
    actorRole?: UserRole,
  ) {
    const student = await this.getStudentEntity(studentId);

    if (student.status === StudentStatus.GRADUATED) {
      throw new BadRequestException(
        'A graduated student cannot be enrolled',
      );
    }

    const schoolClass = await this.getSchoolClass(
      enrollStudentDto.classId,
    );

    if (actorRole === UserRole.TEACHER) {
      await this.ensureTeacherOwnsClass(
        changedByUserId,
        schoolClass,
      );
    }

    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: {
        student: {
          id: studentId,
        },
        schoolClass: {
          id: schoolClass.id,
        },
      },
    });

    if (existingEnrollment) {
      throw new ConflictException(
        'Student is already enrolled in this class',
      );
    }

    const enrollment = await this.enrollmentRepository.save(
      this.enrollmentRepository.create({
        student,
        schoolClass,
        status: EnrollmentStatus.ACTIVE,
      }),
    );

    await this.recordEnrollmentStatus(
      enrollment,
      null,
      EnrollmentStatus.ACTIVE,
      changedByUserId,
      'Student enrolled in class',
    );

    return enrollment;
  }

  async findEnrollments(studentId: string) {
    await this.getStudentEntity(studentId);

    return this.enrollmentRepository.find({
      where: {
        student: {
          id: studentId,
        },
      },
      relations: {
        schoolClass: {
          course: true,
          teacher: true,
        },
        statusHistory: true,
        attendance: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async updateEnrollment(
    studentId: string,
    enrollmentId: string,
    updateEnrollmentDto: UpdateEnrollmentDto,
    changedByUserId?: string,
  ) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: enrollmentId,
        student: {
          id: studentId,
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    const oldStatus = enrollment.status;

    if (updateEnrollmentDto.status !== undefined) {
      enrollment.status = updateEnrollmentDto.status;

      enrollment.completedAt =
        updateEnrollmentDto.status === EnrollmentStatus.WITHDRAWN
          ? new Date()
          : null;
    }

    const savedEnrollment =
      await this.enrollmentRepository.save(enrollment);

    if (
      updateEnrollmentDto.status !== undefined &&
      updateEnrollmentDto.status !== oldStatus
    ) {
      await this.recordEnrollmentStatus(
        savedEnrollment,
        oldStatus,
        updateEnrollmentDto.status,
        changedByUserId,
        'Enrollment status updated',
      );
    }

    return savedEnrollment;
  }

  async recordAttendance(
    studentId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    await this.getStudentEntity(studentId);

    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        id: createAttendanceDto.enrollmentId,
        student: {
          id: studentId,
        },
      },
      relations: {
        schoolClass: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(
        'Enrollment not found for this student',
      );
    }

    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException(
        'Attendance can only be recorded for an active enrollment',
      );
    }

    let classSchedule: ClassSchedule | null = null;

    if (createAttendanceDto.classScheduleId) {
      classSchedule = await this.classScheduleRepository.findOne({
        where: {
          id: createAttendanceDto.classScheduleId,
        },
        relations: {
          schoolClass: true,
        },
      });

      if (!classSchedule) {
        throw new NotFoundException('Class schedule not found');
      }

      if (
        classSchedule.schoolClass.id !== enrollment.schoolClass.id
      ) {
        throw new BadRequestException(
          'Class schedule does not belong to the enrollment class',
        );
      }
    }

    const existingAttendance = await this.attendanceRepository.findOne({
      where: {
        enrollment: {
          id: enrollment.id,
        },
        attendanceDate: createAttendanceDto.attendanceDate,
        ...(classSchedule
          ? { classSchedule: { id: classSchedule.id } }
          : {}),
      },
    });

    if (existingAttendance) {
      throw new ConflictException(
        'Attendance already recorded for this date',
      );
    }

    return this.attendanceRepository.save(
      this.attendanceRepository.create({
        enrollment,
        classSchedule,
        attendanceDate: createAttendanceDto.attendanceDate,
        status: createAttendanceDto.status,
        remarks: createAttendanceDto.remarks?.trim() || null,
      }),
    );
  }

  async findAttendance(studentId: string) {
    await this.getStudentEntity(studentId);

    return this.attendanceRepository.find({
      where: {
        enrollment: {
          student: {
            id: studentId,
          },
        },
      },
      relations: {
        enrollment: {
          schoolClass: true,
        },
        classSchedule: true,
      },
      order: {
        attendanceDate: 'DESC',
      },
    });
  }

  async recordScore(studentId: string, createScoreDto: CreateScoreDto) {
    const student = await this.getStudentEntity(studentId);

    const assignment = await this.assignmentRepository.findOne({
      where: {
        id: createScoreDto.assignmentId,
      },
      relations: {
        schoolClass: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: {
        student: {
          id: studentId,
        },
        schoolClass: {
          id: assignment.schoolClass.id,
        },
      },
    });

    if (!enrollment) {
      throw new BadRequestException(
        'Student is not enrolled in the assignment class',
      );
    }

    if (createScoreDto.score > Number(assignment.maxScore)) {
      throw new BadRequestException(
        `Score cannot exceed the assignment maximum of ${assignment.maxScore}`,
      );
    }

    let gradeScale: GradeScale | null = null;

    if (createScoreDto.gradeScaleId) {
      gradeScale = await this.gradeScaleRepository.findOneBy({
        id: createScoreDto.gradeScaleId,
      });

      if (!gradeScale) {
        throw new NotFoundException('Grade scale not found');
      }
    }

    let gradedByTeacher: Teacher | null = null;

    if (createScoreDto.gradedByTeacherId) {
      gradedByTeacher = await this.teacherRepository.findOneBy({
        id: createScoreDto.gradedByTeacherId,
      });

      if (!gradedByTeacher) {
        throw new NotFoundException('Teacher not found');
      }
    }

    let submission = await this.submissionRepository.findOne({
      where: {
        student: {
          id: student.id,
        },
        assignment: {
          id: assignment.id,
        },
      },
    });

    if (!submission) {
      submission = await this.submissionRepository.save(
        this.submissionRepository.create({
          student,
          assignment,
          content: null,
          status: 'graded',
          isLate: false,
        }),
      );
    } else if (submission.status !== 'graded') {
      submission.status = 'graded';
      submission = await this.submissionRepository.save(submission);
    }

    let score = await this.scoreRepository.findOne({
      where: {
        submission: {
          id: submission.id,
        },
      },
    });

    if (score) {
      score.score = createScoreDto.score;
      score.feedback = createScoreDto.feedback?.trim() || null;
      score.gradeScale = gradeScale;
      score.gradedByTeacher = gradedByTeacher;
      score.gradedAt = new Date();
    } else {
      score = this.scoreRepository.create({
        submission,
        score: createScoreDto.score,
        feedback: createScoreDto.feedback?.trim() || null,
        gradeScale,
        gradedByTeacher,
      });
    }

    return this.scoreRepository.save(score);
  }

  async findScores(studentId: string) {
    await this.getStudentEntity(studentId);

    const submissions = await this.submissionRepository.find({
      where: {
        student: {
          id: studentId,
        },
      },
      relations: {
        assignment: {
          schoolClass: true,
        },
        scores: {
          gradeScale: true,
          gradedByTeacher: true,
        },
      },
      order: {
        submittedAt: 'DESC',
      },
    });

    return submissions.flatMap((submission) =>
      submission.scores.map((score) =>
        Object.assign({}, score, {
          assignment: submission.assignment,
          submissionStatus: submission.status,
          submittedAt: submission.submittedAt,
        }),
      ),
    );
  }

  async getAcademicHistory(studentId: string) {
    const student = await this.getStudentEntity(studentId);

    const [enrollments, attendance, scores] = await Promise.all([
      this.enrollmentRepository.find({
        where: {
          student: {
            id: studentId,
          },
        },
        relations: {
          schoolClass: {
            course: true,
            teacher: true,
          },
        },
        order: {
          createdAt: 'DESC',
        },
      }),
      this.attendanceRepository.find({
        where: {
          enrollment: {
            student: {
              id: studentId,
            },
          },
        },
        relations: {
          enrollment: {
            schoolClass: true,
          },
          classSchedule: true,
        },
        order: {
          attendanceDate: 'DESC',
        },
      }),
      this.findScores(studentId),
    ]);

    const attendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: attendance.length,
    };

    for (const record of attendance) {
      if (record.status === AttendanceStatus.PRESENT) {
        attendanceSummary.present += 1;
      } else if (record.status === AttendanceStatus.ABSENT) {
        attendanceSummary.absent += 1;
      } else if (record.status === AttendanceStatus.LATE) {
        attendanceSummary.late += 1;
      } else if (record.status === AttendanceStatus.EXCUSED) {
        attendanceSummary.excused += 1;
      }
    }

    const averageScore =
      scores.length > 0
        ? scores.reduce(
            (total, score) => total + Number(score.score),
            0,
          ) / scores.length
        : null;

    return {
      student: this.toPublicStudent(student),
      enrollments,
      attendance,
      scores,
      summary: {
        totalEnrollments: enrollments.length,
        completedEnrollments: enrollments.filter(
          (enrollment) => enrollment.completedAt !== null,
        ).length,
        attendance: attendanceSummary,
        totalScores: scores.length,
        averageScore:
          averageScore === null
            ? null
            : Number(averageScore.toFixed(2)),
      },
    };
  }

  async graduate(studentId: string) {
    const student = await this.getStudentEntity(studentId);

    if (student.status === StudentStatus.GRADUATED) {
      throw new BadRequestException(
        'Student has already graduated',
      );
    }

    const enrollments = await this.enrollmentRepository.find({
      where: {
        student: {
          id: studentId,
        },
        status: EnrollmentStatus.ACTIVE,
      },
    });

    const graduatedAt = new Date();

    for (const enrollment of enrollments) {
      enrollment.completedAt = graduatedAt;
    }

    if (enrollments.length > 0) {
      await this.enrollmentRepository.save(enrollments);
    }

    student.status = StudentStatus.GRADUATED;
    await this.studentRepository.save(student);

    return {
      message: 'Student graduated successfully',
      graduatedAt,
      completedEnrollments: enrollments.length,
      student: this.toPublicStudent(student),
    };
  }

  private async recordEnrollmentStatus(
    enrollment: Enrollment,
    oldStatus: EnrollmentStatus | null,
    newStatus: EnrollmentStatus,
    changedByUserId?: string,
    reason?: string,
  ) {
    const history = this.enrollmentStatusHistoryRepository.create({
      enrollment,
      oldStatus,
      newStatus,
      reason: reason ?? null,
    });

    if (changedByUserId) {
      history.changedByUser = {
        id: changedByUserId,
      } as User;
    }

    await this.enrollmentStatusHistoryRepository.save(history);
  }

  private async getSchoolClass(classId: string) {
    const schoolClass = await this.schoolClassRepository.findOne({
      where: { id: classId },
      relations: { teacher: true },
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  private async ensureTeacherOwnsClass(
    userId: string | undefined,
    schoolClass: SchoolClass,
  ) {
    if (!userId) {
      throw new ForbiddenException('Invalid user identity');
    }

    const teacher = await this.teacherRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }

    if (!schoolClass.teacher || schoolClass.teacher.id !== teacher.id) {
      throw new ForbiddenException(
        'You can only add students to your own classes',
      );
    }
  }

  private async ensureStudentNumberAvailable(studentNumber: string) {
    const existingStudent = await this.studentRepository.findOneBy({
      studentNumber,
    });

    if (existingStudent) {
      throw new ConflictException('Student number already exists');
    }
  }

  private async ensureEmailAvailable(email: string) {
    const existingStudent = await this.studentRepository.findOneBy({
      email,
    });

    if (existingStudent) {
      throw new ConflictException('Student email already exists');
    }
  }

  private async getStudentEntity(id: string) {
    const student = await this.studentRepository.findOne({
      where: { id },
      relations: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  private async findProfileEntity(userId: string) {
    const student = await this.studentRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
      relations: {
        user: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    return student;
  }

  private async resolveStudentUser(
    userId?: string,
    currentStudentId?: string,
  ) {
    if (!userId) {
      return null;
    }

    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        'User must have the student role',
      );
    }

    const linkedStudent = await this.studentRepository.findOne({
      where: {
        user: {
          id: userId,
        },
      },
    });

    if (linkedStudent && linkedStudent.id !== currentStudentId) {
      throw new ConflictException(
        'User is already linked to another student',
      );
    }

    return user;
  }

  private toPublicStudent(student: Student) {
    const { user, ...safeStudent } = student;

    return {
      ...safeStudent,
      user: user ? this.toPublicUser(user) : null,
    };
  }

  private toPublicUser(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
