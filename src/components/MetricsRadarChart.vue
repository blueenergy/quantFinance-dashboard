<template>
  <div ref="chartRef" class="metrics-chart"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

export default {
  name: 'MetricsRadarChart',
  props: {
    metrics: {
      type: Object,
      required: true,
      default: () => ({})
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chartInstance = null

    const initChart = () => {
      if (!chartRef.value || !props.metrics) return

      if (chartInstance) {
        chartInstance.dispose()
      }

      chartInstance = echarts.init(chartRef.value)

      // 标准化指标到 0-100 的范围
      const normalizeMetrics = () => {
        const metrics = props.metrics
        
        // 收益率: -100% ~ +200% 映射到 0~100
        const returnScore = Math.min(100, Math.max(0, (metrics.total_return || 0) * 100 + 50))
        
        // 夏普比率: -2 ~ 3 映射到 0~100
        const sharpeScore = Math.min(100, Math.max(0, ((metrics.sharpe_ratio || 0) + 2) * 20))
        
        // 最大回撤: 0% ~ -50% 映射到 100~0 (越小越好)
        const drawdownScore = Math.min(100, Math.max(0, 100 + (metrics.max_drawdown || 0) * 200))
        
        // 胜率: 0% ~ 100% 映射到 0~100
        const winRateScore = (metrics.win_rate || 0) * 100
        
        // 盈亏比: 0 ~ 3 映射到 0~100
        const profitLossRatio = metrics.profit_loss_ratio || 0
        const profitLossScore = Math.min(100, profitLossRatio * 33.33)
        
        return {
          return: returnScore.toFixed(1),
          sharpe: sharpeScore.toFixed(1),
          drawdown: drawdownScore.toFixed(1),
          winRate: winRateScore.toFixed(1),
          profitLoss: profitLossScore.toFixed(1)
        }
      }

      const normalized = normalizeMetrics()

      const option = {
        backgroundColor: '#ffffff',
        title: {
          text: '策略表现雷达图',
          left: 'center',
          textStyle: {
            color: '#2c3e50',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: function(params) {
            const metrics = props.metrics
            const indicators = [
              { name: '收益率', value: ((metrics.total_return || 0) * 100).toFixed(2) + '%' },
              { name: '夏普比率', value: (metrics.sharpe_ratio || 0).toFixed(2) },
              { name: '回撤控制', value: ((metrics.max_drawdown || 0) * 100).toFixed(2) + '%' },
              { name: '胜率', value: ((metrics.win_rate || 0) * 100).toFixed(2) + '%' },
              { name: '盈亏比', value: (metrics.profit_loss_ratio || 0).toFixed(2) }
            ]
            
            let result = `<div style="font-weight: bold; margin-bottom: 8px;">策略表现</div>`
            indicators.forEach(ind => {
              result += `
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                  <span>${ind.name}:</span>
                  <span style="font-weight: bold; margin-left: 12px;">${ind.value}</span>
                </div>
              `
            })
            return result
          }
        },
        radar: {
          indicator: [
            { name: '收益率', max: 100 },
            { name: '夏普比率', max: 100 },
            { name: '回撤控制', max: 100 },
            { name: '胜率', max: 100 },
            { name: '盈亏比', max: 100 }
          ],
          shape: 'polygon',
          center: ['50%', '55%'],
          radius: '65%',
          splitNumber: 5,
          axisName: {
            color: '#606266',
            fontSize: 13
          },
          splitLine: {
            lineStyle: {
              color: '#e4e7ed'
            }
          },
          splitArea: {
            show: true,
            areaStyle: {
              color: ['#f8f9fa', '#ffffff']
            }
          },
          axisLine: {
            lineStyle: {
              color: '#e4e7ed'
            }
          }
        },
        series: [
          {
            type: 'radar',
            data: [
              {
                value: [
                  normalized.return,
                  normalized.sharpe,
                  normalized.drawdown,
                  normalized.winRate,
                  normalized.profitLoss
                ],
                name: '策略表现',
                areaStyle: {
                  color: new echarts.graphic.RadialGradient(0.5, 0.5, 1, [
                    {
                      color: 'rgba(64, 158, 255, 0.3)',
                      offset: 0
                    },
                    {
                      color: 'rgba(64, 158, 255, 0.05)',
                      offset: 1
                    }
                  ])
                },
                lineStyle: {
                  color: '#409eff',
                  width: 2
                },
                itemStyle: {
                  color: '#409eff',
                  borderWidth: 2
                },
                emphasis: {
                  lineStyle: {
                    width: 4
                  },
                  itemStyle: {
                    borderWidth: 3
                  }
                }
              }
            ]
          }
        ]
      }

      chartInstance.setOption(option)
    }

    const handleResize = () => {
      if (chartInstance) {
        chartInstance.resize()
      }
    }

    onMounted(() => {
      initChart()
      window.addEventListener('resize', handleResize)
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      if (chartInstance) {
        chartInstance.dispose()
      }
    })

    watch(() => props.metrics, () => {
      initChart()
    }, { deep: true })

    return {
      chartRef
    }
  }
}
</script>

<style scoped>
.metrics-chart {
  width: 100%;
  height: 350px;
  min-height: 350px;
}
</style>
