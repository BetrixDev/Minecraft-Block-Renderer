import { readFileSync } from "fs";
import { CACHE_DIRECTORY } from "../constants";
import AdmZip from "adm-zip";
import { blockStateSchema } from "..";

export async function getDetailedBlockData(jarSlug: string, entryName: string) {
  const jarFileBuffer = readFileSync(`${CACHE_DIRECTORY}/mods/${jarSlug}.jar`);
  const jarArchive = new AdmZip(jarFileBuffer);

  const blockStateEntry = jarArchive.getEntry(entryName);

  const blockStateData = blockStateSchema.safeParse(
    JSON.parse(blockStateEntry?.getData().toString() ?? "{}"),
  );

  if (!blockStateData.success) return;

  const variants = blockStateData.data.variants;

  if (!variants) return;

  if (variants[""]) {
    let modelEntryPath: string;

    if (Array.isArray(variants[""])) {
      modelEntryPath = variants[""][0].model;
    } else {
      modelEntryPath = variants[""].model;
    }
  }
}

export type GetDetailedBlockDataReturnType = ReturnType<typeof getDetailedBlockData>;
