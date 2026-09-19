import { connectToDb } from "@/db/sequelize";
import { NextRequest,NextResponse } from "next/server";
import { Batch } from "@/db/model";
import jobqueue from "@/lib/Queue/queue1";
import { randomUUID } from "crypto";
import subscriber from "@/pubsub/subscriber";

export async function POST(req: NextRequest){
    try{
        const { count } = await req.json();

        if(!count || isNaN(count) || count<=0){
            return NextResponse.json(
                { error: "Please provide a valid count N greater than 0" },
                { status: 400 }
            )
        }

        await connectToDb();

        const batchId = randomUUID();

        await Batch.create({
            id: batchId,
            count: count,
            status: "PENDING" 
        });

        await jobqueue.add("batch-job", {
            id: batchId,
            count: count
        });
        return NextResponse.json({
            message:"count recieved",
            batchId:batchId
        })

    }
    catch(err){
        console.log(err);
        return NextResponse.json({"message":"some error"});

    }
}

export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest
) {

    const batchid = req.nextUrl.searchParams.get("batchId");
    if (!batchid) {
        return NextResponse.json({ error: "Missing batchId" }, { status: 400 });
    }

    subscriber.subscribe("item-updates", (err) => {
    if (err) {
        console.error("Failed to subscribe to channel:", err);
        return;
    }
    console.log(`Subscribed successfully! Listening for updates...`);
    });


    const encoder = new TextEncoder();


    const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "CONNECTED" })}\n\n`));


      const messageHandler = (channel: string, message: string) => {
        if (channel === "item-updates") {
          try {
            const data = JSON.parse(message);

            if (data.batchId === batchid) {
              controller.enqueue(encoder.encode(`data: ${message}\n\n`));
            }
          } catch (error) {
            console.error("Parse error:", error);
          }
        }
      };

      subscriber.on("message", messageHandler);


      req.signal.addEventListener("abort", () => {
        console.log(`[SSE] Client disconnected for batch ${batchid}`);
        subscriber.removeListener("message", messageHandler);
        controller.close();
      });
    }
    });

    return new NextResponse(stream, {
        headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        },
    });

}