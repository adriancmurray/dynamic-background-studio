<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    particleCount?: number
    particleSize?: number
    linkDistance?: number
    speed?: number
    color?: string
    lineOpacity?: number
    interactive?: boolean
  }

  let {
    particleCount = 80,
    particleSize = 2.0,
    linkDistance = 120,
    speed = 1.0,
    color = '#a855f7',
    lineOpacity = 0.25,
    interactive = true,
  }: Props = $props()

  type Particle = {
    x: number
    y: number
    vx: number
    vy: number
  }

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let particles: Particle[] = []
  let animationFrame = 0
  let width = 0
  let height = 0
  let pixelRatio = 1
  let mouseX = 0
  let mouseY = 0
  let isMousePresent = false
  let reducedMotion = false

  function initParticles() {
    if (!width || !height) return
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
      })
    }
  }

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    width = rect.width
    height = rect.height
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(height * pixelRatio))
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    initParticles()
    draw()
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

  // Convert hex color to rgb for alpha styling
  function getRgb(hexColor: string): string {
    // Basic hex parsing
    let hex = hexColor.replace('#', '')
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('')
    }
    const num = parseInt(hex, 16)
    if (isNaN(num)) return '168, 85, 247' // Fallback to purple
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`
  }

  function draw() {
    if (!context || !width || !height) return

    context.clearRect(0, 0, width, height)

    const rgbColor = getRgb(color)
    context.fillStyle = `rgb(${rgbColor})`

    // Update and draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      // Simple physics
      if (!reducedMotion) {
        p.x += p.vx * speed
        p.y += p.vy * speed

        // Interactivity: pull particles towards mouse
        if (interactive && isMousePresent) {
          const dx = mouseX - p.x
          const dy = mouseY - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < 250) {
            // Smooth attraction force
            const force = (1 - dist / 250) * 0.18
            p.vx += (dx / dist) * force
            p.vy += (dy / dist) * force
          }
        }

        // Friction / speed cap
        const maxVelocity = 2.5
        const curSpeed = Math.hypot(p.vx, p.vy)
        if (curSpeed > maxVelocity) {
          p.vx = (p.vx / curSpeed) * maxVelocity
          p.vy = (p.vy / curSpeed) * maxVelocity
        }

        // Bouncing walls
        if (p.x < 0) {
          p.x = 0
          p.vx *= -1
        } else if (p.x > width) {
          p.x = width
          p.vx *= -1
        }

        if (p.y < 0) {
          p.y = 0
          p.vy *= -1
        } else if (p.y > height) {
          p.y = height
          p.vy *= -1
        }
      }

      // Draw particle
      context.beginPath()
      context.arc(p.x, p.y, particleSize, 0, Math.PI * 2)
      context.fill()
    }

    // Draw lines between close particles
    for (let i = 0; i < particles.length; i++) {
      const pi = particles[i]

      // Connect to mouse
      if (interactive && isMousePresent) {
        const dx = mouseX - pi.x
        const dy = mouseY - pi.y
        const dist = Math.hypot(dx, dy)
        if (dist < linkDistance) {
          const alpha = (1 - dist / linkDistance) * lineOpacity * 1.5
          context.strokeStyle = `rgba(${rgbColor}, ${Math.min(0.9, alpha)})`
          context.lineWidth = 1.0
          context.beginPath()
          context.moveTo(pi.x, pi.y)
          context.lineTo(mouseX, mouseY)
          context.stroke()
        }
      }

      for (let j = i + 1; j < particles.length; j++) {
        const pj = particles[j]
        const dx = pi.x - pj.x
        const dy = pi.y - pj.y
        const dist = Math.hypot(dx, dy)

        if (dist < linkDistance) {
          const alpha = (1 - dist / linkDistance) * lineOpacity
          context.strokeStyle = `rgba(${rgbColor}, ${alpha})`
          context.lineWidth = 0.75
          context.beginPath()
          context.moveTo(pi.x, pi.y)
          context.lineTo(pj.x, pj.y)
          context.stroke()
        }
      }
    }
  }

  function frame() {
    draw()
    animationFrame = requestAnimationFrame(frame)
  }

  // Handle particleCount prop updates reactively
  $effect(() => {
    if (particleCount && width && height) {
      // Safely resize particle array
      if (particles.length < particleCount) {
        while (particles.length < particleCount) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
          })
        }
      } else if (particles.length > particleCount) {
        particles = particles.slice(0, particleCount)
      }
    }
  })

  onMount(() => {
    context = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    canvas.addEventListener('pointerleave', handlePointerLeave, { passive: true })

    resize()
    frame()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      canvas?.removeEventListener('pointerleave', handlePointerLeave)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  })
</script>

<canvas bind:this={canvas} class="constellation-canvas" aria-hidden="true"></canvas>

<style>
  .constellation-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }
</style>
