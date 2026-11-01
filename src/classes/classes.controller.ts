import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { CreateClassScheduleDto } from './dto/create-class-schedule.dto.js';
import { UpdateClassScheduleDto } from './dto/update-class-schedule.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../users/entities/user.entity/user.entity.js';

interface AuthenticatedRequest {
	user?: {
		sub?: string;
		id?: string;
		role?: UserRole;
	};
}

@Controller({ path: 'classes', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TEACHER)
export class ClassesController {
	constructor(private readonly classesService: ClassesService) {}

	@Get()
	findAll(@Req() request: AuthenticatedRequest) {
		return this.classesService.findAll(this.getActor(request));
	}

	@Post()
	@Roles(UserRole.ADMIN)
	create(@Body() dto: CreateClassDto) {
		return this.classesService.create(dto);
	}

	@Get(':classId')
	findOne(
		@Req() request: AuthenticatedRequest,
		@Param('classId', ParseUUIDPipe) classId: string,
	) {
		return this.classesService.findOne(classId, this.getActor(request));
	}

	@Patch(':classId')
	@Roles(UserRole.ADMIN)
	update(
		@Param('classId', ParseUUIDPipe) classId: string,
		@Body() dto: UpdateClassDto,
	) {
		return this.classesService.update(classId, dto);
	}

	@Delete(':classId')
	@Roles(UserRole.ADMIN)
	deactivate(@Param('classId', ParseUUIDPipe) classId: string) {
		return this.classesService.deactivate(classId);
	}

	@Patch(':classId/activate')
	@Roles(UserRole.ADMIN)
	activate(@Param('classId', ParseUUIDPipe) classId: string) {
		return this.classesService.activate(classId);
	}

	@Get(':classId/schedules')
	findSchedules(
		@Req() request: AuthenticatedRequest,
		@Param('classId', ParseUUIDPipe) classId: string,
	) {
		return this.classesService.findSchedules(
			classId,
			this.getActor(request),
		);
	}

	@Post(':classId/schedules')
	@Roles(UserRole.ADMIN)
	createSchedule(
		@Param('classId', ParseUUIDPipe) classId: string,
		@Body() dto: CreateClassScheduleDto,
	) {
		return this.classesService.createSchedule(classId, dto);
	}

	@Patch(':classId/schedules/:scheduleId')
	@Roles(UserRole.ADMIN)
	updateSchedule(
		@Param('classId', ParseUUIDPipe) classId: string,
		@Param('scheduleId', ParseUUIDPipe) scheduleId: string,
		@Body() dto: UpdateClassScheduleDto,
	) {
		return this.classesService.updateSchedule(
			classId,
			scheduleId,
			dto,
		);
	}

	@Delete(':classId/schedules/:scheduleId')
	@Roles(UserRole.ADMIN)
	removeSchedule(
		@Param('classId', ParseUUIDPipe) classId: string,
		@Param('scheduleId', ParseUUIDPipe) scheduleId: string,
	) {
		return this.classesService.removeSchedule(classId, scheduleId);
	}

	private getActor(request: AuthenticatedRequest) {
		const userId = request.user?.sub ?? request.user?.id;

		if (!userId || !request.user?.role) {
			throw new ForbiddenException('Invalid user identity');
		}

		return { userId, role: request.user.role };
	}
}
