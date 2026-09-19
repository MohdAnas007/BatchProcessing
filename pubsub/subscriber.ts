import Redis from "ioredis";
import config from "../config/config"
const redisurl=config.redisurl;

const subscriber = new Redis(redisurl);

subscriber.on("error", (err) => {
    console.error("Redis subscriber error:", err);
});
export default subscriber;