import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // UsersService 需要访问 PostgreSQL users 表，所以导入 DatabaseModule。
  imports: [DatabaseModule],

  // UsersController 暴露 /api/users/me 和 /api/users/me/password 等接口。
  controllers: [UsersController],

  // UsersService 负责查询用户、修改资料、修改密码等业务逻辑。
  providers: [UsersService],
})
export class UsersModule {}
