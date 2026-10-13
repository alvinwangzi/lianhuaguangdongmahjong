import { describe, expect, it } from 'vitest'
import { BASE_SCORE } from '../../core/rules/rules'
import { DEFAULT_FLOWER_SCORING, flowerScoreContribution } from './flowerScoring'

describe('flowerScoreContribution', () => {
  it('没有花牌时全部为零（红中/数牌被过滤，不进花牌计分）', () => {
    expect(flowerScoreContribution([], BASE_SCORE)).toEqual({
      flowerCount: 0, flowerPoints: 0, bonusMultiplier: 0, details: [],
    })
    expect(flowerScoreContribution(['red', 'red', 'm1', 'east'], BASE_SCORE).flowerCount).toBe(0)
  })

  it('每张花牌按 perFlower × 底分计分，默认 1 张 = 一份底分', () => {
    const result = flowerScoreContribution(['spring'], BASE_SCORE)
    expect(result.flowerCount).toBe(1)
    expect(result.flowerPoints).toBe(BASE_SCORE)
    expect(result.bonusMultiplier).toBe(0)
    expect(result.details).toEqual([{ label: '花牌 1 张', points: BASE_SCORE }])
  })

  it('张数线性累加，底分参数可变', () => {
    expect(flowerScoreContribution(['spring', 'plum', 'autumn'], BASE_SCORE).flowerPoints).toBe(3 * BASE_SCORE)
    expect(flowerScoreContribution(['spring', 'plum'], 50).flowerPoints).toBe(100)
  })

  it('perFlower 可配置：每张算多份底分', () => {
    const result = flowerScoreContribution(['spring', 'summer'], BASE_SCORE, { perFlower: 2 })
    expect(result.flowerPoints).toBe(4 * BASE_SCORE)
  })

  it('集齐四季组额外加番', () => {
    const result = flowerScoreContribution(['spring', 'summer', 'autumn', 'winter'], BASE_SCORE)
    expect(result.flowerCount).toBe(4)
    expect(result.bonusMultiplier).toBe(DEFAULT_FLOWER_SCORING.groupBonus)
    expect(result.details[1]).toEqual({ label: '四季俱全', multiplier: DEFAULT_FLOWER_SCORING.groupBonus })
  })

  it('集齐四卉组额外加番', () => {
    const result = flowerScoreContribution(['plum', 'orchid', 'bamboo', 'chrysanthemum'], BASE_SCORE)
    expect(result.bonusMultiplier).toBe(DEFAULT_FLOWER_SCORING.groupBonus)
    expect(result.details[1].label).toBe('四卉齐开')
  })

  it('两组全收：组番各算一次 + 八花齐放加番', () => {
    const all = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'bamboo', 'chrysanthemum'] as const
    const result = flowerScoreContribution([...all], BASE_SCORE)
    expect(result.flowerCount).toBe(8)
    // 2 组 × groupBonus(1) + fullSetBonus(2)
    expect(result.bonusMultiplier).toBe(4)
    expect(result.details.map(d => d.label)).toEqual(['花牌 8 张', '四季俱全 · 四卉齐开', '八花齐放'])
  })

  it('不重复计花：7 张不算八花齐放', () => {
    const seven = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'bamboo'] as const
    const result = flowerScoreContribution([...seven], BASE_SCORE)
    expect(result.bonusMultiplier).toBe(1) // 只有四季组番
    expect(result.details.map(d => d.label)).not.toContain('八花齐放')
  })

  it('组番与八花加番均可配置为 0', () => {
    const all = ['spring', 'summer', 'autumn', 'winter', 'plum', 'orchid', 'bamboo', 'chrysanthemum'] as const
    const result = flowerScoreContribution([...all], BASE_SCORE, { groupBonus: 0, fullSetBonus: 0 })
    expect(result.bonusMultiplier).toBe(0)
    expect(result.flowerPoints).toBe(8 * BASE_SCORE)
  })

  it('重复张不算组（每张花牌全场仅一张，重复视为脏数据仍按张计分）', () => {
    // 4 张 spring：flowerCount 4，但四季组不成立（缺另外三张）
    const result = flowerScoreContribution(['spring', 'spring', 'spring', 'spring'], BASE_SCORE)
    expect(result.flowerCount).toBe(4)
    expect(result.bonusMultiplier).toBe(0)
  })
})
