import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import { ThemedApp } from './theme';
import LoginApp from './login/LoginApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemedApp>
      <LoginApp />
    </ThemedApp>
  </React.StrictMode>,
);
