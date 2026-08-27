// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import PlayerCardInventoryModal from '~/components/PlayerCardInventoryModal.vue';

describe('PlayerCardInventoryModal.vue', () => {
  let wrapper: any;

  beforeEach(async () => {
    wrapper = await mountSuspended(PlayerCardInventoryModal, {
      props: {
        isOpen: true,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal component', () => {
    expect(wrapper.vm).toBeDefined();
  });

  it('accepts isOpen prop', () => {
    expect(wrapper.props('isOpen')).toBe(true);
  });

  it('can toggle isOpen prop', async () => {
    await wrapper.setProps({ isOpen: false });
    expect(wrapper.props('isOpen')).toBe(false);
  });

  it('component mounts without errors', () => {
    expect(wrapper.vm).toBeTruthy();
  });

  it('component is a valid Vue instance', () => {
    expect(wrapper.vm.$el || wrapper.html()).toBeTruthy();
  });
});
