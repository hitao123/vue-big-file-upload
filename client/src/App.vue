<template>
  <div id="app">
    <UploadComponent />
  </div>
</template>

<script>
import UploadComponent from './view/upload.vue'

export default {
  name: 'App',
  components: {
    UploadComponent
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
