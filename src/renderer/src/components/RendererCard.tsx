import { useEffect, useState } from "react";
import { match } from "ts-pattern";
import { useQuery } from "@tanstack/react-query";
import { useMainStore } from "@renderer/stores/main-store";
import { Camera } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Renderer } from "./Renderer";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { AspectRatio } from "./ui/aspect-ratio";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toTitleCase } from "@renderer/utils";

export function RendererCard() {
  const selectedBlockId = useMainStore((s) => s.selectedBlockId);
  const [blockState, setBlockState] = useState<Record<string, string>>({});

  function updateBlockState(key: string, value: string) {
    setBlockState({ ...blockState, [key]: value });
  }

  const { data: blockData } = useQuery({
    queryKey: ["selectedBlock", selectedBlockId],
    queryFn: async () => {
      if (!selectedBlockId) return null;

      return await window.api.getBlockData(selectedBlockId);
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
    keepPreviousData: true,
  });

  // const blockStateString = useMemo(() => {
  const blockStateString = (() => {
    if (!selectedBlockId) return;

    let state = Object.entries(blockState).map(([key, value]) => `${key}=${value}`);

    if (state.length === 0 && blockData?.variants) {
      state = blockData.variants.map((variant) => {
        if (variant.type === "boolean") {
          return `${variant.key}=false`;
        } else {
          return `${variant.key}=${variant.values[0]}`;
        }
      });
    }

    return state.join(",");
  })();
  // }, [blockData, blockState, selectedBlockId]);

  return (
    <Card className="min-h-full basis-[32rem] flex-grow">
      <CardHeader>
        <CardTitle>Renderer</CardTitle>
        <CardDescription>Select a block from the other panels to render here!</CardDescription>
        <CardContent className="p-4 flex flex-col gap-2">
          <AspectRatio
            ratio={16 / 9}
            className="bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-100 dark:border-neutral-900"
          >
            {blockData && <Renderer blockData={blockData} />}
          </AspectRatio>
          <div>
            <Button variant="outline" className="w-full flex gap-4">
              <Camera /> Take a screenshot
            </Button>
            <div className="flex gap-2 pt-2">
              <div className="basis-1/2 flex flex-col gap-2">
                <Input type="number" placeholder="Width" />
                <Input type="number" placeholder="Height" />
                <Slider className="py-2" max={120} min={20} defaultValue={[60]} />
              </div>
              <div className="relative flex flex-col basis-1/2 gap-2 p-2 rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
                <div className="absolute top-[-0.5rem] text-xs flex justify-center w-full">
                  <p className="bg-neutral-950 px-1">Edit Block State</p>
                </div>
                <div className="flex justify-center items-center mt-1 h-8 rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
                  {blockStateString
                    ? blockStateString
                    : !blockData
                    ? "Select a block to edit the block state"
                    : "This block doesn't have multiple states"}
                </div>
                <div className="flex gap-2 flex-col">
                  {blockData &&
                    blockData.variants.map((variant) => (
                      <BlockStateCard
                        key={variant.key}
                        variant={variant}
                        updateBlockState={updateBlockState}
                      />
                    ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </CardHeader>
    </Card>
  );
}

type BlockStateCardProps = {
  variant: Awaited<ReturnType<typeof window.api.getBlockData>>["variants"][number];
  updateBlockState: (key: string, value: string) => void;
};

function stringToBoolean(str: string) {
  if (str.toLowerCase() === "true") return true;
  return false;
}

function BlockStateCard({ variant, updateBlockState }: BlockStateCardProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    updateBlockState(variant.key, value);
  }, [value]);

  const valueInput = match(variant)
    .with({ type: "boolean" }, () => {
      return (
        <div className="flex justify-center items-center w-12">
          <Switch
            defaultChecked={stringToBoolean(value)}
            onChange={() => setValue(value === "true" ? "false" : "true")}
          />
        </div>
      );
    })
    .with({ type: "string" }, { type: "number" }, (variant) => {
      return (
        <Select onValueChange={setValue} defaultValue={variant.values[0].toString()}>
          <SelectTrigger>
            <SelectValue placeholder="Select a blockstate" />
          </SelectTrigger>

          <SelectContent>
            {variant.values.map((variantValue: string | number) => (
              <SelectItem key={variantValue} value={variantValue.toString()}>
                {toTitleCase(variantValue.toString())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    })
    .exhaustive();

  return (
    <div className="h-12 flex justify-between p-2 rounded-lg border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50">
      <p className="font-bold flex items-center justify-start basis-1/2">{toTitleCase(variant.key)}</p>
      <div className="basis-1/2 flex items-center justify-end">{valueInput}</div>
    </div>
  );
}
