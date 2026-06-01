'use strict'

/**
 * BASELINE (intentionally naive) — replaces the embedded image bytes but does NOT
 * resize the picture frame (<a:ext>) to preserve aspect ratio.
 *
 * Usage:
 *   node scripts/replace-logo.js --logo path/to/logo.png
 *   npm run replace -- --logo assets/logos/square.png
 *
 * Produces:
 *   output/branded_square.pptx
 *   output/branded_h_rectangle.pptx
 *   output/branded_v_rectangle.pptx
 *
 * Candidates must fix deformation so each output looks correct when opened in PowerPoint.
 */

const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')

const ROOT = path.join(__dirname, '..')
const TEMPLATE_PATH = path.join(ROOT, 'assets', 'template', 'test_pptx_file.pptx')
const OUTPUT_DIR = path.join(ROOT, 'output')
const SLIDE1 = 'ppt/slides/slide1.xml'
const SLIDE1_RELS = 'ppt/slides/_rels/slide1.xml.rels'
const UNIFIED_LOGO_MARKER = 'd.unifiedLogo'

const VARIANTS = [
  { key: 'square', logoFile: 'square.png' },
  { key: 'h_rectangle', logoFile: 'h_rectangle.png' },
  { key: 'v_rectangle', logoFile: 'v_rectangle.png' }
]

function parseArgs(argv) {
  const args = { logo: null, useReferenceLogos: false }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--logo' && argv[i + 1]) {
      args.logo = path.resolve(argv[++i])
    }
    if (argv[i] === '--use-reference-logos') {
      args.useReferenceLogos = true
    }
  }
  return args
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readRelationshipTarget(relsXml, relationshipId) {
  const idFirst = new RegExp(
    `<Relationship[^>]*\\bId=["']${escapeRegex(relationshipId)}["'][^>]*\\bTarget=["']([^"']+)["']`,
    'i'
  ).exec(relsXml)
  if (idFirst?.[1]) return idFirst[1]

  const targetFirst = new RegExp(
    `<Relationship[^>]*\\bTarget=["']([^"']+)["'][^>]*\\bId=["']${escapeRegex(relationshipId)}["']`,
    'i'
  ).exec(relsXml)
  return targetFirst?.[1] || null
}

function resolveMediaPath(relTarget) {
  return path.posix.normalize(path.posix.join('ppt/slides', relTarget))
}

function findLogoPicXml(slideXml) {
  const blocks = slideXml.match(/<p:pic[\s>][\s\S]*?<\/p:pic>/g) || []
  return blocks.find((block) => block.includes(UNIFIED_LOGO_MARKER)) || null
}

async function replaceLogoNaive({ templateBuffer, logoBuffer, outputPath }) {
  const zip = await JSZip.loadAsync(templateBuffer)
  const slideEntry = zip.file(SLIDE1)
  const relsEntry = zip.file(SLIDE1_RELS)
  if (!slideEntry || !relsEntry) {
    throw new Error('Template is missing slide1 or its relationships')
  }

  const slideXml = await slideEntry.async('string')
  const relsXml = await relsEntry.async('string')
  const picXml = findLogoPicXml(slideXml)
  if (!picXml) {
    throw new Error(`No <p:pic> with marker "${UNIFIED_LOGO_MARKER}" found in slide1`)
  }

  const embedMatch = picXml.match(/r:embed=["']([^"']+)["']/)
  if (!embedMatch) {
    throw new Error('Logo picture has no r:embed relationship')
  }

  const relTarget = readRelationshipTarget(relsXml, embedMatch[1])
  if (!relTarget) {
    throw new Error(`Relationship ${embedMatch[1]} not found in slide1.rels`)
  }

  const mediaPath = resolveMediaPath(relTarget)
  zip.file(mediaPath, logoBuffer)

  const outBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, outBuffer)
}

async function main() {
  const args = parseArgs(process.argv)

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`Missing template. Run: npm run setup`)
    console.error(`Expected: ${TEMPLATE_PATH}`)
    process.exit(1)
  }

  const templateBuffer = fs.readFileSync(TEMPLATE_PATH)

  for (const variant of VARIANTS) {
    const logoPath = args.useReferenceLogos || !args.logo
      ? path.join(ROOT, 'assets', 'logos', variant.logoFile)
      : args.logo

    if (!fs.existsSync(logoPath)) {
      console.error(`Logo not found: ${logoPath}`)
      process.exit(1)
    }

    const logoBuffer = fs.readFileSync(logoPath)
    const outputPath = path.join(OUTPUT_DIR, `branded_${variant.key}.pptx`)

    await replaceLogoNaive({ templateBuffer, logoBuffer, outputPath })
    console.log(`Wrote ${outputPath} (logo: ${path.basename(logoPath)})`)
  }

  console.log('\nOpen the three files in PowerPoint. If logos look stretched or squashed, fix the script and/or template.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
