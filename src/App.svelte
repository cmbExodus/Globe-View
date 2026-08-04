<script>
  import Globe from './Globe.svelte'

  let showCities = true
</script>

<main>
  <Globe {showCities} />

  <div class="overlay">
    <h1>Globe View</h1>
    <p class="hint">Drag to rotate &bull; Scroll to zoom</p>
  </div>

  <button class="toggle" on:click={() => (showCities = !showCities)}>
    <span class="dot" class:on={showCities}></span>
    City Lights: {showCities ? 'On' : 'Off'}
  </button>
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #05060c;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  main {
    position: relative;
    width: 100vw;
    height: 100vh;
    background: radial-gradient(ellipse at 50% 40%, #10162a 0%, #05060c 70%);
  }

  .overlay {
    position: absolute;
    top: 24px;
    left: 28px;
    color: #f4f2ea;
    pointer-events: none;
    user-select: none;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
  }

  .overlay h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .overlay .hint {
    margin: 4px 0 0;
    font-size: 13px;
    opacity: 0.65;
  }

  .toggle {
    position: absolute;
    bottom: 26px;
    left: 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(15, 20, 35, 0.55);
    color: #f4f2ea;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 14px;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .toggle:hover {
    background: rgba(30, 38, 60, 0.75);
    border-color: rgba(255, 220, 160, 0.4);
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #555;
    transition: background 0.2s ease, box-shadow 0.2s ease;
  }

  .dot.on {
    background: #ffd27a;
    box-shadow: 0 0 8px 2px rgba(255, 210, 122, 0.8);
  }
</style>
