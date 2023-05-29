import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import fs from "fs/promises";

const clientId = "vj1bfayrqg0ag3gjhex95wbokkbkt2";
const clientSecret = "xcz68xfdre64hbqp31b2mmv8p3fpyd";

const authProvider = new AppTokenAuthProvider(clientId, clientSecret);

const api = new ApiClient({ authProvider });

let page = await api.clips
  .getClipsForGamePaginated("21779", {
    startDate: new Date().toISOString(),
  })
  .getNext();

for (let i = 0; i < 10; i++) {
  console.log(page[i].url);

  let downloadUrl = page[i].thumbnailUrl.replace(
    "-preview-480x272.jpg",
    ".mp4"
  );
  let fetchclip = await fetch(downloadUrl);

  let buffer = await fetchclip.arrayBuffer();
  await fs.writeFile(`./clips/${page[i].id}.mp4`, Buffer.from(buffer));
  console.log(`Downloaded ${page[i].id}.mp4`, `(${i + 1}/${page.length})`);
}

export {};
