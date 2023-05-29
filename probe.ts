import ffmpeg, { FfprobeData } from "fluent-ffmpeg";
import fs from "fs/promises";
import path from "path";

const folderPath = path.resolve("./clips");
const files = await fs.readdir(folderPath);

// Filter video files
const videoFiles = files.filter((file) => {
  const extension = path.extname(file).toLowerCase();
  return extension === ".mp4" || extension === ".mov" || extension === ".avi"; // Add more video file extensions if needed
});

const filePaths: string[] = [];

// Construct file paths
videoFiles.forEach((file) => {
  const filePath = path.join(folderPath, file);
  filePaths.push(filePath);
});

const probeData: FfprobeData[] = [];

for (const filePath of filePaths) {
  const ffprobeData = await ffprobe(filePath);

  probeData.push(ffprobeData);
}

function ffprobe(filePath: string) {
  return new Promise<FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
}

let totalDuration = 0;
for (const data of probeData) {
  totalDuration += data.format.duration ?? 0;
}
console.log(totalDuration);
// console.log("Probe Data:", probeData);
// fs.writeFile(
//   "probeData.json",
//   JSON.stringify(probeData[0].format.duration, null, 2)
// );
