const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const archiver = require("archiver");
const unzipper = require("unzipper");

const app = express();
const upload = multer({ dest: "uploads/" });

// Get the Downloads folder path
const downloadsPath = path.join(os.homedir(), "Downloads");
const jarFilePath = path.join(__dirname, "HuffCode_jar/HuffCode.jar");
const javaPath = "C:\\Program Files\\Java\\jdk-16.0.2\\bin\\java.exe"; // Update with your actual path

app.use(express.static("public"));

function createZipFile(sourceFilePath, outputFilePath, callback) {
  const output = fs.createWriteStream(outputFilePath);
  const archive = archiver("zip", {
    zlib: { level: 9 },
  });

  output.on("close", () => {
    console.log(`${archive.pointer()} total bytes`);
    console.log(
      "ZIP file has been finalized and the output file descriptor has closed."
    );
    callback();
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.file(sourceFilePath, { name: path.basename(sourceFilePath) });
  archive.finalize();
}

app.post("/compress", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const compressedFilePath = path.join(
    "uploads",
    `compressed_${req.file.originalname}`
  );
  const zipFilePath = path.join(
    downloadsPath,
    `compressed_${req.file.originalname}.zip`
  );

  exec(
    `"${javaPath}" -jar "${jarFilePath}" compress "${filePath}" "${compressedFilePath}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return res.status(500).send("Server error");
      }

      createZipFile(compressedFilePath, zipFilePath, () => {
        const originalSize = fs.statSync(filePath).size;
        const compressedSize = fs.statSync(zipFilePath).size;

        res.json({
          originalSize,
          compressedSize,
          compressionRatio: (compressedSize / originalSize) * 100,
          downloadPath: zipFilePath,
        });

        fs.unlinkSync(filePath);
        fs.unlinkSync(compressedFilePath);
      });
    }
  );
});

app.post("/decompress", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const decompressedFilePath = path.join(
    "uploads",
    `decompressed_${req.file.originalname}`
  );
  const zipFilePath = path.join(
    downloadsPath,
    `decompressed_${req.file.originalname}.zip`
  );

  exec(
    `"${javaPath}" -jar "${jarFilePath}" decompress "${filePath}" "${decompressedFilePath}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return res.status(500).send("Server error");
      }

      createZipFile(decompressedFilePath, zipFilePath, () => {
        const compressedSize = fs.statSync(filePath).size;
        const decompressedSize = fs.statSync(zipFilePath).size;

        res.json({
          compressedSize,
          decompressedSize,
          downloadPath: zipFilePath,
        });

        fs.unlinkSync(filePath);
        fs.unlinkSync(decompressedFilePath);
      });
    }
  );
});

app.post("/unzip", upload.single("file"), (req, res) => {
  const zipFilePath = req.file.path;
  const extractPath = path.join("uploads", "extracted");

  fs.createReadStream(zipFilePath)
    .pipe(unzipper.Extract({ path: extractPath }))
    .on("close", () => {
      fs.readdir(extractPath, (err, files) => {
        if (err) {
          console.error(`readdir error: ${err}`);
          return res.status(500).send("Server error");
        }

        const extractedFiles = files.map((file) =>
          path.join(extractPath, file)
        );
        const outputZipPath = path.join(
          downloadsPath,
          `extracted_${path.basename(zipFilePath, ".zip")}.zip`
        );

        createZipFile(extractedFiles, outputZipPath, () => {
          res.json({
            extractedFiles,
            downloadPath: outputZipPath,
          });

          fs.unlinkSync(zipFilePath);
          extractedFiles.forEach((file) => fs.unlinkSync(file));
        });
      });
    })
    .on("error", (err) => {
      console.error(`unzip error: ${err}`);
      res.status(500).send("Server error");
    });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
