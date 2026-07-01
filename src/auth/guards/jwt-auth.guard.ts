import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // 这个守卫会自动执行 JwtStrategy：
  // 1. 从 Authorization 请求头读取 Bearer token。
  // 2. 校验 token 签名和过期时间。
  // 3. 校验通过后把当前用户信息写入 request.user。
  // 4. 校验失败时自动返回 401 Unauthorized。
}
