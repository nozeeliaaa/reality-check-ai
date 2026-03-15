declare namespace chrome {
  namespace storage {
    interface StorageChange {
      oldValue?: unknown
      newValue?: unknown
    }

    interface StorageArea {
      get(
        keys: string | string[] | null,
        callback: (items: Record<string, unknown>) => void
      ): void
      set(items: Record<string, unknown>, callback?: () => void): void
      clear(callback?: () => void): void
    }

    const local: StorageArea

    namespace onChanged {
      function addListener(
        callback: (
          changes: Record<string, StorageChange>,
          areaName: string
        ) => void
      ): void
      function removeListener(
        callback: (
          changes: Record<string, StorageChange>,
          areaName: string
        ) => void
      ): void
    }
  }
}
