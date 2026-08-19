// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountSuspended, mockNuxtImport } from "@nuxt/test-utils/runtime";
import { flushPromises } from "@vue/test-utils";
import AutomaticPartySuggestionManager from "~/components/AutomaticPartySuggestionManager.vue";

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiDel = vi.hoisted(() => vi.fn());

mockNuxtImport("useApi", () => () => ({
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  del: apiDel,
}));

const jobs = [
  { id: 5, name: "High Priest" },
  { id: 13, name: "Champion" },
  { id: 7, name: "Paladin" },
];

const capabilities = [{ id: 1, name: "healing", description: "HP restoration" }];

const intents = [{
  id: 1,
  name: "Default",
  description: null,
  jobDiversityPenalty: 8,
  potentialGapMultiplier: 1,
  weights: [],
}];

const skills = [
  {
    id: 26,
    name: "Heal",
    description: "Restores the HP of an ally target and yourself.",
    jobClassSkills: [
      { id: 1, jobId: 5, job: { id: 5, name: "High Priest" } },
      { id: 2, jobId: 13, job: { id: 13, name: "Champion" } },
    ],
    skillCapabilities: [
      { id: 1, capabilityId: 1, effectiveness: 3, capability: { id: 1, name: "healing" } },
    ],
  },
];

function mockFetchAll() {
  apiGet.mockImplementation((path: string) => {
    if (path === "/api/ref-data/job-classes") return Promise.resolve(jobs);
    if (path === "/api/ref-data/capabilities") return Promise.resolve(capabilities);
    if (path === "/api/ref-data/party-intents") return Promise.resolve(intents);
    if (path === "/api/ref-data/skills-admin") return Promise.resolve(skills);
    return Promise.resolve([]);
  });
}

describe("AutomaticPartySuggestionManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll();
    apiPost.mockResolvedValue({});
    apiPatch.mockResolvedValue({});
    apiDel.mockResolvedValue({});
  });

  it("keeps multi-job skill visible when filtering by one linked job", async () => {
    const wrapper = await mountSuspended(AutomaticPartySuggestionManager, {
      props: { enabled: true },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    vm.selectedSkillJobId = 5;
    await vm.$nextTick();

    const names = vm.filteredSkills.map((entry: any) => entry.name);
    expect(names).toContain("Heal");
  });

  it("sends jobIds array when saving an edited skill", async () => {
    const wrapper = await mountSuspended(AutomaticPartySuggestionManager, {
      props: { enabled: true },
    });
    await flushPromises();

    const vm = wrapper.vm as any;
    vm.openEditSkill(skills[0]);
    vm.skillModal.name = "Heal";
    vm.skillModal.description = "Updated";
    vm.skillModal.jobIds = [5, 13];

    await vm.saveSkill();

    expect(apiPatch).toHaveBeenCalledWith(
      "/api/ref-data/skills/26",
      expect.objectContaining({
        name: "Heal",
        description: "Updated",
        jobIds: [5, 13],
      }),
    );
  });
});
