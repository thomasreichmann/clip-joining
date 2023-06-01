import { ApiClient, HelixClip } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import "dotenv/config";
import fs from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

const clientId = process.env.TWITCH_CLIENT_ID ?? "";
const clientSecret = process.env.TWITCH_CLIENT_SECRET ?? "";

const authProvider = new AppTokenAuthProvider(clientId, clientSecret);
const api = new ApiClient({ authProvider });

const maxVideosToDownload = 20;

async function downloadClip(clip: HelixClip, i: number, totalClips: number) {
  const downloadUrl = clip.thumbnailUrl.replace("-preview-480x272.jpg", ".mp4");
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok)
      throw new Error(`unexpected response ${response.statusText}`);

    if (!response.body) throw new Error("no response body");

    await streamPipeline(
      response.body,
      fs.createWriteStream(`./clips/${clip.id}.mp4`)
    );
    console.log(`Downloaded ${clip.id}.mp4`, `(${i + 1}/${totalClips})`);
  } catch (err) {
    console.error(`Error downloading clip ${clip.id}: ${err}`);
  }
}

async function downloadClips() {
  let page = await api.clips
    .getClipsForGamePaginated("21779", { startDate: new Date().toISOString() })
    .getNext();

  // Create a directory to store the clips if it doesn't exist
  if (!fs.existsSync("./clips")) {
    fs.mkdirSync("./clips");
  }

  // Control number of concurrent downloads
  const maxConcurrentDownloads = 5;

  const clipChunks = Array(
    Math.ceil(maxVideosToDownload / maxConcurrentDownloads)
  )
    .fill(0)
    .map((_, index) => index * maxConcurrentDownloads)
    .map((begin) => page.slice(begin, begin + maxConcurrentDownloads));

  let downloadedCount = 0;

  for (let i = 0; i < clipChunks.length; i++) {
    if (downloadedCount >= maxVideosToDownload) {
      break;
    }
    await Promise.all(
      clipChunks[i].map((clip, j) => {
        if (downloadedCount >= maxVideosToDownload) {
          return;
        }
        downloadedCount++;
        return downloadClip(
          clip,
          i * maxConcurrentDownloads + j,
          maxVideosToDownload
        );
      })
    );
  }
}

console.time("total");

downloadClips()
  .then(() => console.timeEnd("total"))
  .catch(console.error);

export {};
