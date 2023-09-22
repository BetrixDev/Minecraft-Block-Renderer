import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { RendererCard } from "./components/RendererCard";
import { BlockListCard } from "./components/BlockListCard";
import { ModListCard } from "./components/ModListCard";

function App(): JSX.Element {
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isDownloadingVanilla, setIsDownloadingVanilla] = useState(false);
  const [vanillaDownloadProgress, setVanillaDownloadProgress] = useState(0);

  const { data: downloadedJars, refetch: refetchJars } = useQuery({
    initialData: [],
    queryKey: ["downloadedJars"],
    queryFn: async () => {
      return await window.api.fetchDownloadedJarNames();
    },
  });

  async function downloadVanilla() {
    setIsDownloadingVanilla(true);

    const response = await axios(
      "https://piston-data.mojang.com/v1/objects/0c3ec587af28e5a785c0b4a7b8a30f9a8f78f838/client.jar",
      {
        responseType: "arraybuffer",
        onDownloadProgress: (e) => {
          const percentage = Math.round((e.loaded * 100) / (e.total ?? 100));
          setVanillaDownloadProgress(percentage);
        },
      },
    );

    const buffer = response.data;

    await window.api.saveBufferedJarFile(buffer, "minecraft");

    setIsDownloadingVanilla(false);
  }

  async function deleteJar(slug: string) {
    await window.api.deleteJar(slug);
    refetchJars();
  }

  async function clearCache() {
    setIsClearingCache(true);
    await window.api.clearCache();
    refetchJars();
    downloadVanilla();
    setIsClearingCache(false);
  }

  return (
    <main
      className={`flex flex-col min-h-screen items-center justify-between p-4 gap-4 bg-neutral-50 dark:bg-neutral-950 text-neutral-50`}
    >
      <div className="w-full h-16 flex px-3 items-center rounded-lg border border-neutral-200 dark:border-neutral-800 justify-between">
        <h1 className="text-neutral-950 dark:text-neutral-50 text-3xl font-bold">Minecraft Block Renderer</h1>
        <div className="flex gap-2 items-center">
          {isDownloadingVanilla && (
            <div className="h-10 flex px-3 flex-col justify-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs">Downloading vanilla jar</p>
              <Progress className="h-1" value={vanillaDownloadProgress} />
            </div>
          )}
          <Button disabled={isClearingCache} variant="secondary" onClick={clearCache}>
            Clear Download Cache
          </Button>
        </div>
      </div>
      <div className="w-full flex gap-4">
        <RendererCard />
        <div className=" basis-[32rem] flex flex-col gap-4">
          <BlockListCard />
          <ModListCard
            deleteJar={deleteJar}
            refetchDownloadedJars={refetchJars}
            downloadedJars={downloadedJars}
          />
        </div>
      </div>
    </main>
  );
}

export default App;
