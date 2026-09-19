import { Sequelize } from "sequelize";
import config from "@/config/config";
import pg from 'pg'
const dburl=config.dburl;

declare global {
  var _sequelize: Sequelize | undefined;
}
const sequelize =
  global._sequelize ||
  new Sequelize(dburl!, {
    dialect: "postgres",
    dialectModule:pg,
    logging: false,
    pool: {
      max: 5,       
      min: 0,
      acquire: 10000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  global._sequelize = sequelize;
}

const connectToDb=async ()=>{
      try{
            await sequelize.authenticate();
            console.log("Connection has been stablished");
            await sequelize.sync();
        }
        catch(error){
            console.log("Connection rejected",error);

        }
}

export {sequelize,connectToDb};
