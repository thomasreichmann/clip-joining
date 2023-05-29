console.time("total");

import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const folderPath = path.resolve("./clips");
const files = await fs.promises.readdir(folderPath);

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

// Create a readable stream for each file path and add it to a list
const readableStreams = filePaths.map((file) => fs.createReadStream(file));

// const totalDuration = await getDurationFromStream(readableStreams);
const durationPromises = readableStreams.map((stream) => {
  return getDurationFromStream(stream);
});

const totalDuration = (await Promise.all(durationPromises)).reduce(
  (acc, curr) => acc + curr,
  0
);
console.log(totalDuration);

function getDurationFromStream(stream: fs.ReadStream) {
  let rand = Math.random() * 1000;
  let floored = Math.floor(rand);
  console.time(floored.toString());
  return new Promise<number>((resolve, reject) => {
    ffmpeg()
      .input(stream)
      .ffprobe((err, data) => {
        if (err) {
          reject(err);
          return;
        }
        console.timeEnd(floored.toString());
        resolve(data.format.duration ?? 0);
      });
  });
}

console.timeEnd("total");

export {};
