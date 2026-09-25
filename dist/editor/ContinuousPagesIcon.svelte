<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  interface Props extends SVGAttributes<SVGSVGElement> {
    size?: number | string;
  }

  let { size = 24, ...attributes }: Props = $props();
</script>

<svg
  {...attributes}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect x="4" y="2" width="16" height="7" rx="1.5" />
  <path d="M12 10v3m-2-2 2 2 2-2" />
  <rect x="4" y="15" width="16" height="7" rx="1.5" />
</svg>
