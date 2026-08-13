// Requires the user to be logged in and have Member+ role (not Applicant/Waitlisted).
// Used by: dashboard, rosters, party-setup
export default defineNuxtRouteMiddleware(() => {
  const { auth } = useAuth();
  if (!auth.value?.player) return navigateTo("/login");
  if (auth.value.role === "Applicant" || auth.value.role === "Waitlisted") {
    return navigateTo("/applicant");
  }
});
