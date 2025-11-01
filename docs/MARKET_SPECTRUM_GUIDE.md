# 市场阴阳谱页面与控件重构说明

本文档记录 `MarketSpectrum` 页面功能、数据来源、交互设计以及与其它控件重构的关键点，便于维护与扩展。

## 1. 页面目的
展示一段时间内市场的阳谱(上涨占比)与阴谱(下跌或未达标占比)趋势，帮助快速判断市场参与热度与情绪拐点。

## 2. 数据来源
- 后端接口：`GET /api/market-spectrum?start_date=YYYYMMDD&end_date=YYYYMMDD`
- 返回字段（示例）：
```json
{
  "trade_date": "20251031",
  "yang_spectrum": 0.42,
  "yin_spectrum": 0.58,
  "above_ma5_count": 123,
  "below_ma5_count": 170,
  "total_stocks": 293
}
```
- 前端在接收后按 `trade_date` 升序排序并转换日期格式 `YYYY-MM-DD` 展示。

## 3. 指标含义
| 字段 | 说明 |
|------|------|
| `yang_spectrum` | 上涨或满足定义条件的股票占比 (0-1) |
| `yin_spectrum`  | 下跌或未满足定义条件的股票占比 (0-1) |
| `above_ma5_count` | 高于 MA5 的股票数量 |
| `below_ma5_count` | 低于 MA5 的股票数量 |
| `total_stocks` | 统计范围内总股票数 |

> 目前图表保留 35% 与 50% 的虚线阈值（银/金手指阈值），但不再显示“首次”标记，避免语义歧义。

## 4. 前端实现要点
- 组件文件：`dashboard/src/components/MarketSpectrum.vue`
- 使用 `echarts` 绘制阳谱与阴谱折线 + 面积图。
- 使用 `dataZoom` 提供滚动/滑块查看长区间数据。
- 使用 `v-show` 保持图表容器 DOM，避免初始化时 ref 为空。
- 初次加载默认区间：最近 30 天。

### 4.1 关键函数
| 函数 | 作用 |
|------|------|
| `fetchSpectrum()` | 根据当前日期范围请求数据并刷新图表 |
| `updateChart()` | 初始化/更新 ECharts 实例配置与数据 |
| `setQuickRange(days)` | 快捷设置最近 N 天日期并触发刷新 |
| `refreshCurrent()` | 重新加载当前日期范围 |

### 4.2 图表配置摘录
```js
const option = {
  grid: { left: '6%', right: '4%', top: 50, bottom: 70 },
  dataZoom: [ { type: 'slider' }, { type: 'inside' } ],
  xAxis: { type: 'category', boundaryGap: false },
  yAxis: { type: 'value', min: 0, max: 1 },
  series: [ /* 阳谱与阴谱折线 */ ]
}
```

## 5. 控件重构总结
- `StockRankingControls.vue` 使用 computed + v-model 包装，减少手动事件处理冗余。
- 通过统一的内部状态 `internalXXX` 与外部 `props/emits` 保持可维护性。
- 调试阶段临时 overlay 与日志已移除，生产代码更简洁。

## 6. 可扩展建议
| 方向 | 描述 |
|------|------|
| 后端预计算 | 在生成数据时直接写入是否触发银/金手指标记字段，减少前端逻辑耦合。 |
| 多图联动 | 与其它指数或热点板块折线进行联动对比。 |
| 导出功能 | 增加 CSV/PNG 导出按钮以便分享分析报告。 |
| 指标拓展 | 引入涨跌幅分位数、换手率热度、板块扩散度等维度。 |
| 自定义阈值 | 用户可在设置面板调整银/金手指判定阈值并即时重绘。 |

## 7. 常见问题 FAQ
| 问题 | 解决方案 |
|------|----------|
| 图表不显示 | 检查接口返回结构是否含 `data` 数组；确认容器未被隐藏；查看控制台是否有 JS 报错。 |
| 数据日期错序 | 确保前端排序 `arr.sort((a,b) => a.trade_date.localeCompare(b.trade_date))`。 |
| 缩放后图例遮挡 | 调整 `grid.bottom` 或 `dataZoom.height`。 |
| 需要更多天数 | 使用快捷按钮或手动日期输入，建议分段查看避免过密。 |

## 8. 后续待办（文档相关）
- 将本页面在主 README 的“功能说明”章节添加链接。
- 补充后端计算流程图（待生成）。

---
最后更新：2025-11-01
