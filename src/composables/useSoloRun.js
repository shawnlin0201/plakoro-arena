import { reactive } from 'vue'
import { computeDisplayDamage as computeDisplayDamagePure, isCharaColorConditionMet } from '../game/damage'
import { runEffectQueue as runEffectQueueShared } from '../game/effectQueue'
import { buildAiOpponentForTier, scaleMoveForFloor, maxAffordableCostForTier } from '../game/aiOpponent'
import { generateActMap, reachableNodeIds as mapReachableNodeIds } from '../game/mapGen'
import { drawRandomEvent } from '../game/eventPool'

const STARTING_HP_FALLBACK = 100
const UPGRADE_HP_AMOUNT = 10
const UPGRADE_ATK_AMOUNT = 5
const UPGRADE_DEF_AMOUNT = 5
const STARTING_MOVE_COUNT = 2
const TOTAL_ACTS = 3

const LEVEL_UP_CHOICES = [
  { kind: "atk", amount: UPGRADE_ATK_AMOUNT },
  { kind: "def", amount: UPGRADE_DEF_AMOUNT },
  { kind: "hp", amount: UPGRADE_HP_AMOUNT }
]

function newCombatant() {
  return {
    character: null,
    moveIds: [],
    hp: 0,
    maxHp: 0,
    atkBonus: 0,
    defBonus: 0,
    energyDiceCount: 1,
    level: 1,
    winsSinceLevel: 0,
    lastMoveId: null,
    lastMoveFailed: false,
    committedLastMoveId: null,
    committedLastMoveFailed: false,
    incomingDamageMod: 0,
    incomingDamageNullify: null,
    diceMod: 0,
    diceModBadges: [],
    bannedMoveIds: [],
    bannedMoveSourceName: "",
    committedBannedMoveIds: [],
    committedBannedMoveSourceName: "",
    charaDiceBlocked: false,
    attackAnim: null,
    hitBlink: false,
    dmgOverlay: null,
    frameOut: false
  }
}

function freshRunState() {
  return {
    phase: "charSelect",
    act: 1,
    map: null,
    currentNodeId: null,
    reachableNodeIds: [],
    currentEvent: null,
    turn: "player",
    player: newCombatant(),
    ai: newCombatant(),
    selectedMove: null,
    effectPrompt: null,
    repeatActive: false,
    upgradeChoices: null,
    learnMoveChoices: null,
    pendingChoiceQueue: [],
    pendingAfterQueue: null,
    gameOver: null,
    charSelectTemp: null
  }
}

const state = reactive(freshRunState())

export function useSoloRun(charactersRef, movesRef) {
  function resetRun() {
    Object.assign(state, freshRunState())
  }

  function opponentOf(who) {
    return who === "player" ? "ai" : "player"
  }

  function combatant(who) {
    return state[who]
  }

  function hpBarClass(c) {
    if (c.maxHp <= 0) return ""
    const ratio = c.hp / c.maxHp
    if (ratio <= .2) return "crit"
    if (ratio <= .5) return "low"
    return ""
  }

  function computeDisplayDamage(mv, mover, target) {
    return computeDisplayDamagePure(mv, mover, target, movesRef.value)
  }

  // --- character select ---

  function startingAffordableMoveIds(character) {
    const maxCost = maxAffordableCostForTier(1)
    return character.moves.filter(id => {
      const mv = movesRef.value[id]
      return mv && mv.cost.length > 0 && mv.cost.length <= maxCost
    })
  }

  function selectCharacter(character) {
    state.charSelectTemp = { character, moveIds: [] }
  }

  function toggleStartingMove(moveId) {
    const tmp = state.charSelectTemp
    if (!tmp) return
    if (tmp.moveIds.includes(moveId)) {
      tmp.moveIds = tmp.moveIds.filter(id => id !== moveId)
    } else if (tmp.moveIds.length < STARTING_MOVE_COUNT) {
      tmp.moveIds.push(moveId)
    }
  }

  function confirmStartingSetup() {
    const tmp = state.charSelectTemp
    if (!tmp || tmp.moveIds.length !== STARTING_MOVE_COUNT) return
    const p = state.player
    p.character = tmp.character
    p.moveIds = tmp.moveIds.slice()
    p.maxHp = tmp.character.hp || STARTING_HP_FALLBACK
    p.hp = p.maxHp
    p.energyDiceCount = 1
    p.level = 1
    p.winsSinceLevel = 0
    state.charSelectTemp = null
    startAct(1)
  }

  // --- act / map / node navigation ---

  function startAct(actNumber) {
    state.act = actNumber
    state.map = generateActMap()
    state.currentNodeId = null
    state.reachableNodeIds = state.map.startNodeIds
    state.currentEvent = null
    state.phase = "map"
  }

  function pickRandomCharacterName() {
    const list = charactersRef.value
    return list[Math.floor(Math.random() * list.length)].name
  }

  function resetCombatantForFight(c) {
    c.lastMoveId = null
    c.lastMoveFailed = false
    c.committedLastMoveId = null
    c.committedLastMoveFailed = false
    c.incomingDamageMod = 0
    c.incomingDamageNullify = null
    c.diceMod = 0
    c.diceModBadges = []
    c.bannedMoveIds = []
    c.bannedMoveSourceName = ""
    c.committedBannedMoveIds = []
    c.committedBannedMoveSourceName = ""
    c.charaDiceBlocked = false
    c.attackAnim = null
    c.hitBlink = false
    c.dmgOverlay = null
    c.frameOut = false
  }

  function startCombat(tier) {
    const ai = state.ai
    const opp = buildAiOpponentForTier(tier, charactersRef.value, movesRef.value)
    ai.character = opp.character
    ai.moveIds = opp.moveIds
    ai.maxHp = opp.hp
    ai.hp = ai.maxHp
    ai.energyDiceCount = opp.energyDiceCount
    ai.tier = opp.tier
    ai.multiplier = opp.multiplier
    resetCombatantForFight(ai)
    resetCombatantForFight(state.player)

    state.turn = "player"
    state.selectedMove = null
    state.upgradeChoices = null
    state.phase = "moveSelect"
  }

  function enterNode(nodeId) {
    if (!state.reachableNodeIds.includes(nodeId)) return
    const node = state.map.nodes[nodeId]
    state.currentNodeId = nodeId

    if (node.type === "monster") {
      startCombat(state.act)
    } else if (node.type === "boss") {
      startCombat(state.act + 1)
    } else if (node.type === "event") {
      const ev = drawRandomEvent()
      const characterName = pickRandomCharacterName()
      applyEventEffect(ev)
      state.currentEvent = { ...ev, characterName }
      state.phase = "event"
    } else if (node.type === "campfire") {
      state.player.hp = state.player.maxHp
      state.phase = "campfire"
    }
  }

  function applyEventEffect(ev) {
    const p = state.player
    if (ev.effectKind === "heal") {
      p.hp = Math.min(p.hp + ev.amount, p.maxHp)
    } else if (ev.effectKind === "atk") {
      p.atkBonus += ev.amount
    } else if (ev.effectKind === "def") {
      p.defBonus += ev.amount
    } else if (ev.effectKind === "maxHp") {
      p.maxHp += ev.amount
      p.hp = Math.min(p.hp + ev.amount, p.maxHp)
    }
  }

  function returnToMap() {
    state.currentEvent = null
    state.reachableNodeIds = mapReachableNodeIds(state.map, state.currentNodeId)
    state.phase = "map"
  }

  // --- move selection / AI move choice ---

  function availableMoveIds(who) {
    const c = state[who]
    return c.moveIds.filter(mid => mid !== c.committedLastMoveId && !(c.committedBannedMoveIds || []).includes(mid))
  }

  function pickMove(mid) {
    state.selectedMove = mid
    // Both sides' dice are physically rolled by the player, who self-reports success,
    // a character-die effect, or failure directly — same as duel mode, for both turns.
    state.phase = "diceSuccess"
  }

  function aiTakeTurn() {
    const pool = availableMoveIds("ai")
    // If every one of the AI's moves is either sealed or the one it can't repeat, it has no
    // legal move at all this turn — hand it to the player as an explicit skip rather than
    // silently letting the AI use a move it shouldn't be able to.
    if (pool.length === 0) {
      state.phase = "aiSkip"
      return
    }
    const mid = pool[Math.floor(Math.random() * pool.length)]
    pickMove(mid)
  }

  function skipAiTurn() {
    const ai = state.ai
    ai.committedLastMoveId = null
    ai.committedLastMoveFailed = false
    ai.committedBannedMoveIds = []
    ai.committedBannedMoveSourceName = ""
    // A skipped turn never runs resolveTurn for the AI, so its live bannedMoveIds (only ever
    // cleared at the top of resolveTurn for whoever's turn it is) would otherwise still hold
    // the seal — and get re-committed onto the AI after every later player turn, making the
    // seal outlast its intended one-turn duration.
    ai.bannedMoveIds = []
    ai.bannedMoveSourceName = ""
    state.turn = "player"
    state.selectedMove = null
    state.phase = "moveSelect"
  }

  function backToMoveSelect() {
    if (state.repeatActive) return
    state.selectedMove = null
    state.phase = "moveSelect"
  }

  function moveForTurn() {
    const raw = movesRef.value[state.selectedMove]
    if (state.turn === "ai" && state.ai.multiplier) {
      return scaleMoveForFloor(raw, state.ai.multiplier)
    }
    return raw
  }

  // --- resolution (shared effect-queue engine) ---

  const effectQueueHooks = {
    showDicePrompt,
    showCharaDiceCountPrompt,
    showCharaDiceRepeatPrompt,
    showBindWazaPrompt,
    showEneCountPrompt,
    showCharaDiceEnemyManualPrompt
  }

  function resolveTurn(result) {
    const moverKey = state.turn
    const mover = state[moverKey]
    const oppKey = opponentOf(moverKey)
    const opp = state[oppKey]
    const mv = moveForTurn()
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
    const dmgInfo = result.dmgInfo || computeDisplayDamage(mv, mover, opp)
    const ctx = { moverKey, mover, oppKey, opp, mv, dmgToOpp: dmgInfo.raw + (mover.atkBonus || 0), dmgToSelf: 0 }
    runEffectQueueShared(queue, 0, ctx, effectQueueHooks, () => proceedToAnimateWithCtx(ctx))
  }

  // --- effect prompts (same shapes as duel mode) ---

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

  // --- success-column choice (mirrors duel's DiceOverlay success buttons) ---

  function chooseSuccessOnly() {
    const mover = state[state.turn]
    const opp = state[opponentOf(state.turn)]
    const mv = moveForTurn()
    const dmgInfo = computeDisplayDamage(mv, mover, opp)
    resolveTurn({ kind: "success", dmgInfo })
  }

  function chooseCharaEffect(ce) {
    const mover = state[state.turn]
    const opp = state[opponentOf(state.turn)]
    const mv = moveForTurn()
    const dmgInfo = computeDisplayDamage(mv, mover, opp)
    resolveTurn({ kind: "chara", ce, dmgInfo })
  }

  // Only reachable on the player's own turn — the player self-reports a failed energy
  // roll the same way duel mode does, since they can judge their own dice against their
  // own move's cost without any help from the app.
  function chooseFail() {
    resolveTurn({ kind: "fail" })
  }

  // --- animation + turn handoff ---

  function playEffectOn(targetKey, dmg, cb, attackerKey, isMiss) {
    const isHeal = dmg < 0
    const doHit = () => {
      const target = state[targetKey]
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
      const attacker = state[attackerKey]
      attacker.attackAnim = attackerKey === "player" ? "atk-right" : "atk-left"
      setTimeout(() => {
        attacker.attackAnim = null
        doHit()
      }, 550)
    } else {
      doHit()
    }
  }

  function frameOutDefeated(key, cb) {
    state[key].frameOut = true
    setTimeout(cb, 1000)
  }

  function proceedToAnimateWithCtx(ctx) {
    const { moverKey, mover, oppKey, opp, mv } = ctx
    let dmgToOpp = (opp.incomingDamageNullify !== null && opp.incomingDamageNullify !== undefined)
      ? Math.max(opp.incomingDamageNullify, 0)
      : Math.max(ctx.dmgToOpp, 0)
    dmgToOpp = Math.max(dmgToOpp - (opp.defBonus || 0), 0)
    const dmgToSelf = ctx.dmgToSelf

    playEffectOn(oppKey, dmgToOpp, () => {
      opp.hp = Math.max(opp.hp - dmgToOpp, 0)

      const finishSelf = () => {
        if (opp.hp <= 0 || mover.hp <= 0) {
          const deadKeys = []
          if (opp.hp <= 0) deadKeys.push(oppKey)
          if (mover.hp <= 0) deadKeys.push(moverKey)
          Promise.all(deadKeys.map(k => new Promise(res => frameOutDefeated(k, res)))).then(() => {
            if (state.player.hp <= 0) {
              state.gameOver = { act: state.act }
              state.phase = "gameOver"
            } else {
              onCombatWon()
            }
          })
          return
        }
        if (ctx.repeatValue) {
          state.repeatActive = true
          state.phase = "diceSuccess"
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
        state.turn = oppKey
        state.selectedMove = null
        state.phase = "moveSelect"
        if (state.turn === "ai") aiTakeTurn()
      }

      if (dmgToSelf !== 0) {
        setTimeout(() => {
          playEffectOn(moverKey, dmgToSelf, () => {
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

  // --- post-combat rewards: win-count level-up (monster nodes) or move+die (boss nodes) ---

  function buildLearnMoveChoices() {
    const p = state.player
    const maxCost = maxAffordableCostForTier(p.energyDiceCount || 1)
    return p.character.moves.filter(id => {
      if (p.moveIds.includes(id)) return false
      const mv = movesRef.value[id]
      return mv && mv.cost.length > 0 && mv.cost.length <= maxCost
    })
  }

  function onCombatWon() {
    const node = state.map.nodes[state.currentNodeId]
    const isBoss = node.type === "boss"
    const p = state.player
    const queue = []

    if (isBoss) {
      p.energyDiceCount += 1
      if (p.moveIds.length < 4 && buildLearnMoveChoices().length > 0) {
        queue.push({ kind: "learnMove" })
      }
    } else {
      p.winsSinceLevel += 1
      if (p.winsSinceLevel >= p.level) {
        p.winsSinceLevel = 0
        p.level += 1
        queue.push({ kind: "levelUp" })
      }
    }

    state.pendingChoiceQueue = queue
    state.pendingAfterQueue = isBoss ? "bossAdvance" : "mapReturn"
    advanceChoiceQueue()
  }

  function advanceChoiceQueue() {
    if (state.pendingChoiceQueue.length === 0) {
      finishPendingResolution()
      return
    }
    const next = state.pendingChoiceQueue.shift()
    if (next.kind === "levelUp") {
      state.upgradeChoices = LEVEL_UP_CHOICES
      state.phase = "floorClear"
    } else if (next.kind === "learnMove") {
      state.learnMoveChoices = buildLearnMoveChoices()
      state.phase = "learnMove"
    }
  }

  function finishPendingResolution() {
    const after = state.pendingAfterQueue
    state.pendingAfterQueue = null
    if (after === "bossAdvance") {
      if (state.act >= TOTAL_ACTS) {
        state.phase = "victory"
      } else {
        startAct(state.act + 1)
      }
    } else {
      returnToMap()
    }
  }

  function applyLevelUpChoice(choice) {
    const p = state.player
    if (choice.kind === "hp") {
      p.maxHp += choice.amount
    } else if (choice.kind === "atk") {
      p.atkBonus += choice.amount
    } else if (choice.kind === "def") {
      p.defBonus += choice.amount
    }
    // Leveling up always tops off HP, regardless of which stat was chosen.
    p.hp = p.maxHp
    state.upgradeChoices = null
    advanceChoiceQueue()
  }

  function learnBonusMove(mid) {
    const p = state.player
    if (!p.moveIds.includes(mid) && p.moveIds.length < 4) {
      p.moveIds.push(mid)
    }
    state.learnMoveChoices = null
    advanceChoiceQueue()
  }

  return {
    state,
    combatant,
    opponentOf,
    hpBarClass,
    computeDisplayDamage,
    isCharaColorConditionMet,
    selectCharacter,
    toggleStartingMove,
    startingAffordableMoveIds,
    confirmStartingSetup,
    enterNode,
    returnToMap,
    availableMoveIds,
    pickMove,
    skipAiTurn,
    backToMoveSelect,
    moveForTurn,
    submitEffectPrompt,
    pickBindWazaMove,
    chooseSuccessOnly,
    chooseCharaEffect,
    chooseFail,
    applyLevelUpChoice,
    learnBonusMove,
    resetRun
  }
}
