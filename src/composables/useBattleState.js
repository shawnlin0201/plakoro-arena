import { reactive } from 'vue'
import { loadMoveHistory, saveMoveHistoryForChar } from '../data/moveHistory'
import { computeDisplayDamage as computeDisplayDamagePure, isCharaColorConditionMet } from '../game/damage'
import { runEffectQueue as runEffectQueueShared } from '../game/effectQueue'

// Set by useOnlineRoom on host()/join()/leave(). Lets the handful of effect hooks below tell
// "real synced dice are available" (online) from "nothing to read but a self-report" (hotseat/
// solo) without threading an online flag through every call in the shared effect-queue engine.
let onlineModeActive = false
export function setOnlineMode(v) {
  onlineModeActive = v
}

// Pending completions for the two online-only "extra real dice roll" tasks below. Functions
// can't survive the host->guest state broadcast (see stripFns in useOnlineRoom.js), so — like
// state.effectPrompt.onPick — these live outside reactive state and only ever run on the host,
// which is the only client that actually executes resolveTurn()/the effect queue.
let pendingCharaThrowDone = null
let pendingEnergyThrowDone = null

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
    // Set by NULLIFY_TAKEN_LE: incoming damage at or below this becomes zero. Same lifecycle
    // as incomingDamageNullify above — set on your turn, consumed on theirs, then cleared.
    incomingDamageNullifyAtMost: null,
    // Whether this side took move damage on the turn that just finished. `committed` is the
    // settled value a later turn reads, mirroring committedLastMoveFailed.
    tookDamage: false,
    committedTookDamage: false,
    // Things this side must do on their next turn that the app cannot do for them — reroll a
    // die, swap a chip. Hotseat and solo are played with real dice, so these are reminders
    // shown at the moment they apply, not simulations. Cleared when that turn starts.
    pendingNotices: [],
    // { orientations, from } while ふわふわひこう is shielding this side: the attacker is
    // asked whether their character die landed on one of those faces, and if it did the
    // damage — and only the damage — is cancelled. Same lifecycle as incomingDamageNullify.
    incomingNullifyIfCharaDice: null,
    // Set by そそのかす: this side's move is chosen by their opponent next turn. Unlike the
    // notices above the app does enforce this one, because it owns the move-select screen.
    moveChosenByOpponent: false,
    // Set by ほりかえす / ジュエルフラッシュ: { n, from }. Consumed the moment this side's
    // next roll settles, which turns it into state.diceRerollRequest.
    pendingDiceReroll: null,
    diceMod: 0,
    diceModBadges: [],
    bannedMoveIds: [],
    bannedMoveSourceName: "",
    committedBannedMoveIds: [],
    committedBannedMoveSourceName: "",
    charaDiceBlocked: false,
    // Online-only: this side has tapped "ready" and is waiting for the opponent, so the first
    // player can be drawn instead of either side just picking themselves. Unused in hotseat.
    readyForFirst: false,
    // Online-only: this side's fixed set of 3 energy dice (same shape as the dice assembly
    // simulator's), thrown every turn for the rest of the match once configured.
    energyDice: null,
    // { value, orientations } while another move has pinned this player's character die for
    // their next turn; null the rest of the time. Same lifecycle as charaDiceBlocked above.
    fixCharaDice: null,
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
    // Online-only: the side the first-pick wheel has landed on, set before `firstPlayer` while
    // phase is "drawingFirst" so both clients animate toward the same result.
    pendingFirstPick: null,
    firstPlayer: null,
    turnPlayer: null,
    turnCount: 0,
    // One char/move-select modal slot per player — see openCharSelect()'s comment for why.
    modals: { A: null, B: null },
    selectedMove: null,
    winner: null,
    revealed: false,
    effectPrompt: null,
    repeatActive: false,
    turnCutIn: null,
    // Online only: this turn's 3D dice-throw result (see DiceOverlay.vue / clearDiceRoll()),
    // reset whenever a fresh dice-roll phase begins.
    charaDieFace: null,
    energyRolledTypes: null,
    // The same roll, kept per die instead of flattened: [['みず'], ['みず','あく'], []]. The
    // flat list above cannot be unpicked, because a dual-chip face contributes two types from
    // one die — and ほりかえす / ジュエルフラッシュ need "which DIE" to make anyone reroll one.
    energyDieTypes: null,
    energySuccess: null,
    diceTransforms: null,
    // { targetKey, byKey, n, from, indices } while somebody is naming which of the target's
    // energy dice must be rerolled; null otherwise. `indices` stays null until they choose.
    diceRerollRequest: null,
    // Online only: gates the handoff to the next turn behind the receiving side actually
    // acknowledging the damage + dice result — see showTurnResultConfirm()/confirmTurnResult().
    turnResult: null,
    // Online only: an extra real character-die throw is in progress (either side's own die) —
    // see beginCharaThrowTask()/submitCharaThrowResult().
    charaThrowTask: null,
    // Online only: an extra real energy-dice throw (always the opponent's own configured set)
    // is in progress — see beginEnergyThrowTask()/submitEnergyThrowResult().
    energyThrowTask: null
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
  //
  // One modal slot per player (state.modals.A / state.modals.B), not a single shared one: with
  // only one slot, whichever side opened their picker SECOND overwrote it, so the FIRST side's
  // open modal (which the state watch then re-broadcasts) would vanish out from under them —
  // the same class of bug the energy-dice setup had before it moved to fully local state. Here
  // the modal still needs to be synced (so the opponent's "對方選擇中" status can read it), so
  // each side gets its own slot instead of going local.

  function openCharSelect(key) {
    state.modals[key] = { type: "char", playerKey: key, tempChar: null }
  }

  function openMoveSelect(key, char) {
    const hist = loadMoveHistory()
    const saved = hist[char.id]
    const validSaved = Array.isArray(saved) && saved.length === 4 && saved.every(mid => char.moves.includes(mid))
    state.modals[key] = { type: "move", playerKey: key, tempChar: char, tempMoves: validSaved ? [...saved] : [] }
  }

  function closeModal(key) {
    state.modals[key] = null
  }

  function toggleMoveInModal(key, mid) {
    const m = state.modals[key]
    if (!m) return
    if (m.tempMoves.includes(mid)) {
      m.tempMoves = m.tempMoves.filter(x => x !== mid)
    } else if (m.tempMoves.length < 4) {
      m.tempMoves.push(mid)
    }
  }

  function confirmCharacterMoves(key) {
    const m = state.modals[key]
    if (!m || m.tempMoves.length !== 4) return
    const p = state.players[key]
    p.character = m.tempChar
    p.moveIds = m.tempMoves
    p.locked = true
    p.hp = m.tempChar.hp
    p.maxHp = m.tempChar.hp
    saveMoveHistoryForChar(m.tempChar.id, m.tempMoves)
    state.modals[key] = null
  }

  function onCardTap(key) {
    const p = state.players[key]
    if (state.phase !== "select") return
    if (!p.locked) {
      openCharSelect(key)
    } else {
      openMoveSelect(key, p.character)
      state.modals[key].tempMoves = [...p.moveIds]
    }
  }

  // Online-only: marks this side ready to start; useOnlineRoom watches for both sides being
  // ready and runs the first-pick wheel, then calls startBattle() itself once it lands.
  function setReadyForFirst(key) {
    state.players[key].readyForFirst = true
  }

  // --- energy dice setup (online-only, phase: "select") ---
  // Each side configures a fixed set of 3 energy dice once before the match starts (same shape
  // as the dice assembly simulator's), and every turn's energy throw actually draws from this —
  // unlike the character die, there's no universal fixed energy die, so this can't be skipped.
  // The editing itself happens entirely in EnergyDiceModal's own local state, not state.modal —
  // two people configuring their own dice at the same time is the common case here (unlike
  // char/move picking), and sharing one state.modal slot meant whoever confirmed second stole
  // or closed the other side's picker. This is the one synced step: the finished result.
  function setEnergyDice(key, dice) {
    state.players[key].energyDice = dice
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

  function clearDiceRoll() {
    state.charaDieFace = null
    state.energyRolledTypes = null
    state.energyDieTypes = null
    state.energySuccess = null
    state.diceTransforms = null
  }

  function pickMove(mid) {
    state.selectedMove = mid
    clearDiceRoll()
    state.phase = "diceRoll"
  }

  function backToMoveSelect() {
    if (state.repeatActive) return
    state.selectedMove = null
    clearDiceRoll()
    state.phase = "moveSelect"
  }

  // Online only: called once the active side's 3D throw (energy dice + character die) settles
  // (see DiceOverlay.vue). `energyRolledTypes` is the flat list of energy types actually rolled
  // (so the opponent can see the full result, not just the pass/fail verdict); `energySuccess`
  // is the real cost check (canPayCost against those types); `transforms` is each die's exact
  // final position/quaternion from that physics run, broadcast so the opponent's canvas can
  // replay the identical result instead of guessing.
  function setDiceRollResult(charaDieFace, energyRolledTypes, energySuccess, transforms, energyDieTypes = null) {
    state.charaDieFace = charaDieFace
    state.energyRolledTypes = energyRolledTypes
    state.energySuccess = energySuccess
    state.diceTransforms = transforms
    if (energyDieTypes) state.energyDieTypes = energyDieTypes

    // Somebody made this player's dice rerollable (ほりかえす / ジュエルフラッシュ). Hand the
    // choice of which ones to the player who cast it, before this roll is allowed to settle.
    const mover = state.players[state.turnPlayer]
    if (mover.pendingDiceReroll && !state.diceRerollRequest) {
      state.diceRerollRequest = {
        targetKey: state.turnPlayer,
        byKey: opponentKey(state.turnPlayer),
        n: mover.pendingDiceReroll.n,
        from: mover.pendingDiceReroll.from,
        indices: null
      }
      mover.pendingDiceReroll = null
    }
  }

  /**
   * The caster names which of the opponent's dice have to go again.
   *
   * Only records the choice: the actual throw belongs to the client holding that player's
   * dice canvas, which watches for `indices` and rerolls exactly those (see DiceOverlay).
   */
  function submitDiceReroll(indices) {
    if (!state.diceRerollRequest || state.diceRerollRequest.indices) return
    state.diceRerollRequest = { ...state.diceRerollRequest, indices: [...indices] }
  }

  function clearDiceRerollRequest() {
    state.diceRerollRequest = null
  }

  const effectQueueHooks = {
    showDicePrompt,
    showCharaDiceCountPrompt,
    showCharaDiceRepeatPrompt,
    showBindWazaPrompt,
    showEneCountPrompt,
    showCharaDiceEnemyManualPrompt,
    showCharaDiceComboEnemyPrompt,
    showCharaDiceSelectPrompt
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
    mover.fixCharaDice = null
    // Consumed by the turn they applied to, alongside every other next-turn modifier.
    mover.pendingNotices = []
    mover.moveChosenByOpponent = false
    state.diceRerollRequest = null
    state.phase = "resolve"

    if (result.kind === "fail") {
      opp.incomingDamageMod = 0
      opp.incomingDamageNullify = null
      opp.incomingDamageNullifyAtMost = null
      opp.incomingNullifyIfCharaDice = null
      proceedToAnimateWithCtx({ moverKey, mover, oppKey, opp, mv, dmgToOpp: 0, dmgToSelf: 0, isMiss: true })
      return
    }

    const queue = []
    if (mv.effectType) queue.push({ type: mv.effectType, value: mv.effectValue })
    if (result.kind === "chara" && result.ce && result.ce.type) {
      queue.push({ type: result.ce.type, value: result.ce.value })
    }
    // `ce` (the character-die effect the player picked, with its own `.orientations`) rides
    // along on ctx so hooks below can tell which orientations to keep re-checking on any further
    // real throws of that same die — only meaningful when this turn's effect came from a chara
    // pick, null otherwise.
    const ce = result.kind === "chara" ? result.ce : null
    const ctx = { moverKey, mover, oppKey, opp, mv, ce, dmgToOpp: result.dmgInfo.raw, dmgToSelf: 0 }
    runEffectQueueShared(queue, 0, ctx, effectQueueHooks, () => proceedToAnimateWithCtx(ctx))
  }

  // --- effect prompts (state.effectPrompt / phase: "effectPrompt") ---
  //
  // Online only: every one of these except bindWaza is fundamentally a request to read a die
  // that nobody's self-reporting can actually see any more once physical props are gone — see
  // beginCharaThrowTask()/beginEnergyThrowTask() below, which make each one a real synced throw
  // instead. Hotseat/solo have no real dice to read, so they keep the original self-report
  // overlay (state.effectPrompt) unconditionally; solo mode's own useSoloRun.js mirrors these
  // functions rather than sharing them (no online concept there at all).

  function showDicePrompt(n, multiplier, ctx, onPick) {
    // ミュウ「サイコキネシス」: opponent throws n of their own configured energy dice; damage is
    // the count of whichever type came up most (each die can contribute up to 2 hits via a dual
    // chip face, hence up to 2n instances of one type — matches the original n*2 button range).
    if (onlineModeActive) {
      beginEnergyThrowTask(ctx.oppKey, n, onPick)
      return
    }
    state.effectPrompt = { kind: "diceNumber", max: n * 2, multiplier, onPick }
    state.phase = "effectPrompt"
  }

  // サンダー「ダブルサンダー/ボルトラッシュ」: this move throws the character die n times total;
  // the one that already landed for real this turn (and matched ctx.ce.orientations — that's
  // exactly why this chara option was selectable, see charaAvailable() in DiceOverlay.vue)
  // counts as the first, so only n-1 more real throws are needed.
  function showCharaDiceCountPrompt(n, effectValue, ctx, onPick) {
    if (onlineModeActive && ctx.ce && ctx.ce.orientations) {
      beginCharaThrowTask(ctx.moverKey, ctx.ce.orientations, 'count', n - 1, 1, onPick)
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceCount", n, effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // サンダー「サンダーチェイン」: same die, but repeats for real until a throw finally misses
  // ctx.ce.orientations, rather than a fixed count.
  function showCharaDiceRepeatPrompt(effectValue, ctx, onPick) {
    if (onlineModeActive && ctx.ce && ctx.ce.orientations) {
      beginCharaThrowTask(ctx.moverKey, ctx.ce.orientations, 'repeat', null, 1, onPick)
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceRepeat", effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // Not a dice read at all — a genuine strategic pick (which of the opponent's own moves to
  // ban), so it stays a menu in every mode. Answerable only by ep.targetKey (see
  // EffectPromptOverlay.vue's read-only gating).
  function showBindWazaPrompt(targetKey, count, onDone) {
    state.effectPrompt = { kind: "bindWaza", targetKey, count, picked: [], onDone }
    state.phase = "effectPrompt"
  }

  // ヒトカゲ「フレアストーム」: "the count of [move-type] energy that came up" refers to THIS
  // turn's own energy roll (state.energyRolledTypes) — the one already thrown for the move's
  // own cost check — not a new roll. Same shape as the charaDiceSelect 'self' fix: read it
  // straight from the real result instead of asking the player to recount it by hand.
  // `countedType` is the energy being counted, which is usually but NOT always the move's own
  // type — EBW02-049 is a Fire-cost Dragon move counting Lightning. Defaulted for safety, but
  // effectQueue always passes it.
  function showEneCountPrompt(effectValue, ctx, onPick, countedType = ctx.mv.type) {
    if (onlineModeActive && state.energyRolledTypes) {
      const count = state.energyRolledTypes.filter(ty => ty === countedType).length
      onPick(count)
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "eneCount", effectValue, countedType, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // ベトベター「ベノムスリップ」/ イワーク「ジャイロボール」: a single real throw of the
  // opponent's own character die, checked against `orientations`.
  // A yes/no about the die the attacker just physically threw. Same self-report shape as
  // showCharaDiceEnemyManualPrompt below, but about the *mover's* die and asked on behalf of
  // the defender's standing shield rather than the move being cast.
  function showCharaShieldPrompt(shield, ctx, onPick) {
    // When the app threw the die itself, the answer is already on screen — asking the player
    // to retype it would be asking them to confirm something the app knows better. Only the
    // physical-dice modes have a question to ask.
    if (state.charaDieFace) {
      onPick(shield.orientations.includes(state.charaDieFace))
      return
    }
    state.effectPrompt = {
      kind: "charaShield",
      orientations: shield.orientations,
      sourceName: shield.from,
      mv: ctx.mv,
      mover: ctx.mover,
      opp: ctx.opp,
      onPick
    }
    state.phase = "effectPrompt"
  }

  function showCharaDiceEnemyManualPrompt(orientations, effectValue, ctx, onPick) {
    if (onlineModeActive) {
      beginCharaThrowTask(ctx.oppKey, orientations, 'single', null, 0, onPick, 'bool')
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceEnemyManual", orientations, effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // ゲンガー「ファントムトリック」: the opponent rolls their character die n times for real;
  // each one that matches `orientations` counts (a running count, not a single yes/no — that's
  // what separates it from the prompt above).
  function showCharaDiceComboEnemyPrompt(n, orientations, effectValue, ctx, onPick) {
    if (onlineModeActive) {
      beginCharaThrowTask(ctx.oppKey, orientations, 'count', n, 0, onPick)
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceComboEnemy", n, orientations, effectValue, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // The player reports which orientation their character die actually showed, and that becomes
  // the orientation their (or the opponent's) die is pinned to next turn.
  //
  // Online only: for the 'self' target this is asking about the mover's OWN character die —
  // the same one already thrown for real this turn (state.charaDieFace). This effect only ever
  // fires once that real roll already matched one of `orientations` (see charaAvailable() in
  // DiceOverlay.vue), so asking the player to self-report which one it was would just be asking
  // them to repeat back a result the app already has, and would let them pick a different (wrong)
  // one. Resolve straight from the real roll instead of prompting. The 'enemy' target is a real
  // single throw of the opponent's own die (unused by the current roster, but kept real for
  // whenever a future move needs it, same as the pair in effectQueue.js).
  function showCharaDiceSelectPrompt(orientations, effectValue, ctx, target, onPick) {
    if (target === 'self' && state.charaDieFace && orientations.includes(state.charaDieFace)) {
      onPick(state.charaDieFace)
      return
    }
    if (onlineModeActive && target === 'enemy') {
      beginCharaThrowTask(ctx.oppKey, orientations, 'single', null, 0, onPick, 'face')
      return
    }
    const dmgInfo = computeDisplayDamage(ctx.mv, ctx.mover, ctx.opp)
    state.effectPrompt = { kind: "charaDiceSelect", orientations, effectValue, target, mv: ctx.mv, dmgInfo, mover: ctx.mover, opp: ctx.opp, onPick }
    state.phase = "effectPrompt"
  }

  // --- online-only real "extra dice throw" tasks (state.charaThrowTask / state.energyThrowTask) ---
  //
  // Both follow the same shape as the main dice-overlay throw: whichever client owns
  // `rollerKey` runs the real physics and reports the settled face(s) + transforms; the other
  // side just replays the same transforms (see ExtraRollOverlay.vue). Only the host ever holds
  // a live `pendingXDone` callback — the guest's UI drives entirely off the synced task object.

  // `mode`: 'single' (one throw, resolves immediately) | 'count' (exactly `targetN` more throws,
  // hit or miss) | 'repeat' (keep throwing until one misses). `resultKind` (single mode only):
  // 'bool' (did it match) | 'face' (which orientation it landed on).
  function beginCharaThrowTask(rollerKey, orientations, mode, targetN, startCount, onDone, resultKind = 'count') {
    if (mode === 'count' && targetN <= 0) {
      onDone(startCount)
      return
    }
    state.charaThrowTask = { rollerKey, orientations, mode, targetN, successCount: startCount, resultKind, lastFace: null, transforms: null }
    state.phase = "charaThrowTask"
    pendingCharaThrowDone = onDone
  }

  function finishCharaThrowTask(result) {
    const cb = pendingCharaThrowDone
    state.charaThrowTask = null
    pendingCharaThrowDone = null
    state.phase = "resolve"
    cb(result)
  }

  // Called (via dispatch, if the roller is the guest) once that client's own throw settles.
  function submitCharaThrowResult(face, transforms) {
    const t = state.charaThrowTask
    if (!t) return
    const success = t.orientations.includes(face)
    t.lastFace = face
    t.transforms = transforms
    if (t.mode === 'single') {
      finishCharaThrowTask(t.resultKind === 'face' ? face : success)
      return
    }
    if (success) t.successCount++
    if (t.mode === 'count') {
      t.targetN--
      if (t.targetN <= 0) finishCharaThrowTask(t.successCount)
      return
    }
    // 'repeat': stop the moment one misses; otherwise stay in phase for another throw.
    if (!success) finishCharaThrowTask(t.successCount)
  }

  function beginEnergyThrowTask(rollerKey, n, onDone) {
    state.energyThrowTask = { rollerKey, n, rolledTypes: null, transforms: null }
    state.phase = "energyThrowTask"
    pendingEnergyThrowDone = onDone
  }

  function submitEnergyThrowResult(rolledTypes, transforms) {
    const t = state.energyThrowTask
    if (!t) return
    const counts = {}
    rolledTypes.forEach(ty => { counts[ty] = (counts[ty] || 0) + 1 })
    const maxCount = Object.values(counts).reduce((m, c) => Math.max(m, c), 0)
    const cb = pendingEnergyThrowDone
    state.energyThrowTask = null
    pendingEnergyThrowDone = null
    state.phase = "resolve"
    cb(maxCount)
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

  function handOffTurn(oppKey) {
    state.turnPlayer = oppKey
    state.turnCount++
    state.selectedMove = null
    state.phase = "moveSelect"
    showTurnCutIn(oppKey)
  }

  // Online only: freezes the handoff on "resultConfirm" until oppKey's own client taps through
  // — see TurnResultOverlay.vue, which shows this turn's damage plus the mover's real dice
  // result (still readable off state.charaDieFace/energyRolledTypes/energySuccess; nothing else
  // touches those until clearDiceRoll() runs for the next pick).
  function showTurnResultConfirm(oppKey, mv, dmgToOpp) {
    state.turnResult = { oppKey, mvName: mv.name, mvType: mv.type, dmgToOpp }
    state.phase = "turnResultConfirm"
  }

  function confirmTurnResult() {
    const tr = state.turnResult
    if (!tr) return
    state.turnResult = null
    handOffTurn(tr.oppKey)
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

  // Asked only when ふわふわひこう is actually shielding the defender, and only when this
  // turn's damage would otherwise land — a 0-damage turn has nothing to cancel, and asking
  // anyway would be a prompt for no reason. Answering yes zeroes the damage and nothing else:
  // the card is explicit that other effects still apply, which is why this runs after the
  // effect queue rather than instead of it.
  function proceedToAnimateWithCtx(ctx) {
    const shield = ctx.opp.incomingNullifyIfCharaDice
    if (shield && !ctx.charaShieldAsked && Math.max(ctx.dmgToOpp, 0) > 0) {
      ctx.charaShieldAsked = true
      showCharaShieldPrompt(shield, ctx, hit => {
        if (hit) ctx.dmgToOpp = 0
        proceedToAnimateWithCtx(ctx)
      })
      return
    }
    const { moverKey, mover, oppKey, opp, mv } = ctx
    const dmgToOpp = (opp.incomingDamageNullify !== null && opp.incomingDamageNullify !== undefined)
      ? Math.max(opp.incomingDamageNullify, 0)
      : Math.max(ctx.dmgToOpp, 0)
    const dmgToSelf = ctx.dmgToSelf

    playEffectOn(oppKey, mv.type, dmgToOpp, () => {
      opp.hp = Math.max(opp.hp - dmgToOpp, 0)
      // Recorded here rather than from dmgToOpp alone, because a shield can reduce it to
      // zero — "took no damage" has to mean what actually reached them.
      if (dmgToOpp > 0) opp.tookDamage = true

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
          clearDiceRoll()
          state.phase = "diceRoll"
          return
        }
        state.repeatActive = false
        opp.incomingDamageMod = 0
        opp.incomingDamageNullify = null
        opp.incomingDamageNullifyAtMost = null
        opp.incomingNullifyIfCharaDice = null
        // Settle it for both sides: the attacker took nothing this turn unless their own
        // move hurt them, and the defender's flag was set when the damage landed.
        mover.committedTookDamage = mover.tookDamage
        opp.committedTookDamage = opp.tookDamage
        mover.tookDamage = false
        opp.tookDamage = false
        mover.committedLastMoveId = mover.lastMoveId
        mover.committedLastMoveFailed = mover.lastMoveFailed
        mover.committedBannedMoveIds = mover.bannedMoveIds
        mover.committedBannedMoveSourceName = mover.bannedMoveSourceName
        opp.committedBannedMoveIds = opp.bannedMoveIds
        opp.committedBannedMoveSourceName = opp.bannedMoveSourceName
        // Online only: the turn doesn't actually hand off until the side that just got hit taps
        // through a summary of the damage + dice result — otherwise the screen can flip to their
        // move-select before they've had a chance to see what happened (see
        // showTurnResultConfirm() below and TurnResultOverlay.vue).
        if (onlineModeActive) {
          showTurnResultConfirm(oppKey, mv, dmgToOpp)
          return
        }
        handOffTurn(oppKey)
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
    setReadyForFirst,
    setEnergyDice,
    pickMove,
    backToMoveSelect,
    setDiceRollResult,
    submitDiceReroll,
    clearDiceRerollRequest,
    resolveTurn,
    submitEffectPrompt,
    pickBindWazaMove,
    confirmTurnResult,
    submitCharaThrowResult,
    submitEnergyThrowResult,
    resetGame
  }
}
