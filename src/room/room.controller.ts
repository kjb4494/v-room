import { Body, Controller, Get, Post } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RoomService } from './room.service';

@Controller()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @GrpcMethod('RoomService', 'JoinRoom')
  joinRoom(data: { userId: string }) {
    return this.roomService.joinRoom(data);
  }

  // HTTP 엔드포인트들 (브라우저에서 gRPC 기능 사용을 위한 프록시)
  @Get('grpc/health')
  grpcHealth() {
    return { status: 'ok', message: 'gRPC service is running' };
  }

  @Post('grpc/join')
  grpcJoin(@Body() data: { userId: string }) {
    try {
      const result = this.roomService.joinRoom(data);
      return result;
    } catch {
      return { success: false, message: 'gRPC join failed' };
    }
  }
}
