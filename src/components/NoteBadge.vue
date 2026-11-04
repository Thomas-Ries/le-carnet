<script setup>
const props = defineProps({ note: { type: Number, required: true }, big: { type: Boolean, default: false } });
const enAttente = () => !props.note || props.note < 70;
</script>

<template>
  <span class="rounded-full font-semibold"
    :class="big ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs'"
    :style="enAttente()
      ? { background: 'var(--c-surface)', color: 'var(--c-muted)', border: '1px dashed var(--c-hairline)' }
      : { background: note >= 86 ? 'var(--c-riesling)' : 'var(--c-soft)', color: note >= 86 ? '#2B2320' : 'var(--c-accent)' }">
    {{ enAttente() ? "à noter" : note }}
  </span>
</template>
