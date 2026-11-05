<script setup>
import { ref, computed, inject, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { noteLabel, fmtDate, chargerPhoto, partagerFiche } from "../lib/util.js";

const route = useRoute();
const router = useRouter();
const store = useCarnetStore();
const toast = inject("toast");

const fiche = computed(() => store.fiches.find((f) => f.id === route.params.id));
const likers = computed(() => (fiche.value ? fiche.value.reacts || [] : []));
const liked = computed(() => fiche.value && likers.value.includes(store.profil.prenom));
const demandeEnvoyee = computed(() => fiche.value && fiche.value.demandeRecette?.includes(store.profil.prenom));
const edit = ref(false);
const titre = ref("");
const com = ref("");
const photoModif = ref(undefined); // undefined = inchangée, "" = retirée, dataURL = nouvelle

async function onFile(e) {
  const file = e.target.files[0];
  e.target.value = ""; // permet de re-choisir le même fichier après un échec
  if (!file) return;
  try {
    photoModif.value = await chargerPhoto(file);
  } catch (err) {
    toast("Photo illisible — essaie une autre image");
  }
}
const confirmSuppr = ref(false);
/* On y va : pont vers Google Maps (titre + lieu) — la fiche dit quoi et
   pourquoi, Maps dit comment y aller et comment contacter. */
const lienMaps = computed(() =>
  "https://www.google.com/maps/search/?api=1&query=" +
  encodeURIComponent([fiche.value.titre, fiche.value.lieu].filter(Boolean).join(" "))
);
function noterGo() {
  store.noterGo(fiche.value.id);
}
const zoom = ref(false);
const pop = ref(false);
const newCom = ref("");
const editComId = ref(null);
const editComText = ref("");

const comments = computed(() => (fiche.value ? fiche.value.comments || [] : []));
const isAdminIci = computed(() => fiche.value && (fiche.value.carnets || []).some((cid) => store.isAdminCarnet(cid)));
const peutGerer = (c) => isAdminIci.value || c.prenom === store.profil.prenom;

async function envoyerCom() {
  const t = newCom.value.trim();
  if (!t) return;
  const r = await store.ajouterCommentaire(fiche.value.id, t);
  if (r && r.error) { toast(r.error); return; }
  newCom.value = "";
}
function startEditCom(c) { editComId.value = c.id; editComText.value = c.texte; }
async function saveEditCom(c) {
  const t = editComText.value.trim();
  if (!t) return;
  const r = await store.modifierCommentaire(fiche.value.id, c.id, t);
  if (r && r.error) { toast(r.error); return; }
  editComId.value = null;
  toast("Commentaire modifié");
}
async function supprCom(c) {
  const r = await store.supprimerCommentaire(fiche.value.id, c.id);
  if (r && r.error) { toast(r.error); return; }
}
async function partager() {
  toast("Préparation de la carte…");
  const r = await partagerFiche(fiche.value);
  if (r === "telecharge") toast("Image enregistrée — partage-la comme une photo");
}

function startEdit() {
  titre.value = fiche.value.titre;
  com.value = fiche.value.com || "";
  photoModif.value = undefined;
  edit.value = true;
  store.ficheEnEdition = true;
}
function annulerEdit() {
  edit.value = false;
  store.ficheEnEdition = false;
}
onUnmounted(() => { store.ficheEnEdition = false; });
async function saveEdit() {
  const patch = { titre: titre.value.trim(), com: com.value.trim() };
  if (photoModif.value !== undefined) patch.photo = photoModif.value;
  await store.majFiche(fiche.value.id, patch);
  edit.value = false;
  store.ficheEnEdition = false;
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
        <button v-if="!edit" class="rounded-full p-2 bg-surface border border-hairline" @click="partager"><Ic name="share" class="w-4 h-4 text-accent" /></button>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="startEdit"><Ic name="pencil" class="w-4 h-4" /></button>
        <button class="rounded-full p-2 bg-surface border border-hairline" @click="confirmSuppr = true"><Ic name="trash" class="w-4 h-4 text-muted" /></button>
      </div>
    </div>

    <button v-if="fiche.photo" @click="zoom = true" class="block w-full rounded-2xl mb-3 overflow-hidden relative group">
      <img :src="fiche.photo" alt="" class="w-full aspect-[4/3] object-cover" />
      <span class="absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
        style="background: rgba(30, 23, 20, .55)">Agrandir</span>
    </button>

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
      <img v-if="photoModif !== undefined && photoModif" :src="photoModif" alt="" class="w-full rounded-xl max-h-44 object-cover" />
      <div class="flex gap-2">
        <label class="flex-1 rounded-xl py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer text-muted"
          style="border: 1px dashed var(--c-hairline)">
          <Ic name="camera" class="w-4 h-4" />
          {{ photoModif ? "Photo prise — taper pour changer" : fiche.photo ? "Changer la photo" : "Ajouter une photo" }}
          <input type="file" accept="image/*" class="hidden" @change="onFile" />
        </label>
        <button v-if="photoModif" @click="photoModif = undefined"
          class="rounded-xl px-3 text-xs font-semibold text-muted border border-hairline">Annuler</button>
        <button v-else-if="fiche.photo" @click="photoModif = ''"
          class="rounded-xl px-3 text-xs font-semibold text-muted border border-hairline">Retirer</button>
      </div>
      <div class="flex gap-2">
        <button @click="annulerEdit" class="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-surface border border-hairline">Annuler</button>
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

    <!-- Likes + On y va : deux CTA discrets alignés à gauche façon Instagram -->
    <div v-if="!edit" class="flex gap-2">
      <button @click="store.liker(fiche.id, !liked); pop = true"
        class="rounded-full px-4 py-2.5 text-[13px] font-semibold flex items-center gap-1.5 transition"
        :style="liked
          ? { background: 'var(--c-gold)', color: '#fff', border: '1px solid var(--c-gold)' }
          : { color: 'var(--c-accent)', background: 'var(--c-soft)', border: '1px solid var(--c-hairline)' }">
        <Ic name="heart" class="w-4 h-4" :filled="liked" />
        {{ liked ? "Tu aimes" : "J'aime" }}{{ likers.length ? " · " + likers.length : "" }}
      </button>
      <a v-if="fiche.type !== 'recette'" :href="lienMaps" target="_blank" rel="noopener"
        @click="noterGo"
        class="rounded-full px-4 py-2.5 text-[13px] font-semibold flex items-center gap-1.5 transition"
        :style="{ color: 'var(--c-accent)', background: 'var(--c-soft)', border: '1px solid var(--c-hairline)' }">
        <Ic name="pin" class="w-4 h-4" /> On y va
      </a>
    </div>
    <p v-if="!edit && pop && likers.length" class="text-center text-[11px] text-muted mt-2">
      {{ likers.join(", ") }} {{ likers.length > 1 ? "aiment" : "aime" }} ça
    </p>

    <!-- Commentaires -->
    <div v-if="!edit" class="mt-5">
      <p v-if="comments.length" class="text-[10px] uppercase tracking-widest text-muted mb-2">Commentaires</p>
      <div v-for="c in comments" :key="c.id" class="rounded-xl p-3 bg-soft mb-2">
        <div v-if="editComId === c.id">
          <textarea v-model="editComText" rows="2" class="w-full rounded-xl px-3 py-2 text-sm bg-surface border border-hairline outline-none resize-none"></textarea>
          <div class="flex gap-2 mt-2">
            <button @click="editComId = null" class="flex-1 rounded-lg py-2 text-xs font-semibold bg-surface border border-hairline">Annuler</button>
            <button @click="saveEditCom(c)" class="flex-1 rounded-lg py-2 text-xs font-semibold text-white bg-accent">Enregistrer</button>
          </div>
        </div>
        <div v-else>
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm leading-relaxed">{{ c.texte }}</p>
            <span v-if="peutGerer(c)" class="flex gap-1.5 shrink-0">
              <button @click="startEditCom(c)"><Ic name="pencil" class="w-3.5 h-3.5 text-muted" /></button>
              <button @click="supprCom(c)"><Ic name="trash" class="w-3.5 h-3.5 text-muted" /></button>
            </span>
          </div>
          <p class="text-[11px] text-muted mt-1">{{ c.prenom }}{{ c.date ? " · " + fmtDate(c.date) : "" }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <input v-model="newCom" placeholder="Commentaire" @keyup.enter="envoyerCom"
          class="flex-1 rounded-xl px-3 py-2.5 text-sm bg-surface border border-hairline outline-none" />
        <button @click="envoyerCom" class="rounded-xl px-3.5 bg-soft border border-hairline">
          <Ic name="chevron" class="w-4 h-4 text-accent" />
        </button>
      </div>
    </div>

    <!-- Visionneuse plein écran : tap sur la photo -->
    <div v-if="zoom" @click="zoom = false"
      class="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style="background: rgba(20, 14, 12, .94)">
      <img :src="fiche.photo" alt="" class="max-w-full max-h-full object-contain rounded-xl" @click.stop />
    </div>

    <ConfirmModal :open="confirmSuppr"
      :title="'Supprimer « ' + fiche.titre + ' » ?'"
      text="Ça l'enlève de tous les carnets. Pas de retour arrière."
      @confirm="supprimer" @cancel="confirmSuppr = false" />
  </div>
  <div v-else class="text-center text-sm text-muted py-10">Fiche introuvable.</div>
</template>