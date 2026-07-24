import { Redis } from "ioredis";
import { config } from "../config.js";

// Redis is ephemeral by design (Section 3): queues, presence, pub/sub for the
// chat gateway, rate-limit counters. Nothing stored here should be the only
// copy of anything that matters.

export function createRedisConnection(): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
}

// Shared pub/sub pair for the WebSocket gateway. In a multi-instance
// deployment, every gateway instance subscribes to the same channels so a
// message published by the instance holding User A's socket reaches the
// instance holding User B's socket, with no sticky sessions required
// (Section 3, "stateless gateway layer").
export const redisPub = createRedisConnection();
export const redisSub = createRedisConnection();

export function conversationChannel(conversationId: string): string {
  return `chat:conversation:${conversationId}`;
}
