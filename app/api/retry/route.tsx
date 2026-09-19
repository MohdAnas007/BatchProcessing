import { NextRequest, NextResponse } from "next/server";
import itemqueue from "@/lib/Queue/queue2";
import { BatchItem } from "@/db/model";
import { connectToDb } from "@/db/sequelize";
import publisher from "@/pubsub/publisher";

export async function POST(req: NextRequest) {
    try {
        const { itemId, batchId, itemNumber } = await req.json();

        if (!itemId || !batchId || !itemNumber) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        console.log("in retry route ");
        await connectToDb();

        await BatchItem.update({ status: "PENDING" }, { where: { id: itemId } });


        await itemqueue.add("process-item", { itemId, batchId, itemNumber });

        const payload = JSON.stringify({
            batchId,
            itemId,
            itemNum: itemNumber,
            status: "PENDING"
        });
        await publisher.publish("item-updates", payload);

        return NextResponse.json({ message: "Item queued for retry" });

    } catch (err) {
        console.error("Error retrying item:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
