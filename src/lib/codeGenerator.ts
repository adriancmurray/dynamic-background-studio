import { presetCatalog } from './presetCatalog'

export function generateSvelteUseCode(presetId: string, config: Record<string, any>, theme: string): string {
  const propsStr = Object.entries(config)
    .map(([key, val]) => {
      if (typeof val === 'string') {
        return `  ${key}="${val}"`
      }
      return `  ${key}={${val}}`
    })
    .join('\n')

  const preset = presetCatalog.find(p => p.id === presetId)
  const compName = preset ? preset.componentName : (presetId.charAt(0).toUpperCase() + presetId.slice(1))
  
  return `<script lang="ts">
  import ${compName} from './lib/components/${compName}.svelte'
</script>

<div class="background-container">
  <${compName}
${propsStr}
  />
</div>

<style>
  .background-container {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: ${theme === 'dark' ? '#000000' : '#f5f5f7'}; 
  }
</style>`
}
