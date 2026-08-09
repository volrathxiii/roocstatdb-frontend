<script setup lang="ts">
const { auth } = useAuth();

if (auth.value.player) {
  navigateTo(auth.value.isMember ? "/dashboard" : "/applicant");
} else {
  navigateTo("/login");
}
</script>

<template>
  <div />
</template>
