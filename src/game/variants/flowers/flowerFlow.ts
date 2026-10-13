// 「花牌玩法」摸花→亮出→补摸流程。
// 摸到花牌不进手牌：亮出（花副）→ 报牌音 → 从牌墙尾补摸；补摸仍是花牌则循环。
// 开局发牌同理：发到手里的花牌全部摘出补摸，无张数上限（红中逻辑不受影响，两层叠加）。
import type { TileType } from '../../core/contracts/types'
import { isFlowerTile } from '../../core/rules/tiles'
import { PACE_MS } from '../../core/local/localGameConfig'
import type { LocalDealSpecialsDeps } from '../../core/local/localOpeningTimeline'
import type { LocalSpecialDrawDeps, SpecialDrawHandler } from '../../core/local/localTileFlowExecutor'

/**
 * 摸牌阶段的特殊摸牌处理：摸到花牌 → 亮出 → 播放「补花」音效 → 从牌尾补摸。
 * 返回 undefined 表示不是花牌，交给后续（默认红中）逻辑处理。
 * 如果牌墙已空（摸到最后一张是花牌），无法补花，不播放音效。
 */
export function createFlowerSpecialDraw(deps: LocalSpecialDrawDeps): SpecialDrawHandler {
  return async (playerIndex, tile, drawAgain) => {
    if (!isFlowerTile(tile)) return undefined
    const player = deps.state.players[playerIndex]
    player.melds.push({ type: 'flower', tile, tiles: [tile] })
    deps.showTableAction('flower-gang', playerIndex, null, tile, player.melds.length - 1)
    // 检查牌墙是否还有牌可补
    if (deps.state.wall.value.length > 0) {
      // 局中摸花：播放「补花」音效后补摸
      await Promise.all([
        deps.playSoundAndWait('buhua.mp3'),
        deps.wait(PACE_MS.redKongDraw),
      ])
    }
    if (deps.state.phase.value === 'settled') return false
    return drawAgain()
  }
}

/**
 * 开局发牌后的摘花补摸：从庄家开始轮流，每次补花时播放「补花」音效。
 * 如果牌墙已空（最后一张是花牌），无法补花，不播放音效。
 * 花牌没有「集齐即胜」之类的即时结束条件，恒返回 -1。
 */
export function createFlowerDealSpecials({ state, takeTile, playSoundAndWait, wait }: LocalDealSpecialsDeps): () => number | Promise<number> {
  return async () => {
    const seatOrder = state.players.map(
      (_, offset) => (state.dealer.value + offset) % state.players.length,
    )
    for (const playerIndex of seatOrder) {
      const player = state.players[playerIndex]
      // 摘出所有花牌并补摸
      for (;;) {
        const index = player.hand.findIndex((tile: TileType) => isFlowerTile(tile))
        if (index < 0) break
        const flower = player.hand[index]
        player.hand.splice(index, 1)
        player.melds.push({ type: 'flower', tile: flower, tiles: [flower] })
        // 检查牌墙是否还有牌可补
        if (state.wall.value.length > 0) {
          // 播放「补花」音效
          if (playSoundAndWait) {
            await playSoundAndWait('buhua.mp3')
          }
          if (wait) {
            await wait(PACE_MS.redKongDraw)
          }
          const replacement = takeTile(true)
          if (replacement) player.hand.push(replacement)
        } else {
          // 牌墙空了，无法补花
          break
        }
      }
    }
    return -1
  }
}
