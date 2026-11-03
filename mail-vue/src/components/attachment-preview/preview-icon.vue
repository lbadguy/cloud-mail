<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.file" /></svg>
</template>
<script setup>
defineProps({name:String, size:{type:[Number,String],default:18}})
// Bundled icons: opening a preview needs no request to an icon service.
const paths = {
  shield:'M12 3 4.5 6v5.2c0 4.6 3.1 7.8 7.5 9.8 4.4-2 7.5-5.2 7.5-9.8V6L12 3Z M8.5 12l2.3 2.3 4.7-4.8',
  download:'M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4',
  warning:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M12 11v4m0 3v.01',
  sidebar:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM9 3v18',
  previous:'m15 18-6-6 6-6', next:'m9 18 6-6-6-6', minus:'M5 12h14', plus:'M5 12h14M12 5v14',
  fit:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18',
  eye:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  file:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6',
}
</script>
