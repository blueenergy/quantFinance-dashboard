<template>
  <div class="watchlist">
    <h2>⭐ 自选股</h2>
    <div class="add-stock">
      <input v-model="inputSymbol" placeholder="添加股票代码 (如 600519)" @keyup.enter="addStock" />
      <button @click="addStock">添加</button>
    </div>
    <ul>
      <li v-for="symbol in watchList" :key="symbol">
        <span @click="$emit('select', symbol)" style="cursor:pointer">{{ symbol }}</span>
        <button @click="removeStock(symbol)" style="margin-left:10px">移除</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const inputSymbol = ref('');
const watchList = ref(JSON.parse(localStorage.getItem('watchList') || '[]'));

function addStock() {
  const symbol = inputSymbol.value.trim();
  if (symbol && !watchList.value.includes(symbol)) {
    watchList.value.push(symbol);
    localStorage.setItem('watchList', JSON.stringify(watchList.value));
    inputSymbol.value = '';
  }
}

function removeStock(symbol) {
  watchList.value = watchList.value.filter(s => s !== symbol);
  localStorage.setItem('watchList', JSON.stringify(watchList.value));
}
</script>

<style scoped>
.watchlist {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.add-stock {
  margin-bottom: 10px;
}
input {
  padding: 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
}
button {
  margin-left: 5px;
  padding: 6px 12px;
  border-radius: 4px;
  border: none;
  background: #007bff;
  color: #fff;
  cursor: pointer;
}
button:hover {
  background: #0056b3;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  margin-bottom: 8px;
}
</style>
