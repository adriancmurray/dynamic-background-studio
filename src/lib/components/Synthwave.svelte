<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    gridSpeed?: number
    gridColor?: string
    sunColor?: string
    sunSize?: number
    sunY?: number
    perspective?: number
    fogDensity?: number
  }

  let {
    gridSpeed = 2.0,
    gridColor = '#ec4899',
    sunColor = '#f59e0b',
    sunSize = 120,
    sunY = 120,
    perspective = 300,
    fogDensity = 0.4,
  }: Props = $props()

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let scrollOffset = 0
  let reducedMotion = false

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(height * pixelRatio))
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  function getRgb(hexColor: string): string {
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('')
    }
    const num = parseInt(hex, 16)
    if (isNaN(num)) return '236, 72, 153'
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  function draw(time: number) {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const gridRgb = getRgb(gridColor)
    const sunRgb = getRgb(sunColor)

    const horizonY = height * 0.5

    // --- 1. Draw Synthwave Sun (Transparent-safe sliced design) ---
    const sunCenterX = width / 2
    const sunCenterY = horizonY - (sunY - 100)
    
    // Draw the sun slices using path clipping
    context.save()
    context.beginPath()
    context.arc(sunCenterX, sunCenterY, sunSize, 0, Math.PI * 2)
    context.clip()

    // Draw gradient fill
    const sunGrad = context.createLinearGradient(
      sunCenterX, sunCenterY - sunSize,
      sunCenterX, sunCenterY + sunSize
    )
    sunGrad.addColorStop(0, `rgba(${sunRgb}, 1.0)`)
    sunGrad.addColorStop(0.5, `rgba(236, 72, 153, 0.95)`) // hot pink blend
    sunGrad.addColorStop(1.0, `rgba(${sunRgb}, 0.2)`)
    context.fillStyle = sunGrad
    context.fillRect(sunCenterX - sunSize, sunCenterY - sunSize, sunSize * 2, sunSize * 2)

    // Slice cuts (retro grid bar gaps): we use destination-out composite mode to clear gaps in the sun shape
    context.globalCompositeOperation = 'destination-out'
    const barSpacing = 16
    const barHeightMin = 2
    const barHeightMax = 12
    
    for (let sy = sunCenterY - sunSize; sy < sunCenterY + sunSize; sy += barSpacing) {
      if (sy > sunCenterY - sunSize * 0.1) {
        // Height of the slice gaps increases closer to the bottom
        const progress = (sy - (sunCenterY - sunSize * 0.1)) / (sunSize * 1.1)
        const gapH = barHeightMin + progress * (barHeightMax - barHeightMin)
        context.fillRect(sunCenterX - sunSize - 10, sy, sunSize * 2 + 20, gapH)
      }
    }
    context.restore()
    context.globalCompositeOperation = 'source-over'

    // --- 2. Draw 3D Wireframe Grid ---
    if (!reducedMotion) {
      scrollOffset += (gridSpeed * 0.08)
      if (scrollOffset >= 1.0) {
        scrollOffset -= 1.0
      }
    }

    context.lineWidth = 1.5
    context.strokeStyle = `rgba(${gridRgb}, 0.65)`

    // Draw perspective projection grid
    const numVertLines = 36
    const vLineSpacing = (width * 2) / numVertLines
    const horizonBuffer = 2 // pixels above horizon to clip line rendering

    // Draw vertical (receding) grid lines
    for (let i = 0; i <= numVertLines; i++) {
      const startX = -width + i * vLineSpacing
      const endX = width / 2 + (startX - width / 2) * 0.05 // receding back
      
      context.beginPath()
      context.moveTo(startX, height)
      context.lineTo(endX, horizonY + horizonBuffer)
      
      // Depth gradient for individual line fading
      const lineGrad = context.createLinearGradient(endX, horizonY, startX, height)
      lineGrad.addColorStop(0, `rgba(${gridRgb}, 0.0)`)
      lineGrad.addColorStop(0.2, `rgba(${gridRgb}, 0.15)`)
      lineGrad.addColorStop(1.0, `rgba(${gridRgb}, 0.7)`)
      context.strokeStyle = lineGrad
      context.stroke()
    }

    // Draw horizontal grid lines (moving forward)
    const numHorizLines = 14
    for (let i = 0; i < numHorizLines; i++) {
      // Perspective interpolation curve
      const lineProgress = (i + scrollOffset) / numHorizLines
      const scaleZ = Math.pow(lineProgress, 3.2) // exponential spacing
      const lineY = horizonY + (height - horizonY) * scaleZ

      context.beginPath()
      context.moveTo(0, lineY)
      context.lineTo(width, lineY)

      const opacity = scaleZ * 0.8
      context.strokeStyle = `rgba(${gridRgb}, ${opacity})`
      context.stroke()
    }

    // --- 3. Draw Horizon Neon Glow (Fog overlay) ---
    const fogGrad = context.createLinearGradient(width / 2, horizonY, width / 2, height)
    fogGrad.addColorStop(0, `rgba(${gridRgb}, ${fogDensity})`)
    fogGrad.addColorStop(0.15, `rgba(${gridRgb}, ${fogDensity * 0.4})`)
    fogGrad.addColorStop(0.7, `rgba(${gridRgb}, 0.0)`)
    
    context.fillStyle = fogGrad
    context.fillRect(0, horizonY, width, height - horizonY)

    animationFrame = requestAnimationFrame(() => draw(performance.now()))
  }

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion = mediaQuery.matches
    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches
    }
    mediaQuery.addEventListener('change', handleMotionChange)

    resize()
    window.addEventListener('resize', resize)
    animationFrame = requestAnimationFrame(() => draw(performance.now()))

    return () => {
      window.removeEventListener('resize', resize)
      mediaQuery.removeEventListener('change', handleMotionChange)
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas
  bind:this={canvas}
  class="synthwave-canvas"
  aria-hidden="true"
></canvas>

<style>
  .synthwave-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
    z-index: 1;
    background: transparent;
  }
</style>
