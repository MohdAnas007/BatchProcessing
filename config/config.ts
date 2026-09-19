import "dotenv/config"
if(!process.env.DB_URL){
    throw new Error("db url not found in dotenv");

}
if(!process.env.REDIS_URL){
    throw new Error("Redis url not found in .env");

}
const  config={
    dburl:process.env.DB_URL,
    redisurl:process.env.REDIS_URL
}

export default config;