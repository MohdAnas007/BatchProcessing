
import Redis from "ioredis";
import config from "@/config/config";
const redisurl=config.redisurl
const  redisConnection = new Redis(redisurl, {
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
  enableReadyCheck: false,
  tls: {
    rejectUnauthorized: false,
  },
});

export default redisConnection;