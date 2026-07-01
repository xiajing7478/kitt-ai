import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    // 注册成功后返回安全用户信息和 accessToken。
    // 前端可以保存 accessToken，并在后续请求中放到 Authorization 请求头。
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    // 登录支持用户名或邮箱。
    // 请求体格式：{ "account": "alice", "password": "Passw0rd123" }。
    return this.authService.login(loginDto);
  }

  @Post('logout')
  logout() {
    // JWT 基础版登出不需要访问数据库。
    // 服务端返回成功提示，前端删除本地 token 即可完成退出登录。
    return this.authService.logout();
  }
}
