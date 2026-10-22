import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { Redis } from 'ioredis';
import { UserRepository } from '../../users/repositories/UserRepository';
import { EmailService } from '../../email/services/EmailService';
import type { User } from '../../users/models/user.schema';
import type { SignupDto } from '../validators/SignupDto';
import type { LoginDto } from '../validators/LoginDto';
import { AppError } from '../../../errors/AppError';
import { config } from '../../../config';
import { TOKENS } from '../../../tokens';
import { logger } from '../../../observability/logger';

export type SafeUser = Omit<User, 'passwordHash'>;

@injectable()
export class AuthService {
  private readonly jwtSecret: Uint8Array;

  constructor(
    @inject(UserRepository)      private readonly userRepository: UserRepository,
    @inject('RedisClient')       private readonly redis: Redis,
    @inject(TOKENS.EmailService) private readonly emailService: EmailService,
  ) {
    this.jwtSecret = new TextEncoder().encode(config.jwt.secret);
  }

  private async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  private async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }

  private async generateAccessToken(userId: string, email: string): Promise<string> {
    return new SignJWT({ sub: userId, email, type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.accessExpiresIn)
      .sign(this.jwtSecret);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    return new SignJWT({ sub: userId, type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.refreshExpiresIn)
      .sign(this.jwtSecret);
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return payload;
    } catch {
      throw new AppError('Invalid or expired access token', 401);
    }
  }

  private async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret);
      return payload;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  private async storeRefreshToken(userId: string, token: string): Promise<void> {
    await this.redis.setex(`refresh_token:${userId}`, 604800, token);
  }

  private async revokeRefreshToken(userId: string): Promise<void> {
    await this.redis.del(`refresh_token:${userId}`);
  }

  private async isRefreshTokenValid(userId: string, token: string): Promise<boolean> {
    const stored = await this.redis.get(`refresh_token:${userId}`);
    return stored === token;
  }

  async signup(
    dto: SignupDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('Email already in use', 409);
    }

    const passwordHash = await this.hashPassword(dto.password);
    const created = await this.userRepository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
    });

    const accessToken = await this.generateAccessToken(created.id, created.email);
    const refreshToken = await this.generateRefreshToken(created.id);
    await this.storeRefreshToken(created.id, refreshToken);

    // Send verification email — swallowed so signup never fails due to email issues
    try {
      const verifyToken = randomBytes(32).toString('hex');
      await this.redis.setex(`email_verify:${verifyToken}`, 86400, created.id);
      const verifyUrl = `${config.app.frontendUrl}/verify-email?token=${verifyToken}`;
      await this.emailService.sendVerificationEmail({
        to: created.email,
        firstName: created.firstName,
        verificationUrl: verifyUrl,
      });
    } catch (err) {
      logger.warn('Failed to send verification email on signup', { userId: created.id, error: err });
    }

    const { passwordHash: _pw, ...user } = created;
    return { accessToken, refreshToken, user };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
    const found = await this.userRepository.findByEmail(dto.email);
    if (!found) {
      throw new AppError('Invalid credentials', 401);
    }

    const valid = await this.verifyPassword(dto.password, found.passwordHash);
    if (!valid) {
      throw new AppError('Invalid credentials', 401);
    }

    const accessToken = await this.generateAccessToken(found.id, found.email);
    const refreshToken = await this.generateRefreshToken(found.id);
    await this.storeRefreshToken(found.id, refreshToken);

    const { passwordHash: _pw, ...user } = found;
    return { accessToken, refreshToken, user };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const userId = payload.sub!;

    const valid = await this.isRefreshTokenValid(userId, refreshToken);
    if (!valid) {
      throw new AppError('Refresh token revoked', 401);
    }

    const dbUser = await this.userRepository.findById(userId);
    if (!dbUser) {
      throw new AppError('User not found', 401);
    }

    const accessToken = await this.generateAccessToken(userId, dbUser.email);
    return { accessToken };
  }

  async logout(userId: string): Promise<void> {
    await this.revokeRefreshToken(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    // Return silently even if email not found — prevents user enumeration
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    await this.redis.setex(`pwd_reset:${token}`, 900, user.id); // 15 minutes

    const resetUrl = `${config.app.frontendUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      firstName: user.firstName,
      resetUrl,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.redis.get(`pwd_reset:${token}`);
    if (!userId) throw new AppError('Reset token is invalid or has expired', 400);

    await this.redis.del(`pwd_reset:${token}`);
    const passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.updatePassword(userId, passwordHash);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.redis.get(`email_verify:${token}`);
    if (!userId) throw new AppError('Verification token is invalid or has expired', 400);

    await this.redis.del(`email_verify:${token}`);
    await this.userRepository.markEmailVerified(userId);
  }
}
