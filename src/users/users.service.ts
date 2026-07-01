import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { SafeUser, UserRecord } from './types/user-record.type';

@Injectable()
export class UsersService {
  constructor(
    // 注入 PostgreSQL 连接池，当前服务只操作 users 表。
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  async findMe(userId: number): Promise<SafeUser> {
    // 只查询可以返回给前端的安全字段。
    // password 字段不参与查询，避免后续误返回密码哈希。
    const result = await this.pool.query<SafeUser>(
      `SELECT id, username, email, is_active, is_verified, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('登录状态无效');
    }

    return user;
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto): Promise<SafeUser> {
    const { username, email } = updateProfileDto;

    // PATCH 接口允许部分更新，但至少要传一个可更新字段。
    if (!username && !email) {
      throw new BadRequestException('至少需要提供 username 或 email');
    }

    // 修改前检查新用户名或新邮箱是否被其他用户占用。
    // id <> $3 可以排除当前用户自己，避免用户不改值时被误判为冲突。
    const existedUser = await this.pool.query<Pick<UserRecord, 'id'>>(
      `SELECT id
       FROM users
       WHERE (username = $1 OR email = $2) AND id <> $3
       LIMIT 1`,
      [username ?? null, email ?? null, userId],
    );

    if (existedUser.rowCount && existedUser.rowCount > 0) {
      throw new ConflictException('用户名或邮箱已被其他用户使用');
    }

    // COALESCE($1, username) 表示：如果没有传 username，就继续使用原 username。
    // updated_at 会依赖数据库触发器自动更新；如果没有加触发器，也可以在 SQL 中手动 set updated_at = CURRENT_TIMESTAMP。
    const result = await this.pool.query<SafeUser>(
      `UPDATE users
       SET username = COALESCE($1, username),
           email = COALESCE($2, email),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, email, is_active, is_verified, created_at, updated_at`,
      [username ?? null, email ?? null, userId],
    );

    const updatedUser = result.rows[0];

    if (!updatedUser) {
      throw new UnauthorizedException('登录状态无效');
    }

    return updatedUser;
  }

  async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
    const { oldPassword, newPassword } = updatePasswordDto;

    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能和旧密码相同');
    }

    // 修改密码必须先读取当前用户的密码哈希，用旧密码做安全校验。
    const result = await this.pool.query<Pick<UserRecord, 'password'>>('SELECT password FROM users WHERE id = $1', [
      userId,
    ]);
    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('登录状态无效');
    }

    // 只有旧密码校验通过，才允许写入新密码哈希。
    const passwordMatched = await bcrypt.compare(oldPassword, user.password);

    if (!passwordMatched) {
      throw new UnauthorizedException('旧密码错误');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
      newPasswordHash,
      userId,
    ]);

    // 修改密码后建议前端删除旧 token 并跳转登录页。
    // 如果后续做 refresh token，也应该同步撤销旧 refresh token。
    return { message: '密码修改成功，请重新登录' };
  }
}
