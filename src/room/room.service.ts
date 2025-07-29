import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomService {
  private users: Set<string> = new Set();

  joinRoom({ userId }: { userId: string }) {
    this.users.add(userId);
    return { success: true, message: `User ${userId} joined` };
  }
}
