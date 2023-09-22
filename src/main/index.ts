import { app, shell, BrowserWindow, nativeImage, ipcMain } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import appIcon from "../../resources/icon.png?asset";
import AdmZip from "adm-zip";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import z, { ZodError } from "zod";
import { CACHE_DIRECTORY, APP_DIRECTORY } from "./constants";
import { blocks, closeConnection, db, initDatabaseCache } from "./drizzle";
import { isNotNull, like } from "drizzle-orm";
import Fuse from "fuse.js";
import { getDetailedBlockData } from "./handlers/get-detailed-block-data";
import { getBlockData } from "./handlers/get-block-data";

const BLOCK_STATE_ASSETS_REGEX = /assets\/(?<modId>.*?)\/blockstates\/(?<blockId>.*?).json/;
const LANG_FILE_REGEX = /assets\/(.*)\/lang\/en_us.json/;

const fuse = new Fuse<typeof blocks.$inferSelect>([], { keys: ["blockName", "blockId"] });

async function refreshFuse() {
  fuse.remove(() => true);
  (await db.select().from(blocks).where(isNotNull(blocks.texture64))).forEach((b) => fuse.add(b));
}

const blockStateGroupSchema = z.object({
  modId: z.string(),
  blockId: z.string(),
});

// https://minecraft.fandom.com/wiki/Tutorials/Models#Block_models
export const blockModelSchema = z.object({
  loader: z.literal("forge:obj").or(z.string()).optional(),
  render_type: z
    .union([
      z.literal("minecraft:cutout"),
      z.literal("minecraft:solid"),
      z.literal("minecraft:cutout_mipped"),
      z.literal("minecraft:cutout_mipped_all"),
      z.literal("minecraft:translucent"),
      z.literal("minecraft:tripwire"),
      z.string(),
    ])
    .default("minecraft:solid"),
  parent: z.string().optional(),
  ambientocclusion: z.boolean().default(true),
  display: z
    .record(
      z.string(),
      z.object({
        rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
        translation: z
          .tuple([z.number().min(-80).max(80), z.number().min(-80).max(80), z.number().min(-80).max(80)])
          .optional(),
        scale: z.tuple([z.number().max(4), z.number().max(4), z.number().max(4)]).optional(),
      }),
    )
    .optional(),
  textures: z.record(z.string(), z.string()).optional(),
  elements: z
    .array(
      z.object({
        shade: z.boolean().default(true),
        from: z.tuple([
          z.number().min(-16).max(32),
          z.number().min(-16).max(32),
          z.number().min(-16).max(32),
        ]),
        to: z.tuple([z.number().min(-16).max(32), z.number().min(-16).max(32), z.number().min(-16).max(32)]),
      }),
    )
    .optional(),
});

// https://minecraft.fandom.com/wiki/Tutorials/Models#Block_states
const variantValueSchema = z.object({
  model: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  uvlock: z.boolean().default(false),
  weight: z.number().default(1),
});

export const blockStateSchema = z.object({
  variants: z.record(z.string(), z.array(variantValueSchema).or(variantValueSchema)).optional(),
  multipart: z.array(z.object({})).optional(),
});

async function writeBlockCache() {
  const mods = readdirSync(`${CACHE_DIRECTORY}/mods`);

  const blockCache: Record<string, typeof blocks.$inferInsert> = {};

  for (const jarPath of mods) {
    let modLang: Record<string, string> = {};

    const jarSlug = jarPath.replace(".jar", "");
    const buffer = new AdmZip(`${CACHE_DIRECTORY}/mods/${jarPath}`);

    buffer.forEach((entry) => {
      if (entry.entryName.match(LANG_FILE_REGEX)) {
        modLang = JSON.parse(buffer.getEntry(entry.entryName)?.getData().toString() ?? "{}");
      }
    });

    buffer.forEach(async (entry) => {
      try {
        const entryName = entry.entryName;

        const blockStateMatch = entryName.match(BLOCK_STATE_ASSETS_REGEX);

        if (blockStateMatch) {
          const groups = blockStateGroupSchema.parse(blockStateMatch?.groups);
          const blockStateParsed = blockStateSchema.parse(
            JSON.parse(buffer.getEntry(entryName)?.getData().toString() ?? "{}"),
          );

          if (!blockStateParsed.variants) return;

          const modId = groups.modId;
          const blockId = groups.blockId;

          let variant = blockStateParsed.variants[""];
          const variantKeys: typeof blocks.$inferInsert.variants = [];

          if (variant === undefined) {
            const variantNames: Record<string, Set<string>> = {};

            Object.keys(blockStateParsed.variants).forEach((key) => {
              key.split(",").forEach((splitKey) => {
                const variantName = splitKey.split("=")[0];
                const variantValue = splitKey.split("=")[1];

                if (!variantNames[variantName]) {
                  variantNames[variantName] = new Set();
                }

                variantNames[variantName].add(variantValue);
              });
            });

            Object.entries(variantNames).forEach(([key, value]) => {
              const isBoolean = [...value].every((v) => v === "true" || v === "false");

              if (isBoolean) {
                variantKeys.push({ key, type: "boolean" });
                return;
              }

              const isNumber = [...value].every((v) => {
                try {
                  return !isNaN(Number(v));
                } catch {
                  return false;
                }
              });

              if (isNumber) {
                variantKeys.push({ key, type: "number", values: [...value].map((v) => Number(v)) });
                return;
              }

              variantKeys.push({ key, type: "string", values: [...value] });
            });

            variant = Object.values(blockStateParsed.variants)[0];
          }

          let modelBasePath: string;

          if (Array.isArray(variant)) {
            modelBasePath = variant[0].model;
          } else {
            modelBasePath = variant.model;
          }

          const modelEntryName = `assets/${modId}/models/${modelBasePath.replace(`${modId}:`, "")}.json`;

          const modelParsed = blockModelSchema.parse(
            JSON.parse(buffer.getEntry(modelEntryName)?.getData().toString() ?? "{}"),
          );

          let texture64: string | undefined;

          if (modelParsed.loader) {
            const loader = modelParsed.loader;

            const textureEntryMatches = buffer.getEntries().filter(({ entryName }) => {
              return entryName.startsWith(
                `assets/${modId}/textures/block/${loader.replace(`${modId}:`, "")}`,
              );
            });

            console.log(textureEntryMatches.length);
            console.log(`assets/${modId}/textures/block/${loader.replace(`${modId}:`, "")}`);
            console.log(entry.entryName);
          } else if (modelParsed.textures) {
            const textures = modelParsed.textures;
            let textureBasePath: string | undefined;

            if (textures["all"]) textureBasePath = textures["all"];
            else if (textures["texture"]) textureBasePath = textures["texture"];
            else if (textures["front"]) textureBasePath = textures["front"];
            else if (textures["side"]) textureBasePath = textures["side"];
            else textureBasePath = Object.values(textures)[0];

            const textureEntry = `assets/${modId}/textures/${textureBasePath.replace(`${modId}:`, "")}.png`;

            const texture = buffer.getEntry(textureEntry)?.getData().toString("base64");

            if (texture) {
              texture64 = texture;
            }
          }

          blockCache[blockId] = {
            jarSlug,
            blockId,
            modId,
            entryName: entryName,
            blockName: modLang[`block.${groups.modId}.${groups.blockId}`],
            texture64: texture64,
            variants: variantKeys,
          };
        }
      } catch (e) {
        console.log(entry.entryName);
        console.log((e as ZodError).toString());
      }
    });
  }

  const cache = Object.values(blockCache);
  const slices = Math.ceil(cache.length / 5000);

  await db
    .transaction(async (tx) => {
      await tx.delete(blocks);

      for (let i = 0; i < slices; i++) {
        const slice = cache.slice(i * 5000, i * 5000 + 5000);
        await tx.insert(blocks).values(slice);
      }

      // await tx.insert(blocks).values(Object.values(blockCache));
    })
    .catch((e) => {
      console.log(e);
      console.log("error");
    });

  await refreshFuse();

  return;
}

function makeDirIfNotExists(path: string) {
  if (!existsSync(path)) mkdirSync(path);
}

async function initCacheDir(rm: boolean) {
  if (existsSync(CACHE_DIRECTORY) && rm) {
    try {
      closeConnection();
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          rmSync(CACHE_DIRECTORY, { recursive: true, force: true });
          mkdirSync(CACHE_DIRECTORY);
          resolve();
        }, 500);
      });
    } catch (e) {
      console.log(e);
    }
  } else if (!existsSync(CACHE_DIRECTORY)) {
    mkdirSync(CACHE_DIRECTORY);
  }

  makeDirIfNotExists(`${CACHE_DIRECTORY}/mods`);
  initDatabaseCache();
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon: appIcon } : { icon: nativeImage.createFromPath(appIcon) }),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
    backgroundColor: "#0a0a0a",
  });

  mainWindow.webContents.userAgent = "BetrixDev/Minecraft-Block-Renderer (rdbailey.dev@gmail.com)";

  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  makeDirIfNotExists(APP_DIRECTORY);
  initCacheDir(false);

  initDatabaseCache();

  await refreshFuse();

  await writeBlockCache();

  // Set app user model id for windows
  electronApp.setAppUserModelId("MinecraftBlockRenderer");

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  ipcMain.handle("save-buffered-jar-file", (_, data: ArrayBuffer, jarName: string) => {
    const zip = new AdmZip(Buffer.from(data));

    writeFileSync(`${CACHE_DIRECTORY}/mods/${jarName}.jar`, zip.toBuffer());
    writeBlockCache();

    return;
  });

  ipcMain.handle("fetch-downloaded-jar-names", () => {
    try {
      const mods = readdirSync(`${CACHE_DIRECTORY}/mods`);

      return mods.map((path) => path.replace(".jar", ""));
    } catch {
      return [];
    }
  });

  ipcMain.handle("clear-cache", async () => {
    await initCacheDir(true);
  });

  ipcMain.handle("delete-jar", (_, slug: string) => {
    rmSync(`${CACHE_DIRECTORY}/mods/${slug}.jar`);

    return;
  });

  ipcMain.handle("search-block-asset", async (_, query: string) => {
    if (!query || query === "") {
      return await db.select().from(blocks).limit(50).where(isNotNull(blocks.texture64));
    } else if (query.startsWith("@")) {
      return await db
        .select()
        .from(blocks)
        .limit(50)
        .where(like(blocks.blockId, `${query.substring(1).toLowerCase()}%`));
    } else {
      return fuse
        .search(query)
        .slice(0, 49)
        .map((i) => i.item);
    }
  });

  ipcMain.handle("get-block-data", async (_, blockId: string) => {
    return await getBlockData(blockId);
  });

  ipcMain.handle("get-detailed-block-data", async (_, jarSlug: string, blockId: string) => {
    return await getDetailedBlockData(jarSlug, blockId);
  });

  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
