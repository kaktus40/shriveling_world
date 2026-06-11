<svelte:head>
	<title>Shriveling world migration</title>
</svelte:head>

<slot />

<style>
	:global(body) {
		margin: 0;
		color: #d8e2e1;
		background:
			radial-gradient(circle at top left, rgba(13, 111, 115, 0.2), transparent 20rem),
			radial-gradient(circle at top right, rgba(70, 93, 149, 0.16), transparent 22rem),
			linear-gradient(180deg, #0b1116 0%, #121a22 100%);
		font-family:
			'Inter',
			'Segoe UI',
			Roboto,
			sans-serif;
	}

	:global(a) {
		color: #88e0dc;
	}

	:global(code),
	:global(pre) {
		font-family:
			'JetBrains Mono',
			'SFMono-Regular',
			Consolas,
			monospace;
	}
</style>
