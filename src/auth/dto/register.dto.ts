import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  // 用户名用于展示和登录。
  // 这里限制为 3 到 50 位，只允许字母、数字和下划线，避免出现空格或特殊字符造成展示和查询问题。
  @IsString({ message: '用户名必须是字符串' })
  @Matches(/^[a-zA-Z0-9_]{3,50}$/, {
    message: '用户名只能包含 3 到 50 位字母、数字或下划线',
  })
  username!: string;

  // 邮箱在数据库中是唯一字段，后续可以用于找回密码、邮箱验证等功能。
  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  // 密码不会明文保存到数据库。
  // AuthService 会使用 bcrypt 对密码加盐哈希后再写入 users.password 字段。
  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码长度至少 8 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '密码至少需要包含字母和数字',
  })
  password!: string;
}
