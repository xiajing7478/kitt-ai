import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // NestFactory 是 NestJS 创建应用实例的入口。
  // 这里传入 AppModule，NestJS 会从根模块开始加载所有 controller 和 provider。
  const app = await NestFactory.create(AppModule);

  // 开启全局 DTO 校验。
  // whitelist 会自动移除 DTO 中没有声明的字段，避免前端传入多余字段进入业务逻辑。
  // forbidNonWhitelisted 会在出现多余字段时直接返回 400，方便开发阶段发现请求体错误。
  // transform 会把请求体转换成 DTO 实例，让 class-validator 的规则稳定生效。
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // PORT 支持通过环境变量配置，方便本地开发、服务器部署或 Docker 部署时修改端口。
  // 如果没有配置 PORT，就使用 4000 端口。
  const port = Number(process.env.PORT ?? 4000);

  // 开启跨域访问。后续 React 前端独立成新项目后，浏览器才能从前端开发端口请求这个后端。
  app.enableCors();

  await app.listen(port);

  console.log(`NestJS 服务已启动：http://localhost:${port}`);
}

bootstrap();
