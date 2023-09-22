import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { API } from "./api";

// Custom APIs for renderer
const api: API = {
  saveBufferedJarFile: async (data: ArrayBuffer, jarName: string) =>
    await ipcRenderer.invoke("save-buffered-jar-file", data, jarName),
  fetchDownloadedJarNames: async () => await ipcRenderer.invoke("fetch-downloaded-jar-names"),
  clearCache: async () => await ipcRenderer.invoke("clear-cache"),
  deleteJar: async (slug) => await ipcRenderer.invoke("delete-jar", slug),
  searchBlockAsset: async (query) => await ipcRenderer.invoke("search-block-asset", query),
  getDetailedBlockData: async () => await ipcRenderer.invoke("get-detailed-block-data"),
  getBlockData: async (blockId) => await ipcRenderer.invoke("get-block-data", blockId),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
