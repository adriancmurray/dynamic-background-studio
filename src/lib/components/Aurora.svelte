<script lang="ts">
  interface Props {
    blobCount?: number
    blur?: number
    speed?: number
    opacity?: number
    color1?: string
    color2?: string
    color3?: string
    color4?: string
    color5?: string
    color6?: string
  }

  let {
    blobCount = 4,
    blur = 80,
    speed = 20,
    opacity = 0.5,
    color1 = '#a855f7',
    color2 = '#0ea5e9',
    color3 = '#10b981',
    color4 = '#f43f5e',
    color5 = '#eab308',
    color6 = '#f97316',
  }: Props = $props()

  // Make an array of colors based on active count
  let colors = $derived([
    color1,
    color2,
    color3,
    color4,
    color5,
    color6
  ].slice(0, Math.max(2, Math.min(6, blobCount))))
</script>

<div 
  class="aurora-wrapper" 
  style="--aurora-blur: {blur}px; --aurora-opacity: {opacity};"
  aria-hidden="true"
>
  <div class="aurora-container">
    {#each colors as color, index}
      <div 
        class="aurora-blob blob-{index + 1}" 
        style="
          --blob-color: {color};
          --blob-speed: {speed + index * 4}s;
          --blob-delay: {index * -2.5}s;
        "
      ></div>
    {/each}
  </div>
</div>

<style>
  .aurora-wrapper {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
    opacity: var(--aurora-opacity);
    transition: opacity 0.5s ease;
  }

  .aurora-container {
    position: relative;
    width: 100%;
    height: 100%;
    filter: blur(var(--aurora-blur));
    transform: translate3d(0, 0, 0); /* Force GPU acceleration */
  }

  .aurora-blob {
    position: absolute;
    background: var(--blob-color);
    border-radius: 50%;
    mix-blend-mode: screen;
    opacity: 0.75;
    animation: move-blob var(--blob-speed) infinite ease-in-out var(--blob-delay);
    transition: background-color 0.8s ease;
  }

  /* Different sizes and starting positions for blobs */
  .blob-1 {
    width: 55vw;
    height: 55vw;
    top: -10%;
    left: -10%;
    animation-name: move-blob-1;
  }

  .blob-2 {
    width: 50vw;
    height: 50vw;
    bottom: -15%;
    right: -10%;
    animation-name: move-blob-2;
  }

  .blob-3 {
    width: 45vw;
    height: 45vw;
    top: 30%;
    left: 40%;
    animation-name: move-blob-3;
  }

  .blob-4 {
    width: 48vw;
    height: 48vw;
    bottom: 20%;
    left: -15%;
    animation-name: move-blob-4;
  }

  .blob-5 {
    width: 40vw;
    height: 40vw;
    top: -20%;
    right: 15%;
    animation-name: move-blob-5;
  }

  .blob-6 {
    width: 38vw;
    height: 38vw;
    bottom: -10%;
    left: 30%;
    animation-name: move-blob-6;
  }

  /* Support for light theme contrast with blend modes */
  :global(html[data-theme="light"]) .aurora-blob {
    mix-blend-mode: multiply;
    opacity: 0.28;
  }

  @keyframes move-blob-1 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(15vw, -10vh) scale(1.15); }
    66% { transform: translate(-10vw, 15vh) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-2 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(-20vw, 12vh) scale(1.2); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-3 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(-12vw, -15vh) scale(0.85); }
    66% { transform: translate(18vw, 8vh) scale(1.1); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-4 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(15vw, 15vh) scale(0.95); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-5 {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(-18vw, 10vh) scale(1.1); }
    66% { transform: translate(10vw, -12vh) scale(0.85); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @keyframes move-blob-6 {
    0% { transform: translate(0px, 0px) scale(1); }
    50% { transform: translate(12vw, -18vh) scale(1.15); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-blob {
      animation: none !important;
    }
  }
</style>
