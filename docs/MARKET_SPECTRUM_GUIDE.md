# 市场阴阳谱（Market Spectrum）

Dashboard Tab `spectrum` — 展示市场阳谱/阴谱趋势与 MA5 涨跌家数。

## 数据

- API：`GET /api/market-spectrum?start_date=YYYYMMDD&end_date=YYYYMMDD`
- 前端：`src/components/MarketSpectrum.vue`、`MarketSpectrumChart.vue`
- 默认加载最近 30 天；`trade_date` 升序展示

| 字段 | 含义 |
|------|------|
| `yang_spectrum` | 阳谱占比 (0–1) |
| `yin_spectrum` | 阴谱占比 (0–1) |
| `above_ma5_count` / `below_ma5_count` | 相对 MA5 家数 |
| `total_stocks` | 统计股票数 |

图表含 35% / 50% 参考虚线（银/金手指阈值参考，无「首次触发」标记）。

## 排障

- 图空白：查 API 是否返回 `data` 数组；容器勿用 `v-if` 销毁 chart ref
- 日期乱序：前端需按 `trade_date` 排序

架构与指标扩展想法见 git history（原 2025-11 长文已缩短）。
