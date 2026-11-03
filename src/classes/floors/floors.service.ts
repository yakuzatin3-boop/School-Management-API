import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Floor } from '../entities/floor.entity/floor.entity.js';
import { Building } from '../entities/building.entity/building.entity.js';
import { CreateFloorDto } from './dto/create-floor.dto.js';
import { UpdateFloorDto } from './dto/update-floor.dto.js';
import { ListFloorsQueryDto } from './dto/list-floors-query.dto.js';

@Injectable()
export class FloorsService {
  constructor(
    @InjectRepository(Floor)
    private readonly floorRepository: Repository<Floor>,
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
  ) {}

  async create(dto: CreateFloorDto) {
    const building = await this.getBuilding(dto.buildingId);
    await this.ensureFloorNumberAvailable(
      building.id,
      dto.floorNumber,
    );

    const floor = this.floorRepository.create({
      building,
      floorNumber: dto.floorNumber,
      name: dto.name?.trim() || null,
    });

    return this.toPublicFloor(await this.saveFloor(floor));
  }

  async findAll(query: ListFloorsQueryDto) {
    const floors = await this.floorRepository.find({
      where: query.buildingId
        ? { building: { id: query.buildingId } }
        : undefined,
      relations: { building: true, rooms: true },
      order: { floorNumber: 'ASC' },
    });

    return floors.map((floor) => this.toPublicFloor(floor));
  }

  async findOne(floorId: string) {
    return this.toPublicFloor(await this.getFloorEntity(floorId));
  }

  async update(floorId: string, dto: UpdateFloorDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const floor = await this.getFloorEntity(floorId);
    const building =
      dto.buildingId !== undefined
        ? await this.getBuilding(dto.buildingId)
        : floor.building;
    const floorNumber = dto.floorNumber ?? floor.floorNumber;

    if (
      building.id !== floor.building.id ||
      floorNumber !== floor.floorNumber
    ) {
      await this.ensureFloorNumberAvailable(
        building.id,
        floorNumber,
        floor.id,
      );
    }

    floor.building = building;
    floor.floorNumber = floorNumber;
    if (dto.name !== undefined) floor.name = dto.name?.trim() || null;

    return this.toPublicFloor(await this.saveFloor(floor));
  }

  async remove(floorId: string) {
    const floor = await this.getFloorEntity(floorId);

    if ((floor.rooms?.length ?? 0) > 0) {
      throw new ConflictException(
        'Floor cannot be deleted while it still has rooms',
      );
    }

    await this.floorRepository.remove(floor);

    return { message: 'Floor deleted successfully' };
  }

  private async getFloorEntity(floorId: string) {
    const floor = await this.floorRepository.findOne({
      where: { id: floorId },
      relations: { building: true, rooms: true },
    });

    if (!floor) {
      throw new NotFoundException('Floor not found');
    }

    return floor;
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

  private async ensureFloorNumberAvailable(
    buildingId: string,
    floorNumber: number,
    excludedFloorId?: string,
  ) {
    const duplicate = await this.floorRepository.findOne({
      where: { building: { id: buildingId }, floorNumber },
    });

    if (duplicate && duplicate.id !== excludedFloorId) {
      throw new ConflictException(
        'This floor number already exists in the building',
      );
    }
  }

  private async saveFloor(floor: Floor) {
    try {
      const saved = await this.floorRepository.save(floor);
      return this.getFloorEntity(saved.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This floor number already exists in the building',
        );
      }
      throw error;
    }
  }

  private toPublicFloor(floor: Floor) {
    return {
      id: floor.id,
      floorNumber: floor.floorNumber,
      name: floor.name,
      building: floor.building
        ? {
            id: floor.building.id,
            name: floor.building.name,
          }
        : null,
      roomCount: floor.rooms?.length ?? 0,
      rooms: (floor.rooms ?? [])
        .slice()
        .sort((a, b) => a.roomCode.localeCompare(b.roomCode))
        .map((room) => ({
          id: room.id,
          roomCode: room.roomCode,
          name: room.name,
          capacity: room.capacity,
        })),
      createdAt: floor.createdAt,
      updatedAt: floor.updatedAt,
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
