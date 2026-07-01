import { IsString, Matches, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  // 修改密码前必须提供旧密码。
  // 服务端会先校验旧密码是否正确，防止别人拿到登录态后直接改密码。
  @IsString({ message: '旧密码必须是字符串' })
  @MinLength(1, { message: '旧密码不能为空' })
  oldPassword!: string;

  // 新密码会重新使用 bcrypt 哈希后保存。
  // 这里要求至少 8 位且包含字母和数字，避免用户设置过弱密码。
  @IsString({ message: '新密码必须是字符串' })
  @MinLength(8, { message: '新密码长度至少 8 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '新密码至少需要包含字母和数字',
  })
  newPassword!: string;
}
