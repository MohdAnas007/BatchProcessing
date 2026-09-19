import { DataTypes } from "sequelize";
import { sequelize } from "@/db/sequelize";

const Batch = sequelize.define(
  "Batch",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    count: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "RUNNING", "COMPLETED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    tableName: "batches",
    timestamps: true,
  }
);

const BatchItem = sequelize.define(
  "BatchItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    itemNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "RUNNING", "COMPLETED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    tableName: "batch_items",
    timestamps: true,
  }
);

Batch.hasMany(BatchItem, {
  foreignKey: "batchId",
});

BatchItem.belongsTo(Batch, {
  foreignKey: "batchId",
});

export { Batch, BatchItem };