import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // ConfigModule 是 NestJS 官方配置模块。
    // forRoot 会在应用启动时读取 process.env 和项目根目录下的 .env 文件。
    // isGlobal: true 表示其他模块可以直接注入 ConfigService，不需要重复导入 ConfigModule。
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // DatabaseModule 负责创建 PostgreSQL 连接池。
    // AuthModule 和 UsersModule 都会通过它访问 kitt 数据库中的 users 表。
    DatabaseModule,

    // AuthModule 提供注册、登录、登出接口。
    // 登录成功后会签发 JWT accessToken 给前端保存。
    AuthModule,

    // UsersModule 提供获取当前用户、修改资料、修改密码接口。
    // 这些接口都会使用 JwtAuthGuard，必须登录后才能访问。
    UsersModule,

    // ChatModule 是聊天能力的功能模块。
    // 当前它包含 /api/chat 接口，以及调用通义千问流式输出的业务逻辑。
    ChatModule,
  ],
})
export class AppModule {}
