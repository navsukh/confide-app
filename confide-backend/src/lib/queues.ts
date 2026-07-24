import { Queue } from "bullmq";
import { createRedisConnection } from "./redis.js";

export const QUEUE_NAMES = {
  matching: "matching",
} as const;

export const matchingQueue = new Queue(QUEUE_NAMES.matching, {
  connection: createRedisConnection(),
});

export interface MatchingJobData {
  matchRequestId: string;
}
