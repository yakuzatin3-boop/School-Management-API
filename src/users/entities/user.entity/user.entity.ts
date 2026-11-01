import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Teacher } from '../../../teachers/entities/teacher.entity/teacher.entity.js';
import { Student } from '../../../students/entities/student.entity/student.entity.js';
import { RefreshToken } from '../../../auth/entities/refresh-token.entity/refresh-token.entity.js';
import { PasswordResetToken } from '../../../auth/entities/password-reset-token.entity/password-reset-token.entity.js';
import { EmailVerificationToken } from '../../../auth/entities/email-verification-token.entity/email-verification-token.entity.js';
import { Notification } from '../../../notifications/entities/notification.entity/notification.entity.js';
import { AnnouncementRead } from '../../../announcements/entities/announcement-read.entity/announcement-read.entity.js';

export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
}

@Entity({ name: 'users' })
@Check('CHK_users_role', `"role" IN ('admin', 'teacher', 'student')`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
  })
  passwordHash: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'student',
  })
  role: UserRole;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @Column({
    name: 'email_verified_at',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerifiedAt: Date | null;

  @Column({
    name: 'last_login_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastLoginAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;

  @OneToOne(() => Teacher, (teacher) => teacher.user)
  teacher: Relation<Teacher | null>;

  @OneToOne(() => Student, (student) => student.user)
  student: Relation<Student | null>;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: Relation<RefreshToken[]>;

  @OneToMany(() => PasswordResetToken, (token) => token.user)
  passwordResetTokens: Relation<PasswordResetToken[]>;

  @OneToMany(() => EmailVerificationToken, (token) => token.user)
  emailVerificationTokens: Relation<EmailVerificationToken[]>;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Relation<Notification[]>;

  @OneToMany(() => AnnouncementRead, (read) => read.user)
  announcementReads: Relation<AnnouncementRead[]>;
}
