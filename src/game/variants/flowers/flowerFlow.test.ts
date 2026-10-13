import { describe, expect, it, vi } from 'vitest'
import type { GamePlayer } from '../../core/contracts/types'
import { createLocalGameState } from '../../core/local/localGameState'
import type { LocalGameState } from '../../core/local/localGameState'
import type { LocalDealSpecialsDeps } from '../../core/local/localOpeningTimeline'
import type { LocalSpecialDrawDeps } from '../../core/local/localTileFlowExecutor'
import { createFlowerDealSpecials, createFlowerSpecialDraw } from './flowerFlow'

function makePlayer(seat: number, hand: GamePlayer['hand'] = []): GamePlayer {
  return {
    name: `P${seat}`, avatar: '', score: 0, seat,
    hand: [...hand], concealedTileCount: hand.length,
    discards: [], melds: [], redCount: 0, drawnTileIndex: -1,
  }
}

function makeState(dealer = 0): LocalGameState {
  const state = createLocalGameState()
  state.phase.value = 'playing'
  state.dealer.value = dealer
  // 默认填充牌墙（测试用例可按需覆盖）
  state.wall.value = Array.from({ length: 144 }, () => 'east' as const)
  for (let seat = 0; seat < 4; seat += 1) state.players.push(makePlayer(seat))
  return state
}

function makeSpecialDeps(state: LocalGameState): LocalSpecialDrawDeps {
  return {
    state,
    showTableAction: vi.fn(),
    playSound: vi.fn(),
    playSoundAndWait: vi.fn(async () => {}),
    wait: vi.fn(async () => {}),
    endGame: vi.fn(),
  }
}

function makeDealDeps(state: LocalGameState, tail: GamePlayer['hand'] = []): LocalDealSpecialsDeps {
  let cursor = 0
  return {
    state,
    takeTile: vi.fn(() => (cursor < tail.length ? tail[cursor++] : null)),
    playSoundAndWait: vi.fn(async () => {}),
    wait: vi.fn(async () => {}),
  }
}

describe('createFlowerSpecialDraw（摸花→亮出→补摸）', () => {
  it('非花牌（含红中）返回 undefined，落回默认红中逻辑', async () => {
    const state = makeState()
    const handler = createFlowerSpecialDraw(makeSpecialDeps(state))
    const drawAgain = vi.fn(async () => true)
    await expect(handler(0, 'm1', drawAgain)).resolves.toBeUndefined()
    await expect(handler(0, 'red', drawAgain)).resolves.toBeUndefined()
    expect(drawAgain).not.toHaveBeenCalled()
    expect(state.players[0].melds).toHaveLength(0)
  })

  it('摸到花牌：亮出花副 + flower-gang 报牌 + 播放补花音效', async () => {
    const state = makeState()
    const deps = makeSpecialDeps(state)
    const drawAgain = vi.fn(async () => true)
    await expect(createFlowerSpecialDraw(deps)(2, 'spring', drawAgain)).resolves.toBe(true)
    expect(state.players[2].melds).toEqual([
      { type: 'flower', tile: 'spring', tiles: ['spring'] },
    ])
    expect(deps.showTableAction).toHaveBeenCalledWith('flower-gang', 2, null, 'spring', 0)
    expect(deps.playSoundAndWait).toHaveBeenCalledWith('buhua.mp3') // 局中摸花播放补花音效
    expect(drawAgain).toHaveBeenCalledTimes(1)
  })

  it('牌墙空时（摸到最后一张是花牌）不播放补花音效', async () => {
    const state = makeState()
    state.wall.value = [] // 牌墙空
    const deps = makeSpecialDeps(state)
    const drawAgain = vi.fn(async () => false)
    await expect(createFlowerSpecialDraw(deps)(0, 'spring', drawAgain)).resolves.toBe(false)
    expect(state.players[0].melds.map(m => m.tile)).toEqual(['spring'])
    expect(deps.playSoundAndWait).not.toHaveBeenCalled() // 牌墙空不播
  })

  it('补摸仍是花牌则继续亮出（drawAgain 递归）', async () => {
    const state = makeState()
    const handler = createFlowerSpecialDraw(makeSpecialDeps(state))
    // 模拟：第一次补摸摸到 winter，再次亮出后才结束
    const drawAgain = vi.fn()
      .mockResolvedValueOnce(true)
    await handler(1, 'plum', drawAgain)
    await handler(1, 'winter', drawAgain)
    expect(state.players[1].melds.map(m => m.tile)).toEqual(['plum', 'winter'])
    expect(drawAgain).toHaveBeenCalledTimes(2)
  })

  it('补摸期间本局已结算则不再补摸（返回 false）', async () => {
    const state = makeState()
    state.phase.value = 'settled'
    const deps = makeSpecialDeps(state)
    const drawAgain = vi.fn(async () => true)
    await expect(createFlowerSpecialDraw(deps)(0, 'orchid', drawAgain)).resolves.toBe(false)
    expect(drawAgain).not.toHaveBeenCalled()
  })
})

describe('createFlowerDealSpecials（开局摘花补摸）', () => {
  it('开局摘花：每次补花播放一次补花音效，牌墙空时不播', async () => {
    const state = makeState(0)
    state.players[0].hand = ['spring', 'summer', 'm1'] // 2 张花
    state.players[1].hand = ['m2', 'm3', 'm4']          // 无花
    state.players[2].hand = ['plum', 'm5']               // 1 张花
    const deps = makeDealDeps(state, ['m9', 's9', 'p6'])
    await expect(createFlowerDealSpecials(deps)()).resolves.toBe(-1)
    // 玩家 0 补花 2 次，玩家 2 补花 1 次，共 3 次
    expect(deps.playSoundAndWait).toHaveBeenCalledWith('buhua.mp3')
    expect(deps.playSoundAndWait).toHaveBeenCalledTimes(3)
  })

  it('牌墙空时（最后一张是花牌）不播放补花音效', async () => {
    const state = makeState(0)
    state.wall.value = [] // 牌墙空
    state.players[0].hand = ['spring', 'm2']
    const deps = makeDealDeps(state, []) // 牌尾无牌
    await createFlowerDealSpecials(deps)()
    // 摘出花牌后牌墙空了，不播放补花音效
    expect(deps.playSoundAndWait).not.toHaveBeenCalled()
    expect(state.players[0].melds.map(m => m.tile)).toEqual(['spring'])
  })

  it('按庄家顺序摘花：花牌进花副、从牌尾补摸', async () => {
    const state = makeState(0)
    state.players[0].hand = ['spring', 'm1', 'm1']
    state.players[1].hand = ['plum', 'm2']
    const deps = makeDealDeps(state, ['m9', 's9'])
    await expect(createFlowerDealSpecials(deps)()).resolves.toBe(-1)
    expect(state.players[0].hand).toEqual(['m1', 'm1', 'm9'])
    expect(state.players[0].melds.map(m => m.tile)).toEqual(['spring'])
    expect(state.players[1].hand).toEqual(['m2', 's9'])
    expect(state.players[1].melds.map(m => m.tile)).toEqual(['plum'])
    expect(deps.takeTile).toHaveBeenCalledWith(true) // 恒从牌尾补
  })

  it('庄家非 0 时按 dealer 起始轮转处理（补摸顺序跟随庄家）', async () => {
    const state = makeState(2)
    state.players[0].hand = ['winter']
    state.players[2].hand = ['bamboo']
    const order: number[] = []
    const deps = makeDealDeps(state)
    ;(deps.takeTile as ReturnType<typeof vi.fn>).mockImplementation(() => {
      // 记录当前处理到的座位：取 melds 末次更新的玩家
      const actor = state.players.find(p => p.melds.length > 0 && !order.includes(p.seat))
      order.push(actor?.seat ?? -1)
      return null
    })
    await createFlowerDealSpecials(deps)()
    expect(order).toEqual([2, 0])
  })

  it('补摸摸到花牌则继续摘（循环直到手牌无花）', async () => {
    const state = makeState(0)
    state.players[3].hand = ['spring', 'm1']
    const deps = makeDealDeps(state, ['summer', 'autumn'])
    await createFlowerDealSpecials(deps)()
    // summer、autumn 依次补进后均为花牌，继续摘出；第三次补摸无牌停止
    expect(state.players[3].hand).toEqual(['m1'])
    expect(state.players[3].melds.map(m => m.tile)).toEqual(['spring', 'summer', 'autumn'])
  })

  it('手牌无花牌时不消耗牌尾，也不播放补花音效', async () => {
    const state = makeState(0)
    state.players[0].hand = ['m1', 'm2', 'm3']
    const deps = makeDealDeps(state, ['m9'])
    await createFlowerDealSpecials(deps)()
    expect(deps.takeTile).not.toHaveBeenCalled()
    expect(state.players[0].hand).toEqual(['m1', 'm2', 'm3'])
    expect(deps.playSoundAndWait).not.toHaveBeenCalled() // 无花不播
  })
})
