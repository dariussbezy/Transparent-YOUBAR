import { useSyncExternalStore } from 'react'
import { StyleSheet } from 'react-native'

/** In-memory diagnostics: what the patches found and what the YouBar tree looks like. */
export interface Diag {
	lines: Record<string, string>
	renders: Record<string, number>
	errors: string[]
}

let state: Diag = { lines: {}, renders: {}, errors: [] }
const listeners = new Set<() => void>()
let notifyTimer: ReturnType<typeof setTimeout> | undefined

function emit() {
	if (notifyTimer) return
	// Batched: renders happen often and must not re-render the settings page every time.
	notifyTimer = setTimeout(() => {
		notifyTimer = undefined
		state = { ...state }
		for (const listener of listeners) listener()
	}, 300)
}

export function diagSet(key: string, value: string) {
	if (state.lines[key] === value) return
	state.lines[key] = value
	emit()
}

export function diagCount(key: string) {
	state.renders[key] = (state.renders[key] ?? 0) + 1
	emit()
}

export function diagError(where: string, error: unknown) {
	const text = `${where}: ${(error as Error)?.message ?? String(error)}`
	if (state.errors.includes(text)) return
	state.errors = [...state.errors.slice(-9), text]
	emit()
}

export function useDiag() {
	return useSyncExternalStore(
		listener => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		() => state,
	)
}

const nameOf = (value: unknown) => {
	const fn = value as
		| { displayName?: string; name?: string; type?: unknown; render?: unknown }
		| undefined
	return (
		fn?.displayName ||
		fn?.name ||
		nameOfInner(fn?.type) ||
		nameOfInner(fn?.render) ||
		typeof value
	)
}
const nameOfInner = (value: unknown) => {
	const fn = value as { displayName?: string; name?: string } | undefined
	return fn?.displayName || fn?.name || ''
}

/** Short description of an element: type, primitive style values and child types. */
export function describe(node: unknown, depth = 0): string {
	try {
		if (node == null || typeof node !== 'object') return String(node)
		if (Array.isArray(node))
			return `[${node.map(child => describe(child, depth + 1)).join(', ')}]`
		const el = node as { type?: unknown; props?: Record<string, unknown> }
		if (!el.props) return 'obj'
		const flat = (() => {
			try {
				return StyleSheet.flatten(el.props?.style as never) as Record<
					string,
					unknown
				>
			} catch {
				return undefined
			}
		})()
		const style = flat
			? Object.entries(flat)
					.filter(([, v]) => typeof v === 'number' || typeof v === 'string')
					.map(([k, v]) => `${k}:${v}`)
					.join(' ')
			: ''
		const children =
			depth < 3 && el.props.children != null
				? ` > ${describe(el.props.children, depth + 1)}`
				: ''
		return `<${nameOf(el.type)}${style ? ` {${style}}` : ''}${children}>`.slice(
			0,
			700,
		)
	} catch (error) {
		return `describe failed: ${(error as Error)?.message}`
	}
}

export function report(): string {
	const lines = Object.entries(state.lines).map(([k, v]) => `${k}: ${v}`)
	const renders = Object.entries(state.renders).map(
		([k, v]) => `${k} renders: ${v}`,
	)
	return [
		'Transparent YOUBAR diagnostics',
		...lines,
		...renders,
		...state.errors.map(e => `error ${e}`),
	].join('\n')
}
