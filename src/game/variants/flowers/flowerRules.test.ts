import { describe, expect, it } from 'vitest'
import { BASE_SCORE, DEFAULT_RULESET } from '../../core/rules/rules'
import type { ScoreHandOptions } from '../../core/rules/ruleset'
import { createFlowerRuleset, FLOWER_RULESET } from './flowerRules'

describe('createFlowerRuleset / FLOWER_RULESET', () => {
  it('规则集 id 为 lotus-flowers，其余能力沿用经典广麻', () => {
    expect(FLOWER_RULESET.id).toBe('lotus-flowers')
    expect(FLOWER_RULESET.baseScore).toBe(DEFAULT_RULESET.baseScore)
    expect(FLOWER_RULESET.flow).toEqual(DEFAULT_RULESET.flow)
    expect(FLOWER_RULESET.win.isWinningHand).toBe(DEFAULT_RULESET.win.isWinningHand)
  })

  it('无花牌时与经典广麻计分完全一致', () => {
    const options: ScoreHandOptions = { dealer: true, redCount: 1 }
    expect(FLOWER_RULESET.score.scoreHand(options)).toEqual(DEFAULT_RULESET.score.scoreHand(options))
    expect(FLOWER_RULESET.score.scoreHand({}).flowerPoints).toBeUndefined()
  })

  it('花牌底分叠加在经典计分之上', () => {
    const base = DEFAULT_RULESET.score.scoreHand({})
    const result = FLOWER_RULESET.score.scoreHand({ flowerTiles: ['spring', 'plum'] })
    expect(result.points).toBe(base.points + 2 * BASE_SCORE)
    expect(result.multiplier).toBe(base.multiplier)
    expect(result.flowerPoints).toBe(2 * BASE_SCORE)
    expect(result.details.at(-1)).toEqual({ label: '花牌 2 张', points: 2 * BASE_SCORE })
  })

  it('组集加番计入 multiplier 与 points', () => {
    const base = DEFAULT_RULESET.score.scoreHand({})
    const result = FLOWER_RULESET.score.scoreHand({
      flowerTiles: ['spring', 'summer', 'autumn', 'winter'],
    })
    expect(result.totalMultiplier).toBe(base.totalMultiplier + 1)
    // 亮花底分 4 份 + 组番 1 份
    expect(result.points).toBe(base.points + 5 * BASE_SCORE)
    expect(result.flowerPoints).toBe(5 * BASE_SCORE)
  })

  it('红中计分与花牌计分互不干扰（两层叠加）', () => {
    const options: ScoreHandOptions = { redCount: 2, flowerTiles: ['spring', 'orchid'] }
    const base = DEFAULT_RULESET.score.scoreHand({ redCount: 2 })
    const result = FLOWER_RULESET.score.scoreHand(options)
    expect(result.redPoints).toBe(base.redPoints)
    expect(result.points).toBe(base.points + 2 * BASE_SCORE)
  })

  it('计分配置可注入（自定义 perFlower / groupBonus）', () => {
    const ruleset = createFlowerRuleset({ perFlower: 2, groupBonus: 3 })
    const base = DEFAULT_RULESET.score.scoreHand({})
    const result = ruleset.score.scoreHand({ flowerTiles: ['spring', 'summer', 'autumn', 'winter'] })
    expect(result.points).toBe(base.points + (8 + 3) * BASE_SCORE)
  })
})
