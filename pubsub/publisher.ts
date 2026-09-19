import Redis from "ioredis";
import config from "@/config/config";
const redisurl=config.redisurl
 

const publisher = new Redis(redisurl);

publisher.on("error", (err) => {
    console.error("Redis publisher error:", err);
});

export default publisher;