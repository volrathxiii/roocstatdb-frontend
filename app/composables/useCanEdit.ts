export const useCanEdit = () => {
  const { auth } = useAuth();
  return computed(() => auth.value.role === "Officer" || auth.value.role === "Admin");
};
