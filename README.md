# KITT AI 后端迁移记录

这个项目已经从原来的 `Express + server.js` 单文件后端，迁移为一个基础的 NestJS 后端项目。前端文件 `index.html` 暂时保留不动，后续可以单独用 React 重写新项目。

## 本次迁移做了什么

1. 安装 NestJS 相关依赖：
   - `@nestjs/common`
   - `@nestjs/core`
   - `@nestjs/platform-express`
   - `@nestjs/config`
   - `reflect-metadata`
   - `rxjs`
2. 增加 TypeScript 与 NestJS 配置：
   - `tsconfig.json`
   - `tsconfig.build.json`
   - `nest-cli.json`
3. 新增 NestJS 后端源码目录：
   - `src/main.ts`：应用启动入口
   - `src/app.module.ts`：根模块
   - `src/chat/chat.module.ts`：聊天功能模块
   - `src/chat/chat.controller.ts`：聊天 HTTP 接口
   - `src/chat/chat.service.ts`：通义千问流式调用逻辑
   - `src/chat/chat-message.dto.ts`：请求体数据结构
4. 保留原来的接口地址：
   - `POST /api/chat`
5. 保留 SSE 流式返回格式：
   - 普通内容：`data: {"text":"..."}`
   - 结束标记：`data: [DONE]`
6. 移除代码里硬编码的通义千问 API Key，改为通过环境变量读取。

## 为什么这样拆分

NestJS 推荐用“模块 + 控制器 + 服务”的方式组织后端代码：

- `Module` 负责组织功能边界，例如聊天相关代码都放在 `ChatModule`。
- `Controller` 负责接收 HTTP 请求和返回 HTTP 响应。
- `Service` 负责真正的业务逻辑，例如调用通义千问接口、解析流式数据。
- `DTO` 负责描述接口请求体结构，后续可以继续接入参数校验。

这样拆分之后，后续增加登录、用户、会话记录、知识库等功能时，不需要把所有逻辑都堆在一个文件里。

## 环境变量

启动项目前需要提供通义千问的密钥：

```bash
export DASHSCOPE_API_KEY=你的通义千问APIKey
```

也可以在项目根目录创建 `.env` 文件：

```bash
DASHSCOPE_API_KEY=你的通义千问APIKey
PORT=5002
```

`.env` 已经加入 `.gitignore`，不要把真实密钥提交到代码仓库。

## 常用命令

安装依赖：

```bash
pnpm install
```

开发模式启动：

```bash
pnpm start:dev
```

生产构建：

```bash
pnpm build
```

生产模式启动：

```bash
pnpm start:prod
```

TypeScript 类型检查：

```bash
pnpm typecheck
```

## 接口说明

### POST /api/chat

请求体：

```json
{
  "message": "你好，请介绍一下你自己"
}
```

响应类型：

```http
Content-Type: text/event-stream
```

响应示例：

```text
data: {"text":"你好"}

data: {"text":"，我是"}

data: [DONE]
```

## 后续建议

1. 前端 React 项目重写后，可以继续请求这个后端的 `POST /api/chat`。
2. 后续可以加 `class-validator` 和 `class-transformer` 做更严格的请求参数校验。
3. 如果要保存聊天记录，可以新增 `ConversationModule` 或 `MessageModule`。
4. 如果要做用户登录，可以新增 `AuthModule` 和 `UserModule`。



## 创建数据库

1. 数据库名称：kitt
2. 数据库用户名：root
3. 数据库密码：123456

### users 表格

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### conversations 表格

```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
```

### messages 表格

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
```

### 自动更新 updated_at 的触发器

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated
BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 用户登录、注册、修改功能设计方案

下面方案基于当前 NestJS 后端结构设计，数据库使用已有的 `kitt` 数据库和 `users` 表。核心目标是先实现最常用的用户认证能力：注册、登录、获取当前用户信息、修改用户资料、修改密码、登出。

### 设计目标

1. `AuthModule` 负责认证相关接口，例如注册、登录、登出、刷新登录态。
2. `UsersModule` 负责用户资料相关逻辑，例如查询用户、修改用户名和邮箱、修改密码。
3. 密码只保存加密后的哈希值，不能保存明文密码。
4. 登录成功后返回访问令牌 `accessToken`，前端后续请求通过 `Authorization: Bearer accessToken` 携带身份。
5. 对需要登录才能访问的接口使用 JWT 守卫保护，避免未登录用户修改别人资料。
6. 接口返回用户信息时永远不要返回 `password` 字段。

### 建议安装依赖

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt pg
pnpm add -D @types/passport-jwt @types/bcrypt
```

依赖用途说明：

1. `@nestjs/jwt`：NestJS 官方 JWT 工具，用于签发和校验登录令牌。
2. `@nestjs/passport`、`passport`、`passport-jwt`：用于把 JWT 校验流程接入 NestJS 守卫。
3. `bcrypt`：用于密码哈希和密码校验，避免数据库泄露后直接暴露用户明文密码。
4. `pg`：PostgreSQL 官方 Node.js 驱动，用于连接 `kitt` 数据库。

### 环境变量设计

在项目根目录 `.env` 中增加以下配置：

```bash
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=kitt
DATABASE_USER=postgres
DATABASE_PASSWORD=andy7478
JWT_SECRET=请替换成足够长的随机字符串
JWT_EXPIRES_IN=2h
```

配置说明：

1. `DATABASE_*` 用于连接本地 PostgreSQL 数据库。
2. `JWT_SECRET` 是 JWT 签名密钥，必须使用强随机字符串，不能提交到代码仓库。
3. `JWT_EXPIRES_IN` 控制登录令牌有效期，开发阶段可以设为 `2h`，生产环境可根据安全要求调整。

### 建议调整 users 表结构

当前 `users` 表已经可以支持基础注册和登录。为了让更新时间自动维护，并方便后续扩展，建议补充触发器：

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

字段约定：

1. `id`：用户主键，注册成功后由数据库自动生成。
2. `username`：用户名，唯一且不能为空，用于展示和登录。
3. `email`：邮箱，唯一且不能为空，可用于登录和找回密码。
4. `password`：密码哈希值，不保存明文密码。
5. `is_active`：账号是否可用，管理员禁用账号时改为 `false`。
6. `is_verified`：邮箱是否已验证，初期可以先保留字段但不强制使用。
7. `created_at`：创建时间。
8. `updated_at`：更新时间，每次修改用户资料或密码时自动刷新。

### 推荐目录结构

```text
src/
  auth/
    auth.controller.ts
    auth.module.ts
    auth.service.ts
    dto/
      login.dto.ts
      register.dto.ts
    guards/
      jwt-auth.guard.ts
    strategies/
      jwt.strategy.ts
  users/
    dto/
      update-password.dto.ts
      update-profile.dto.ts
    users.controller.ts
    users.module.ts
    users.service.ts
  database/
    database.module.ts
    database.provider.ts
```

目录职责说明：

1. `database/`：封装 PostgreSQL 连接池，统一给业务模块使用。
2. `auth/`：处理注册、登录、签发 JWT、校验用户密码。
3. `auth/dto/`：描述注册和登录请求体结构，后续接入 `class-validator` 后可直接加校验装饰器。
4. `auth/guards/`：放需要登录才能访问接口的守卫。
5. `auth/strategies/`：放 JWT 解析和用户身份注入逻辑。
6. `users/`：处理用户资料查询、资料修改、密码修改。

### 数据库连接模块设计

`src/database/database.provider.ts`：

```ts
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

export const databaseProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    return new Pool({
      host: configService.get<string>('DATABASE_HOST', 'localhost'),
      port: Number(configService.get<string>('DATABASE_PORT', '5432')),
      database: configService.get<string>('DATABASE_NAME', 'kitt'),
      user: configService.get<string>('DATABASE_USER', 'postgres'),
      password: configService.get<string>('DATABASE_PASSWORD', 'andy7478'),
    });
  },
};
```

注释说明：

1. `DATABASE_POOL` 是注入令牌，业务服务通过它拿到同一个 PostgreSQL 连接池。
2. `useFactory` 可以读取 `.env` 配置，避免把数据库连接信息写死在业务代码里。
3. `new Pool(...)` 会创建连接池，比每个请求都新建数据库连接更高效。
4. 默认值用于本地开发，生产部署时必须通过环境变量覆盖。

`src/database/database.module.ts`：

```ts
import { Global, Module } from '@nestjs/common';
import { databaseProvider } from './database.provider';

@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
```

注释说明：

1. `@Global()` 表示数据库模块全局可用，其他模块导入一次后即可注入连接池。
2. `providers` 注册连接池提供者。
3. `exports` 把连接池暴露给 `AuthService` 和 `UsersService` 使用。

### DTO 设计

`src/auth/dto/register.dto.ts`：

```ts
export class RegisterDto {
  username: string;
  email: string;
  password: string;
}
```

`src/auth/dto/login.dto.ts`：

```ts
export class LoginDto {
  account: string;
  password: string;
}
```

`src/users/dto/update-profile.dto.ts`：

```ts
export class UpdateProfileDto {
  username?: string;
  email?: string;
}
```

`src/users/dto/update-password.dto.ts`：

```ts
export class UpdatePasswordDto {
  oldPassword: string;
  newPassword: string;
}
```

字段说明：

1. `RegisterDto.username`：注册用户名。
2. `RegisterDto.email`：注册邮箱。
3. `RegisterDto.password`：注册密码，服务端需要检查长度和复杂度。
4. `LoginDto.account`：登录账号，允许传用户名或邮箱。
5. `LoginDto.password`：登录密码。
6. `UpdateProfileDto.username`：新用户名，可选。
7. `UpdateProfileDto.email`：新邮箱，可选。
8. `UpdatePasswordDto.oldPassword`：旧密码，用于确认当前用户身份。
9. `UpdatePasswordDto.newPassword`：新密码，需要重新哈希后保存。

### AuthService 设计

`src/auth/auth.service.ts`：

```ts
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { username, email, password } = registerDto;

    const existedUser = await this.pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email],
    );

    if (existedUser.rowCount > 0) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await this.pool.query(
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

    const result = await this.pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1',
      [account],
    );

    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const passwordMatched = await bcrypt.compare(password, user.password);

    if (!passwordMatched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return {
      user: this.toSafeUser(user),
      accessToken: await this.signAccessToken(user.id, user.username),
    };
  }

  private async signAccessToken(userId: number, username: string) {
    return this.jwtService.signAsync({
      sub: userId,
      username,
    });
  }

  private toSafeUser(user: any) {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}
```

关键注释说明：

1. 注册前先检查用户名或邮箱是否已存在，避免违反数据库唯一约束时返回不友好的错误。
2. `bcrypt.hash(password, 12)` 会给密码加盐并生成哈希，数字 `12` 是计算强度，安全性和性能比较均衡。
3. SQL 使用 `$1`、`$2` 参数化查询，避免 SQL 注入。
4. 登录时统一返回“账号或密码错误”，避免攻击者通过错误信息判断账号是否存在。
5. `is_active=false` 时拒绝登录，方便后续实现封禁用户。
6. `signAccessToken` 使用 `sub` 存储用户 ID，这是 JWT 的常见约定。
7. `toSafeUser` 从返回值中移除 `password` 字段，避免密码哈希泄露给前端。

### AuthController 设计

`src/auth/auth.controller.ts`：

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('logout')
  logout() {
    return { message: '退出成功，请前端删除本地 accessToken' };
  }
}
```

接口说明：

1. `POST /api/auth/register`：注册新用户，成功后直接返回用户信息和 `accessToken`。
2. `POST /api/auth/login`：使用用户名或邮箱登录，成功后返回用户信息和 `accessToken`。
3. `POST /api/auth/logout`：JWT 是无状态令牌，基础版登出由前端删除本地令牌完成；如需服务端强制失效，可后续增加令牌黑名单表。

### JWT 策略和守卫设计

`src/auth/strategies/jwt.strategy.ts`：

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: { sub: number; username: string }) {
    if (!payload?.sub) {
      throw new UnauthorizedException('登录状态无效');
    }

    return {
      userId: payload.sub,
      username: payload.username,
    };
  }
}
```

`src/auth/guards/jwt-auth.guard.ts`：

```ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

注释说明：

1. `ExtractJwt.fromAuthHeaderAsBearerToken()` 会从请求头 `Authorization: Bearer xxx` 中读取令牌。
2. `secretOrKey` 必须和签发令牌时的 `JWT_SECRET` 一致，否则校验失败。
3. `validate` 返回的对象会被 NestJS 挂到 `request.user` 上。
4. `JwtAuthGuard` 可以用在控制器方法上，拦截未登录或令牌无效的请求。

### AuthModule 设计

`src/auth/auth.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '2h'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

注释说明：

1. `DatabaseModule` 提供数据库连接池。
2. `PassportModule` 提供 Passport 认证框架能力。
3. `JwtModule.registerAsync` 可以在应用启动时读取 `.env` 中的 JWT 配置。
4. `AuthController` 对外暴露认证接口。
5. `AuthService` 负责注册、登录、签发令牌。
6. `JwtStrategy` 负责解析请求头中的 JWT 并注入当前用户身份。

### UsersService 设计

`src/users/users.service.ts`：

```ts
import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async findMe(userId: number) {
    const result = await this.pool.query(
      `SELECT id, username, email, is_active, is_verified, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId],
    );

    return result.rows[0];
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const { username, email } = updateProfileDto;

    if (!username && !email) {
      throw new BadRequestException('至少需要提供 username 或 email');
    }

    const existedUser = await this.pool.query(
      `SELECT id
       FROM users
       WHERE (username = $1 OR email = $2) AND id <> $3
       LIMIT 1`,
      [username, email, userId],
    );

    if (existedUser.rowCount > 0) {
      throw new ConflictException('用户名或邮箱已被其他用户使用');
    }

    const result = await this.pool.query(
      `UPDATE users
       SET username = COALESCE($1, username),
           email = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, username, email, is_active, is_verified, created_at, updated_at`,
      [username, email, userId],
    );

    return result.rows[0];
  }

  async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
    const { oldPassword, newPassword } = updatePasswordDto;

    const result = await this.pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user) {
      throw new UnauthorizedException('登录状态无效');
    }

    const passwordMatched = await bcrypt.compare(oldPassword, user.password);

    if (!passwordMatched) {
      throw new UnauthorizedException('旧密码错误');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPasswordHash, userId]);

    return { message: '密码修改成功，请重新登录' };
  }
}
```

关键注释说明：

1. `findMe` 只查询安全字段，不读取 `password`。
2. 修改资料前检查是否至少传了一个可修改字段。
3. 修改用户名或邮箱前检查唯一性，避免和其他用户冲突。
4. `COALESCE($1, username)` 表示如果没有传新用户名，就保留原用户名。
5. 修改密码前必须校验旧密码，防止别人拿到登录态后直接改密码。
6. 新密码仍然使用 `bcrypt.hash` 保存，不能明文入库。
7. 修改密码成功后建议前端删除旧 token 并跳转登录页。

### UsersController 设计

`src/users/users.controller.ts`：

```ts
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: {
    userId: number;
    username: string;
  };
};

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findMe(request.user.userId);
  }

  @Patch('me')
  updateProfile(@Req() request: AuthenticatedRequest, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(request.user.userId, updateProfileDto);
  }

  @Patch('me/password')
  updatePassword(@Req() request: AuthenticatedRequest, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.usersService.updatePassword(request.user.userId, updatePasswordDto);
  }
}
```

接口说明：

1. `GET /api/users/me`：获取当前登录用户资料。
2. `PATCH /api/users/me`：修改当前登录用户的用户名或邮箱。
3. `PATCH /api/users/me/password`：修改当前登录用户密码。
4. `@UseGuards(JwtAuthGuard)` 放在控制器上，表示该控制器内所有接口都必须登录后才能访问。
5. `request.user.userId` 来自 JWT 策略的 `validate` 返回值，不能由前端直接传入，避免越权修改其他用户。

### UsersModule 设计

`src/users/users.module.ts`：

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

注释说明：

1. `UsersModule` 导入 `DatabaseModule` 后，`UsersService` 就可以注入数据库连接池。
2. `UsersController` 负责 HTTP 层。
3. `UsersService` 负责用户资料业务逻辑。

### AppModule 接入方式

在 `src/app.module.ts` 中新增模块导入：

```ts
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
```

然后在 `imports` 数组中加入：

```ts
DatabaseModule,
AuthModule,
UsersModule,
```

接入说明：

1. `DatabaseModule` 放在根模块中，保证数据库连接池随应用启动一起初始化。
2. `AuthModule` 提供 `/api/auth/*` 认证接口。
3. `UsersModule` 提供 `/api/users/*` 用户资料接口。
4. 原有 `ChatModule` 可以继续保留，不影响聊天接口。

### 接口请求示例

注册：

```bash
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"Passw0rd123"}'
```

登录：

```bash
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"alice","password":"Passw0rd123"}'
```

获取当前用户：

```bash
curl http://localhost:5002/api/users/me \
  -H "Authorization: Bearer <accessToken>"
```

修改资料：

```bash
curl -X PATCH http://localhost:5002/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"username":"alice_new","email":"alice_new@example.com"}'
```

修改密码：

```bash
curl -X PATCH http://localhost:5002/api/users/me/password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"oldPassword":"Passw0rd123","newPassword":"NewPassw0rd123"}'
```

登出：

```bash
curl -X POST http://localhost:5002/api/auth/logout \
  -H "Authorization: Bearer <accessToken>"
```

### 接口返回格式建议

注册或登录成功：

```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "is_active": true,
    "is_verified": false,
    "created_at": "2026-07-01T12:00:00.000Z",
    "updated_at": "2026-07-01T12:00:00.000Z"
  },
  "accessToken": "jwt-token"
}
```

获取或修改用户资料成功：

```json
{
  "id": 1,
  "username": "alice_new",
  "email": "alice_new@example.com",
  "is_active": true,
  "is_verified": false,
  "created_at": "2026-07-01T12:00:00.000Z",
  "updated_at": "2026-07-01T12:10:00.000Z"
}
```

修改密码成功：

```json
{
  "message": "密码修改成功，请重新登录"
}
```

### 参数校验建议

当前项目还没有安装 `class-validator` 和 `class-transformer`。建议后续安装：

```bash
pnpm add class-validator class-transformer
```

然后在 `src/main.ts` 增加全局校验管道：

```ts
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

校验规则建议：

1. `username`：长度 3 到 50，只允许字母、数字、下划线。
2. `email`：必须是合法邮箱格式。
3. `password`：长度至少 8 位，至少包含字母和数字。
4. `newPassword`：不能和旧密码相同。
5. `account`：不能为空，允许用户名或邮箱。

### 安全注意事项

1. 不要把数据库密码、JWT 密钥、通义千问 API Key 写进代码仓库。
2. 所有 SQL 都使用参数化查询，不拼接用户输入。
3. 登录失败信息保持一致，避免泄露账号是否存在。
4. 所有返回给前端的用户对象都要去掉 `password` 字段。
5. 生产环境必须开启 HTTPS，避免 token 在网络传输中被窃取。
6. 修改密码后建议前端清除本地 token 并要求用户重新登录。
7. 如果需要“服务端强制登出”，可以增加 `token_blacklist` 表或改用 refresh token 方案。
8. 如果聊天接口后续要绑定用户，应给 `POST /api/chat` 增加 `JwtAuthGuard`，并通过 `request.user.userId` 关联聊天记录。

### 推荐实现顺序

1. 安装数据库、JWT、密码哈希相关依赖。
2. 增加 `DatabaseModule`，确认后端可以连接 `kitt` 数据库。
3. 增加 `AuthModule`，先完成注册和登录。
4. 增加 `JwtStrategy` 和 `JwtAuthGuard`，保护需要登录的接口。
5. 增加 `UsersModule`，完成获取当前用户、修改资料、修改密码。
6. 加入 DTO 参数校验，减少无效请求进入业务逻辑。
7. 用 curl 或前端页面完成注册、登录、带 token 请求的完整联调。

## AI 聊天功能设计方案（含历史会话与持久化）

本节基于现有 `ChatModule` 与通义千问流式接口，新增“会话管理”与“消息持久化”，支持用户登录后查看历史会话、创建新会话、继续对话。

### 设计目标

1. **会话隔离**：每个用户的会话独立，用户 A 不能查看或修改用户 B 的会话。
2. **消息持久化**：所有对话（用户输入与 AI 回复）都存入 PostgreSQL，支持用户下次登录时继续之前的话题。
3. **流式体验不变**：保留现有 SSE 流式返回，不因为持久化而增加用户首字时间。
4. **历史回顾**：提供会话列表、会话详情接口，前端可以展示侧边栏历史会话与具体对话。
5. **低成本兼容**：最小化改动现有 `ChatService`/`ChatController`，只在周围包装一层会话逻辑。

### 数据库设计

在已有 `users` 表基础上，新增两张表：`conversations`（会话）和 `messages`（消息）。新增 `updated_at` 自动更新触发器复用前文已有的 `update_updated_at_column()` 函数。

#### conversations 表

```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

CREATE TRIGGER update_conversations_updated
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

字段说明：

1. `id`：会话主键，自增。
2. `user_id`：外键关联 `users.id`，删除用户时一并级联删除其所有会话（`ON DELETE CASCADE`）。
3. `title`：会话标题，用于列表页展示，例如“帮我写 Python 脚本”。前端可以截取第一条用户消息前 30 字符作为初始标题，也允许用户后续手动修改。
4. `created_at` / `updated_at`：创建与更新时间，`updated_at` 每次新增消息时会自动刷新，方便在会话列表页按“最近活跃”排序。
5. 索引：`(user_id)` 用于拉取某个用户的所有会话；`(user_id, updated_at DESC)` 用于在会话列表页直接按最近活跃排序，避免额外排序成本。

#### messages 表

```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at ASC);

CREATE TRIGGER update_messages_updated
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

字段说明：

1. `id`：消息主键，自增。
2. `conversation_id`：外键关联 `conversations.id`，删除会话时一并级联删除其下所有消息。
3. `role`：消息角色，只允许 `'user'`（用户）或 `'assistant'`（AI），使用 CHECK 约束保证数据有效性。
4. `content`：消息正文，TEXT 类型避免截断长回复。
5. `created_at`：消息创建时间，与对话顺序强相关。
6. 索引：`(conversation_id)` 用于拉取单个会话的所有消息；`(conversation_id, created_at ASC)` 用于按时间顺序（从旧到新）加载历史消息。

### 后端 API 设计

所有新接口都需要登录（`@UseGuards(JwtAuthGuard)`），且所有操作都基于 `request.user.userId`，避免越权访问。

#### 1. 会话列表

```
GET /api/conversations
```

请求：无需 body，仅需 `Authorization: Bearer <token>`。

响应示例：

```json
[
  {
    "id": 1,
    "title": "帮我写 Python 脚本",
    "created_at": "2026-07-01T12:00:00.000Z",
    "updated_at": "2026-07-01T12:30:00.000Z"
  },
  {
    "id": 2,
    "title": "React Hooks 使用问题",
    "created_at": "2026-07-01T11:00:00.000Z",
    "updated_at": "2026-07-01T11:15:00.000Z"
  }
]
```

说明：返回当前用户所有会话，默认按 `updated_at DESC` 排序（最近活跃在前）。

#### 2. 会话详情

```
GET /api/conversations/:id
```

请求：`:id` 为会话 ID，需登录且该会话属于当前用户。

响应示例：

```json
{
  "id": 1,
  "title": "帮我写 Python 脚本",
  "created_at": "2026-07-01T12:00:00.000Z",
  "updated_at": "2026-07-01T12:30:00.000Z",
  "messages": [
    {
      "id": 101,
      "role": "user",
      "content": "写个读取 CSV 的 Python 脚本",
      "created_at": "2026-07-01T12:00:00.000Z"
    },
    {
      "id": 102,
      "role": "assistant",
      "content": "好的，这是一个简单的 Python 脚本...",
      "created_at": "2026-07-01T12:00:30.000Z"
    }
  ]
}
```

说明：如果会话不存在或不属于当前用户，返回 `404 Not Found`。

#### 3. 创建会话（可选显式标题）

```
POST /api/conversations
```

请求体：

```json
{
  "title": "新会话"
}
```

`title` 可选。如果不传，前端或者后端可以先创建空标题，等第一条用户消息到来时自动截取前 30 字符作为标题。

响应示例：

```json
{
  "id": 3,
  "title": null,
  "created_at": "2026-07-01T13:00:00.000Z",
  "updated_at": "2026-07-01T13:00:00.000Z"
}
```

#### 4. 修改会话标题

```
PATCH /api/conversations/:id
```

请求体：

```json
{
  "title": "Python 脚本（优化版）"
}
```

响应：返回修改后的完整会话对象（同会话详情的外层结构）。

#### 5. 删除会话

```
DELETE /api/conversations/:id
```

响应：`200 OK`，可以返回 `{"message": "删除成功"}`。删除操作会通过数据库级联约束一并删除该会话下所有 `messages`，无需额外代码。

#### 6. 发送消息（集成流式 + 持久化）

把现有 `POST /api/chat` 改为支持会话。保留流式 SSE 返回的同时，在流结束后把用户输入与 AI 回复一并写入数据库。

新接口签名：

```
POST /api/conversations/:id/messages
```

或兼容模式（允许不传 `:id` 自动创建新会话）：

```
POST /api/chat
```

两种方式都可，推荐前者。

请求体（与现有 `ChatMessageDto` 保持一致）：

```json
{
  "message": "继续刚才的话题，加上错误处理"
}
```

请求头：

```
Authorization: Bearer <token>
Content-Type: application/json
```

响应：与现有 `ChatController` 相同，SSE 流式返回 `data: {"text": "..."}`，最后返回 `data: [DONE]`。

服务端内部流程：

1. 验证会话是否属于当前用户；如果是自动新建会话的方式，就先创建会话。
2. 把当前用户输入存入 `messages`（role: 'user'）。
3. 从数据库拉取该会话下所有历史消息（role + content），构造通义千问的 messages 数组（多轮对话）。
4. 调用通义千问流式接口，边收边通过 SSE 写回前端。
5. 流结束后，把 AI 完整回复拼接起来，存入 `messages`（role: 'assistant'）。
6. 更新会话 `updated_at`，顺便用第一条用户消息自动生成会话标题（如果当前标题为空）。

#### 7. 获取单个会话的历史消息（可选独立接口）

```
GET /api/conversations/:id/messages
```

与会话详情接口返回的 `messages` 内容一致，适合只需要消息不需要会话元数据的场景。

### 修改现有模块建议

#### 调整 ChatModule

1. 把 `ChatModule` 改造为依赖 `DatabaseModule`，注入 `DATABASE_POOL`。
2. 把 `ChatService` 拆分：
   - 核心流处理保持为私有方法 `async *streamFromDashScope(messages: Array<{role: string; content: string}>)`；
   - 对外暴露新方法 `async *streamWithPersistence(userId: number, conversationId?: number, userContent: string)`，用于处理会话、持久化与上下文拼接。
3. 新增 `ConversationsService` 与 `ConversationsController`，专门处理会话列表/详情/修改/删除；也可以先把简单逻辑临时放在 `ChatService` 里，后续再拆分独立模块。

#### 调整 ChatController

```ts
import { Controller, Post, Body, Res, UseGuards, Req, Get, Param, Patch, Delete, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './chat-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../users/types/authenticated-request.type';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations/:id/messages')
  async streamToConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: number,
    @Body() body: ChatMessageDto,
    @Res() res: Response,
  ) {
    if (!body?.message || typeof body.message !== 'string') {
      throw new BadRequestException('message 不能为空');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const text of this.chatService.streamWithPersistence(
        req.user.userId,
        Number(conversationId),
        body.message,
      )) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败';
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  // 保留原有路径作为兼容入口（自动创建新会话）
  @Post('chat')
  async streamNewConversation(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChatMessageDto,
    @Res() res: Response,
  ) {
    // 复用上面同一个逻辑，conversationId 传 undefined 表示“自动新建会话”
    // 其余代码同上
  }

  @Get('conversations')
  getConversations(@Req() req: AuthenticatedRequest) {
    return this.chatService.getConversations(req.user.userId);
  }

  @Get('conversations/:id')
  getConversation(@Req() req: AuthenticatedRequest, @Param('id') conversationId: number) {
    const conversation = this.chatService.getConversation(req.user.userId, Number(conversationId));
    if (!conversation) {
      throw new NotFoundException('会话不存在或无权限访问');
    }
    return conversation;
  }

  @Patch('conversations/:id')
  updateTitle(@Req() req: AuthenticatedRequest, @Param('id') conversationId: number, @Body() body: {title?: string}) {
    return this.chatService.updateTitle(req.user.userId, Number(conversationId), body.title);
  }

  @Delete('conversations/:id')
  deleteConversation(@Req() req: AuthenticatedRequest, @Param('id') conversationId: number) {
    return this.chatService.deleteConversation(req.user.userId, Number(conversationId));
  }
}
```

注意：`ConversationsService` 可以先在 `ChatService` 里实现，后续业务变复杂再独立拆分为 `ConversationModule`。

### 前端集成建议（基于现有 React 项目）

1. 新增 zustand store：`useChatStore`，保存：
   - 当前选中的会话 `activeConversationId`；
   - 会话列表 `conversations`；
   - 当前会话消息列表 `messages`。

2. 新增页面/组件：
   - 会话侧边栏组件：`ConversationList.tsx`，调用 `GET /api/conversations`，点击后切换 `activeConversationId` 并拉取消息。
   - 主聊天区组件：`ChatWindow.tsx`，展示消息列表，底部是输入框，提交调用流式接口。

3. 流式接入：使用 EventSource 或自定义 fetch，逐段拼接 AI 回复，并在本地临时展示到界面，等最终返回 `[DONE]` 后再触发一次消息列表刷新，确保与数据库同步。

### 安全注意事项

1. **会话归属校验**：所有涉及 `conversation_id` 的操作都必须先检查该会话的 `user_id` 是否等于 `request.user.userId`，避免通过改 URL 越权访问别人的会话。
2. **消息内容脱敏**：`messages` 不直接暴露给用户列表类接口，只在会话详情且通过权限校验后返回。
3. **流式优先**：持久化操作放在 SSE 流结束后执行，不要在中间等待写入数据库，否则首字时间会增加。
4. **内容长度**：虽然 PostgreSQL TEXT 容量很大，建议仍然对单条消息长度做合理限制（例如 64K），避免滥用或恶意写入过大内容。
5. **通义千问上下文窗口**：拉取历史消息时可以只拉取最近 N 条（例如最近 20 条或最近 3000 token），防止上下文超长触发通义千问接口报错。

### 实施路径

1. 先执行数据库 SQL，创建 `conversations` 与 `messages` 表。
2. 在现有 `ChatModule` 中逐步补全会话与消息的 CRUD 逻辑，接入 `JwtAuthGuard`。
3. 改造聊天接口，把历史消息拼成通义千问 messages 数组，流结束后把用户与 AI 消息一并写入数据库。
4. 先实现“无前端”验证：用 curl 完成登录、创建会话、发送消息、查看历史列表等整个流程。
5. 最后对接前端，把现有单独聊天改造成带侧边栏的会话式界面。
