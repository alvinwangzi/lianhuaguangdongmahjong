// 「花牌玩法」本地引擎组装：经典广麻引擎 + 花牌插接点。
// 复用 core/local/useGame 全部流程（开局/回合/杠/结算/人类/AI），只注入三处变体差异：
// 1. 牌墙 144 张（createWallWithFlowers）；2. 摸花→亮出→补摸；3. 花牌计分规则集。
import { computed } from 'vue'
import { useGame } from '../../core/local/useGame'
import { WALL_TOTAL_FLOWERS } from '../../core/rules/wallLayout'
import { createWallWithFlowers } from '../../core/rules/tiles'
import { flowerTilesOfMelds } from '../../core/rules/rules'
import type { RuleSet } from '../../core/rules/ruleset'
import { FLOWER_RULESET } from './flowerRules'
import { createFlowerDealSpecials, createFlowerSpecialDraw } from './flowerFlow'

interface UseFlowerGameOptions extends Omit<Parameters<typeof useGame>[0], 'ruleset'> {
  ruleset?: RuleSet
}

export function useFlowerGame(options: UseFlowerGameOptions = {}) {
  const port = useGame({
    ...options,
    ruleset: options.ruleset ?? FLOWER_RULESET,
    createWallTiles: options.createWallTiles ?? (() => createWallWithFlowers()),
    wallTotal: options.wallTotal ?? WALL_TOTAL_FLOWERS,
    // 花牌优先亮出补摸；非花牌落回默认红中逻辑（红中机制保持不变）。
    createSpecialDraw: options.createSpecialDraw ?? ((deps) => createFlowerSpecialDraw(deps)),
    createDealSpecials: options.createDealSpecials ?? ((deps) => createFlowerDealSpecials(deps)),
  })
  // capabilities.flowers：本家已亮花牌（随副露推进自动更新），供 HUD/联机快照读取。
  const capabilities = computed(() => {
    const user = port.user.value
    const tiles = user ? flowerTilesOfMelds(user.melds) : []
    return {
      ...port.capabilities.value,
      flowers: { tiles: [...tiles], count: tiles.length },
    }
  })
  return { ...port, capabilities }
}

export type FlowerGame = ReturnType<typeof useFlowerGame>
