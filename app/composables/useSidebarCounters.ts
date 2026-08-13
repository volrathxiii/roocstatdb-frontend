export const useSidebarCounters = () => {
  const api = useApi();

  const applicantStatsCount = useState<number>('sidebar-applicant-count', () => 0);
  const rosterMissingStatsCount = useState<number>('sidebar-roster-count', () => 0);

  async function refreshApplicantCount() {
    try {
      const res = await api.get<{ count: number }>('/api/players/applicant-stats-count');
      applicantStatsCount.value = res.count;
    } catch {
      // non-critical
    }
  }

  async function refreshRosterCount() {
    try {
      const res = await api.get<{ count: number }>('/api/players/members-missing-stats-count');
      rosterMissingStatsCount.value = res.count;
    } catch {
      // non-critical
    }
  }

  async function refreshAll() {
    await Promise.all([refreshApplicantCount(), refreshRosterCount()]);
  }

  return { applicantStatsCount, rosterMissingStatsCount, refreshApplicantCount, refreshRosterCount, refreshAll };
};
