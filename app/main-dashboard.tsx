import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './index.css';
import { ThemedApp } from './theme';
import DashboardApp from './dashboard/DashboardApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemedApp>
      <DashboardApp />
    </ThemedApp>
  </React.StrictMode>,
);
