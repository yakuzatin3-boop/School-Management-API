import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';

import { User, UserRole } from '../../users/entities/user.entity/user.entity.js';
import { Teacher } from '../../teachers/entities/teacher.entity/teacher.entity.js';
import {
  Student,
  StudentStatus,
} from '../../students/entities/student.entity/student.entity.js';
import { SchoolClass } from '../../classes/entities/school-class.entity/school-class.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../../enrollments/entities/enrollment.entity/enrollment.entity.js';

export interface AcademicActor {
  userId: string;
  role: UserRole;
}

@Injectable()
export class AcademicAccessService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Teacher)
    private readonly teacherRepository: Repository<Teacher>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(SchoolClass)
    private readonly schoolClassRepository: Repository<SchoolClass>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
  ) {}

  async getUser(userId: string) {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getTeacher(teacherId: string) {
    const teacher = await this.teacherRepository.findOne({
      where: { id: teacherId },
      relations: { user: true },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher;
  }

  async getStudent(studentId: string) {
    const student = await this.studentRepository.findOne({
      where: { id: studentId },
      relations: { user: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  async getSchoolClass(
    classId: string,
    relations: FindOptionsRelations<SchoolClass> = {
      course: true,
      teacher: true,
    },
  ) {
    const schoolClass = await this.schoolClassRepository.findOne({
      where: { id: classId },
      relations,
    });

    if (!schoolClass) {
      throw new NotFoundException('Class not found');
    }

    return schoolClass;
  }

  async getTeacherForActor(userId: string) {
    const teacher = await this.teacherRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!teacher) {
      throw new ForbiddenException('Teacher profile not found');
    }

    return teacher;
  }

  async getStudentForActor(userId: string) {
    const student = await this.studentRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!student) {
      throw new ForbiddenException('Student profile not found');
    }

    return student;
  }

  async getActiveStudentForActor(userId: string) {
    const student = await this.getStudentForActor(userId);

    if (student.status === StudentStatus.GRADUATED) {
      throw new ForbiddenException('Graduated students cannot perform this action');
    }

    return student;
  }

  async assertCanManageClass(actor: AcademicActor, schoolClass: SchoolClass) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role !== UserRole.TEACHER) {
      throw new ForbiddenException('You do not have permission');
    }

    const teacher = await this.getTeacherForActor(actor.userId);

    if (!schoolClass.teacher || schoolClass.teacher.id !== teacher.id) {
      throw new ForbiddenException('You can only manage your own classes');
    }
  }

  async assertCanAccessClass(actor: AcademicActor, schoolClass: SchoolClass) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }

    if (actor.role === UserRole.TEACHER) {
      const teacher = await this.getTeacherForActor(actor.userId);

      if (!schoolClass.teacher || schoolClass.teacher.id !== teacher.id) {
        throw new ForbiddenException('You can only access your own classes');
      }

      return;
    }

    await this.assertStudentEnrolledInClass(actor.userId, schoolClass.id);
  }

  async assertStudentEnrolledInClass(userId: string, classId: string) {
    const student = await this.getStudentForActor(userId);
    const enrollment = await this.findEnrollment(student.id, classId);

    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this class');
    }

    return enrollment;
  }

  async findEnrollment(studentId: string, classId: string) {
    return this.enrollmentRepository.findOne({
      where: {
        student: { id: studentId },
        schoolClass: { id: classId },
      },
      relations: {
        student: true,
        schoolClass: {
          course: true,
          teacher: true,
        },
      },
    });
  }

  isActiveEnrollment(enrollment: Enrollment | null) {
    return enrollment?.status === EnrollmentStatus.ACTIVE;
  }

  toUserSummary(user: User | null) {
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  toStudentSummary(student: Student | null) {
    if (!student) {
      return null;
    }

    return {
      id: student.id,
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      status: student.status,
    };
  }

  toTeacherSummary(teacher: Teacher | null) {
    if (!teacher) {
      return null;
    }

    return {
      id: teacher.id,
      teacherNumber: teacher.teacherNumber,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      status: teacher.status,
    };
  }

  toClassSummary(schoolClass: SchoolClass | null) {
    if (!schoolClass) {
      return null;
    }

    return {
      id: schoolClass.id,
      classCode: schoolClass.classCode,
      name: schoolClass.name,
      status: schoolClass.status,
      course: schoolClass.course
        ? {
            id: schoolClass.course.id,
            name: schoolClass.course.name,
          }
        : null,
      teacher: this.toTeacherSummary(schoolClass.teacher),
    };
  }
}
