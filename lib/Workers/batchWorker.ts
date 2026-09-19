import { Worker, Job } from "bullmq";
import redisConnection from "../Queue/redis";
import itemqueue  from "../Queue/queue2";
import { Batch, BatchItem } from "@/db/model";
import { randomUUID } from "crypto";

console.log("Batch Worker starting...");

const worker = new Worker("batch-processing", async (job: Job) => {
  const { id: batchId, count } = job.data;
  
  console.log(`[Batch Worker] Job ${job.id} started. Splitting batch ${batchId} into ${count} items...`);
  
  try {
    await Batch.update({ status: "RUNNING" }, { where: { id: batchId } });

    for (let i = 1; i <= count; i++) {
      const itemId = randomUUID();
      
      await BatchItem.create({
        id: itemId,
        batchId: batchId,
        itemNumber: i,
        status: "PENDING",
      });

      await itemqueue.add("process-item", { itemId, batchId, itemNumber: i });
      

      console.log(`[Batch Worker] Queued item ${i}/${count} (Item ID: ${itemId})`);
    }

    await Batch.update({ status: "COMPLETED" }, { where: { id: batchId } });
    
    console.log(`[Batch Worker] Successfully finished batch ${batchId}. All items queued.`);
    return { batchId, status: "SUCCESS" };

  } catch (error) {
    await Batch.update({ status: "FAILED" }, { where: { id: batchId } });
    console.error(`[Batch Worker] Error processing batch ${batchId}:`, error);
    throw error;
  }
}, { connection: redisConnection,concurrency:5 });

worker.on("active", (job) => {
  console.log(`[Event] Worker picked up Batch Job ${job.id}`);
});

worker.on("completed", (job) => {
  console.log(`[Event] Batch Job ${job.id} is done and removed from active queue`);
});

worker.on("failed", (job, err) => {
  console.error(`[Event] Batch Job ${job?.id} failed with error: ${err.message}`);
});