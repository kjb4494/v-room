import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { RoomService } from './room.service';

@Controller()
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @GrpcMethod('RoomService', 'JoinRoom')
  joinRoom(data: { userId: string }) {
    return this.roomService.joinRoom(data);
  }
}
