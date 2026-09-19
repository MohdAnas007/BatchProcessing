import { Worker, Job } from "bullmq";
import redisConnection from "../Queue/redis";
import { BatchItem } from "@/db/model";
import publisher from "@/pubsub/publisher";
import { connectToDb } from "@/db/sequelize";

console.log("Item Worker starting...");
connectToDb().catch(console.error);

const itemWorker = new Worker("item-processing", async (job: Job) => {
    const data = job.data;
    
    // process the item with randomized success/failure 
    const item = await BatchItem.findOne({ where: { id: data.itemId } });
    if (!item) {
        console.log(`[Item Worker] Item ${data.itemId} not found`);
        return;
    }

    const randomtime = Math.random() + 1;  // random time between 1 and 2 
    await new Promise((resolve) => setTimeout(resolve, randomtime * 1000));
    
    // Determine the final status
    const finalStatus = Math.random() > 0.5 ? "SUCCESS" : "FAILED";
    
    console.log(`[${finalStatus}]: processed item ${data.itemId} in batch ${data.batchId}`);
    
    // 1. Update the database
    const dbStatus = finalStatus === "SUCCESS" ? "COMPLETED" : "FAILED";
    await item.update({ status: dbStatus });

    // 2. Publish the status update via pub/sub
    try {
        const payload = JSON.stringify({
            batchId: data.batchId,
            itemId: data.itemId,
            itemNum: data.itemNumber, // Make sure 'itemNumber' is being passed in job.data when you add it to the queue!
            status: finalStatus
        });

        // Replace "item-updates" with whatever channel name your subscriber/websocket is listening to
        await publisher.publish("item-updates", payload);
        
    } catch (publishError) {
        console.error(`[Publish Error] Failed to publish for item ${data.itemId}:`, publishError);
    }

}, { 
  connection: redisConnection,
  concurrency: 5 
});