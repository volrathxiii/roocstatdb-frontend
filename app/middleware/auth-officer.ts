// Requires the user to be logged in and have Officer or Admin role.
// Used by: applicants
export default defineNuxtRouteMiddleware(() => {
  const { auth } = useAuth();
  if (!auth.value?.player) return navigateTo("/login");
  if (auth.value.role !== "Officer" && auth.value.role !== "Admin") {
    return navigateTo("/dashboard");
  }
});
