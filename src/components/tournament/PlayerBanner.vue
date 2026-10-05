<script setup>
// A player's nameplate: who they are across events, not how they are doing in this one.
// Emblem, name, earned title, and medals, in one rectangle that sits in a pairing row.
//
// Everything shown is derived from the records; nothing here can be claimed, which is the only
// thing that makes a title worth carrying. When players can edit their own, the emblem is what
// opens up — the medals never do.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { medalTally, emblemOf, titleKeyOf, GOLD, SILVER, BRONZE } from '../../game/playerBadges'

const props = defineProps({
  record: { type: Object, required: true },
  size: { type: String, default: 'md' }
})

const { t } = useI18n()

const tally = computed(() => medalTally(props.record))
const emblem = computed(() => emblemOf(props.record))
const titleKey = computed(() => titleKeyOf(props.record))

// The plate takes the colour of the best medal its owner holds, so a champion's is
// recognisable down the table without reading it. Everyone else's stays quiet so that works.
const TIER_COLOR = {
  [GOLD]: { base: '#C9971C', deep: '#8A6400', ink: '#FFF8E3' },
  [SILVER]: { base: '#9BA2AE', deep: '#6B7280', ink: '#FBFCFE' },
  [BRONZE]: { base: '#B4794B', deep: '#7D5230', ink: '#FFF4EA' }
}
const NEUTRAL = { base: '#8C8A80', deep: '#5E5C55', ink: '#FAFAF6' }

const color = computed(() => {
  const r = props.record
  if (r[GOLD]) return TIER_COLOR[GOLD]
  if (r[SILVER]) return TIER_COLOR[SILVER]
  if (r[BRONZE]) return TIER_COLOR[BRONZE]
  return NEUTRAL
})

// Drawn rather than set as glyphs: a font may not carry the character, and an emblem that
// renders as a box is worse than no emblem.
const EMBLEM_PATH = {
  bolt: 'M13 2 4 13h5l-1 9 9-11h-5z',
  shield: 'M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5z',
  star: 'm12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z',
  crown: 'M3 7l4 4 5-7 5 7 4-4-2 12H5z',
  wing: 'M2 12c6-7 13-9 20-9-3 7-9 12-16 13l-2 4z',
  flame: 'M12 2c4 5 7 7 7 12a7 7 0 1 1-14 0c0-3 2-5 3-7 1 2 2 3 3 3 0-3 0-5 1-8z',
  wave: 'M2 9c3-3 5-3 8 0s5 3 8 0l4-2v6l-4 2c-3 3-5 3-8 0s-5-3-8 0z',
  leaf: 'M20 3C9 3 3 9 3 17c0 2 1 4 1 4s2-9 10-12c-5 4-7 8-7 12 9 0 13-7 13-18z'
}
</script>

<template>
  <span
    :class="['plate', size]"
    :style="{ '--base': color.base, '--deep': color.deep, '--on': color.ink }"
  >
    <span class="emblem">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="EMBLEM_PATH[emblem]" /></svg>
    </span>

    <span class="body">
      <span class="top">
        <span class="name">{{ record.name }}</span>
        <span v-if="record.code" class="code">{{ record.code }}</span>
      </span>
      <span class="bottom">
        <span v-if="titleKey" class="title">{{ t('tournament.banner.title.' + titleKey) }}</span>
        <span class="meta">{{ t('tournament.banner.events', { n: record.events }) }}</span>
      </span>
    </span>

    <span v-if="tally.length" class="medals">
      <span v-for="m in tally" :key="m.tier" :class="['medal', m.tier]" :title="t('tournament.banner.medal.' + m.tier)">
        <i></i><b v-if="m.n > 1">{{ m.n }}</b>
      </span>
    </span>
  </span>
</template>

<style scoped>
/* One number drives the plate. The emblem block is a square of it, type and medals are
   fractions of it, so resizing is a single edit rather than a sweep. */
.plate {
  --h: 3.75rem;
  display: inline-flex;
  align-items: stretch;
  height: var(--h);
  min-width: 15rem;
  max-width: 100%;
  vertical-align: middle;
  border-radius: 0.375rem;
  overflow: hidden;
  background: var(--card);
  box-shadow: inset 0 0 0 0.0625rem var(--line);
  line-height: 1;
}
.plate.lg { --h: 4.5rem; min-width: 18rem; }

.emblem {
  flex-shrink: 0;
  width: var(--h);
  display: grid;
  place-items: center;
  background: linear-gradient(160deg, var(--base), var(--deep));
}
.emblem svg { width: 48%; height: 48%; fill: var(--on); opacity: 0.94; }

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1875rem;
  /* A hairline in the plate's own colour, tying the field to the emblem block. */
  border-left: 0.1875rem solid var(--base);
  padding: 0.3125rem 0.5rem;
}
.top, .bottom { display: flex; align-items: baseline; gap: 0.3125rem; min-width: 0; }

.name {
  font-size: 1.0625rem;
  font-weight: 900;
  color: var(--ink);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code {
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.title {
  font-size: 0.625rem;
  font-weight: 900;
  color: var(--deep);
  background: color-mix(in srgb, var(--base) 20%, transparent);
  border-radius: 0.1875rem;
  padding: 0.0625rem 0.3125rem;
  white-space: nowrap;
  flex-shrink: 0;
}
.meta {
  font-size: 0.5625rem;
  font-weight: 700;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.medals {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0 0.625rem 0 0.125rem;
}
.medal { display: inline-flex; align-items: center; gap: 0.0625rem; }
/* The disc and the ribbon behind it, big enough here to read as a medal rather than a dot. */
.medal i {
  width: 0.9375rem;
  height: 0.9375rem;
  border-radius: 50%;
  display: block;
  position: relative;
  box-shadow: inset 0 -0.0625rem 0 rgba(0, 0, 0, 0.28);
}
.medal i::before {
  content: "";
  position: absolute;
  left: 50%;
  top: -0.3125rem;
  width: 0.375rem;
  height: 0.375rem;
  transform: translateX(-50%) rotate(45deg);
  background: inherit;
  filter: brightness(0.78);
  border-radius: 0.0625rem;
}
.medal i::after {
  /* Redraws the disc over the ribbon's lower corner, so the ribbon reads as going behind it. */
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: inherit;
}
.medal b {
  font-size: 0.625rem;
  font-weight: 900;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
}
.medal.gold i { background: #C9971C; }
.medal.silver i { background: #9BA2AE; }
.medal.bronze i { background: #B4794B; }
</style>
