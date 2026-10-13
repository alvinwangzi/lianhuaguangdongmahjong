// 「花牌玩法」花牌状态管理。
// 花牌（春夏秋冬梅兰竹菊）摸到后不进手牌，直接亮出并从牌墙尾补摸；
// 状态与手牌分离，由引擎在摸牌/杠后补摸流程中驱动。
import type { TileType } from '../../core/contracts/types'
import { isFlowerTile } from '../../core/rules/tiles'

export { isFlowerTile }

/** 单个玩家的花牌状态：已亮出的花牌序列（按摸到顺序）。 */
export interface PlayerFlowerState {
  flowers: TileType[]
}

export function createPlayerFlowerState(): PlayerFlowerState {
  return { flowers: [] }
}

/** 把一张花牌亮出（加入花牌区），返回是否成功（非花牌返回 false）。 */
export function revealFlower(state: PlayerFlowerState, tile: TileType): boolean {
  if (!isFlowerTile(tile)) return false
  state.flowers.push(tile)
  return true
}

/** 从手牌中摘出全部花牌并亮出，返回摘出的花牌列表（按手牌顺序）。 */
export function extractFlowers(state: PlayerFlowerState, hand: TileType[]): TileType[] {
  const extracted: TileType[] = []
  for (let index = hand.length - 1; index >= 0; index -= 1) {
    if (isFlowerTile(hand[index])) {
      extracted.unshift(hand[index])
      hand.splice(index, 1)
    }
  }
  state.flowers.push(...extracted)
  return extracted
}

/** 全场花牌状态：按座位索引。 */
export interface FlowerBoardState {
  bySeat: PlayerFlowerState[]
}

export function createFlowerBoardState(seatCount = 4): FlowerBoardState {
  return { bySeat: Array.from({ length: seatCount }, () => createPlayerFlowerState()) }
}
