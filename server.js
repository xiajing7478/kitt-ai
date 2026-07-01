// 这个文件只作为兼容旧启动习惯的入口：如果你以前习惯运行 `node server.js`，它会转发到新的 NestJS 入口。
// 正式开发建议使用 `pnpm start:dev`，生产环境建议先 `pnpm build` 再 `pnpm start:prod`。
require('ts-node/register');
require('./src/main');
