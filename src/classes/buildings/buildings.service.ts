import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Building } from '../entities/building.entity/building.entity.js';
import { CreateBuildingDto } from './dto/create-building.dto.js';
import { UpdateBuildingDto } from './dto/update-building.dto.js';

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,
  ) {}

  async create(dto: CreateBuildingDto) {
    const building = this.buildingRepository.create({
      name: dto.name.trim(),
      address: dto.address?.trim() || null,
    });

    return this.toPublicBuilding(
      await this.buildingRepository.save(building),
      true,
    );
  }

  async findAll() {
    const buildings = await this.buildingRepository.find({
      relations: { floors: true, rooms: true },
      order: { name: 'ASC' },
    });

    return buildings.map((building) =>
      this.toPublicBuilding(building, false),
    );
  }

  async findOne(buildingId: string) {
    return this.toPublicBuilding(
      await this.getBuildingEntity(buildingId),
      true,
    );
  }

  async update(buildingId: string, dto: UpdateBuildingDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const building = await this.getBuildingEntity(buildingId);

    if (dto.name !== undefined) building.name = dto.name.trim();
    if (dto.address !== undefined) {
      building.address = dto.address?.trim() || null;
    }

    return this.toPublicBuilding(
      await this.buildingRepository.save(building),
      true,
    );
  }

  async remove(buildingId: string) {
    const building = await this.getBuildingEntity(buildingId);

    if ((building.floors?.length ?? 0) > 0 || (building.rooms?.length ?? 0) > 0) {
      throw new ConflictException(
        'Building cannot be deleted while it still has floors or rooms',
      );
    }

    await this.buildingRepository.remove(building);

    return { message: 'Building deleted successfully' };
  }

  private async getBuildingEntity(buildingId: string) {
    const building = await this.buildingRepository.findOne({
      where: { id: buildingId },
      relations: { floors: true, rooms: true },
    });

    if (!building) {
      throw new NotFoundException('Building not found');
    }

    return building;
  }

  private toPublicBuilding(building: Building, includeDetails: boolean) {
    return {
      id: building.id,
      name: building.name,
      address: building.address,
      floorCount: building.floors?.length ?? 0,
      roomCount: building.rooms?.length ?? 0,
      ...(includeDetails
        ? {
            floors: (building.floors ?? [])
              .slice()
              .sort((a, b) => a.floorNumber - b.floorNumber)
              .map((floor) => ({
                id: floor.id,
                floorNumber: floor.floorNumber,
                name: floor.name,
              })),
            rooms: (building.rooms ?? [])
              .slice()
              .sort((a, b) => a.roomCode.localeCompare(b.roomCode))
              .map((room) => ({
                id: room.id,
                roomCode: room.roomCode,
                name: room.name,
                capacity: room.capacity,
              })),
          }
        : {}),
      createdAt: building.createdAt,
      updatedAt: building.updatedAt,
    };
  }
}
