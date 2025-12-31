<template>
  <div ref="chartRef" class="equity-chart"></div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

export default {
  name: 'EquityCurveChart',
  props: {
    equityCurve: {
      type: Array,
      required: true,
      default: () => []
    },
    initialCash: {
      type: Number,
      default: 1000000
    }
  },
  setup(props) {
    const chartRef = ref(null)
    let chartInstance = null

    const initChart = () => {
      if (!chartRef.value || props.equityCurve.length === 0) return

      // 销毁旧实例
      if (chartInstance) {
        chartInstance.dispose()
      }

      chartInstance = echarts.init(chartRef.value)

      // 准备数据
      const dates = props.equityCurve.map(point => point.date || point.datetime)
      const values = props.equityCurve.map(point => point.value)
      
      // 计算收益率曲线
      const returns = values.map(val => ((val - props.initialCash) / props.initialCash * 100).toFixed(2))
      
      // 计算最大回撤曲线
      const drawdowns = []
      let peak = values[0]
      for (let i = 0; i < values.length; i++) {
        if (values[i] > peak) {
          peak = values[i]
        }
        const drawdown = ((values[i] - peak) / peak * 100).toFixed(2)
        drawdowns.push(drawdown)
      }

      const option = {
        backgroundColor: '#ffffff',
        title: {
          text: '净值曲线',
          left: 'center',
          textStyle: {
            color: '#2c3e50',
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
            crossStyle: {
              color: '#999'
            }
          },
          formatter: function (params) {
            let result = '<div style="font-weight: bold; margin-bottom: 8px;">' + params[0].axisValue + '</div>'
            params.forEach(param => {
              const color = param.color
              const seriesName = param.seriesName
              const value = param.value
              let displayValue = ''
              
              if (seriesName === '净值') {
                displayValue = '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              } else {
                displayValue = value + '%'
              }
              
              result += '<div style="display: flex; align-items: center; margin: 4px 0;">'
              result += '<span style="display: inline-block; width: 10px; height: 10px; background: ' + color + '; border-radius: 50%; margin-right: 8px;"></span>'
              result += '<span style="flex: 1;">' + seriesName + ':</span>'
              result += '<span style="font-weight: bold; margin-left: 12px;">' + displayValue + '</span>'
              result += '</div>'
            })
            return result
          }
        },
        legend: {
          data: ['净值', '收益率', '回撤'],
          top: 35,
          textStyle: {
            color: '#606266'
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: 80,
          containLabel: true
        },
        toolbox: {
          feature: {
            dataZoom: {
              yAxisIndex: 'none',
              title: {
                zoom: '区域缩放',
                back: '还原'
              }
            },
            restore: {
              title: '还原'
            },
            saveAsImage: {
              title: '保存图片',
              name: '净值曲线'
            }
          },
          top: 35,
          right: 20
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: dates,
          axisLabel: {
            color: '#606266',
            rotate: 45,
            // 智能采样，根据数据点数量决定显示间隔
            interval: function(index, value) {
              const totalPoints = dates.length
              // 根据总点数调整采样率，目标是显示 10-15 个标签
              if (totalPoints <= 30) {
                return index % 3 === 0  // 每 3 个点显示一次
              } else if (totalPoints <= 60) {
                return index % 5 === 0  // 每 5 个点显示一次
              } else if (totalPoints <= 120) {
                return index % 10 === 0  // 每 10 个点显示一次
              } else if (totalPoints <= 250) {
                return index % 20 === 0  // 每 20 个点显示一次
              } else {
                return index % 30 === 0  // 每 30 个点显示一次
              }
            },
            formatter: function(value) {
              // 只显示年月日，避免显示时间
              if (!value) return ''
              // 支持 YYYY-MM-DD 或 YYYYMMDD 格式
              if (value.includes('-')) {
                return value.split(' ')[0]  // 如果有时间部分，只取日期
              } else if (value.length === 8) {
                // YYYYMMDD 格式转换为 YYYY-MM-DD
                return value.slice(0,4) + '-' + value.slice(4,6) + '-' + value.slice(6,8)
              }
              return value
            }
          },
          axisLine: {
            lineStyle: {
              color: '#e4e7ed'
            }
          }
        },
        yAxis: [
          {
            type: 'value',
            name: '净值 (¥)',
            position: 'left',
            axisLabel: {
              color: '#606266',
              formatter: function(value) {
                // 更精确的格式化，使用中文单位
                if (value >= 10000000) {
                  // 千万级别
                  return (value / 10000000).toFixed(1) + 'KW'
                } else if (value >= 1000000) {
                  // 百万级别，不显示小数
                  return (value / 10000).toFixed(0) + 'W'
                } else if (value >= 10000) {
                  // 万级别
                  return (value / 10000).toFixed(1) + 'W'
                } else if (value >= 1000) {
                  // 千级别
                  return (value / 1000).toFixed(1) + 'K'
                }
                return value.toFixed(0)
              }
            },
            axisLine: {
              lineStyle: {
                color: '#e4e7ed'
              }
            },
            splitLine: {
              lineStyle: {
                color: '#f0f0f0'
              }
            }
          },
          {
            type: 'value',
            name: '收益率/回撤 (%)',
            position: 'right',
            axisLabel: {
              color: '#606266',
              formatter: '{value}%'
            },
            axisLine: {
              lineStyle: {
                color: '#e4e7ed'
              }
            },
            splitLine: {
              show: false
            }
          }
        ],
        series: [
          {
            name: '净值',
            type: 'line',
            yAxisIndex: 0,
            data: values,
            smooth: true,
            lineStyle: {
              width: 3,
              color: '#409eff'
            },
            itemStyle: {
              color: '#409eff'
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: 'rgba(64, 158, 255, 0.3)'
                },
                {
                  offset: 1,
                  color: 'rgba(64, 158, 255, 0.05)'
                }
              ])
            },
            emphasis: {
              focus: 'series'
            }
          },
          {
            name: '收益率',
            type: 'line',
            yAxisIndex: 1,
            data: returns,
            smooth: true,
            lineStyle: {
              width: 2,
              color: '#67c23a',
              type: 'dashed'
            },
            itemStyle: {
              color: '#67c23a'
            },
            emphasis: {
              focus: 'series'
            }
          },
          {
            name: '回撤',
            type: 'line',
            yAxisIndex: 1,
            data: drawdowns,
            smooth: true,
            lineStyle: {
              width: 2,
              color: '#f56c6c',
              type: 'dotted'
            },
            itemStyle: {
              color: '#f56c6c'
            },
            emphasis: {
              focus: 'series'
            }
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

    watch(() => props.equityCurve, () => {
      initChart()
    }, { deep: true })

    return {
      chartRef
    }
  }
}
</script>

<style scoped>
.equity-chart {
  width: 100%;
  height: 400px;
  min-height: 400px;
}
</style>
