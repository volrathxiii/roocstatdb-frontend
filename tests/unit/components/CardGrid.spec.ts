// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import CardGrid from '~/components/CardGrid.vue';

describe('CardGrid.vue', () => {
  let wrapper: any;

  beforeEach(async () => {
    wrapper = await mountSuspended(CardGrid);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders card grid component', () => {
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
