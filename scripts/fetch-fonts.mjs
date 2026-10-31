import { writeFile, mkdir } from "node:fs/promises";
const families = [
  ["Barlow Condensed", "500;600;700", "barlowcondensed"],
  ["IBM Plex Sans", "400;500;600", "ibmplexsans"],
  ["IBM Plex Mono", "400;500", "ibmplexmono"],
];
const rules = [];
const downloaded = new Map();
await mkdir("public/fonts", { recursive: true });
for (const [family, weights, folder] of families) {
  const response = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}:wght@${weights}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
    },
  );
  if (!response.ok)
    throw Error(`Font metadata unavailable: ${family} (${response.status})`);
  const css = await response.text();
  const blocks = [
    ...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g),
  ].map((m) => m[1]);
  if (!blocks.length) throw Error(`No Latin WOFF2 face returned for ${family}`);
  for (const block of blocks) {
    const url = block.match(/url\(([^)]+)\)/)?.[1];
    const weight = block.match(/font-weight:\s*([^;]+);/)?.[1];
    if (!url || !weight) throw Error(`Invalid font metadata: ${family}`);
    let name = downloaded.get(url);
    if (!name) {
      name = `${folder}-${weight.replaceAll(" ", "-")}.woff2`;
      const file = await fetch(url);
      if (!file.ok) throw Error(`Font download failed: ${family}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 4)) !== "wOF2")
        throw Error(`Expected WOFF2 data: ${family}`);
      await writeFile(`public/fonts/${name}`, bytes);
      downloaded.set(url, name);
    }
    rules.push(block.replace(url, `/fonts/${name}`));
  }
  const license = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`,
  );
  if (!license.ok) throw Error(`Font license unavailable: ${family}`);
  await writeFile(`public/fonts/${folder}-OFL.txt`, await license.text());
  console.log(`${family}: ${blocks.length} faces saved`);
}
await writeFile("src/fonts.css", rules.join("\n\n") + "\n");
