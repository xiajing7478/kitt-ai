import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { AuthenticatedRequest } from './types/authenticated-request.type';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@Req() request: AuthenticatedRequest) {
    // request.user 来自 JwtStrategy.validate 的返回值。
    // 用户 ID 从 token 中解析，不能由前端通过 body 或 query 传入，避免越权访问其他用户资料。
    return this.usersService.findMe(request.user.userId);
  }

  @Patch('me')
  updateProfile(@Req() request: AuthenticatedRequest, @Body() updateProfileDto: UpdateProfileDto) {
    // 只允许用户修改自己的 username/email。
    // 具体唯一性检查和 SQL 更新逻辑放在 UsersService 中。
    return this.usersService.updateProfile(request.user.userId, updateProfileDto);
  }

  @Patch('me/password')
  updatePassword(@Req() request: AuthenticatedRequest, @Body() updatePasswordDto: UpdatePasswordDto) {
    // 修改密码属于高风险操作，UsersService 会先校验旧密码，再保存新密码哈希。
    return this.usersService.updatePassword(request.user.userId, updatePasswordDto);
  }
}
