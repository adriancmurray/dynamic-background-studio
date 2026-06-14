# Contributing to Dynamic Background Studio

Thank you for your interest in contributing! Dynamic Background Studio is built to be modular, zero-dependency, and incredibly fun.

There are two primary ways you can contribute: **sharing custom preset variables** via the GitHub Issue flow, or **coding new background components** via Pull Requests.

---

## 🎨 Flow 1: Submit a Custom Background Configuration (No Code)

If you have designed a beautiful combination of variables (e.g. customized colors, speeds, spacing, counts) in the studio, you can submit it to the curated **Community Gallery**:

1. In the studio sidebar, customize your background variables.
2. Under the **Presets** tab, click **"Submit to Gallery"**.
3. This will open a pre-filled **GitHub Issue** containing a JSON block of your configurations.
4. Fill in your name/handle and click **Submit**.
5. Once approved, your custom preset will be built directly into the catalog for everyone to play with!

---

## 💻 Flow 2: Build a New Background Component (Code)

If you want to write a new background animation (e.g. dynamic waves, geometric shapes, physics simulations):

### 1. Create the Svelte Component
Create a new Svelte file under `src/lib/components/MyNewPreset.svelte`.
* **Zero Dependencies**: Write it using standard Svelte 5 logic and a canvas or pure CSS. It must run standalone so developers can copy-paste it directly.
* **Vanilla CSS**: Any custom styles must reside in a scoped `<style>` block at the bottom of the component.
* **Spring Animations / Interactivity**: Support responsiveness (`resize`) and optional mouse-following pointer interactions.
* **Reduced Motion**: Respect system accessibility by reading `window.matchMedia('(prefers-reduced-motion: reduce)')` to disable or slow down heavy transitions.

Example template:
```svelte
<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    speed?: number
    color?: string
  }

  let { speed = 1.0, color = '#3b82f6' }: Props = $props()

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D
  let animationFrame = 0

  function draw() {
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    // Draw animation loop here...
    animationFrame = requestAnimationFrame(draw)
  }

  onMount(() => {
    context = canvas.getContext('2d') as CanvasRenderingContext2D
    draw()
    return () => cancelAnimationFrame(animationFrame)
  })
</script>

<canvas bind:this={canvas} class="background-canvas"></canvas>

<style>
  .background-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    background: transparent;
  }
</style>
```

### 2. Register Your Preset
Add the metadata and control panel variables in `src/lib/presetCatalog.ts`:
```typescript
{
  id: 'mypreset',
  componentName: 'MyNewPreset',
  name: 'My New Preset',
  description: 'A beautiful and exciting animation explanation.',
  defaultConfig: {
    speed: 1.0,
    color: '#3b82f6',
  },
  controls: [
    { key: 'speed', label: 'Speed', type: 'slider', min: 0.1, max: 4.0, step: 0.1 },
    { key: 'color', label: 'Theme Color', type: 'color' }
  ]
}
```

### 3. Register the Source Code
Copy the exact source code of your `.svelte` file and add it as a string to `src/lib/componentSources.ts` under the key `mypreset` so developers can copy it from the **Code Export** tab.

### 4. Wire it in the UI
In `src/App.svelte`:
1. Import your new component:
   `import MyNewPreset from './lib/components/MyNewPreset.svelte'`
2. Add it to the viewport switch block:
   ```svelte
   {:else if activePresetId === 'mypreset'}
     <MyNewPreset {...activeConfig} />
   ```

### 5. Verify and Submit
Run checks and submit a Pull Request:
```bash
npm run check
npm run build
```
Once verified, submit the Pull Request!
