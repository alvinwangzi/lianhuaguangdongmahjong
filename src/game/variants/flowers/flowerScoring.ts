// 「花牌玩法」花牌计分。
// 计分结构（可配置）：每张花牌加一份底分；集齐一组（春夏秋冬 / 梅兰竹菊）各加一组番；
// 八张全收额外加番。番数按广麻口径折算成分数（× 底分），叠加在胡牌基础分之上。
import type { FlowerTile, TileType } from '../../core/contracts/types'
import { isFlowerTile } from '../../core/rules/tiles'
import type { ScoreHandDetail } from '../../core/rules/ruleset'

export interface FlowerScoringConfig {
  /** 每张花牌加的底分份数（默认 1）。 */
  perFlower?: number
  /** 集齐一组（四季 / 四卉）额外加番（默认 1，两组齐则各算一次）。 */
  groupBonus?: number
  /** 八张花牌全收额外加番（默认 2）。 */
  fullSetBonus?: number
}

export const DEFAULT_FLOWER_SCORING: Required<FlowerScoringConfig> = {
  perFlower: 1,
  groupBonus: 1,
  fullSetBonus: 2,
}

const SEASON_GROUP: FlowerTile[] = ['spring', 'summer', 'autumn', 'winter']
const FLORA_GROUP: FlowerTile[] = ['plum', 'orchid', 'bamboo', 'chrysanthemum']

export interface FlowerScoreContribution {
  /** 已亮花牌张数。 */
  flowerCount: number
  /** 亮花底分部分：张数 × perFlower × 底分。 */
  flowerPoints: number
  /** 组集加番合计（不含每张底分），折分时 × 底分。 */
  bonusMultiplier: number
  /** 结算明细行（追加在胡牌番型明细之后）。 */
  details: ScoreHandDetail[]
}

/**
 * 纯计算：给定已亮花牌列表与底分，算出花牌部分的加成。
 * 非花牌条目会被忽略（红中花副由广麻红中逻辑另行计分，不进这里）。
 */
export function flowerScoreContribution(
  tiles: readonly TileType[],
  baseScore: number,
  config: FlowerScoringConfig = {},
): FlowerScoreContribution {
  const cfg = { ...DEFAULT_FLOWER_SCORING, ...config }
  const flowers = tiles.filter(isFlowerTile)
  const count = flowers.length
  const details: ScoreHandDetail[] = []
  if (count === 0) return { flowerCount: 0, flowerPoints: 0, bonusMultiplier: 0, details }

  const flowerPoints = count * cfg.perFlower * baseScore
  details.push({ label: `花牌 ${count} 张`, points: flowerPoints })

  let bonusMultiplier = 0
  const hasSeason = SEASON_GROUP.every((tile) => flowers.includes(tile))
  const hasFlora = FLORA_GROUP.every((tile) => flowers.includes(tile))
  const groups = (hasSeason ? 1 : 0) + (hasFlora ? 1 : 0)
  if (groups > 0) {
    bonusMultiplier += groups * cfg.groupBonus
    details.push({
      label: hasSeason && hasFlora ? '四季俱全 · 四卉齐开' : hasSeason ? '四季俱全' : '四卉齐开',
      multiplier: groups * cfg.groupBonus,
    })
  }
  if (count >= 8) {
    bonusMultiplier += cfg.fullSetBonus
    details.push({ label: '八花齐放', multiplier: cfg.fullSetBonus })
  }
  return { flowerCount: count, flowerPoints, bonusMultiplier, details }
}
