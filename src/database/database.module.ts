import { Global, Module } from '@nestjs/common';
import { databaseProvider } from './database.provider';

@Global()
@Module({
  // databaseProvider 会在 NestJS 容器中注册一个全局 PostgreSQL 连接池。
  // 其他模块只需要通过 DATABASE_POOL 注入令牌，就能复用同一个连接池。
  providers: [databaseProvider],

  // exports 表示把连接池暴露给导入 DatabaseModule 的模块使用。
  // 当前 AuthModule 和 UsersModule 都会依赖它访问 users 表。
  exports: [databaseProvider],
})
export class DatabaseModule {}
