export function isCharaColorConditionMet(effType, owner, opponent) {
  if (!effType || !owner || !opponent) return false
  if (effType === "DAMAGE_EXTRA_DICE_MISS_ENEMY") {
    return !!opponent.committedLastMoveFailed
  }
  if (effType === "DAMAGE_EXTRA_DICE_MISS_SELF") {
    return !!owner.committedLastMoveFailed
  }
  const successSelfMatch = /^DAMAGE_EXTRA_DICE_SUCCESS_SELF_(.+)$/.exec(effType) || /^DAMAGE_SELF_DICE_SUCCESS_SELF_(.+)$/.exec(effType)
  if (successSelfMatch) {
    const wazaId = successSelfMatch[1]
    return owner.committedLastMoveId !== null && String(owner.committedLastMoveId) === String(wazaId) && !owner.committedLastMoveFailed
  }
  const hpLowMatch = /^DAMAGE_EXTRA_(\d+)HP_LOW$/.exec(effType)
  if (hpLowMatch) {
    const n = parseInt(hpLowMatch[1], 10)
    return owner.hp <= n
  }
  return false
}

export function computeDisplayDamage(mv, mover, target, movesMap) {
  let base = mv.baseDamage
  let mode = "normal"
  if (mv.effectType === "DAMAGE_COPY_LAST") {
    const lastMv = target.lastMoveId ? movesMap[target.lastMoveId] : null
    base = lastMv ? lastMv.baseDamage * mv.effectValue : 0
  }
  const ignoreWeakness = mv.effectType === "SPECIAL_IGNORE_WEAKNESS"
  if (!ignoreWeakness && mv.type === target.character.weakness && base > 0) {
    base += target.character.weaknessDamage || 20
    mode = "weak"
  }
  if (target.incomingDamageMod) {
    base += target.incomingDamageMod
    if (mode === "normal") mode = target.incomingDamageMod > 0 ? "up" : "down"
  }
  if (target.incomingDamageNullify !== null && target.incomingDamageNullify !== undefined) {
    base = target.incomingDamageNullify
    mode = base < mv.baseDamage ? "down" : base > mv.baseDamage ? "up" : "normal"
  }
  return {
    display: Math.max(base, 0),
    raw: base,
    orig: mv.baseDamage,
    mode
  }
}
