import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // gRPC 마이크로서비스 설정
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'room',
      protoPath: join(__dirname, '..', 'proto', 'room.proto'),
      url: 'localhost:5000',
    },
  });

  // Socket.IO 어댑터 설정
  app.useWebSocketAdapter(new IoAdapter(app));

  // CORS 설정
  app.enableCors({ origin: '*' });

  // 정적 파일 서빙 설정
  app.useStaticAssets(join(__dirname, '..', 'client'));

  // gRPC 마이크로서비스 시작
  await app.startAllMicroservices();

  // HTTP 서버 시작
  await app.listen(process.env.PORT ?? 3000);
  console.log('HTTP Server running on http://localhost:3000');
  console.log('gRPC Server running on localhost:5000');
}
bootstrap();
