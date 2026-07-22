# Data Dance

Data Dance is an interactive embodied data storytelling prototype for an HCI
Master's thesis. The app uses webcam-based MediaPipe landmarks to record,
replay, and compare movement as part of a bird migration story experience.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## UI Style Baseline

The app now uses a small global style system loaded via `nuxt.config.ts` from `src/assets/styles/styles.scss`.

### Design Tokens

Defined as CSS variables in `:root`:

- `--color-primary`, `--color-primary-hover`, `--color-primary-strong`
- `--color-bg`, `--color-surface`
- `--color-text`, `--color-text-muted`
- `--color-border`, `--color-chip-bg`
- `--space-1` to `--space-7`
- `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`
- `--shadow-soft`, `--shadow-panel`, `--shadow-card`

### Reusable Global Classes

Use these classes for new UI components:

- Panels/Cards: `.panel-shell`, `.card-panel`, `.panel-title`
- Inputs: `.field`, `.input-modern`
- Buttons: `.btn`, `.btn--primary`, `.icon-btn`, `.buttons`
- Control layout: `.control-layout`, `.control-main`, `.control-meta`, `.control-inline-note`
- Tabs: `.tabs`, `.tab-btn`, `.tab-btn.active`
- Chips/Status: `.chip`, `.status-chip` + state modifiers (`.active`, `.playing`, `.paused`, `.stopped`, `.loaded`)
- Small utilities: `.row`, `.stack`, `.muted`

### Control Pattern

Record/Playback controls follow a reduced action model:

- Record: one primary toggle (`Start` / `Stop`) + secondary export icon action
- Playback: one primary toggle (`Start` / `Pause`) + secondary stop icon action

Panel content order is always:

1. Header
2. Input field
3. Primary action row
4. Status row

### Icon System

Material Design Icons are used via `@mdi/js` and `src/components/ui/BaseIcon.vue`.

Example:

```vue
<BaseIcon :path="mdiPlay" />
```

This keeps icon usage lightweight without introducing a full UI framework.
