<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    theme?: 'light' | 'dark';
    branchInkColor?: string;
    petalColor?: string;
    budColor?: string;
    accentColor?: string;
  }

  let { 
    theme = 'dark',
    branchInkColor,
    petalColor,
    budColor,
    accentColor
  }: Props = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let width = $state(0);
  let height = $state(0);

  // Theme derived aesthetics
  let resolvedBg = $derived(theme === 'dark' ? '#121016' : '#f6f3eb');
  let resolvedBranchColor = $derived(branchInkColor || (theme === 'dark' ? '#251b2e' : '#1a1a1a'));
  let resolvedPetalColor = $derived(petalColor || (theme === 'dark' ? '#ff6ebb' : '#ffb7c5'));
  let resolvedBudColor = $derived(budColor || (theme === 'dark' ? '#ff1493' : '#d11a5b'));
  let resolvedAccentColor = $derived(accentColor || (theme === 'dark' ? '#ffd700' : '#e5c158'));

  interface Point {
    x: number;
    y: number;
    thickness: number;
  }

  interface Blossom {
    x: number;
    y: number;
    angle: number;
    size: number;
    bloomProgress: number; // 0 = bud, 1 = fully open
    targetBloom: number;
  }

  interface Branch {
    points: Point[];
    targetLength: number;
    currentLength: number;
    blossoms: Blossom[];
    age: number;
    opacity: number;
  }

  interface InkSplat {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    opacity: number;
    color: string;
    decay: number;
  }

  let branches: Branch[] = [];
  let splats: InkSplat[] = [];
  let mouse = { x: 0, y: 0 };
  let requestRef: number;

  // Generates a branch originating at (x,y) growing towards an angle
  function createBranch(startX: number, startY: number, angle: number, depth = 0) {
    if (depth > 3) return;
    const points: Point[] = [];
    let currX = startX;
    let currY = startY;
    let currAngle = angle;
    const segmentCount = Math.floor(Math.random() * 12) + 15;
    let currentThickness = Math.max(12 - depth * 3, 2);
    const lengthStep = (Math.random() * 8 + 12) * (1 - depth * 0.15);

    for (let i = 0; i < segmentCount; i++) {
      points.push({
        x: currX,
        y: currY,
        thickness: currentThickness
      });

      // Natural branch bendiness / Sumi-e brush wiggle
      currAngle += (Math.random() - 0.5) * 0.45;
      currX += Math.cos(currAngle) * lengthStep;
      currY += Math.sin(currAngle) * lengthStep;
      currentThickness *= 0.92; // Tapering brush
    }

    // Create blossoms along the second half of the branch
    const blossoms: Blossom[] = [];
    for (let i = Math.floor(points.length * 0.2); i < points.length; i++) {
      if (Math.random() < 0.4) {
        const pt = points[i];
        // Offset blossom slightly from the main branch centerline
        const offsetAngle = currAngle + (Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2);
        const offsetDist = pt.thickness + Math.random() * 6;
        blossoms.push({
          x: pt.x + Math.cos(offsetAngle) * offsetDist,
          y: pt.y + Math.sin(offsetAngle) * offsetDist,
          angle: Math.random() * Math.PI * 2,
          size: Math.random() * 8 + 6,
          bloomProgress: 0,
          targetBloom: 0
        });
      }
    }

    branches.push({
      points,
      targetLength: points.length,
      currentLength: 0,
      blossoms,
      age: 0,
      opacity: 1.0
    });

    // Chance to spawn smaller side branches
    if (points.length > 5) {
      const branchPoint1 = points[Math.floor(points.length * 0.4)];
      if (Math.random() < 0.7) {
        createBranch(branchPoint1.x, branchPoint1.y, angle + (Math.random() * 0.8 + 0.3), depth + 1);
      }
      const branchPoint2 = points[Math.floor(points.length * 0.7)];
      if (Math.random() < 0.6) {
        createBranch(branchPoint2.x, branchPoint2.y, angle - (Math.random() * 0.8 + 0.3), depth + 1);
      }
    }
  }

  function spawnSplat(x: number, y: number) {
    const color = Math.random() > 0.4 ? resolvedPetalColor : resolvedBranchColor;
    splats.push({
      x,
      y,
      radius: Math.random() * 4 + 1,
      maxRadius: Math.random() * 30 + 10,
      opacity: Math.random() * 0.4 + 0.2,
      color,
      decay: Math.random() * 0.005 + 0.003
    });
  }

  function handlePointerDown(e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    // Grow branch outward/upward from click point
    const growAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    createBranch(clickX, clickY, growAngle);

    // Create Calligraphy Ink Splats/Blooms
    for (let i = 0; i < 8; i++) {
      spawnSplat(clickX + (Math.random() - 0.5) * 60, clickY + (Math.random() - 0.5) * 60);
    }
  }

  function handlePointerMove(e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    mouse.x = clientX - rect.left;
    mouse.y = clientY - rect.top;
  }

  // Draw 5-petaled Sakura blossoms elegantly
  function drawBlossom(ctx: CanvasRenderingContext2D, b: Blossom) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    const progress = b.bloomProgress;
    const size = b.size * progress;

    if (progress < 0.25) {
      // Bud State (Tiny dark pink sphere)
      ctx.beginPath();
      ctx.fillStyle = resolvedBudColor;
      ctx.arc(0, 0, Math.max(b.size * 0.3, 2), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Fully Blooming 5 petals
      const petals = 5;
      ctx.fillStyle = resolvedPetalColor;
      ctx.strokeStyle = resolvedBudColor;
      ctx.lineWidth = 0.5;

      for (let i = 0; i < petals; i++) {
        ctx.rotate((Math.PI * 2) / petals);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Drawing natural heart-shaped petals
        ctx.bezierCurveTo(-size * 0.5, -size * 0.8, -size * 0.8, -size * 0.3, 0, -size * 1.1);
        ctx.bezierCurveTo(size * 0.8, -size * 0.3, size * 0.5, -size * 0.8, 0, 0);
        ctx.fill();
        ctx.stroke();
      }

      // Yellow stamen center
      if (progress > 0.6) {
        ctx.beginPath();
        ctx.fillStyle = resolvedAccentColor;
        ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny stamen threads
        for (let j = 0; j < 6; j++) {
          const stamenAng = (Math.PI * 2 / 6) * j;
          const sX = Math.cos(stamenAng) * (size * 0.35);
          const sY = Math.sin(stamenAng) * (size * 0.35);
          ctx.beginPath();
          ctx.strokeStyle = resolvedAccentColor;
          ctx.lineWidth = 1;
          ctx.moveTo(0, 0);
          ctx.lineTo(sX, sY);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.fillStyle = resolvedAccentColor;
          ctx.arc(sX, sY, 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  $effect(() => {
    if (!canvas) return;
    ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      width = canvas.width;
      height = canvas.height;
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Create interactive starting branch
    createBranch(width * 0.3, height * 0.9, -Math.PI / 3);
    createBranch(width * 0.7, height * 0.95, -Math.PI / 1.7);

    const updateAndRender = () => {
      // Clear canvas with base paper color
      ctx.fillStyle = resolvedBg;
      ctx.fillRect(0, 0, width, height);

      // Draw aged paper vignetting in light mode or gradient halo in dark mode
      const grad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, Math.max(width, height) * 0.7);
      if (theme === 'dark') {
        grad.addColorStop(0, 'rgba(28, 20, 38, 0.4)');
        grad.addColorStop(1, 'rgba(18, 16, 22, 1.0)');
      } else {
        grad.addColorStop(0, 'rgba(246, 243, 235, 0.0)');
        grad.addColorStop(1, 'rgba(224, 218, 201, 0.45)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Update & Draw Ink Splats (fading soft watercolor paint bleed)
      for (let i = splats.length - 1; i >= 0; i--) {
        const s = splats[i];
        s.radius += (s.maxRadius - s.radius) * 0.08;
        s.opacity -= s.decay;

        if (s.opacity <= 0) {
          splats.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = s.opacity;
        // Composite light bleeding
        ctx.globalCompositeOperation = theme === 'dark' ? 'screen' : 'multiply';
        ctx.beginPath();
        ctx.fillStyle = s.color;
        // Draw ink dispersion using overlapping arc rings
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Update & Draw Branches with natural calligraphic tapered widths
      for (let i = branches.length - 1; i >= 0; i--) {
        const b = branches[i];
        b.age += 1;
        
        // Grow the branch step-by-step
        if (b.currentLength < b.targetLength) {
          b.currentLength += 0.35;
        }

        const activeLen = Math.floor(b.currentLength);
        if (activeLen > 1) {
          ctx.save();
          ctx.strokeStyle = resolvedBranchColor;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Draw each branch segment tapering
          for (let j = 1; j < activeLen; j++) {
            const ptPrev = b.points[j - 1];
            const ptCurr = b.points[j];
            
            ctx.beginPath();
            ctx.lineWidth = ptPrev.thickness;
            ctx.moveTo(ptPrev.x, ptPrev.y);
            ctx.lineTo(ptCurr.x, ptCurr.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Draw interactive blossoms along the branch segments
        b.blossoms.forEach((blossom, index) => {
          // Only render blossom if branch growth has reached it
          const blossomIndexOnBranch = Math.floor((index / b.blossoms.length) * b.points.length);
          if (blossomIndexOnBranch > activeLen) return;

          // Check proximity of cursor
          const dx = mouse.x - blossom.x;
          const dy = mouse.y - blossom.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Bloom if mouse within 120 pixels
          if (dist < 120) {
            blossom.targetBloom = 1.0 - (dist / 120) * 0.8; // Open dynamic scale based on distance
          } else {
            blossom.targetBloom = 0.0; // Return to closed bud state
          }

          // Smooth transition of blooming animation
          blossom.bloomProgress += (blossom.targetBloom - blossom.bloomProgress) * 0.1;
          drawBlossom(ctx, blossom);
        });

        // Cleanup old branches to keep memory low if click heavy
        if (branches.length > 20) {
          branches.shift();
        }
      }

      requestRef = requestAnimationFrame(updateAndRender);
    };
    
    updateAndRender();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(requestRef);
    };
  });
</script>

<canvas 
  bind:this={canvas} 
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  class="w-full h-full block absolute top-0 left-0 transition-colors duration-700 cursor-pointer"
  style="touch-action: none;"
></canvas>