console.time("Execution time");
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const folderPath = path.resolve("./clips");
// TODO: make sure temp folder exists
const tempFolderPath = path.resolve("./temp");
const filePaths: string[] = [];

let totalToResize = 0;
let resizedCount = 0;

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

  // Check which videos need to be resized and increase totalToResize
  const resizeChecks = await Promise.all(filePaths.map(checkVideoParameters));
  totalToResize = resizeChecks.filter((needResize) => needResize).length;

  console.log(
    `${totalToResize} out of ${filePaths.length} videos need resizing.`
  );

  // Resize videos using Promise.all
  const batchSize = 5;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const batchResizeChecks = resizeChecks.slice(i, i + batchSize);
    const resizePromises = batch.map((filePath, index) => {
      if (batchResizeChecks[index]) {
        return resizeVideo(filePath);
      }
    });
    await Promise.all(resizePromises);
  }

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

async function checkVideoParameters(filePath: string): Promise<boolean> {
  const { width, height, sar, avg_fps } = await getVideoProperties(filePath);
  // console.log(["1:1", "N/A"].includes(sar ?? ""), sar);
  return (
    width !== 1920 ||
    height !== 1080 ||
    !["16:9", "1:1", "N/A"].includes(sar ?? "") ||
    (avg_fps < 60 && avg_fps > 0)
  );
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

async function resizeVideo(filePath: string): Promise<void> {
  // Check if the video resolution is different from 1920x1080
  if (await checkVideoParameters(filePath)) {
    const tempFilePath = path.join(tempFolderPath, path.basename(filePath));

    let fps = await getFPS(filePath);

    const outputOptions =
      fps < 60 ? "-vf scale=1920:1080,fps=fps=60" : "-vf scale=1920:1080";

    // Resize video and set fps to 60
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions(outputOptions)
        .videoCodec("libx264")
        .outputOptions("-preset ultrafast") // This option should make resizing faster
        .on("error", (err) => {
          reject(err);
        })
        .on("end", () => {
          // Increase resized count and log progress
          resizedCount++;
          console.log(
            `Resized ${resizedCount} out of ${totalToResize} videos (${(
              (resizedCount / totalToResize) *
              100
            ).toFixed(2)}%).`
          );
          resolve();
        })
        .save(tempFilePath);
    });

    // Delete old video
    await fs.promises.unlink(filePath);

    // Move new video to the old location
    await fs.promises.rename(tempFilePath, filePath);
  }
}

function getFPS(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = data.streams.find(
        (stream) => stream.codec_type === "video"
      );

      if (videoStream) {
        const fps = eval(videoStream.avg_frame_rate ?? "");
        resolve(fps);
      } else {
        reject(new Error("No video stream found."));
      }
    });
  });
}

function getVideoProperties(
  filePath: string
): Promise<{ width?: number; height?: number; sar?: string; avg_fps: number }> {
  return new Promise<{
    width?: number;
    height?: number;
    sar?: string;
    avg_fps: number;
  }>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = data.streams.find(
        (stream) => stream.codec_type === "video"
      );

      if (videoStream) {
        const sar = videoStream.display_aspect_ratio;
        resolve({
          width: videoStream.width,
          height: videoStream.height,
          sar,
          avg_fps: eval(videoStream.avg_frame_rate ?? ""),
        });
      } else {
        reject(new Error("No video stream found."));
      }
    });
  });
}

export {};
