import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolClass } from './entities/school-class.entity/school-class.entity.js';
import { ClassSchedule } from './entities/class-schedule.entity/class-schedule.entity.js';
import { Room } from './entities/room.entity/room.entity.js';
import { Course } from '../courses/entities/course.entity/course.entity.js';
import { Teacher } from '../teachers/entities/teacher.entity/teacher.entity.js';
import {
  Enrollment,
  EnrollmentStatus,
} from '../enrollments/entities/enrollment.entity/enrollment.entity.js';
import { EnrollmentStatusHistory } from '../enrollments/entities/enrollment-status-history.entity/enrollment-status-history.entity.js';
import {
  Student,
  StudentStatus,
} from '../students/entities/student.entity/student.entity.js';
import { User, UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { CreateClassScheduleDto } from './dto/create-class-schedule.dto.js';
import { UpdateClassScheduleDto } from './dto/update-class-schedule.dto.js';
import { AddClassStudentDto } from './dto/add-class-student.dto.js';
import { UpdateClassEnrollmentDto } from './dto/update-class-enrollment.dto.js';
import { ClassRegistrationService } from '../class-registration/class-registration.service.js';

interface ClassActor {
	userId: string;
	role: UserRole;
}

@Injectable()
export class ClassesService {
	constructor(
		@InjectRepository(SchoolClass)
		private readonly classRepository: Repository<SchoolClass>,
		@InjectRepository(ClassSchedule)
		private readonly scheduleRepository: Repository<ClassSchedule>,
		@InjectRepository(Room)
		private readonly roomRepository: Repository<Room>,
		@InjectRepository(Course)
		private readonly courseRepository: Repository<Course>,
		@InjectRepository(Teacher)
		private readonly teacherRepository: Repository<Teacher>,
		@InjectRepository(Enrollment)
		private readonly enrollmentRepository: Repository<Enrollment>,
		@InjectRepository(EnrollmentStatusHistory)
		private readonly enrollmentStatusHistoryRepository: Repository<EnrollmentStatusHistory>,
		@InjectRepository(Student)
		private readonly studentRepository: Repository<Student>,
		private readonly classRegistrationService: ClassRegistrationService,
	) {}

	async findAll(actor: ClassActor) {
		const where =
			actor.role === UserRole.ADMIN
				? undefined
				: { teacher: { id: (await this.getTeacherForActor(actor)).id } };

		const classes = await this.classRepository.find({
			where,
			relations: {
				course: true,
				teacher: true,
				schedules: { room: { building: true, floor: true } },
				enrollments: { student: true },
			},
			order: { createdAt: 'DESC' },
		});

		return classes.map((schoolClass) => this.toPublicClass(schoolClass));
	}

	async findOne(classId: string, actor: ClassActor) {
		const schoolClass = await this.getClassForActor(classId, actor);
		return this.toPublicClassDetail(schoolClass);
	}

	async getSummary(classId: string, actor: ClassActor) {
		const schoolClass = await this.getClassForActor(classId, actor);
		const enrollments = schoolClass.enrollments ?? [];
		const activeEnrollments = enrollments.filter(
			(enrollment) => enrollment.status === EnrollmentStatus.ACTIVE,
		);
		const withdrawnEnrollments = enrollments.filter(
			(enrollment) => enrollment.status === EnrollmentStatus.WITHDRAWN,
		);
		const suspendedEnrollments = enrollments.filter(
			(enrollment) => enrollment.status === EnrollmentStatus.SUSPENDED,
		);

		return {
			class: this.toPublicClass(schoolClass),
			stats: {
				totalEnrollments: enrollments.length,
				activeEnrollments: activeEnrollments.length,
				withdrawnEnrollments: withdrawnEnrollments.length,
				suspendedEnrollments: suspendedEnrollments.length,
				scheduleCount: schoolClass.schedules?.length ?? 0,
				hasTeacher: Boolean(schoolClass.teacher),
			},
		};
	}

	async create(dto: CreateClassDto, actor: ClassActor) {
		const classCode = dto.classCode.trim();
		const duplicate = await this.classRepository.findOne({
			where: { classCode },
		});

		if (duplicate) {
			throw new ConflictException('Class code already exists');
		}

		const course = await this.getCourse(dto.courseId);
		const teacher = await this.resolveClassTeacher(dto, actor);
		const schoolClass = this.classRepository.create({
			classCode,
			name: dto.name.trim(),
			status: dto.status?.trim() || 'active',
			course,
			teacher,
		});
		const savedClass = await this.saveClass(schoolClass);

		// A class always starts with a scannable registration QR code.
		const registration =
			await this.classRegistrationService.createJoinCode(
				savedClass.id,
				{ userId: actor.userId, role: actor.role },
				{},
			);

		return {
			...this.toPublicClass(savedClass),
			registration,
		};
	}

	async update(classId: string, dto: UpdateClassDto) {
		const schoolClass = await this.getClassEntity(classId);

		if (dto.classCode !== undefined) {
			const classCode = dto.classCode.trim();
			if (classCode !== schoolClass.classCode) {
				const duplicate = await this.classRepository.findOne({
					where: { classCode },
				});
				if (duplicate) {
					throw new ConflictException('Class code already exists');
				}
				schoolClass.classCode = classCode;
			}
		}

		if (dto.name !== undefined) schoolClass.name = dto.name.trim();
		if (dto.status !== undefined) schoolClass.status = dto.status.trim();
		if (dto.courseId !== undefined) {
			schoolClass.course = await this.getCourse(dto.courseId);
		}
		if (dto.teacherId !== undefined) {
			schoolClass.teacher = dto.teacherId
				? await this.getTeacher(dto.teacherId)
				: null;
		}

		return this.toPublicClass(await this.saveClass(schoolClass));
	}

	async deactivate(classId: string) {
		const schoolClass = await this.getClassEntity(classId);
		schoolClass.status = 'inactive';
		await this.classRepository.save(schoolClass);
		return { message: 'Class deactivated successfully' };
	}

	async activate(classId: string) {
		const schoolClass = await this.getClassEntity(classId);
		schoolClass.status = 'active';
		await this.classRepository.save(schoolClass);
		return { message: 'Class activated successfully' };
	}

	async findSchedules(classId: string, actor: ClassActor) {
		await this.getClassForActor(classId, actor);
		const schedules = await this.scheduleRepository.find({
			where: { schoolClass: { id: classId } },
			relations: { room: true },
			order: { dayOfWeek: 'ASC', startTime: 'ASC' },
		});
		return schedules.map((schedule) => this.toPublicSchedule(schedule));
	}

	async createSchedule(classId: string, dto: CreateClassScheduleDto) {
		const schoolClass = await this.getClassEntity(classId);
		this.validateTimeRange(dto.startTime, dto.endTime);
		const room = dto.roomId ? await this.getRoom(dto.roomId) : null;
		await this.ensureNoScheduleConflict({
			classId,
			teacherId: schoolClass.teacher?.id,
			dayOfWeek: dto.dayOfWeek,
			startTime: dto.startTime,
			endTime: dto.endTime,
			roomId: room?.id,
		});

		const schedule = this.scheduleRepository.create({
			schoolClass,
			room,
			dayOfWeek: dto.dayOfWeek,
			startTime: dto.startTime,
			endTime: dto.endTime,
		});
		return this.toPublicSchedule(await this.saveSchedule(schedule));
	}

	async updateSchedule(
		classId: string,
		scheduleId: string,
		dto: UpdateClassScheduleDto,
	) {
		const schoolClass = await this.getClassEntity(classId);
		const schedule = await this.scheduleRepository.findOne({
			where: { id: scheduleId, schoolClass: { id: classId } },
			relations: { room: true },
		});

		if (!schedule) {
			throw new NotFoundException('Class schedule not found');
		}

		const dayOfWeek = dto.dayOfWeek ?? schedule.dayOfWeek;
		const startTime = dto.startTime ?? schedule.startTime;
		const endTime = dto.endTime ?? schedule.endTime;
		const room =
			dto.roomId === undefined
				? schedule.room
				: dto.roomId
					? await this.getRoom(dto.roomId)
					: null;
		this.validateTimeRange(startTime, endTime);
		await this.ensureNoScheduleConflict({
			classId,
			teacherId: schoolClass.teacher?.id,
			dayOfWeek,
			startTime,
			endTime,
			roomId: room?.id,
			excludedScheduleId: schedule.id,
		});

		schedule.dayOfWeek = dayOfWeek;
		schedule.startTime = startTime;
		schedule.endTime = endTime;
		schedule.room = room;
		return this.toPublicSchedule(await this.saveSchedule(schedule));
	}

	async removeSchedule(classId: string, scheduleId: string) {
		const result = await this.scheduleRepository.delete({
			id: scheduleId,
			schoolClass: { id: classId },
		});

		if (!result.affected) {
			throw new NotFoundException('Class schedule not found');
		}

		return { message: 'Class schedule deleted successfully' };
	}

	async findStudents(classId: string, actor: ClassActor) {
		const schoolClass = await this.getClassForActor(classId, actor);
		const enrollments = await this.enrollmentRepository.find({
			where: { schoolClass: { id: schoolClass.id } },
			relations: {
				student: true,
				statusHistory: true,
			},
			order: { createdAt: 'DESC' },
		});

		return enrollments.map((enrollment) =>
			this.toPublicEnrollment(enrollment),
		);
	}

	async addStudent(
		classId: string,
		dto: AddClassStudentDto,
		actor: ClassActor,
	) {
		const schoolClass = await this.getClassForActor(classId, actor);
		const student = await this.getStudent(dto.studentId);

		if (student.status === StudentStatus.GRADUATED) {
			throw new BadRequestException(
				'A graduated student cannot be enrolled in a class',
			);
		}

		let enrollment = await this.enrollmentRepository.findOne({
			where: {
				student: { id: student.id },
				schoolClass: { id: schoolClass.id },
			},
		});

		if (enrollment?.status === EnrollmentStatus.ACTIVE) {
			throw new ConflictException(
				'Student is already enrolled in this class',
			);
		}

		if (enrollment) {
			const oldStatus = enrollment.status;
			enrollment.status = EnrollmentStatus.ACTIVE;
			enrollment.completedAt = null;
			enrollment = await this.enrollmentRepository.save(enrollment);
			await this.recordEnrollmentStatus(
				enrollment,
				oldStatus,
				EnrollmentStatus.ACTIVE,
				actor.userId,
				'Student re-enrolled in class',
			);
		} else {
			enrollment = await this.enrollmentRepository.save(
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
				actor.userId,
				'Student enrolled in class',
			);
		}

		return this.toPublicEnrollment(enrollment);
	}

	async updateStudent(
		classId: string,
		enrollmentId: string,
		dto: UpdateClassEnrollmentDto,
		actor: ClassActor,
	) {
		if (Object.keys(dto).length === 0) {
			throw new BadRequestException(
				'Provide at least one field to update',
			);
		}

		await this.getClassForActor(classId, actor);
		const enrollment = await this.enrollmentRepository.findOne({
			where: {
				id: enrollmentId,
				schoolClass: { id: classId },
			},
			relations: { student: true, statusHistory: true },
		});

		if (!enrollment) {
			throw new NotFoundException('Enrollment not found');
		}

		const oldStatus = enrollment.status;

		if (dto.status !== undefined && dto.status !== oldStatus) {
			enrollment.status = dto.status;
			enrollment.completedAt =
				dto.status === EnrollmentStatus.WITHDRAWN
					? new Date()
					: null;
			await this.enrollmentRepository.save(enrollment);
			await this.recordEnrollmentStatus(
				enrollment,
				oldStatus,
				dto.status,
				actor.userId,
				dto.reason?.trim() ||
					'Enrollment status updated from class roster',
			);
		}

		return this.toPublicEnrollment(enrollment);
	}

	async removeStudent(
		classId: string,
		enrollmentId: string,
		actor: ClassActor,
	) {
		return this.updateStudent(
			classId,
			enrollmentId,
			{
				status: EnrollmentStatus.WITHDRAWN,
				reason: 'Student removed from class',
			},
			actor,
		);
	}

	private async getClassForActor(classId: string, actor: ClassActor) {
		const schoolClass = await this.getClassEntity(classId);
		if (actor.role === UserRole.ADMIN) return schoolClass;

		const teacher = await this.getTeacherForActor(actor);
		if (schoolClass.teacher?.id !== teacher.id) {
			throw new ForbiddenException('You can only view your own classes');
		}
		return schoolClass;
	}

	private async getClassEntity(classId: string) {
		const schoolClass = await this.classRepository.findOne({
			where: { id: classId },
			relations: {
				course: true,
				teacher: true,
				schedules: { room: { building: true, floor: true } },
				enrollments: { student: true },
			},
		});
		if (!schoolClass) throw new NotFoundException('Class not found');
		return schoolClass;
	}

	private async getCourse(courseId: string) {
		const course = await this.courseRepository.findOne({
			where: { id: courseId },
		});
		if (!course) throw new NotFoundException('Course not found');
		return course;
	}

	private async getTeacher(teacherId: string) {
		const teacher = await this.teacherRepository.findOne({
			where: { id: teacherId },
		});
		if (!teacher) throw new NotFoundException('Teacher not found');
		return teacher;
	}

	private async resolveClassTeacher(
		dto: CreateClassDto,
		actor: ClassActor,
	) {
		const requestedTeacher = dto.teacherId
			? await this.getTeacher(dto.teacherId)
			: null;

		if (actor.role !== UserRole.TEACHER) {
			return requestedTeacher;
		}

		const ownTeacher = await this.getTeacherForActor(actor);

		if (requestedTeacher && requestedTeacher.id !== ownTeacher.id) {
			throw new ForbiddenException(
				'You can only create classes for yourself',
			);
		}

		return ownTeacher;
	}

	private async getTeacherForActor(actor: ClassActor) {
		const teacher = await this.teacherRepository.findOne({
			where: { user: { id: actor.userId } },
		});
		if (!teacher) throw new ForbiddenException('Teacher profile not found');
		return teacher;
	}

	private async getRoom(roomId: string) {
		const room = await this.roomRepository.findOne({
			where: { id: roomId },
			relations: { building: true, floor: true },
		});
		if (!room) throw new NotFoundException('Room not found');
		return room;
	}

	private async getStudent(studentId: string) {
		const student = await this.studentRepository.findOne({
			where: { id: studentId },
		});
		if (!student) throw new NotFoundException('Student not found');
		return student;
	}

	private async recordEnrollmentStatus(
		enrollment: Enrollment,
		oldStatus: EnrollmentStatus | null,
		newStatus: EnrollmentStatus,
		changedByUserId: string,
		reason: string,
	) {
		const history = this.enrollmentStatusHistoryRepository.create({
			enrollment,
			oldStatus,
			newStatus,
			reason,
		});
		history.changedByUser = { id: changedByUserId } as User;
		await this.enrollmentStatusHistoryRepository.save(history);
	}

	private validateTimeRange(startTime: string, endTime: string) {
		if (this.timeInSeconds(endTime) <= this.timeInSeconds(startTime)) {
			throw new BadRequestException('End time must be after start time');
		}
	}

	private async ensureNoScheduleConflict(input: {
		classId: string;
		teacherId?: string;
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		roomId?: string;
		excludedScheduleId?: string;
	}) {
		const query = this.scheduleRepository
			.createQueryBuilder('schedule')
			.innerJoin('schedule.schoolClass', 'scheduledClass')
			.where('schedule.day_of_week = :dayOfWeek', {
				dayOfWeek: input.dayOfWeek,
			})
			.andWhere('schedule.start_time < :endTime', {
				endTime: input.endTime,
			})
			.andWhere('schedule.end_time > :startTime', {
				startTime: input.startTime,
			});
		const conditions = ['schedule.class_id = :classId'];
		const parameters: Record<string, string> = { classId: input.classId };

		if (input.roomId) {
			conditions.push('schedule.room_id = :roomId');
			parameters.roomId = input.roomId;
		}
		if (input.teacherId) {
			conditions.push('scheduledClass.teacher_id = :teacherId');
			parameters.teacherId = input.teacherId;
		}
		query.andWhere(`(${conditions.join(' OR ')})`, parameters);

		if (input.excludedScheduleId) {
			query.andWhere('schedule.id != :excludedScheduleId', {
				excludedScheduleId: input.excludedScheduleId,
			});
		}

		if (await query.getOne()) {
			throw new ConflictException(
				'The class, teacher, or room already has a schedule at this time',
			);
		}
	}

	private timeInSeconds(value: string) {
		const [hours, minutes, seconds = '0'] = value.split(':');
		return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
	}

	private async saveClass(schoolClass: SchoolClass) {
		try {
			const saved = await this.classRepository.save(schoolClass);
			return this.getClassEntity(saved.id);
		} catch (error) {
			if (this.isUniqueViolation(error)) {
				throw new ConflictException('Class code already exists');
			}
			throw error;
		}
	}

	private async saveSchedule(schedule: ClassSchedule) {
		const saved = await this.scheduleRepository.save(schedule);
		const withRoom = await this.scheduleRepository.findOne({
			where: { id: saved.id },
			relations: { room: { building: true, floor: true } },
		});
		if (!withRoom) throw new NotFoundException('Class schedule not found');
		return withRoom;
	}

	private toPublicClass(schoolClass: SchoolClass) {
		const enrollments = schoolClass.enrollments ?? [];

		return {
			id: schoolClass.id,
			classCode: schoolClass.classCode,
			name: schoolClass.name,
			status: schoolClass.status,
			createdAt: schoolClass.createdAt,
			updatedAt: schoolClass.updatedAt,
			course: schoolClass.course
				? { id: schoolClass.course.id, name: schoolClass.course.name }
				: null,
			teacher: schoolClass.teacher
				? {
						id: schoolClass.teacher.id,
						teacherNumber: schoolClass.teacher.teacherNumber,
						firstName: schoolClass.teacher.firstName,
						lastName: schoolClass.teacher.lastName,
					}
				: null,
			enrollmentSummary: {
				total: enrollments.length,
				active: enrollments.filter(
					(enrollment) =>
						enrollment.status === EnrollmentStatus.ACTIVE,
				).length,
				withdrawn: enrollments.filter(
					(enrollment) =>
						enrollment.status === EnrollmentStatus.WITHDRAWN,
				).length,
				suspended: enrollments.filter(
					(enrollment) =>
						enrollment.status === EnrollmentStatus.SUSPENDED,
				).length,
			},
			schedules: (schoolClass.schedules ?? []).map((schedule) =>
				this.toPublicSchedule(schedule),
			),
		};
	}

	private toPublicClassDetail(schoolClass: SchoolClass) {
		return {
			...this.toPublicClass(schoolClass),
			enrollments: (schoolClass.enrollments ?? []).map((enrollment) =>
				this.toPublicEnrollment(enrollment),
			),
		};
	}

	private toPublicEnrollment(enrollment: Enrollment) {
		return {
			id: enrollment.id,
			status: enrollment.status,
			enrolledAt: enrollment.createdAt,
			completedAt: enrollment.completedAt,
			createdAt: enrollment.createdAt,
			updatedAt: enrollment.updatedAt,
			student: enrollment.student
				? {
						id: enrollment.student.id,
						studentNumber: enrollment.student.studentNumber,
						firstName: enrollment.student.firstName,
						lastName: enrollment.student.lastName,
						email: enrollment.student.email,
						status: enrollment.student.status,
					}
				: null,
			statusHistory: (enrollment.statusHistory ?? []).map((entry) => ({
				id: entry.id,
				oldStatus: entry.oldStatus,
				newStatus: entry.newStatus,
				reason: entry.reason,
				createdAt: entry.createdAt,
			})),
		};
	}

	private toPublicSchedule(schedule: ClassSchedule) {
		return {
			id: schedule.id,
			dayOfWeek: schedule.dayOfWeek,
			startTime: schedule.startTime,
			endTime: schedule.endTime,
			createdAt: schedule.createdAt,
			updatedAt: schedule.updatedAt,
			room: schedule.room
				? {
						id: schedule.room.id,
						roomCode: schedule.room.roomCode,
						name: schedule.room.name,
						capacity: schedule.room.capacity,
						building: schedule.room.building
							? {
									id: schedule.room.building.id,
									name: schedule.room.building.name,
								}
							: null,
						floor: schedule.room.floor
							? {
									id: schedule.room.floor.id,
									floorNumber: schedule.room.floor.floorNumber,
									name: schedule.room.floor.name,
								}
							: null,
					}
				: null,
		};
	}

	private isUniqueViolation(error: unknown) {
		if (typeof error !== 'object' || error === null) return false;
		const codedError = error as {
			code?: string;
			driverError?: { code?: string };
		};
		return (
			codedError.code === '23505' || codedError.driverError?.code === '23505'
		);
	}
}
