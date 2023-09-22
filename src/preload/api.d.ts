import { GetBlockDataReturnType } from "src/main/handlers/get-block-data";
import type { GetDetailedBlockDataReturnType } from "../main/handlers/get-detailed-block-data";

export type API = {
  saveBufferedJarFile: (data: ArrayBuffer, jarName: string) => Promise<void>;
  fetchDownloadedJarNames: () => Promise<string[]>;
  clearCache: () => Promise<void>;
  deleteJar: (slug: string) => Promise<void>;
  searchBlockAsset: (
    query: string,
  ) => Promise<{ blockName: string; blockId: string; texture64: string; modId: string }[]>;
  getDetailedBlockData: (jarSlug: string, blockId: string) => GetDetailedBlockDataReturnType;
  getBlockData: (blockId: string) => GetBlockDataReturnType;
};
