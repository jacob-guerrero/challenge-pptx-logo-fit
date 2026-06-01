'use strict'

const fs = require('fs')
const path = require('path')
const { createSolidPng } = require('./pngUtils')

const LOGOS_DIR = path.join(__dirname, '..', 'assets', 'logos')

const REFERENCE_LOGOS = [
  { file: 'square.png', width: 400, height: 400, color: [0x6f, 0x42, 0xc1] },
  { file: 'h_rectangle.png', width: 600, height: 200, color: [0x05, 0x96, 0x69] },
  { file: 'v_rectangle.png', width: 200, height: 600, color: [0xdc, 0x26, 0x26] }
]

function main() {
  fs.mkdirSync(LOGOS_DIR, { recursive: true })

  for (const spec of REFERENCE_LOGOS) {
    const buffer = createSolidPng({
      width: spec.width,
      height: spec.height,
      r: spec.color[0],
      g: spec.color[1],
      b: spec.color[2]
    })
    const outPath = path.join(LOGOS_DIR, spec.file)
    fs.writeFileSync(outPath, buffer)
    console.log(`Wrote ${outPath} (${spec.width}x${spec.height})`)
  }

  console.log('\nReference logos are solid-color placeholders. Replace them with real artwork if you prefer.')
}

main()
