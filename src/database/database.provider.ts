import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const DATABASE_POOL = 'DATABASE_POOL';

export const databaseProvider = {
  provide: DATABASE_POOL,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    // 这里创建 PostgreSQL 连接池，而不是每次请求都创建一个新连接。
    // 连接池会复用数据库连接，性能更稳定，也能避免连接数过快耗尽。
    const pool = new Pool({
      host: configService.get<string>('DATABASE_HOST', 'localhost'),
      port: Number(configService.get<string>('DATABASE_PORT', '5432')),
      database: configService.get<string>('DATABASE_NAME', 'kitt'),
      user: configService.get<string>('DATABASE_USER', 'root'),
      password: configService.get<string>('DATABASE_PASSWORD', '123456'),
    });

    // 监听连接池错误，避免数据库连接异常时进程静默失败。
    // 这里只输出错误消息，不打印数据库密码、JWT 密钥等敏感配置。
    pool.on('error', (error) => {
      console.error('PostgreSQL 连接池异常：', error.message);
    });

    return pool;
  },
};
