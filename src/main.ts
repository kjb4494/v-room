import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Socket.IO 어댑터 설정
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS 설정
  app.enableCors({ origin: '*' });

  // 정적 파일 서빙 설정
  app.useStaticAssets(join(__dirname, '..', 'client'));

  await app.listen(process.env.PORT ?? 3000);
  console.log('Server running on http://localhost:3000');
}
bootstrap();
