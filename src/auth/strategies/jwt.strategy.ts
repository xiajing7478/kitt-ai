import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload, JwtUser } from '../types/jwt-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('缺少 JWT_SECRET 环境变量，请在 .env 中配置一个足够长的随机字符串');
    }

    super({
      // 从请求头 Authorization: Bearer <token> 中提取 JWT。
      // 前端登录后，访问受保护接口时都需要带上这个请求头。
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // secretOrKey 用于校验 token 签名。
      // 它必须和 AuthService 签发 token 时使用的 JWT_SECRET 保持一致。
      secretOrKey: jwtSecret,
    });
  }

  validate(payload: JwtPayload): JwtUser {
    // validate 返回的对象会被 Passport 挂到 request.user 上。
    // 后续 UsersController 通过 request.user.userId 就能知道当前登录用户是谁。
    if (!payload?.sub) {
      throw new UnauthorizedException('登录状态无效');
    }

    return {
      userId: payload.sub,
      username: payload.username,
    };
  }
}
