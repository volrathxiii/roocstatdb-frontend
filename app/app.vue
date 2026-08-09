<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </UApp>
</template>

<style>
:root {
  color-scheme: dark;
}

body {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 10%, rgba(56, 189, 248, 0.2), transparent 30%),
    radial-gradient(circle at 80% 0%, rgba(45, 212, 191, 0.15), transparent 25%),
    #020617;
}
</style>
