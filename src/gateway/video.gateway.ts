import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class VideoGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { userId: string }) {
    this.server.socketsJoin('default');
    this.server.to('default').emit('userJoined', { userId: data.userId });
  }

  @SubscribeMessage('signal')
  handleSignal(@MessageBody() data: { signal: any }) {
    this.server.to('default').emit('signal', data.signal);
  }
}
