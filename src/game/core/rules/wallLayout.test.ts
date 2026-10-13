import { describe, expect, it } from 'vitest'
import { WALL_STACKS, WALL_TOTAL, WALL_TOTAL_FLOWERS, wallBreakIndex, wallBreakIndexForDealer, wallGeometryFor, wallStackSlot, wallTilePlacement } from './wallLayout'

describe('wall break index', () => {
  it('determines the wall by dice sum: 5/9→庄, 2/6/10→下, 3/7/11→对, 4/8/12→上', () => {
    // 庄家墙=近段[0,33]，下家=右段[102,135]，对家=远段[68,101]，上家=左段[34,67]
    expect(wallBreakIndex([5, 4])).toBeGreaterThanOrEqual(0)   // sum 9 → 庄家段
    expect(wallBreakIndex([5, 4])).toBeLessThan(34)
    expect(wallBreakIndex([2, 4])).toBeGreaterThanOrEqual(102) // sum 6 → 下家段
    expect(wallBreakIndex([2, 4])).toBeLessThan(136)
    expect(wallBreakIndex([1, 6])).toBeGreaterThanOrEqual(68)  // sum 7 → 对家段
    expect(wallBreakIndex([1, 6])).toBeLessThan(102)
    expect(wallBreakIndex([4, 4])).toBeGreaterThanOrEqual(34)  // sum 8 → 上家段
    expect(wallBreakIndex([4, 4])).toBeLessThan(68)
  })

  it('starts at column n+1 where n = the smaller die', () => {
    // [3,5]: sum 8 → 上家(段起点34)，n=3 → 34 + 3×2 = 40
    expect(wallBreakIndex([3, 5])).toBe(40)
    // [1,1]: sum 2 → 下家(段起点102)，n=1 → 102 + 2 = 104
    expect(wallBreakIndex([1, 1])).toBe(104)
    // [6,6]: sum 12 → 上家(段起点34)，n=6 → 34 + 12 = 46
    expect(wallBreakIndex([6, 6])).toBe(46)
    // [5,4]: sum 9 → 庄家(段起点0)，n=4 → 0 + 8 = 8
    expect(wallBreakIndex([5, 4])).toBe(8)
  })

  it('defaults missing dice to 1 (like the prop default [1, 1])', () => {
    expect(wallBreakIndex([undefined, undefined])).toBe(104)
  })
})

describe('wall tile placement', () => {
  it('pairs adjacent tiles into the same 墩, drawing the top tile first', () => {
    expect(wallTilePlacement(0, 0)).toEqual({ stackIndex: 0, layer: 1 })  // 先抓顶牌
    expect(wallTilePlacement(1, 0)).toEqual({ stackIndex: 0, layer: 0 })  // 再抓底牌
    expect(wallTilePlacement(2, 0)).toEqual({ stackIndex: 1, layer: 1 })
    expect(wallTilePlacement(3, 0)).toEqual({ stackIndex: 1, layer: 0 })
  })

  it('advances the head clockwise as tiles are drawn (headOffset grows)', () => {
    // 先抓了顶牌（physical 0）后，堆 0 只剩底牌（physical 1）
    expect(wallTilePlacement(0, 1)).toEqual({ stackIndex: 0, layer: 0 })
    expect(wallTilePlacement(1, 1)).toEqual({ stackIndex: 1, layer: 1 })
    // 抽走两张后 head 移到下一墩，先抓其顶牌
    expect(wallTilePlacement(0, 2)).toEqual({ stackIndex: 1, layer: 1 })
  })

  it('wraps at 136', () => {
    expect(wallTilePlacement(0, 136)).toEqual(wallTilePlacement(0, 0))
    expect(wallTilePlacement(0, 135)).toEqual({ stackIndex: 67, layer: 0 })
  })

  it('has no fixed reserved tail; only the current tail stack is arranged for kong draws', () => {
    // 初始牌尾：pop() 先拿 index 135（顶），再拿 index 134（底）。
    expect(wallTilePlacement(134, 0, 136)).toEqual({ stackIndex: 67, layer: 1 })
    expect(wallTilePlacement(135, 0, 136)).toEqual({ stackIndex: 67, layer: 0 })
    // 补走一张后，同墩只剩底牌；补完一墩后，新的当前尾墩才翻成顶/底顺序。
    expect(wallTilePlacement(134, 0, 135, 0)).toEqual({ stackIndex: 67, layer: 0 })
    expect(wallTilePlacement(132, 0, 134, 0)).toEqual({ stackIndex: 66, layer: 1 })
    expect(wallTilePlacement(133, 0, 134, 0)).toEqual({ stackIndex: 66, layer: 0 })
  })
})

describe('wall stack ring', () => {
  it('places stack 0 at the near (bottom) right end = draw head', () => {
    const s = wallStackSlot(0)
    expect(s.x).toBeGreaterThan(0)          // 右端
    expect(s.z).toBeCloseTo(5.17, 5)        // 近侧（正方形环的底边）
    expect(s.rotationY).toBeCloseTo(0, 5)   // 径向：长边沿 z（指向桌中心）
  })

  it('advances clockwise near → left → far → right', () => {
    const near = wallStackSlot(0)
    const left = wallStackSlot(17)
    const far = wallStackSlot(34)
    const right = wallStackSlot(51)
    expect(near.z).toBeCloseTo(5.17, 5)
    expect(Math.abs(left.x)).toBeCloseTo(6.82, 5)
    expect(far.z).toBeCloseTo(-8.47, 5)
    expect(Math.abs(right.x)).toBeCloseTo(6.82, 5)
    expect(left.x).toBeLessThan(0)
    expect(right.x).toBeGreaterThan(0)
    // 侧墙径向：长边沿 x（指向桌中心）
    expect(right.rotationY).toBeCloseTo(Math.PI / 2, 5)
  })

  it('spaces consecutive stacks one tile-width apart within a segment', () => {
    const near0 = wallStackSlot(0)
    const near1 = wallStackSlot(1)
    expect(Math.hypot(near0.x - near1.x, near0.z - near1.z)).toBeCloseTo(0.68, 5)
    const left0 = wallStackSlot(17)
    const left1 = wallStackSlot(18)
    expect(Math.hypot(left0.x - left1.x, left0.z - left1.z)).toBeCloseTo(0.68, 5)
  })

  it('keeps every stack inside the playing surface', () => {
    for (let s = 0; s < WALL_STACKS; s += 1) {
      const { x, z } = wallStackSlot(s)
      expect(Math.abs(x)).toBeLessThanOrEqual(10.5)
      expect(z).toBeGreaterThanOrEqual(-12.1)
      expect(z).toBeLessThanOrEqual(8.9)
    }
  })

  it('wraps modulo 68', () => {
    expect(wallStackSlot(WALL_STACKS)).toEqual(wallStackSlot(0))
    expect(wallStackSlot(-1)).toEqual(wallStackSlot(WALL_STACKS - 1))
  })
})

describe('wallBreakIndexForDealer（按庄家拆墙）', () => {
  it('dealer=0 时与兼容包装 wallBreakIndex 完全一致', () => {
    for (const d1 of [1, 2, 3, 4, 5, 6]) {
      for (const d2 of [1, 2, 3, 4, 5, 6]) {
        expect(wallBreakIndexForDealer([d1, d2], 0)).toBe(wallBreakIndex([d1, d2]))
      }
    }
  })

  it('按真实庄家换算绝对墙段：点数和决定拆相对庄家的墙', () => {
    // sum=9 → 拆庄家墙；庄家=座位1（右墙起点 102），n=min(5,4)=4 → 102+8=110
    expect(wallBreakIndexForDealer([5, 4], 1)).toBe(110)
    // sum=6 → 拆下家墙（相对=1）；庄家=座位1 → 绝对座位 2（远墙起点 68），n=2 → 68+4=72
    expect(wallBreakIndexForDealer([2, 4], 1)).toBe(72)
    // sum=7 → 拆对家墙（相对=2）；庄家=座位2 → 绝对座位 0（近墙起点 0），n=1 → 0+2=2
    expect(wallBreakIndexForDealer([1, 6], 2)).toBe(2)
  })

  it('墙段起点数组与座位-方位映射一致（近/右/远/左）', () => {
    // 座位 s 的墙段起点张位 = [0,102,68,34][s]（近/右/远/左），对应 wallStackSlot 槽位 0/51/34/17
    const starts = [0, 102, 68, 34]
    const slots = [0, 51, 34, 17]
    starts.forEach((start, seat) => {
      expect(wallStackSlot(start / 2).z).toBe(wallStackSlot(slots[seat]).z)
      expect(wallStackSlot(start / 2).x).toBe(wallStackSlot(slots[seat]).x)
    })
  })
})

describe('含花牌牌墙（144 张 / 72 墩）参数化', () => {
  const geometry = wallGeometryFor(WALL_TOTAL_FLOWERS)

  it('wallGeometryFor 按总数推导墩数与段半长；默认不回归 136', () => {
    expect(geometry).toEqual({ total: 144, stacks: 72, stacksPerSide: 18, segmentHalf: (18 - 1) * 0.68 / 2 })
    expect(wallGeometryFor()).toEqual({ total: 136, stacks: 68, stacksPerSide: 17, segmentHalf: (17 - 1) * 0.68 / 2 })
  })

  it('按 144 环换算拆墙点：段起点 0/108/72/36', () => {
    // [5,4]: sum 9 → 庄家段[0,35]，n=4 → 0+8=8
    expect(wallBreakIndexForDealer([5, 4], 0, WALL_TOTAL_FLOWERS)).toBe(8)
    // [2,4]: sum 6 → 下家段起点 108，n=2 → 112
    expect(wallBreakIndexForDealer([2, 4], 0, WALL_TOTAL_FLOWERS)).toBe(112)
    // [1,6]: sum 7 → 对家段起点 72，n=1 → 74
    expect(wallBreakIndexForDealer([1, 6], 0, WALL_TOTAL_FLOWERS)).toBe(74)
    // [4,4]: sum 8 → 上家段起点 36，n=4 → 44
    expect(wallBreakIndexForDealer([4, 4], 0, WALL_TOTAL_FLOWERS)).toBe(44)
    // 庄家=座位 1（右段起点 108）：sum 9 → 108+8=116
    expect(wallBreakIndexForDealer([5, 4], 1, WALL_TOTAL_FLOWERS)).toBe(116)
  })

  it('wallTilePlacement 在 144 张环上成墩配对且按总数回卷', () => {
    expect(wallTilePlacement(0, 0, WALL_TOTAL_FLOWERS, 0, WALL_TOTAL_FLOWERS)).toEqual({ stackIndex: 0, layer: 1 })
    expect(wallTilePlacement(1, 0, WALL_TOTAL_FLOWERS, 0, WALL_TOTAL_FLOWERS)).toEqual({ stackIndex: 0, layer: 0 })
    // 尾墩：物理张位 142/143 → 墩 71
    expect(wallTilePlacement(142, 0, WALL_TOTAL_FLOWERS, 0, WALL_TOTAL_FLOWERS)).toEqual({ stackIndex: 71, layer: 1 })
    expect(wallTilePlacement(143, 0, WALL_TOTAL_FLOWERS, 0, WALL_TOTAL_FLOWERS)).toEqual({ stackIndex: 71, layer: 0 })
    // 回卷：physicalHead=144 等价 0
    expect(wallTilePlacement(0, WALL_TOTAL_FLOWERS, WALL_TOTAL_FLOWERS, 0, WALL_TOTAL_FLOWERS)).toEqual({ stackIndex: 0, layer: 1 })
  })

  it('wallStackSlot 按 72 墩几何铺满四边、墩距不变', () => {
    expect(wallStackSlot(0, geometry).z).toBeCloseTo(5.17, 5)
    expect(Math.abs(wallStackSlot(18, geometry).x)).toBeCloseTo(6.82, 5)   // 左墙起点
    expect(wallStackSlot(36, geometry).z).toBeCloseTo(-8.47, 5)            // 远墙起点
    expect(Math.abs(wallStackSlot(54, geometry).x)).toBeCloseTo(6.82, 5)   // 右墙起点
    // 相邻墩间距仍是 0.68（每边 18 墩）
    expect(Math.hypot(
      wallStackSlot(0, geometry).x - wallStackSlot(1, geometry).x,
      wallStackSlot(0, geometry).z - wallStackSlot(1, geometry).z,
    )).toBeCloseTo(0.68, 5)
    // 回卷按 72 墩取模（不与 68 墩几何混用）
    expect(wallStackSlot(72, geometry)).toEqual(wallStackSlot(0, geometry))
  })

  it('72 墩全部落在牌面范围内且不重叠（相邻墩 x/z 距离 ≥ 0.68）', () => {
    for (let s = 0; s < 72; s += 1) {
      const { x, z } = wallStackSlot(s, geometry)
      expect(Math.abs(x)).toBeLessThanOrEqual(10.5)
      expect(z).toBeGreaterThanOrEqual(-12.1)
      expect(z).toBeLessThanOrEqual(8.9)
      if (s > 0) {
        const prev = wallStackSlot(s - 1, geometry)
        expect(Math.hypot(prev.x - x, prev.z - z)).toBeGreaterThanOrEqual(0.68 - 1e-9)
      }
    }
  })
})
