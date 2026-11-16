import type { JsonStorage } from '@valenced/json-storage'

export type Intensity = 'frosted' | 'balanced' | 'clear'

export interface Settings {
	enabled: boolean
	intensity: Intensity
	border: boolean
	/** Use Discord's native blur view behind the bar when it can be found. */
	realBlur: boolean
}

export const DefaultSettings: Settings = {
	enabled: true,
	intensity: 'balanced',
	border: true,
	realBlur: false,
}

export const Intensities: Intensity[] = ['frosted', 'balanced', 'clear']

let storage: JsonStorage<Settings> | undefined

export function setStorage(next: JsonStorage<Settings> | undefined) {
	storage = next
}

/** Keeps only known keys with the right type, so a corrupted storage file cannot break the bar. */
function normalize(raw: Record<string, unknown> | undefined): Settings {
	const settings = { ...DefaultSettings }
	if (!raw) return settings
	if (typeof raw.enabled === 'boolean') settings.enabled = raw.enabled
	if (typeof raw.border === 'boolean') settings.border = raw.border
	if (typeof raw.realBlur === 'boolean') settings.realBlur = raw.realBlur
	if (Intensities.includes(raw.intensity as Intensity))
		settings.intensity = raw.intensity as Intensity
	return settings
}

/** React hook: current settings, re-renders when they change. */
export function useSettings(): Settings {
	return normalize(storage?.use() as Record<string, unknown> | undefined)
}

export function setSetting<K extends keyof Settings>(
	key: K,
	value: Settings[K],
) {
	storage?.set({ [key]: value }).catch(() => {})
}
