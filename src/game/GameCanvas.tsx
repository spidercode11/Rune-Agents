import { useEffect, useRef } from 'react'
import { Application, Assets, Sprite, Texture, TilingSprite } from 'pixi.js'
import { IsometricMap } from './IsometricMap'

/** Build a radial-gradient vignette texture on a 2D canvas. */
function makeVignetteTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const cx  = w / 2
  const cy  = h / 2
  // Radius large enough to darken the corners
  const r   = Math.sqrt(cx * cx + cy * cy) * 1.1
  const grad = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r)
  grad.addColorStop(0,   'rgba(5,15,30,0)')     // transparent — full brightness near center
  grad.addColorStop(0.5, 'rgba(5,15,30,0.25)')  // slight tint at mid-distance
  grad.addColorStop(1,   'rgba(3,8,18,0.88)')   // deep dark at the far edges
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  return Texture.from(canvas)
}

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current!
    const app = new Application()
    let destroyed = false
    let initialized = false
    let map: IsometricMap | null = null

    app.init({ resizeTo: container, background: '#0a3050' }).then(async () => {
      if (destroyed) {
        app.destroy()
        return
      }
      initialized = true
      container.appendChild(app.canvas)

      // ── Animated ocean background ──────────────────────────────────────
      const waterTextures = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          Assets.load<Texture>(`/assets/tiles/Water animation${i + 1}.png`)
        )
      )
      for (const tex of waterTextures) {
        tex.source.scaleMode = 'nearest'
      }

      const ocean = new TilingSprite({
        texture: waterTextures[0],
        width:   app.screen.width,
        height:  app.screen.height,
      })
      ocean.eventMode = 'none'
      app.stage.addChild(ocean)

      // ── Radial vignette — bright near grid, dark at screen edges ──────
      const vignette = new Sprite(makeVignetteTexture(app.screen.width, app.screen.height))
      vignette.eventMode = 'none'
      app.stage.addChild(vignette)

      // ── Isometric map on top ───────────────────────────────────────────
      map = new IsometricMap()
      await map.init(app)
      app.stage.addChild(map.container)
      // Overlay (agent roster etc.) sits above the map and is not affected by pan/zoom
      app.stage.addChild(map.overlayContainer)

      // ── Per-frame updates ──────────────────────────────────────────────
      let waterFrame = 0
      let frameTimer = 0
      app.ticker.add((ticker) => {
        // Keep ocean + vignette filling the canvas after any resize
        const sw = app.screen.width
        const sh = app.screen.height
        if (ocean.width !== sw || ocean.height !== sh) {
          ocean.width      = sw
          ocean.height     = sh
          vignette.texture = makeVignetteTexture(sw, sh)
          vignette.width   = sw
          vignette.height  = sh
        }

        // Cycle water frames (~8 fps)
        frameTimer += ticker.deltaTime
        if (frameTimer >= 7) {
          frameTimer = 0
          waterFrame        = (waterFrame + 1) % waterTextures.length
          ocean.texture     = waterTextures[waterFrame]
        }

        // Slow diagonal drift for ocean movement
        ocean.tilePosition.x += 0.3
        ocean.tilePosition.y += 0.15

        map!.update()
      })
    })

    return () => {
      destroyed = true
      map?.destroy()
      if (initialized) {
        app.destroy(true)
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
}
