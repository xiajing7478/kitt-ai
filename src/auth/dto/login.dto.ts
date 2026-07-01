import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // account 支持用户名或邮箱登录。
  // 服务端会用同一个值同时匹配 users.username 和 users.email。
  @IsString({ message: '账号必须是字符串' })
  @MinLength(1, { message: '账号不能为空' })
  account!: string;

  // 登录密码只用于和数据库中的 bcrypt 哈希值做比对，不会记录日志，也不会返回给前端。
  @IsString({ message: '密码必须是字符串' })
  @MinLength(1, { message: '密码不能为空' })
  password!: string;
}
