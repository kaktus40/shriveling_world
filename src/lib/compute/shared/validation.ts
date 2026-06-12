import type { DatasetDiagnostic } from '../../domain/data';

/** Compares two float32 buffers and returns diagnostics only when they differ. */
export function compareFloat32Buffers(
	label: string,
	expected: Float32Array,
	actual: Float32Array,
	tolerance = 1e-5,
): DatasetDiagnostic[] {
	if (expected.length !== actual.length) {
		return [
			{
				severity: 'warning',
				code: `${label}-length-mismatch`,
				expectedLength: expected.length,
				actualLength: actual.length,
			},
		];
	}

	let maxDelta = 0;
	let maxIndex = -1;
	for (let index = 0; index < expected.length; index += 1) {
		const delta = Math.abs(expected[index] - actual[index]);
		if (delta > maxDelta) {
			maxDelta = delta;
			maxIndex = index;
		}
	}

	if (maxDelta > tolerance) {
		return [
			{
				severity: 'warning',
				code: `${label}-mismatch`,
				maxDelta,
				maxIndex,
				tolerance,
			},
		];
	}

	return [];
}
