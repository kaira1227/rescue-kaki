import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { routes } from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-background">
        <Routes>
          {routes.map((route, index) => (
            <Route key={index} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toaster theme="dark" />
    </Router>
  );
};

export default App;
