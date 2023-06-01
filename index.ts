console.time("Execution time");
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const folderPath = path.resolve("./clips");
const tempFolderPath = path.resolve("./temp");
const filePaths: string[] = [];

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error("Error reading directory:", err);
    return;
  }

  // Filter video files
  const videoFiles = files.filter((file) => {
    const extension = path.extname(file).toLowerCase();
    return extension === ".mp4" || extension === ".mov" || extension === ".avi"; // Add more video file extensions if needed
  });

  // Construct file paths
  videoFiles.forEach((file) => {
    const filePath = path.join(folderPath, file);
    filePaths.push(filePath);
  });

  // Concatenate video files
  concatenateVideos(filePaths);
});

async function concatenateVideos(filePaths: string[]) {
  const outputFilePath = "output.mp4";

  const ffmpegCommand = ffmpeg();
  filePaths.forEach((filePath) => {
    ffmpegCommand.input(filePath);
  });

  const totalDuration = await getTotalDuration(filePaths);

  ffmpegCommand
    .on("error", (err) => {
      console.error("Error concatenating videos:", err);
    })
    .on("stderr", (stderrLine) => {
      console.log("Stderr output: " + stderrLine);
    })
    .on("end", () => {
      console.log("Videos concatenated successfully!");

      console.timeEnd("Execution time");
    })
    .on("progress", (progress) => {
      const currentSeconds = getSeconds(progress.timemark);
      const progressPercentage = getProgress(currentSeconds, totalDuration);
      console.log("Progress:", progressPercentage.toFixed(2), "%");
    })
    .videoCodec("libx264")
    .audioCodec("libmp3lame")
    .format("mp4")
    // .outputOptions("-b:v 1000k") // Lower bitrate
    .outputOptions("-preset ultrafast") // Faster encoding
    .mergeToFile(outputFilePath, tempFolderPath);
}

function getTotalDuration(filePaths: string[]): Promise<number> {
  const durationPromises = filePaths.map((filePath) => {
    return getDuration(filePath);
  });

  return Promise.all(durationPromises).then((durations) => {
    return durations.reduce((acc, curr) => acc + curr, 0);
  });
}

function getDuration(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data.format.duration ?? 0);
    });
  });
}

function getProgress(currentSeconds: number, totalSeconds: number): number {
  return (currentSeconds / totalSeconds) * 100;
}

function getSeconds(time: string): number {
  const timeParts = time.split(":");
  const hours = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1]);
  const seconds = parseInt(timeParts[2]);

  return hours * 3600 + minutes * 60 + seconds;
}

export {};
