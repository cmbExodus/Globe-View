<script>
  import { onMount } from 'svelte'
  import * as THREE from 'three'
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
  import { generateEarthDots } from './lib/earthDots.js'
  import { latLonToVector3 } from './lib/geo.js'
  import { CITIES } from './lib/cities.js'

  export let showCities = true

  let canvas
  let cityGroup
  let hoveredCity = null

  function makeGlowSprite(color, size = 64) {
    const cnv = document.createElement('canvas')
    cnv.width = cnv.height = size
    const ctx = cnv.getContext('2d')
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.25, color)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    return new THREE.CanvasTexture(cnv)
  }

  function makeStarfield() {
    const starCount = 3500
    const positions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r = 60 + Math.random() * 140
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, sizeAttenuation: true })
    return new THREE.Points(geo, mat)
  }

  onMount(() => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 0, 6.5)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 2.5
    controls.maxDistance = 14
    controls.enablePan = false
    controls.autoRotate = false
    controls.rotateSpeed = 0.6
    controls.zoomSpeed = 0.6

    const ambient = new THREE.AmbientLight(0x445566, 1.5)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.7)
    sun.position.set(5, 3, 5)
    scene.add(sun)

    scene.add(makeStarfield())

    const radius = 2

    // Ocean base — a plain shaded sphere sitting just under the land dots.
    const oceanGeo = new THREE.SphereGeometry(radius * 0.994, 96, 96)
    const oceanMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(0x0a2a52),
      specular: new THREE.Color(0x1c4f7a),
      shininess: 22
    })
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat)
    scene.add(oceanMesh)

    // Continents rendered as a 1:1 lat/lon grid of dots (sourced from a real
    // land/ocean mask) instead of a texture, using the same latLonToVector3()
    // the city points use — always in sync.
    let landGeo = null
    let landMat = null
    let dotTexture = null
    let cancelled = false
    generateEarthDots(radius).then((result) => {
      if (cancelled) return
      landGeo = result.geometry
      landMat = result.material
      dotTexture = result.dotTexture
      scene.add(result.points)
    })

    const atmoGeo = new THREE.SphereGeometry(radius * 1.06, 96, 96)
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    })
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat)
    scene.add(atmoMesh)

    cityGroup = new THREE.Group()
    const glowTex = makeGlowSprite('rgba(255,40,40,1)', 64)
    for (const [name, lat, lon, size] of CITIES) {
      const pos = latLonToVector3(lat, lon, radius * 1.002)
      const spriteMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff3b3b,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: false
      })
      const sprite = new THREE.Sprite(spriteMat)
      // With sizeAttenuation off, sprites hold a constant screen size, so
      // zooming in spreads out nearby cities instead of just magnifying
      // an already-overlapping cluster.
      const s = (0.012 + size * 0.005)
      sprite.scale.set(s, s, 1)
      sprite.position.copy(pos)
      sprite.userData.cityName = name
      cityGroup.add(sprite)
    }
    cityGroup.visible = showCities
    scene.add(cityGroup)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    function onPointerMove(event) {
      if (!cityGroup.visible) {
        if (hoveredCity) hoveredCity = null
        return
      }
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(cityGroup.children, false)
      if (hits.length > 0) {
        hoveredCity = { name: hits[0].object.userData.cityName, x: event.clientX, y: event.clientY }
      } else if (hoveredCity) {
        hoveredCity = null
      }
    }
    renderer.domElement.addEventListener('pointermove', onPointerMove)

    let animId
    function animate() {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      controls.dispose()
      renderer.dispose()
      oceanGeo.dispose()
      oceanMat.dispose()
      if (landGeo) landGeo.dispose()
      if (landMat) landMat.dispose()
      if (dotTexture) dotTexture.dispose()
      atmoGeo.dispose()
      atmoMat.dispose()
      glowTex.dispose()
    }
  })

  $: if (cityGroup) cityGroup.visible = showCities
</script>

<canvas bind:this={canvas} class="globe-canvas"></canvas>

{#if hoveredCity}
  <div class="tooltip" style="left:{hoveredCity.x + 14}px; top:{hoveredCity.y + 10}px;">
    {hoveredCity.name}
  </div>
{/if}

<style>
  .globe-canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: grab;
  }
  .globe-canvas:active {
    cursor: grabbing;
  }
  .tooltip {
    position: fixed;
    pointer-events: none;
    background: rgba(10, 16, 30, 0.85);
    color: #ffb3b3;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    border: 1px solid rgba(255, 60, 60, 0.35);
    z-index: 10;
    white-space: nowrap;
  }
</style>
