import {Queue} from "bullmq"
import redisConnection from "@/lib/Queue/redis"

const itemqueue=new Queue("item-processing",{
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: true, 
    removeOnFail: 1000,
  },
})


export default itemqueue;
