import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import viVN from 'antd/locale/vi_VN';

type Mode = 'light' | 'dark';

interface ThemeCtx {
  mode: Mode;
  isDark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ mode: 'light', isDark: false, toggle: () => { } });

/** Read the current theme mode + a toggle. Available anywhere inside <ThemedApp>. */
export const useThemeMode = () => useContext(Ctx);

const STORAGE_KEY = 'jb-theme';

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

/**
 * App-wide theme shell: antd ConfigProvider (light/defaultAlgorithm or dark/darkAlgorithm)
 * + brand tokens + the message/notification host (<App>). Wraps every entry point.
 */
export function ThemedApp({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const isDark = mode === 'dark';

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: Mode = m === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Keep the page background in sync (covers areas outside the antd Layout).
  useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    document.body.style.background = isDark ? '#0b0d14' : '#f4f5f8';
    document.body.style.margin = '0';
  }, [mode, isDark]);

  const ctx = useMemo(() => ({ mode, isDark, toggle }), [mode, isDark, toggle]);

  return (
    <Ctx.Provider value={ctx}>
      <ConfigProvider
        locale={viVN}
        // Global "filled" variant for every form control across the app.
        input={{ variant: 'filled' }}
        textArea={{ variant: 'filled' }}
        select={{ variant: 'filled' }}
        datePicker={{ variant: 'filled' }}
        inputNumber={{ variant: 'filled' }}
        cascader={{ variant: 'filled' }}
        treeSelect={{ variant: 'filled' }}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: isDark ? '#8b5cf6' : '#6366f1',
            colorInfo: isDark ? '#8b5cf6' : '#6366f1',
            // Unified 6px radius everywhere (all size variants forced to 6).
            borderRadius: 6,
            borderRadiusLG: 6,
            borderRadiusSM: 6,
            borderRadiusXS: 6,
            // Unified control height — Input / Select / Button / DatePicker / InputNumber all 36px.
            controlHeight: 36,
            colorBgLayout: isDark ? '#0b0d14' : '#f4f5f8',
            fontSize: 14,
          },
          components: {
            Layout: {
              headerBg: isDark ? '#10131c' : '#ffffff',
              siderBg: isDark ? '#10131c' : '#ffffff',
              bodyBg: isDark ? '#0b0d14' : '#f4f5f8',
            },
            Menu: {
              itemBorderRadius: 6,
              itemMarginInline: 8,
            },
            Card: {
              // Comfortable, consistent card padding across the app.
              paddingLG: 20,
              borderRadiusLG: 6,
            },
          },
        }}
        form={{
          requiredMark: (labelNode: React.ReactNode, info: { required: boolean }) => (
            <>
              {labelNode}
              {info.required && <span style={{ color: 'red', marginLeft: '4px' }}>(*)</span>}
            </>
          ),
        }}
      >
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </Ctx.Provider>
  );
}
