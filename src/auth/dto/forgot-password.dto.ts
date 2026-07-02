import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  // 忘记密码流程要求同时提供用户名和邮箱进行匹配。
  // 这样即使别人只知道账号也无法重置他人的密码，形成一层轻量校验。
  // 后续如果接入邮箱验证码或短信验证码，可以在这个 DTO 上补 code 字段。
  @IsString({ message: '用户名必须是字符串' })
  @MinLength(1, { message: '用户名不能为空' })
  username!: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  email!: string;

  // 新密码同样要求至少 8 位并包含字母和数字，和注册规则保持一致。
  @IsString({ message: '新密码必须是字符串' })
  @MinLength(8, { message: '新密码长度至少 8 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '新密码至少需要包含字母和数字',
  })
  newPassword!: string;
}
