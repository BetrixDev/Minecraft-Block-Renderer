import { eq } from "drizzle-orm";
import { blocks, db } from "../drizzle";

export async function getBlockData(id: string) {
  const results = await db.select().from(blocks).where(eq(blocks.blockId, id));

  return results[0];
}

export type GetBlockDataReturnType = ReturnType<typeof getBlockData>;
