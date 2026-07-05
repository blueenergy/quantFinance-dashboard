<template>
  <div class="industry-rs-explainer">
    <p class="reference-note">
      <strong>含义：</strong>个股相对所属申万行业指数的多窗口相对强弱（RS），是与价量动量正交的「相对行业」视角；不参与综合分计算，也不参与组合选股。
    </p>
    <p class="reference-note">
      <strong>读数：</strong>&gt;50 相对行业强势，&lt;50 相对行业弱势，≈50 与行业同步；无行业映射或指数数据不足时显示「—」。
    </p>
    <button
      type="button"
      class="reference-toggle"
      :aria-expanded="showMethod"
      @click="showMethod = !showMethod"
    >
      {{ showMethod ? '收起计算方法' : '查看计算方法' }}
    </button>
    <div v-show="showMethod" class="reference-method">
      <p class="reference-method-title">计算方法</p>
      <ul class="reference-method-list">
        <li>基准分 50，基准为申万行业指数（默认一级 L1）。</li>
        <li>在 20 / 60 / 120 个交易日三个窗口，分别计算 RS = 个股收益 − 行业指数收益。</li>
        <li>各窗口按参考值折算给分：20 日（参考 5%，满分 ±12）、60 日（参考 10%，±16）、120 日（参考 20%，±22）；长窗口权重更高。</li>
        <li>多窗口共振：全部跑赢 +10，全部跑输 −10。</li>
        <li>结果裁剪到 [0, 100]。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showMethod = ref(false)
</script>

<style scoped>
.industry-rs-explainer { margin-top: 12px; }
.reference-note { color: #6c757d; font-size: 13px; line-height: 1.55; margin: 0 0 8px; }
.reference-note strong { color: #495057; font-weight: 600; }
.reference-toggle {
  display: inline-block;
  margin: 2px 0 0;
  padding: 0;
  border: none;
  background: none;
  color: #5c6bc0;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
}
.reference-toggle:hover { color: #3949ab; }
.reference-method {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 6px;
  background-color: #f8f9ff;
  border: 1px solid #e0e3f5;
}
.reference-method-title {
  margin: 0 0 6px;
  color: #495057;
  font-size: 13px;
  font-weight: 600;
}
.reference-method-list {
  margin: 0;
  padding-left: 18px;
  color: #6c757d;
  font-size: 13px;
  line-height: 1.55;
}
.reference-method-list li + li { margin-top: 4px; }
</style>
