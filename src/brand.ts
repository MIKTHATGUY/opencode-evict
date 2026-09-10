/**
 * Evict brand tokens.
 *
 * Brand:       Evict
 * Descriptor:  for OpenCode
 * CLI:         oc-evict
 * Repository:  opencode-evict
 *
 * Keep this as the single source of truth for user-facing naming and colors.
 * Logo itself stays flat orange; gradients are only for large graphics.
 */
export const BRAND = {
	name: "evict",
	descriptor: "for OpenCode",
	tagline: "Stop trusting yesterday's JSON.",
	description: "Live model registry synchronization for OpenCode.",
	cli: "oc-evict",
	repo: "opencode-evict",
	package: "@mikthatguy/opencode-evict",
	colors: {
		background: "#0C0C0E",
		surface: "#151518",
		text: "#F5F5F5",
		secondary: "#98989F",
		orange: "#FF6B35",
		orangeLight: "#FF8A5C",
		gradientFrom: "#FF8A4C",
		gradientTo: "#FF5C35",
	},
} as const;
