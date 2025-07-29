import { Module } from '@nestjs/common';
import { VideoGateway } from './gateway/video.gateway';
import { RoomModule } from './room/room.module';

@Module({
  imports: [RoomModule],
  providers: [VideoGateway],
})
export class AppModule {}
