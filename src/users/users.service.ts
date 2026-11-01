
import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import {
  User,
  UserRole,
} from './entities/user.entity/user.entity.js';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // Remove the password hash before returning a user.
  private toPublicUser(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // CREATE USER
  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.userRepository.findOneBy({
      email,
    });

    if (existingUser) {
      throw new ConflictException(
        'Email is already registered',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      12,
    );

    const user = this.userRepository.create({
      email,
      passwordHash: hashedPassword,
      role: UserRole.STUDENT,
      isActive: true,
    });

    try {
      const savedUser = await this.userRepository.save(user);
      return this.toPublicUser(savedUser);
    } catch (error: unknown) {
      // PostgreSQL unique-constraint violation.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      throw error;
    }
  }

  // GET ALL USERS
  async findAll() {
  return this.userRepository.find({
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    order: {
      createdAt: 'DESC',
    },
  });
}

  // GET ONE USER
  async findOne(id: string) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toPublicUser(user);
  }

  // UPDATE USER
  async update(id: string, dto: UpdateUserDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();

      const existingUser = await this.userRepository.findOneBy({
        email,
      });

      if (existingUser && existingUser.id !== id) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      user.email = email;
    }

    if (dto.password !== undefined) {
      user.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    try {
      const updatedUser = await this.userRepository.save(user);
      return this.toPublicUser(updatedUser);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'Email is already registered',
        );
      }

      throw error;
    }
  }

  // DEACTIVATE USER
  async deactivate(id: string) {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'User is already deactivated',
      );
    }

    user.isActive = false;

    await this.userRepository.save(user);

    return {
      message: 'User deactivated successfully',
    };
  }

  ///UPDATE USER ROLE

  async updateRole(id: string, role: UserRole) {
  const user = await this.userRepository.findOne({
    where: { id },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  user.role = role;

  return this.userRepository.save(user);
}
}
