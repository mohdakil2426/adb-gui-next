import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { backend } from '@/desktop/models';
import { applyFilters, useDebloatStore } from '@/features/app-manager/debloater/model/debloatStore';

vi.mock('@/desktop/backend', () => ({
  core: {
    invoke: vi.fn(),
  },
}));

const mockPackages: backend.DebloatPackageRow[] = [
  {
    name: 'com.android.app1',
    description: 'App 1 description',
    list: 'Google',
    removal: 'Recommended',
    state: 'Enabled',
    dependencies: [],
    neededBy: [],
  },
  {
    name: 'com.android.app2',
    description: 'App 2 description',
    list: 'Carrier',
    removal: 'Advanced',
    state: 'Enabled',
    dependencies: [],
    neededBy: [],
  },
  {
    name: 'com.android.app3',
    description: 'App 3 description',
    list: 'Google',
    removal: 'Unsafe',
    state: 'Disabled',
    dependencies: [],
    neededBy: [],
  },
];

describe('debloatStore', () => {
  beforeEach(() => {
    useDebloatStore.setState({
      packages: [],
      listStatus: null,
      isLoadingPackages: false,
      isApplying: false,
      searchQuery: '',
      listFilter: 'All',
      removalFilter: 'All',
      stateFilter: 'All',
      selectedPackages: new Set(),
      currentPackageName: null,
      expertMode: false,
      disableMode: false,
      multiUserMode: false,
      backups: [],
      selectedBackupFileName: null,
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      useDebloatStore.getState().setSearchQuery('app1');

      expect(useDebloatStore.getState().searchQuery).toBe('app1');
    });
  });

  describe('setListFilter', () => {
    it('should update list filter', () => {
      useDebloatStore.getState().setListFilter('Google');

      expect(useDebloatStore.getState().listFilter).toBe('Google');
    });
  });

  describe('setRemovalFilter', () => {
    it('should update removal filter', () => {
      useDebloatStore.getState().setRemovalFilter('Advanced');

      expect(useDebloatStore.getState().removalFilter).toBe('Advanced');
    });
  });

  describe('setStateFilter', () => {
    it('should update state filter', () => {
      useDebloatStore.getState().setStateFilter('Enabled');

      expect(useDebloatStore.getState().stateFilter).toBe('Enabled');
    });
  });

  describe('setPackages', () => {
    it('should set packages', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const state = useDebloatStore.getState();
      expect(state.packages).toHaveLength(3);
      expect(state.packages[0]?.name).toBe('com.android.app1');
    });
  });

  describe('getPackages (applyFilters)', () => {
    it('should return all packages when no filters', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const filtered = applyFilters(mockPackages, {
        listFilter: 'All',
        removalFilter: 'All',
        stateFilter: 'All',
        searchQuery: '',
      });

      expect(filtered).toHaveLength(3);
    });

    it('should filter by search query', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const filtered = applyFilters(mockPackages, {
        listFilter: 'All',
        removalFilter: 'All',
        stateFilter: 'All',
        searchQuery: 'app1',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('com.android.app1');
    });

    it('should filter by list filter', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const filtered = applyFilters(mockPackages, {
        listFilter: 'Google',
        removalFilter: 'All',
        stateFilter: 'All',
        searchQuery: '',
      });

      expect(filtered).toHaveLength(2);
    });

    it('should filter by removal filter', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const filtered = applyFilters(mockPackages, {
        listFilter: 'All',
        removalFilter: 'Advanced',
        stateFilter: 'All',
        searchQuery: '',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('com.android.app2');
    });

    it('should filter by state filter', () => {
      useDebloatStore.getState().setPackages(mockPackages);

      const filtered = applyFilters(mockPackages, {
        listFilter: 'All',
        removalFilter: 'All',
        stateFilter: 'Disabled',
        searchQuery: '',
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('com.android.app3');
    });
  });

  describe('togglePackage', () => {
    it('should add package to selected', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().togglePackage('com.android.app1');

      expect(useDebloatStore.getState().selectedPackages.has('com.android.app1')).toBe(true);
    });

    it('should remove package from selected when already selected', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().togglePackage('com.android.app1');
      useDebloatStore.getState().togglePackage('com.android.app1');

      expect(useDebloatStore.getState().selectedPackages.has('com.android.app1')).toBe(false);
    });

    it('should not allow selecting Unsafe packages without expert mode', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().togglePackage('com.android.app3');

      expect(useDebloatStore.getState().selectedPackages.has('com.android.app3')).toBe(false);
    });

    it('should allow selecting Unsafe packages with expert mode', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().setExpertMode(true);
      useDebloatStore.getState().togglePackage('com.android.app3');

      expect(useDebloatStore.getState().selectedPackages.has('com.android.app3')).toBe(true);
    });
  });

  describe('selectAll', () => {
    it('should select all filtered packages', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().setListFilter('Google');
      useDebloatStore.getState().selectAll();

      const state = useDebloatStore.getState();
      expect(state.selectedPackages.has('com.android.app1')).toBe(true);
      expect(state.selectedPackages.has('com.android.app3')).toBe(false); // Unsafe excluded
    });

    it('should select Unsafe packages in expert mode', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().setExpertMode(true);
      useDebloatStore.getState().setListFilter('Google');
      useDebloatStore.getState().selectAll();

      const state = useDebloatStore.getState();
      expect(state.selectedPackages.has('com.android.app1')).toBe(true);
      expect(state.selectedPackages.has('com.android.app3')).toBe(true);
    });
  });

  describe('unselectAll', () => {
    it('should deselect all packages', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().selectAll();
      useDebloatStore.getState().unselectAll();

      expect(useDebloatStore.getState().selectedPackages.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('should clear selected packages via unselectAll', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().togglePackage('com.android.app1');
      useDebloatStore.getState().togglePackage('com.android.app2');
      useDebloatStore.getState().unselectAll();

      expect(useDebloatStore.getState().selectedPackages.size).toBe(0);
    });
  });

  describe('setExpertMode', () => {
    it('should deselect Unsafe packages when turning off expert mode', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().setExpertMode(true);
      useDebloatStore.getState().togglePackage('com.android.app3');
      useDebloatStore.getState().setExpertMode(false);

      expect(useDebloatStore.getState().selectedPackages.has('com.android.app3')).toBe(false);
    });
  });

  describe('resetFilters', () => {
    it('should reset all filters to default', () => {
      useDebloatStore.getState().setSearchQuery('test');
      useDebloatStore.getState().setListFilter('Google');
      useDebloatStore.getState().setRemovalFilter('Advanced');
      useDebloatStore.getState().setStateFilter('Enabled');
      useDebloatStore.getState().resetFilters();

      const state = useDebloatStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.listFilter).toBe('All');
      expect(state.removalFilter).toBe('All');
      expect(state.stateFilter).toBe('All');
    });
  });

  describe('applyResults', () => {
    it('should update package states after applying results', () => {
      useDebloatStore.getState().setPackages(mockPackages);
      useDebloatStore.getState().togglePackage('com.android.app1');

      useDebloatStore.getState().applyResults([
        {
          packageName: 'com.android.app1',
          success: true,
          newState: 'Uninstalled',
          error: null,
        },
      ]);

      const state = useDebloatStore.getState();
      expect(state.packages[0]?.state).toBe('Uninstalled');
      expect(state.selectedPackages.has('com.android.app1')).toBe(false);
    });
  });

  describe('setCurrentPackageName', () => {
    it('should set current package for description panel', () => {
      useDebloatStore.getState().setCurrentPackageName('com.android.app1');

      expect(useDebloatStore.getState().currentPackageName).toBe('com.android.app1');
    });

    it('should allow clearing current package', () => {
      useDebloatStore.getState().setCurrentPackageName('com.android.app1');
      useDebloatStore.getState().setCurrentPackageName(null);

      expect(useDebloatStore.getState().currentPackageName).toBeNull();
    });
  });
});
