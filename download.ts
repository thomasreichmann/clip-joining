import { ApiClient, HelixClip } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import fs from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";

const streamPipeline = promisify(pipeline);

const clientId = "vj1bfayrqg0ag3gjhex95wbokkbkt2";
const clientSecret = "xcz68xfdre64hbqp31b2mmv8p3fpyd";

const authProvider = new AppTokenAuthProvider(clientId, clientSecret);
const api = new ApiClient({ authProvider });

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

  // create a directory to store the clips if it doesn't exist
  if (!fs.existsSync("./clips")) {
    fs.mkdirSync("./clips");
  }

  // control number of concurrent downloads
  const maxConcurrentDownloads = 5;
  const clipChunks = Array(Math.ceil(page.length / maxConcurrentDownloads))
    .fill(0)
    .map((_, index) => index * maxConcurrentDownloads)
    .map((begin) => page.slice(begin, begin + maxConcurrentDownloads));

  for (let i = 0; i < clipChunks.length; i++) {
    await Promise.all(
      clipChunks[i].map((clip, j) =>
        downloadClip(clip, i * maxConcurrentDownloads + j, page.length)
      )
    );
  }
}

downloadClips().catch(console.error);

export {};
