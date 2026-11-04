<script setup>
import { ref, computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import { noteLabel, fmtDate } from "../lib/util.js";

const route = useRoute();
const router = useRouter();
const store = useCarnetStore();
const toast = inject("toast");

const fiche = computed(() => store.fiches.find((f) => f.id === route.params.id));
const likers = computed(() => (fiche.value ? fiche.value.reacts : []));
const liked = computed(() => fiche.value && likers.value.includes(store.profil.prenom));
const demandeEnvoyee = computed(() => fiche.value && fiche.value.demandeRecette?.includes(store.profil.prenom));
const edit = ref(false);
const titre = ref("");
const com = ref("");
const confirmSuppr = ref(false);
const pop = ref(false);

function startEdit() {
  titre.value = fiche.value.titre;
  com.value = fiche.value.com || "";
  edit.value = true;
}
async function saveEdit() {
  await store.majFiche(fiche.value.id, { titre: titre.value.trim(), com: com.value.trim() });
  edit.value = false;
  toast("Fiche mise à jour");
}
async function supprimer() {
  await store.supprimerFiche(fiche.value.id);
  toast("Fiche supprimée");
  router.push("/");
}
</script>

<template>
  <div v-if="fiche">
    <div class="flex items-center justify-between mb-4">
      <button class="rounded-full p-2 bg-surface border border-hairline" @click="router.back()">
        <Ic name="back" class="w-4 h-4" />
      </button>
      <div class="flex gap-1.5">
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="startEdit"><Ic name="pencil" class="w-4 h-4" /></button>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="confirmSuppr = true"><Ic name="trash" class="w-4 h-4 text-muted" /></button>
      </div>
    </div>

    <img v-if="fiche.photo" :src="fiche.photo" alt="" class="w-full rounded-2xl mb-3 object-cover max-h-52" />

    <div class="flex items-start justify-between gap-3 mb-1">
      <h1 class="text-xl font-serif leading-tight">{{ fiche.titre }}</h1>
      <span class="shrink-0 text-base font-semibold text-accent">{{ fiche.note }} · <span class="text-xs font-normal text-muted">{{ noteLabel(fiche.note) }}</span></span>
    </div>
    <p class="text-xs text-muted mb-3 flex items-center gap-1">
      <span v-if="fiche.cat" class="rounded-full px-2 py-0.5 bg-soft text-accent text-[10px] font-medium">{{ fiche.cat }}</span>
      <span v-if="fiche.lieu">· {{ fiche.lieu }}</span>
    </p>

    <div v-if="edit" class="space-y-2 mb-4">
      <input v-model="titre" class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none" />
      <textarea v-model="com" rows="3" class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none resize-none"></textarea>
      <div class="flex gap-2">
        <button @click="edit = false" class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-surface border border-hairline">Annuler</button>
        <button @click="saveEdit" class="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-accent">Enregistrer</button>
      </div>
    </div>

    <blockquote v-else-if="fiche.com" class="rounded-xl p-3.5 bg-soft mb-4">
      <p class="text-sm leading-relaxed italic font-serif">« {{ fiche.com }} »</p>
      <p class="text-[11px] text-muted mt-1.5">— {{ fiche.auteur }}{{ fiche.date ? ", " + fmtDate(fiche.date) : "" }}</p>
    </blockquote>

    <!-- Recette -->
    <div v-if="fiche.type === 'recette'">
      <div v-if="fiche.recette" class="rounded-xl p-3.5 bg-surface border border-hairline mb-4">
        <p class="text-[10px] uppercase tracking-widest text-muted mb-1.5">La recette de {{ fiche.auteur }}</p>
        <p class="text-sm leading-relaxed whitespace-pre-line">{{ fiche.recette }}</p>
      </div>
      <button v-else-if="fiche.auteur !== store.profil.prenom && !demandeEnvoyee"
        @click="store.demanderRecette(fiche.id); toast('Demande envoyée à ' + fiche.auteur)"
        class="w-full rounded-xl py-3 text-sm font-semibold text-accent bg-soft mb-4 flex items-center justify-center gap-1.5">
        <Ic name="book" class="w-4 h-4" /> Demander la recette à {{ fiche.auteur }}
      </button>
      <p v-else-if="demandeEnvoyee" class="text-center text-xs text-muted mb-4">Demande envoyée — {{ fiche.auteur }} la partagera bientôt.</p>
      <p v-else class="text-center text-xs text-muted mb-4">Tu n'as pas encore écrit la recette — tu peux l'ajouter en éditant la fiche.</p>
    </div>

    <!-- Likes -->
    <button @click="store.liker(fiche.id, !liked); pop = true"
      class="w-full rounded-xl py-3.5 text-sm font-semibold flex items-center justify-center gap-2 transition"
      :style="{
        background: liked ? 'var(--c-gold)' : 'var(--c-surface)',
        color: liked ? '#fff' : 'var(--c-accent)',
        border: '1.5px solid ' + (liked ? 'var(--c-gold)' : 'var(--c-accent)'),
      }">
      <Ic name="heart" class="w-5 h-5" :filled="liked" />
      {{ liked ? "Tu aimes" : "J'aime" }}{{ likers.length ? " · " + likers.length : "" }}
    </button>
    <p v-if="pop && likers.length" class="text-center text-[11px] text-muted mt-2">
      {{ likers.join(", ") }} {{ likers.length > 1 ? "aiment" : "aime" }} ça
    </p>

    <!-- Popin suppression -->
    <div v-if="confirmSuppr" class="fixed inset-0 z-50 flex items-end justify-center" style="background: rgba(43,35,32,.45)" @click.self="confirmSuppr = false">
      <div class="w-full max-w-sm rounded-t-2xl bg-surface p-5 pb-7">
        <p class="font-serif text-lg mb-1">Supprimer « {{ fiche.titre }} » ?</p>
        <p class="text-xs text-muted mb-4">Ça l'enlève de tous les carnets. Pas de retour arrière.</p>
        <div class="grid grid-cols-2 gap-2">
          <button @click="confirmSuppr = false" class="rounded-xl py-3 text-sm font-semibold border border-hairline">Annuler</button>
          <button @click="supprimer" class="rounded-xl py-3 text-sm font-semibold text-white bg-accent">Supprimer</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="text-center text-sm text-muted py-10">Fiche introuvable.</div>
</template>
