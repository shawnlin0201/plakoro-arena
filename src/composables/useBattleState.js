import { reactive } from 'vue'
import { loadMoveHistory, saveMoveHistoryForChar } from '../data/moveHistory'
import { computeDisplayDamage as computeDisplayDamagePure, isCharaColorConditionMet } from '../game/damage'
import { runEffectQueue as runEffectQueueShared } from '../game/effectQueue'

function newPlayer() {
  return {
    character: null,
    moveIds: [],
    locked: false,
    hp: 0,
    maxHp: 0,
    lastMoveId: null,
    incomingDamageMod: 0,
    incomingDamageNullify: null,
    diceMod: 0,
    diceModBadges: [],
    bannedMoveIds: [],
    bannedMoveSourceName: "",
    committedBannedMoveIds: [],
    committedBannedMoveSourceName: "",
    charaDiceBlocked: false,
    lastMoveFailed: false,
    committedLastMoveId: null,
    committedLastMoveFailed: false,
    // transient visual effects (replace imperative DOM manipulation from the original demo)
    attackAnim: null,
    hitBlink: false,
    dmgOverlay: null,
    frameOut: false
  }
}

function freshState() {
  return {
    phase: "select",
    players: { A: newPlayer(), B: newPlayer() },
    firstPlayer: null,
    turnPlayer: null,
    turnCount: 0,
    modal: null,
    selectedMove: null,
    winner: null,
    revealed: false,
    effectPrompt: null,
    repeatActive: false,
    turnCutIn: null
  }
}

const state = reactive(freshState())

export function useBattleState(movesRef) {
  function opponentKey(k) {
    return k === "A" ? "B" : "A"
  }

  function bothLocked() {
    return state.players.A.locked && state.players.B.locked
  }

  function hpBarClass(p) {
    if (p.maxHp <= 0) return ""
    const ratio = p.hp / p.maxHp
    if (ratio <= .2) return "crit"
    if (ratio <= .5) return "low"
    return ""
  }

  function computeDisplayDamage(mv, mover, target) {
    return computeDisplayDamagePure(mv, mover, target, movesRef.value)
  }

  // --- character/move selection (phase: "select") ---

  function openCharSelect(key) {
    state.modal = { type: "char", playerKey: key, tempChar: null }
  }

  function openMoveSelect(key, char) {
    const hist = loadMoveHistory()
    const saved = hist[char.id]
    const validSaved = Array.isArray(saved) && saved.length === 4 && saved.every(mid => char.moves.includes(mid))
    state.modal = { type: "move", playerKey: key, tempChar: char, tempMoves: validSaved ? [...saved] : [] }
  }

  function closeModal() {
    state.modal = null
  }

  function toggleMoveInModal(mid) {
    const m = state.modal
    if (!m) return
    if (m.tempMoves.includes(mid)) {
      m.tempMoves = m.tempMoves.filter(x => x !== mid)
    } else if (m.tempMoves.length < 4) {
      m.tempMoves.push(mid)
    }
  }

  function confirmCharacterMoves() {
    const m = state.modal
    if (!m || m.tempMoves.length !== 4) return
    const p = state.players[m.playerKey]
    p.character = m.tempChar
    p.moveIds = m.tempMoves
    p.locked = true
    p.hp = m.tempChar.hp
    p.maxHp = m.tempChar.hp
    saveMoveHistoryForChar(m.tempChar.id, m.tempMoves)
    state.modal = null
  }

  function onCardTap(key) {
    const p = state.players[key]
    if (state.phase !== "select") return
    if (!p.locked) {
      openCharSelect(key)
    } else {
      openMoveSelect(key, p.character)
      state.modal.tempMoves = [...p.moveIds]
    }
  }

  function startBattle(firstKey) {
    state.firstPlayer = firstKey
    state.turnPlayer = firstKey
    state.turnCount = 0
    state.revealed = true
    state.phase = "moveSelect"
    showTurnCutIn(firstKey)
  }

  // --- move / dice / effect resolution (phases: moveSelect, diceRoll, resolve, effectPrompt) ---

  function pickMove(mid) {
    state.selectedMove = mid
    state.phase = "diceRoll"
  }

  function backToMoveSelect() {
    if (state.repeatActive) return
    state.selectedMove = null
    state.phase = "moveSelect"
  }

  const effectQueueHooks = {
    showDicePrompt,
    showCharaDiceCountPrompt,
    showCharaDiceRepeatPrompt,
    showBindWazaPrompt,
    showEneCountPrompt,
    showCharaDiceEnemyManualPrompt
  }

  function resolveTurn(result) {
    const MOVES = movesRef.value
    const moverKey = state.turnPlayer
    const mover = state.players[moverKey]
    const oppKey = opponentKey(moverKey)
    const opp = state.players[oppKey]
    const mv = MOVES[state.selectedMove]
    mover.lastMoveId = state.selectedMove
    mover.lastMoveFailed = result.kind === "fail"
    mover.bannedMoveIds = []
    mover.bannedMoveSourceName = ""
    mover.diceMod = 0
    mover.diceModBadges = []
    mover.charaDiceBlocked = false
    state.phase = "resolve"

    if (result.kind === "fail") {
      opp.incomingDamageMod = 0
      opp.incomingDamageNullify = null
      proceedToAnimateWithCtx({ moverKey, mover, oppKey, opp, mv, dmgToOpp: 0, dmgToSelf: 0, isMiss: true })
      return
    }

    const queue = []
    if (mv.effectType) queue.push({ type: mv.effectType, value: mv.effectValue })
    if (result.kind === "chara" && result.ce && result.ce.type) {
      queue.push({ type: result.ce.type, value: result.ce.value })
    }
    const ctx = { moverKey, mover, oppKey, opp, mv, dmgToOpp: result.dmgInfo.raw, dmgToSelf: 0 }
    runEffectQueueShared(queue, 0, ctx, effectQueueHooks, () => proceedToAnimateWithCtx(ctx))
  }

  // --- effect prompts (state.effectPrompt / phase: "effectPrompt") ---

  function showDicePrompt(maxNum, multiplier, onPick) {
    state.effectPrompt = { kind: "diceNumber", max: maxNum, multiplier, onPick }
    state.phase = "effectPrompt"
  }

  function showCharaDiceCountPrompt(n, effectValue, ctx, onPick) {
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceCount", n, effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  function showCharaDiceRepeatPrompt(effectValue, ctx, onPick) {
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceRepeat", effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  function showBindWazaPrompt(targetKey, count, onDone) {
    state.effectPrompt = { kind: "bindWaza", targetKey, count, picked: [], onDone }
    state.phase = "effectPrompt"
  }

  function showEneCountPrompt(effectValue, ctx, onPick) {
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "eneCount", effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  function showCharaDiceEnemyManualPrompt(orientations, effectValue, ctx, onPick) {
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceEnemyManual", orientations, effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  function submitEffectPrompt(value) {
    const ep = state.effectPrompt
    if (!ep) return
    const cb = ep.onPick
    state.effectPrompt = null
    state.phase = "resolve"
    cb(value)
  }

  function pickBindWazaMove(mid) {
    const ep = state.effectPrompt
    if (!ep || ep.kind !== "bindWaza") return
    if (ep.picked.includes(mid)) return
    ep.picked.push(mid)
    if (ep.picked.length >= ep.count) {
      const cb = ep.onDone
      const picked = ep.picked.slice()
      state.effectPrompt = null
      state.phase = "resolve"
      cb(picked)
    }
  }

  // --- damage animation + turn handoff ---

  function playEffectOn(targetKey, type, dmg, cb, attackerKey, isMiss) {
    const isHeal = dmg < 0
    const doHit = () => {
      const target = state.players[targetKey]
      const didBlink = !isMiss && !isHeal && dmg > 0
      if (didBlink) target.hitBlink = true
      target.dmgOverlay = { text: isHeal ? `+${-dmg}` : (isMiss ? "MISS" : (dmg > 0 ? `-${dmg}` : "0")), heal: isHeal }
      setTimeout(() => {
        target.hitBlink = false
        target.dmgOverlay = null
        cb()
      }, 550)
    }
    if (attackerKey) {
      const attacker = state.players[attackerKey]
      attacker.attackAnim = attackerKey === "A" ? "atk-right" : "atk-left"
      setTimeout(() => {
        attacker.attackAnim = null
        doHit()
      }, 550)
    } else {
      doHit()
    }
  }

  function frameOutDeadMon(key, cb) {
    state.players[key].frameOut = true
    setTimeout(cb, 1000)
  }

  function showTurnCutIn(key) {
    const p = state.players[key]
    const isFirstTurn = state.turnCount === 0
    const energyCount = Math.max(0, (isFirstTurn ? 2 : 3) + (p.diceMod || 0))
    const hasChara = !p.charaDiceBlocked
    state.turnCutIn = { key, hasChara, energyCount }
    setTimeout(() => {
      state.turnCutIn = null
    }, 1970)
  }

  function proceedToAnimateWithCtx(ctx) {
    const { moverKey, mover, oppKey, opp, mv } = ctx
    const dmgToOpp = (opp.incomingDamageNullify !== null && opp.incomingDamageNullify !== undefined)
      ? Math.max(opp.incomingDamageNullify, 0)
      : Math.max(ctx.dmgToOpp, 0)
    const dmgToSelf = ctx.dmgToSelf

    playEffectOn(oppKey, mv.type, dmgToOpp, () => {
      opp.hp = Math.max(opp.hp - dmgToOpp, 0)

      const finishSelf = () => {
        if (opp.hp <= 0 || mover.hp <= 0) {
          let winnerKey
          if (opp.hp <= 0 && mover.hp <= 0) winnerKey = oppKey
          else if (opp.hp <= 0) winnerKey = moverKey
          else winnerKey = oppKey
          const deadKeys = []
          if (opp.hp <= 0) deadKeys.push(oppKey)
          if (mover.hp <= 0) deadKeys.push(moverKey)
          Promise.all(deadKeys.map(k => new Promise(res => frameOutDeadMon(k, res)))).then(() => {
            state.winner = winnerKey
            state.phase = "win"
          })
          return
        }
        if (ctx.repeatValue) {
          state.repeatActive = true
          state.phase = "diceRoll"
          return
        }
        state.repeatActive = false
        opp.incomingDamageMod = 0
        opp.incomingDamageNullify = null
        mover.committedLastMoveId = mover.lastMoveId
        mover.committedLastMoveFailed = mover.lastMoveFailed
        mover.committedBannedMoveIds = mover.bannedMoveIds
        mover.committedBannedMoveSourceName = mover.bannedMoveSourceName
        opp.committedBannedMoveIds = opp.bannedMoveIds
        opp.committedBannedMoveSourceName = opp.bannedMoveSourceName
        state.turnPlayer = oppKey
        state.turnCount++
        state.selectedMove = null
        state.phase = "moveSelect"
        showTurnCutIn(oppKey)
      }

      if (dmgToSelf !== 0) {
        setTimeout(() => {
          playEffectOn(moverKey, mv.type, dmgToSelf, () => {
            if (dmgToSelf > 0) mover.hp = Math.max(mover.hp - dmgToSelf, 0)
            else mover.hp = Math.min(mover.hp - dmgToSelf, mover.maxHp)
            setTimeout(finishSelf, 1000)
          })
        }, 250)
      } else {
        setTimeout(finishSelf, 1000)
      }
    }, moverKey, !!ctx.isMiss)
  }

  function resetGame() {
    Object.assign(state, freshState())
  }

  return {
    state,
    opponentKey,
    bothLocked,
    hpBarClass,
    computeDisplayDamage,
    isCharaColorConditionMet,
    openCharSelect,
    openMoveSelect,
    closeModal,
    toggleMoveInModal,
    confirmCharacterMoves,
    onCardTap,
    startBattle,
    pickMove,
    backToMoveSelect,
    resolveTurn,
    submitEffectPrompt,
    pickBindWazaMove,
    resetGame
  }
}
