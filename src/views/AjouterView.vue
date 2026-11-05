<script setup>
import { t } from "../lib/i18n.js";
// Noter : 3 champs + note 70-100 + carnet(s) au choix. Sous 10 secondes.
import { ref, computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCarnetStore } from "../stores/carnet.js";
import Ic from "../components/Ic.vue";
import { noteLabel, CATS, chargerPhoto } from "../lib/util.js";

const store = useCarnetStore();
const route = useRoute();
const router = useRouter();
const toast = inject("toast");

const type = ref(route.query.type === "recette" ? "recette" : "adresse");
const titre = ref("");
const lieu = ref("");
const com = ref("");
const note = ref(80);
// Plusieurs themes possibles pour une meme adresse (ex. un caviste qui fait bar a vin).
// Au moins un requis : retirer le dernier est refuse.
const selCats = ref(["Resto"]);
function toggleCat(c) {
  if (selCats.value.includes(c)) {
    if (selCats.value.length > 1) selCats.value = selCats.value.filter((x) => x !== c);
  } else {
    selCats.value = [...selCats.value, c];
  }
}
const photo = ref(null);
const sel = ref([store.carnetId]);
const recette = ref("");

const cats = computed(() => (type.value === "recette" ? ["Recette"] : CATS));

/* Anti-doublon : pendant la saisie du titre, on cherche les fiches du meme type
   deja notees dans le(s) carnet(s) vise(s) dont le titre ressemble (normalise :
   minuscules, sans accents ni ponctuation, inclusion dans un sens ou l'autre). */
const normTitre = (t) => {
  let s = (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").trim().replace(/\s+/g, " ");
  let m;
  while ((m = /^(le|la|les|l|the|du|de|des|d|au|aux|a|chez) /.exec(s))) s = s.slice(m[0].length);
  return s.replace(/\s+/g, "");
};
const doublons = computed(() => {
  const q = normTitre(titre.value);
  if (q.length < 4) return [];
  return store.fiches
    .filter((f) => f.type === type.value && f.carnets.some((cid) => sel.value.includes(cid)))
    .filter((f) => {
      const n = normTitre(f.titre);
      return n.length >= 4 && (n === q || n.includes(q) || q.includes(n));
    })
    .slice(0, 2);
});

function toggle(id) {
  sel.value = sel.value.includes(id)
    ? (sel.value.length > 1 ? sel.value.filter((x) => x !== id) : sel.value)
    : [...sel.value, id];
}

const photoErr = ref(false);
async function onFile(e) {
  const file = e.target.files[0];
  e.target.value = ""; // permet de re-choisir le même fichier après un échec
  if (!file) return;
  photoErr.value = false;
  try {
    photo.value = await chargerPhoto(file);
  } catch (err) {
    photoErr.value = true;
    toast(t("Photo illisible — essaie une autre image"));
  }
}

const doublonErr = ref("");
async function valider() {
  if (!titre.value.trim()) return;
  doublonErr.value = "";
  const r = await store.noter({
    carnets: sel.value,
    type: type.value,
    cat: type.value === "recette" ? "Recette" : selCats.value.join(", "),
    titre: titre.value.trim(),
    lieu: type.value === "adresse" ? lieu.value.trim() : "",
    note: note.value,
    com: com.value.trim(),
    photo: photo.value,
    recette: type.value === "recette" && recette.value.trim() ? recette.value.trim() : null,
  });
  if (r && r.error === "fiche_doublon") {
    doublonErr.value = "« " + r.titre + " » est déjà noté dans ce carnet — c'est probablement le même lieu. Ouvre la fiche existante ci-dessus, ou précise le titre (ville, quartier) pour le distinguer.";
    return;
  }
  if (r && r.error) {
    toast("Impossible de noter : " + r.error);
    return;
  }
  toast("Noté dans " + (sel.value.length > 1 ? sel.value.length + " carnets" : store.carnets.find((c) => c.id === sel.value[0]).nom));
  router.push("/");
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <button class="rounded-full p-2 bg-surface border border-hairline" @click="router.push('/')">
        <Ic name="back" class="w-4 h-4" />
      </button>
      <p class="text-sm text-muted">{{ t("Hier soir ou ce matin — quand tu y penses") }}</p>
      <div class="w-9" />
    </div>

    
    <div class="rounded-xl p-3.5 mb-3 bg-soft">
      <p class="text-[10px] uppercase tracking-widest text-muted mb-2">{{ t("Pour quel(s) carnet(s) ? — plusieurs choix possibles") }}</p>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="c in store.carnets" :key="c.id" @click="toggle(c.id)"
          class="rounded-full px-3 py-1.5 text-xs font-medium flex items-center gap-1"
          :style="{
            background: sel.includes(c.id) ? '#7A2E3E' : 'var(--c-surface)',
            color: sel.includes(c.id) ? '#fff' : 'var(--c-muted)',
            border: '1px solid ' + (sel.includes(c.id) ? '#7A2E3E' : 'var(--c-hairline)'),
          }">
          <Ic v-if="sel.includes(c.id)" name="check" class="w-3 h-3" :sw="2.4" /> {{ c.nom }}
        </button>
      </div>
    </div>

    
    <div class="grid grid-cols-2 gap-2 mb-4">
      <button v-for="t in [['adresse','Adresse','pin'],['recette','Recette','book']]" :key="t[0]"
        @click="type = t[0]"
        class="rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5"
        :style="{
          background: type === t[0] ? '#7A2E3E' : 'var(--c-surface)',
          color: type === t[0] ? '#fff' : 'var(--c-ink)',
          border: '1px solid ' + (type === t[0] ? '#7A2E3E' : 'var(--c-hairline)'),
        }">
        <Ic :name="t[2]" class="w-4 h-4" /> {{ t[1] }}
      </button>
    </div>

    
    <div v-if="type === 'adresse'" class="flex flex-wrap gap-1.5 mb-3">
      <button v-for="c in cats" :key="c" @click="toggleCat(c)"
        class="rounded-full px-2.5 py-1.5 text-xs font-medium"
        :style="{
          background: selCats.includes(c) ? 'var(--c-soft)' : 'var(--c-surface)',
          color: selCats.includes(c) ? 'var(--c-accent)' : 'var(--c-muted)',
          border: '1px solid ' + (selCats.includes(c) ? 'var(--c-accent)' : 'var(--c-hairline)'),
        }">{{ c }}</button>
    </div>

    <div class="space-y-2.5">
      <input v-model="titre" :placeholder="type === 'adresse' ? 'Nom du lieu…' : 'Nom du plat…'"
        class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none" />
      
      <button v-for="d in doublons" :key="d.id" @click="router.push('/fiche/' + d.id)"
        class="w-full rounded-xl px-3 py-2.5 text-left bg-soft border border-hairline">
        <p class="text-xs font-semibold text-accent">{{ t("Déjà noté par") }} {{ d.auteur }}<template v-if="d.note"> — {{ d.note }}/100</template></p>
        <p class="text-[10px] text-muted mt-0.5 leading-snug">« {{ d.titre }} » — tape pour le voir au lieu d'en recréer une fiche</p>
      </button>
      <input v-if="type === 'adresse'" v-model="lieu" :placeholder="t('Ville, quartier…')"
        class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none" />
      <textarea v-model="com" rows="2" placeholder="« Punaise, c'était bon » — ton commentaire…"
        class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none resize-none"></textarea>
      <textarea v-if="type === 'recette'" v-model="recette" rows="3" :placeholder="t('La recette, si tu veux la partager tout de suite (optionnel)…')"
        class="w-full rounded-xl px-3 py-3 text-sm bg-surface border border-hairline outline-none resize-none"></textarea>

      
      <div class="rounded-xl p-4 bg-surface border border-hairline">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs uppercase tracking-widest text-muted">{{ t("Ta note") }}</span>
          <span class="text-sm font-semibold text-accent">{{ note }} · {{ noteLabel(note) }}</span>
        </div>
        <input type="range" min="70" max="100" v-model.number="note" class="w-full accent-[#7A2E3E]" />
        <div class="flex justify-between text-[10px] text-muted mt-1"><span>70</span><span>85</span><span>100</span></div>
      </div>

      
      <div v-if="photo" class="relative rounded-2xl overflow-hidden mb-2">
        <img :src="photo" alt="" class="w-full aspect-[4/3] object-cover" />
        <button @click="photo = null; photoErr = false"
          class="absolute top-2 right-2 rounded-full p-2 bg-surface border border-hairline">
          <Ic name="trash" class="w-4 h-4 text-muted" />
        </button>
      </div>
      <label class="w-full rounded-xl py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer bg-gold/10 text-muted"
        :style="{ border: photoErr ? '1px dashed var(--c-accent)' : '1px dashed var(--c-hairline)' }">
        <Ic name="camera" class="w-4 h-4" />
        {{ photo ? "Photo prise — taper pour changer" : "Photo (optionnelle)" }}
        <input type="file" accept="image/*" class="hidden" @change="onFile" />
      </label>
    </div>

    <p v-if="doublonErr" class="text-xs text-accent leading-relaxed mt-2">{{ doublonErr }}</p>
    <button @click="valider" :disabled="!titre.trim()"
      class="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white active:scale-[.99] transition"
      :style="{ background: titre.trim() ? '#7A2E3E' : 'rgba(122,46,62,.3)' }">
      Noter « {{ titre.trim() || "…" }} » dans {{ sel.length > 1 ? sel.length + " carnets" : store.carnets.find((c) => c.id === sel[0])?.nom }}
    </button>
    <p class="text-center text-[11px] text-muted mt-2">{{ t("3 champs, une note, les carnets. Sous 10 secondes.") }}</p>
  </div>
</template>
