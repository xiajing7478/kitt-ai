import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { SignOptions } from 'jsonwebtoken';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // AuthService 需要访问 PostgreSQL users 表，所以导入数据库模块。
    DatabaseModule,

    // PassportModule 提供认证框架能力，JwtAuthGuard 会基于它工作。
    PassportModule,

    // JwtModule 用于签发 token。
    // registerAsync 允许在应用启动时从 .env 读取 JWT_SECRET 和过期时间。
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
          throw new Error('缺少 JWT_SECRET 环境变量，请在 .env 中配置一个足够长的随机字符串');
        }

        const expiresIn = configService.get<SignOptions['expiresIn']>('JWT_EXPIRES_IN', '2h');

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
