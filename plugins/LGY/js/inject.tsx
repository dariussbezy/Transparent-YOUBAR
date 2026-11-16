import { getModules } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	FilterScopes,
} from '@valenced/modules/finders/filters'
import { after } from '@valenced/patcher'
import { Children, Component, cloneElement, isValidElement } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	FALLBACK_RADIUS,
	HIGHLIGHT_BANDS,
	Presets,
	useGlassColors,
} from './glass'
import { useSettings } from './shared'
import type { Filter, FilterGenerator } from '@valenced/modules/finders/filters'
import type { ReactElement, ReactNode } from 'react'
import type { GlassColors } from './glass'
import type { Intensity } from './shared'

type AnyFn = (...args: any[]) => any

const nameOf = (value: unknown) => {
	const fn = value as { displayName?: string; name?: string } | undefined
	return fn?.displayName || fn?.name || ''
}

/** Matches a component exported plain, memoized, forwardRef-ed or as `default`. */
const withComponentName = createFilterGenerator(
	([name]: [string], _, exports) => {
		const e = exports as Record<string, unknown> | undefined
		const d = e?.default as Record<string, unknown> | undefined
		return [e, d, e?.type, d?.type, e?.render, d?.render].some(
			candidate => nameOf(candidate) === name,
		)
	},
	([name]: [string]) => `dariuss.liquid-glass-youbar.component(${name})`,
	FilterScopes.Initialized,
) as unknown as FilterGenerator<
	(
		name: string,
	) => Filter<{ Result: object; Scopes: [typeof FilterScopes.Initialized] }>
>

/** Renders nothing when the optional native blur view throws. */
class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false }
	static getDerivedStateFromError() {
		return { failed: true }
	}
	render() {
		return this.state.failed ? null : this.props.children
	}
}

let blurView: AnyFn | null | undefined
/** Discord's native blur view, if it can be reached from JS. Looked up once, only when asked for. */
function findBlurView() {
	if (blurView !== undefined) return blurView
	blurView = null
	try {
		getModules(
			withComponentName('VisualEffectView'),
			namespace => {
				const ns = namespace as Record<string, unknown>
				const candidate = (ns?.default ?? ns?.VisualEffectView ?? ns) as AnyFn
				if (typeof candidate === 'function' || typeof candidate === 'object')
					blurView = candidate
			},
			{ returnNamespace: true },
		)
	} catch {
		blurView = null
	}
	return blurView
}

/** The layers drawn inside the bar: optional blur, a top highlight and a light top edge. */
export function GlassLayers({
	colors,
	intensity,
	radius,
	blur,
}: {
	colors: GlassColors
	intensity: Intensity
	radius: number
	blur: boolean
}) {
	const preset = Presets[intensity]
	const Blur = blur ? (findBlurView() as AnyFn | null) : null
	return (
		// custom: Discord has no glass surface component, so the sheen is stacked translucent views
		<View
			pointerEvents="none"
			style={[
				StyleSheet.absoluteFill,
				{ borderRadius: radius, overflow: 'hidden' },
			]}
		>
			{Blur ? (
				<Guard>
					<Blur style={StyleSheet.absoluteFill} />
				</Guard>
			) : null}
			{HIGHLIGHT_BANDS.map(([height, weight], index) => (
				<View
					// biome-ignore lint/suspicious/noArrayIndexKey: static list
					key={index}
					style={{
						height: `${height * 100}%`,
						backgroundColor: colors.highlight(preset.highlight * weight),
					}}
				/>
			))}
			<View
				style={{
					position: 'absolute',
					top: 0,
					left: radius * 0.6,
					right: radius * 0.6,
					height: StyleSheet.hairlineWidth * 2,
					backgroundColor: colors.highlight(Math.min(1, preset.border * 2.4)),
				}}
			/>
		</View>
	)
}

/** Reads a numeric corner radius out of a style, ignoring animated values. */
function radiusOf(style: unknown) {
	try {
		const flat = StyleSheet.flatten(style as never) as Record<string, unknown>
		for (const key of ['borderRadius', 'borderTopLeftRadius']) {
			const value = flat?.[key]
			if (typeof value === 'number' && value > 0) return value
		}
	} catch {}
	return FALLBACK_RADIUS
}

/** Runs after `YouBar` rendered: tints its root and adds the glass layers as its first child. */
function useGlass(rendered: ReactNode): ReactNode {
	const settings = useSettings()
	const colors = useGlassColors(settings.intensity)
	if (!settings.enabled || !isValidElement(rendered)) return rendered
	const root = rendered as ReactElement<any>

	const preset = Presets[settings.intensity]
	const radius = radiusOf(root.props.style)
	const style = {
		backgroundColor: colors.fill,
		borderWidth: settings.border ? 1 : 0,
		borderColor: settings.border ? colors.border : 'transparent',
		shadowColor: colors.shadow,
		shadowOpacity: preset.shadowOpacity,
		shadowRadius: preset.shadowRadius,
		shadowOffset: { width: 0, height: 6 },
		elevation: preset.elevation,
	}
	return cloneElement(
		root,
		{ style: [root.props.style, style] },
		<GlassLayers
			key="liquid-glass-youbar"
			colors={colors}
			intensity={settings.intensity}
			radius={radius}
			blur={settings.realBlur}
		/>,
		...Children.toArray(root.props.children),
	)
}

/**
 * Patches Discord's `YouBar` render function itself, so the element keeps its type and name and
 * other plugins (Music Controls, Better You Bar) still find and wrap it. Registered through `cleanup`.
 */
export function patchYouBar(
	cleanup: (...undo: (() => void)[]) => void,
	onError: (error: unknown) => void,
) {
	const patched = new WeakSet<object>()
	cleanup(
		getModules(
			withComponentName('YouBar'),
			namespace => {
				const ns = namespace as Record<string, unknown> | undefined
				const inner = (ns?.default ?? ns) as Record<string, unknown> | undefined
				const hasType = typeof inner?.type === 'function'
				const hasRender = typeof inner?.render === 'function'
				const target = (hasType || hasRender ? inner : ns) as
					| Record<string, AnyFn>
					| undefined
				const key = hasType ? 'type' : hasRender ? 'render' : 'default'
				if (!target || typeof target[key] !== 'function' || patched.has(target))
					return
				patched.add(target)
				try {
					cleanup(
						after(target, key, rendered => useGlass(rendered as ReactNode)),
					)
				} catch (error) {
					onError(error)
				}
			},
			{ returnNamespace: true },
		),
	)
}
