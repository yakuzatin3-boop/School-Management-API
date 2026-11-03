import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Room } from '../entities/room.entity/room.entity.js';
import { Building } from '../entities/building.entity/building.entity.js';
import { Floor } from '../entities/floor.entity/floor.entity.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { ListRoomsQueryDto } from './dto/list-rooms-query.dto.js';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
    @InjectRepository(Floor)
    private readonly floorRepository: Repository<Floor>,
  ) {}

  async create(dto: CreateRoomDto) {
    const building = await this.getBuilding(dto.buildingId);
    const floor = await this.getFloor(dto.floorId);
    this.ensureFloorBelongsToBuilding(floor, building.id);
    await this.ensureRoomCodeAvailable(
      building.id,
      dto.roomCode.trim(),
    );

    const room = this.roomRepository.create({
      building,
      floor,
      roomCode: dto.roomCode.trim(),
      name: dto.name?.trim() || null,
      capacity: dto.capacity ?? null,
    });

    return this.toPublicRoom(await this.saveRoom(room));
  }

  async findAll(query: ListRoomsQueryDto) {
    const rooms = await this.roomRepository.find({
      where: {
        ...(query.buildingId
          ? { building: { id: query.buildingId } }
          : {}),
        ...(query.floorId ? { floor: { id: query.floorId } } : {}),
      },
      relations: { building: true, floor: true, schedules: true },
      order: { roomCode: 'ASC' },
    });

    return rooms.map((room) => this.toPublicRoom(room));
  }

  async findOne(roomId: string) {
    return this.toPublicRoom(await this.getRoomEntity(roomId));
  }

  async update(roomId: string, dto: UpdateRoomDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const room = await this.getRoomEntity(roomId);
    const building =
      dto.buildingId !== undefined
        ? await this.getBuilding(dto.buildingId)
        : room.building;
    const floor =
      dto.floorId !== undefined
        ? await this.getFloor(dto.floorId)
        : room.floor;

    this.ensureFloorBelongsToBuilding(floor, building.id);

    if (dto.roomCode !== undefined) {
      const roomCode = dto.roomCode.trim();
      if (
        roomCode !== room.roomCode ||
        building.id !== room.building.id
      ) {
        await this.ensureRoomCodeAvailable(
          building.id,
          roomCode,
          room.id,
        );
      }
      room.roomCode = roomCode;
    }

    if (dto.name !== undefined) room.name = dto.name?.trim() || null;
    if (dto.capacity !== undefined) {
      room.capacity = dto.capacity ?? null;
    }

    room.building = building;
    room.floor = floor;

    return this.toPublicRoom(await this.saveRoom(room));
  }

  async remove(roomId: string) {
    const room = await this.getRoomEntity(roomId);

    if ((room.schedules?.length ?? 0) > 0) {
      throw new ConflictException(
        'Room cannot be deleted while it is assigned to class schedules',
      );
    }

    await this.roomRepository.remove(room);

    return { message: 'Room deleted successfully' };
  }

  private async getRoomEntity(roomId: string) {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: {
        building: true,
        floor: true,
        schedules: { schoolClass: true },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  private async getBuilding(buildingId: string) {
    const building = await this.buildingRepository.findOne({
      where: { id: buildingId },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    return building;
  }

  private async getFloor(floorId: string) {
    const floor = await this.floorRepository.findOne({
      where: { id: floorId },
      relations: { building: true },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    return floor;
  }

  private ensureFloorBelongsToBuilding(floor: Floor, buildingId: string) {
    if (floor.building.id !== buildingId) {
      throw new BadRequestException(
        'The selected floor does not belong to the selected building',
      );
    }
  }

  private async ensureRoomCodeAvailable(
    buildingId: string,
    roomCode: string,
    excludedRoomId?: string,
  ) {
    const duplicate = await this.roomRepository.findOne({
      where: { building: { id: buildingId }, roomCode },
    });

    if (duplicate && duplicate.id !== excludedRoomId) {
      throw new ConflictException(
        'This room code already exists in the building',
      );
    }
  }

  private async saveRoom(room: Room) {
    try {
      const saved = await this.roomRepository.save(room);
      return this.getRoomEntity(saved.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This room code already exists in the building',
        );
      }
      throw error;
    }
  }

  private toPublicRoom(room: Room) {
    return {
      id: room.id,
      roomCode: room.roomCode,
      name: room.name,
      capacity: room.capacity,
      building: room.building
        ? { id: room.building.id, name: room.building.name }
        : null,
      floor: room.floor
        ? {
            id: room.floor.id,
            floorNumber: room.floor.floorNumber,
            name: room.floor.name,
          }
        : null,
      scheduleCount: room.schedules?.length ?? 0,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
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
