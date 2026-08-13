// Requires the user to be logged in. No role restriction.
// Used by: applicant (landing page for non-members)
export default defineNuxtRouteMiddleware(() => {
  const { auth } = useAuth();
  if (!auth.value?.player) return navigateTo("/login");
});
