import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import type { SafeUser, UserRecord } from '../users/types/user-record.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './types/jwt-user.type';

@Injectable()
export class AuthService {
  constructor(
    // 注入全局 PostgreSQL 连接池，用于访问 users 表。
    @Inject(DATABASE_POOL) private readonly pool: Pool,

    // JwtService 由 @nestjs/jwt 提供，用于签发 accessToken。
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    // 注册前先检查用户名或邮箱是否已经存在。
    // 虽然数据库有 UNIQUE 约束，但提前检查可以返回更清晰的业务错误。
    const existedUser = await this.pool.query<Pick<UserRecord, 'id'>>(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email],
    );

    if (existedUser.rowCount && existedUser.rowCount > 0) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    // 永远不要把明文密码保存到数据库。
    // bcrypt.hash 会自动生成盐值并输出不可逆哈希，12 是比较常用的安全强度。
    const passwordHash = await bcrypt.hash(password, 12);

    // 使用参数化 SQL，避免用户输入被拼接成 SQL 语句造成 SQL 注入。
    // RETURNING 中刻意不返回 password，避免密码哈希泄露给前端。
    const result = await this.pool.query<SafeUser>(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, is_active, is_verified, created_at, updated_at`,
      [username, email, passwordHash],
    );

    const user = result.rows[0];

    return {
      user,
      accessToken: await this.signAccessToken(user.id, user.username),
    };
  }

  async login(loginDto: LoginDto) {
    const { account, password } = loginDto;

    // account 允许传用户名或邮箱。
    // 这里只查询一次数据库，同时匹配 username 和 email。
    const result = await this.pool.query<UserRecord>(
      'SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1',
      [account],
    );

    const user = result.rows[0];

    // 登录失败时统一返回“账号或密码错误”。
    // 这样可以避免攻击者通过错误提示判断某个账号是否已经注册。
    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    // is_active 可用于管理员禁用账号。
    // 被禁用的账号即使密码正确，也不能继续登录系统。
    if (!user.is_active) {
      throw new UnauthorizedException('账号已被禁用');
    }

    // bcrypt.compare 会用用户输入的密码和数据库中的哈希值进行安全比对。
    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return {
      user: this.toSafeUser(user),
      accessToken: await this.signAccessToken(user.id, user.username),
    };
  }

  logout() {
    // 当前实现使用无状态 JWT，服务端不保存登录会话。
    // 所以基础版登出只需要前端删除本地保存的 accessToken。
    // 如果后续需要服务端强制 token 失效，可以增加 token 黑名单表或 refresh token 机制。
    return { message: '退出成功，请前端删除本地 accessToken' };
  }

  private async signAccessToken(userId: number, username: string) {
    // JWT payload 中用 sub 保存用户 ID，这是 JWT 的通用约定。
    // username 放在 token 里是为了让后续日志或简单展示可以直接读取用户名。
    const payload: JwtPayload = {
      sub: userId,
      username,
    };

    return this.jwtService.signAsync(payload);
  }

  private toSafeUser(user: UserRecord): SafeUser {
    // 从用户对象中移除 password 字段。
    // 即使 password 是哈希值，也不应该返回给前端或被前端缓存。
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
