import sharp from "sharp"
import fs from "fs"
import path from "path"

const srcDir = "/root/ismytripsafe-beta/WhatsAppChatRiver2"
const outDir = "/root/ismytripsafe-beta/public/photos/postcards"

const postcards = [
  "00000110-PHOTO-2026-08-04-23-38-18.jpg",
  "00000111-PHOTO-2026-08-04-23-38-18.jpg",
  "00000113-PHOTO-2026-08-04-23-38-18.jpg",
  "00000114-PHOTO-2026-08-04-23-38-18.jpg",
  "00000115-PHOTO-2026-08-04-23-38-18.jpg",
  "00000116-PHOTO-2026-08-04-23-38-18.jpg",
  "00000117-PHOTO-2026-08-04-23-38-19.jpg",
  "00000119-PHOTO-2026-08-04-23-38-19.jpg",
  "00000120-PHOTO-2026-08-04-23-38-19.jpg",
  "00000121-PHOTO-2026-08-04-23-38-19.jpg",
  "00000122-PHOTO-2026-08-04-23-38-19.jpg",
]

for (const file of postcards) {
  const srcPath = path.join(srcDir, file)
  const outPath = path.join(outDir, file)
  const origSize = fs.statSync(srcPath).size
  const buffer = fs.readFileSync(srcPath)

  const compressed = await sharp(buffer)
    .resize({ width: 960, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer()

  fs.writeFileSync(outPath, compressed)
  const newSize = compressed.length
  console.log(`${file}: ${(origSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (${Math.round((1 - newSize / origSize) * 100)}% reduction)`)
}
