// Notices are keyed by kind, and a second one of the same kind keeps the bigger count rather
// than queueing twice: two sources of "reroll a die" is still one reroll step, just a longer
// one. Returns a new array so the reactive proxies in both battle hosts see the change.
function withNotice(current, notice) {
  const existing = (current || []).find(n => n.kind === notice.kind)
  const out = (current || []).filter(n => n.kind !== notice.kind)
  out.push(existing && existing.n > notice.n ? existing : notice)
  return out
}

import { STEP, plantMod } from './turnMods'

export function pushDiceModBadge(player, name, type) {
  if (!player.diceModBadges) player.diceModBadges = []
  if (player.diceModBadges.some(b => b.name === name)) return
  player.diceModBadges.push({ name, type })
}

// Whether a character-die effect row is still reachable while `fix` is in force.
//
// `fix.value === 1` pins the die TO the listed orientations, so a row is available only if it
// covers at least one of them; any other value bars those orientations instead, leaving a row
// available as long as it has some orientation outside the barred set.
export function charaDiceOrientationAllowed(ceOrientations, fix) {
  if (!fix) return true
  const inFix = o => fix.orientations.includes(o)
  if (fix.value === 1) return ceOrientations.some(inFix)
  return ceOrientations.some(o => !inFix(o))
}

// The last effect type that reached the default branch — i.e. that no handler claimed. Read
// straight after a run to tell "no handler exists" apart from "a handler ran but its condition
// was false", which is what makes `isEffectTypeHandled` below exact rather than heuristic.
let lastUnhandledType = null

// Generic resolver for a move's effect + character-die effect queue. Shared between
// the 2P duel and the solo run mode: both build a `ctx` ({moverKey?, mover, oppKey?, opp, mv,
// dmgToOpp, dmgToSelf}) and a `hooks` object that knows how to surface the handful of
// effect types that need extra player input (dice prompts, move-binding picks, etc.) in
// that mode's own UI/state.
/**
 * Run the queue from wherever it is, stopping the moment something needs asking.
 *
 * `ctx` carries its own position (`cursor`) and its own accumulators, so this is resumable by
 * construction: hand it the same ctx and the answer, and it picks up exactly where it stopped.
 * There is no closure anywhere in the chain, which is what makes a mid-battle reload
 * survivable — the caller can serialise ctx, and rebuilding it is enough to continue.
 *
 * (It used to be `runEffectQueue(queue, idx, ctx, hooks, done)`, where `next` closed over the
 * position and `done` over what came after. Both lived only on the heap of whoever happened to
 * be running the turn, so a refresh lost them and the battle could not be resumed — the state
 * knew it was waiting for an answer but nothing knew what to do with one.)
 *
 * @param {object} ctx     { queue, cursor, mover, opp, mv, dmgToOpp, dmgToSelf, ... }
 * @param {*} [answer]     the answer to the request this last returned, if any
 * @returns {object|null}  the next request, or null when the whole queue is done
 */
export function advanceEffectQueue(ctx, answer) {
  while (ctx.cursor < ctx.queue.length) {
    const ask = applyOneEffect(ctx.queue[ctx.cursor], ctx, answer)
    // An answer belongs to exactly one effect; the next one starts fresh.
    answer = undefined
    if (ask) return ask
    ctx.cursor += 1
  }
  return null
}

/**
 * Apply one effect, or say what it needs to know first.
 *
 * Called at most twice per effect: once with `answer === undefined`, which either resolves it
 * outright (returns null) or returns a request for the one thing only a player can supply;
 * then once more with that answer, which resolves it (returns null).
 *
 * Nothing here holds a continuation. That is the whole point — see advanceEffectQueue.
 *
 * @returns {object|null} a request to put to a player, or null when the effect is finished
 */
function applyOneEffect(eff, ctx, answer) {

  const enemyDiceMatch = /^DAMAGE_BY_ENEMY_(\d+)DICE$/.exec(eff.type)
  if (enemyDiceMatch) {
    const n = parseInt(enemyDiceMatch[1], 10)
    if (answer === undefined) return { kind: 'diceNumber', max: n * 2, multiplier: eff.value }
    ctx.dmgToOpp += answer * eff.value
    return null
  }
  // サンダー「ダブルサンダー」/ ゲッコウガ「みずしゅりけん」: the move throws the character
  // die a fixed number of times in total and pays per hit.
  //
  // Asked one throw at a time, not as a single "how many hit?" count. At a table the player
  // throws, looks, throws again — batching it into one number asks them to do the bookkeeping
  // the app is for, and it also hid an off-by-one: the throw that made this row selectable in
  // the first place already happened and already hit, so only n-1 remain. The old prompt
  // offered 0..n and let that first hit be counted twice or not at all.
  const charaDiceMatch = /^DAMAGE_EXTRA_(\d+)CHARADICE$/.exec(eff.type)
  if (charaDiceMatch) {
    const total = parseInt(charaDiceMatch[1], 10)
    const st = ctx.multi || (ctx.multi = { thrown: 1, hits: 1 })
    if (answer !== undefined) {
      st.thrown += 1
      if (answer) st.hits += 1
    }
    if (st.thrown < total) {
      return {
        kind: 'charaDiceStep',
        index: st.thrown + 1,
        total,
        hits: st.hits,
        orientations: (ctx.ce && ctx.ce.orientations) || [],
        effectValue: eff.value
      }
    }
    ctx.dmgToOpp += st.hits * eff.value
    ctx.multi = null
    return null
  }
  const hpLowMatch = /^DAMAGE_EXTRA_(\d+)HP_LOW$/.exec(eff.type)
  if (hpLowMatch) {
    const n = parseInt(hpLowMatch[1], 10)
    if (ctx.mover.hp <= n) ctx.dmgToOpp += eff.value
    return null
  }
  // Same HP gate as above, but granting damage reduction instead of extra damage. It needs its
  // own arm rather than riding on `case "MOD_REDUCE_TAKEN"`: that case matches the whole string,
  // so the `_80HP_LOW` suffix fell through to default and the effect was silently dropped.
  const reduceTakenHpLowMatch = /^MOD_REDUCE_TAKEN_(\d+)HP_LOW$/.exec(eff.type)
  if (reduceTakenHpLowMatch) {
    const n = parseInt(reduceTakenHpLowMatch[1], 10)
    if (ctx.mover.hp <= n) {
      plantMod(ctx.mover, { step: STEP.DAMAGE, kind: 'damageDelta', delta: eff.value, from: ctx.mv.name })
    }
    return null
  }
  const charaDiceEnemyMatch = /^DAMAGE_EXTRA_CHARADICE_ENEMY_(.+)$/.exec(eff.type)
  if (charaDiceEnemyMatch) {
    const orientations = charaDiceEnemyMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    if (answer === undefined) return { kind: 'charaDiceEnemyManual', orientations, effectValue: eff.value }
    if (answer) ctx.dmgToOpp += eff.value
    return null
  }
  // The opponent rolls their character die n times and every hit on one of the listed
  // orientations adds damage. Distinct from DAMAGE_EXTRA_CHARADICE_ENEMY_ above, which is a
  // single roll answered yes/no — here the answer is a count, so it needs its own prompt.
  const charaDiceComboEnemyMatch = /^DAMAGE_EXTRA_CHARADICE_(\d+)COMBO_ENEMY_(.+)$/.exec(eff.type)
  if (charaDiceComboEnemyMatch) {
    const n = parseInt(charaDiceComboEnemyMatch[1], 10)
    const orientations = charaDiceComboEnemyMatch[2].split(',').map(s => s.trim()).filter(s => s !== "")
    // One throw at a time, same as the self version above. No head start here: none of these
    // throws has happened yet, because it is the opponent's die.
    const st = ctx.multi || (ctx.multi = { thrown: 0, hits: 0 })
    if (answer !== undefined) {
      st.thrown += 1
      if (answer) st.hits += 1
    }
    if (st.thrown < n) {
      return {
        kind: 'charaDiceStep',
        index: st.thrown + 1,
        total: n,
        hits: st.hits,
        orientations,
        effectValue: eff.value,
        enemy: true
      }
    }
    ctx.dmgToOpp += st.hits * eff.value
    ctx.multi = null
    return null
  }
  // Like FIX_CHARADICE_SELF_ below, except the player chooses which of the listed orientations
  // to pin to — it's whichever one this move's own character die actually landed on, which only
  // the player at the table can see.
  const fixCharaSelectSelfMatch = /^FIX_CHARADICE_SELECT_SELF_(.+)$/.exec(eff.type)
  if (fixCharaSelectSelfMatch) {
    const orientations = fixCharaSelectSelfMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    if (answer === undefined) return { kind: 'charaDiceSelect', orientations, effectValue: eff.value, target: 'self' }
    ctx.mover.fixCharaDice = { value: eff.value, orientations: [answer] }
    pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
    return null
  }
  // Same, aimed at the opponent. Unused by the current roster, present so the pair stays whole.
  const fixCharaSelectEnemyMatch = /^FIX_CHARADICE_SELECT_ENEMY_(.+)$/.exec(eff.type)
  if (fixCharaSelectEnemyMatch) {
    const orientations = fixCharaSelectEnemyMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    if (answer === undefined) return { kind: 'charaDiceSelect', orientations, effectValue: eff.value, target: 'enemy' }
    ctx.opp.fixCharaDice = { value: eff.value, orientations: [answer] }
    pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
    return null
  }
  // Bonus damage conditional on the opponent's own species type (not their move's type) —
  // e.g. ムーンフォース's "opponent is Dragon-type" clause. The condition is knowable the
  // instant a move is cast (ctx.opp.character is already picked), unlike the die-based
  // effects above, so it needs no prompt and resolves inline.
  const vsTypeMatch = /^DAMAGE_EXTRA_VS_TYPE_(.+)$/.exec(eff.type)
  if (vsTypeMatch) {
    if (ctx.opp.character && ctx.opp.character.type === vsTypeMatch[1]) {
      ctx.dmgToOpp += eff.value
    }
    return null
  }

  // Pins a player's character die for their next turn: rows whose orientations fall outside the
  // fixed set become unselectable (see charaDiceOrientationAllowed). Mirrors `charaDiceBlocked`
  // in lifecycle — set here, consumed next turn, cleared when that turn resolves.
  // `DAMAGE_EXTRA_ENE_<energy>` — counts a named energy instead of the move's own type.
  // EBW02-049 ドラゴンバースト is a Fire-cost Dragon move that counts Lightning, which is what
  // this exists for; the bare `DAMAGE_EXTRA_ENE` below still means "this move's type".
  const eneTypedMatch = /^DAMAGE_EXTRA_ENE_(.+)$/.exec(eff.type)
  if (eneTypedMatch) {
    const countedType = eneTypedMatch[1]
    if (answer === undefined) return { kind: 'eneCount', effectValue: eff.value, countedType }
    ctx.dmgToOpp += answer * eff.value
    return null
  }

  // チルタリス「ふわふわひこう」: next opponent turn, if THEIR character die comes up on one
  // of these faces, this move's damage does not land (other effects still do).
  //
  // The long-standing blocker (TODO.md) was that the engine only learns the die's face when
  // it happens to match the current move's own conditions. That assumed the app rolls the
  // die — it does not: hotseat and solo are played with real dice and the app asks what came
  // up (the 3D canvas is online-only). So the shield is armed here and the question is put
  // to the attacker on their turn, which is one prompt of a shape that already exists.
  const nullifyIfEnemyChara = /^MOD_NULLIFY_TAKEN_IF_ENEMY_CHARADICE_(.+)$/.exec(eff.type)
  if (nullifyIfEnemyChara) {
    plantMod(ctx.mover, {
      step: STEP.DAMAGE,
      kind: 'nullifyIfCharaDice',
      orientations: nullifyIfEnemyChara[1].split(',').map(x => x.trim()).filter(Boolean),
      from: ctx.mv.name
    })
    return null
  }

  const fixCharaDiceEnemyMatch = /^FIX_CHARADICE_ENEMY_(.+)$/.exec(eff.type)
  if (fixCharaDiceEnemyMatch) {
    const orientations = fixCharaDiceEnemyMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    ctx.opp.fixCharaDice = { value: eff.value, orientations }
    pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
    return null
  }
  // No move uses this yet, but it's the self-targeting half of the pair above — handled now so a
  // future roster addition doesn't repeat the silent-drop bug.
  const fixCharaDiceSelfMatch = /^FIX_CHARADICE_SELF_(.+)$/.exec(eff.type)
  if (fixCharaDiceSelfMatch) {
    const orientations = fixCharaDiceSelfMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    ctx.mover.fixCharaDice = { value: eff.value, orientations }
    pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
    return null
  }

  switch (eff.type) {
    case "DAMAGE_EXTRA":
      ctx.dmgToOpp += eff.value
      return null
    case "SPECIAL_IGNORE_WEAKNESS":
      return null
    case "MOD_REDUCE_TAKEN":
      plantMod(ctx.mover, { step: STEP.DAMAGE, kind: 'damageDelta', delta: eff.value, from: ctx.mv.name })
      return null
    case "MOD_NULLIFY_TAKEN":
      plantMod(ctx.mover, { step: STEP.DAMAGE, kind: 'damageSetTo', value: eff.value, from: ctx.mv.name })
      return null
    // The conditional cousin: nothing is blocked unless the hit is small enough. Cleared the
    // same turn the unconditional one is (see the two battle hosts).
    case "NULLIFY_TAKEN_LE":
      plantMod(ctx.mover, { step: STEP.DAMAGE, kind: 'nullifyAtMost', value: eff.value, from: ctx.mv.name })
      return null
    // "If this Pokemon took no move damage on the previous opponent turn." Reads the flag the
    // hosts commit at end of turn, the same way DAMAGE_EXTRA_DICE_SUCCESS_SELF_* reads
    // committedLastMoveFailed.
    case "DAMAGE_EXTRA_IF_UNHURT":
      if (!ctx.mover.committedTookDamage) ctx.dmgToOpp += eff.value
      return null
    case "DAMAGE_SELF":
      ctx.dmgToSelf += eff.value
      return null
    // Healing is negative self-damage. Both battle hosts already apply `dmgToSelf` with
    // `Math.min(hp - dmgToSelf, maxHp)` on the negative side, so the cap at full HP and the
    // damage animation come for free — there is no second path to keep in step.
    case "HEAL_SELF":
      ctx.dmgToSelf -= eff.value
      return null
    case "HEAL_SELF_FULL":
      ctx.dmgToSelf -= Math.max(0, (ctx.mover.maxHp || 0) - ctx.mover.hp)
      return null
    case "MOD_DICE_ENEMY":
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      return null
    case "MOD_CHARADICE_ENEMY":
      ctx.opp.charaDiceBlocked = true
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      return null
    case "MOD_DICE-CHARADICE_ENEMY":
      ctx.opp.charaDiceBlocked = true
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      return null
    case "SPECIAL_REPEAT":
      ctx.repeatValue = eff.value
      return null
    case "MOD_DICE_SELF":
      ctx.mover.diceMod = (ctx.mover.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
      return null
    case "DAMAGE_MULTIPLY":
      ctx.dmgToOpp = ctx.dmgToOpp * eff.value
      return null
    case "DAMAGE_COPY_LAST":
      return null
    case "DAMAGE_EXTRA_CHARADICE_REPEAT":
      // サンダー「サンダーチェイン」: keeps throwing until one misses, so the end is the
      // answer rather than a count known up front.
      {
        const st = ctx.multi || (ctx.multi = { thrown: 0, hits: 0, open: true })
        if (answer !== undefined) {
          st.thrown += 1
          if (answer) st.hits += 1
          else st.open = false
        }
        if (st.open) {
          return {
            kind: 'charaDiceStep',
            index: st.thrown + 1,
            total: null,
            hits: st.hits,
            orientations: (ctx.ce && ctx.ce.orientations) || [],
            effectValue: eff.value
          }
        }
        ctx.dmgToOpp += st.hits * eff.value
        ctx.multi = null
        return null
      }
    // --- effects the app records but cannot carry out for you -------------------------
    //
    // Hotseat and solo are played with real dice: the app records which face came up, it does
    // not throw anything (the 3D canvas is online-only — see DiceOverlay's `needsThrow`). So
    // "reroll a die" and "swap your chips" are things the players do at the table, and the
    // honest implementation is to make sure the right person is told at the right moment
    // rather than to pretend to simulate it.
    //
    // Each of these parks a notice on whoever it applies to, consumed on their next turn.
    case "REROLL_CHARADICE_SELF":
      // Value is how many rerolls, not a damage figure: チャンスタックル grants one on its
      // own and upgrades to two when the character die cooperates, so they do not stack —
      // the larger wins.
      ctx.mover.pendingNotices = withNotice(ctx.mover.pendingNotices, {
        kind: 'rerollCharaSelf', n: eff.value, from: ctx.mv.name
      })
      return null
    case "REROLL_DICE_ENEMY":
      // Both: the flag drives the real picker when the app owns the dice, and the notice is
      // what tells two people sharing one device that it is about to ask.
      ctx.opp.pendingDiceReroll = { n: eff.value, from: ctx.mv.name }
      ctx.opp.pendingNotices = withNotice(ctx.opp.pendingNotices, {
        kind: 'rerollDiceEnemy', n: eff.value, from: ctx.mv.name
      })
      return null
    case "SPECIAL_PICK_ENEMY_WAZA":
      // The one of the four the app can actually enforce: it owns the move-select screen.
      ctx.opp.moveChosenByOpponent = true
      ctx.opp.pendingNotices = withNotice(ctx.opp.pendingNotices, {
        kind: 'pickEnemyWaza', n: 1, from: ctx.mv.name
      })
      return null
    case "SPECIAL_SWAP_CHIP":
      ctx.mover.pendingNotices = withNotice(ctx.mover.pendingNotices, {
        kind: 'swapChip', n: eff.value, from: ctx.mv.name
      })
      return null
    case "SPECIAL_BIND_WAZA":
      if (answer === undefined) return { kind: 'bindWaza', targetKey: ctx.oppKey, count: eff.value }
      ctx.opp.bannedMoveIds = answer
      ctx.opp.bannedMoveSourceName = ctx.mv.name
      return null
    case "DAMAGE_EXTRA_ENE":
      // Bare form: counts the move's own type. Every card did until EBW02-049 — see the
      // suffixed branch above.
      if (answer === undefined) return { kind: 'eneCount', effectValue: eff.value, countedType: ctx.mv.type }
      ctx.dmgToOpp += answer * eff.value
      return null
    case "MOD_DICE_STEAL":
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) - eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      ctx.mover.diceMod = (ctx.mover.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
      return null
    case "DAMAGE_EXTRA_DICE_MISS_ENEMY":
      if (ctx.opp.committedLastMoveFailed) ctx.dmgToOpp += eff.value
      return null
    case "DAMAGE_EXTRA_DICE_MISS_SELF":
      if (ctx.mover.committedLastMoveFailed) ctx.dmgToOpp += eff.value
      return null
    default: {
      const successSelfDmgMatch = /^DAMAGE_EXTRA_DICE_SUCCESS_SELF_(.+)$/.exec(eff.type)
      if (successSelfDmgMatch) {
        const wazaId = successSelfDmgMatch[1]
        if (ctx.mover.committedLastMoveId !== null && String(ctx.mover.committedLastMoveId) === String(wazaId) && !ctx.mover.committedLastMoveFailed) {
          ctx.dmgToOpp += eff.value
        }
        return null
      }
      const successSelfSelfMatch = /^DAMAGE_SELF_DICE_SUCCESS_SELF_(.+)$/.exec(eff.type)
      if (successSelfSelfMatch) {
        const wazaId = successSelfSelfMatch[1]
        if (ctx.mover.committedLastMoveId !== null && String(ctx.mover.committedLastMoveId) === String(wazaId) && !ctx.mover.committedLastMoveFailed) {
          ctx.dmgToSelf += eff.value
        }
        return null
      }
      // Nothing claimed this type. The move still lands and deals its damage, so an unhandled
      // effect is invisible in play — which is how four of the 07-09 effects shipped doing
      // nothing at all. Record it so checkEffectCoverage can report it up front, and say so in
      // dev rather than letting it pass in silence.
      lastUnhandledType = eff.type
      if (import.meta.env?.DEV) {
        console.warn(`[effectQueue] 未實作的效果類型「${eff.type}」，此招的附加效果不會發生`)
      }
      return null
    }
  }
}

// Whether any handler claims `type`, decided by actually running the dispatcher and seeing
// whether it reached the default branch. Running it is what makes this exact: a static list of
// patterns kept alongside the dispatch would drift from it, and probing for an observable change
// instead would report a handler whose condition happened to be false as missing.
export function isEffectTypeHandled(type) {
  const probeCtx = {
    moverKey: 'a', oppKey: 'b',
    mover: { hp: 0, diceModBadges: [], moves: [] },
    opp: { hp: 0, diceModBadges: [], moves: [] },
    mv: { name: '', type: '', baseDamage: 0 },
    dmgToOpp: 0, dmgToSelf: 0
  }
  probeCtx.queue = [{ type, value: 0 }]
  probeCtx.cursor = 0
  lastUnhandledType = null
  try {
    // One step only. An effect that stops to ask has already proved it is claimed, and
    // answering it here would serve no purpose.
    advanceEffectQueue(probeCtx)
  } catch {
    // A handler that threw on the stub context is still a handler.
    return true
  }
  return lastUnhandledType !== type
}
