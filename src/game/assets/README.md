# Game Assets

Place sprite assets here. Phase 1 uses geometric placeholder shapes rendered in code.

## Folder Structure

```
assets/
├── sprites/
│   ├── agents/      # Character spritesheets (wizard, blacksmith, etc.)
│   ├── buildings/   # Building sprites (forge, library, tower, tavern)
│   ├── tiles/       # Isometric tile textures (grass, path, water)
│   └── effects/     # Particle textures, glow effects
└── fonts/           # Custom pixel fonts (.ttf/.woff2)
```

## Where to Find OSRS-Style Assets

- **itch.io** — Search "isometric pixel art" or "retro RPG tileset"
- **OpenGameArt.org** — Free game assets, filter by isometric
- **Aseprite** — Pixel art editor ($20) for creating custom sprites

## Spritesheet Format

When adding real spritesheets, use this format:
- PNG with transparency
- Each frame in a horizontal strip
- Consistent frame size (e.g., 32×32 or 48×48 per frame)
- Name format: `agent-wizard-walk-south.png`
