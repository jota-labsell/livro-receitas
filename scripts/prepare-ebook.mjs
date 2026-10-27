import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const input = "private/150-doces.pdf";
const selections = process.argv.slice(2).map(Number);
if (
  selections.length < 6 ||
  selections.length > 8 ||
  selections.some((n) => !Number.isInteger(n) || n < 2) ||
  new Set(selections).size !== selections.length
)
  throw Error(
    "Informe 6 a 8 páginas internas reais distintas. Ex.: npm run prepare:ebook -- 12 25 46 68 95 120. Escolha visualmente categorias diferentes na edição final.",
  );
const pdf = await readFile(input);
if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")))
  throw Error("PDF inválido");
const info = execFileSync("pdfinfo", [input], { encoding: "utf8" });
const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
if (!pages || selections.some((n) => n > pages))
  throw Error("Seleção fora dos limites do PDF");
await rm("public/ebook", { recursive: true, force: true });
await mkdir("public/ebook", { recursive: true });
const images = [];
for (const [i, page] of [1, ...selections].entries()) {
  const base = `public/ebook/page-${i}`;
  execFileSync("pdftoppm", [
    "-f",
    String(page),
    "-l",
    String(page),
    "-scale-to",
    "1100",
    "-singlefile",
    "-png",
    input,
    base,
  ]);
  await sharp(base + ".png")
    .webp({ quality: 82 })
    .toFile(base + ".webp");
  await sharp(base + ".png")
    .resize(540, 764, { fit: "contain", background: "#fff9f6" })
    .png()
    .toFile(base + "-frame.png");
  images.push(`/ebook/page-${i}.webp`);
}
// Smooth transitions use only the selected pages of the exact delivered PDF.
const duration = 24;
const interval = duration / images.length;
const sequence = [...images.map((_, i) => i), 0];
const inputs = sequence.flatMap((i) => [
  "-loop",
  "1",
  "-t",
  String(interval + 0.3),
  "-i",
  `public/ebook/page-${i}-frame.png`,
]);
const filters = sequence.map(
  (_, i) => `[${i}:v]fps=24,settb=AVTB,format=yuv420p[v${i}]`,
);
let previous = "v0";
for (let i = 1; i < sequence.length; i++) {
  const output = `fade${i}`;
  filters.push(
    `[${previous}][v${i}]xfade=transition=slideleft:duration=0.25:offset=${i * interval - 0.25}[${output}]`,
  );
  previous = output;
}
execFileSync(
  "ffmpeg",
  [
    "-y",
    ...inputs,
    "-filter_complex_threads",
    "1",
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${previous}]`,
    "-t",
    String(duration),
    "-c:v",
    "libvpx-vp9",
    "-threads",
    "2",
    "-b:v",
    "0",
    "-crf",
    "34",
    "-an",
    "public/ebook/preview.webm",
  ],
  { stdio: "inherit" },
);
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    "public/ebook/preview.webm",
    "-vf",
    "fps=8,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
    "-loop",
    "0",
    "public/ebook/preview.gif",
  ],
  { stdio: "inherit" },
);
await writeFile(
  "public/ebook/manifest.json",
  JSON.stringify(
    {
      sha256: createHash("sha256").update(pdf).digest("hex"),
      pages,
      sourcePages: [1, ...selections],
      bytes: pdf.byteLength,
      images,
      video: "/ebook/preview.webm",
      gif: "/ebook/preview.gif",
    },
    null,
    2,
  ),
);
for (let i = 0; i < images.length; i++) {
  await rm(`public/ebook/page-${i}.png`);
  await rm(`public/ebook/page-${i}-frame.png`);
}
console.log(
  `Prévia gerada do PDF entregue: ${pages} páginas. Confira visualmente as páginas antes de publicar.`,
);
