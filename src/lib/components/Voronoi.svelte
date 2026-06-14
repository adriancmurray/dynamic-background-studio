<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    cellCount?: number
    lineWidth?: number
    speed?: number
    lineColor?: string
    bgGradient1?: string
    bgGradient2?: string
    interactive?: boolean
  }

  let {
    cellCount = 35,
    lineWidth = 1.5,
    speed = 0.8,
    lineColor = '#3b82f6',
    bgGradient1 = '#0f172a',
    bgGradient2 = '#1e1b4b',
    interactive = true,
  }: Props = $props()

  type Point = {
    x: number
    y: number
    vx: number
    vy: number
    targetX?: number
    targetY?: number
  }

  type Vertex = { x: number; y: number }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0
  let points: Point[] = []
  let width = 0
  let height = 0
  let pixelRatio = 1
  let mouseX = 0
  let mouseY = 0
  let isMousePresent = false
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
    initPoints()
  }

  function initPoints() {
    if (!width || !height) return
    points = []
    for (let i = 0; i < cellCount; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * speed * 0.8,
        vy: (Math.random() - 0.5) * speed * 0.8,
      })
    }
  }

  function handlePointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    mouseX = event.clientX - rect.left
    mouseY = event.clientY - rect.top
    isMousePresent = true
  }

  function handlePointerLeave() {
    isMousePresent = false
  }

  // Clip a polygon by the perpendicular bisector of segment p1-p2
  // keeping the half-plane containing p1
  function clipPolygon(poly: Vertex[], p1: Point, p2: Point): Vertex[] {
    const clipped: Vertex[] = []
    if (poly.length === 0) return clipped

    // Midpoint
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    // Normal vector pointing from p1 to p2
    const nx = p2.x - p1.x
    const ny = p2.y - p1.y

    // Helper: returns true if point is on p1's side of the bisector
    const isInside = (pt: Vertex) => {
      return (pt.x - mx) * nx + (pt.y - my) * ny < 0
    }

    // Helper: find intersection of edge (s -> e) with bisector line
    const getIntersection = (s: Vertex, e: Vertex): Vertex => {
      // Line equation: (x - mx)*nx + (y - my)*ny = 0
      // Line: s + t*(e - s)
      const dx = e.x - s.x
      const dy = e.y - s.y
      
      const denominator = dx * nx + dy * ny
      if (Math.abs(denominator) < 0.0001) return s

      const t = -((s.x - mx) * nx + (s.y - my) * ny) / denominator
      return {
        x: s.x + t * dx,
        y: s.y + t * dy,
      }
    }

    let s = poly[poly.length - 1]
    for (let i = 0; i < poly.length; i++) {
      const e = poly[i]
      if (isInside(e)) {
        if (!isInside(s)) {
          clipped.push(getIntersection(s, e))
        }
        clipped.push(e)
      } else if (isInside(s)) {
        clipped.push(getIntersection(s, e))
      }
      s = e
    }

    return clipped
  }

  function draw() {
    if (!context || !width || !height) return

    // Draw background gradient
    const bgGrad = context.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, bgGradient1)
    bgGrad.addColorStop(1, bgGradient2)
    context.fillStyle = bgGrad
    context.fillRect(0, 0, width, height)

    // Update positions
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      
      if (!reducedMotion) {
        p.x += p.vx
        p.y += p.vy

        // Bounce boundaries
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        else if (p.x > width) { p.x = width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        else if (p.y > height) { p.y = height; p.vy *= -1; }
      }

      // Pointer interaction (hover pushes points slightly)
      if (interactive && isMousePresent) {
        const dx = p.x - mouseX
        const dy = p.y - mouseY
        const dist = Math.hypot(dx, dy)
        if (dist < 180) {
          const force = (180 - dist) / 180
          p.x += (dx / dist) * force * 1.5
          p.y += (dy / dist) * force * 1.5
        }
      }
    }

    // Draw Voronoi cells
    context.lineWidth = lineWidth
    context.strokeStyle = lineColor

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]
      
      // Initialize cell polygon as canvas bounds
      let cellPoly: Vertex[] = [
        { x: -10, y: -10 },
        { x: width + 10, y: -10 },
        { x: width + 10, y: height + 10 },
        { x: -10, y: height + 10 },
      ]

      // Clip by all other points
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue
        cellPoly = clipPolygon(cellPoly, p1, points[j])
        if (cellPoly.length === 0) break
      }

      // Draw the clipped cell polygon
      if (cellPoly.length > 2) {
        context.beginPath()
        context.moveTo(cellPoly[0].x, cellPoly[0].y)
        for (let k = 1; k < cellPoly.length; k++) {
          context.lineTo(cellPoly[k].x, cellPoly[k].y)
        }
        context.closePath()

        // Give a slight transparency highlight to the center cells
        if (interactive && isMousePresent) {
          const dist = Math.hypot(p1.x - mouseX, p1.y - mouseY)
          if (dist < 200) {
            context.fillStyle = `rgba(255, 255, 255, ${0.08 * (1 - dist / 200)})`
            context.fill()
          }
        }
        
        context.stroke()
      }
    }

    animationFrame = requestAnimationFrame(draw)
  }

  $effect(() => {
    initPoints()
  })

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
    animationFrame = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      mediaQuery.removeEventListener('change', handleMotionChange)
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas
  bind:this={canvas}
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}
  class="voronoi-canvas"
  aria-hidden="true"
></canvas>

<style>
  .voronoi-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: auto;
    z-index: 1;
  }
</style>
