import { Tokens } from '@valenced/discord/common/tokens'
import { Design } from '@valenced/discord/design'
import { useMemo } from 'react'
import type { Intensity } from './shared'

/**
 * Liquid-glass style tokens. Keep the numbers here in line with the Music Controls player
 * (plugins/MC/js/glass.ts) so the bar and the player look like one piece of glass.
 */
export interface GlassPreset {
	/** Alpha of the tinted fill (the surface colour of the theme). */
	fill: number
	/** Alpha of the 1px light border. */
	border: number
	/** Alpha of the brightest band of the top highlight. */
	highlight: number
	shadowOpacity: number
	shadowRadius: number
	elevation: number
}

export const Presets: Record<Intensity, GlassPreset> = {
	frosted: {
		fill: 0.8,
		border: 0.16,
		highlight: 0.1,
		shadowOpacity: 0.22,
		shadowRadius: 14,
		elevation: 8,
	},
	balanced: {
		fill: 0.62,
		border: 0.2,
		highlight: 0.14,
		shadowOpacity: 0.28,
		shadowRadius: 16,
		elevation: 10,
	},
	clear: {
		fill: 0.44,
		border: 0.26,
		highlight: 0.18,
		shadowOpacity: 0.34,
		shadowRadius: 20,
		elevation: 12,
	},
}

export const IntensityLabels: Record<
	Intensity,
	{ label: string; subLabel: string }
> = {
	frosted: { label: 'Frosted', subLabel: 'More tint, less see-through.' },
	balanced: { label: 'Balanced', subLabel: 'The default liquid glass look.' },
	clear: { label: 'Clear', subLabel: 'Very see-through, stronger highlights.' },
}

/** Heights (share of the bar) and alpha multipliers of the stacked bands that fake a vertical gradient. */
export const HIGHLIGHT_BANDS: [number, number][] = [
	[0.22, 1],
	[0.22, 0.6],
	[0.22, 0.3],
	[0.22, 0.12],
]

/** Rounded corners used when Discord's own radius cannot be read. */
export const FALLBACK_RADIUS = 28

/** Applies an alpha to a resolved `#rgb`, `#rrggbb(aa)`, `rgb()` or `rgba()` colour. */
export function withAlpha(color: string | undefined, alpha: number) {
	if (!color) return undefined
	const a = Math.max(0, Math.min(1, alpha))
	let r: number
	let g: number
	let b: number
	let base = 1
	const hex = color.trim().match(/^#([0-9a-f]{3,8})$/i)
	if (hex) {
		let h = hex[1]
		if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
		if (h.length !== 6 && h.length !== 8) return undefined
		r = Number.parseInt(h.slice(0, 2), 16)
		g = Number.parseInt(h.slice(2, 4), 16)
		b = Number.parseInt(h.slice(4, 6), 16)
		if (h.length === 8) base = Number.parseInt(h.slice(6, 8), 16) / 255
	} else {
		const rgb = color
			.trim()
			.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/i)
		if (!rgb) return undefined
		r = Number(rgb[1])
		g = Number(rgb[2])
		b = Number(rgb[3])
		if (rgb[4] != null) base = Number(rgb[4])
	}
	return `rgba(${r}, ${g}, ${b}, ${Number((a * base).toFixed(3))})`
}

export interface GlassColors {
	fill: string | undefined
	border: string | undefined
	/** Light sheen, brighter in the top bands. */
	highlight: (alpha: number) => string
	shadow: string | undefined
}

/** Resolves the theme's semantic colours (works in dark and light themes). */
export function useGlassColors(intensity: Intensity): GlassColors {
	const { theme } = (Design as any).useThemeContext()
	return useMemo(() => {
		const { colors: palette, internal } = Tokens.default as any
		const resolve = (names: string[]) => {
			for (const name of names) {
				try {
					if (!palette[name]) continue
					const value = internal.resolveSemanticColor(theme, palette[name])
					if (typeof value === 'string' && value !== 'transparent') return value
				} catch {}
			}
			return undefined
		}
		const preset = Presets[intensity]
		const surface = resolve([
			'BACKGROUND_SURFACE_HIGH',
			'MOBILE_FLOATINGBAR_BACKGROUND',
			'BACKGROUND_BASE_LOWER',
		])
		return {
			fill: withAlpha(surface, preset.fill),
			// Dark themes get a white light edge; light themes use the theme's own border colour.
			border:
				theme === 'light'
					? withAlpha(resolve(['BORDER_STRONG', 'BORDER_NORMAL']), 0.5)
					: `rgba(255, 255, 255, ${preset.border})`,
			highlight: (alpha: number) => `rgba(255, 255, 255, ${alpha})`,
			shadow: withAlpha(resolve(['BACKGROUND_BASE_LOWEST']), 1),
		}
	}, [theme, intensity])
}
