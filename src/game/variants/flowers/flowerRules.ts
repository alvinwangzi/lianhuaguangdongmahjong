// 「花牌玩法」规则集：经典广麻 + 花牌。
// 胡牌判定不需要排除花牌——花牌在流程层就不进手牌（摸到即亮出补摸），
// 因此 isWinningHand / waitingTiles / canRobKong 与经典广麻完全一致；
// 计分在经典 scoreHand 结果上叠加花牌加成（亮花底分 + 组集加番）。
import { BASE_SCORE, DEFAULT_RULESET } from '../../core/rules/rules'
import { withRuleSetOverrides, type RuleSet, type ScoreHandOptions, type ScoreHandResult } from '../../core/rules/ruleset'
import { flowerScoreContribution, type FlowerScoringConfig } from './flowerScoring'

/** 花牌玩法规则集：在经典广麻之上叠加花牌计分。 */
export function createFlowerRuleset(scoring: FlowerScoringConfig = {}): RuleSet {
  return withRuleSetOverrides(DEFAULT_RULESET, {
    id: 'lotus-flowers',
    score: {
      ...DEFAULT_RULESET.score,
      scoreHand(options: ScoreHandOptions): ScoreHandResult {
        const base = DEFAULT_RULESET.score.scoreHand(options)
        const contribution = flowerScoreContribution(options.flowerTiles ?? [], BASE_SCORE, scoring)
        if (contribution.flowerCount === 0) return base
        const bonusPoints = contribution.bonusMultiplier * BASE_SCORE
        return {
          ...base,
          multiplier: base.multiplier + contribution.bonusMultiplier,
          totalMultiplier: base.totalMultiplier + contribution.bonusMultiplier,
          flowerPoints: contribution.flowerPoints + bonusPoints,
          points: base.points + contribution.flowerPoints + bonusPoints,
          details: [...base.details, ...contribution.details],
        }
      },
    },
  })
}

export const FLOWER_RULESET: RuleSet = createFlowerRuleset()
