import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateProfileDto {
  // username 是可选字段。
  // 用户只想修改邮箱时可以不传 username，UsersService 会保留原用户名。
  @IsOptional()
  @IsString({ message: '用户名必须是字符串' })
  @Matches(/^[a-zA-Z0-9_]{3,50}$/, {
    message: '用户名只能包含 3 到 50 位字母、数字或下划线',
  })
  username?: string;

  // email 是可选字段。
  // 用户只想修改用户名时可以不传 email，UsersService 会保留原邮箱。
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;
}
