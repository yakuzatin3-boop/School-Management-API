import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity/user.entity.js';
import { Student } from '../students/entities/student.entity/student.entity.js';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from './entities/refresh-token.entity/refresh-token.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

export interface RequestMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepository: Repository<Student>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata = {}) {
    const email = dto.email.trim().toLowerCase();

    const student = await this.studentRepository.findOne({
      where: { email },
      relations: { user: true },
    });

    if (student?.user) {
      throw new ConflictException(
        'A student with this email already has an account',
      );
    }

    const createdUser = await this.usersService.create(dto);
    const user = await this.userRepository.findOneBy({
      id: createdUser.id,
    });

    if (!user) {
      throw new UnauthorizedException('Unable to create account');
    }

    if (student) {
      student.user = user;
      await this.studentRepository.save(student);
    }

    return this.login(
      { email: dto.email, password: dto.password },
      metadata,
    );
  }

  async login(dto: LoginDto, metadata: RequestMetadata = {}) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOneBy({ email });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    await this.linkStudentAccount(user);

    return this.issueTokens(user, metadata);
  }

  async refresh(dto: RefreshTokenDto, metadata: RequestMetadata = {}) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!storedToken.user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    return this.issueTokens(storedToken.user, metadata);
  }

  async logout(dto: RefreshTokenDto) {
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.refreshTokenRepository.findOneBy({
      tokenHash,
    });

    if (storedToken && storedToken.revokedAt === null) {
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepository.save(storedToken);
    }

    return { message: 'Logged out successfully' };
  }

  me(userId: string) {
    return this.usersService.findOne(userId);
  }

  private async issueTokens(user: User, metadata: RequestMetadata) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        expiresIn: (this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) ?? '15m') as JwtSignOptions['expiresIn'],
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');

    const storedToken = this.refreshTokenRepository.create({
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlMs()),
      user,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });

    await this.refreshTokenRepository.save(storedToken);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      user: this.toPublicUser(user),
    };
  }

  private async linkStudentAccount(user: User) {
    const student = await this.studentRepository.findOne({
      where: { email: user.email },
      relations: { user: true },
    });

    if (!student || student.user) {
      return;
    }

    student.user = user;
    await this.studentRepository.save(student);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshTokenTtlMs() {
    const days = Number(
      this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN_DAYS',
        '7',
      ),
    );

    const validDays = Number.isFinite(days) && days > 0 ? days : 7;

    return validDays * 24 * 60 * 60 * 1000;
  }

  private toPublicUser(user: User) {
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
