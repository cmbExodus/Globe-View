import * as THREE from 'three'
import { latLonToVector3 } from './geo.js'
import landMaskUrl from '../assets/textures/land-mask.jpg'

// ---- Seeded gradient noise, used only for subtle color variation across
// land dots (grass/desert/mountain/ice) — NOT for deciding where land is.
// Where dots actually appear is driven by the real land/ocean mask below. ----
function buildPermutation(seed) {
  let s = seed
  const rand = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  return perm
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
]

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a, b, t) { return a + t * (b - a) }

function makeNoise3(seed) {
  const perm = buildPermutation(seed)
  function grad(hash, x, y, z) {
    const g = GRAD3[hash % 12]
    return g[0] * x + g[1] * y + g[2] * z
  }
  return function noise3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255
    const xf = x - Math.floor(x), yf = y - Math.floor(y), zf = z - Math.floor(z)
    const u = fade(xf), v = fade(yf), w = fade(zf)
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z
    return lerp(
      lerp(
        lerp(grad(perm[AA], xf, yf, zf), grad(perm[BA], xf - 1, yf, zf), u),
        lerp(grad(perm[AB], xf, yf - 1, zf), grad(perm[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      lerp(
        lerp(grad(perm[AA + 1], xf, yf, zf - 1), grad(perm[BA + 1], xf - 1, yf, zf - 1), u),
        lerp(grad(perm[AB + 1], xf, yf - 1, zf - 1), grad(perm[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    )
  }
}

function fbm(noise, x, y, z, octaves, persistence, lacunarity) {
  let total = 0, amp = 1, freq = 1, maxAmp = 0
  for (let i = 0; i < octaves; i++) {
    total += noise(x * freq, y * freq, z * freq) * amp
    maxAmp += amp
    amp *= persistence
    freq *= lacunarity
  }
  return total / maxAmp
}

function lerpColor(c1, c2, t) {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t
  ]
}

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function makeDotSprite() {
  const size = 32
  const cnv = document.createElement('canvas')
  cnv.width = cnv.height = size
  const ctx = cnv.getContext('2d')
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.7, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(cnv)
}

const BEACH = [214, 202, 152]
const GRASS = [86, 150, 70]
const FOREST = [48, 108, 54]
const DESERT = [206, 178, 104]
const HILLS = [120, 114, 66]
const MOUNTAIN = [124, 112, 100]
const PEAK = [235, 235, 240]
const ICE = [228, 238, 242]

function sphereXYZ(latRad, lonRad) {
  const cosLat = Math.cos(latRad)
  return [
    cosLat * Math.cos(lonRad),
    Math.sin(latRad),
    cosLat * Math.sin(lonRad)
  ]
}

function landColorFor(h, biome, absLatRad) {
  const arid = smoothstep(-0.1, 0.35, biome)
  let landColor
  if (h < 0.06) landColor = BEACH
  else if (h < 0.35) landColor = lerpColor(lerpColor(GRASS, FOREST, smoothstep(0.06, 0.35, h)), DESERT, arid)
  else if (h < 0.62) landColor = lerpColor(HILLS, DESERT, arid * 0.6)
  else if (h < 0.82) landColor = MOUNTAIN
  else landColor = lerpColor(PEAK, MOUNTAIN, smoothstep(1, 0.82, h))

  const poleFactor = smoothstep(1.05, 1.45, absLatRad)
  return lerpColor(landColor, ICE, poleFactor)
}

// Loads a real-world equirectangular land/ocean mask image and returns its
// pixel data so it can be sampled per lat/lon.
export function loadLandMask(url = landMaskUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cnv = document.createElement('canvas')
      cnv.width = img.naturalWidth
      cnv.height = img.naturalHeight
      const ctx = cnv.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, cnv.width, cnv.height)
      resolve({ width: cnv.width, height: cnv.height, data: imageData.data })
    }
    img.onerror = () => reject(new Error(`Failed to load land mask: ${url}`))
    img.src = url
  })
}

function sampleMaskBrightness(mask, latDeg, lonDeg) {
  const u = (lonDeg + 180) / 360
  const v = (90 - latDeg) / 180
  const px = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)))
  const py = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)))
  const idx = (py * mask.width + px) * 4
  return (mask.data[idx] + mask.data[idx + 1] + mask.data[idx + 2]) / 3
}

// Builds a THREE.Points cloud with one dot per real land grid cell — a
// literal pixel map of Earth's actual continents (from a real land/ocean
// mask), placed with the exact same latLonToVector3() used for the city
// points, so land and cities always line up.
export async function generateEarthDots(radius, { latStep = 1.1, threshold = 100, invert = false } = {}) {
  const mask = await loadLandMask()

  const continentNoise = makeNoise3(1337)
  const detailNoise = makeNoise3(777)
  const biomeNoise = makeNoise3(4242)

  const positions = []
  const colors = []

  for (let latDeg = -90 + latStep / 2; latDeg < 90; latDeg += latStep) {
    const latRad = (latDeg * Math.PI) / 180
    const cosLat = Math.max(0.02, Math.cos(latRad))
    // Widen the longitude step near the poles (by 1/cos(lat)) so dots stay
    // evenly spaced across the sphere instead of bunching up at the top/bottom.
    const lonStep = Math.min(10, latStep / cosLat)

    for (let lonDeg = -180 + lonStep / 2; lonDeg < 180; lonDeg += lonStep) {
      const brightness = sampleMaskBrightness(mask, latDeg, lonDeg)
      const isLand = invert ? brightness > threshold : brightness < threshold
      if (!isLand) continue

      const lonRad = (lonDeg * Math.PI) / 180
      const [x, y, z] = sphereXYZ(latRad, lonRad)
      const nx = x * 2.1, ny = y * 2.1, nz = z * 2.1

      // Noise only used for cosmetic color variation now.
      let hNoise = fbm(continentNoise, nx, ny, nz, 5, 0.5, 2.0)
      const detail = fbm(detailNoise, nx * 4, ny * 4, nz * 4, 3, 0.5, 2.0)
      hNoise = hNoise * 0.85 + detail * 0.15
      const h = smoothstep(-0.3, 0.6, hNoise)

      const biome = fbm(biomeNoise, nx * 1.7 + 5.2, ny * 1.7 + 5.2, nz * 1.7 + 5.2, 3, 0.5, 2.0)
      const [r, g, b] = landColorFor(h, biome, Math.abs(latRad))

      const pos = latLonToVector3(latDeg, lonDeg, radius)
      positions.push(pos.x, pos.y, pos.z)
      colors.push(r / 255, g / 255, b / 255)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const dotTexture = makeDotSprite()
  const material = new THREE.PointsMaterial({
    size: 0.045,
    map: dotTexture,
    vertexColors: true,
    transparent: true,
    alphaTest: 0.05,
    sizeAttenuation: true,
    depthWrite: true
  })

  const points = new THREE.Points(geo, material)
  return { points, geometry: geo, material, dotTexture, dotCount: positions.length / 3 }
}
