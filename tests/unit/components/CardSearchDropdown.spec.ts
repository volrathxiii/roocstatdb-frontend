// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import CardSearchDropdown from '~/components/CardSearchDropdown.vue';

describe('CardSearchDropdown.vue', () => {
  let wrapper: any;

  beforeEach(async () => {
    wrapper = await mountSuspended(CardSearchDropdown);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders search dropdown component', () => {
    expect(wrapper.vm).toBeDefined();
  });

  it('component is mounted without errors', () => {
    expect(wrapper.vm).toBeTruthy();
  });

  it('renders without throwing', () => {
    expect(wrapper.html()).toBeDefined();
  });

  it('is a valid Vue instance', () => {
    expect(wrapper.vm.$el || wrapper.html()).toBeTruthy();
  });

  it('can render multiple times', async () => {
    await wrapper.vm.$forceUpdate();
    expect(wrapper.vm).toBeTruthy();
  });
});
