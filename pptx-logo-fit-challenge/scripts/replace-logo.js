"use strict";

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const sizeOf = require("image-size");

const ROOT = path.join(__dirname, "..");
const TEMPLATE_PATH = path.join(
  ROOT,
  "assets",
  "template",
  "test_pptx_file.pptx",
);
const OUTPUT_DIR = path.join(ROOT, "output");
const SLIDE1 = "ppt/slides/slide1.xml";
const SLIDE1_RELS = "ppt/slides/_rels/slide1.xml.rels";
const UNIFIED_LOGO_MARKER = "d.unifiedLogo";

const VARIANTS = [
  { key: "square", logoFile: "square.png" },
  { key: "h_rectangle", logoFile: "h_rectangle.png" },
  { key: "v_rectangle", logoFile: "v_rectangle.png" },
];

function parseArgs(argv) {
  const args = { logo: null, useReferenceLogos: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--logo" && argv[i + 1]) {
      args.logo = path.resolve(argv[++i]);
    }
    if (argv[i] === "--use-reference-logos") {
      args.useReferenceLogos = true;
    }
  }
  return args;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readRelationshipTarget(relsXml, relationshipId) {
  const idFirst = new RegExp(
    `<Relationship[^>]*\\bId=["']${escapeRegex(relationshipId)}["'][^>]*\\bTarget=["']([^"']+)["']`,
    "i",
  ).exec(relsXml);
  if (idFirst?.[1]) return idFirst[1];

  const targetFirst = new RegExp(
    `<Relationship[^>]*\\bTarget=["']([^"']+)["'][^>]*\\bId=["']${escapeRegex(relationshipId)}["']`,
    "i",
  ).exec(relsXml);
  return targetFirst?.[1] || null;
}

function resolveMediaPath(relTarget) {
  return path.posix.normalize(path.posix.join("ppt/slides", relTarget));
}

function findLogoPicXml(slideXml) {
  const blocks = slideXml.match(/<p:pic[\s>][\s\S]*?<\/p:pic>/g) || [];
  return blocks.find((block) => block.includes(UNIFIED_LOGO_MARKER)) || null;
}

async function replaceLogoSmart({ templateBuffer, logoBuffer, outputPath }) {
  const zip = await JSZip.loadAsync(templateBuffer);
  const slideEntry = zip.file(SLIDE1);
  const relsEntry = zip.file(SLIDE1_RELS);

  if (!slideEntry || !relsEntry) {
    throw new Error("Template is missing slide1 or its relationships");
  }

  let slideXml = await slideEntry.async("string");
  const relsXml = await relsEntry.async("string");

  const picXml = findLogoPicXml(slideXml);
  if (!picXml) {
    throw new Error(
      `No <p:pic> with marker "${UNIFIED_LOGO_MARKER}" found in slide1`,
    );
  }

  const embedMatch = picXml.match(/r:embed=["']([^"']+)["']/);
  if (!embedMatch) {
    throw new Error("Logo picture has no r:embed relationship");
  }

  const relTarget = readRelationshipTarget(relsXml, embedMatch[1]);
  if (!relTarget) {
    throw new Error(`Relationship ${embedMatch[1]} not found in slide1.rels`);
  }

  // Usar image-size para extraer dimensiones con total fiabilidad
  const imgDims = sizeOf(logoBuffer);
  if (!imgDims || !imgDims.width || !imgDims.height) {
    throw new Error(
      "No se pudieron leer las dimensiones de la imagen con image-size",
    );
  }

  // --- Lógica super-robusta de reemplazo de XML ---
  // Extraemos atributos cx, cy, x, y tolerando cualquier orden de atributos
  let origCx = 0,
    origCy = 0,
    origX = 0,
    origY = 0;

  const extMatch = picXml.match(/<a:ext\s+([^>]*?cx=["']-?\d+["'][^>]*?)>/);
  if (extMatch) {
    const cxM = extMatch[1].match(/cx=["'](-?\d+)["']/);
    const cyM = extMatch[1].match(/cy=["'](-?\d+)["']/);
    if (cxM) origCx = parseInt(cxM[1], 10);
    if (cyM) origCy = parseInt(cyM[1], 10);
  }

  const offMatch = picXml.match(/<a:off\s+([^>]*?x=["']-?\d+["'][^>]*?)>/);
  if (offMatch) {
    const xM = offMatch[1].match(/x=["'](-?\d+)["']/);
    const yM = offMatch[1].match(/y=["'](-?\d+)["']/);
    if (xM) origX = parseInt(xM[1], 10);
    if (yM) origY = parseInt(yM[1], 10);
  }

  if (origCx > 0 && origCy > 0) {
    // Calculamos escala (contain)
    const scale = Math.min(origCx / imgDims.width, origCy / imgDims.height);
    const newCx = Math.round(imgDims.width * scale);
    const newCy = Math.round(imgDims.height * scale);

    // Centrar imagen
    const newX = origX + Math.round((origCx - newCx) / 2);
    const newY = origY + Math.round((origCy - newCy) / 2);

    let newPicXml = picXml;

    // Reemplazamos cx y cy manteniendo la estructura exacta del tag <a:ext>
    newPicXml = newPicXml.replace(
      /(<a:ext\s+)([^>]*?cx=["']-?\d+["'][^>]*?)(>)/,
      (match, start, attrs, end) => {
        let newAttrs = attrs.replace(/cx=["']-?\d+["']/, `cx="${newCx}"`);
        newAttrs = newAttrs.replace(/cy=["']-?\d+["']/, `cy="${newCy}"`);
        return `${start}${newAttrs}${end}`;
      },
    );

    // Reemplazamos x e y manteniendo la estructura exacta del tag <a:off>
    newPicXml = newPicXml.replace(
      /(<a:off\s+)([^>]*?x=["']-?\d+["'][^>]*?)(>)/,
      (match, start, attrs, end) => {
        let newAttrs = attrs.replace(/x=["']-?\d+["']/, `x="${newX}"`);
        newAttrs = newAttrs.replace(/y=["']-?\d+["']/, `y="${newY}"`);
        return `${start}${newAttrs}${end}`;
      },
    );

    // Usamos una función anónima para evitar bugs de caracteres $ en String.prototype.replace
    slideXml = slideXml.replace(picXml, () => newPicXml);
    zip.file(SLIDE1, slideXml);
  }

  const mediaPath = resolveMediaPath(relTarget);
  zip.file(mediaPath, logoBuffer);

  const outBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, outBuffer);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Missing template. Run: npm run setup`);
    console.error(`Expected: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const templateBuffer = fs.readFileSync(TEMPLATE_PATH);

  for (const variant of VARIANTS) {
    const logoPath =
      args.useReferenceLogos || !args.logo
        ? path.join(ROOT, "assets", "logos", variant.logoFile)
        : args.logo;

    if (!fs.existsSync(logoPath)) {
      console.error(`Logo not found: ${logoPath}`);
      process.exit(1);
    }

    const logoBuffer = fs.readFileSync(logoPath);
    const outputPath = path.join(OUTPUT_DIR, `branded_${variant.key}.pptx`);

    await replaceLogoSmart({ templateBuffer, logoBuffer, outputPath });
    console.log(`Wrote ${outputPath} (logo: ${path.basename(logoPath)})`);
  }

  console.log(
    "\nOpen the three files in PowerPoint. If logos look stretched or squashed, fix the script and/or template.",
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
