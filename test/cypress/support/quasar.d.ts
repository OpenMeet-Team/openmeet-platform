export {}

declare global {
  interface Window {
    $q: {
      dialog: (options: {
        onOk?: (value: string) => void;
        onCancel?: () => void;
      }) => {
        onOk: (cb: (handle: string) => void) => Promise<void>;
        onCancel: () => void;
      };
    };
  }
}
