// Requires the user to be logged in and have Admin role.
// Used by: management
export default defineNuxtRouteMiddleware(() => {
  const { auth } = useAuth();
  if (!auth.value?.player) return navigateTo("/login");
  if (auth.value.role !== "Admin") return navigateTo("/dashboard");
});
