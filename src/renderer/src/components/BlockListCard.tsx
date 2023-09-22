import { FileQuestion } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useMainStore } from "@renderer/stores/main-store";

export function BlockListCard() {
  const selectedBlockId = useMainStore((s) => s.selectedBlockId);
  const [blockSearchQuery, setBlockSearchQuery] = useState<string>();

  const { data: selectedBlock } = useQuery({
    queryKey: ["selectedBlock", selectedBlockId],
    queryFn: async () => {
      if (!selectedBlockId) return null;

      return await window.api.getBlockData(selectedBlockId);
    },
  });

  const { data: blockResults } = useQuery({
    queryKey: ["blockResults", blockSearchQuery],
    queryFn: async () => await window.api.searchBlockAsset(blockSearchQuery ?? ""),
  });

  // useEffect(() => {
  //   function handleRefresh() {
  //     refetchBlockResults();
  //   }

  //   ipcMain.on("refresh-blocks", handleRefresh);

  //   return () => {
  //     ipcMain.off("refresh-blocks", handleRefresh);
  //   };
  // });

  return (
    <Card className="basis-1/2">
      <CardHeader>
        <div className="flex justify-between">
          <div className="flex flex-col gap-2">
            <CardTitle>Select a block</CardTitle>
            <CardDescription>Pick a block to show up in the renderer</CardDescription>
          </div>
          {selectedBlock && (
            <BlockCard
              modId={selectedBlock.modId}
              blockId={selectedBlock.blockId}
              blockName={selectedBlock.blockName ?? selectedBlock.blockId}
              isSelected={true}
              texture64={selectedBlock.texture64}
              renderButton={false}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          type="text"
          placeholder="Search for a block..."
          onChange={(e) => setBlockSearchQuery(e.target.value)}
        />
        <BlockList blockList={blockResults ?? []} selectedBlock={selectedBlockId} />
      </CardContent>
    </Card>
  );
}

function BlockList(props: {
  blockList: { blockName: string; blockId: string; texture64: string; modId: string }[];

  selectedBlock?: string;
}) {
  return (
    <div className="overflow-auto h-64 pr-2 flex flex-col gap-2">
      {props.blockList.map((block) => (
        <BlockCard
          key={block.blockId}
          modId={block.modId}
          blockId={block.blockId}
          blockName={block.blockName}
          texture64={block.texture64}
          isSelected={block.blockId === props.selectedBlock}
          renderButton={true}
        />
      ))}
    </div>
  );
}

function BlockCard(props: {
  blockName: string;
  blockId: string;
  modId: string;
  texture64: string | null;
  isSelected: boolean;
  renderButton: boolean;
}) {
  const { setSelectedBlock } = useMainStore((s) => ({ setSelectedBlock: s.setSelectedBlockId }));

  return (
    <div className="flex justify-between p-2 h-16 rounded-lg border border-neutral-300 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="flex overflow-hidden">
        <div className="relative w-16 h-full">
          {props.texture64 ? (
            <img
              className="rounded-lg aspect-square h-full rendering-crisp-edges object-cover"
              alt={`${props.blockId} Icon`}
              src={`data:image/png;base64,${props.texture64}`}
            />
          ) : (
            <div className="h-full aspect-square flex flex-grow justify-center items-center">
              <FileQuestion />
            </div>
          )}
        </div>
        <div>
          <h1 className="font-bold">{props.blockName ?? props.blockId.split(":")[1]}</h1>
          <h2 className="font-semibold text-neutral-500">{`${props.modId}:${props.blockId}`}</h2>
        </div>
      </div>
      {props.renderButton && (
        <div className="flex items-center justify-end">
          <Button
            variant={props.isSelected ? "secondary" : "outline"}
            onClick={() => setSelectedBlock(props.isSelected ? undefined : props.blockId)}
          >
            {props.isSelected ? "Deselect" : "Select"}
          </Button>
        </div>
      )}
    </div>
  );
}
