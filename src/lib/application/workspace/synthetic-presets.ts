export interface WorkspaceSyntheticPreset {
	readonly cityCoordinatesText: string;
	readonly cityLinksText: string;
}

export function buildRandomSyntheticPreset(cityCount: number, linksPerCity: number): WorkspaceSyntheticPreset {
	return buildSyntheticPreset(cityCount, linksPerCity, (cityIndex, linkIndex) => {
		const lon = -Math.PI + Math.random() * Math.PI * 2;
		const lat = -Math.PI / 2 + Math.random() * Math.PI;
		const azimuth = Math.random() * Math.PI * 2;
		const alpha = 0.15 + Math.random() * 0.6;
		return {
			cityLine: `${lon.toFixed(4)} ${lat.toFixed(4)}`,
			linkToken: `${linkIndex}@${azimuth.toFixed(4)}:${alpha.toFixed(4)}`,
		};
	});
}

export function buildCorridorSyntheticPreset(cityCount: number, linksPerCity: number): WorkspaceSyntheticPreset {
	const span = Math.max(1, cityCount - 1);
	return buildSyntheticPreset(cityCount, linksPerCity, (cityIndex, linkIndex) => {
		const progress = cityIndex / span;
		const lon = -0.9 + progress * 1.8;
		const lat = 0.35 * Math.sin(progress * Math.PI * 2);
		const azimuth = (progress * Math.PI * 1.3 + linkIndex * 0.4) % (Math.PI * 2);
		const alpha = 0.18 + progress * 0.2 + linkIndex * 0.03;
		return {
			cityLine: `${lon.toFixed(4)} ${lat.toFixed(4)}`,
			linkToken: `${linkIndex}@${azimuth.toFixed(4)}:${alpha.toFixed(4)}`,
		};
	});
}

export function buildClusterSyntheticPreset(cityCount: number, linksPerCity: number): WorkspaceSyntheticPreset {
	const span = Math.max(1, cityCount - 1);
	return buildSyntheticPreset(cityCount, linksPerCity, (cityIndex, linkIndex) => {
		const progress = cityIndex / span;
		const lon = 0.15 * Math.cos(progress * Math.PI * 4);
		const lat = 0.15 * Math.sin(progress * Math.PI * 4);
		const azimuth = (Math.PI / 4 + linkIndex * 0.25 + progress * 0.5) % (Math.PI * 2);
		const alpha = 0.24 + linkIndex * 0.04 + progress * 0.04;
		return {
			cityLine: `${lon.toFixed(4)} ${lat.toFixed(4)}`,
			linkToken: `${linkIndex}@${azimuth.toFixed(4)}:${alpha.toFixed(4)}`,
		};
	});
}

type SyntheticPresetToken = {
	readonly cityLine: string;
	readonly linkToken: string;
};

function buildSyntheticPreset(
	cityCount: number,
	linksPerCity: number,
	formatter: (cityIndex: number, linkIndex: number) => SyntheticPresetToken,
): WorkspaceSyntheticPreset {
	const cityLines: string[] = [];
	const linkLines: string[] = [];
	for (let cityIndex = 0; cityIndex < cityCount; cityIndex += 1) {
		const cityToken = formatter(cityIndex, 0);
		cityLines.push(cityToken.cityLine);
		const linkTokens: string[] = [];
		for (let linkIndex = 0; linkIndex < linksPerCity; linkIndex += 1) {
			const token = formatter(cityIndex, linkIndex);
			linkTokens.push(token.linkToken);
		}
		linkLines.push(linkTokens.join('; '));
	}
	return {
		cityCoordinatesText: cityLines.join('\n'),
		cityLinksText: linkLines.join('\n'),
	};
}
