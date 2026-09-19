import { Pool } from "pg";
import config from "@/config/config";
const pool=new Pool({
    connectionString:config.dburl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
export  default pool;