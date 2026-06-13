import type { WorkspaceSyntheticHeuristicInput } from './synthetic';

export interface WorkspaceSyntheticHeuristicReplay {
	readonly version: 1;
	readonly input: WorkspaceSyntheticHeuristicInput;
}

export function serializeWorkspaceSyntheticHeuristicReplay(
	input: WorkspaceSyntheticHeuristicInput,
): string {
	return JSON.stringify(
		{
			version: 1,
			input,
		} satisfies WorkspaceSyntheticHeuristicReplay,
		null,
		2,
	);
}

export function downloadWorkspaceSyntheticHeuristicReplay(input: WorkspaceSyntheticHeuristicInput): void {
	if (typeof window === 'undefined') {
		return;
	}
	const blob = new Blob([serializeWorkspaceSyntheticHeuristicReplay(input)], { type: 'application/json' });
	const url = window.URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = 'workspace-synthetic-replay.json';
	anchor.click();
	window.URL.revokeObjectURL(url);
}

export async function readWorkspaceSyntheticHeuristicReplayFile(file: File): Promise<string> {
	return file.text();
}

export function parseWorkspaceSyntheticHeuristicReplay(text: string): WorkspaceSyntheticHeuristicInput {
	const parsed = JSON.parse(text) as Partial<WorkspaceSyntheticHeuristicReplay> | null;
	if (!parsed || parsed.version !== 1 || !isRecord(parsed.input)) {
		throw new RangeError('invalid synthetic replay payload');
	}
	return {
		cityCoordinatesText: expectString(parsed.input.cityCoordinatesText, 'cityCoordinatesText'),
		cityLinksText: expectString(parsed.input.cityLinksText, 'cityLinksText'),
		roadAlphaRadians: expectFiniteNumber(parsed.input.roadAlphaRadians, 'roadAlphaRadians'),
		azimuthSampleCount: expectPositiveInteger(parsed.input.azimuthSampleCount, 'azimuthSampleCount'),
		coneLengthMeters: expectPositiveInteger(parsed.input.coneLengthMeters, 'coneLengthMeters'),
		attenuationRadians: expectPositiveFiniteNumber(parsed.input.attenuationRadians, 'attenuationRadians'),
		sectorCount: expectPositiveInteger(parsed.input.sectorCount, 'sectorCount'),
		neighborLimit: expectPositiveInteger(parsed.input.neighborLimit, 'neighborLimit'),
		sweepWidths: expectPositiveIntegerArray(parsed.input.sweepWidths, 'sweepWidths'),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function expectString(value: unknown, name: string): string {
	if (typeof value !== 'string') {
		throw new RangeError(`invalid replay field: ${name}`);
	}
	return value;
}

function expectFiniteNumber(value: unknown, name: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new RangeError(`invalid replay field: ${name}`);
	}
	return value;
}

function expectPositiveFiniteNumber(value: unknown, name: string): number {
	const numberValue = expectFiniteNumber(value, name);
	if (!(numberValue > 0)) {
		throw new RangeError(`invalid replay field: ${name}`);
	}
	return numberValue;
}

function expectPositiveInteger(value: unknown, name: string): number {
	const numberValue = expectFiniteNumber(value, name);
	if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
		throw new RangeError(`invalid replay field: ${name}`);
	}
	return numberValue;
}

function expectPositiveIntegerArray(value: unknown, name: string): number[] {
	if (!Array.isArray(value)) {
		throw new RangeError(`invalid replay field: ${name}`);
	}
	return value.map((entry) => expectPositiveInteger(entry, name));
}
