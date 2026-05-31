// Generates build/icon.ico (taskbar + exe) and build/icon.png (window) from the
// Flashbang burst mark. Run with: node scripts/make-icon.mjs
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ACCENT = '#2B3A55' // ink-blue tile
const BONE = '#F7F5F0' // burst

// Burst centred in a 256 rounded tile.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect x="0" y="0" width="256" height="256" rx="56" fill="${ACCENT}"/>
  <path d="M128 28 L150 106 L228 128 L150 150 L128 228 L106 150 L28 128 L106 106 Z" fill="${BONE}"/>
  <g stroke="${BONE}" stroke-width="9" stroke-linecap="round" opacity="0.5">
    <line x1="184" y1="72" x2="206" y2="50"/>
    <line x1="72" y1="72" x2="50" y2="50"/>
    <line x1="184" y1="184" x2="206" y2="206"/>
    <line x1="72" y1="184" x2="50" y2="206"/>
  </g>
</svg>`

function renderPng(size) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return r.render().asPng()
}

mkdirSync(resolve(root, 'build'), { recursive: true })

// Window icon
writeFileSync(resolve(root, 'build/icon.png'), renderPng(256))

// Multi-resolution .ico for taskbar + installer
const sizes = [256, 128, 64, 48, 32, 16]
const buffers = sizes.map(renderPng)
const ico = await pngToIco(buffers)
writeFileSync(resolve(root, 'build/icon.ico'), ico)

console.log('Wrote build/icon.png and build/icon.ico')
