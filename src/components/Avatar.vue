<script setup>
defineProps({ prenom: { type: String, required: true }, size: { type: Number, default: 32 }, src: { type: String, default: null } });
</script>

<template>
  <div class="rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-riesling/50 text-accent font-semibold"
    :style="{ width: size + 'px', height: size + 'px', fontSize: size * 0.42 + 'px' }">
    <img v-if="src" :src="src" :alt="prenom" class="w-full h-full object-cover" />
    <template v-else>{{ prenom[0] }}</template>
  </div>
</template>
