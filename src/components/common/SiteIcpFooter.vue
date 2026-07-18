<template>
  <footer class="site-icp-footer" role="contentinfo">
    <a
      href="https://beian.miit.gov.cn/"
      target="_blank"
      rel="noopener noreferrer"
    >
      浙ICP备2026000921号-1
    </a>
  </footer>
</template>

<style scoped>
.site-icp-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.site-icp-footer a {
  pointer-events: auto;
  color: rgba(226, 232, 240, 0.85);
  font-size: 12px;
  line-height: 1.4;
  text-decoration: none;
  letter-spacing: 0.02em;
}

.site-icp-footer a:hover {
  color: #fff;
  text-decoration: underline;
}
</style>
