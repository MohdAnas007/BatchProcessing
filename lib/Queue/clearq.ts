import  jobqueue from "@/lib/Queue/queue1";
import itemqueue from "@/lib/Queue/queue2"

async function clear() {
  console.log("Clearing queues...");
  await jobqueue.obliterate({ force: true });
  await itemqueue.obliterate({ force: true });
  console.log("Queues cleared!");
  process.exit(0);
}

clear();    