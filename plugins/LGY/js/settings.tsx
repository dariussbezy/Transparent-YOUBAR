import Page from '@valenced/components/Page'
import TableRowAssetIcon from '@valenced/components/TableRowAssetIcon'
import { Tokens } from '@valenced/discord/common/tokens'
import { Design } from '@valenced/discord/design'
import { StyleSheet, View } from 'react-native'
import manifest from '../manifest.json'
import { IntensityLabels, Presets, useGlassColors } from './glass'
import { GlassLayers } from './inject'
import { Intensities, setSetting, useSettings } from './shared'
import type { Intensity } from './shared'

const icon = (name: string) => <TableRowAssetIcon name={name} />

const PREVIEW_HEIGHT = 64
const PREVIEW_RADIUS = 28

/** Backdrop colours taken from the theme's own status and brand tokens. */
function useStripes() {
	const { theme } = (Design as any).useThemeContext()
	const { colors, internal } = Tokens.default as any
	return [
		'STATUS_POSITIVE_BACKGROUND',
		'STATUS_DANGER_BACKGROUND',
		'STATUS_WARNING_BACKGROUND',
		'BACKGROUND_BRAND',
		'STATUS_POSITIVE_BACKGROUND',
	].map(name => {
		try {
			return internal.resolveSemanticColor(theme, colors[name]) as string
		} catch {
			return 'transparent'
		}
	})
}

/** The bar's look on top of a colourful backdrop, so the translucency is visible. */
function Preview() {
	const settings = useSettings()
	const colors = useGlassColors(settings.intensity)
	const preset = Presets[settings.intensity]
	const stripes = useStripes()
	return (
		// custom: a static mock of the bar over a backdrop; no native component draws this
		<View style={{ height: 120, borderRadius: 16, overflow: 'hidden' }}>
			<View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
				{stripes.map((color, index) => (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={index}
						style={{ flex: 1, backgroundColor: color }}
					/>
				))}
			</View>
			<View
				style={{
					position: 'absolute',
					left: 16,
					right: 16,
					bottom: 16,
					height: PREVIEW_HEIGHT,
					borderRadius: PREVIEW_RADIUS,
					backgroundColor: settings.enabled ? colors.fill : undefined,
					borderWidth: settings.enabled && settings.border ? 1 : 0,
					borderColor: colors.border,
					shadowColor: colors.shadow,
					shadowOpacity: preset.shadowOpacity,
					shadowRadius: preset.shadowRadius,
					shadowOffset: { width: 0, height: 6 },
					elevation: preset.elevation,
				}}
			>
				{settings.enabled ? (
					<GlassLayers
						colors={colors}
						intensity={settings.intensity}
						radius={PREVIEW_RADIUS}
						blur={false}
					/>
				) : null}
			</View>
		</View>
	)
}

export default function SettingsComponent() {
	const settings = useSettings()
	return (
		<Page>
			<Design.Stack spacing={24}>
				<Design.TableRowGroup title="Preview">
					<Preview />
				</Design.TableRowGroup>
				<Design.TableRowGroup title="Liquid Glass YOUBAR">
					<Design.TableSwitchRow
						label="Enable"
						subLabel="Applies to the YouBar after Discord restarts."
						icon={icon('PaintPaletteIcon')}
						value={settings.enabled}
						onValueChange={value => setSetting('enabled', value)}
					/>
					<Design.TableSwitchRow
						label="Light border"
						subLabel="A thin light edge around the bar."
						icon={icon('EyeIcon')}
						value={settings.border}
						onValueChange={value => setSetting('border', value)}
					/>
					<Design.TableSwitchRow
						label="Native blur (experimental)"
						subLabel="Blur what is behind the bar with Discord's own blur view, when it can be found."
						icon={icon('SparklesIcon')}
						value={settings.realBlur}
						onValueChange={value => setSetting('realBlur', value)}
					/>
				</Design.TableRowGroup>
				<Design.TableRadioGroup
					title="Glass intensity"
					value={settings.intensity}
					onChange={value => {
						if (Intensities.includes(value as Intensity))
							setSetting('intensity', value as Intensity)
					}}
				>
					{Intensities.map(id => (
						<Design.TableRadioRow
							key={id}
							value={id}
							label={IntensityLabels[id].label}
							subLabel={IntensityLabels[id].subLabel}
						/>
					))}
				</Design.TableRadioGroup>
				<Design.Text variant="text-sm/medium" color="text-muted">
					Liquid Glass YOUBAR {manifest.version}
				</Design.Text>
			</Design.Stack>
		</Page>
	)
}
