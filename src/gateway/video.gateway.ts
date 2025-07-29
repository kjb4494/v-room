import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class VideoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, Socket>();
  private userConnections = new Map<string, Set<string>>(); // userId -> Set of connected peer IDs

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId = this.getUserIdBySocket(client);
    if (userId) {
      this.connectedUsers.delete(userId);
      this.userConnections.delete(userId);
      client.to('default').emit('userLeft', { userId });
      console.log(`User ${userId} left the room`);
    }
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { userId } = data;
    console.log(`User ${userId} attempting to join room`);

    // 사용자 연결 정보 저장
    this.connectedUsers.set(userId, client);
    this.userConnections.set(userId, new Set());

    // 방에 입장
    client.join('default');

    // 현재 방에 있는 모든 사용자 목록 전송
    const allUsers = Array.from(this.connectedUsers.keys()).filter(
      (id) => id !== userId,
    );
    client.emit('roomUsers', { users: allUsers });

    // 다른 사용자들에게 새 사용자 입장 알림
    client.to('default').emit('userJoined', { userId });

    console.log(`User ${userId} joined the room successfully`);

    // 현재 방에 있는 사용자 수 전송
    const roomSize =
      this.server.sockets.adapter.rooms.get('default')?.size || 0;
    client.emit('roomInfo', { userCount: roomSize });
    console.log(`Room size: ${roomSize}`);
  }

  @SubscribeMessage('signal')
  handleSignal(
    @MessageBody() data: { signal: any; targetUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { signal, targetUserId } = data;
    const fromUserId = this.getUserIdBySocket(client);

    if (!fromUserId) {
      console.log('Unknown user sending signal');
      return;
    }

    console.log(
      `Signal from ${fromUserId} to ${targetUserId}:`,
      signal.type || 'candidate',
    );

    // 특정 사용자에게 시그널 전송
    const targetSocket = this.connectedUsers.get(targetUserId);
    if (targetSocket) {
      targetSocket.emit('signal', {
        signal,
        fromUserId,
      });
      console.log(`Signal sent to user: ${targetUserId}`);

      // 연결 상태 추적
      if (signal.type === 'offer') {
        this.addConnection(fromUserId, targetUserId);
      }
    }
  }

  private addConnection(userId1: string, userId2: string) {
    if (!this.userConnections.has(userId1)) {
      this.userConnections.set(userId1, new Set());
    }
    if (!this.userConnections.has(userId2)) {
      this.userConnections.set(userId2, new Set());
    }

    this.userConnections.get(userId1)?.add(userId2);
    this.userConnections.get(userId2)?.add(userId1);
  }

  private getUserIdBySocket(socket: Socket): string | null {
    for (const [userId, userSocket] of this.connectedUsers.entries()) {
      if (userSocket.id === socket.id) {
        return userId;
      }
    }
    return null;
  }
}
