export function pushDiceModBadge(player, name, type) {
  if (!player.diceModBadges) player.diceModBadges = []
  if (player.diceModBadges.some(b => b.name === name)) return
  player.diceModBadges.push({ name, type })
}

// Generic resolver for a move's effect + character-die effect queue. Shared between
// the 2P duel and the solo run mode: both build a `ctx` ({moverKey?, mover, oppKey?, opp, mv,
// dmgToOpp, dmgToSelf}) and a `hooks` object that knows how to surface the handful of
// effect types that need extra player input (dice prompts, move-binding picks, etc.) in
// that mode's own UI/state.
export function runEffectQueue(queue, idx, ctx, hooks, done) {
  if (idx >= queue.length) {
    done()
    return
  }
  const eff = queue[idx]
  const next = () => runEffectQueue(queue, idx + 1, ctx, hooks, done)

  const enemyDiceMatch = /^DAMAGE_BY_ENEMY_(\d+)DICE$/.exec(eff.type)
  if (enemyDiceMatch) {
    const n = parseInt(enemyDiceMatch[1], 10)
    hooks.showDicePrompt(n * 2, eff.value, num => {
      ctx.dmgToOpp += num * eff.value
      next()
    })
    return
  }
  const charaDiceMatch = /^DAMAGE_EXTRA_(\d+)CHARADICE$/.exec(eff.type)
  if (charaDiceMatch) {
    const n = parseInt(charaDiceMatch[1], 10)
    hooks.showCharaDiceCountPrompt(n, eff.value, ctx, successCount => {
      ctx.dmgToOpp += successCount * eff.value
      next()
    })
    return
  }
  const hpLowMatch = /^DAMAGE_EXTRA_(\d+)HP_LOW$/.exec(eff.type)
  if (hpLowMatch) {
    const n = parseInt(hpLowMatch[1], 10)
    if (ctx.mover.hp <= n) ctx.dmgToOpp += eff.value
    next()
    return
  }
  const charaDiceEnemyMatch = /^DAMAGE_EXTRA_CHARADICE_ENEMY_(.+)$/.exec(eff.type)
  if (charaDiceEnemyMatch) {
    const orientations = charaDiceEnemyMatch[1].split(',').map(s => s.trim()).filter(s => s !== "")
    hooks.showCharaDiceEnemyManualPrompt(orientations, eff.value, ctx, success => {
      if (success) ctx.dmgToOpp += eff.value
      next()
    })
    return
  }

  switch (eff.type) {
    case "DAMAGE_EXTRA":
      ctx.dmgToOpp += eff.value
      next()
      break
    case "SPECIAL_IGNORE_WEAKNESS":
      next()
      break
    case "MOD_REDUCE_TAKEN":
      ctx.mover.incomingDamageMod = (ctx.mover.incomingDamageMod || 0) + eff.value
      next()
      break
    case "MOD_NULLIFY_TAKEN":
      ctx.mover.incomingDamageNullify = eff.value
      next()
      break
    case "DAMAGE_SELF":
      ctx.dmgToSelf += eff.value
      next()
      break
    case "MOD_DICE_ENEMY":
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      next()
      break
    case "MOD_CHARADICE_ENEMY":
      ctx.opp.charaDiceBlocked = true
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      next()
      break
    case "MOD_DICE-CHARADICE_ENEMY":
      ctx.opp.charaDiceBlocked = true
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      next()
      break
    case "SPECIAL_REPEAT":
      ctx.repeatValue = eff.value
      next()
      break
    case "MOD_DICE_SELF":
      ctx.mover.diceMod = (ctx.mover.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
      next()
      break
    case "DAMAGE_MULTIPLY":
      ctx.dmgToOpp = ctx.dmgToOpp * eff.value
      next()
      break
    case "DAMAGE_COPY_LAST":
      next()
      break
    case "DAMAGE_EXTRA_CHARADICE_REPEAT":
      hooks.showCharaDiceRepeatPrompt(eff.value, ctx, successCount => {
        ctx.dmgToOpp += successCount * eff.value
        next()
      })
      return
    case "SPECIAL_BIND_WAZA":
      hooks.showBindWazaPrompt(ctx.oppKey, eff.value, pickedIds => {
        ctx.opp.bannedMoveIds = pickedIds
        ctx.opp.bannedMoveSourceName = ctx.mv.name
        next()
      })
      return
    case "DAMAGE_EXTRA_ENE":
      hooks.showEneCountPrompt(eff.value, ctx, count => {
        ctx.dmgToOpp += count * eff.value
        next()
      })
      return
    case "MOD_DICE_STEAL":
      ctx.opp.diceMod = (ctx.opp.diceMod || 0) - eff.value
      pushDiceModBadge(ctx.opp, ctx.mv.name, ctx.mv.type)
      ctx.mover.diceMod = (ctx.mover.diceMod || 0) + eff.value
      pushDiceModBadge(ctx.mover, ctx.mv.name, ctx.mv.type)
      next()
      break
    case "DAMAGE_EXTRA_DICE_MISS_ENEMY":
      if (ctx.opp.committedLastMoveFailed) ctx.dmgToOpp += eff.value
      next()
      break
    case "DAMAGE_EXTRA_DICE_MISS_SELF":
      if (ctx.mover.committedLastMoveFailed) ctx.dmgToOpp += eff.value
      next()
      break
    default: {
      const successSelfDmgMatch = /^DAMAGE_EXTRA_DICE_SUCCESS_SELF_(.+)$/.exec(eff.type)
      if (successSelfDmgMatch) {
        const wazaId = successSelfDmgMatch[1]
        if (ctx.mover.committedLastMoveId !== null && String(ctx.mover.committedLastMoveId) === String(wazaId) && !ctx.mover.committedLastMoveFailed) {
          ctx.dmgToOpp += eff.value
        }
        next()
        break
      }
      const successSelfSelfMatch = /^DAMAGE_SELF_DICE_SUCCESS_SELF_(.+)$/.exec(eff.type)
      if (successSelfSelfMatch) {
        const wazaId = successSelfSelfMatch[1]
        if (ctx.mover.committedLastMoveId !== null && String(ctx.mover.committedLastMoveId) === String(wazaId) && !ctx.mover.committedLastMoveFailed) {
          ctx.dmgToSelf += eff.value
        }
        next()
        break
      }
      next()
    }
  }
}
