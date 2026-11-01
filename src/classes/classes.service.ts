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
import { UserRole } from '../users/entities/user.entity/user.entity.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { CreateClassScheduleDto } from './dto/create-class-schedule.dto.js';
import { UpdateClassScheduleDto } from './dto/update-class-schedule.dto.js';

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
				schedules: { room: true },
			},
			order: { createdAt: 'DESC' },
		});

		return classes.map((schoolClass) => this.toPublicClass(schoolClass));
	}

	async findOne(classId: string, actor: ClassActor) {
		const schoolClass = await this.getClassForActor(classId, actor);
		return this.toPublicClass(schoolClass);
	}

	async create(dto: CreateClassDto) {
		const classCode = dto.classCode.trim();
		const duplicate = await this.classRepository.findOne({
			where: { classCode },
		});

		if (duplicate) {
			throw new ConflictException('Class code already exists');
		}

		const course = await this.getCourse(dto.courseId);
		const teacher = dto.teacherId
			? await this.getTeacher(dto.teacherId)
			: null;
		const schoolClass = this.classRepository.create({
			classCode,
			name: dto.name.trim(),
			status: dto.status?.trim() || 'active',
			course,
			teacher,
		});

		return this.toPublicClass(await this.saveClass(schoolClass));
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
				schedules: { room: true },
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
		});
		if (!room) throw new NotFoundException('Room not found');
		return room;
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
			relations: { room: true },
		});
		if (!withRoom) throw new NotFoundException('Class schedule not found');
		return withRoom;
	}

	private toPublicClass(schoolClass: SchoolClass) {
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
			schedules: (schoolClass.schedules ?? []).map((schedule) =>
				this.toPublicSchedule(schedule),
			),
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
