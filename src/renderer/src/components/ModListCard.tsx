import { Progress } from "@radix-ui/react-progress";
import axios from "axios";
import { CheckCircle, Trash2, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { ModrinthIcon } from "./ModrinthIcon";
import { useToast } from "./ui/use-toast";
import { ToastAction } from "./ui/toast";
import { useQuery } from "@tanstack/react-query";

type ModListApiData = { hits: { slug: string; icon_url: string; author: string; title: string }[] };
type ModApiData = ModListApiData["hits"][number];

type ModListCardProps = {
  downloadedJars: string[];
  deleteJar: (slug: string) => Promise<void>;
  refetchDownloadedJars: () => void;
};

export function ModListCard({ downloadedJars, deleteJar, refetchDownloadedJars }: ModListCardProps) {
  const [modSearchQuery, setModSearchQuery] = useState<string>();

  const { data: modList, refetch: refetchModList } = useQuery({
    queryKey: ["modList"],
    queryFn: async () => {
      let endpoint = "https://api.modrinth.com/v2/search";

      if (modSearchQuery && modSearchQuery.length > 0) {
        endpoint += `?query=${modSearchQuery}`;
      } else {
        // Add custom facet filters so the default mods shown have a better chance at not being library or client side mods
        endpoint +=
          '?facets=[["server_side=required"],["categories!=library"],["categories!=optimization"],["categories!=utility"],["categories!=optifine"]]';
      }

      const response = await axios<ModListApiData>(endpoint);

      return response.data.hits;
    },
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchOnMount: false,
  });

  return (
    <Card className="basis-1/2">
      <CardHeader>
        <CardTitle>Download blocks from other mods</CardTitle>
        <CardDescription>
          <p>We support blocks from almost any mod!</p>
          <p
            onClick={() => window.open("https://modrinth.com")}
            className="hover:underline hover:cursor-pointer flex gap-1 items-center"
          >
            <ModrinthIcon /> Mod results are sourced from Modrinth
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex w-full max-w-full items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            refetchModList();
          }}
        >
          <Input
            type="text"
            placeholder="Search for a mod..."
            name="modQuery"
            onChange={(e) => setModSearchQuery(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
        <ModList
          deleteJar={deleteJar}
          modList={modList}
          downloaded={downloadedJars}
          refetchDownloaded={refetchDownloadedJars}
        />
      </CardContent>
    </Card>
  );
}

function ModList(props: {
  modList?: ModListApiData["hits"];
  downloaded: string[];
  refetchDownloaded: () => void;
  deleteJar: (slug: string) => Promise<void>;
}) {
  if (props.modList === undefined || props.modList.length === 0)
    return <div className="text-center font-bold">No Results Found</div>;

  return (
    <div className="overflow-auto h-64 pr-2 flex flex-col gap-2">
      {props.modList.map((mod) => (
        <ModCard
          key={mod.slug}
          mod={mod}
          downloaded={props.downloaded}
          refetchJars={props.refetchDownloaded}
          deleteJar={props.deleteJar}
        />
      ))}
    </div>
  );
}

type VersionApiData = {
  files: {
    url: string;
  }[];
}[];

function ModCard({
  mod,
  downloaded,
  refetchJars,
  deleteJar,
}: {
  mod: ModApiData;
  downloaded: string[];
  refetchJars: () => void;
  deleteJar: (slug: string) => Promise<void>;
}) {
  const [isDownloading, setIsDowloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");
  const isDownloaded = useMemo(() => downloaded.includes(mod.slug), [downloaded, mod]);
  const { toast } = useToast();

  async function downloadModJar() {
    setIsDowloading(true);

    try {
      setDownloadMessage("Fetching mod jar file");
      const versions = await axios<VersionApiData>(`https://api.modrinth.com/v2/project/${mod.slug}/version`);

      const jarURL = versions.data[0].files[0].url;

      setDownloadMessage("Downloading...");

      const jarResponse = await axios<ArrayBuffer>(jarURL, {
        responseType: "arraybuffer",
        onDownloadProgress: (e) => {
          const percentage = Math.round((e.loaded * 100) / (e.total ?? 100));
          setDownloadProgress(percentage);
          setDownloadMessage(`Downloading... ${percentage}%`);
        },
      });

      await window.api.saveBufferedJarFile(jarResponse.data, mod.slug);

      setDownloadMessage("Finished downloading!");

      setTimeout(() => {
        setIsDowloading(false);
        refetchJars();
      }, 250);
    } catch {
      setIsDowloading(false);
      toast({
        title: `Error downloading ${mod.title}`,
        description: `Something went wrong when trying to download ${mod.title}. Please try again`,
        action: (
          <ToastAction onClick={() => downloadModJar()} altText="Try again">
            Try again
          </ToastAction>
        ),
      });
    }
  }

  return (
    <div
      className="flex justify-between p-2 h-16 rounded-lg border border-neutral-300 bg-white text-neutral-950 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
      key={mod.slug}
    >
      <div className="flex overflow-hidden">
        <div className="relative w-16 h-full">
          <img className="rounded-lg aspect-square h-full" alt={`${mod.title} Icon`} src={mod.icon_url} />
        </div>
        <div>
          <a
            onClick={() => {
              window.open(`https://modrinth.com/mod/${mod.slug}`);
            }}
            className="font-bold hover:cursor-pointer hover:underline"
          >
            {mod.title}
          </a>
          <h2 className="font-semibold text-neutral-500">{mod.author}</h2>
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-grow mr-2 flex flex-col justify-center items-center">
          {isDownloading && (
            <>
              <Progress className="rounded-md h-2" value={downloadProgress} />
              <p className="text-xs text-neutral-500">{downloadMessage}</p>
            </>
          )}
          {isDownloaded && (
            <div className="flex gap-2 flex-grow justify-center items-center font-bold text-green-400">
              <CheckCircle /> Downloaded
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className="h-full w-12 p-0 hover:bg-neutral-700 rounded-lg flex justify-center items-center"
          onClick={() => {
            if (isDownloaded) {
              deleteJar(mod.slug);
            } else {
              downloadModJar();
            }
          }}
        >
          {isDownloaded ? <Trash2 /> : <Download />}
        </Button>
      </div>
    </div>
  );
}
