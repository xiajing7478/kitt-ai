import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

/**
 * 读取必填的环境变量。
 * 一旦缺失就直接抛错，避免使用内置默认值“悄悄”连接到错误的数据库，
 * 也能防止把生产密码之类的敏感信息硬编码在代码里被推到仓库。
 */
function readRequiredEnv(configService: ConfigService, key: string): string {
  const value = configService.get<string>(key);   
  if (!value) {
    throw new Error(`缺少环境变量 ${key}，请在项目根目录的 .env 中配置`);
  }
  return value;
}

export const databaseProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    // 这里创建 PostgreSQL 连接池，而不是每次请求都创建一个新连接。
    // 连接池会复用数据库连接，性能更稳定，也能避免连接数过快耗尽。
    const pool = new Pool({
      host: readRequiredEnv(configService, 'DATABASE_HOST'),
      port: Number(readRequiredEnv(configService, 'DATABASE_PORT')),
      database: readRequiredEnv(configService, 'DATABASE_NAME'),
      user: readRequiredEnv(configService, 'DATABASE_USER'),
      password: readRequiredEnv(configService, 'DATABASE_PASSWORD'),
    });

    // 只打印非敏感的连接元数据（host / port / database），
    // 帮助确认加载的 .env 是否正确，同时避免把用户名密码写进日志。
    console.log(
      `PostgreSQL 连接池已创建：${pool.options.host}:${pool.options.port}/${pool.options.database}`,
    );

    // 监听连接池错误，避免数据库连接异常时进程静默失败。
    // 这里只输出错误消息，不打印数据库密码、JWT 密钥等敏感配置。
    pool.on('error', (error) => {
      console.error('PostgreSQL 连接池异常：', error.message);
    });

    return pool;
  },
};
