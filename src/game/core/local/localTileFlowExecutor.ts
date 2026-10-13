import type { EndGameOptions, GamePlayer, TileType } from '../contracts/types'
import type { PlayerController } from '../controllers/playerController'
import { createTileFlowExecutor } from '../../shared/runtime/tileFlowExecutor'
import { PACE_MS } from './localGameConfig'
import type { LocalGameState } from './localGameState'
import type { createLocalTurnOrchestrator } from './localTurnOrchestrator'
import type { FollowDealerTracker } from '../../shared/runtime/followDealer'
import { isLocalLlmSeat } from '../presentation/localLlmVoiceRegistry'

interface LocalTileFlowExecutorOptions {
  state: LocalGameState
  controllers: PlayerController[]
  getTurnOrchestrator(): ReturnType<typeof createLocalTurnOrchestrator>
  endDraw(): unknown
  endGame(winnerIndex: number, options?: EndGameOptions): unknown
  showTableAction(type: 'flower-gang', actorIndex: number, sourceIndex: null, tile: TileType, meldIndex: number): void
  playSound(name: string, volume?: number): unknown
  playSoundAndWait(name: string, volume?: number): Promise<void>
  shouldAnnounceDiscard?: (playerIndex: number, player: GamePlayer) => boolean
  later(callback: () => void, delay: number): number
  wait(delay: number): Promise<void>
  stopCountdown(): void
  followDealer?: FollowDealerTracker
  /** 含花牌玩法传 144：牌尾按物理墩补摸时的全墙张数基准（默认 136）。 */
  initialWallSize?: number
  /**
   * 变体自定义「摸到特殊牌」处理（花牌玩法等）。给定时**先于**默认红中逻辑询问，
   * 返回 undefined 表示非该变体的特殊牌，继续落回默认红中逻辑。
   */
  createSpecialDraw?: (deps: LocalSpecialDrawDeps) => SpecialDrawHandler
}

/** 特殊摸牌处理可拿到的引擎句柄（localTileFlowExecutor 自身选项的投影）。 */
export interface LocalSpecialDrawDeps {
  state: LocalGameState
  showTableAction: LocalTileFlowExecutorOptions['showTableAction']
  playSound(name: string, volume?: number): unknown
  playSoundAndWait(name: string, volume?: number): Promise<void>
  wait(delay: number): Promise<void>
  endGame(winnerIndex: number, options?: EndGameOptions): unknown
}

export type SpecialDrawHandler = (
  playerIndex: number,
  tile: TileType,
  drawAgain: () => Promise<boolean>,
) => Promise<boolean | undefined>

/** 默认红中逻辑：亮出（花副）累计 redCount，第四张直接四红中结算。 */
export function createRedSpecialDraw(deps: LocalSpecialDrawDeps): SpecialDrawHandler {
  return async (playerIndex, tile, drawAgain) => {
    if (tile !== 'red') return undefined
    const player = deps.state.players[playerIndex]
    player.redCount += 1
    if (player.redCount >= 4) {
      player.hand = [...player.hand, tile]
      player.drawnTileIndex = player.hand.length - 1
      deps.playSound('give.mp3', 0.7)
      deps.endGame(playerIndex, { fourRed: true })
      return false
    }
    player.melds.push({ type: 'flower', tile: 'red', tiles: ['red'] })
    deps.showTableAction('flower-gang', playerIndex, null, tile, player.melds.length - 1)
    await Promise.all([
      isLocalLlmSeat(playerIndex) ? Promise.resolve() : deps.playSoundAndWait('gang.mp3'),
      deps.wait(PACE_MS.redKongDraw),
    ])
    if (deps.state.phase.value === 'settled') return false
    return drawAgain()
  }
}

export function createLocalTileFlowExecutor(options: LocalTileFlowExecutorOptions) {
  const deps: LocalSpecialDrawDeps = {
    state: options.state,
    showTableAction: options.showTableAction,
    playSound: options.playSound,
    playSoundAndWait: options.playSoundAndWait,
    wait: options.wait,
    endGame: options.endGame,
  }
  const variantSpecialDraw = options.createSpecialDraw?.(deps)
  const redSpecialDraw = createRedSpecialDraw(deps)
  return createTileFlowExecutor({
    ...options,
    getTurnFlow: options.getTurnOrchestrator,
    initialWallSize: options.initialWallSize,
    handleSpecialDraw: async (playerIndex, tile, drawAgain) => {
      const variantResult = await variantSpecialDraw?.(playerIndex, tile, drawAgain)
      if (variantResult !== undefined) return variantResult
      return redSpecialDraw(playerIndex, tile, drawAgain)
    },
  })
}
