'use strict'

const zlib = require('zlib')

function crc32(buffer) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/**
 * Solid-color PNG for reference logos (candidates can replace with their own artwork).
 */
function createSolidPng({ width, height, r, g, b }) {
  const row = Buffer.alloc(1 + width * 4)
  for (let x = 0; x < width; x++) {
    const offset = 1 + x * 4
    row[offset] = r
    row[offset + 1] = g
    row[offset + 2] = b
    row[offset + 3] = 255
  }
  const raw = Buffer.alloc((1 + width * 4) * height)
  for (let y = 0; y < height; y++) {
    row.copy(raw, y * row.length)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

module.exports = { createSolidPng }
