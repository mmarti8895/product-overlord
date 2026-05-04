<script lang="ts">
  import '../lib/styles/global.css';
  import '../lib/styles/lcars.css';
  import AppShell from '../lib/components/lcars/AppShell.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<AppShell>
  {@render children()}
</AppShell>
