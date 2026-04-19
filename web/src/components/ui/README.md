# shadcn/ui — Installed Components

Initialized with shadcn 4.3.0, style `base-nova` (uses `@base-ui/react` primitives), Tailwind 4.

## Installed components

| Component | Import path | Notes |
|-----------|-------------|-------|
| Button | `@/components/ui/button` | Variants: default, outline, secondary, ghost, destructive, link |
| Card | `@/components/ui/card` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| Badge | `@/components/ui/badge` | Variants: default, secondary, destructive, outline |
| Separator | `@/components/ui/separator` | Horizontal/vertical rule |
| Sheet | `@/components/ui/sheet` | Slide-over panel (side: top/right/bottom/left) |
| Table | `@/components/ui/table` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption` |
| Skeleton | `@/components/ui/skeleton` | Loading placeholder |
| ScrollArea | `@/components/ui/scroll-area` | Custom scrollbar container |
| Tabs | `@/components/ui/tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| Dialog | `@/components/ui/dialog` | Modal dialog with overlay |
| Input | `@/components/ui/input` | Text input field |
| Select | `@/components/ui/select` | Dropdown select with search |
| DropdownMenu | `@/components/ui/dropdown-menu` | Contextual menu |
| Tooltip | `@/components/ui/tooltip` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` |
| Avatar | `@/components/ui/avatar` | `Avatar`, `AvatarImage`, `AvatarFallback` |
| Progress | `@/components/ui/progress` | Horizontal progress bar |
| Label | `@/components/ui/label` | Form label with htmlFor wiring |

Utility: `@/lib/utils` — exports `cn(...classValues)` (clsx + tailwind-merge).

## Brand color tokens

| Token | Value | Use |
|-------|-------|-----|
| `--primary` | `oklch(0.45 0.18 260)` | Brand blue (Linear/Cal.com register) — shadcn Button default, rings |
| `--accent` | `#639fc4` | Prototype accent blue — nav active states, viz, rings |
| `--cta` | `#1032cf` | Strong call-to-action blue (buttons, active pills) |
| `--radius` | `0.625rem` | Base radius — all shadcn components derive from this |

Dark mode primary: `oklch(0.488 0.243 264.376)` (sidebar-primary, auto-populated).

## Usage patterns

### Card vs raw div
Use `Card` for standalone content blocks that need elevation (e.g. metric tiles, list items in a feed). Use a raw `div.panel` or `div.card` for prototype layouts that rely on existing CSS utility classes.

### Sheet vs Dialog
Use `Sheet` for workspace side panels (Canvas detail rail, initiative detail, voice input overlay). Use `Dialog` for confirmation prompts, inline forms, and short-lived modals.

### Tooltip
Always wrap the app (or the relevant subtree) with `TooltipProvider` from `@/components/ui/tooltip`. The layout.tsx does not include it yet — add it before using tooltips.

### Badge (shadcn) vs .badge (prototype)
The prototype `.badge` CSS class and the shadcn `Badge` component coexist — the prototype class targets plain HTML elements; the shadcn component is for React-composed usage. Prefer shadcn `Badge` in new components, `.badge` only in prototype screens.

## Docs

Full component docs: https://ui.shadcn.com/docs/components
